import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { SearchableSelect } from '../ui/searchable-select';
import { listManageableLessons, type ManageableLesson } from '../../services/api/classMaterials';
import { lessonHeading, t, type Locale } from '../../lib/classMaterials';
import { pickerGroupFor } from '../../lib/classMaterialsAdd';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The groups the viewer can pick from: the ones the feed handed back. */
  groups: { id: number; name: string }[];
  /** The group the feed is already filtered to, if any. */
  initialGroupId: number | null;
  locale: Locale;
  /** The lesson chosen; the page then opens that lesson's materials to add to. */
  onPick: (lessonId: number) => void;
}

/**
 * «Добавить материалы» on the Materials tab, step one: pick a group (skipped when there is only
 * one) and one of its lessons that the viewer may add materials to, nearest to today first, past
 * and future alike. Adding itself is the lesson page's own section, so every rule (types, size,
 * duplicates, who may) stays in one place.
 */
export default function AddToLessonDialog({ open, onOpenChange, groups, initialGroupId, locale, onPick }: Props) {
  const [groupId, setGroupId] = useState<number | null>(() => pickerGroupFor(groups, initialGroupId));
  const [lessons, setLessons] = useState<ManageableLesson[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  // Each opening starts on the feed's group again.
  useEffect(() => {
    if (open) setGroupId(pickerGroupFor(groups, initialGroupId));
  }, [open, groups, initialGroupId]);

  useEffect(() => {
    if (!open || groupId === null) return;
    const request = ++latest.current;
    setLessons(null);
    setFailed(false);
    listManageableLessons(groupId)
      .then((rows) => {
        if (request === latest.current) setLessons(rows);
      })
      .catch(() => {
        if (request === latest.current) setFailed(true);
      });
  }, [open, groupId, attempt]);

  const options = useMemo(
    () => groups.slice().sort((a, b) => a.name.localeCompare(b.name)).map((g) => ({ value: String(g.id), label: g.name })),
    [groups],
  );

  const choose = (lessonId: number) => {
    onPick(lessonId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('pickerTitle', locale)}</DialogTitle>
          <DialogDescription>{t('pickerHint', locale)}</DialogDescription>
        </DialogHeader>

        {groups.length > 1 && (
          <SearchableSelect
            options={options}
            value={groupId === null ? null : String(groupId)}
            onChange={(v) => setGroupId(Number(v))}
            placeholder={t('pickerPickGroup', locale)}
            searchPlaceholder={t('searchGroups', locale)}
            emptyText={t('searchNothing', locale)}
            ariaLabel={t('pickerPickGroup', locale)}
            className="h-11 w-full text-sm"
          />
        )}

        {groupId !== null && lessons === null && !failed && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        )}

        {failed && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t('loadFailed', locale)}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('retry', locale)}
            </button>
          </div>
        )}

        {lessons !== null && lessons.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('pickerEmpty', locale)}</p>
        )}

        {lessons !== null && lessons.length > 0 && (
          <ul className="-mx-1 divide-y divide-border">
            {lessons.map(({ lesson, item_count: count }) => (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={() => choose(lesson.id)}
                  className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
                >
                  <span className="line-clamp-2 break-words text-sm font-medium text-foreground">{lessonHeading(lesson, locale)}</span>
                  <span className="text-xs text-muted-foreground">
                    {count > 0 ? t('itemCount', locale, { count }) : t('noMaterialsYet', locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
