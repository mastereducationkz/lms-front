import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  apiErrorCode, copyClassMaterials, listMyMaterialLessons, type LessonBrief, type LessonMaterials,
} from '../../services/api/classMaterials';
import { errorMessage, lessonHeading, plural, t, type Locale } from '../../lib/classMaterials';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  locale: Locale;
  onCopied: (result: { added: number; skipped: number; lesson: LessonMaterials }) => void;
}

/**
 * «Скопировать из урока…» (§8.1, D12): the teacher's own lessons from the last 30 days, newest
 * first, each with its item count. Picking one attaches every active item of that lesson.
 */
export default function CopyFromLessonPicker({ open, onOpenChange, eventId, locale, onCopied }: Props) {
  const [lessons, setLessons] = useState<{ lesson: LessonBrief; item_count: number }[] | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLessons(null);
    listMyMaterialLessons(eventId)
      .then((res) => setLessons(res.lessons))
      .catch(() => setLessons([]));
  }, [open, eventId]);

  const copy = async (sourceEventId: number) => {
    setCopyingId(sourceEventId);
    try {
      const res = await copyClassMaterials(eventId, sourceEventId);
      toast.success(`+${res.added}`);
      onCopied(res);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(apiErrorCode(err), locale));
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{t('copyFromLesson', locale)}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {lessons && lessons.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noLessonsToCopy', locale)}</p>
          )}
          <ul className="divide-y divide-border">
            {(lessons ?? []).map(({ lesson, item_count }) => (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={() => void copy(lesson.id)}
                  disabled={copyingId !== null}
                  className="flex w-full items-center justify-between gap-2.5 py-2 text-left disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {lessonHeading(lesson, locale)}
                  </span>
                  <span className="flex-none text-xs text-muted-foreground">
                    {plural(item_count, locale, ['материал', 'материала', 'материалов'], ['item', 'items'])}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
