// src/pages/TeacherDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  Plus, Users, Clock, BarChart3, History, Share2, Image, Type, Trash2, Eye, X
} from 'lucide-react';
import {
  getTeacherQuizzesWithAttempts,
  createQuizInDB,
  updateQuizShowDetails,
  getStudentAttemptWithQuizDetails,
} from '../lib/quizStorage';
import { supabase } from '../integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ---------- Tipe Data ----------
interface FormattedQuiz {
  id: string;
  title: string;
  description: string;
  time_limit: number;
  is_public: boolean;
  show_detailed_results: boolean;
  created_at: string;
  attempts: {
    id: string;
    studentName: string;
    studentEmail: string;
    score: number;
    totalQuestions: number;
    completedAt: Date;
    timeTaken: number;
    answers: any[];
  }[];
}

// Helper: ambil quiz lengkap dengan questions
const getQuizWithQuestions = async (quizId: string) => {
  const { data, error } = await supabase
    .from('quizzes')
    .select(`
      *,
      questions (*)
    `)
    .eq('id', quizId)
    .single();
  if (error) throw error;
  return data;
};

// ---------- Komponen Utama ----------
const TeacherDashboard = () => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<FormattedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [createdQuizLink, setCreatedQuizLink] = useState<string>('');

  // State untuk grading essay
  const [selectedAttemptForGrading, setSelectedAttemptForGrading] = useState<{
    attempt: any;
    quiz: any;
    studentName: string;
  } | null>(null);
  const [essayScores, setEssayScores] = useState<{ [key: number]: number }>({});
  const [isGradingDialogOpen, setIsGradingDialogOpen] = useState(false);

  // ---------- Fungsi Refresh Data ----------
  const refreshQuizzes = async () => {
    if (!user) return;
    try {
      const rawData = await getTeacherQuizzesWithAttempts(user.id);
      const formatted: FormattedQuiz[] = rawData.map((quiz: any) => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description || '',
        time_limit: quiz.time_limit || 0,
        is_public: quiz.is_public || false,
        show_detailed_results: quiz.show_detailed_results || false,
        created_at: quiz.created_at,
        attempts: (quiz.attempts || []).map((attempt: any) => ({
          id: attempt.id,
          studentName: attempt.student?.name || 'Unknown',
          studentEmail: attempt.student?.email || '',
          score: attempt.score || 0,
          totalQuestions: attempt.total_points || 0,
          completedAt: new Date(attempt.completed_at),
          timeTaken: attempt.time_taken || 0,
          answers: attempt.answers || [],
        }))
      }));
      setQuizzes(formatted);
    } catch (error) {
      console.error('Error refreshing quizzes:', error);
    }
  };

  // Ambil data awal
  useEffect(() => {
    if (!user) return;
    const fetchQuizzes = async () => {
      setLoading(true);
      await refreshQuizzes();
      setLoading(false);
    };
    fetchQuizzes();
  }, [user, activeTab]);

  // Validasi role
  if (!user || user.role !== 'teacher') {
    return <Navigate to="/auth" replace />;
  }

  // ---------- Fungsi CRUD Quiz ----------
  const handleCreateQuiz = async (quizData: any) => {
    try {
      const quizId = await createQuizInDB(
        {
          title: quizData.title,
          description: quizData.description,
          timeLimit: quizData.timeLimit || 15,
          questions: quizData.questions,
          isActive: true,
        },
        user.id
      );
      if (quizId) {
        await refreshQuizzes();
        setActiveTab('overview');
        const shareLink = `${window.location.origin}/quiz/shared/${quizId}`;
        setCreatedQuizLink(shareLink);
        alert(`Quiz created successfully!\nShare link: ${shareLink}`);
      } else {
        alert('Failed to create quiz. Check console.');
      }
    } catch (error) {
      console.error('Error creating quiz:', error);
      alert('An error occurred while creating the quiz.');
    }
  };

  const toggleQuizStatus = async (quizId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_public: !currentStatus })
        .eq('id', quizId);
      if (error) throw error;
      await refreshQuizzes();
    } catch (error) {
      console.error('Error toggling quiz status:', error);
      alert('Failed to update quiz status.');
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) return;
    try {
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      if (error) throw error;
      await refreshQuizzes();
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('Failed to delete quiz.');
    }
  };

  // ---------- FUNGSI GRADING ESSAY (DIPERBAIKI) ----------
  const openGradingDialog = async (attemptId: string, quizId: string, studentName: string) => {
    try {
      // Ambil attempt
      const { data: attempt, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('id', attemptId)
        .single();
      if (error) throw error;

      // Ambil quiz + questions
      const quiz = await getQuizWithQuestions(quizId);
      if (!quiz) throw new Error('Quiz not found');

      setSelectedAttemptForGrading({ attempt, quiz, studentName });

      // Ambil skor yang sudah ada (jika ada) dan konversi ke { [key: number]: number }
      const scores = attempt.question_scores || {};
      const parsedScores: { [key: number]: number } = {};
      Object.keys(scores).forEach(key => {
        const val = scores[key];
        parsedScores[Number(key)] = typeof val === 'number' ? val : 0;
      });
      setEssayScores(parsedScores);

      setIsGradingDialogOpen(true);
    } catch (error) {
      console.error('Error opening grading dialog:', error);
      alert('Failed to load attempt details');
    }
  };

  const saveEssayScores = async () => {
    if (!selectedAttemptForGrading) return;

    try {
      const attempt = selectedAttemptForGrading.attempt;
      const quiz = selectedAttemptForGrading.quiz;

      // 1. Ambil question_scores yang sudah ada (dari database)
      const currentScores = attempt.question_scores || {};

      // 2. Gabungkan dengan skor essay yang baru (hanya untuk indeks yang di-grade)
      //    Pastikan essayScores hanya berisi indeks yang benar-benar essay
      const updatedScores = { ...currentScores, ...essayScores };

      // 3. Hitung total skor: jumlah semua nilai di updatedScores
      let totalScore = 0;
      Object.values(updatedScores).forEach((val: any) => {
        if (typeof val === 'number') totalScore += val;
        else if (typeof val === 'string') totalScore += parseFloat(val) || 0;
      });

      // 4. Update database
      const { error } = await supabase
        .from('quiz_attempts')
        .update({
          score: totalScore,
          question_scores: updatedScores,
        })
        .eq('id', attempt.id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      alert(`Scores saved successfully! Total score: ${totalScore}`);
      setIsGradingDialogOpen(false);

      // 5. Refresh data agar tampilan terbaru
      await refreshQuizzes();

    } catch (error) {
      console.error('Error saving essay scores:', error);
      alert(`Failed to save scores: ${error.message || 'Unknown error'}`);
    }
  };

  // ---------- Statistik ----------
  const stats = {
    totalQuizzes: quizzes.length,
    totalAttempts: quizzes.reduce((acc, q) => acc + q.attempts.length, 0),
    activeQuizzes: quizzes.filter(q => q.is_public).length,
    avgScore: quizzes.length > 0
      ? quizzes.reduce((acc, q) => {
          const total = q.attempts.reduce((sum, a) => sum + (a.score / a.totalQuestions || 0), 0);
          return acc + total;
        }, 0) / quizzes.reduce((acc, q) => acc + q.attempts.length, 0) * 100
      : 0,
  };

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white/90 backdrop-blur-sm shadow-xl h-screen sticky top-0">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 quiz-gradient rounded-lg flex items-center justify-center">
                <Users className="text-white" size={20} />
              </div>
              <div>
                <h1 className="font-bold text-xl gradient-text">Teacher Portal</h1>
                <p className="text-sm text-gray-600">{user.name}</p>
              </div>
            </div>
            <nav className="space-y-2">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'create', label: 'Create Quiz', icon: Plus },
                { id: 'history', label: 'Quiz History', icon: History },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-purple-100 text-purple-700 shadow-lg'
                      : 'text-gray-600 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  stats={stats}
                  quizzes={quizzes}
                  createdQuizLink={createdQuizLink}
                  setCreatedQuizLink={setCreatedQuizLink}
                  onToggleStatus={toggleQuizStatus}
                  onDeleteQuiz={deleteQuiz}
                  onRefresh={refreshQuizzes}
                />
              )}
              {activeTab === 'create' && (
                <CreateQuizForm
                  onSubmit={handleCreateQuiz}
                  onCancel={() => setActiveTab('overview')}
                />
              )}
              {activeTab === 'history' && (
                <HistoryTab
                  quizzes={quizzes}
                  onGradeAttempt={openGradingDialog}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog Grading Essay */}
      {isGradingDialogOpen && selectedAttemptForGrading && (
        <Dialog open={isGradingDialogOpen} onOpenChange={setIsGradingDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Grade Essay Answers - {selectedAttemptForGrading.quiz.title}
              </DialogTitle>
              <p className="text-sm text-gray-500">
                Student: {selectedAttemptForGrading.studentName}
              </p>
            </DialogHeader>

            <div className="space-y-6">
              {selectedAttemptForGrading.quiz.questions.map((q: any, index: number) => {
                // Hanya tampilkan pertanyaan dengan type 'essay'
                if (q.question_type !== 'essay') return null;

                const essayAnswer = selectedAttemptForGrading.attempt.essay_answers?.[index] || '';
                const currentScore = essayScores[index] || 0;
                const maxScore = q.points || 10;

                return (
                  <div key={index} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{index + 1}. {q.question_text}</h3>
                    {q.image_url && (
                      <img
                        src={q.image_url}
                        alt="Question"
                        className="max-w-xs h-32 object-cover rounded-lg mb-2"
                      />
                    )}
                    <div className="bg-gray-50 p-3 rounded mb-3">
                      <p className="text-sm text-gray-600">Student's Answer:</p>
                      <p className="mt-1 whitespace-pre-wrap">{essayAnswer || 'No answer provided'}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <label className="text-sm font-medium">Score:</label>
                      <input
                        type="number"
                        min="0"
                        max={maxScore}
                        value={currentScore}
                        onChange={(e) => {
                          const value = Math.min(parseInt(e.target.value) || 0, maxScore);
                          setEssayScores(prev => ({
                            ...prev,
                            [index]: value
                          }));
                        }}
                        className="w-20 px-3 py-1 border rounded-lg"
                      />
                      <span className="text-sm text-gray-500">/ {maxScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setIsGradingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveEssayScores} className="bg-purple-600 hover:bg-purple-700">
                Save Scores
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// ---------- Subkomponen ----------

// ... (sama seperti sebelumnya, tidak perlu diubah)
// Saya hanya lampirkan yang penting, tapi untuk kelengkapan, saya sertakan semua.

const OverviewTab: React.FC<{
  stats: any;
  quizzes: FormattedQuiz[];
  createdQuizLink: string;
  setCreatedQuizLink: (link: string) => void;
  onToggleStatus: (id: string, current: boolean) => void;
  onDeleteQuiz: (id: string) => void;
  onRefresh: () => void;
}> = ({ stats, quizzes, createdQuizLink, setCreatedQuizLink, onToggleStatus, onDeleteQuiz, onRefresh }) => {
  const handleToggleDetails = async (quizId: string, currentValue: boolean) => {
    const newValue = !currentValue;
    const success = await updateQuizShowDetails(quizId, newValue);
    if (success) {
      onRefresh();
    } else {
      alert('Failed to update setting.');
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Quizzes" value={stats.totalQuizzes} icon={BarChart3} color="purple" />
        <StatCard label="Active Quizzes" value={stats.activeQuizzes} icon={Clock} color="green" />
        <StatCard label="Total Attempts" value={stats.totalAttempts} icon={Users} color="blue" />
        <StatCard label="Avg Score" value={`${stats.avgScore.toFixed(1)}%`} icon={BarChart3} color="orange" />
      </div>
      {createdQuizLink && (
        <div className="sidebar-card p-6 mb-6 bg-green-50 border border-green-200">
          <h3 className="text-xl font-semibold text-green-800 mb-4">Quiz Created Successfully! 🎉</h3>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-green-700">Share this link with students:</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={createdQuizLink}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdQuizLink);
                  alert('Link copied to clipboard!');
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setCreatedQuizLink('')}
              className="text-sm text-green-600 hover:text-green-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="sidebar-card p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Quizzes</h3>
        {quizzes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No quizzes created yet.</p>
        ) : (
          <div className="space-y-4">
            {quizzes.slice(0, 5).map((quiz) => (
              <div key={quiz.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{quiz.title}</h4>
                  <p className="text-sm text-gray-600">{quiz.attempts.length} attempts</p>
                </div>
                <div className="flex items-center space-x-2 flex-wrap gap-2">
                  <button
                    onClick={() => handleToggleDetails(quiz.id, quiz.show_detailed_results)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      quiz.show_detailed_results
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {quiz.show_detailed_results ? 'Details ON' : 'Details OFF'}
                  </button>
                  <button
                    onClick={() => onToggleStatus(quiz.id, quiz.is_public)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      quiz.is_public
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {quiz.is_public ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}/quiz/shared/${quiz.id}`;
                      navigator.clipboard.writeText(link);
                      alert('Link copied!');
                    }}
                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                    title="Copy share link"
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    onClick={() => onDeleteQuiz(quiz.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Delete quiz"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div className="sidebar-card p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`w-12 h-12 bg-${color}-100 rounded-lg flex items-center justify-center`}>
        <Icon className={`text-${color}-600`} size={24} />
      </div>
    </div>
  </div>
);

const HistoryTab: React.FC<{
  quizzes: FormattedQuiz[];
  onGradeAttempt: (attemptId: string, quizId: string, studentName: string) => void;
}> = ({ quizzes, onGradeAttempt }) => {
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const viewAttemptDetails = async (attemptId: string) => {
    setLoadingDetail(true);
    try {
      const data = await getStudentAttemptWithQuizDetails(attemptId);
      if (data) {
        setSelectedAttempt(data);
        setModalOpen(true);
      } else {
        alert('Failed to load attempt details.');
      }
    } catch (error) {
      console.error('Error fetching attempt details:', error);
      alert('Error loading details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  if (quizzes.length === 0) {
    return (
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Quiz History</h2>
        <div className="sidebar-card p-12 text-center">
          <History className="mx-auto text-gray-400 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Quizzes Found</h3>
          <p className="text-gray-600">Create your first quiz to see results here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Quiz History</h2>
      <div className="space-y-8">
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="sidebar-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{quiz.title}</h3>
                <p className="text-sm text-gray-500">
                  Created: {new Date(quiz.created_at).toLocaleDateString()} •
                  {quiz.attempts.length} attempts
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                quiz.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {quiz.is_public ? 'Active' : 'Inactive'}
              </span>
            </div>

            {quiz.attempts.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No student has attempted this quiz yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-600 font-medium">Student</th>
                      <th className="px-4 py-2 text-left text-gray-600 font-medium">Score</th>
                      <th className="px-4 py-2 text-left text-gray-600 font-medium">Percentage</th>
                      <th className="px-4 py-2 text-left text-gray-600 font-medium">Time Taken</th>
                      <th className="px-4 py-2 text-left text-gray-600 font-medium">Completed</th>
                      <th className="px-4 py-2 text-left text-gray-600 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quiz.attempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td className="px-4 py-3 text-gray-800">{attempt.studentName}</td>
                        <td className="px-4 py-3 text-gray-800">{attempt.score} / {attempt.totalQuestions}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${
                            attempt.totalQuestions > 0
                              ? (attempt.score / attempt.totalQuestions) >= 0.8 ? 'text-green-600'
                                : (attempt.score / attempt.totalQuestions) >= 0.6 ? 'text-yellow-600'
                                : 'text-red-600'
                              : 'text-gray-500'
                          }`}>
                            {attempt.totalQuestions > 0
                              ? ((attempt.score / attempt.totalQuestions) * 100).toFixed(1) + '%'
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{Math.round(attempt.timeTaken / 60)} min</td>
                        <td className="px-4 py-3 text-gray-500">
                          {attempt.completedAt.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => viewAttemptDetails(attempt.id)}
                              className="flex items-center space-x-1 text-purple-600 hover:text-purple-800 transition-colors"
                            >
                              <Eye size={16} />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => onGradeAttempt(attempt.id, quiz.id, attempt.studentName)}
                              className="flex items-center space-x-1 text-green-600 hover:text-green-800 transition-colors"
                            >
                              <span>Grade</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal Detail */}
      {modalOpen && selectedAttempt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {selectedAttempt.quiz.title} – Details
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Score: {selectedAttempt.attempt.score}/{selectedAttempt.attempt.total_points}
            </p>

            {selectedAttempt.show_detailed_results ? (
              <div className="space-y-6">
                {selectedAttempt.quiz.questions.map((q: any, idx: number) => {
                  if (q.question_type === 'essay') {
                    return (
                      <div key={idx} className="border rounded-lg p-4">
                        <p className="font-medium text-gray-900">{idx+1}. {q.question_text}</p>
                        <div className="mt-2 p-3 bg-gray-50 rounded">
                          <p className="text-sm text-gray-600">Essay Answer:</p>
                          <p className="mt-1 whitespace-pre-wrap">
                            {selectedAttempt.attempt.essay_answers?.[idx] || 'No answer provided'}
                          </p>
                        </div>
                        <p className="text-sm mt-2">
                          Score: {selectedAttempt.attempt.question_scores?.[idx] || 0} / {q.points || 10}
                        </p>
                      </div>
                    );
                  } else {
                    // multiple choice (jika ada)
                    const userAnswer = selectedAttempt.attempt.answers[idx];
                    const isCorrect = userAnswer === q.correct;
                    return (
                      <div key={idx} className="border rounded-lg p-4">
                        <p className="font-medium text-gray-900">{idx+1}. {q.question_text}</p>
                        <div className="mt-2 space-y-1">
                          {q.options.map((opt: string, optIdx: number) => {
                            let className = 'px-3 py-1 rounded text-sm ';
                            if (optIdx === q.correct) className += 'bg-green-100 text-green-800';
                            else if (optIdx === userAnswer && !isCorrect) className += 'bg-red-100 text-red-800';
                            else className += 'bg-gray-50 text-gray-700';
                            return (
                              <div key={optIdx} className={className}>
                                {opt} {optIdx === q.correct && '✓'} {optIdx === userAnswer && userAnswer !== q.correct && '✗'}
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-sm mt-2">
                          Your answer: {userAnswer !== undefined ? q.options[userAnswer] || 'Not answered' : 'Not answered'}
                          {isCorrect ? ' ✅' : ' ❌'}
                        </p>
                      </div>
                    );
                  }
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Detailed results are not available for this quiz.</p>
                <p className="text-sm">The teacher has disabled detailed result viewing.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Create Quiz Form – HANYA ESSAY
const CreateQuizForm: React.FC<{
  onSubmit: (quiz: any) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState<number>(15);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>({
    question: '',
    type: 'essay',
    points: 10,
    imageUrl: '',
  });

  const addQuestion = () => {
    if (currentQuestion.question.trim()) {
      setQuestions([...questions, {
        id: Date.now(),
        question: currentQuestion.question,
        type: 'essay',
        points: currentQuestion.points || 10,
        imageUrl: currentQuestion.imageUrl || '',
      }]);
      setCurrentQuestion({
        question: '',
        type: 'essay',
        points: 10,
        imageUrl: '',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title && description && questions.length > 0) {
      onSubmit({
        title,
        description,
        timeLimit,
        questions,
        isActive: true,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Create New Quiz (Essay Only)</h2>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="sidebar-card p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Quiz Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Limit (minutes)</label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                min="1"
              />
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              required
            />
          </div>
        </div>

        <div className="sidebar-card p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Add Essay Question</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
              <input
                type="text"
                value={currentQuestion.question}
                onChange={(e) => setCurrentQuestion({...currentQuestion, question: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                placeholder="Enter your essay question"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
              <input
                type="number"
                value={currentQuestion.points || 10}
                onChange={(e) => setCurrentQuestion({...currentQuestion, points: parseInt(e.target.value) || 10})}
                className="w-32 px-4 py-3 rounded-xl border border-gray-200"
                min="1"
                max="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setCurrentQuestion({...currentQuestion, imageUrl: event.target?.result as string});
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200"
              />
              {currentQuestion.imageUrl && (
                <div className="mt-2">
                  <img src={currentQuestion.imageUrl} alt="Preview" className="max-w-xs h-32 object-cover rounded-lg" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={addQuestion}
              className="quiz-button-3d"
            >
              Add Essay Question
            </button>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="sidebar-card p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Essay Questions ({questions.length})</h3>
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">{idx + 1}. {q.question}</h4>
                  <p className="text-sm text-gray-500">Points: {q.points || 10}</p>
                  {q.imageUrl && (
                    <img src={q.imageUrl} alt="Question" className="max-w-xs h-24 object-cover rounded-lg mt-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={!title || !description || questions.length === 0}
            className="quiz-button-3d disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Quiz
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeacherDashboard;