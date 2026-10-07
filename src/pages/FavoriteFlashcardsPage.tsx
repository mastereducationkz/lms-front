import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFavoriteFlashcards, removeFavoriteFlashcard } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Heart, BookOpen, Play, XCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '../components/Toast';
import Loader from '../components/Loader';
import type { FavoriteFlashcard } from '../types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import FavoriteStepsList from '../components/favorites/FavoriteStepsList';
import FlipFlashcard, { DifficultyBadge, LookupDetails, type SavedFlashcard } from '../components/favorites/FlipFlashcard';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/learning';
import '@/lib/i18n/catalogs/lessonPlayer';

export default function FavoriteFlashcardsPage() {
  const [favorites, setFavorites] = useState<FavoriteFlashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);
  const [practiceFlipped, setPracticeFlipped] = useState(false);
  const [practiceCompleted, setPracticeCompleted] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'flashcards' | 'pages'>('flashcards');
  const navigate = useNavigate();
  const t = useT();

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
      toast(error.message || t('lessonPlayer.favorites.loadFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await removeFavoriteFlashcard(favoriteId);
      toast(t('lessonPlayer.favorites.removed'), 'success');
      setFavorites(favorites.filter(f => f.id !== favoriteId));
    } catch (error: any) {
      console.error('Failed to remove favorite:', error);
      toast(error.message || t('lessonPlayer.favorites.removeFailed'), 'error');
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

  const parseFlashcardData = (dataStr: string): SavedFlashcard | null => {
    try {
      return JSON.parse(dataStr);
    } catch (error) {
      console.error('Failed to parse flashcard data:', error);
      return null;
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
      toast(t('lessonPlayer.favorites.practiceDone'), 'success');
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
      return <div>{t('lessonPlayer.favorites.cardFailed')}</div>;
    }

    const progress = ((currentPracticeIndex + 1) / favorites.length) * 100;

    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Practice Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-foreground">{t('lessonPlayer.favorites.practiceMode')}</h2>
            <Button variant="outline" onClick={handleExitPractice}>
              {t('lessonPlayer.favorites.exitPractice')}
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t('lessonPlayer.flashcards.cardOf', { number: currentPracticeIndex + 1, total: favorites.length })}</span>
              <span>{t('lessonPlayer.flashcards.percentComplete', { percent: Math.round(progress) })}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-secondary rounded-full h-2">
              <div 
                className="bg-brand-solid h-2 rounded-full transition-all duration-300"
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
            <DifficultyBadge difficulty={flashcard.difficulty} className="mb-6" />

            {!practiceFlipped ? (
              // Question Side
              <div className="space-y-6 w-full flex flex-col items-center justify-center">
                <div className="text-sm text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-8">
                  {t('lessonPlayer.flashcards.question')}
                </div>
                {flashcard.front_image_url && (
                  <img 
                    src={flashcard.front_image_url} 
                    alt={t('learning.flashcards.frontImage')} 
                    className="max-w-full max-h-48 object-contain rounded mb-6 mx-auto"
                  />
                )}
                <div className="text-3xl font-bold text-foreground text-center">
                  {flashcard.front_text}
                </div>
                <div className="text-sm text-gray-400 dark:text-muted-foreground mt-8">
                  {t('lessonPlayer.favorites.revealAnswer')}
                </div>
              </div>
            ) : (
              // Answer Side
              <div className="space-y-6 w-full flex flex-col items-center justify-center">
                <div className="text-sm text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-4">
                  {t('lessonPlayer.flashcards.answer')}
                </div>
                {flashcard.back_image_url && (
                  <img 
                    src={flashcard.back_image_url} 
                    alt={t('learning.flashcards.backImage')} 
                    className="max-w-full max-h-48 object-contain rounded mb-6 mx-auto"
                  />
                )}
                <div className="text-3xl font-bold text-foreground text-center">
                  {flashcard.back_text}
                </div>
                <LookupDetails card={flashcard} clamp={false} className="max-w-xl text-left" />
                
                {/* Rating Buttons */}
                <div className="flex gap-4 justify-center mt-8" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    onClick={handlePracticeReview}
                    variant="outline"
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <XCircle className="h-5 w-5" />
                    {t('lessonPlayer.favorites.needReview')}
                  </Button>
                  <Button 
                    onClick={handlePracticeKnow}
                    size="lg"
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-5 w-5" />
                    {t('lessonPlayer.favorites.knowThis')}
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
            {t('lessonPlayer.nav.previous')}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            {t('lessonPlayer.favorites.knownCount', { count: practiceCompleted.size })}
          </div>

          <Button 
            onClick={handlePracticeNext}
            variant="outline"
            disabled={currentPracticeIndex === favorites.length - 1}
          >
            {t('lessonPlayer.nav.next')}
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // Grid View (default)
  return (
    <div className="max-w-7xl mx-auto p-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'flashcards' | 'pages')}>
        <TabsList className="mb-6">
          <TabsTrigger value="flashcards">{t('lessonPlayer.favorites.tabCards')}</TabsTrigger>
          <TabsTrigger value="pages">{t('lessonPlayer.favorites.tabPages')}</TabsTrigger>
        </TabsList>

        <TabsContent value="flashcards">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('lessonPlayer.favorites.title')}</h1>
              <p className="text-muted-foreground">
                {t('lessonPlayer.favorites.savedCount', { count: favorites.length })}
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
              {t('lessonPlayer.favorites.practiceAll')}
            </Button>
          )}
        </div>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Heart className="h-16 w-16 text-gray-300 dark:text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-foreground mb-2">
              {t('lessonPlayer.favorites.emptyCards')}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t('lessonPlayer.favorites.emptyCardsHint')}
            </p>
            <Button onClick={() => navigate('/courses')}>
              <BookOpen className="h-4 w-4 mr-2" />
              {t('lessonPlayer.favorites.browseCourses')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-6">
          {favorites.map((favorite) => {
            const flashcard = parseFlashcardData(favorite.flashcard_data);
            if (!flashcard) return null;

            return (
              <FlipFlashcard
                key={favorite.id}
                card={flashcard}
                flipped={flippedCards.has(favorite.id)}
                onFlip={() => toggleFlip(favorite.id)}
                onRemove={(e) => handleRemoveFavorite(favorite.id, e)}
              />
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="pages">
          <FavoriteStepsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
