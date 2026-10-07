import React, { useState, useEffect, useMemo } from 'react';
import { reportErrorMessage } from '../../lib/questionReport';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import { ChevronRight, ChevronDown, ChevronUp, AlertTriangle, HelpCircle, Lock as LockIcon, AlertCircle, Wrench, ClipboardList } from 'lucide-react';
import { renderTextWithLatex } from '../../utils/latex';
import { sanitizeHtml } from '../../lib/safeHtml';
import { applyHighlightsToHtml as applyHighlightsToHtmlShared } from '../../utils/highlightUtils';
import type { Step } from '../../types';
import { DEFAULT_QUIZ_PASSING_SCORE_REQUIRED } from '../../utils/quizPassingScore';
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
import { toast } from '../Toast';
import { useLocale, useT } from '../../lib/i18n/react';
import { formatDate as formatDay } from '../../lib/i18n';
import {
  getAnswerKey,
  getQuestionStatus,
  isAnswerComplete
} from './quiz/scoring';
import '@/lib/i18n/catalogs/learning';
import '@/lib/i18n/catalogs/lessonPlayer';

// Exam mode badge component
const ExamModeBadge = ({ maxPlays }: { maxPlays: number }) => {
  const t = useT();
  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium mt-2">
      <LockIcon className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{t('lessonPlayer.quiz.examMode', { count: maxPlays })}</span>
    </div>
  );
};


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
type HighlightColor = 'yellow' | 'pink' | 'blue';
type TextHighlight = { text: string; color: HighlightColor };
type ReviewStatusKey = 'correct' | 'incorrect' | 'partial' | 'review' | 'unscored';

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
  /** Optional call to action on the pass screen, e.g. a checkpoint sending the student back
   *  to the course now that the units it was holding back are open again. */
  continueAction?: { note: string; label: string; onClick: () => void };
  /** A one-shot assessment that is no longer open (a completed or lapsed checkpoint): the
   *  server would refuse another attempt with 409, so the player offers no retake. */
  singleAttempt?: boolean;
  courseId: string | undefined;
  finishQuiz: () => void;
  reviewQuiz: () => void;
  autoFillCorrectAnswers: () => void;
  clearAllAnswers?: () => void;
  quizAttempt?: any;
  highlightedQuestionId?: string;
  isTeacher?: boolean;
  isSpecialGroupStudent?: boolean;
  passingScorePercent?: number;
}

