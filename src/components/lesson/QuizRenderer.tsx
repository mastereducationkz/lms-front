import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/button';
import { ChevronRight, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { renderTextWithLatex } from '../../utils/latex';
import type { Step } from '../../types';
import { useNavigate } from 'react-router-dom';
import { LongTextQuestion } from './quiz/LongTextQuestion';
import { ShortAnswerQuestion } from './quiz/ShortAnswerQuestion';
import { ChoiceQuestion } from './quiz/ChoiceQuestion';
import { TextCompletionQuestion } from './quiz/TextCompletionQuestion';
import { FillInBlankQuestion } from './quiz/FillInBlankQuestion';
import { MatchingQuestion } from './quiz/MatchingQuestion';
import { ZoomableImage } from './ZoomableImage';
import { AudioPlayer } from './quiz/AudioPlayer';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import apiClient from '../../services/api';
import api from '../../services/api';

// Exam mode badge component
const ExamModeBadge = ({ maxPlays }: { maxPlays: number }) => (
  <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium mt-2">
    <span>🔒</span>
    <span>Exam mode · {maxPlays} plays allowed · No pause or rewind</span>
  </div>
);

// Helper to check if content text has visible content
const hasVisibleContent = (html: string | undefined | null): boolean => {
  if (!html) return false;
  // If it contains media tags, it has content
  if (html.match(/<(img|iframe|video|audio|object|embed)/i)) return true;
  
  // Otherwise strip tags and check for text
  const stripped = html.replace(/<[^>]*>/g, '');
  return stripped.replace(/&nbsp;/g, ' ').trim().length > 0;
};

// Define a more specific type for quiz questions if possible
type QuizQuestion = any;
type QuizData = any;

interface QuizRendererProps {
  quizState: 'title' | 'question' | 'result' | 'completed' | 'feed';
  quizData: QuizData;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  quizAnswers: Map<string, any>;
  gapAnswers: Map<string, string[]>;
  feedChecked: boolean;
  startQuiz: () => void;
  handleQuizAnswer: (questionId: string, answer: any) => void;
  setGapAnswers: React.Dispatch<React.SetStateAction<Map<string, string[]>>>;
  checkAnswer: () => void;
  nextQuestion: () => void;
  resetQuiz: () => void;
  getScore: () => { score: number; total: number; };
  getCurrentQuestion: () => QuizQuestion | null;
  getCurrentUserAnswer: () => any;
  goToNextStep: () => void;
  setQuizCompleted: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
  markStepAsVisited: (stepId: string, timeSpent?: number) => Promise<void>;
  currentStep: Step | undefined;
  saveQuizAttempt: (score: number, totalQuestions: number) => Promise<void>;
  setFeedChecked: React.Dispatch<React.SetStateAction<boolean>>;
  getGapStatistics: () => { totalGaps: number; correctGaps: number; regularQuestions: number; correctRegular: number; };
  setQuizAnswers: React.Dispatch<React.SetStateAction<Map<string, any>>>;
  steps: Step[];
  goToStep: (index: number) => void;
  currentStepIndex: number;
  nextLessonId: string | null;
  courseId: string | undefined;
  finishQuiz: () => void;
  reviewQuiz: () => void;
  autoFillCorrectAnswers: () => void;
  quizAttempt?: any;
  highlightedQuestionId?: string;
  isTeacher?: boolean;
}

const QuizRenderer = (props: QuizRendererProps) => {
  const {
    quizState,
    quizData,
    questions,
    currentQuestionIndex,
    quizAnswers,
    gapAnswers,
    feedChecked,
    startQuiz,
    handleQuizAnswer,
    setGapAnswers,
    checkAnswer,
    nextQuestion,
    resetQuiz,
    getCurrentQuestion,
    getCurrentUserAnswer,
    goToNextStep,
    setQuizCompleted,
    markStepAsVisited,
    currentStep,
    setFeedChecked,
    getGapStatistics,
    setQuizAnswers,
    finishQuiz,
    reviewQuiz,
    autoFillCorrectAnswers,
    quizAttempt,
    highlightedQuestionId,
    isTeacher
  } = props;

  const navigate = useNavigate();

  // Handle scrolling to highlighted question
  useEffect(() => {
    if (highlightedQuestionId && questions.length > 0 && (quizState === 'feed' || quizState === 'question')) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`question-${highlightedQuestionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'shadow-2xl', 'transition-all', 'duration-500', 'rounded-xl');
          
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'shadow-2xl');
          }, 5000);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [highlightedQuestionId, questions.length > 0, quizState]);
  
  // State for quiz attempts history (used on completed screen)
  const [attemptsHistory, setAttemptsHistory] = useState<any[]>([]);

  useEffect(() => {
    if (quizState === 'completed' && currentStep) {
      apiClient.getStepQuizAttempts(currentStep.id)
        .then((attempts) => {
          const completed = attempts
            .filter((a: any) => !a.is_draft && a.completed_at)
            .sort((a: any, b: any) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
          setAttemptsHistory(completed);
        })
        .catch(() => setAttemptsHistory([]));
    }
  }, [quizState, currentStep?.id]);

  // State for error reporting
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportQuestionId, setReportQuestionId] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState('');
  const [reportSuggestedAnswer, setReportSuggestedAnswer] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedQuestions, setReportedQuestions] = useState<Set<string>>(new Set());

  // Get the question being reported
  const getReportedQuestion = () => {
    if (!reportQuestionId) return null;
    return questions.find(q => q.id.toString() === reportQuestionId);
  };

  // Handle opening report modal
  const openReportModal = (questionId: string) => {
    setReportQuestionId(questionId);
    setReportMessage('');
    setReportSuggestedAnswer('');
    setReportModalOpen(true);
  };

  // Handle submitting error report
  const submitErrorReport = async () => {
    if (!reportQuestionId || !reportMessage.trim()) return;
    
    setReportSubmitting(true);
    try {
      await api.reportQuestionError(
        reportQuestionId,
        reportMessage.trim(),
        currentStep?.id,
        reportSuggestedAnswer.trim() || undefined
      );
      setReportedQuestions(prev => new Set(prev).add(reportQuestionId));
      setReportModalOpen(false);
      setReportMessage('');
      setReportSuggestedAnswer('');
    } catch (error) {
      console.error('Failed to submit error report:', error);
    } finally {
      setReportSubmitting(false);
    }
  };

  // Calculate total number of "questions" considering gaps in fill_blank and text_completion
  // Excludes image_content which is just visual content, not a question
  const getTotalQuestionCount = () => {
    if (!questions || questions.length === 0) return 0;

    return questions.reduce((total, q) => {
      // Skip image_content - it's not a question
      if (q.question_type === 'image_content') return total;
      
      if (q.question_type === 'fill_blank' || q.question_type === 'text_completion') {
        // Count the number of gaps in the question
        const text = q.content_text || q.question_text || '';
        const gaps = text.match(/\[\[(.*?)\]\]/g);
        return total + (gaps ? gaps.length : 1);
      }
      return total + 1;
    }, 0);
  };

  const totalQuestionCount = getTotalQuestionCount();

  // All render functions will be moved here from LessonPage.tsx
  // For now, this is a placeholder.
  // The actual implementation will be added in the next steps.

  // Get the display number for a question (accounting for gaps in previous questions)
  // Skips image_content questions as they don't have numbers
  const getQuestionDisplayNumber = (questionIndex: number) => {
    let displayNumber = 1;
    for (let i = 0; i < questionIndex; i++) {
      const q = questions[i];
      // Skip image_content in numbering
      if (q.question_type === 'image_content') continue;
      
      if (q.question_type === 'fill_blank' || q.question_type === 'text_completion') {
        const text = q.content_text || q.question_text || '';
        const gaps = text.match(/\[\[(.*?)\]\]/g);
        displayNumber += gaps ? gaps.length : 1;
      } else {
        displayNumber += 1;
      }
    }
    return displayNumber;
  };

  const renderQuizFeed = () => {
    if (!questions || questions.length === 0) return null;

    // Calculate pass status to control correct answer visibility
    const stats = getGapStatistics();
    const totalItems = stats.totalGaps + stats.regularQuestions;
    const correctItems = stats.correctGaps + stats.correctRegular;
    const scorePercentage = totalItems > 0 ? (correctItems / totalItems) * 100 : 0;
    const isPassed = scorePercentage >= 50;

    return (
      <div className="w-full md:max-w-3xl md:mx-auto space-y-4 md:space-y-6 md:p-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Practice</h2>
          <p className="text-gray-600 dark:text-gray-300">Answer all questions below to continue</p>

          {/* Development / Teacher Helper Button */}
          {(import.meta.env.DEV || isTeacher) && (
            <Button
              onClick={autoFillCorrectAnswers}
              className="mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2 mx-auto"
              title={isTeacher ? "Show Correct Answers" : "Development only: Auto-fill correct answers"}
            >
              {isTeacher ? "Show Correct Answers" : "Dev: Fill Answers"}
            </Button>
          )}
        </div>

        {/* Exam mode badge - shown outside audio player */}
        {quizData?.quiz_media_url && quizData.quiz_media_type === 'audio' && quizData.audio_playback_mode === 'strict' && (
          <ExamModeBadge maxPlays={quizData.audio_max_plays || 2} />
        )}

        {/* Quiz-level Media for Audio/PDF/Text Quizzes */}
        {quizData?.quiz_media_url && (
          <div className="bg-white dark:bg-card rounded-none md:rounded-lg">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700">
                <div dangerouslySetInnerHTML={{ __html: renderTextWithLatex(quizData.quiz_media_url) }} />
              </div>
            ) : quizData.quiz_media_type === 'pdf' ? (
              // Check if it's actually a PDF or an image
              quizData.quiz_media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <ZoomableImage
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}`}
                  alt="Reference material"
                />
              ) : (
                <div className="border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="w-full h-[800px] border dark:border-gray-700 rounded-lg">
                    <iframe
                      src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full"
                      title="Question PDF"
                    />
                  </div>
                </div>
              )
            ) : null}
          </div>
        )}

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((q, idx) => {
            const userAnswer = quizAnswers.get(q.id);
            const displayNumber = getQuestionDisplayNumber(idx);
            const questionGaps = (q.question_type === 'fill_blank' || q.question_type === 'text_completion')
              ? (q.content_text || q.question_text || '').match(/\[\[(.*?)\]\]/g)?.length || 1
              : 1;

            // Special rendering for image_content - just show the image, no question UI
            if (q.question_type === 'image_content') {
              return (
                <div key={q.id} id={`question-${q.id}`} className="bg-white dark:bg-gray-900/50 rounded-none md:rounded-xl border-t border-b md:border dark:border-gray-800/60">
                  <div className="p-2 md:p-6 flex flex-col items-center">
                    {q.media_url && (
                      <img
                        src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                        alt={q.question_text || "Reference image"}
                        className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg"
                      />
                    )}
                    {q.question_text && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 text-center">{q.question_text}</p>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={q.id} id={`question-${q.id}`} className="bg-white dark:bg-gray-900/50 rounded-none md:rounded-xl border-t border-b md:border dark:border-gray-800/60">
                <div className="p-2 md:p-6">
                  {/* Question Number Badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Question{questionGaps > 1 ? 's' : ''} {displayNumber}{questionGaps > 1 ? `-${displayNumber + questionGaps - 1}` : ''} of {totalQuestionCount}
                    </span>
                  </div>

                  {/* Media Attachment for Media Questions */}
                  {(q.question_type === 'media_question' || q.question_type === 'media_open_question') && q.media_url && (
                    <div className="mb-4">
                      {q.media_type === 'pdf' ? (
                        <iframe
                          src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                          className="w-full h-64 border dark:border-gray-700 rounded-lg"
                          title="Question PDF"
                        />
                      ) : (
                        <ZoomableImage
                          src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                          alt="Question media"
                        />
                      )}
                    </div>
                  )}

                  {/* Content Text */}
                  {hasVisibleContent(q.content_text) && q.question_type !== 'text_completion' && q.question_type !== 'fill_blank' && (
                    <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-lg mb-4 border-l-3 border-blue-400 dark:border-blue-500/30">
                      <div className="text-gray-700 dark:text-gray-200 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.content_text) }} />
                    </div>
                  )}

                  {/* Question */}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex((q.question_text || (q.question_type === 'text_completion' ? 'Fill in the blanks:' : '')).replace(/\[\[([^\]]+)\]\]/g, '[[blank]]')) }} />
                  </h3>

                  {/* Answer Input Based on Question Type */}
                  {q.question_type === 'long_text' ? (
                    <LongTextQuestion
                      question={q}
                      value={userAnswer}
                      onChange={(val) => setQuizAnswers(prev => new Map(prev.set(q.id.toString(), val)))}
                      disabled={feedChecked}
                    />
                  ) : (q.question_type === 'short_answer' || q.question_type === 'media_open_question') ? (
                    <ShortAnswerQuestion
                      question={q}
                      value={userAnswer}
                      onChange={(val) => setQuizAnswers(prev => new Map(prev.set(q.id.toString(), val)))}
                      disabled={feedChecked}
                      showResult={feedChecked}
                    />
                  ) : q.question_type === 'text_completion' ? (
                    <TextCompletionQuestion
                      question={q}
                      answers={gapAnswers.get(q.id.toString()) || []}
                      onAnswerChange={(idx, val) => {
                        const currentAnswers = gapAnswers.get(q.id.toString()) || [];
                        const newAnswers = [...currentAnswers];
                        newAnswers[idx] = val;
                        setGapAnswers(prev => new Map(prev.set(q.id.toString(), newAnswers)));
                      }}
                      disabled={feedChecked}
                      showResult={feedChecked}
                    />
                  ) : q.question_type === 'single_choice' || q.question_type === 'multiple_choice' || q.question_type === 'media_question' ? (
                    <ChoiceQuestion
                      question={q}
                      value={userAnswer}
                      onChange={(val) => setQuizAnswers(prev => new Map(prev.set(q.id.toString(), val)))}
                      disabled={feedChecked}
                      showResult={feedChecked}
                    />
                  ) : q.question_type === 'matching' ? (
                    <MatchingQuestion
                      question={q}
                      value={quizAnswers.get(q.id.toString())}
                      onChange={(val) => setQuizAnswers(prev => new Map(prev.set(q.id.toString(), val)))}
                      disabled={feedChecked}
                      showResult={feedChecked}
                    />
                  ) : (
                    <FillInBlankQuestion
                      question={q}
                      answers={gapAnswers.get(q.id.toString()) || []}
                      onAnswerChange={(idx, val) => {
                        const currentAnswers = gapAnswers.get(q.id.toString()) || [];
                        const newAnswers = [...currentAnswers];
                        newAnswers[idx] = val;
                        setGapAnswers(prev => new Map(prev.set(q.id.toString(), newAnswers)));
                      }}
                      disabled={feedChecked}
                      showResult={feedChecked}
                    />
                  )}

                  {/* Result Indicator - Explanation only (removed buggy isCorrect labels) */}
                  {feedChecked && q.explanation && (
                    <div className="mt-4 space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-1">Explanation:</p>
                        <div className="text-blue-700 dark:text-blue-400 text-sm prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.explanation) }} />
                      </div>
                    </div>
                  )}

                  {/* Report Error Button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => openReportModal(q.id.toString())}
                      disabled={reportedQuestions.has(q.id.toString())}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        reportedQuestions.has(q.id.toString())
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-700 dark:hover:text-orange-400'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {reportedQuestions.has(q.id.toString()) ? 'Reported' : 'Report an Error'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Report Modal */}
        {reportModalOpen && createPortal(
          <>
            {/* Backdrop - covers entire screen */}
            <div 
              className="fixed inset-0 z-[9998] bg-black/50"
              onClick={() => {
                setReportModalOpen(false);
                setReportMessage('');
                setReportSuggestedAnswer('');
              }}
            />
            {/* Modal content */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
              <div className="relative bg-white dark:bg-card rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto pointer-events-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Report an Error</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Found a mistake in this question? Please describe the error and suggest the correct answer.
                </p>
                
                {/* Error description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    What's wrong? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    placeholder="Describe the error (e.g., the marked answer is incorrect, there's a typo, the question is unclear)..."
                    className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>
                
                {/* Suggested correct answer */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    What should be the correct answer?
                  </label>
                  {(() => {
                    const reportedQ = getReportedQuestion();
                    if (!reportedQ) return null;
                    
                    // For choice questions, show options to select
                    if (reportedQ.question_type === 'single_choice' || reportedQ.question_type === 'media_question') {
                      return (
                        <div className="space-y-2">
                          {(reportedQ.options || []).map((opt: any, idx: number) => (
                            <label 
                              key={idx} 
                              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                                reportSuggestedAnswer === (opt.text || opt) 
                                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <input
                                type="radio"
                                name="suggestedAnswer"
                                value={opt.text || opt}
                                checked={reportSuggestedAnswer === (opt.text || opt)}
                                onChange={(e) => setReportSuggestedAnswer(e.target.value)}
                                className="w-4 h-4 text-orange-600 dark:text-orange-400 focus:ring-orange-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(opt.text || opt) }} />
                            </label>
                          ))}
                        </div>
                      );
                    }
                    
                    // For multiple choice, show checkboxes
                    if (reportedQ.question_type === 'multiple_choice') {
                      const selectedAnswers = reportSuggestedAnswer ? reportSuggestedAnswer.split('|') : [];
                      return (
                        <div className="space-y-2">
                          {(reportedQ.options || []).map((opt: any, idx: number) => {
                            const optText = opt.text || opt;
                            const isSelected = selectedAnswers.includes(optText);
                            return (
                              <label 
                                key={idx} 
                                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                                  isSelected 
                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setReportSuggestedAnswer([...selectedAnswers, optText].join('|'));
                                    } else {
                                      setReportSuggestedAnswer(selectedAnswers.filter(a => a !== optText).join('|'));
                                    }
                                  }}
                                  className="w-4 h-4 text-orange-600 dark:text-orange-400 focus:ring-orange-500 rounded"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(optText) }} />
                              </label>
                            );
                          })}
                        </div>
                      );
                    }
                    
                    // For text-based questions, show text input
                    return (
                      <input
                        type="text"
                        value={reportSuggestedAnswer}
                        onChange={(e) => setReportSuggestedAnswer(e.target.value)}
                        placeholder="Enter the correct answer..."
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-200"
                      />
                    );
                  })()}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional but helpful for review</p>
                </div>
                
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setReportModalOpen(false);
                      setReportMessage('');
                      setReportSuggestedAnswer('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitErrorReport}
                    disabled={!reportMessage.trim() || reportSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Action Buttons */}
        <div className="flex justify-center pt-4">
          {!feedChecked ? (
            <Button
              onClick={() => {
                setFeedChecked(true);
                finishQuiz();
              }}
              disabled={questions.some(q => {
                // Skip image_content - no answer required
                if (q.question_type === 'image_content') return false;
                
                const ans = quizAnswers.get(q.id);
                if (q.question_type === 'fill_blank') {
                  const gapAns = gapAnswers.get(q.id.toString()) || [];
                  return gapAns.length === 0 || gapAns.some(v => (v || '').toString().trim() === '');
                }
                if (q.question_type === 'text_completion') {
                  const gapAns = gapAnswers.get(q.id.toString()) || [];
                  return gapAns.length === 0 || gapAns.some(v => (v || '').toString().trim() === '');
                }
                if (q.question_type === 'short_answer' || q.question_type === 'long_text') {
                  return !ans || (ans || '').toString().trim() === '';
                }
                return ans === undefined;
              })}
              className={`px-8 py-3 rounded-lg text-lg font-semibold transition-all duration-200 ${questions.some(q => {
                // Skip image_content - no answer required
                if (q.question_type === 'image_content') return false;
                
                const ans = quizAnswers.get(q.id);
                if (q.question_type === 'fill_blank') {
                  const gapAns = gapAnswers.get(q.id.toString()) || [];
                  return gapAns.length === 0 || gapAns.some(v => (v || '').toString().trim() === '');
                }
                if (q.question_type === 'text_completion') {
                  const gapAns = gapAnswers.get(q.id.toString()) || [];
                  return gapAns.length === 0 || gapAns.some(v => (v || '').toString().trim() === '');
                }
                if (q.question_type === 'short_answer' || q.question_type === 'long_text') {
                  return !ans || (ans || '').toString().trim() === '';
                }
                return ans === undefined;
              })
                ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white transition-all"
              }`}
            >
              Check All Answers
            </Button>
          ) : (() => {
            const stats = getGapStatistics();
            const totalItems = stats.totalGaps + stats.regularQuestions;
            const correctItems = stats.correctGaps + stats.correctRegular;
            const scorePercentage = totalItems > 0 ? (correctItems / totalItems) * 100 : 0;
            const isPassed = scorePercentage >= 50;

            return (
              <div className="flex flex-col items-center space-y-4">
                {!isPassed && (
                  <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg mb-4">
                    <p className="text-red-900 dark:text-red-400 font-semibold text-center">
                      Score: {Math.round(scorePercentage)}% (minimum 50% required to continue)
                    </p>
                    <p className="text-red-800 dark:text-red-400 text-sm mt-2 text-center">
                      Please try again to improve your score
                    </p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => {
                      if (isPassed) {
                        // Mark quiz as completed and step as completed before going to next step
                        if (currentStep) {
                          setQuizCompleted(prev => new Map(prev.set(currentStep.id.toString(), true)));
                          markStepAsVisited(currentStep.id.toString(), 4); // 4 minutes for quiz completion
                        }
                        goToNextStep();
                      } else {
                        // Reset quiz to retry
                        resetQuiz();
                        setFeedChecked(false);
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white transition-all text-lg font-semibold items-center content-center px-10"
                  >
                    {isPassed ? 'Continue to Next Step' : 'Retry Quiz'}
                  </Button>

                  {(!isPassed && (import.meta.env.DEV || isTeacher)) && (
                    <Button
                      onClick={() => setShowAllAnswers(true)}
                      variant="outline"
                      className="border-green-600 dark:border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 text-lg font-semibold"
                    >
                      Show Correct Answers
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderQuizTitleScreen = () => {
    // Show beautiful Duolingo-style screen for all modes
    return (
      <div className="min-h-[500px] relative flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 -mx-4 -my-4 p-8 rounded-lg overflow-hidden">
        {/* Logo in bottom-left corner */}
        <div className="absolute bottom-0 left-0 pointer-events-none z-0">
          <img
            src="/logo-half.svg"
            alt="Logo"
            className="w-64 h-64 md:w-80 md:h-80 brightness-0 invert"
          />
        </div>

        {/* Logo in bottom-right corner */}
        <div className="absolute bottom-0 right-0 pointer-events-none z-0">
          <img
            src="/logo-half.svg"
            alt="Logo"
            className="w-64 h-64 md:w-80 md:h-80 brightness-0 invert scale-x-[-1]"
          />
        </div>

        {/* Logo at top center - showing only bottom half */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
          <img
            src="/logo.svg"
            alt="Logo"
            className="w-80 h-80 md:w-96 md:h-96 brightness-0 invert"
          />
        </div>

        <div className="text-center space-y-6 max-w-2xl relative z-10">
          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">
              {quizData?.title || 'Quiz incoming!'}
            </h1>
            <p className="text-[15px] md:text-[18px] text-blue-100 font-light">
              it's your time to shine
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={startQuiz}
              className="px-10 py-4 bg-white dark:bg-gray-200 text-blue-900 text-lg font-bold hover:bg-blue-50 dark:hover:bg-gray-300 relative z-20"
            >
              Start Practice
            </Button>

            <div className="inline-flex items-center justify-center gap-2 text-white text-base md:text-lg">
              <span className="font-medium">{totalQuestionCount} question{totalQuestionCount !== 1 ? 's' : ''}</span>
            </div>
            {(import.meta.env.DEV || isTeacher) && (
              <Button
                onClick={autoFillCorrectAnswers}
                variant="ghost"
                className="text-white hover:bg-white/10 mt-2 flex items-center gap-2"
                title={isTeacher ? "Show Correct Answers" : "Development only: Auto-fill correct answers"}
              >
                {isTeacher ? <HelpCircle className="w-4 h-4" /> : "🔧"} 
                {isTeacher ? "Show Correct Answers" : "Dev: Fill Answers"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderQuizQuestion = () => {
    if (!questions || questions.length === 0) return null;
    const q = questions[currentQuestionIndex];
    if (!q) return null;

    // Special rendering for image_content - just show the image, auto-advance
    if (q.question_type === 'image_content') {
      return (
        <div className="w-full md:max-w-3xl md:mx-auto space-y-4 md:space-y-6 md:p-4">
          <div className="bg-white dark:bg-gray-900/50 rounded-none md:rounded-xl border-t border-b md:border dark:border-gray-800/60">
            <div className="p-2 md:p-6 flex flex-col items-center">
              {q.media_url && (
                <img
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                  alt={q.question_text || "Reference image"}
                  className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg"
                />
              )}
              {q.question_text && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-4 text-center">{q.question_text}</p>
              )}
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex justify-center">
            <Button
              onClick={nextQuestion}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-lg font-semibold transition-all duration-200"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    const userAnswer = quizAnswers.get(q.id);
    const displayNumber = getQuestionDisplayNumber(currentQuestionIndex);
    const questionGaps = (q.question_type === 'fill_blank' || q.question_type === 'text_completion')
      ? (q.content_text || q.question_text || '').match(/\[\[(.*?)\]\]/g)?.length || 1
      : 1;

    return (
      <div className="w-full md:max-w-3xl md:mx-auto space-y-4 md:space-y-6 md:p-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quiz Question</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Question{questionGaps > 1 ? 's' : ''} {displayNumber}{questionGaps > 1 ? `-${displayNumber + questionGaps - 1}` : ''} of {totalQuestionCount}
          </p>
          {(import.meta.env.DEV || isTeacher) && (
            <Button
              onClick={autoFillCorrectAnswers}
              variant="outline"
              size="sm"
              className="mt-2 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 mx-auto"
              title={isTeacher ? "Show Correct Answers" : "Development only: Auto-fill correct answers"}
            >
              {isTeacher ? <HelpCircle className="w-3 h-3" /> : "🔧"} 
              {isTeacher ? "Show Correct Answers" : "Dev: Fill Answers"}
            </Button>
          )}
        </div>

        {/* Exam mode badge - shown outside audio player */}
        {quizData?.quiz_media_url && quizData.quiz_media_type === 'audio' && quizData.audio_playback_mode === 'strict' && (
          <ExamModeBadge maxPlays={quizData.audio_max_plays || 2} />
        )}

        {/* Quiz-level Media for Audio/PDF/Text Quizzes */}
        {quizData?.quiz_media_url && (
          <div className="bg-white dark:bg-card rounded-none md:rounded-lg">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700">
                <div dangerouslySetInnerHTML={{ __html: renderTextWithLatex(quizData.quiz_media_url) }} />
              </div>
            ) : quizData.quiz_media_type === 'pdf' ? (
              // Check if it's actually a PDF or an image
              quizData.quiz_media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <ZoomableImage
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}`}
                  alt="Reference material"
                />
              ) : (
                <div className="border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="w-full h-[800px] border dark:border-gray-700 rounded-lg">
                    <iframe
                      src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full"
                      title="Question PDF"
                    />
                  </div>
                </div>
              )
            ) : null}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900/50 rounded-none md:rounded-xl border-t border-b md:border dark:border-gray-800/60">
          <div className="p-2 md:p-6">
            {/* Media Attachment for Media Questions */}
            {(q.question_type === 'media_question' || q.question_type === 'media_open_question') && q.media_url && (
              <div className="mb-4">
                {q.media_type === 'pdf' ? (
                  <iframe
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-64 border dark:border-gray-700 rounded-lg"
                    title="Question PDF"
                  />
                ) : (
                  <ZoomableImage
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                    alt="Question media"
                  />
                )}
              </div>
            )}

            {/* Content Text */}
            {hasVisibleContent(q.content_text) && q.question_type !== 'text_completion' && q.question_type !== 'fill_blank' && (
              <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-lg mb-4 border-l-3 border-blue-400 dark:border-blue-500/30">
                <div className="text-gray-700 dark:text-gray-200 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.content_text) }} />
              </div>
            )}

            {/* Question */}
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex((q.question_text || (q.question_type === 'text_completion' ? 'Fill in the blanks:' : '')).replace(/\[\[([^\]]+)\]\]/g, '[[blank]]')) }} />
            </h3>

            {/* Answer Input Based on Question Type */}
            {q.question_type === 'long_text' ? (
              <LongTextQuestion
                question={q}
                value={userAnswer}
                onChange={(val) => handleQuizAnswer(q.id.toString(), val)}
                disabled={false}
              />
            ) : (q.question_type === 'short_answer' || q.question_type === 'media_open_question') ? (
              <ShortAnswerQuestion
                question={q}
                value={userAnswer}
                onChange={(val) => handleQuizAnswer(q.id.toString(), val)}
                disabled={false}
                showResult={false}
              />
            ) : q.question_type === 'text_completion' ? (
              <TextCompletionQuestion
                question={q}
                answers={gapAnswers.get(q.id.toString()) || []}
                onAnswerChange={(idx, val) => {
                  const currentAnswers = gapAnswers.get(q.id.toString()) || [];
                  const newAnswers = [...currentAnswers];
                  newAnswers[idx] = val;
                  setGapAnswers(prev => new Map(prev.set(q.id.toString(), newAnswers)));
                }}
                disabled={false}
                showResult={false}
              />
            ) : q.question_type === 'single_choice' || q.question_type === 'multiple_choice' || q.question_type === 'media_question' ? (
              <ChoiceQuestion
                question={q}
                value={userAnswer}
                onChange={(val) => handleQuizAnswer(q.id.toString(), val)}
                disabled={false}
                showResult={false}
              />
            ) : q.question_type === 'matching' ? (
              <MatchingQuestion
                question={q}
                value={quizAnswers.get(q.id.toString())}
                onChange={(val) => handleQuizAnswer(q.id.toString(), val)}
                disabled={false}
                showResult={false}
              />
            ) : (
              <FillInBlankQuestion
                question={q}
                answers={gapAnswers.get(q.id.toString()) || []}
                onAnswerChange={(idx, val) => {
                  const currentAnswers = gapAnswers.get(q.id.toString()) || [];
                  const newAnswers = [...currentAnswers];
                  newAnswers[idx] = val;
                  setGapAnswers(prev => new Map(prev.set(q.id.toString(), newAnswers)));
                }}
                disabled={false}
                showResult={false}
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={checkAnswer}
            disabled={(() => {
              const ans = quizAnswers.get(q.id);
              if (q.question_type === 'fill_blank') {
                const gapAns = gapAnswers.get(q.id.toString()) || [];
                return gapAns.length === 0 || gapAns.some(v => (v || '').toString().trim() === '');
              }
              if (q.question_type === 'text_completion') {
                const gapAns = gapAnswers.get(q.id.toString()) || [];
                return gapAns.length === 0 || gapAns.some(v => (v || '').toString().trim() === '');
              }
              if (q.question_type === 'short_answer' || q.question_type === 'long_text') {
                return !ans || (ans || '').toString().trim() === '';
              }
              return ans === undefined;
            })()}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check Answer
          </Button>
        </div>
      </div>
    );
  };

  const renderQuizResult = () => {
    const question = getCurrentQuestion();
    if (!question) return null;

    const userAnswer = getCurrentUserAnswer();

    // Calculate progress based on actual question items (including gaps)
    const displayNumber = getQuestionDisplayNumber(currentQuestionIndex);
    const questionGaps = (question.question_type === 'fill_blank' || question.question_type === 'text_completion')
      ? (question.content_text || question.question_text || '').match(/\[\[(.*?)\]\]/g)?.length || 1
      : 1;
    const currentEndNumber = displayNumber + questionGaps - 1;
    const progress = (currentEndNumber / totalQuestionCount) * 100;

    return (
      <div className="w-full md:max-w-4xl md:mx-auto space-y-4 md:space-y-8 md:p-6">
        {/* Progress Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">
              Question{questionGaps > 1 ? 's' : ''} {displayNumber}{questionGaps > 1 ? `-${currentEndNumber}` : ''} of {totalQuestionCount}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              {Math.round(progress)}% Complete
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Exam mode badge - shown outside audio player */}
        {quizData?.quiz_media_url && quizData.quiz_media_type === 'audio' && quizData.audio_playback_mode === 'strict' && (
          <ExamModeBadge maxPlays={quizData.audio_max_plays || 2} />
        )}

        {/* Quiz-level Media for Audio/PDF/Text Quizzes */}
        {quizData?.quiz_media_url && (
          <div className="bg-white dark:bg-card rounded-none md:rounded-lg border-t border-b md:border dark:border-gray-700 p-2 md:p-4 mb-4 md:mb-6">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700">
                <div dangerouslySetInnerHTML={{ __html: renderTextWithLatex(quizData.quiz_media_url) }} />
              </div>
            ) : quizData.quiz_media_type === 'pdf' ? (
              // Check if it's actually a PDF or an image
              quizData.quiz_media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <ZoomableImage
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}`}
                  alt="Reference material"
                />
              ) : (
                <div className="border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="w-full h-[800px] border dark:border-gray-700 rounded-lg">
                    <iframe
                      src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full"
                      title="Question PDF"
                    />
                  </div>
                </div>
              )
            ) : null}
          </div>
        )}

        {/* Question Review */}
        <div className="bg-white dark:bg-card rounded-none md:rounded-2xl overflow-hidden border-t border-b md:border dark:border-gray-700">
          <div className="p-3 md:p-8">
            {/* Media Attachment for Media Questions */}
            {(question.question_type === 'media_question' || question.question_type === 'media_open_question') && question.media_url && (
              <div className="mb-4">
                {question.media_type === 'pdf' ? (
                  <iframe
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${question.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-64 border dark:border-gray-700 rounded-lg"
                    title="Question PDF"
                  />
                ) : (
                  <ZoomableImage
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${question.media_url}`}
                    alt="Question media"
                  />
                )}
              </div>
            )}

            {/* Content Text / Passage */}
            {hasVisibleContent(question.content_text) && question.question_type !== 'text_completion' && question.question_type !== 'fill_blank' && (
              <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-lg mb-4 border-l-3 border-blue-400 dark:border-blue-500/30">
                <div className="text-gray-700 dark:text-gray-200 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(question.content_text) }} />
              </div>
            )}

            {question.question_type !== 'fill_blank' && question.question_type !== 'text_completion' && (
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex(question.question_text.replace(/\[\[.*?\]\]/g, '')) }} />
              </h3>
            )}

            {question.question_type === 'fill_blank' && (
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Fill in the gaps
              </h3>
            )}

            {question.question_type === 'text_completion' && (
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Fill in the blanks
              </h3>
            )}

            {question.question_type === 'short_answer' || question.question_type === 'media_open_question' ? (
              <ShortAnswerQuestion
                question={question}
                value={userAnswer}
                onChange={() => {}}
                disabled={true}
                showResult={true}
              />
            ) : question.question_type === 'matching' ? (
              <MatchingQuestion
                question={question}
                value={quizAnswers.get(question.id.toString())}
                onChange={() => {}}
                disabled={true}
                showResult={true}
              />
            ) : question.question_type !== 'fill_blank' && question.question_type !== 'text_completion' ? (
              /* Options Review - Use the same component for consistency */
              <ChoiceQuestion
                question={question}
                value={userAnswer}
                onChange={() => {}}
                disabled={true}
                showResult={true}
              />
            ) : (
              /* Fill-in-the-gaps Review */
              <div className="p-6 rounded-xl border-2 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {(() => {
                  const answers: string[] = Array.isArray(question.correct_answer) ? question.correct_answer : (question.correct_answer ? [question.correct_answer] : []);
                  const current = gapAnswers.get(question.id.toString()) || new Array(answers.length).fill('');

                  if (question.question_type === 'fill_blank') {
                    return (
                      <FillInBlankQuestion
                        question={question}
                        answers={current}
                        onAnswerChange={() => { }}
                        disabled={true}
                        showResult={true}
                      />
                    );
                  } else {
                    // Text completion fallback or implementation
                    const parts = (question.content_text || question.question_text || '').split(/\[\[(.*?)\]\]/g);
                    let gapIndex = 0;
                    return (
                      <div className="text-lg leading-relaxed text-gray-800 dark:text-gray-100">
                        {parts.map((part: string, i: number) => {
                          const isGap = i % 2 === 1;
                          if (!isGap) {
                            return <span key={i} dangerouslySetInnerHTML={{ __html: renderTextWithLatex(part) }} />;
                          }
                          const idx = gapIndex++;
                          const userAnswer = current[idx] || '';
                          const correctAnswer = answers[idx] || '';
                          const isCorrectGap = userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

                          return (
                            <span key={`gap-review-${i}`} className={`inline-flex items-center px-3 py-1 mx-1 rounded-md font-medium ${isCorrectGap
                              ? 'bg-green-200 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-2 border-green-300 dark:border-green-700'
                              : 'bg-red-200 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-2 border-red-300 dark:border-red-700'
                              }`}>
                              {userAnswer || `[Gap ${idx + 1}]`}
                              {/* Correct answer hidden */}
                            </span>
                          );
                        })}
                      </div>
                    );
                  }
                })()}
              </div>
            )}

            {/* Explanation */}
            {question.explanation && (
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border-l-4 border-blue-400">
                <h5 className="text-lg font-bold text-blue-900 dark:text-blue-400 mb-3 flex items-center gap-2">
                  💡 Explanation
                </h5>
                <div className="text-blue-800 dark:text-blue-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(question.explanation) }} />
              </div>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={nextQuestion}
            className="group btn-primary"
          >
            <span className="flex items-center gap-3">
              {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
            </span>
          </Button>
        </div>
      </div>
    );
  };

  const [showAllAnswers, setShowAllAnswers] = useState(false);

  const renderQuizCompleted = () => {
    // Check for long text questions
    const hasLongText = questions.some(q => q.question_type === 'long_text');
    
    // Determine if grading is pending
    // If it has long text and (no attempt record OR attempt is not graded), it's pending
    const isPending = hasLongText && (!quizAttempt || !quizAttempt.is_graded);

    if (isPending) {
      return (
        <div className="w-full md:max-w-2xl md:mx-auto text-center space-y-6 md:p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Submission Received
          </h1>
          <div className="p-4 md:p-8 rounded-2xl border dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
             <div className="text-6xl mb-4">📝</div>
             <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-400 mb-2">Pending Teacher Review</h2>
             <p className="text-yellow-700 dark:text-yellow-400">
               Your quiz includes long text questions that require manual grading. 
               Your score will be updated once the teacher reviews your answers.
             </p>
          </div>
          <div className="flex justify-center">
             <Button onClick={goToNextStep} className="bg-blue-600 hover:bg-blue-700 text-white">
               Continue to Next Step
             </Button>
          </div>
        </div>
      );
    }

    const stats = getGapStatistics();

    // Calculate total "items" (gaps + regular questions)
    const totalItems = stats.totalGaps + stats.regularQuestions;
    const correctItems = stats.correctGaps + stats.correctRegular;
    
    // For graded quizzes (especially long text), use the teacher-assigned score
    // Otherwise calculate from correct/total
    const percentage = (quizAttempt && quizAttempt.is_graded && quizAttempt.score_percentage !== undefined)
      ? Math.round(quizAttempt.score_percentage)
      : (totalItems > 0 ? Math.round((correctItems / totalItems) * 100) : 0);
    const isPassed = percentage >= 50;

    if (showAllAnswers) {
      return (
        <div className="w-full md:max-w-3xl md:mx-auto space-y-4 md:space-y-6 md:p-4">
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Correct Answers</h2>
            <p className="text-gray-600 dark:text-gray-300">Review your answers below</p>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => {
              const userAnswer = quizAnswers.get(q.id);
              const displayNumber = getQuestionDisplayNumber(idx);
              const questionGaps = (q.question_type === 'fill_blank' || q.question_type === 'text_completion')
                ? (q.content_text || q.question_text || '').match(/\[\[(.*?)\]\]/g)?.length || 1
                : 1;

              return (
                <div key={q.id} className="bg-white dark:bg-gray-900/50 rounded-none md:rounded-xl border-t border-b md:border dark:border-gray-800/60">
                  <div className="p-2 md:p-6">
                    {/* Question Number Badge */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {displayNumber}
                      </div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Question{questionGaps > 1 ? 's' : ''} {displayNumber}{questionGaps > 1 ? `-${displayNumber + questionGaps - 1}` : ''} of {totalQuestionCount}
                      </span>
                    </div>

                    {/* Media Attachment for Media Questions */}
                    {(q.question_type === 'media_question' || q.question_type === 'media_open_question') && q.media_url && (
                      <div className="mb-4">
                        {q.media_type === 'pdf' ? (
                          <iframe
                            src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                            className="w-full h-64 border rounded-lg"
                            title="Question PDF"
                          />
                        ) : (
                          <ZoomableImage
                            src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                            alt="Question media"
                          />
                        )}
                      </div>
                    )}

                    {/* Content Text */}
                    {hasVisibleContent(q.content_text) && q.question_type !== 'text_completion' && q.question_type !== 'fill_blank' && (
                      <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-lg mb-4 border-l-3 border-blue-400 dark:border-blue-500/30">
                        <div className="text-gray-700 dark:text-gray-200 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.content_text) }} />
                      </div>
                    )}

                    {/* Question */}
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                      <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex((q.question_text || (q.question_type === 'text_completion' ? 'Fill in the blanks:' : '')).replace(/\[\[([^\]]+)\]\]/g, '[[blank]]')) }} />
                    </h3>

                    {/* Answer Input Based on Question Type - ALWAYS SHOW RESULT */}
                    {q.question_type === 'long_text' ? (
                      <LongTextQuestion
                        question={q}
                        value={userAnswer}
                        onChange={() => {}}
                        disabled={true}
                      />
                    ) : (q.question_type === 'short_answer' || q.question_type === 'media_open_question') ? (
                      <ShortAnswerQuestion
                        question={q}
                        value={userAnswer}
                        onChange={() => {}}
                        disabled={true}
                        showResult={true}
                      />
                    ) : q.question_type === 'text_completion' ? (
                      <TextCompletionQuestion
                        question={q}
                        answers={gapAnswers.get(q.id.toString()) || []}
                        onAnswerChange={() => {}}
                        disabled={true}
                        showResult={true}
                      />
                    ) : q.question_type === 'single_choice' || q.question_type === 'multiple_choice' || q.question_type === 'media_question' ? (
                      <ChoiceQuestion
                        question={q}
                        value={userAnswer}
                        onChange={() => {}}
                        disabled={true}
                        showResult={true}
                      />
                    ) : q.question_type === 'matching' ? (
                      <MatchingQuestion
                        question={q}
                        value={quizAnswers.get(q.id.toString())}
                        onChange={() => {}}
                        disabled={true}
                        showResult={true}
                      />
                    ) : (
                      <FillInBlankQuestion
                        question={q}
                        answers={gapAnswers.get(q.id.toString()) || []}
                        onAnswerChange={() => {}}
                        disabled={true}
                        showResult={true}
                      />
                    )}

                    {/* Result Indicator - Logic removed as requested to avoid confusion and redundancy */}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center pt-6 pb-10">
            <Button
              onClick={() => setShowAllAnswers(false)}
              className="px-8 py-3 bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white rounded-lg text-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
            >
              Back to Results
            </Button>
          </div>
        </div>
      );
    }

    const previousAttempts = attemptsHistory.slice(0, -1);
    const previousAttempt = previousAttempts.length > 0 ? previousAttempts[previousAttempts.length - 1] : null;
    const scoreDiff = previousAttempt ? percentage - Math.round(previousAttempt.score_percentage) : null;

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const chartData = attemptsHistory.map((a: any, i: number) => ({
      attempt: i + 1,
      score: Math.round(a.score_percentage),
      date: a.completed_at ? formatDate(a.completed_at) : `#${i + 1}`,
    }));

    return (
      <div className="w-full max-w-3xl mx-auto text-center space-y-4 py-6 md:py-10">
        <h2 className="text-3xl font-bold text-foreground">
          {isPassed ? 'Nice work!' : 'Keep going!'}
        </h2>
        <p className="text-base text-muted-foreground">
          {isPassed ? 'You passed the quiz' : "You're making progress — try again"}
        </p>

        <div className="w-full p-6 md:p-8 rounded-2xl bg-white dark:bg-card">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <div className={`text-6xl font-bold ${
                isPassed ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
              }`}>
                {percentage}%
              </div>
              <p className="text-lg text-muted-foreground">
                {correctItems} out of {totalItems} {totalItems === 1 ? 'answer' : 'answers'} correct
              </p>

              {scoreDiff !== null && scoreDiff > 0 && (
                <p className="text-base font-medium text-green-600 dark:text-green-400">
                  +{scoreDiff}% from last attempt
                </p>
              )}
              {scoreDiff !== null && scoreDiff < 0 && (
                <p className="text-base font-medium text-muted-foreground">
                  {scoreDiff}% from last attempt
                </p>
              )}
              {scoreDiff !== null && scoreDiff === 0 && (
                <p className="text-base text-muted-foreground">
                  Same score as last time
                </p>
              )}

              {!isPassed && (
                <p className="text-base text-muted-foreground">
                  Score at least 50% to continue
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
              <div className="rounded-lg p-3 bg-gray-50 dark:bg-secondary text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{correctItems}</div>
                <div className="text-base text-muted-foreground">Correct</div>
              </div>
              <div className="rounded-lg p-3 bg-gray-50 dark:bg-secondary text-center">
                <div className="text-2xl font-bold text-red-500 dark:text-red-400">{totalItems - correctItems}</div>
                <div className="text-base text-muted-foreground">Incorrect</div>
              </div>
              <div className="rounded-lg p-3 bg-gray-50 dark:bg-secondary text-center">
                <div className="text-2xl font-bold text-foreground">{totalItems}</div>
                <div className="text-base text-muted-foreground">Total</div>
              </div>
            </div>

            {chartData.length === 1 && (
              <p className="text-base text-muted-foreground text-center">This is your first attempt</p>
            )}

            {chartData.length > 1 && (
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3 text-left">Your attempts</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Score']}
                      labelFormatter={(_label: string, payload: readonly any[]) => {
                        if (payload && payload[0]) {
                          return `Attempt ${payload[0].payload.attempt} — ${payload[0].payload.date}`;
                        }
                        return '';
                      }}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '13px',
                      }}
                    />
                    <ReferenceLine
                      y={50}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(217, 91%, 60%)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'hsl(217, 91%, 60%)' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {quizAttempt && quizAttempt.feedback && (
          <div className="w-full p-5 rounded-2xl bg-white dark:bg-card text-left">
            <h3 className="text-sm font-semibold text-foreground mb-1">Teacher Feedback</h3>
            <div className="text-sm text-muted-foreground prose dark:prose-invert max-w-none">
              <p>{quizAttempt.feedback}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-3 flex-wrap pt-2">
          {quizData?.display_mode === 'all_at_once' && (
            <Button onClick={reviewQuiz} variant="outline">
              Review Answers
            </Button>
          )}

          {(isPassed || import.meta.env.DEV || isTeacher) && (
            <Button
              onClick={() => setShowAllAnswers(true)}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white"
            >
              Show Correct Answers
            </Button>
          )}

          {!hasLongText && (
            <Button onClick={resetQuiz} variant="outline">
              Retake Quiz
            </Button>
          )}
        </div>
      </div>
    );
  };

  switch (quizState) {
    case 'feed':
      return renderQuizFeed();
    case 'title':
      return renderQuizTitleScreen();
    case 'question':
      return renderQuizQuestion();
    case 'result':
      return renderQuizResult();
    case 'completed':
      return renderQuizCompleted();
    default:
      return null;
  }
};

export default QuizRenderer;
