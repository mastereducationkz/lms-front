import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { ChevronLeft, ChevronRight, RotateCcw, Check, CheckCircle, Repeat, Heart } from 'lucide-react';
import type { FlashcardSet } from '../../types';
import { addFavoriteFlashcard, removeFavoriteByCardId, checkIsFavorite } from '../../services/api';
import { toast } from '../Toast';
import { useT } from '../../lib/i18n/react';
import type { MessageKey } from '../../lib/i18n';
import '@/lib/i18n/catalogs/learning';
import '@/lib/i18n/catalogs/lessonPlayer';
import { useStillLearningSave } from './useStillLearningSave';

const DIFFICULTY_LABEL: Record<string, MessageKey> = {
  easy: 'lessonPlayer.flashcards.difficultyEasy',
  normal: 'lessonPlayer.flashcards.difficultyNormal',
  hard: 'lessonPlayer.flashcards.difficultyHard',
};

interface FlashcardViewerProps {
  flashcardSet: FlashcardSet;
  onComplete?: () => void;
  onProgress?: (completed: number, total: number) => void;
  stepId?: number;
  lessonId?: number;
  courseId?: number;
}

export default function FlashcardViewer({ flashcardSet, onComplete, onProgress, stepId, lessonId, courseId }: FlashcardViewerProps) {
  const t = useT();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set());
  const [incorrectCards, setIncorrectCards] = useState<Set<string>>(new Set());
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false);
  const stillLearning = useStillLearningSave({ stepId, lessonId, courseId });

  // Ensure cards array exists and has content
  const cards = flashcardSet?.cards || [];
  const currentCard = cards[currentCardIndex];
  const progress = cards.length > 0 ? (completedCards.size / cards.length) * 100 : 0;

  // Check if current card is in favorites
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (stepId && currentCard) {
        try {
          const result = await checkIsFavorite(stepId, currentCard.id);
          setIsFavorite(result.is_favorite);
          stillLearning.remember(currentCard.id, result.is_favorite);
        } catch (error) {
          console.error('Failed to check favorite status:', error);
        }
      }
    };
    
    checkFavoriteStatus();
  }, [currentCardIndex, stepId, currentCard]);

  useEffect(() => {
    if (onProgress) {
      onProgress(completedCards.size, cards.length);
    }
  }, [completedCards.size, cards.length, onProgress]);

  useEffect(() => {
    if (cards.length > 0 && completedCards.size === cards.length && onComplete) {
      onComplete();
    }
  }, [completedCards.size, cards.length, onComplete]);

  const handleToggleFavorite = async () => {
    if (!stepId || !currentCard) {
      toast(t('lessonPlayer.flashcards.missingData'), 'error');
      return;
    }

    setIsLoadingFavorite(true);
    try {
      if (isFavorite) {
        // Remove from favorites
        await removeFavoriteByCardId(stepId, currentCard.id);
        setIsFavorite(false);
        stillLearning.remember(currentCard.id, false);
        toast(t('lessonPlayer.favorites.removed'), 'success');
      } else {
        // Add to favorites
        await addFavoriteFlashcard({
          step_id: stepId,
          flashcard_id: currentCard.id,
          lesson_id: lessonId,
          course_id: courseId,
          flashcard_data: JSON.stringify(currentCard)
        });
        setIsFavorite(true);
        stillLearning.remember(currentCard.id, true);
        toast(t('lessonPlayer.favorites.added'), 'success');
      }
    } catch (error: any) {
      console.error('Failed to toggle favorite:', error);
      toast(error.message || t('lessonPlayer.favorites.updateFailed'), 'error');
    } finally {
      setIsLoadingFavorite(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setShowingAnswer(!showingAnswer);
  };

  // «Got it» / «Still learning» steer this session: a card still being learnt comes back before
  // the deck ends, and the step completes once every card is «Got it». The first «Still learning»
  // on a card also saves it to My Flashcards (useStillLearningSave).
  const handleCorrect = () => {
    const newCompleted = new Set(completedCards);
    newCompleted.add(currentCard.id);
    setCompletedCards(newCompleted);
    
    const newIncorrect = new Set(incorrectCards);
    newIncorrect.delete(currentCard.id);
    setIncorrectCards(newIncorrect);
    
    goToNextCard(newIncorrect);
  };

  const handleIncorrect = () => {
    // The first «Still learning» on a card also keeps it in My Flashcards (never blocks the round).
    stillLearning.keep(currentCard);
    const newIncorrect = new Set(incorrectCards);
    newIncorrect.add(currentCard.id);
    setIncorrectCards(newIncorrect);
    
    goToNextCard(newIncorrect);
  };

  // Takes the updated set: reading `incorrectCards` here saw the state from before the click,
  // so a last card marked «Still learning» never came back.
  const goToNextCard = (stillLearning: Set<string> = incorrectCards) => {
    setIsFlipped(false);
    setShowingAnswer(false);
    
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      // If there are incorrect cards, cycle through them again
      const incorrectCardIds = Array.from(stillLearning);
      if (incorrectCardIds.length > 0) {
        const firstIncorrectIndex = cards.findIndex(card => incorrectCardIds.includes(card.id));
        if (firstIncorrectIndex !== -1) {
          setCurrentCardIndex(firstIncorrectIndex);
        }
      }
    }
  };

  const goToPreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
      setShowingAnswer(false);
    }
  };

  const resetProgress = () => {
    setCompletedCards(new Set());
    setIncorrectCards(new Set());
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowingAnswer(false);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
      case 'normal': return 'bg-brand-subtle text-brand-subtle-foreground';
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
  };

  if (!currentCard) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold mb-4">{t('lessonPlayer.flashcards.empty')}</h3>
        <Button onClick={onComplete}>{t('lessonPlayer.common.continue')}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">{flashcardSet.title}</h2>
        {flashcardSet.description && (
          <p className="text-muted-foreground">{flashcardSet.description}</p>
        )}
      </div>

      {/* Progress */}
      {flashcardSet?.show_progress && cards.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t('lessonPlayer.flashcards.progress', { done: completedCards.size, total: cards.length })}</span>
            <span>{t('lessonPlayer.flashcards.percentComplete', { percent: Math.round(progress) })}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Card Counter and Difficulty */}
      {cards.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{t('lessonPlayer.flashcards.cardOf', { number: currentCardIndex + 1, total: cards.length })}</span>
            {/* A quiet note, not a toast: the round goes on underneath it. */}
            <span aria-live="polite" className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
              {stillLearning.saved && (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('learning.flashcards.savedToMine')}
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {stepId && (
              <Button
                variant={isFavorite ? "default" : "outline"}
                size="sm"
                onClick={handleToggleFavorite}
                disabled={isLoadingFavorite}
                className={`flex items-center gap-1 ${isFavorite ? 'bg-red-500 hover:bg-red-600' : ''}`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                {isFavorite ? t('lessonPlayer.save.saved') : t('common.save')}
              </Button>
            )}
            <Badge className={getDifficultyColor(currentCard.difficulty)}>
              {DIFFICULTY_LABEL[currentCard.difficulty] ? t(DIFFICULTY_LABEL[currentCard.difficulty]) : currentCard.difficulty}
            </Badge>
            {currentCard.tags && currentCard.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Flashcard */}
      <div className="relative">
        <Card
          className="min-h-[300px] cursor-pointer"
          onClick={handleFlip}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            handleFlip()
          }}
          role="button"
          tabIndex={0}
          aria-label={showingAnswer ? t('lessonPlayer.flashcards.hideAnswer') : t('lessonPlayer.flashcards.showAnswer')}
        >
          <CardContent className="p-0 min-h-[300px]" style={{ perspective: '1200px', WebkitPerspective: '1200px' }}>
            <div
              className="relative min-h-[300px] w-full rounded-xl transition-transform duration-500 ease-out"
              style={{
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transformStyle: 'preserve-3d',
                WebkitTransformStyle: 'preserve-3d'
              }}
            >
              <div
                className="absolute inset-0 p-8 flex flex-col justify-center items-center text-center"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  opacity: isFlipped ? 0 : 1,
                  zIndex: isFlipped ? 0 : 2,
                  visibility: isFlipped ? 'hidden' : 'visible',
                  transition: 'opacity 220ms ease'
                }}
              >
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">{t('lessonPlayer.flashcards.question')}</div>
                  {currentCard.front_image_url && (
                    <img
                      src={currentCard.front_image_url}
                      alt={t('learning.flashcards.frontImage')}
                      className="max-w-full max-h-80 object-contain rounded mb-4"
                    />
                  )}
                  <div className="text-xl font-medium text-foreground">
                    {currentCard.front_text}
                  </div>
                </div>
              </div>

              <div
                className="absolute inset-0 p-8 flex flex-col justify-center items-center text-center"
                style={{
                  transform: 'rotateY(180deg)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  opacity: isFlipped ? 1 : 0,
                  zIndex: isFlipped ? 2 : 0,
                  visibility: isFlipped ? 'visible' : 'hidden',
                  transition: 'opacity 220ms ease'
                }}
              >
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">{t('lessonPlayer.flashcards.answer')}</div>
                  {currentCard.back_image_url && (
                    <img
                      src={currentCard.back_image_url}
                      alt={t('learning.flashcards.backImage')}
                      className="max-w-full max-h-80 object-contain rounded mb-4"
                    />
                  )}
                  <div className="text-xl font-medium text-foreground">
                    {currentCard.back_text}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="space-y-4 items-center content-center">
        {/* Answer Buttons (only show when answer is visible) */}
        {showingAnswer && (
          <div className="flex justify-center gap-4">
            <Button 
              onClick={handleIncorrect}
              variant="outline"
              className="flex items-center gap-2 border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-700/60 dark:text-amber-300 dark:hover:bg-amber-900/20 dark:hover:text-amber-200"
            >
              <Repeat className="w-4 h-4" aria-hidden="true" />
              {t('learning.flashcards.stillLearning')}
            </Button>
            <Button 
              onClick={handleCorrect}
              className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              {t('learning.flashcards.gotIt')}
            </Button>
          </div>
        )}
        {showingAnswer && (
          <p className="text-center text-xs text-muted-foreground">{t('learning.flashcards.stillLearningHint')}</p>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button 
            onClick={goToPreviousCard}
            variant="outline"
            disabled={currentCardIndex === 0}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('lessonPlayer.nav.previous')}
          </Button>

          <Button 
            onClick={resetProgress}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {t('lessonPlayer.flashcards.reset')}
          </Button>

          <Button 
            onClick={() => goToNextCard()}
            variant="outline"
            disabled={currentCardIndex === cards.length - 1 && incorrectCards.size === 0}
            className="flex items-center gap-2"
          >
            {t('lessonPlayer.nav.next')}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Completion Status */}
      {cards.length > 0 && completedCards.size === cards.length && (
        <div className="text-center py-4 bg-green-50 rounded-lg border border-green-200 dark:bg-green-950/30 dark:border-green-900">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">{t('lessonPlayer.flashcards.doneTitle')}</h3>
          <p className="text-green-600 dark:text-green-300">{t('lessonPlayer.flashcards.doneBody')}</p>
          {incorrectCards.size > 0 && (
            <p className="text-sm text-green-600 dark:text-green-300 mt-1">
              {t('lessonPlayer.flashcards.reviewHard', { count: incorrectCards.size })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
