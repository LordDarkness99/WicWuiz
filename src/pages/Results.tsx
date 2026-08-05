// src/pages/Results.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Home, Award } from 'lucide-react';

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { score, total, answers, essayAnswers, questions, quizTitle } = location.state || {};

  if (!questions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No results found</h2>
          <button onClick={() => navigate('/')} className="text-purple-600 hover:text-purple-800">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const percentage = total > 0 ? (score / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{quizTitle || 'Quiz Results'}</h1>
          <div className="flex items-center space-x-4">
            <div className="bg-purple-100 p-4 rounded-full">
              <Award className="text-purple-600" size={32} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {score} / {total}
              </p>
              <p className="text-gray-600">
                {percentage.toFixed(1)}% – {percentage >= 80 ? 'Excellent! 🎉' : percentage >= 60 ? 'Good Job! 👍' : 'Keep Practicing! 💪'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((q: any, index: number) => (
            <div key={index} className="bg-white rounded-xl shadow-lg p-6">
              <p className="font-semibold text-gray-900 mb-3">
                {index + 1}. {q.question}
              </p>
              {q.imageUrl && (
                <img src={q.imageUrl} alt="Question" className="max-w-xs h-32 object-cover rounded-lg mb-3" />
              )}

              {q.type === 'essay' ? (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Your Essay Answer:</p>
                  <p className="mt-1 whitespace-pre-wrap">{essayAnswers?.[index] || 'No answer provided'}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    This essay will be graded by your teacher.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {q.options.map((option: string, optIdx: number) => {
                    const isCorrect = optIdx === q.correct;
                    const isSelected = answers && answers[index] === optIdx;
                    let className = 'px-4 py-2 rounded-lg text-sm ';
                    if (isCorrect) className += 'bg-green-100 text-green-800 border-green-500';
                    else if (isSelected && !isCorrect) className += 'bg-red-100 text-red-800 border-red-500';
                    else className += 'bg-gray-50 text-gray-700';
                    return (
                      <div key={optIdx} className={className}>
                        {option} {isCorrect && <CheckCircle className="inline ml-2 text-green-600" size={16} />}
                        {isSelected && !isCorrect && <XCircle className="inline ml-2 text-red-600" size={16} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Home size={20} />
            <span>Go Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Results;