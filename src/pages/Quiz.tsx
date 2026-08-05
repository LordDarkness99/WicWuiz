import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getQuizWithQuestions, 
  storeQuizAttempt,
} from '../lib/quizStorage';

interface Question {
  id: string;
  question: string;
  type: 'essay';
  points?: number;
  imageUrl?: string;
}

const Quiz = () => {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [essayAnswer, setEssayAnswer] = useState<string>('');
  const [essayAnswers, setEssayAnswers] = useState<{ [key: number]: string }>({});
  const [timeLeft, setTimeLeft] = useState(300);
  const [isCompleted, setIsCompleted] = useState(false);
  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sharedQuizId = params.id;

  useEffect(() => {
    const loadQuiz = async () => {
      if (!sharedQuizId) {
        setError('Quiz ID not found');
        setLoading(false);
        return;
      }

      try {
        const quiz = await getQuizWithQuestions(sharedQuizId);
        if (!quiz) {
          setError('Quiz not found');
          setLoading(false);
          return;
        }

        if (!quiz.is_public && user?.id !== quiz.teacher_id) {
          setError('This quiz is not available');
          setLoading(false);
          return;
        }

        const formattedQuiz = {
          ...quiz,
          name: quiz.title,
          timeLimit: quiz.time_limit ? Math.floor(quiz.time_limit / 60) : 5,
          questions: quiz.questions || []
        };

        setQuizData(formattedQuiz);
        setTimeLeft(quiz.time_limit || 300);
        setEssayAnswers({});
        setLoading(false);
      } catch (err) {
        console.error('Error loading quiz:', err);
        setError('Failed to load quiz');
        setLoading(false);
      }
    };

    loadQuiz();
  }, [sharedQuizId, user]);

  const questions: Question[] = quizData?.questions || [];

  const handleComplete = async () => {
    setIsCompleted(true);

    // Pastikan jawaban essay terakhir tersimpan
    if (questions[currentQuestion] && essayAnswer) {
      setEssayAnswers(prev => ({
        ...prev,
        [currentQuestion]: essayAnswer
      }));
    }

    // Semua soal essay, skor awal 0
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 10), 0);
    const questionScores: { [key: number]: number } = {};
    questions.forEach((_, index) => {
      questionScores[index] = 0; // guru akan menilai nanti
    });

    // Simpan attempt
    if (user?.id) {
      const timeSpent = quizData?.time_limit 
        ? quizData.time_limit - timeLeft 
        : 300 - timeLeft;

      // Pastikan essayAnswers tersimpan
      console.log('Saving essay answers:', essayAnswers);
      console.log('Question scores:', questionScores);

      const success = await storeQuizAttempt(
        sharedQuizId!,
        user.id,
        0, // skor awal 0
        totalPoints,
        timeSpent,
        [], // tidak ada multiple choice
        essayAnswers,
        questionScores
      );

      if (!success) {
        console.error('Failed to save quiz attempt');
      } else {
        console.log('Quiz attempt saved successfully');
      }
    }

    // Navigate ke hasil
    navigate('/results', {
      state: {
        score: 0,
        total: totalPoints,
        answers: [],
        essayAnswers,
        questions,
        quizTitle: quizData?.title || 'Quiz'
      }
    });
  };

  const handleNext = () => {
    // Simpan jawaban essay
    if (questions[currentQuestion]) {
      setEssayAnswers(prev => ({
        ...prev,
        [currentQuestion]: essayAnswer
      }));
      setEssayAnswer('');
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleComplete();
    }
  };

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !isCompleted && !loading) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isCompleted) {
      handleComplete();
    }
  }, [timeLeft, isCompleted, loading]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = questions.length > 0 
    ? ((currentQuestion + 1) / questions.length) * 100 
    : 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Quiz...</h2>
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!quizData || questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quiz Not Found</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft size={20} />
          <span>Back</span>
        </button>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-gray-600">
            <Clock size={20} />
            <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
          </div>
          <div className="text-sm text-gray-500">
            Question {currentQuestion + 1} of {questions.length}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>

      {/* Question Card */}
      <div className="quiz-card p-8 mb-8">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            {currentQ?.question}
          </h2>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
            {currentQ?.points || 10} points
          </span>
        </div>

        {/* Image */}
        {currentQ?.imageUrl && (
          <div className="mb-6 flex justify-center">
            <img 
              src={currentQ.imageUrl} 
              alt="Question" 
              className="max-w-full h-64 object-contain rounded-lg border border-gray-200"
            />
          </div>
        )}

        {/* Essay Textarea */}
        <div className="space-y-4">
          <textarea
            value={essayAnswer || essayAnswers[currentQuestion] || ''}
            onChange={(e) => {
              setEssayAnswer(e.target.value);
              setEssayAnswers(prev => ({
                ...prev,
                [currentQuestion]: e.target.value
              }));
            }}
            rows={8}
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200"
            placeholder="Write your answer here..."
          />
          <p className="text-sm text-gray-500">
            {currentQ?.points || 10} points maximum
          </p>
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!essayAnswer && !essayAnswers[currentQuestion]}
          className={`quiz-button ${
            !essayAnswer && !essayAnswers[currentQuestion]
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-xl'
          }`}
        >
          {currentQuestion === questions.length - 1 ? 'Complete Quiz' : 'Next Question'}
        </button>
      </div>
    </div>
  );
};

export default Quiz;