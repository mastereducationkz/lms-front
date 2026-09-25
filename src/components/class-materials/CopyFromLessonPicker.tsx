import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  apiErrorCode, copyClassMaterials, listMyMaterialLessons, type LessonBrief, type LessonMaterials,
} from '../../services/api/classMaterials';
import { copyResultToast, errorMessage, lessonHeading, plural, t, type Locale } from '../../lib/classMaterials';
import { pickerListState } from '../../lib/classMaterialsView';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  locale: Locale;
  onCopied: (result: { added: number; skipped: number; lesson: LessonMaterials }) => void;
}

/**
 * «Скопировать из урока…» (§8.1, D12): the teacher's own lessons from the last 30 days, newest
 * first, each with its item count. Picking one attaches every active item of that lesson; the
 * toast says how many were added, or that they were all attached already (`copyResultToast`).
 */
export default function CopyFromLessonPicker({ open, onOpenChange, eventId, locale, onCopied }: Props) {
  const [lessons, setLessons] = useState<{ lesson: LessonBrief; item_count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copyingId, setCopyingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLessons([]);
    setLoading(true);
    setFailed(false);
    listMyMaterialLessons(eventId)
      .then((res) => {
        if (!cancelled) setLessons(res.lessons);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, eventId, attempt]);

  const copy = async (sourceEventId: number) => {
    setCopyingId(sourceEventId);
    try {
      const res = await copyClassMaterials(eventId, sourceEventId);
      const note = copyResultToast(res.added, res.skipped, locale);
      if (note?.kind === 'success') toast.success(note.text);
      else if (note) toast(note.text);
      onCopied(res);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(apiErrorCode(err), locale));
    } finally {
      setCopyingId(null);
    }
  };

  const listState = pickerListState({ loading, failed, count: lessons.length });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{t('copyFromLesson', locale)}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {listState === 'loading' && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          )}
          {listState === 'failed' && (
            <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-muted-foreground">
              <span>{t('loadFailed', locale)}</span>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('retry', locale)}
              </button>
            </div>
          )}
          {listState === 'empty' && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noLessonsToCopy', locale)}</p>
          )}
          <ul className="divide-y divide-border">
            {lessons.map(({ lesson, item_count }) => (
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
                  <span className="flex flex-none items-center gap-1.5 text-xs text-muted-foreground">
                    {copyingId === lesson.id && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
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
