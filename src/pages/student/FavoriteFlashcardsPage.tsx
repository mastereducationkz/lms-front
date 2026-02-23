import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFavoriteFlashcards, removeFavoriteFlashcard } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Heart, Trash2, BookOpen, Eye, EyeOff, Play, XCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '../components/Toast';
import Loader from '../components/Loader';
import type { FavoriteFlashcard, FlashcardItem } from '../types';

export default function FavoriteFlashcardsPage() {
  const [favorites, setFavorites] = useState<FavoriteFlashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);
  const [practiceFlipped, setPracticeFlipped] = useState(false);
  const [practiceCompleted, setPracticeCompleted] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setIsLoading(true);
      const data = await getFavoriteFlashcards();
      setFavorites(data);
    } catch (error: any) {
      console.error('Failed to load favorite flashcards:', error);
      toast(error.message || 'Failed to load favorites', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await removeFavoriteFlashcard(favoriteId);
      toast('Removed from favorites', 'success');
      setFavorites(favorites.filter(f => f.id !== favoriteId));
    } catch (error: any) {
      console.error('Failed to remove favorite:', error);
      toast(error.message || 'Failed to remove favorite', 'error');
    }
  };

  const toggleFlip = (favoriteId: number) => {
    const newFlipped = new Set(flippedCards);
    if (newFlipped.has(favoriteId)) {
      newFlipped.delete(favoriteId);
    } else {
      newFlipped.add(favoriteId);
    }
    setFlippedCards(newFlipped);
  };

  const parseFlashcardData = (dataStr: string): FlashcardItem | null => {
    try {
      return JSON.parse(dataStr);
    } catch (error) {
      console.error('Failed to parse flashcard data:', error);
      return null;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
      case 'normal': return 'bg-gray-100 dark:bg-secondary text-gray-800 dark:text-foreground';
      case 'hard': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
      default: return 'bg-gray-100 dark:bg-secondary text-gray-800 dark:text-foreground';
    }
  };

  const handlePracticeAll = () => {
    setIsPracticeMode(true);
    setCurrentPracticeIndex(0);
    setPracticeFlipped(false);
    setPracticeCompleted(new Set());
  };

  const handleExitPractice = () => {
    setIsPracticeMode(false);
    setCurrentPracticeIndex(0);
    setPracticeFlipped(false);
    setPracticeCompleted(new Set());
  };

  const handlePracticeFlip = () => {
    setPracticeFlipped(!practiceFlipped);
  };

  const handlePracticeNext = () => {
    if (currentPracticeIndex < favorites.length - 1) {
      setCurrentPracticeIndex(currentPracticeIndex + 1);
      setPracticeFlipped(false);
    } else {
      // Completed all cards
      toast('Great job! You\'ve practiced all flashcards!', 'success');
      handleExitPractice();
    }
  };

  const handlePracticePrevious = () => {
    if (currentPracticeIndex > 0) {
      setCurrentPracticeIndex(currentPracticeIndex - 1);
      setPracticeFlipped(false);
    }
  };

  const handlePracticeKnow = () => {
    const newCompleted = new Set(practiceCompleted);
    newCompleted.add(favorites[currentPracticeIndex].id.toString());
    setPracticeCompleted(newCompleted);
    handlePracticeNext();
  };

  const handlePracticeReview = () => {
    handlePracticeNext();
  };

  if (isLoading) {
    return <Loader />;
  }

  // Practice Mode UI
  if (isPracticeMode && favorites.length > 0) {
    const currentFavorite = favorites[currentPracticeIndex];
    const flashcard = parseFlashcardData(currentFavorite.flashcard_data);
    
    if (!flashcard) {
      return <div>Error loading flashcard</div>;
    }

    const progress = ((currentPracticeIndex + 1) / favorites.length) * 100;

    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Practice Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Practice Mode</h2>
            <Button variant="outline" onClick={handleExitPractice}>
              Exit Practice
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Card {currentPracticeIndex + 1} of {favorites.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-secondary rounded-full h-2">
              <div 
                className="bg-gray-500 dark:bg-gray-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Practice Card */}
        <Card 
          className="min-h-[400px] mb-6 cursor-pointer hover:shadow-xl transition-all"
          onClick={!practiceFlipped ? handlePracticeFlip : undefined}
        >
          <CardContent className="p-12 flex flex-col justify-center items-center text-center">
            <Badge className={`${getDifficultyColor(flashcard.difficulty)} mb-6`}>
              {flashcard.difficulty}
            </Badge>

            {!practiceFlipped ? (
              // Question Side
              <div className="space-y-6 w-full flex flex-col items-center justify-center">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-8">
                  Question
                </div>
                {flashcard.front_image_url && (
                  <img 
                    src={flashcard.front_image_url} 
                    alt="Front" 
                    className="max-w-full max-h-48 object-contain rounded mb-6 mx-auto"
                  />
                )}
                <div className="text-3xl font-bold text-gray-900 text-center">
                  {flashcard.front_text}
                </div>
                <div className="text-sm text-gray-400 mt-8">
                  Click to reveal answer
                </div>
              </div>
            ) : (
              // Answer Side
              <div className="space-y-6 w-full flex flex-col items-center justify-center">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-4">
                  Answer
                </div>
                {flashcard.back_image_url && (
                  <img 
                    src={flashcard.back_image_url} 
                    alt="Back" 
                    className="max-w-full max-h-48 object-contain rounded mb-6 mx-auto"
                  />
                )}
                <div className="text-3xl font-bold text-gray-900 mb-8 text-center">
                  {flashcard.back_text}
                </div>
                
                {/* Rating Buttons */}
                <div className="flex gap-4 justify-center mt-8" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    onClick={handlePracticeReview}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-5 w-5" />
                    Need Review
                  </Button>
                  <Button 
                    onClick={handlePracticeKnow}
                    size="lg"
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-5 w-5" />
                    I Know This
                  </Button>
                </div>
              </div>
            )}

            {/* Tags */}
            {flashcard.tags && flashcard.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mt-8">
                {flashcard.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button 
            onClick={handlePracticePrevious}
            variant="outline"
            disabled={currentPracticeIndex === 0}
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous
          </Button>
          
          <div className="text-sm text-gray-500">
            {practiceCompleted.size} cards marked as known
          </div>

          <Button 
            onClick={handlePracticeNext}
            variant="outline"
            disabled={currentPracticeIndex === favorites.length - 1}
          >
            Next
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // Grid View (default)
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <Heart className="h-8 w-8 text-red-600 fill-current" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Favorite Flashcards</h1>
              <p className="text-gray-600">
                {favorites.length} flashcard{favorites.length !== 1 ? 's' : ''} saved
              </p>
            </div>
          </div>
          {favorites.length > 0 && (
            <Button 
              onClick={handlePracticeAll}
              size="lg"
              className="flex items-center gap-2"
            >
              <Play className="h-5 w-5" />
              Practice All
            </Button>
          )}
        </div>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No favorite flashcards yet
            </h3>
            <p className="text-gray-500 mb-6">
              Start adding flashcards to your favorites while studying!
            </p>
            <Button onClick={() => navigate('/courses')}>
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Courses
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((favorite) => {
            const flashcard = parseFlashcardData(favorite.flashcard_data);
            if (!flashcard) return null;

            const isFlipped = flippedCards.has(favorite.id);

            return (
              <div key={favorite.id} className="relative">
                <Card 
                  className="h-64 cursor-pointer hover:shadow-xl transition-all duration-300 relative group"
                  onClick={() => toggleFlip(favorite.id)}
                >
                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleRemoveFavorite(favorite.id, e)}
                    className="absolute top-3 right-3 z-10 text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  {/* Difficulty Badge */}
                  <div className="absolute top-3 left-3 z-10">
                    <Badge className={`${getDifficultyColor(flashcard.difficulty)} text-xs font-semibold`}>
                      {flashcard.difficulty}
                    </Badge>
                  </div>

                  {/* Card Content */}
                  <CardContent className="p-8 flex flex-col justify-center items-center text-center h-full">
                    {!isFlipped ? (
                      // Front of card
                      <div className="space-y-3 w-full flex flex-col justify-center flex-1">
                        <div className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-center gap-2 mb-2">
                          <Eye className="h-3 w-3" />
                          Question
                        </div>
                        {flashcard.front_image_url && (
                          <img 
                            src={flashcard.front_image_url} 
                            alt="Front" 
                            className="max-w-full max-h-24 object-contain rounded mb-2 mx-auto"
                          />
                        )}
                        <div className="text-xl font-semibold text-gray-900 line-clamp-3 px-2">
                          {flashcard.front_text}
                        </div>
                        <div className="text-xs text-gray-400 mt-auto">Click to reveal</div>
                      </div>
                    ) : (
                      // Back of card
                      <div className="space-y-3 w-full flex flex-col justify-center flex-1">
                        <div className="text-xs text-gray-400 uppercase tracking-wider flex items-center justify-center gap-2 mb-2">
                          <EyeOff className="h-3 w-3" />
                          Answer
                        </div>
                        {flashcard.back_image_url && (
                          <img 
                            src={flashcard.back_image_url} 
                            alt="Back" 
                            className="max-w-full max-h-24 object-contain rounded mb-2 mx-auto"
                          />
                        )}
                        <div className="text-xl font-semibold text-gray-900 line-clamp-3 px-2">
                          {flashcard.back_text}
                        </div>
                        <div className="text-xs text-gray-400 mt-auto">Click to flip back</div>
                      </div>
                    )}

                    {/* Tags */}
                    {flashcard.tags && flashcard.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center mt-3">
                        {flashcard.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {flashcard.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{flashcard.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
