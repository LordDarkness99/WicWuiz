// src/lib/quizStorage.ts
import { supabase } from '@/integrations/supabase/client';

export interface Question {
  id?: number | string;
  question: string;
  type: 'multiple_choice' | 'essay';
  options?: string[];
  correct?: number;
  points?: number;
  imageUrl?: string;
  order_index?: number;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  time_limit: number;
  is_public: boolean;
  teacher_id: string;
  created_at: string;
  updated_at: string;
  show_detailed_results?: boolean;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  answers: any[];
  essay_answers: any;
  score: number;
  total_points: number;
  question_scores: any;
  time_taken: number;
  completed_at: string;
  started_at: string;
}

// Create quiz with questions
export const createQuizInDB = async (
  quizData: {
    title: string;
    description: string;
    timeLimit: number;
    questions: Question[];
    isActive?: boolean;
  },
  userId: string
): Promise<string | null> => {
  try {
    // Insert quiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        title: quizData.title,
        description: quizData.description,
        time_limit: quizData.timeLimit * 60,
        is_public: quizData.isActive ?? true,
        teacher_id: userId,
        show_detailed_results: false,
      })
      .select()
      .single();

    if (quizError) throw quizError;
    if (!quiz) return null;

    // Prepare questions
    const questionsToInsert = quizData.questions.map((q, index) => {
      const baseQuestion = {
        quiz_id: quiz.id,
        question_text: q.question,
        order_index: index,
        points: q.points || 1,
        created_at: new Date().toISOString(),
        question_type: q.type === 'essay' ? 'essay' : 'multiple_choice',
        essay_question: q.type === 'essay',
        image_url: q.imageUrl || null,
      };

      if (q.type === 'essay') {
        return {
          ...baseQuestion,
          correct_answer: '',
          options: null,
        };
      } else {
        const options = q.options || [];
        const correctAnswer = q.correct !== undefined ? String(q.correct) : '0';
        return {
          ...baseQuestion,
          correct_answer: correctAnswer,
          options: JSON.stringify(options),
        };
      }
    });

    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsToInsert);

    if (questionsError) {
      console.error('Error inserting questions:', questionsError);
      await supabase.from('quizzes').delete().eq('id', quiz.id);
      return null;
    }

    return quiz.id;
  } catch (error) {
    console.error('Error creating quiz:', error);
    return null;
  }
};

// Get quiz with questions
export const getQuizWithQuestions = async (quizId: string) => {
  try {
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;

    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index');

    if (questionsError) throw questionsError;

    const questions = questionsData.map((q) => {
      if (q.question_type === 'essay' || q.essay_question) {
        return {
          id: q.id,
          question: q.question_text,
          type: 'essay' as const,
          points: q.points || 1,
          imageUrl: q.image_url || undefined,
        };
      } else {
        let options = [];
        try {
          options = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
        } catch (e) {
          options = [];
        }
        return {
          id: q.id,
          question: q.question_text,
          type: 'multiple_choice' as const,
          options: options,
          correct: parseInt(q.correct_answer, 10) || 0,
          points: q.points || 1,
          imageUrl: q.image_url || undefined,
        };
      }
    });

    return {
      ...quiz,
      questions,
    };
  } catch (error) {
    console.error('Error fetching quiz with questions:', error);
    return null;
  }
};

// Store quiz attempt (including essay answers)
export const storeQuizAttempt = async (
  quizId: string,
  userId: string,
  score: number,
  totalPoints: number,
  timeTaken: number,
  answers: any[],
  essayAnswers: any,
  questionScores?: any
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        student_id: userId,
        score: score,
        total_points: totalPoints,
        time_taken: timeTaken,
        answers: answers,
        essay_answers: essayAnswers,
        question_scores: questionScores || {},
        completed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error storing quiz attempt:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error storing quiz attempt:', error);
    return false;
  }
};

// Get user's quiz attempts with quiz details
export const getUserQuizAttempts = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        quiz:quizzes(id, title, show_detailed_results)
      `)
      .eq('student_id', userId)
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user quiz attempts:', error);
    return [];
  }
};

// Get teacher's quizzes with attempts (PERBAIKAN: ambil semua field penting)
export const getTeacherQuizzesWithAttempts = async (teacherId: string) => {
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select(`
        *,
        attempts:quiz_attempts(
          *,
          student:profiles(name, email)
        )
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching teacher quizzes:', error);
    return [];
  }
};

// Update quiz show_detailed_results flag
export const updateQuizShowDetails = async (quizId: string, show: boolean): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('quizzes')
      .update({ show_detailed_results: show })
      .eq('id', quizId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating quiz show details:', error);
    return false;
  }
};

// Get student attempt with quiz details including questions
export const getStudentAttemptWithQuizDetails = async (attemptId: string) => {
  try {
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('id', attemptId)
      .single();
    if (attemptError) throw attemptError;

    const quiz = await getQuizWithQuestions(attempt.quiz_id);
    if (!quiz) throw new Error('Quiz not found');

    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .select('show_detailed_results')
      .eq('id', attempt.quiz_id)
      .single();
    if (quizError) throw quizError;

    return {
      attempt,
      quiz,
      show_detailed_results: quizData?.show_detailed_results || false,
    };
  } catch (error) {
    console.error('Error fetching student attempt:', error);
    return null;
  }
};