const QuizRenderer = (props: QuizRendererProps) => {
  const t = useT();
  const locale = useLocale();
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
    continueAction,
    singleAttempt,
    setQuizCompleted,
    markStepAsVisited,
    currentStep,
    setFeedChecked,
    getGapStatistics,
    setQuizAnswers,
    finishQuiz,
    reviewQuiz,
    autoFillCorrectAnswers,
    clearAllAnswers,
    quizAttempt,
    highlightedQuestionId,
    isTeacher,
    isSpecialGroupStudent = false,
    passingScorePercent = DEFAULT_QUIZ_PASSING_SCORE_REQUIRED,
  } = props;

  // Reveal policy: correct answers are shown only once the student has passed.
  // This is the single place the policy lives — change this expression to change it everywhere.
  const canRevealCorrectAnswers = (hasPassed: boolean) =>
    hasPassed || import.meta.env.DEV || Boolean(isTeacher);

  // Handle scrolling to highlighted question
  useEffect(() => {
    if (highlightedQuestionId && questions.length > 0 && (quizState === 'feed' || quizState === 'question')) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`question-${highlightedQuestionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-ring', 'ring-offset-2', 'shadow-2xl', 'transition-all', 'duration-500', 'rounded-xl');
          
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-ring', 'ring-offset-2', 'shadow-2xl');
          }, 5000);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [highlightedQuestionId, questions.length > 0, quizState]);
  
  // State for quiz attempts history (used on completed screen)
  const [attemptsHistory, setAttemptsHistory] = useState<any[]>([]);

  // When the student presses "Check All Answers" while some questions are
  // still unanswered, highlight those questions in red instead of silently
  // keeping the button disabled.
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Lets the student collapse the bottom question-navigator bar out of the way.
  // Persisted so the preference survives across questions/lessons.
  const [isQuizNavCollapsed, setIsQuizNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem('quizNavCollapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('quizNavCollapsed', String(isQuizNavCollapsed));
    } catch {
      // ignore (e.g. private browsing storage quota)
    }
  }, [isQuizNavCollapsed]);

  useEffect(() => {
    if (quizState === 'completed' && currentStep) {
      let cancelled = false;
      apiClient.getStepQuizAttempts(currentStep.id)
        .then((attempts) => {
          if (cancelled) return;
          const completed = attempts
            .filter((a: any) => !a.is_draft && a.completed_at)
            .sort((a: any, b: any) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
          setAttemptsHistory(completed);
        })
        .catch(() => {
          if (cancelled) return;
          setAttemptsHistory([]);
          toast(t('lessonPlayer.quiz.historyFailed'), 'error');
        });
      return () => { cancelled = true; };
    }
  }, [quizState, currentStep?.id]);

  // State for error reporting
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportQuestionId, setReportQuestionId] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState('');
  const [reportSuggestedAnswer, setReportSuggestedAnswer] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedQuestions, setReportedQuestions] = useState<Set<string>>(new Set());
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [textHighlightsByQuestion, setTextHighlightsByQuestion] = useState<Map<string, TextHighlight[]>>(new Map());
  // Crossed-out answer options: Map<questionId, Set<optionIndex>>
  const [crossedOutByQuestion, setCrossedOutByQuestion] = useState<Map<string, Set<number>>>(new Map());

  const toggleCrossOut = (questionId: string, optionIndex: number) => {
    setCrossedOutByQuestion(prev => {
      const next = new Map(prev)
      const set = new Set(next.get(questionId) || [])
      set.has(optionIndex) ? set.delete(optionIndex) : set.add(optionIndex)
      next.set(questionId, set)
      return next
    })
  }
  const [areHighlightsHydrated, setAreHighlightsHydrated] = useState(false);
  const [highlightPalette, setHighlightPalette] = useState<{
    questionId: string;
    selectedText: string;
    selectionOffsetY: number;
  } | null>(null);

  const quizTextHighlightsStorageKey = currentStep ? `quiz_text_highlights_${currentStep.id}` : null;

  useEffect(() => {
    setAreHighlightsHydrated(false);

    if (!quizTextHighlightsStorageKey) {
      setTextHighlightsByQuestion(new Map());
      setAreHighlightsHydrated(true);
      return;
    }

    try {
      const savedHighlights = localStorage.getItem(quizTextHighlightsStorageKey);
      if (!savedHighlights) {
        setTextHighlightsByQuestion(new Map());
        setAreHighlightsHydrated(true);
        return;
      }

      const parsedHighlights = JSON.parse(savedHighlights);
      if (!parsedHighlights || typeof parsedHighlights !== 'object' || Array.isArray(parsedHighlights)) {
        setTextHighlightsByQuestion(new Map());
        setAreHighlightsHydrated(true);
        return;
      }

      const nextMap = new Map<string, TextHighlight[]>();
      Object.entries(parsedHighlights).forEach(([questionId, values]) => {
        if (!Array.isArray(values)) return;
        const normalizedValues = values
          .map((value: any) => {
            if (typeof value === 'string') {
              return { text: value.trim(), color: 'yellow' as HighlightColor };
            }
            if (!value || typeof value !== 'object') return null;
            const text = value.text?.toString().trim();
            const color = value.color as HighlightColor;
            if (!text) return null;
            if (color !== 'yellow' && color !== 'pink' && color !== 'blue') {
              return { text, color: 'yellow' as HighlightColor };
            }
            return { text, color };
          })
          .filter((value): value is TextHighlight => {
            if (!value || typeof value !== 'object') return false
            if (typeof (value as TextHighlight).text !== 'string') return false
            return (value as TextHighlight).text.length >= 2
          });
        if (normalizedValues.length > 0) {
          nextMap.set(questionId, normalizedValues);
        }
      });
      setTextHighlightsByQuestion(nextMap);
      setAreHighlightsHydrated(true);
    } catch (error) {
      console.error('Failed to restore text highlights from localStorage:', error);
      setTextHighlightsByQuestion(new Map());
      setAreHighlightsHydrated(true);
    }
  }, [quizTextHighlightsStorageKey]);

  useEffect(() => {
    if (!quizTextHighlightsStorageKey) return;
    if (!areHighlightsHydrated) return;

    const payload = Object.fromEntries(
      Array.from(textHighlightsByQuestion.entries())
        .filter(([, values]) => values.length > 0)
    );

    localStorage.setItem(quizTextHighlightsStorageKey, JSON.stringify(payload));
  }, [quizTextHighlightsStorageKey, textHighlightsByQuestion, areHighlightsHydrated]);

  const addTextHighlight = (questionId: string, highlightText: string, color: HighlightColor) => {
    const normalizedText = highlightText.replace(/\s+/g, ' ').trim();
    if (normalizedText.length < 2) return;

    setTextHighlightsByQuestion(prev => {
      const next = new Map(prev);
      const current = next.get(questionId) || [];
      const existingIndex = current.findIndex((item) => item.text === normalizedText);
      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = { ...updated[existingIndex], color };
        next.set(questionId, updated);
        return next;
      }
      next.set(questionId, [...current, { text: normalizedText, color }]);
      return next;
    });
  };

  const removeTextHighlight = (questionId: string, highlightText: string) => {
    const normalizedText = highlightText.replace(/\s+/g, ' ').trim();
    if (normalizedText.length < 2) return;

    setTextHighlightsByQuestion(prev => {
      const current = prev.get(questionId) || [];
      const filtered = current.filter((item) => item.text !== normalizedText);
      const next = new Map(prev);

      if (filtered.length === 0) {
        next.delete(questionId);
      } else {
        next.set(questionId, filtered);
      }

      return next;
    });
  };

  const submitQuizForReview = () => {
    setFeedChecked(true)
    finishQuiz()
  }

  const handleConfirmQuizSubmission = () => {
    if (!isSpecialGroupStudent) {
      submitQuizForReview()
      return
    }

    setIsSubmitConfirmOpen(true)
  }

  const handleDialogConfirmSubmission = () => {
    setIsSubmitConfirmOpen(false)
    submitQuizForReview()
  }

  const handleTextSelection = (questionId: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
    if (selectedText.length < 2) return;

    const anchorElement = selection.anchorNode instanceof Element
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;
    if (anchorElement?.closest('input, textarea, [contenteditable="true"]')) return;

    const range = selection.getRangeAt(0);
    const selectionRect = range.getBoundingClientRect();
    if (!selectionRect.width && !selectionRect.height) return;

    const questionElement = document.getElementById(`question-${questionId}`);
    const questionRect = questionElement?.getBoundingClientRect();
    const selectionOffsetY = questionRect
      ? Math.max(8, selectionRect.top - questionRect.top)
      : Math.max(8, selectionRect.top);

    setHighlightPalette({
      questionId,
      selectedText,
      selectionOffsetY
    });
  };

  const handleHighlightColorPick = (color: HighlightColor) => {
    if (!highlightPalette) return;
    addTextHighlight(highlightPalette.questionId, highlightPalette.selectedText, color);
    setHighlightPalette(null);
    window.getSelection()?.removeAllRanges();
  };

  useEffect(() => {
    if (!highlightPalette) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-highlight-palette="true"]')) return;
      setHighlightPalette(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setHighlightPalette(null);
      window.getSelection()?.removeAllRanges();
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [highlightPalette]);

  const EMPTY_HIGHLIGHTS: TextHighlight[] = [];
  const getQuestionHighlights = (questionId: string) => textHighlightsByQuestion.get(questionId) || EMPTY_HIGHLIGHTS;

  const renderHighlightedLatex = (questionId: string, htmlSource: string) => {
    const rendered = renderTextWithLatex(htmlSource);
    return applyHighlightsToHtmlShared(rendered, getQuestionHighlights(questionId), questionId);
  };

  const handleHighlightedTextClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (!target) return

    const mark = target.closest('mark[data-highlight-text][data-highlight-question-id]') as HTMLElement | null
    if (!mark) return

    const questionId = mark.getAttribute('data-highlight-question-id') || ''
    const highlightText = mark.getAttribute('data-highlight-text') || ''
    if (!questionId || !highlightText) return

    removeTextHighlight(questionId, highlightText)
    setHighlightPalette(null)
    window.getSelection()?.removeAllRanges()
    event.preventDefault()
    event.stopPropagation()
  }

  const renderHighlightPalette = (questionId: string) => {
    if (!highlightPalette || highlightPalette.questionId !== questionId) return null;

    return (
      <div
        data-highlight-palette="true"
        className="absolute z-20 flex flex-col sm:flex-col items-center gap-2 rounded-lg border border-border bg-popover/95 p-2 shadow-lg backdrop-blur-sm"
        style={{
          right: 'clamp(-56px, -2vw, 8px)',
          top: highlightPalette.selectionOffsetY,
          maxWidth: 'calc(100vw - 16px)'
        }}
      >
        <button
          type="button"
          onClick={() => handleHighlightColorPick('yellow')}
          className="h-6 w-6 rounded-sm bg-amber-300 hover:bg-amber-400 ring-1 ring-black/10 dark:ring-white/15"
          aria-label={t('lessonPlayer.quiz.highlightYellow')}
        />
        <button
          type="button"
          onClick={() => handleHighlightColorPick('pink')}
          className="h-6 w-6 rounded-sm bg-pink-300 hover:bg-pink-400 ring-1 ring-black/10 dark:ring-white/15"
          aria-label={t('lessonPlayer.quiz.highlightPink')}
        />
        <button
          type="button"
          onClick={() => handleHighlightColorPick('blue')}
          className="h-6 w-6 rounded-sm bg-sky-300 hover:bg-sky-400 ring-1 ring-black/10 dark:ring-white/15"
          aria-label={t('lessonPlayer.quiz.highlightBlue')}
        />
      </div>
    );
  };

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
      toast(t('lessonPlayer.report.sent'), 'success');
    } catch (error) {
      console.error('Failed to submit error report:', error);
      // The server refuses a report for reasons the student can act on (too short to act on,
      // or the daily ceiling) — telling them "try again" invites exactly the retry that fails.
      toast(reportErrorMessage(error), 'error');
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

  // "Question 3 of 12", or "Questions 3-5 of 12" for a question with several gaps.
  const questionCounter = (from: number, gaps: number) =>
    gaps > 1
      ? t('lessonPlayer.quiz.questionsOf', { from, to: from + gaps - 1, total: totalQuestionCount })
      : t('lessonPlayer.quiz.questionOf', { number: from, total: totalQuestionCount });

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

    const answerableQuestions = questions.filter(q => q.question_type !== 'image_content');
    const unansweredQuestions = answerableQuestions.filter(q => {
      const key = getAnswerKey(q);
      return !isAnswerComplete(q, quizAnswers.get(key), gapAnswers.get(key));
    });
    const isQuizIncomplete = unansweredQuestions.length > 0;
    const answeredCount = answerableQuestions.length - unansweredQuestions.length;

    const feedStats = getGapStatistics();
    const feedTotalItems = feedStats.totalGaps + feedStats.regularQuestions;
    const feedCorrectItems = feedStats.correctGaps + feedStats.correctRegular;
    const feedScorePercentage = feedTotalItems > 0 ? (feedCorrectItems / feedTotalItems) * 100 : 100;
    const feedRevealCorrect = feedChecked && canRevealCorrectAnswers(feedScorePercentage >= passingScorePercent);

    const handleCheckAnswersClick = () => {
      if (isQuizIncomplete) {
        // Reveal the red highlights and jump to the first unanswered question
        setShowValidationErrors(true);
        document.getElementById(`question-${unansweredQuestions[0].id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setShowValidationErrors(false);
      handleConfirmQuizSubmission();
    };

    return (
      <div className="w-full md:max-w-3xl md:mx-auto space-y-4 md:space-y-6 md:p-4 pb-24">
        {/* Header — the questions speak for themselves; only the dev/teacher helpers remain. */}
        <div className="space-y-2">
          {(import.meta.env.DEV || isTeacher) && (
            <div className="flex items-center gap-2">
              <Button
                onClick={autoFillCorrectAnswers}
                className="px-4 py-2 bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                title={isTeacher ? t('lessonPlayer.quiz.showAnswers') : t('lessonPlayer.quiz.devFillTitle')}
              >
                {isTeacher ? t('lessonPlayer.quiz.showAnswers') : t('lessonPlayer.quiz.devFill')}
              </Button>
              {clearAllAnswers && (
                <Button
                  onClick={() => { setShowValidationErrors(false); clearAllAnswers(); }}
                  variant="outline"
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  disabled={quizAnswers.size === 0 && gapAnswers.size === 0}
                  title={t('lessonPlayer.quiz.clearAllTitle')}
                >
                  {t('lessonPlayer.quiz.clearAll')}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Exam mode badge - shown outside audio player */}
        {quizData?.quiz_media_url && quizData.quiz_media_type === 'audio' && quizData.audio_playback_mode === 'strict' && (
          <ExamModeBadge maxPlays={quizData.audio_max_plays || 2} />
        )}

        {/* Quiz-level Media for Audio/PDF/Text Quizzes */}
        {quizData?.quiz_media_url && (
          <div className="bg-transparent">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-muted/50 p-6 rounded-lg border border-border">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(quizData.quiz_media_url)) }} />
              </div>
            ) : quizData.quiz_media_type === 'pdf' ? (
              // Check if it's actually a PDF or an image
              quizData.quiz_media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <ZoomableImage
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}`}
                  alt={t('lessonPlayer.quiz.referenceMaterial')}
                />
              ) : (
                <div className="border border-border rounded-lg bg-muted/50">
                  <div className="w-full h-[clamp(400px,70vh,800px)] border border-border rounded-lg">
                    <iframe
                      src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full"
                      title={t('lessonPlayer.quiz.questionPdf')}
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
            const userAnswer = quizAnswers.get(getAnswerKey(q));
            const displayNumber = getQuestionDisplayNumber(idx);
            const isUnanswered = q.question_type !== 'image_content' && !feedChecked &&
              !isAnswerComplete(q, quizAnswers.get(getAnswerKey(q)), gapAnswers.get(getAnswerKey(q)));
            const showUnansweredError = showValidationErrors && isUnanswered;
            const questionGaps = (q.question_type === 'fill_blank' || q.question_type === 'text_completion')
              ? (q.content_text || q.question_text || '').match(/\[\[(.*?)\]\]/g)?.length || 1
              : 1;

            // Special rendering for image_content - just show the image, no question UI
            if (q.question_type === 'image_content') {
              return (
                <div key={q.id} id={`question-${q.id}`} className="bg-transparent">
                  <div className="p-2 md:p-6 flex flex-col items-center">
                    {q.media_url && (
                      <img
                        src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                        alt={q.question_text || t('lessonPlayer.quiz.referenceImage')}
                        className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg"
                      />
                    )}
                    {q.question_text && (
                      <p className="text-sm text-muted-foreground mt-2 text-center">{q.question_text}</p>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={q.id}
                id={`question-${q.id}`}
                className={`relative overflow-visible bg-transparent rounded-xl transition-all ${
                  showUnansweredError ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-background' : ''
                }`}
                onMouseUp={() => handleTextSelection(q.id.toString())}
                onClick={handleHighlightedTextClick}
              >
                {renderHighlightPalette(q.id.toString())}
                <div className="p-2 md:p-6">
                  {showUnansweredError && (
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>{t('lessonPlayer.quiz.answerThis')}</span>
                    </div>
                  )}
                  {/* Question Number Badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      {questionCounter(displayNumber, questionGaps)}
                    </span>
                  </div>

                  {/* Media Attachment for Media Questions */}
                  {(q.question_type === 'media_question' || q.question_type === 'media_open_question') && q.media_url && (
                    <div className="mb-4">
                      {q.media_type === 'pdf' ? (
                        <iframe
                          src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                          className="w-full h-64 border border-border rounded-lg"
                          title={t('lessonPlayer.quiz.questionPdf')}
                        />
                      ) : (
                        <ZoomableImage
                          src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                          alt={t('lessonPlayer.quiz.questionMedia')}
                        />
                      )}
                    </div>
                  )}

                  {/* Content Text */}
                  {hasVisibleContent(q.content_text) && q.question_type !== 'text_completion' && q.question_type !== 'fill_blank' && (
                    <div className="bg-muted/40 p-4 rounded-lg mb-4 border border-border/60">
                      <div
                        className="text-foreground/90 prose dark:prose-invert max-w-none select-text"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderHighlightedLatex(q.id.toString(), q.content_text)) }}
                      />
                    </div>
                  )}

                  {/* Question */}
                  <h3 className="text-lg font-bold text-foreground mb-4 select-text">
                    <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderHighlightedLatex(q.id.toString(), (q.question_text || '').replace(/\[\[([^\]]+)\]\]/g, '[[blank]]'))) }} />
                  </h3>

                  {/* Answer Input Based on Question Type */}
                  {q.question_type === 'long_text' ? (
                    <>
                      <LongTextQuestion
                        question={q}
                        value={userAnswer}
                        onChange={(val) => setQuizAnswers(prev => new Map(prev.set(q.id.toString(), val)))}
                        disabled={feedChecked}
                      />
                    </>
                  ) : (q.question_type === 'short_answer' || q.question_type === 'media_open_question') ? (
                    <ShortAnswerQuestion
                      question={q}
                      value={userAnswer}
                      onChange={(val) => setQuizAnswers(prev => new Map(prev.set(q.id.toString(), val)))}
                      disabled={feedChecked}
                      showResult={feedChecked}
                      revealCorrect={feedRevealCorrect}
                    />
                  ) : q.question_type === 'text_completion' ? (
                    <TextCompletionQuestion
                      question={q}
                      questionId={q.id.toString()}
                      highlights={getQuestionHighlights(q.id.toString())}
                      answers={gapAnswers.get(q.id.toString()) || []}
                      onAnswerChange={(idx, val) => {
                        const currentAnswers = gapAnswers.get(q.id.toString()) || [];
                        const newAnswers = [...currentAnswers];
                        newAnswers[idx] = val;
                        setGapAnswers(prev => new Map(prev.set(q.id.toString(), newAnswers)));
                      }}
                      disabled={feedChecked}
                      showResult={feedChecked}
                      revealCorrect={feedRevealCorrect}
                    />
                  ) : q.question_type === 'single_choice' || q.question_type === 'multiple_choice' || q.question_type === 'media_question' ? (
                    <ChoiceQuestion
                      question={q}
                      value={userAnswer}
                      onChange={(val) => setQuizAnswers(prev => new Map(prev.set(q.id.toString(), val)))}
                      disabled={feedChecked}
                      showResult={feedChecked}
                      revealCorrect={feedRevealCorrect}
                      crossedOut={crossedOutByQuestion.get(q.id.toString())}
                      onCrossOut={(idx) => toggleCrossOut(q.id.toString(), idx)}
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
                      questionId={q.id.toString()}
                      highlights={getQuestionHighlights(q.id.toString())}
                      answers={gapAnswers.get(q.id.toString()) || []}
                      onAnswerChange={(idx, val) => {
                        const currentAnswers = gapAnswers.get(q.id.toString()) || [];
                        const newAnswers = [...currentAnswers];
                        newAnswers[idx] = val;
                        setGapAnswers(prev => new Map(prev.set(q.id.toString(), newAnswers)));
                      }}
                      disabled={feedChecked}
                      showResult={feedChecked}
                      revealCorrect={feedRevealCorrect}
                    />
                  )}

                  {/* Result Indicator - Explanation only (removed buggy isCorrect labels) */}
                  {feedChecked && q.explanation && (
                    <div className="mt-4 space-y-3">
                      <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
                        <p className="text-sm font-medium text-brand-subtle-foreground mb-1">{t('lessonPlayer.quiz.explanationLabel')}</p>
                        <div className="text-brand-subtle-foreground dark:text-brand-surface-foreground text-sm prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.explanation)) }} />
                      </div>
                    </div>
                  )}

                  {/* Report Error Button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => openReportModal(q.id.toString())}
                      disabled={reportedQuestions.has(q.id.toString())}
                      aria-label={reportedQuestions.has(q.id.toString()) ? t('lessonPlayer.report.alreadyAria') : t('lessonPlayer.report.aria')}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg transition-colors ${
                        reportedQuestions.has(q.id.toString())
                          ? 'bg-muted text-gray-400 dark:text-muted-foreground cursor-not-allowed'
                          : 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-700 dark:hover:text-orange-400'
                      }`}
                    >
                      {reportedQuestions.has(q.id.toString()) ? t('lessonPlayer.report.reported') : t('lessonPlayer.report.button')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* In-flow Check Answers button — always reachable at the end of the quiz,
            even if the sticky bottom navigator is collapsed. */}
        {!feedChecked && (
          <div className="flex justify-center pt-2">
            <Button
              onClick={handleCheckAnswersClick}
              disabled={isQuizIncomplete}
              title={isQuizIncomplete ? t('learning.quiz.answerAll', { answered: answeredCount, total: answerableQuestions.length }) : undefined}
              className="px-8 py-3 rounded-lg text-lg font-semibold min-h-[44px] bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground"
            >
              {t('lessonPlayer.quiz.checkAnswers')}
            </Button>
          </div>
        )}

        {/* Error Report Modal (shadcn Dialog: focus trap, Escape, role=dialog) */}
        <Dialog
          open={reportModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setReportModalOpen(false);
              setReportMessage('');
              setReportSuggestedAnswer('');
            }
          }}
        >
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                </div>
                {t('lessonPlayer.report.title')}
              </DialogTitle>
              <DialogDescription>
                {t('lessonPlayer.report.description')}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-4">
              <label htmlFor="report-message" className="block text-sm font-medium text-foreground mb-1">
                {t('lessonPlayer.report.whatsWrong')} <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <textarea
                id="report-message"
                value={reportMessage}
                onChange={(e) => setReportMessage(e.target.value)}
                placeholder={t('lessonPlayer.report.placeholder')}
                className="w-full h-24 p-3 border border-input rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-background text-foreground"
                aria-required="true"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('lessonPlayer.report.correctLabel')}
              </label>
              {(() => {
                const reportedQ = getReportedQuestion();
                if (!reportedQ) return null;

                if (reportedQ.question_type === 'single_choice' || reportedQ.question_type === 'media_question') {
                  return (
                    <div className="space-y-2" role="radiogroup" aria-label={t('lessonPlayer.report.suggestedAria')}>
                      {(reportedQ.options || []).map((opt: any, idx: number) => (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors min-h-[44px] ${
                            reportSuggestedAnswer === (opt.text || opt)
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-border hover:border-border/80'
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
                          <span className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(opt.text || opt)) }} />
                        </label>
                      ))}
                    </div>
                  );
                }

                if (reportedQ.question_type === 'multiple_choice') {
                  const selectedAnswers = reportSuggestedAnswer ? reportSuggestedAnswer.split('|') : [];
                  return (
                    <div className="space-y-2" role="group" aria-label={t('lessonPlayer.report.suggestedAriaMany')}>
                      {(reportedQ.options || []).map((opt: any, idx: number) => {
                        const optText = opt.text || opt;
                        const isSelected = selectedAnswers.includes(optText);
                        return (
                          <label
                            key={idx}
                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors min-h-[44px] ${
                              isSelected
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                : 'border-border hover:border-border/80'
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
                            <span className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(optText)) }} />
                          </label>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <input
                    type="text"
                    value={reportSuggestedAnswer}
                    onChange={(e) => setReportSuggestedAnswer(e.target.value)}
                    placeholder={t('lessonPlayer.report.correctPlaceholder')}
                    className="w-full p-3 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-background text-foreground"
                  />
                );
              })()}
              <p className="text-xs text-muted-foreground mt-1">{t('lessonPlayer.report.optionalHint')}</p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setReportModalOpen(false);
                  setReportMessage('');
                  setReportSuggestedAnswer('');
                }}
                className="min-h-[44px]"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={submitErrorReport}
                disabled={!reportMessage.trim() || reportSubmitting}
                className="bg-orange-600 hover:bg-orange-700 text-white min-h-[44px]"
              >
                {reportSubmitting ? t('lessonPlayer.report.submitting') : t('lessonPlayer.report.submit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('lessonPlayer.review.confirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('lessonPlayer.review.confirmBody')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDialogConfirmSubmission}>
                {t('lessonPlayer.review.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bluebook-style question navigator (progress overview + jump-to-question) */}
        {!feedChecked ? (
            <div className="fixed bottom-0 left-0 right-0 md:left-[var(--quiz-nav-left)] z-30 border-t border-border bg-background">
              {isQuizNavCollapsed ? (
                <div className="flex justify-center px-3 py-1">
                  <button
                    type="button"
                    onClick={() => setIsQuizNavCollapsed(false)}
                    title={t('lessonPlayer.navigator.show')}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    {t('lessonPlayer.navigator.answeredCount', { answered: answeredCount, total: answerableQuestions.length })}
                  </button>
                </div>
              ) : (
                <div className="px-3 md:px-6 py-2">
                  <div className="flex items-center gap-2 md:gap-3">
                    <button
                      type="button"
                      onClick={() => setIsQuizNavCollapsed(true)}
                      title={t('lessonPlayer.navigator.hide')}
                      className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <span className="hidden sm:inline text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {answeredCount}/{answerableQuestions.length}
                    </span>
                    <div
                      className="flex-1 min-w-0 flex flex-nowrap gap-2 overflow-x-auto py-1 scrollbar-thin"
                      style={{ justifyContent: 'safe center' }}
                    >
                      {answerableQuestions.map((q, i) => {
                        const key = getAnswerKey(q);
                        const answered = isAnswerComplete(q, quizAnswers.get(key), gapAnswers.get(key));
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => {
                              document.getElementById(`question-${q.id}`)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            title={answered ? t('lessonPlayer.navigator.answered', { number: i + 1 }) : t('lessonPlayer.navigator.unanswered', { number: i + 1 })}
                            className={`shrink-0 w-9 h-9 rounded-md text-sm font-semibold flex items-center justify-center border transition-colors ${
                              answered
                                ? 'bg-brand-solid border-brand text-brand-solid-foreground hover:bg-brand-solid-hover'
                                : `bg-transparent border-dashed ${
                                    showValidationErrors
                                      ? 'border-red-500 text-red-500 dark:text-red-400'
                                      : 'border-muted-foreground/50 text-muted-foreground'
                                  } hover:border-brand`
                            }`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckAnswersClick}
                      disabled={isQuizIncomplete}
                      title={isQuizIncomplete ? t('learning.quiz.answerAll', { answered: answeredCount, total: answerableQuestions.length }) : undefined}
                      className="shrink-0 whitespace-nowrap text-xs sm:text-sm font-medium border-brand text-brand hover:bg-brand-surface"
                    >
                      {t('lessonPlayer.quiz.checkAnswers')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
        ) : (
        <div className="flex justify-center pt-4">
          {(() => {
            const stats = getGapStatistics();
            const totalItems = stats.totalGaps + stats.regularQuestions;
            const correctItems = stats.correctGaps + stats.correctRegular;
            const scorePercentage = totalItems > 0 ? (correctItems / totalItems) * 100 : 100;
            const isPassed = scorePercentage >= passingScorePercent;

            return (
              <div className="flex flex-col items-center space-y-4">
                {!isPassed && (
                  <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg mb-4">
                    <p className="text-red-900 dark:text-red-400 font-semibold text-center">
                      {t('lessonPlayer.quiz.belowPass', { score: Math.round(scorePercentage), passing: passingScorePercent })}
                    </p>
                    <p className="text-red-800 dark:text-red-400 text-sm mt-2 text-center">
                      {t('lessonPlayer.quiz.tryAgain')}
                    </p>
                    <p className="text-red-800 dark:text-red-400 text-sm mt-2 text-center">
                      {t('lessonPlayer.quiz.answersLocked')}
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
                    {isPassed ? t('lessonPlayer.quiz.continueStep') : t('lessonPlayer.quiz.retry')}
                  </Button>

                  {(!isPassed && (import.meta.env.DEV || isTeacher)) && (
                    <Button
                      onClick={() => setShowAllAnswers(true)}
                      variant="outline"
                      className="border-green-600 dark:border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 text-lg font-semibold"
                    >
                      {t('lessonPlayer.quiz.showAnswers')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        )}
      </div>
    );
  };

  const renderQuizTitleScreen = () => {
    // Show beautiful Duolingo-style screen for all modes
    return (
      <div className="min-h-[500px] relative flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 dark:bg-none dark:bg-brand-surface dark:border dark:border-brand-border -mx-4 -my-4 p-8 rounded-lg overflow-hidden">
        <div className="absolute bottom-0 left-0 pointer-events-none z-0" aria-hidden="true">
          <img src="/logo-half.svg" alt="" className="w-64 h-64 md:w-80 md:h-80 brightness-0 invert dark:opacity-15" />
        </div>
        <div className="absolute bottom-0 right-0 pointer-events-none z-0" aria-hidden="true">
          <img src="/logo-half.svg" alt="" className="w-64 h-64 md:w-80 md:h-80 brightness-0 invert scale-x-[-1] dark:opacity-15" />
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0" aria-hidden="true">
          <img src="/logo.svg" alt="" className="w-80 h-80 md:w-96 md:h-96 brightness-0 invert dark:opacity-15" />
        </div>

        <div className="text-center space-y-6 max-w-2xl relative z-10">
          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white dark:text-brand-surface-foreground leading-tight">
              {quizData?.title || t('lessonPlayer.titleScreen.fallback')}
            </h1>
            <p className="text-[15px] md:text-[18px] text-blue-100 dark:text-muted-foreground font-light">
              {t('lessonPlayer.titleScreen.tagline')}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={startQuiz}
              className="px-10 py-4 bg-card text-foreground border border-border text-lg font-bold hover:bg-accent dark:bg-brand-solid dark:text-brand-solid-foreground dark:border-transparent dark:hover:bg-brand-solid-hover relative z-20"
            >
              {t('lessonPlayer.titleScreen.start')}
            </Button>

            <div className="inline-flex flex-wrap items-center justify-center gap-x-2 text-white dark:text-brand-surface-foreground text-base md:text-lg">
              <span className="font-medium">{t('lessonPlayer.common.questions', { count: totalQuestionCount })}</span>
              <span className="text-blue-200 dark:text-muted-foreground">{t('lessonPlayer.titleScreen.pass', { percent: passingScorePercent })}</span>
            </div>
            {(import.meta.env.DEV || isTeacher) && (
              <Button
                onClick={autoFillCorrectAnswers}
                variant="ghost"
                className="text-white dark:text-muted-foreground hover:bg-white/10 mt-2 flex items-center gap-2"
                title={isTeacher ? t('lessonPlayer.quiz.showAnswers') : t('lessonPlayer.quiz.devFillTitle')}
              >
                {isTeacher ? <HelpCircle className="w-4 h-4" aria-hidden="true" /> : <Wrench className="w-4 h-4" aria-hidden="true" />} 
                {isTeacher ? t('lessonPlayer.quiz.showAnswers') : t('lessonPlayer.quiz.devFill')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Overview of the whole quiz: one square per question, coloured once that question
  // has been answered and checked. Only questions before the current one carry a
  // verdict — the one on screen may have a selection that has not been checked yet.
  const renderQuestionMap = () => {
    if (!questions || questions.length <= 1) return null;
    return (
      <div className="pt-8 flex flex-wrap justify-center gap-1.5" aria-label={t('lessonPlayer.map.aria')}>
        {questions.map((mapQuestion: any, i: number) => {
          const key = getAnswerKey(mapQuestion);
          const isCurrent = i === currentQuestionIndex;
          let tone = 'bg-muted text-muted-foreground';
          let label = t('lessonPlayer.map.notAnswered');
          if (i < currentQuestionIndex) {
            const status = getQuestionStatus(
              mapQuestion,
              quizAnswers.get(key),
              gapAnswers.get(key),
              { isSpecialGroupStudent }
            );
            if (status.key === 'correct') {
              tone = 'bg-green-600 text-white'; label = t('lessonPlayer.map.correct');
            } else if (status.key === 'incorrect') {
              tone = 'bg-red-500 text-white'; label = t('lessonPlayer.map.incorrect');
            } else if (status.key === 'partial') {
              tone = 'bg-amber-500 text-white'; label = t('lessonPlayer.map.partial');
            } else if (status.key === 'unscored') {
              label = t('lessonPlayer.map.unscored'); // an image block: no point, never red
            } else {
              tone = 'bg-muted-foreground/40 text-white'; label = t('lessonPlayer.map.review');
            }
          }
          return (
            <span
              key={mapQuestion.id ?? i}
              title={t('lessonPlayer.map.item', { number: i + 1, state: isCurrent ? t('lessonPlayer.map.current') : label })}
              className={`h-6 w-6 rounded text-[10px] font-medium flex items-center justify-center ${tone} ${
                isCurrent ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
              }`}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
    );
  };

  const QuizConfetti = () => {
    const pieces = useMemo(
      () =>
        Array.from({ length: 40 }, (_, i) => ({
          left: Math.random() * 100,
          delay: Math.random() * 0.5,
          duration: 2.4 + Math.random() * 1.6,
          tilt: Math.random() * 360,
          color: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'][i % 5],
        })),
      []
    );
    return (
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
        {pieces.map((piece, i) => (
          <span
            key={i}
            className="quiz-confetti-piece"
            style={{
              left: `${piece.left}%`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              transform: `rotate(${piece.tilt}deg)`,
            }}
          />
        ))}
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
          <div className="bg-transparent">
            <div className="p-2 md:p-6 flex flex-col items-center">
              {q.media_url && (
                <img
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                  alt={q.question_text || t('lessonPlayer.quiz.referenceImage')}
                  className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg"
                />
              )}
              {q.question_text && (
                <p className="text-sm text-muted-foreground mt-4 text-center">{q.question_text}</p>
              )}
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex justify-center">
            <Button
              onClick={nextQuestion}
              className="px-8 py-3 bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground rounded-lg text-lg font-semibold transition-all duration-200"
            >
              {t('lessonPlayer.common.continue')}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    const userAnswer = quizAnswers.get(getAnswerKey(q));
    const displayNumber = getQuestionDisplayNumber(currentQuestionIndex);
    const questionGaps = (q.question_type === 'fill_blank' || q.question_type === 'text_completion')
      ? (q.content_text || q.question_text || '').match(/\[\[(.*?)\]\]/g)?.length || 1
      : 1;

    return (
      <div
        key={`q-${q.id}`}
        className="w-full md:max-w-4xl md:mx-auto space-y-4 md:space-y-8 md:p-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
      >
        {/* Counter only — a quiet line above the question, the same one the result view
            renders, so answering changes the answer area and nothing else. */}
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {questionCounter(displayNumber, questionGaps)}
          </div>

          {(import.meta.env.DEV || isTeacher) && (
            <div className="flex items-center gap-2">
              <Button
                onClick={autoFillCorrectAnswers}
                variant="outline"
                size="sm"
                className="text-primary border-primary/30 hover:bg-primary/10 flex items-center gap-2"
                title={isTeacher ? t('lessonPlayer.quiz.showAnswers') : t('lessonPlayer.quiz.devFillTitle')}
              >
                {isTeacher ? <HelpCircle className="w-3 h-3" aria-hidden="true" /> : <Wrench className="w-3 h-3" aria-hidden="true" />}
                {isTeacher ? t('lessonPlayer.quiz.showAnswers') : t('lessonPlayer.quiz.devFill')}
              </Button>
              {clearAllAnswers && (
                <Button
                  onClick={() => { setShowValidationErrors(false); clearAllAnswers(); }}
                  variant="outline"
                  size="sm"
                  disabled={quizAnswers.size === 0 && gapAnswers.size === 0}
                  title={t('lessonPlayer.quiz.clearAllTitle')}
                >
                  {t('lessonPlayer.quiz.clearAll')}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Exam mode badge - shown outside audio player */}
        {quizData?.quiz_media_url && quizData.quiz_media_type === 'audio' && quizData.audio_playback_mode === 'strict' && (
          <ExamModeBadge maxPlays={quizData.audio_max_plays || 2} />
        )}

        {/* Quiz-level Media for Audio/PDF/Text Quizzes */}
        {quizData?.quiz_media_url && (
          <div className="bg-transparent">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-muted/50 p-6 rounded-lg border border-border">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(quizData.quiz_media_url)) }} />
              </div>
            ) : quizData.quiz_media_type === 'pdf' ? (
              // Check if it's actually a PDF or an image
              quizData.quiz_media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <ZoomableImage
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}`}
                  alt={t('lessonPlayer.quiz.referenceMaterial')}
                />
              ) : (
                <div className="border border-border rounded-lg bg-muted/50">
                  <div className="w-full h-[clamp(400px,70vh,800px)] border border-border rounded-lg">
                    <iframe
                      src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full"
                      title={t('lessonPlayer.quiz.questionPdf')}
                    />
                  </div>
                </div>
              )
            ) : null}
          </div>
        )}

        <div
          id={`question-${q.id}`}
          className="relative overflow-visible bg-transparent"
          onMouseUp={() => handleTextSelection(q.id.toString())}
          onClick={handleHighlightedTextClick}
        >
          {renderHighlightPalette(q.id.toString())}
          <div className="p-2 md:p-6">
            {/* Media Attachment for Media Questions */}
            {(q.question_type === 'media_question' || q.question_type === 'media_open_question') && q.media_url && (
              <div className="mb-4">
                {q.media_type === 'pdf' ? (
                  <iframe
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-64 border border-border rounded-lg"
                    title={t('lessonPlayer.quiz.questionPdf')}
                  />
                ) : (
                  <ZoomableImage
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                    alt={t('lessonPlayer.quiz.questionMedia')}
                  />
                )}
              </div>
            )}

            {/* Content Text */}
            {hasVisibleContent(q.content_text) && q.question_type !== 'text_completion' && q.question_type !== 'fill_blank' && (
              <div className="bg-muted/40 p-4 rounded-lg mb-4 border border-border/60">
                <div
                  className="text-foreground/90 prose dark:prose-invert max-w-none select-text"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderHighlightedLatex(q.id.toString(), q.content_text)) }}
                />
              </div>
            )}

            {/* Question */}
            <h3 className="text-lg font-bold text-foreground mb-4 select-text">
              <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderHighlightedLatex(q.id.toString(), (q.question_text || '').replace(/\[\[([^\]]+)\]\]/g, '[[blank]]'))) }} />
            </h3>

            {/* Answer Input Based on Question Type */}
            {q.question_type === 'long_text' ? (
              <>
                <LongTextQuestion
                  question={q}
                  value={userAnswer}
                  onChange={(val) => handleQuizAnswer(q.id.toString(), val)}
                  disabled={false}
                />
                {isSpecialGroupStudent && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                    {t('lessonPlayer.quiz.teacherReview')}
                  </p>
                )}
              </>
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
                questionId={q.id.toString()}
                highlights={getQuestionHighlights(q.id.toString())}
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
                crossedOut={crossedOutByQuestion.get(q.id.toString())}
                onCrossOut={(idx) => toggleCrossOut(q.id.toString(), idx)}
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
                questionId={q.id.toString()}
                highlights={getQuestionHighlights(q.id.toString())}
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
            disabled={!isAnswerComplete(q, quizAnswers.get(getAnswerKey(q)), gapAnswers.get(getAnswerKey(q)))}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {q.question_type === 'short_answer' || q.question_type === 'media_open_question' || q.question_type === 'long_text'
              ? t('lessonPlayer.quiz.submitToTeacher')
              : t('lessonPlayer.quiz.checkAnswer')}
          </Button>
        </div>

        {renderQuestionMap()}
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

    return (
      <div className="w-full md:max-w-4xl md:mx-auto space-y-4 md:space-y-8 md:p-6">
        {/* Counter only — no progress bar, matching the question view. */}
        <div className="text-sm text-muted-foreground">
          {questionCounter(displayNumber, questionGaps)}
        </div>

        {/* Exam mode badge - shown outside audio player */}
        {quizData?.quiz_media_url && quizData.quiz_media_type === 'audio' && quizData.audio_playback_mode === 'strict' && (
          <ExamModeBadge maxPlays={quizData.audio_max_plays || 2} />
        )}

        {/* Quiz-level Media for Audio/PDF/Text Quizzes */}
        {quizData?.quiz_media_url && (
          <div className="bg-transparent p-2 md:p-4 mb-4 md:mb-6">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-muted/50 p-6 rounded-lg border border-border">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(quizData.quiz_media_url)) }} />
              </div>
            ) : quizData.quiz_media_type === 'pdf' ? (
              // Check if it's actually a PDF or an image
              quizData.quiz_media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <ZoomableImage
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}`}
                  alt={t('lessonPlayer.quiz.referenceMaterial')}
                />
              ) : (
                <div className="border border-border rounded-lg bg-muted/50">
                  <div className="w-full h-[clamp(400px,70vh,800px)] border border-border rounded-lg">
                    <iframe
                      src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${quizData.quiz_media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full"
                      title={t('lessonPlayer.quiz.questionPdf')}
                    />
                  </div>
                </div>
              )
            ) : null}
          </div>
        )}

        {/* Question Review */}
        <div className="bg-transparent overflow-hidden">
          <div className="p-3 md:p-8">
            {/* Media Attachment for Media Questions */}
            {(question.question_type === 'media_question' || question.question_type === 'media_open_question') && question.media_url && (
              <div className="mb-4">
                {question.media_type === 'pdf' ? (
                  <iframe
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${question.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-64 border border-border rounded-lg"
                    title={t('lessonPlayer.quiz.questionPdf')}
                  />
                ) : (
                  <ZoomableImage
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${question.media_url}`}
                    alt={t('lessonPlayer.quiz.questionMedia')}
                  />
                )}
              </div>
            )}

            {/* Content Text / Passage */}
            {hasVisibleContent(question.content_text) && question.question_type !== 'text_completion' && question.question_type !== 'fill_blank' && (
              <div className="bg-muted/40 p-4 rounded-lg mb-4 border border-border/60">
                <div className="text-foreground/90 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(question.content_text)) }} />
              </div>
            )}

            {question.question_type !== 'fill_blank' && question.question_type !== 'text_completion' && (
              <h3 className="text-xl font-bold text-foreground mb-6">
                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(question.question_text.replace(/\[\[.*?\]\]/g, ''))) }} />
              </h3>
            )}

            {question.question_type === 'short_answer' || question.question_type === 'media_open_question' ? (
              <ShortAnswerQuestion
                question={question}
                value={userAnswer}
                onChange={() => {}}
                disabled={true}
                showResult={true}
                revealCorrect={canRevealCorrectAnswers(false)}
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
                revealCorrect={canRevealCorrectAnswers(false)}
              />
            ) : (
              /* Fill-in-the-gaps Review */
              <div className="p-6 rounded-xl border-2 bg-muted/40 border-border">
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
                        revealCorrect={canRevealCorrectAnswers(false)}
                      />
                    );
                  } else {
                    // Text completion fallback or implementation
                    const parts = (question.content_text || question.question_text || '').split(/\[\[(.*?)\]\]/g);
                    let gapIndex = 0;
                    return (
                      <div className="text-lg leading-relaxed text-foreground">
                        {parts.map((part: string, i: number) => {
                          const isGap = i % 2 === 1;
                          if (!isGap) {
                            return <span key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(part)) }} />;
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
                              {userAnswer || t('lessonPlayer.quiz.gap', { number: idx + 1 })}
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

            {/* Explanation — neutral surface, no icon, eased in so it reads as a reveal
                rather than a jump. Respects prefers-reduced-motion via motion-safe. */}
            {question.explanation && (
              <div className="mt-8 p-6 bg-muted/40 rounded-xl border border-border motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
                <h5 className="text-sm font-semibold text-foreground mb-2">{t('lessonPlayer.quiz.explanation')}</h5>
                <div className="text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(question.explanation)) }} />
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
              {currentQuestionIndex < questions.length - 1 ? t('lessonPlayer.quiz.nextQuestion') : t('lessonPlayer.quiz.finish')}
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
            </span>
          </Button>
        </div>

        {renderQuestionMap()}
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
          <h1 className="text-3xl font-bold text-foreground">
            {t('lessonPlayer.pending.title')}
          </h1>
          <div className="p-4 md:p-8 rounded-2xl border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
             <ClipboardList className="mx-auto mb-4 h-12 w-12 text-yellow-700 dark:text-yellow-400" strokeWidth={1.5} aria-hidden="true" />
             <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-400 mb-2">{t('lessonPlayer.pending.subtitle')}</h2>
             <p className="text-yellow-700 dark:text-yellow-400">
               {t('lessonPlayer.pending.body')}
             </p>
          </div>
          <div className="flex justify-center">
             <Button onClick={goToNextStep} className="bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground">
               {t('lessonPlayer.quiz.continueStep')}
             </Button>
          </div>
        </div>
      );
    }

    const stats = getGapStatistics();

    // Calculate total "items" (gaps + regular questions)
    const totalItems = stats.totalGaps + stats.regularQuestions;
    const correctItems = stats.correctGaps + stats.correctRegular;

    // Only treat as teacher-graded when the quiz actually has long_text questions
    // (those require manual review). Auto-graded quizzes have is_graded=true too,
    // but that doesn't mean a teacher manually assigned the score.
    const hasTeacherScore = Boolean(
      hasLongText &&
      quizAttempt &&
      quizAttempt.is_graded &&
      quizAttempt.score_percentage !== undefined
    );

    // For graded quizzes (especially long text), use the teacher-assigned score
    // Otherwise calculate from correct/total
    const percentage = hasTeacherScore
      ? Math.round(quizAttempt.score_percentage)
      : (totalItems > 0 ? Math.round((correctItems / totalItems) * 100) : 100);
    const displayedCorrectItems = hasTeacherScore && totalItems > 0
      ? Math.max(0, Math.min(totalItems, Math.round((percentage / 100) * totalItems)))
      : correctItems;
    const displayedIncorrectItems = Math.max(0, totalItems - displayedCorrectItems);
    const isPassed = percentage >= passingScorePercent;

    const getReviewStatusForQuestion = (q: any): { key: ReviewStatusKey; label: string; className: string } => {
      const key = getAnswerKey(q);
      const status = getQuestionStatus(
        q,
        quizAnswers.get(key),
        gapAnswers.get(key),
        { isSpecialGroupStudent },
        locale
      );
      return { key: status.key as ReviewStatusKey, label: status.label, className: status.className };
    };

    if (showAllAnswers) {
      return (
        <div className="w-full md:max-w-4xl md:mx-auto space-y-4 md:space-y-6 md:p-4">
          <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-4 mb-2">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">{t('lessonPlayer.answers.title')}</h2>
              <p className="text-muted-foreground">{t('lessonPlayer.answers.subtitle')}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() => setShowAllAnswers(false)}
                variant="outline"
                className="px-4 py-2 text-sm"
              >
                {t('lessonPlayer.answers.back')}
              </Button>
              {!hasLongText && !singleAttempt && (
                <Button
                  onClick={resetQuiz}
                  className="px-4 py-2 text-sm"
                >
                  {t('lessonPlayer.quiz.retake')}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => {
              if (q.question_type === 'image_content') return null

              const userAnswer = quizAnswers.get(getAnswerKey(q));
              const displayNumber = getQuestionDisplayNumber(idx);
              const questionGaps = (q.question_type === 'fill_blank' || q.question_type === 'text_completion')
                ? (q.content_text || q.question_text || '').match(/\[\[(.*?)\]\]/g)?.length || 1
                : 1;
              const reviewStatus = getReviewStatusForQuestion(q);

              return (
                <div key={q.id} className="rounded-xl border border-border/60 bg-background/30">
                  <div className="p-3 md:p-6">
                    {/* Question Number Badge */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        {questionCounter(displayNumber, questionGaps)}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${reviewStatus.className}`}>
                        {reviewStatus.label}
                      </span>
                    </div>

                    {/* Media Attachment for Media Questions */}
                    {(q.question_type === 'media_question' || q.question_type === 'media_open_question') && q.media_url && (
                      <div className="mb-4">
                        {q.media_type === 'pdf' ? (
                          <iframe
                            src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                            className="w-full h-64 border rounded-lg"
                            title={t('lessonPlayer.quiz.questionPdf')}
                          />
                        ) : (
                          <ZoomableImage
                            src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                            alt={t('lessonPlayer.quiz.questionMedia')}
                          />
                        )}
                      </div>
                    )}

                    {/* Content Text */}
                    {hasVisibleContent(q.content_text) && q.question_type !== 'text_completion' && q.question_type !== 'fill_blank' && (
                      <div className="bg-muted/40 p-4 rounded-lg mb-4 border border-border/60">
                        <div className="text-foreground/90 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.content_text)) }} />
                      </div>
                    )}

                    {/* Question */}
                    <h3 className="text-lg font-bold text-foreground mb-4">
                      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex((q.question_text || '').replace(/\[\[([^\]]+)\]\]/g, '[[blank]]'))) }} />
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
                        revealCorrect={canRevealCorrectAnswers(isPassed)}
                      />
                    ) : q.question_type === 'text_completion' ? (
                      <TextCompletionQuestion
                        question={q}
                        answers={gapAnswers.get(q.id.toString()) || []}
                        onAnswerChange={() => {}}
                        disabled={true}
                        showResult={true}
                        revealCorrect={canRevealCorrectAnswers(isPassed)}
                      />
                    ) : q.question_type === 'single_choice' || q.question_type === 'multiple_choice' || q.question_type === 'media_question' ? (
                      <ChoiceQuestion
                        question={q}
                        value={userAnswer}
                        onChange={() => {}}
                        disabled={true}
                        showResult={true}
                        revealCorrect={canRevealCorrectAnswers(isPassed)}
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
                        revealCorrect={canRevealCorrectAnswers(isPassed)}
                      />
                    )}

                    {q.explanation && (
                      <div className="mt-4 space-y-3">
                        <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
                          <p className="text-sm font-medium text-brand-subtle-foreground mb-1">{t('lessonPlayer.quiz.explanationLabel')}</p>
                          <div className="text-brand-subtle-foreground dark:text-brand-surface-foreground text-sm prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.explanation)) }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pb-8" />
        </div>
      );
    }

    const previousAttempts = attemptsHistory.slice(0, -1);
    const previousAttempt = previousAttempts.length > 0 ? previousAttempts[previousAttempts.length - 1] : null;
    const scoreDiff = previousAttempt ? percentage - Math.round(previousAttempt.score_percentage) : null;

    const formatDate = (dateStr: string) => formatDay(dateStr, { month: 'short', day: 'numeric' }, locale);

    const chartData = attemptsHistory.map((a: any, i: number) => ({
      attempt: i + 1,
      score: Math.round(a.score_percentage),
      date: a.completed_at ? formatDate(a.completed_at) : `#${i + 1}`,
    }));

    return (
      <div className="w-full max-w-3xl mx-auto text-center space-y-4 py-6 md:py-10">
        {isPassed && <QuizConfetti />}
        <h2 className="text-3xl font-bold text-foreground">
          {isPassed ? t('lessonPlayer.result.passed') : t('lessonPlayer.result.notPassed')}
        </h2>
        <p className="text-base text-muted-foreground">
          {isPassed ? t('lessonPlayer.result.passedSub') : t('lessonPlayer.result.notPassedSub')}
        </p>

        <div className="w-full p-6 md:p-8 rounded-2xl bg-card border border-border/70">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <div className={`text-6xl font-bold ${
                isPassed ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
              }`}>
                {percentage}%
              </div>
              <p className="text-lg text-muted-foreground">
                {hasTeacherScore
                  ? t('lessonPlayer.result.graded')
                  : t('lessonPlayer.result.correctOf', { correct: displayedCorrectItems, count: totalItems })}
              </p>

              {scoreDiff !== null && scoreDiff > 0 && (
                <p className="text-base font-medium text-green-600 dark:text-green-400">
                  {t('lessonPlayer.result.better', { diff: scoreDiff })}
                </p>
              )}
              {scoreDiff !== null && scoreDiff < 0 && (
                <p className="text-base font-medium text-muted-foreground">
                  {t('lessonPlayer.result.worse', { diff: scoreDiff })}
                </p>
              )}
              {scoreDiff !== null && scoreDiff === 0 && (
                <p className="text-base text-muted-foreground">
                  {t('lessonPlayer.result.same')}
                </p>
              )}

              {!isPassed && (
                <p className="text-base text-muted-foreground">
                  {t('lessonPlayer.result.needAtLeast', { percent: passingScorePercent })}
                </p>
              )}
            </div>

            {hasTeacherScore ? (
              <div className="rounded-lg p-4 bg-muted/50 text-center max-w-sm mx-auto">
                <div className="text-base text-muted-foreground">{t('lessonPlayer.result.graded')}</div>
                <div className="text-2xl font-bold text-foreground mt-1">{percentage}%</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                <div className="rounded-lg p-3 bg-muted/50 text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{displayedCorrectItems}</div>
                  <div className="text-base text-muted-foreground">{t('lessonPlayer.result.correct')}</div>
                </div>
                <div className="rounded-lg p-3 bg-muted/50 text-center">
                  <div className="text-2xl font-bold text-red-500 dark:text-red-400">{displayedIncorrectItems}</div>
                  <div className="text-base text-muted-foreground">{t('lessonPlayer.result.incorrect')}</div>
                </div>
                <div className="rounded-lg p-3 bg-muted/50 text-center">
                  <div className="text-2xl font-bold text-foreground">{totalItems}</div>
                  <div className="text-base text-muted-foreground">{t('lessonPlayer.result.total')}</div>
                </div>
              </div>
            )}

            {chartData.length === 1 && (
              <p className="text-base text-muted-foreground text-center">{t('lessonPlayer.result.firstAttempt')}</p>
            )}

            {chartData.length > 1 && (
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3 text-left">{t('lessonPlayer.result.attempts')}</h3>
                <table className="sr-only">
                  <caption>{t('lessonPlayer.result.historyCaption')}</caption>
                  <thead>
                    <tr><th>{t('lessonPlayer.result.colAttempt')}</th><th>{t('lessonPlayer.result.colDate')}</th><th>{t('lessonPlayer.result.colScore')}</th></tr>
                  </thead>
                  <tbody>
                    {chartData.map((row: any) => (
                      <tr key={row.attempt}>
                        <td>{row.attempt}</td>
                        <td>{row.date}</td>
                        <td>{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                      formatter={(value: number) => [`${value}%`, t('lessonPlayer.result.tooltipScore')]}
                      labelFormatter={(_label: string, payload: readonly any[]) => {
                        if (payload && payload[0]) {
                          return t('lessonPlayer.result.tooltipLabel', { number: payload[0].payload.attempt, date: payload[0].payload.date });
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
          <div className="w-full p-5 rounded-2xl bg-card border border-border/70 text-left">
            <h3 className="text-sm font-semibold text-foreground mb-1">{t('lessonPlayer.result.feedback')}</h3>
            <div className="text-sm text-muted-foreground prose dark:prose-invert max-w-none">
              <p>{quizAttempt.feedback}</p>
            </div>
          </div>
        )}

        {isPassed && continueAction && (
          <div className="space-y-3 pt-2">
            <p className="text-base text-foreground">{continueAction.note}</p>
            <Button onClick={continueAction.onClick} className="min-h-[44px]">
              {continueAction.label}
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-3 flex-wrap pt-2">
          <Button onClick={reviewQuiz} variant="outline" className="min-h-[44px]">
            {t('lessonPlayer.result.review')}
          </Button>

          {canRevealCorrectAnswers(isPassed) && (
            <Button
              onClick={() => setShowAllAnswers(true)}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white min-h-[44px]"
            >
              {t('lessonPlayer.quiz.showAnswers')}
            </Button>
          )}

          {!hasLongText && !singleAttempt && (
            <Button onClick={resetQuiz} variant="outline">
              {t('lessonPlayer.quiz.retake')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const content = (() => {
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
  })();

  return (
    <>
      {content}
    </>
  );
};

export default React.memo(QuizRenderer);
