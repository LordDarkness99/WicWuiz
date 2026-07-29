// src/pages/StudentDashboard.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { BookOpen, Share2, ExternalLink, History, Target, Eye, X } from 'lucide-react';
import { getUserQuizAttempts, getStudentAttemptWithQuizDetails } from '../lib/quizStorage';

// Tipe data untuk tampilan (dengan tambahan flag show_detailed_results)
interface StudentQuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
  timeSpent: number;
  percentage: number;
  showDetailedResults: boolean; // dari quiz
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const [quizAttempts, setQuizAttempts] = useState<StudentQuizAttempt[]>([]);
  const [quizLink, setQuizLink] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // State untuk modal detail
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Ambil data dari Supabase saat user berubah atau tab aktif
  useEffect(() => {
    if (!user) return;

    const fetchAttempts = async () => {
      setLoading(true);
      try {
        const rawAttempts = await getUserQuizAttempts(user.id);
        // Map data dari database ke format StudentQuizAttempt
        const formatted: StudentQuizAttempt[] = rawAttempts.map((item: any) => ({
          id: item.id,
          quizId: item.quiz_id,
          quizTitle: item.quiz?.title || 'Untitled Quiz',
          score: item.score || 0,
          totalQuestions: item.total_points || 0,
          completedAt: new Date(item.completed_at),
          timeSpent: item.time_taken || 0,
          percentage: item.total_points > 0 ? (item.score / item.total_points) * 100 : 0,
          showDetailedResults: item.quiz?.show_detailed_results || false,
        }));
        setQuizAttempts(formatted);
      } catch (error) {
        console.error('Error fetching quiz attempts:', error);
        setQuizAttempts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, [user, activeTab]);

  // Validasi role: hanya student yang boleh akses
  if (!user || user.role !== 'student') {
    return <Navigate to="/auth" replace />;
  }

  // Fungsi join quiz
  const joinQuiz = () => {
    if (quizLink.trim()) {
      const usedLinks = JSON.parse(localStorage.getItem(`used_links_${user.id}`) || '[]');
      if (usedLinks.includes(quizLink)) {
        alert('You have already used this quiz link!');
        return;
      }

      try {
        let quizId = '';
        if (quizLink.startsWith('http')) {
          const url = new URL(quizLink);
          const pathParts = url.pathname.split('/');
          quizId = pathParts[pathParts.length - 1];
        } else if (quizLink.includes('/quiz/shared/')) {
          const pathParts = quizLink.split('/');
          quizId = pathParts[pathParts.length - 1];
        } else {
          quizId = quizLink.trim();
        }

        if (quizId && quizId !== 'shared') {
          const updatedUsedLinks = [...usedLinks, quizLink];
          localStorage.setItem(`used_links_${user.id}`, JSON.stringify(updatedUsedLinks));
          const targetUrl = `${window.location.origin}/quiz/shared/${quizId}`;
          window.location.href = targetUrl;
        } else {
          alert('Invalid quiz link format. Please check the link and try again.');
        }
      } catch (error) {
        console.error('Error parsing quiz link:', error);
        alert('Invalid quiz link. Please check the format and try again.');
      }
    }
  };

  const shareResult = (attempt: StudentQuizAttempt) => {
    const shareText = `I scored ${attempt.score}/${attempt.totalQuestions} (${attempt.percentage.toFixed(1)}%) on "${attempt.quizTitle}" quiz!`;
    if (navigator.share) {
      navigator.share({
        title: 'Quiz Result',
        text: shareText,
        url: window.location.origin,
      });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Result copied to clipboard!');
    }
  };

  // Fungsi untuk membuka modal detail
  const openDetail = async (attemptId: string) => {
    setLoadingDetail(true);
    try {
      const data = await getStudentAttemptWithQuizDetails(attemptId);
      if (data) {
        setSelectedAttemptDetail(data);
        setShowDetailModal(true);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-xl h-screen sticky top-0">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <BookOpen className="text-white" size={20} />
              </div>
              <div>
                <h1 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Student Portal
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{user.name}</p>
              </div>
            </div>

            <nav className="space-y-2">
              {[
                { id: 'overview', label: 'Overview', icon: Target },
                { id: 'join', label: 'Join Quiz', icon: ExternalLink },
                { id: 'history', label: 'Quiz History', icon: History },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shadow-lg'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-300'
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
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
                Dashboard Overview
              </h2>

              {/* Recent Quiz Attempts */}
              <div className="sidebar-card p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Quiz Attempts
                </h3>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : quizAttempts.length > 0 ? (
                  <div className="space-y-4">
                    {quizAttempts.slice(0, 5).map((attempt) => (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {attempt.quizTitle}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {new Date(attempt.completedAt).toLocaleDateString()} •{' '}
                            {Math.round(attempt.timeSpent / 60)} minutes
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {attempt.score}/{attempt.totalQuestions}
                            </p>
                            <p
                              className={`text-sm font-medium ${
                                attempt.percentage >= 80
                                  ? 'text-green-600'
                                  : attempt.percentage >= 60
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {attempt.percentage.toFixed(1)}%
                            </p>
                          </div>
                          <button
                            onClick={() => shareResult(attempt)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Share result"
                          >
                            <Share2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-600 dark:text-gray-300">
                      No quiz attempts yet. Join your first quiz!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'join' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
                Join Quiz
              </h2>

              <div className="sidebar-card p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ExternalLink className="text-white" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Enter Quiz Link
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Paste the quiz link provided by your teacher
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quiz Link
                    </label>
                    <input
                      type="url"
                      value={quizLink}
                      onChange={(e) => setQuizLink(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                      placeholder="https://yourapp.com/quiz/shared/123 or just the quiz ID"
                    />
                  </div>

                  <button
                    onClick={joinQuiz}
                    disabled={!quizLink.trim()}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    Join Quiz
                  </button>
                </div>

                <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                    Important Notes:
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Each quiz link can only be used once per student</li>
                    <li>• You can paste the full URL or just the quiz ID</li>
                    <li>• Make sure you have a stable internet connection</li>
                    <li>• Complete the quiz within the time limit if specified</li>
                    <li>• Your progress will be saved automatically</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
                Quiz History
              </h2>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : quizAttempts.length > 0 ? (
                <div className="grid gap-6">
                  {quizAttempts.map((attempt) => (
                    <div key={attempt.id} className="sidebar-card p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {attempt.quizTitle}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300 mt-1">
                            Completed on{' '}
                            {new Date(attempt.completedAt).toLocaleDateString()} at{' '}
                            {new Date(attempt.completedAt).toLocaleTimeString()}
                          </p>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => shareResult(attempt)}
                            className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Share2 size={16} />
                            <span>Share</span>
                          </button>

                          {/* Tombol View Details hanya jika showDetailedResults true */}
                          {attempt.showDetailedResults && (
                            <button
                              onClick={() => openDetail(attempt.id)}
                              className="flex items-center space-x-2 px-4 py-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                            >
                              <Eye size={16} />
                              <span>View Details</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {attempt.score}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Correct Answers
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {attempt.totalQuestions}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Total Questions
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p
                            className={`text-2xl font-bold ${
                              attempt.percentage >= 80
                                ? 'text-green-600'
                                : attempt.percentage >= 60
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {attempt.percentage.toFixed(1)}%
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Percentage
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {Math.round(attempt.timeSpent / 60)}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            Minutes
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              attempt.percentage >= 80
                                ? 'bg-green-500'
                                : attempt.percentage >= 60
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${attempt.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sidebar-card p-12 text-center">
                  <History className="mx-auto text-gray-400 mb-4" size={64} />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No Quiz History
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    You haven't taken any quizzes yet. Join your first quiz to get started!
                  </p>
                  <button
                    onClick={() => setActiveTab('join')}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    Join a Quiz
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail */}
      {showDetailModal && selectedAttemptDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {selectedAttemptDetail.quiz.title} – Detailed Results
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Score: {selectedAttemptDetail.attempt.score} / {selectedAttemptDetail.attempt.total_points}
            </p>

            {selectedAttemptDetail.show_detailed_results ? (
              <div className="space-y-6">
                {selectedAttemptDetail.quiz.questions.map((q: any, idx: number) => {
                  const studentAnswer = selectedAttemptDetail.attempt.answers[idx];
                  const isCorrect = studentAnswer === q.correct;
                  return (
                    <div key={idx} className="border dark:border-gray-700 rounded-lg p-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {idx + 1}. {q.question}
                      </p>
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt: string, optIdx: number) => {
                          let className = 'px-3 py-1 rounded text-sm ';
                          if (optIdx === q.correct) className += 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
                          else if (optIdx === studentAnswer && !isCorrect) className += 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
                          else className += 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
                          return (
                            <div key={optIdx} className={className}>
                              {opt} {optIdx === q.correct && ' ✓'} {optIdx === studentAnswer && studentAnswer !== q.correct && ' ✗'}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-sm mt-2 text-gray-700 dark:text-gray-300">
                        Your answer: {studentAnswer !== undefined ? q.options[studentAnswer] || 'Not answered' : 'Not answered'}
                        {isCorrect ? ' ✅' : ' ❌'}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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

export default StudentDashboard;