import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFavoriteSteps, removeFavoriteStep, type FavoriteStepItem } from '../../services/api/favoriteSteps';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Play, HelpCircle, Layers, Trophy, FileText, Trash2, Bookmark, BookOpen } from 'lucide-react';
import { toast } from '../Toast';
import Loader from '../Loader';

function getStepTypeIcon(contentType: string) {
  switch (contentType) {
    case 'video_text': return <Play className="w-5 h-5" />;
    case 'quiz': return <HelpCircle className="w-5 h-5" />;
    case 'flashcard': return <Layers className="w-5 h-5" />;
    case 'summary': return <Trophy className="w-5 h-5" />;
    case 'text':
    default: return <FileText className="w-5 h-5" />;
  }
}

export default function FavoriteStepsList() {
  const [items, setItems] = useState<FavoriteStepItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setIsLoading(true);
      setItems(await getFavoriteSteps());
    } catch (error: any) {
      toast(error.message || 'Failed to load saved pages', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (stepId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await removeFavoriteStep(stepId);
      setItems((prev) => prev.filter((i) => i.step_id !== stepId));
      toast('Removed from favorites', 'success');
    } catch (error: any) {
      toast(error.message || 'Failed to remove favorite', 'error');
    }
  };

  const open = (i: FavoriteStepItem) =>
    navigate(`/course/${i.course_id}/lesson/${i.lesson_id}?stepId=${i.step_id}`);

  if (isLoading) return <Loader />;

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Bookmark className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No saved pages yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Tap the star on a lesson page to save it here.
          </p>
          <Button onClick={() => navigate('/courses')}>
            <BookOpen className="h-4 w-4 mr-2" />
            Browse Courses
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((i) => (
        <Card
          key={i.id}
          className="cursor-pointer hover:shadow-lg transition-all group"
          onClick={() => open(i)}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="text-primary shrink-0">{getStepTypeIcon(i.content_type)}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 dark:text-foreground truncate">
                {i.lesson_title} — Step {i.order_index}
              </div>
              {i.step_title && (
                <div className="text-sm text-muted-foreground truncate">{i.step_title}</div>
              )}
              <div className="text-xs text-muted-foreground truncate">{i.course_title}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleRemove(i.step_id, e)}
              className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove from favorites"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
