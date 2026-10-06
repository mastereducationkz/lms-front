import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { DailyQuestionsEmptyState } from './DailyQuestionsEmptyState';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import type { DailyQuestionsRecommendations } from '../types';
import {
  collectUsableQuestions,
  dailyQuestionsView,
  difficultyLabel,
  formatTag,
  isMultipleChoice,
  questionOptions,
  shouldCacheRecommendations,
  usableQuestions,
  type QuestionWithSection,
} from '../lib/dailyQuestions';
import QuietBoundary from './QuietBoundary';
import {
  attention,
  dailyQuestionsAutoOpenedKey,
  dailyQuestionsDay,
  mayAutoOpenDailyQuestions,
  useAttention,
} from '../lib/attention';
import { AlertCircle, Check, X, Loader2 } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface DailyQuestionsPopupProps {
  controlled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete?: () => void;
}

/** «uid:day» pairs whose auto-open was already decided this page load (AppLayout remounts on navigation). */
const autoDecided = new Set<string>();

const readFlag = (store: 'localStorage' | 'sessionStorage', key: string) => {
  try {
    return window[store].getItem(key) !== null;
  } catch {
    return false;
  }
};

function DailyQuestionsPopupInner({ 
  controlled = false, 
  isOpen = false, 
  onOpenChange,
  onComplete 
}: DailyQuestionsPopupProps = {}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allQuestions, setAllQuestions] = useState<QuestionWithSection[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  // HTTP status of the last failed fetch, or null when the last attempt didn't fail.
  // Feeds dailyQuestionsView() — a 404 gets the same empty state as a 200 with no
  // usable questions, since both mean "no SAT data yet" for this student.
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { pathname } = useLocation();
  const queue = useAttention(user);
  // Auto mode: questions are ready and waiting for the one-popup queue's slot.
  const [wants, setWants] = useState(false);
  const decideKey = user ? `${user.id}:${dailyQuestionsDay()}` : '';
  const decide = (intent: 'wants' | 'none') => {
    autoDecided.add(decideKey);
    if (intent === 'wants') setWants(true);
    attention.declare('daily_questions', intent);
  };

  // Use controlled or internal state
  const isDialogOpen = controlled ? isOpen : open;
  const setIsDialogOpen = (value: boolean) => {
    if (controlled && onOpenChange) {
      onOpenChange(value);
    } else {
      setOpen(value);
    }
  };

  const checkAndLoad = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    
    // Skip auto-load if controlled mode
    if (controlled) return;
    
    // The one-popup queue (owner, 2026-10-04): at most once a day, only on the dashboard, and only
    // when nothing else has had this visit's slot. The dashboard button always opens it.
    const day = dailyQuestionsDay();
    const allowed = mayAutoOpenDailyQuestions({
      pathname,
      autoOpenedToday: readFlag('localStorage', dailyQuestionsAutoOpenedKey(user.id, day)),
      dismissedThisSession: readFlag('sessionStorage', `daily_questions_dismissed_${user.id}_${day}`),
      completedToday: false,
    });
    if (!allowed) {
      decide('none');
      return;
    }

    try {
      setLoading(true);
      setErrorStatus(null);
      const status = await apiClient.getDailyQuestionsStatus();

      // Never open by itself just to show a finished score — the dashboard button shows it.
      if (status.completed_today) {
        setCompleted(true);
        decide('none');
        return;
      }

      // Try to load from localStorage first
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `daily_questions_${user.id}_${today}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const questions = collectUsableQuestions(parsed);

          if (questions.length > 0) {
            setAllQuestions(questions);
            decide('wants');
            setLoading(false);
            return;
          }
          // A cache entry with no usable questions (written before this fix, or between
          // the backend and frontend deploys) — drop it and fetch fresh below instead of
          // reading it back for the rest of the day.
          localStorage.removeItem(cacheKey);
        } catch (e) {
          console.warn('Failed to parse cached questions:', e);
          localStorage.removeItem(cacheKey);
        }
      }

      // Fetch recommendations from API
      const recs = await apiClient.getDailyQuestionsRecommendations();

      // Never cache an empty result — it would read back all day with no way to self-heal
      // until the cache key rolls over at midnight.
      if (shouldCacheRecommendations(recs)) {
        localStorage.setItem(cacheKey, JSON.stringify(recs));
      }

      // Clean up old cache entries (older than today)
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.startsWith(`daily_questions_${user.id}_`) && !key.endsWith(today)) {
          localStorage.removeItem(key);
        }
      });

      const questions = collectUsableQuestions(recs);

      if (questions.length > 0) {
        setAllQuestions(questions);
        decide('wants');
      } else {
        // No usable questions: stay closed (the controlled dashboard button shows the empty state).
        decide('none');
      }
    } catch (err: any) {
      console.error('Failed to load daily questions:', err);
      setErrorStatus(err?.response?.status ?? -1);

      // Still open dialog to show error in controlled mode
      if (controlled) {
        setIsDialogOpen(true);
      } else {
        decide('none');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, controlled, pathname]);

  useEffect(() => {
    // Small delay to not block initial page load (only in auto mode)
    if (controlled || !user || user.role !== 'student') return undefined;
    if (pathname !== '/dashboard' || autoDecided.has(decideKey)) {
      attention.declare('daily_questions', 'none');
      return undefined;
    }
    attention.declare('daily_questions', 'unknown'); // the lower nudges wait while it loads
    const timer = setTimeout(checkAndLoad, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkAndLoad, controlled]);

  // The queue grants the slot → open, and remember that today's auto-open is spent.
  const granted = queue.granted('daily_questions');
  useEffect(() => {
    if (controlled || !wants || !granted || open || !user) return;
    attention.take('daily_questions');
    try {
      window.localStorage.setItem(dailyQuestionsAutoOpenedKey(user.id, dailyQuestionsDay()), '1');
    } catch {
      /* storage blocked: once per page load still holds */
    }
    setWants(false);
    setOpen(true);
  }, [controlled, wants, granted, open, user]);

  // Closing frees the slot (the visit has still had its one popup).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (controlled) return;
    if (open) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      attention.release('daily_questions');
      attention.declare('daily_questions', 'none');
    }
  }, [open, controlled]);

  useEffect(() => {
    if (controlled) return undefined;
    return () => {
      attention.release('daily_questions');
      attention.declare('daily_questions', 'none');
    };
  }, [controlled]);

  // Load data when controlled dialog opens
  useEffect(() => {
    if (controlled && isOpen && allQuestions.length === 0) {
      loadQuestions();
    }
  }, [controlled, isOpen]);

  const loadQuestions = async () => {
    if (!user || user.role !== 'student') return;

    try {
      setLoading(true);
      setErrorStatus(null);

      // Start status check immediately
      const statusPromise = apiClient.getDailyQuestionsStatus();

      // Try to load from localStorage first
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `daily_questions_${user.id}_${today}`;
      const cachedData = localStorage.getItem(cacheKey);

      let recs: DailyQuestionsRecommendations | undefined;

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          // A cache entry with no usable questions (written before this fix, or between
          // the backend and frontend deploys) — ignore it and refetch below instead of
          // reading back a blank dialog for the rest of the day.
          if (usableQuestions(parsed) > 0) {
            recs = parsed;
          } else {
            localStorage.removeItem(cacheKey);
          }
        } catch (e) {
          console.warn('Failed to parse cached questions:', e);
          localStorage.removeItem(cacheKey);
        }
      }

      if (!recs) {
        recs = await apiClient.getDailyQuestionsRecommendations();
        // Never cache an empty result — see the note on shouldCacheRecommendations.
        if (shouldCacheRecommendations(recs)) {
          localStorage.setItem(cacheKey, JSON.stringify(recs));
        }

        // Clean up old cache entries
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (key.startsWith(`daily_questions_${user.id}_`) && !key.endsWith(today)) {
            localStorage.removeItem(key);
          }
        });
      }

      setAllQuestions(collectUsableQuestions(recs));

      // Await status check
      const status = await statusPromise;
      if (status.completed_today && user) {
        setCompleted(true);

        const resultsKey = `daily_questions_results_${user.id}_${today}`;
        const savedResults = localStorage.getItem(resultsKey);

        if (savedResults) {
          try {
            const parsedResults = JSON.parse(savedResults);
            if (parsedResults.answers && parsedResults.score) {
              setAnswers(parsedResults.answers);
              setScore(parsedResults.score);
              setShowResults(true);
            }
          } catch (e) {
            console.error('Failed to parse saved results', e);
          }
        } else if (status.score != null && status.total_questions != null) {
             setScore({ correct: status.score, total: status.total_questions });
             setShowResults(true);
        }
      }
    } catch (err: any) {
      console.error('Failed to load daily questions:', err);
      // Keep the HTTP status so the empty state (404 = "no SAT data yet" on the old
      // backend) is distinguishable from a real failure — see dailyQuestionsView.
      setErrorStatus(err?.response?.status ?? -1);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    if (user) {
      const dismissedKey = `daily_questions_dismissed_${user.id}_${new Date().toISOString().split('T')[0]}`;
      sessionStorage.setItem(dismissedKey, 'true');
    }
    setDismissed(true);
    setIsDialogOpen(false);
  };

  const handleComplete = async () => {
    if (!user) return;
    try {
      setCompleting(true);
      
      // Calculate score by comparing answers with correctAnswer
      let correctCount = 0;
      const totalCount = allQuestions.length;
      
      allQuestions.forEach(q => {
        const userAnswer = answers[q.questionId];
        if (userAnswer && q.correctAnswer) {
          // For multiple choice, compare letter; for free text, compare trimmed lowercase
          const isMultiple = isMultipleChoice(q);
          if (isMultiple) {
            if (userAnswer.toUpperCase() === q.correctAnswer.toUpperCase()) {
              correctCount++;
            }
          } else {
            if (userAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
              correctCount++;
            }
          }
        }
      });
      
      setScore({ correct: correctCount, total: totalCount });
      
      // Save results to localStorage
      const today = new Date().toISOString().split('T')[0];
      const resultsKey = `daily_questions_results_${user.id}_${today}`;
      localStorage.setItem(resultsKey, JSON.stringify({
        answers,
        score: { correct: correctCount, total: totalCount },
        timestamp: new Date().toISOString()
      }));
      
      await apiClient.completeDailyQuestions({
        answers,
        score: correctCount,
        total_questions: totalCount,
        questions: allQuestions.map(q => ({
          questionId: q.questionId,
          section: q.section,
          primaryTag: q.primaryTag
        }))
      });
      setCompleted(true);
      setShowResults(true);
      
      // Call onComplete callback if provided
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Failed to complete daily questions:', err);
    } finally {
      setCompleting(false);
    }
  };

  const currentQuestion = allQuestions[currentIndex];
  const isLastQuestion = currentIndex === allQuestions.length - 1;
  const answeredCount = Object.keys(answers).length;


  const getSectionLabel = (section: 'math' | 'verbal') => {
    return section === 'math' ? 'Math' : 'Verbal';
  };


  const isTextEmpty = (text?: string) => {
    if (!text) return true;
    const trimmed = text.trim();
    return trimmed === '' || trimmed === '\\\\' || trimmed === '\\' || trimmed === '//';
  };

  const formatQuestionText = (text: string) => {
    // Don't process if text is empty or invalid
    if (!text || isTextEmpty(text)) return '';
    
    // Split text by LaTeX delimiters
    const parts: JSX.Element[] = [];
    let currentIndex = 0;
    let key = 0;
    
    // Regular expression to match inline math $...$ or display math $$...$$
    // Also matches \frac{}{}, \text{}, and other LaTeX commands
    const latexPattern = /\$\$(.+?)\$\$|\$(.+?)\$|\\frac\{[^}]+\}\{[^}]+\}|\\text\{([^}]+)\}|\\[a-zA-Z]+/g;
    let match;
    
    while ((match = latexPattern.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        parts.push(
          <span key={`text-${key++}`}>
            {text.substring(currentIndex, match.index)}
          </span>
        );
      }
      
      // Handle \text{...} specially - just show the content without LaTeX rendering
      if (match[0].startsWith('\\text{')) {
        const textContent = match[3] || match[0].replace(/\\text\{([^}]+)\}/, '$1');
        parts.push(<span key={`text-${key++}`}>{textContent}</span>);
        currentIndex = match.index + match[0].length;
        continue;
      }
      
      // Add the LaTeX part
      const latexContent = match[1] || match[2] || match[0];
      const isDisplayMath = match[1] !== undefined; // $$...$$ format
      
      try {
        if (isDisplayMath) {
          parts.push(<BlockMath key={`math-${key++}`} math={latexContent} />);
        } else {
          // For inline math, remove wrapping $ if present
          const cleanLatex = latexContent.replace(/^\$|\$$/g, '');
          parts.push(<InlineMath key={`math-${key++}`} math={cleanLatex} />);
        }
      } catch (e) {
        // If LaTeX parsing fails, show the original text
        console.warn('LaTeX parsing error:', e, 'for:', match[0]);
        parts.push(<span key={`error-${key++}`}>{match[0]}</span>);
      }
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(
        <span key={`text-${key++}`}>
          {text.substring(currentIndex)}
        </span>
      );
    }
    
    return parts.length > 0 ? <>{parts}</> : text;
  };

  // Don't render if not student, already completed (in auto mode), or dismissed (in auto mode)
  if (!user || user.role !== 'student') return null;
  if (!controlled && ((completed && !showResults) || dismissed)) return null;

  const view = dailyQuestionsView({
    loading,
    errorStatus,
    questionsCount: allQuestions.length,
    completedToday: completed,
  });

  return (
    <Dialog open={isDialogOpen} onOpenChange={(val) => { if (!val) handleDismiss(); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="border-b pb-4">
          <div>
            <DialogTitle className="text-xl font-semibold">Daily Questions</DialogTitle>
            <DialogDescription className="mt-1 text-sm">
              Solve these questions to improve your weak areas
            </DialogDescription>
          </div>

          {/* Progress indicator */}
          {allQuestions.length > 0 && !completed && (
            <div className="flex items-center gap-2 mt-4">
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-solid transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / allQuestions.length) * 100}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                {currentIndex + 1} / {allQuestions.length}
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Content */}
        {view === 'loading' ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <span className="ml-3 text-muted-foreground">Loading questions...</span>
          </div>
        ) : view === 'empty' ? (
          <DailyQuestionsEmptyState onDismiss={handleDismiss} />
        ) : view === 'error' ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
              <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Oops! Something went wrong</h3>
            <p className="text-muted-foreground mb-6">
              We couldn't load your daily questions right now. Please try again later.
            </p>
            <Button variant="outline" onClick={handleDismiss}>Close</Button>
          </div>
        ) : view === 'questions' && currentQuestion ? (
          <div className="pt-4">
            {/* Question metadata */}
            <div className="flex items-center gap-2 mb-4 flex-wrap text-sm">
              <span className="text-muted-foreground">{getSectionLabel(currentQuestion.section)}</span>
              <span className="text-muted-foreground/50" aria-hidden="true">•</span>
              <span className="text-muted-foreground">{difficultyLabel(currentQuestion.difficulty)}</span>
              <span className="text-muted-foreground/50" aria-hidden="true">•</span>
              <span className="text-muted-foreground">{formatTag(currentQuestion.primaryTag)}</span>
              {currentQuestion.questionType && (
                <>
                  <span className="text-muted-foreground/50" aria-hidden="true">•</span>
                  <span className="text-muted-foreground">{currentQuestion.questionType}</span>
                </>
              )}
            </div>

            {/* Passage text (for verbal questions) */}
            {currentQuestion.passageText && (
              <div className="mb-5 p-4 bg-muted/60 border border-border rounded-md max-h-[200px] overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Passage</p>
                <div 
                  className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.passageText }}
                />
              </div>
            )}

            {/* Question text */}
            {!isTextEmpty(currentQuestion.text) && (
              <div className="mb-5 text-foreground text-base leading-relaxed">
                {formatQuestionText(currentQuestion.text)}
              </div>
            )}

            {/* Question image */}
            {currentQuestion.imageUrl && (
              <div className="mb-5 rounded-md overflow-hidden border border-border bg-card">
                <img 
                  src={currentQuestion.imageUrl}
                  alt="Question"
                  className="w-full h-auto object-contain"
                  loading="lazy"
                  onError={() => {
                    console.error('Failed to load image:', currentQuestion.imageUrl);
                  }}
                />
              </div>
            )}

            {/* Answer section */}
            <div className="mb-6">
              {isMultipleChoice(currentQuestion) ? (
                // Multiple choice options
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-foreground mb-3">Choose an answer:</p>
                  <div className="space-y-2">
                    {questionOptions(currentQuestion).map(({ letter, text: optionText, imageUrl, imageAlt }) => {
                      const isSelected = answers[currentQuestion.questionId] === letter;
                      
                      return (
                        <label 
                          key={letter}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-blue-500 bg-brand-surface dark:border-brand' 
                              : 'border-border hover:border-gray-300 hover:bg-muted/60 dark:hover:border-input'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${currentQuestion.questionId}`}
                            value={letter}
                            checked={isSelected}
                            onChange={() => setAnswers(prev => ({
                              ...prev,
                              [currentQuestion.questionId]: letter
                            }))}
                            className="mt-0.5 h-4 w-4 text-brand border-gray-300 dark:border-border focus:ring-ring"
                          />
                          <span className="text-sm text-foreground flex-1">
                            <span className="font-medium text-muted-foreground mr-2">{letter}.</span>
                            {optionText.trim() ? formatQuestionText(optionText) : null}
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={imageAlt ?? `Option ${letter}`}
                                loading="lazy"
                                className="mt-2 block max-h-56 max-w-full rounded-md border border-border bg-card object-contain p-1"
                              />
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Free text input (Student Response)
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                    Your answer:
                  </label>
                  <input
                    type="text"
                    value={answers[currentQuestion.questionId] || ''}
                    onChange={(e) => setAnswers(prev => ({ 
                      ...prev, 
                      [currentQuestion.questionId]: e.target.value 
                    }))}
                    placeholder="Enter your answer..."
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-border bg-background text-foreground rounded-md focus:ring-2 focus:ring-ring focus:border-ring outline-none transition-all"
                  />
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                size="sm"
              >
                Back
              </Button>

              <span className="text-sm text-muted-foreground">
                Answered: {answeredCount} / {allQuestions.length}
              </span>

              {isLastQuestion ? (
                <Button
                  onClick={handleComplete}
                  disabled={completing}
                  size="sm"
                  className="bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground"
                >
                  {completing ? 'Saving...' : 'Complete'}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentIndex(Math.min(allQuestions.length - 1, currentIndex + 1))}
                  size="sm"
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {/* Completion state with results */}
        {completed && showResults && score && (
          <div className="pt-4">
            {/* Score header */}
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                score.correct === score.total ? 'bg-green-100 dark:bg-green-900/40' : score.correct >= score.total / 2 ? 'bg-yellow-100 dark:bg-yellow-900/40' : 'bg-red-100 dark:bg-red-900/40'
              }`}>
                <span className={`text-2xl font-bold ${
                  score.correct === score.total ? 'text-green-700 dark:text-green-400' : score.correct >= score.total / 2 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'
                }`}>
                  {score.correct}/{score.total}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {score.correct === score.total ? 'Perfect!' : score.correct >= score.total / 2 ? 'Good job!' : 'Keep practicing!'}
              </h3>
              <p className="text-sm text-muted-foreground">
                You got {score.correct} out of {score.total} questions correct
              </p>
            </div>

            {/* Per-question breakdown */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {allQuestions.map((q, idx) => {
                const userAnswer = answers[q.questionId];
                const isMultiple = isMultipleChoice(q);
                const isCorrect = userAnswer && q.correctAnswer
                  ? isMultiple
                    ? userAnswer.toUpperCase() === q.correctAnswer.toUpperCase()
                    : userAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
                  : false;
                const wasAnswered = !!userAnswer;

                return (
                  <div key={q.questionId} className={`flex items-center gap-3 p-3 rounded-lg border ${
                    !wasAnswered ? 'bg-muted/60 border-border' : isCorrect ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      !wasAnswered ? 'bg-gray-200 dark:bg-secondary' : isCorrect ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {wasAnswered ? (
                        isCorrect ? <Check className="h-3.5 w-3.5 text-white" /> : <X className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        Question {idx + 1} <span className="text-muted-foreground">•</span>{' '}
                        <span className="text-muted-foreground font-normal">{formatTag(q.primaryTag)}</span>
                      </div>
                      {!isCorrect && q.correctAnswer && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Correct answer: <span className="font-medium text-green-700 dark:text-green-400">{q.correctAnswer}</span>
                          {wasAnswered && (
                            <span className="ml-2 text-red-600 dark:text-red-400">Your answer: {userAnswer}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      q.section === 'math' ? 'bg-brand-subtle text-brand-subtle-foreground' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    }`}>
                      {q.section === 'math' ? 'Math' : 'Verbal'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Close button */}
            <div className="flex justify-center mt-6 pt-4 border-t">
              <Button onClick={() => setIsDialogOpen(false)} className="px-8">
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Simple completion state (fallback) */}
        {completed && !showResults && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Great job!</h3>
            <p className="text-sm text-muted-foreground">Daily questions completed</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The popup is optional: a crash inside it must never take the dashboard down. */
export default function DailyQuestionsPopup(props: DailyQuestionsPopupProps = {}) {
  return (
    <QuietBoundary name="daily-questions">
      <DailyQuestionsPopupInner {...props} />
    </QuietBoundary>
  );
}
