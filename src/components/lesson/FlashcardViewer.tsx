import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { ChevronLeft, ChevronRight, RotateCcw, CheckCircle, XCircle, Heart } from 'lucide-react';
import type { FlashcardSet } from '../../types';
import { addFavoriteFlashcard, removeFavoriteByCardId, checkIsFavorite } from '../../services/api';
import { toast } from '../Toast';

interface FlashcardViewerProps {
  flashcardSet: FlashcardSet;
  onComplete?: () => void;
  onProgress?: (completed: number, total: number) => void;
  stepId?: number;
  lessonId?: number;
  courseId?: number;
}

export default function FlashcardViewer({ flashcardSet, onComplete, onProgress, stepId, lessonId, courseId }: FlashcardViewerProps) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set());
  const [incorrectCards, setIncorrectCards] = useState<Set<string>>(new Set());
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false);

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
      toast('Cannot add to favorites: missing required data', 'error');
      return;
    }

    setIsLoadingFavorite(true);
    try {
      if (isFavorite) {
        // Remove from favorites
        await removeFavoriteByCardId(stepId, currentCard.id);
        setIsFavorite(false);
        toast('Removed from favorites', 'success');
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
        toast('Added to favorites', 'success');
      }
    } catch (error: any) {
      console.error('Failed to toggle favorite:', error);
      toast(error.message || 'Failed to update favorites', 'error');
    } finally {
      setIsLoadingFavorite(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    setShowingAnswer(!showingAnswer);
  };

  const handleCorrect = () => {
    const newCompleted = new Set(completedCards);
    newCompleted.add(currentCard.id);
    setCompletedCards(newCompleted);
    
    const newIncorrect = new Set(incorrectCards);
    newIncorrect.delete(currentCard.id);
    setIncorrectCards(newIncorrect);
    
    goToNextCard();
  };

  const handleIncorrect = () => {
    const newIncorrect = new Set(incorrectCards);
    newIncorrect.add(currentCard.id);
    setIncorrectCards(newIncorrect);
    
    goToNextCard();
  };

  const goToNextCard = () => {
    setIsFlipped(false);
    setShowingAnswer(false);
    
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      // If there are incorrect cards, cycle through them again
      const incorrectCardIds = Array.from(incorrectCards);
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
      case 'easy': return 'bg-green-100 text-green-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!currentCard) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold mb-4">No flashcards available</h3>
        <Button onClick={onComplete}>Continue</Button>
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
            <span>Progress: {completedCards.size} / {cards.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Card Counter and Difficulty */}
      {cards.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Card {currentCardIndex + 1} of {cards.length}
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
                {isFavorite ? 'Saved' : 'Save'}
              </Button>
            )}
            <Badge className={getDifficultyColor(currentCard.difficulty)}>
              {currentCard.difficulty}
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
          aria-label={showingAnswer ? 'Hide answer' : 'Show answer'}
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
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
              >
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">Question</div>
                  {currentCard.front_image_url && (
                    <img
                      src={currentCard.front_image_url}
                      alt="Front"
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
                  WebkitBackfaceVisibility: 'hidden'
                }}
              >
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">Answer</div>
                  {currentCard.back_image_url && (
                    <img
                      src={currentCard.back_image_url}
                      alt="Back"
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
              className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <XCircle className="w-4 h-4" />
              Incorrect
            </Button>
            <Button 
              onClick={handleCorrect}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Correct
            </Button>
          </div>
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
            Previous
          </Button>

          <Button 
            onClick={resetProgress}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>

          <Button 
            onClick={goToNextCard}
            variant="outline"
            disabled={currentCardIndex === cards.length - 1 && incorrectCards.size === 0}
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Completion Status */}
      {cards.length > 0 && completedCards.size === cards.length && (
        <div className="text-center py-4 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-green-800">Great job!</h3>
          <p className="text-green-600">You've completed all flashcards in this set.</p>
          {incorrectCards.size > 0 && (
            <p className="text-sm text-green-600 mt-1">
              Review the {incorrectCards.size} cards you found challenging.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
