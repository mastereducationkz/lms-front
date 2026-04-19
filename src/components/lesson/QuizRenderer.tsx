import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { ChevronRight, AlertTriangle, HelpCircle } from 'lucide-react';
import { renderTextWithLatex } from '../../utils/latex';
import { applyHighlightsToHtml as applyHighlightsToHtmlShared } from '../../utils/highlightUtils';
import { parseGap } from '../../utils/gapParser';
import type { Step } from '../../types';
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
type HighlightColor = 'yellow' | 'pink' | 'blue';
type TextHighlight = { text: string; color: HighlightColor };
type ReviewStatusKey = 'correct' | 'incorrect' | 'partial' | 'review';

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
  isSpecialGroupStudent?: boolean;
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
    isTeacher,
    isSpecialGroupStudent = false
  } = props;

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
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [textHighlightsByQuestion, setTextHighlightsByQuestion] = useState<Map<string, TextHighlight[]>>(new Map());
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
        className="absolute z-20 flex flex-col items-center gap-2 rounded-lg border border-border bg-popover/95 p-2 shadow-lg backdrop-blur-sm"
        style={{
          right: -56,
          top: highlightPalette.selectionOffsetY
        }}
      >
        <button
          type="button"
          onClick={() => handleHighlightColorPick('yellow')}
          className="h-6 w-6 rounded-sm bg-amber-300 hover:bg-amber-400 ring-1 ring-black/10 dark:ring-white/15"
          aria-label="Highlight text with yellow"
        />
        <button
          type="button"
          onClick={() => handleHighlightColorPick('pink')}
          className="h-6 w-6 rounded-sm bg-pink-300 hover:bg-pink-400 ring-1 ring-black/10 dark:ring-white/15"
          aria-label="Highlight text with pink"
        />
        <button
          type="button"
          onClick={() => handleHighlightColorPick('blue')}
          className="h-6 w-6 rounded-sm bg-sky-300 hover:bg-sky-400 ring-1 ring-black/10 dark:ring-white/15"
          aria-label="Highlight text with blue"
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

    return (
      <div className="w-full md:max-w-3xl md:mx-auto space-y-4 md:space-y-6 md:p-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Quick Practice</h2>
          <p className="text-muted-foreground">Answer all questions below to continue</p>

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
          <div className="bg-transparent">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-muted/50 p-6 rounded-lg border border-border">
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
                <div className="border border-border rounded-lg bg-muted/50">
                  <div className="w-full h-[800px] border border-border rounded-lg">
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
                <div key={q.id} id={`question-${q.id}`} className="bg-transparent">
                  <div className="p-2 md:p-6 flex flex-col items-center">
                    {q.media_url && (
                      <img
                        src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                        alt={q.question_text || "Reference image"}
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
                className="relative overflow-visible bg-transparent"
                onMouseUp={() => handleTextSelection(q.id.toString())}
                onClick={handleHighlightedTextClick}
              >
                {renderHighlightPalette(q.id.toString())}
                <div className="p-2 md:p-6">
                  {/* Question Number Badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      Question{questionGaps > 1 ? 's' : ''} {displayNumber}{questionGaps > 1 ? `-${displayNumber + questionGaps - 1}` : ''} of {totalQuestionCount}
                    </span>
                  </div>

                  {/* Media Attachment for Media Questions */}
                  {(q.question_type === 'media_question' || q.question_type === 'media_open_question') && q.media_url && (
                    <div className="mb-4">
                      {q.media_type === 'pdf' ? (
                        <iframe
                          src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                          className="w-full h-64 border border-border rounded-lg"
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
                    <div className="bg-muted/40 p-4 rounded-lg mb-4 border border-border/60">
                      <div
                        className="text-foreground/90 prose dark:prose-invert max-w-none select-text"
                        dangerouslySetInnerHTML={{ __html: renderHighlightedLatex(q.id.toString(), q.content_text) }}
                      />
                    </div>
                  )}

                  {/* Question */}
                  <h3 className="text-lg font-bold text-foreground mb-4 select-text">
                    <span dangerouslySetInnerHTML={{ __html: renderHighlightedLatex(q.id.toString(), (q.question_text || '').replace(/\[\[([^\]]+)\]\]/g, '[[blank]]')) }} />
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
              <div className="relative bg-card rounded-xl border border-border shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto pointer-events-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Report an Error</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Found a mistake in this question? Please describe the error and suggest the correct answer.
                </p>
                
                {/* Error description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    What's wrong? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    placeholder="Describe the error (e.g., the marked answer is incorrect, there's a typo, the question is unclear)..."
                    className="w-full h-24 p-3 border border-input rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-background text-foreground"
                  />
                </div>
                
                {/* Suggested correct answer */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground mb-1">
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
                              <span className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(opt.text || opt) }} />
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
                                <span className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(optText) }} />
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
                        className="w-full p-3 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-background text-foreground"
                      />
                    );
                  })()}
                  <p className="text-xs text-muted-foreground mt-1">Optional but helpful for review</p>
                </div>
                
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setReportModalOpen(false);
                      setReportMessage('');
                      setReportSuggestedAnswer('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors"
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

        <AlertDialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit task for teacher review?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to submit this task? After submission, it will be sent to your teacher for review.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDialogConfirmSubmission}>
                Submit task
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Action Buttons */}
        <div className="flex justify-center pt-4">
          {!feedChecked ? (
            <Button
              onClick={handleConfirmQuizSubmission}
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
                if (q.question_type === 'multiple_choice') {
                  const need = Array.isArray(q.correct_answer) ? q.correct_answer.length : 1;
                  const selected = Array.isArray(ans) ? ans.length : 0;
                  return !Array.isArray(ans) || selected !== need;
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
                if (q.question_type === 'multiple_choice') {
                  const need = Array.isArray(q.correct_answer) ? q.correct_answer.length : 1;
                  const selected = Array.isArray(ans) ? ans.length : 0;
                  return !Array.isArray(ans) || selected !== need;
                }
                return ans === undefined;
              })
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white transition-all"
              }`}
            >
              Check All Answers
            </Button>
          ) : (() => {
            const stats = getGapStatistics();
            const totalItems = stats.totalGaps + stats.regularQuestions;
            const correctItems = stats.correctGaps + stats.correctRegular;
            const scorePercentage = totalItems > 0 ? (correctItems / totalItems) * 100 : 100;
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
              className="px-10 py-4 bg-card text-foreground border border-border text-lg font-bold hover:bg-accent relative z-20"
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
          <div className="bg-transparent">
            <div className="p-2 md:p-6 flex flex-col items-center">
              {q.media_url && (
                <img
                  src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${q.media_url}`}
                  alt={q.question_text || "Reference image"}
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
          <h2 className="text-2xl font-bold text-foreground">Quiz Question</h2>
          <p className="text-muted-foreground">
            Question{questionGaps > 1 ? 's' : ''} {displayNumber}{questionGaps > 1 ? `-${displayNumber + questionGaps - 1}` : ''} of {totalQuestionCount}
          </p>
          {(import.meta.env.DEV || isTeacher) && (
            <Button
              onClick={autoFillCorrectAnswers}
              variant="outline"
              size="sm"
              className="mt-2 text-primary border-primary/30 hover:bg-primary/10 flex items-center gap-2 mx-auto"
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
          <div className="bg-transparent">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-muted/50 p-6 rounded-lg border border-border">
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
                <div className="border border-border rounded-lg bg-muted/50">
                  <div className="w-full h-[800px] border border-border rounded-lg">
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
              <div className="bg-muted/40 p-4 rounded-lg mb-4 border border-border/60">
                <div
                  className="text-foreground/90 prose dark:prose-invert max-w-none select-text"
                  dangerouslySetInnerHTML={{ __html: renderHighlightedLatex(q.id.toString(), q.content_text) }}
                />
              </div>
            )}

            {/* Question */}
            <h3 className="text-lg font-bold text-foreground mb-4 select-text">
              <span dangerouslySetInnerHTML={{ __html: renderHighlightedLatex(q.id.toString(), (q.question_text || '').replace(/\[\[([^\]]+)\]\]/g, '[[blank]]')) }} />
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
                    This question requires teacher review. Your answer will be saved without grading.
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
              if (q.question_type === 'multiple_choice') {
                const need = Array.isArray(q.correct_answer) ? q.correct_answer.length : 1;
                const selected = Array.isArray(ans) ? ans.length : 0;
                return !Array.isArray(ans) || selected !== need;
              }
              return ans === undefined;
            })()}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {q.question_type === 'short_answer' || q.question_type === 'media_open_question' || q.question_type === 'long_text'
              ? 'Submit to Teacher'
              : 'Check Answer'}
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
            <span className="text-lg font-semibold text-foreground">
              Question{questionGaps > 1 ? 's' : ''} {displayNumber}{questionGaps > 1 ? `-${currentEndNumber}` : ''} of {totalQuestionCount}
            </span>
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {Math.round(progress)}% Complete
            </span>
          </div>

          <div className="w-full bg-muted rounded-full h-3 shadow-inner">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
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
          <div className="bg-transparent p-2 md:p-4 mb-4 md:mb-6">
            {quizData.quiz_media_type === 'audio' ? (
              <AudioPlayer
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizData.quiz_media_url}
                mode={quizData.audio_playback_mode || 'flexible'}
                maxPlays={quizData.audio_max_plays || 2}
              />
            ) : quizData.quiz_media_type === 'text' ? (
              <div className="prose prose-lg dark:prose-invert max-w-none bg-muted/50 p-6 rounded-lg border border-border">
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
                <div className="border border-border rounded-lg bg-muted/50">
                  <div className="w-full h-[800px] border border-border rounded-lg">
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
        <div className="bg-transparent overflow-hidden">
          <div className="p-3 md:p-8">
            {/* Media Attachment for Media Questions */}
            {(question.question_type === 'media_question' || question.question_type === 'media_open_question') && question.media_url && (
              <div className="mb-4">
                {question.media_type === 'pdf' ? (
                  <iframe
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${question.media_url}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-64 border border-border rounded-lg"
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
              <div className="bg-muted/40 p-4 rounded-lg mb-4 border border-border/60">
                <div className="text-foreground/90 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(question.content_text) }} />
              </div>
            )}

            {question.question_type !== 'fill_blank' && question.question_type !== 'text_completion' && (
              <h3 className="text-xl font-bold text-foreground mb-6">
                <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex(question.question_text.replace(/\[\[.*?\]\]/g, '')) }} />
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
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700/40">
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
          <h1 className="text-3xl font-bold text-foreground">
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
    
    const hasTeacherScore = Boolean(
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
    const isPassed = percentage >= 50;

    const getReviewStatusForQuestion = (q: any): { key: ReviewStatusKey; label: string; className: string } => {
      const currentUserAnswer = quizAnswers.get(q.id);
      const successClassName = 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      const errorClassName = 'border border-rose-500/30 bg-rose-500/10 text-rose-400';
      const partialClassName = 'border border-amber-500/30 bg-amber-500/10 text-amber-400';
      const reviewClassName = 'border border-border bg-muted text-muted-foreground';

      if (q.question_type === 'long_text') {
        return { key: 'review', label: 'Needs review', className: reviewClassName };
      }

      if (q.question_type === 'short_answer' || q.question_type === 'media_open_question') {
        const allowedAnswers = (q.correct_answer || '')
          .toString()
          .split('|')
          .map((answer: string) => answer.trim().toLowerCase())
          .filter((answer: string) => answer.length > 0);
        const normalizedUserAnswer = (currentUserAnswer || '').toString().trim().toLowerCase();
        const isCorrectAnswer = allowedAnswers.includes(normalizedUserAnswer);
        return isCorrectAnswer
          ? { key: 'correct', label: 'Correct', className: successClassName }
          : { key: 'incorrect', label: 'Incorrect', className: errorClassName };
      }

      if (q.question_type === 'single_choice' || q.question_type === 'media_question') {
        const isCorrectAnswer = currentUserAnswer === q.correct_answer;
        return isCorrectAnswer
          ? { key: 'correct', label: 'Correct', className: successClassName }
          : { key: 'incorrect', label: 'Incorrect', className: errorClassName };
      }

      if (q.question_type === 'multiple_choice') {
        const selectedAnswers = Array.isArray(currentUserAnswer) ? [...currentUserAnswer].sort() : [];
        const expectedAnswers = Array.isArray(q.correct_answer) ? [...q.correct_answer].sort() : [];
        const overlapCount = selectedAnswers.filter((answer) => expectedAnswers.includes(answer)).length;
        const isCorrectAnswer = selectedAnswers.length === expectedAnswers.length &&
          selectedAnswers.every((answer, index) => answer === expectedAnswers[index]);

        if (isCorrectAnswer) {
          return { key: 'correct', label: 'Correct', className: successClassName };
        }

        if (overlapCount > 0) {
          return { key: 'partial', label: 'Partially correct', className: partialClassName };
        }

        return { key: 'incorrect', label: 'Incorrect', className: errorClassName };
      }

      if (q.question_type === 'fill_blank' || q.question_type === 'text_completion') {
        const sourceText = q.content_text || q.question_text || '';
        const gapTokens = sourceText.match(/\[\[(.*?)\]\]/g) || [];
        const parsedExpectedAnswers = q.question_type === 'fill_blank'
          ? gapTokens.map((token: string) => {
              const parsed = parseGap(token.replace('[[', '').replace(']]', ''), q.gap_separator || ',');
              return (parsed.correctOption || '').toString();
            })
          : [];
        const expectedAnswersRaw = parsedExpectedAnswers.length > 0
          ? parsedExpectedAnswers
          : (Array.isArray(q.correct_answer) ? q.correct_answer : (q.correct_answer ? [q.correct_answer] : []));
        const expectedAnswers = expectedAnswersRaw.map((answer: any) => (answer || '').toString().trim().toLowerCase());
        const typedAnswersRaw = gapAnswers.get(q.id.toString()) || [];
        const typedAnswers = typedAnswersRaw.map((answer) => (answer || '').toString().trim().toLowerCase());
        const gapsCount = Math.max(expectedAnswers.length, typedAnswers.length);
        if (gapsCount === 0) {
          return { key: 'incorrect', label: 'Incorrect', className: errorClassName };
        }

        let correctGapsCount = 0;
        for (let gapIndex = 0; gapIndex < gapsCount; gapIndex++) {
          if (typedAnswers[gapIndex] && typedAnswers[gapIndex] === expectedAnswers[gapIndex]) {
            correctGapsCount += 1;
          }
        }

        if (correctGapsCount === gapsCount) {
          return { key: 'correct', label: 'Correct', className: successClassName };
        }

        if (correctGapsCount > 0) {
          return { key: 'partial', label: `${correctGapsCount}/${gapsCount} correct`, className: partialClassName };
        }

        return { key: 'incorrect', label: 'Incorrect', className: errorClassName };
      }

      if (q.question_type === 'matching') {
        const matchingAnswers = quizAnswers.get(q.id.toString());
        const asMap = matchingAnswers instanceof Map
          ? matchingAnswers
          : new Map<number, number>(
            Object.entries((matchingAnswers || {}) as Record<string, number>).map(([key, value]) => [Number(key), Number(value)])
          );
        const totalPairs = q.matching_pairs?.length || asMap.size || 0;
        const correctPairsCount = Array.from(asMap.entries()).filter(([leftIdx, rightIdx]) => leftIdx === rightIdx).length;

        if (totalPairs > 0 && correctPairsCount === totalPairs) {
          return { key: 'correct', label: 'Correct', className: successClassName };
        }

        if (correctPairsCount > 0) {
          return { key: 'partial', label: `${correctPairsCount}/${totalPairs} correct`, className: partialClassName };
        }

        return { key: 'incorrect', label: 'Incorrect', className: errorClassName };
      }

      return { key: 'review', label: 'Needs review', className: reviewClassName };
    };

    if (showAllAnswers) {
      return (
        <div className="w-full md:max-w-4xl md:mx-auto space-y-4 md:space-y-6 md:p-4">
          <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-4 mb-2">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Correct Answers</h2>
              <p className="text-muted-foreground">Review your answers below</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() => setShowAllAnswers(false)}
                variant="outline"
                className="px-4 py-2 text-sm"
              >
                Back to Results
              </Button>
              {!hasLongText && (
                <Button
                  onClick={resetQuiz}
                  className="px-4 py-2 text-sm"
                >
                  Retake Quiz
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => {
              if (q.question_type === 'image_content') return null

              const userAnswer = quizAnswers.get(q.id);
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
                        Question{questionGaps > 1 ? 's' : ''} {displayNumber}{questionGaps > 1 ? `-${displayNumber + questionGaps - 1}` : ''} of {totalQuestionCount}
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
                      <div className="bg-muted/40 p-4 rounded-lg mb-4 border border-border/60">
                        <div className="text-foreground/90 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.content_text) }} />
                      </div>
                    )}

                    {/* Question */}
                    <h3 className="text-lg font-bold text-foreground mb-4">
                      <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex((q.question_text || '').replace(/\[\[([^\]]+)\]\]/g, '[[blank]]')) }} />
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

          <div className="pb-8" />
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

        <div className="w-full p-6 md:p-8 rounded-2xl bg-card border border-border/70">
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <div className={`text-6xl font-bold ${
                isPassed ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
              }`}>
                {percentage}%
              </div>
              <p className="text-lg text-muted-foreground">
                {displayedCorrectItems} out of {totalItems} {totalItems === 1 ? 'answer' : 'answers'} correct
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
              <div className="rounded-lg p-3 bg-muted/50 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{displayedCorrectItems}</div>
                <div className="text-base text-muted-foreground">Correct</div>
              </div>
              <div className="rounded-lg p-3 bg-muted/50 text-center">
                <div className="text-2xl font-bold text-red-500 dark:text-red-400">{displayedIncorrectItems}</div>
                <div className="text-base text-muted-foreground">Incorrect</div>
              </div>
              <div className="rounded-lg p-3 bg-muted/50 text-center">
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
          <div className="w-full p-5 rounded-2xl bg-card border border-border/70 text-left">
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

export default QuizRenderer;
