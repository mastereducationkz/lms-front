import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getClassMaterials, type LessonMaterials, type MaterialItem } from '../../services/api/classMaterials';
import { materialsLocale, openedCount, pendingAfterClass, t } from '../../lib/classMaterials';
import { parseAsUTC } from '../../lib/datetime';
import { materialsVisibility, type MaterialsVisibility } from '../../lib/classMaterialsView';
import MaterialRow from './MaterialRow';
import MaterialViewer from './MaterialViewer';
import CatchUpList from './CatchUpList';

interface Props {
  eventId: number;
  variant?: 'dialog' | 'page';
  /** Task 13 calls this after a mutation so the caller can refresh anything derived from
   * the lesson (e.g. an attachment-count badge elsewhere on the page). Unused here. */
  onChanged?: () => void;
  /** Skips the initial fetch when the caller already has the payload (e.g. Task 13 re-using
   * the `LessonMaterials` an attach/copy call just returned). */
  initialData?: LessonMaterials;
}

/** Naive-UTC comparison, matching the backend's own rule (§4.5) for the after-class gate. */
function hasEnded(endDatetime: string): boolean {
  return parseAsUTC(endDatetime).getTime() <= Date.now();
}

/**
 * The lesson pop-up's «Материалы урока» section (read side): the item list, the homework
 * link, and — for managers/moderators — the open-count footer and the catch-up list.
 *
 * Hides itself entirely for a parent (no request even fires) and when the lesson isn't this
 * viewer's to see at all (`GET` answers 404) — never showing an error a student can't act on,
 * the same call `LessonRecordingSection` makes for a missing recording. Any *other* failure
 * (a 5xx, a network blip, a timeout) is not the same thing: hiding the section then would make
 * a teacher's already-attached materials look like they silently vanished, so those render a
 * muted retry line instead (see `materialsVisibility`).
 *
 * Task 13 adds the write flows on top of this: the header's «Добавить» menu and each row's
 * ⋯ menu through `MaterialRow`'s `actions` slot, reusing this component's `data`/`onChanged`
 * plumbing.
 */
export default function ClassMaterialsSection({ eventId, initialData }: Props) {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const locale = materialsLocale(user?.role);

  const [data, setData] = useState<LessonMaterials | null>(
    initialData && initialData.lesson.id === eventId ? initialData : null,
  );
  const [loading, setLoading] = useState(data === null);
  const [failure, setFailure] = useState<MaterialsVisibility | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [viewerItem, setViewerItem] = useState<MaterialItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const fetchedForRef = useRef<number | null>(data ? eventId : null);

  useEffect(() => {
    setViewerItem(null);
    setViewerOpen(false);
  }, [eventId]);

  useEffect(() => {
    if (isParent) return undefined;
    if (fetchedForRef.current === eventId) return undefined;
    let cancelled = false;
    setLoading(true);
    setFailure(null);
    getClassMaterials(eventId)
      .then((res) => {
        if (cancelled) return;
        fetchedForRef.current = eventId;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        // `fetchedForRef` is deliberately NOT set here: a failed load must stay retryable,
        // and `attempt` below is what re-satisfies this effect's guard on a Retry click.
        setFailure(materialsVisibility({ isParent: false, error: err }));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, isParent, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (isParent || failure === 'hidden') return null;

  const openItem = (item: MaterialItem) => {
    setViewerItem(item);
    setViewerOpen(true);
  };

  const visibleCount = data ? data.items.filter((item) => !item.removed).length : 0;
  const pending = data?.pending_after_end ?? 0;
  const showEmpty = !!data && !data.can_manage && visibleCount === 0 && pending === 0;
  const showPending = !!data && !data.can_manage && pending > 0;
  const lessonEnded = !!data && hasEnded(data.lesson.end_datetime);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">{t('sectionTitle', locale)}</h3>

      {loading && (
        <div className="mt-2 flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 flex-none animate-spin" aria-hidden />
        </div>
      )}

      {!loading && failure === 'error' && (
        <div className="mt-2 flex items-center gap-2.5 text-sm text-muted-foreground">
          <span>{t('loadFailed', locale)}</span>
          <button
            type="button"
            onClick={retry}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('retry', locale)}
          </button>
        </div>
      )}

      {!loading && failure !== 'error' && data && (
        <>
          {data.items.length > 0 && (
            <div className="mt-2 divide-y divide-border">
              {data.items.map((item) => (
                <MaterialRow key={item.id} item={item} locale={locale} onOpen={openItem} />
              ))}
            </div>
          )}

          {showEmpty && <p className="mt-2 text-sm text-muted-foreground">{t('empty', locale)}</p>}
          {showPending && <p className="mt-2 text-sm text-muted-foreground">{pendingAfterClass(pending, locale)}</p>}

          {data.homework.map((hw) => (
            <Link
              key={hw.id}
              to={`/homework/${hw.id}`}
              className="mt-2 block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('homeworkLink', locale)}
            </Link>
          ))}

          {data.stats && (
            <p className="mt-3 text-xs text-muted-foreground">
              {openedCount(data.stats.opened_count, data.stats.roster_count, locale)}
            </p>
          )}

          {data.can_see_catch_up && lessonEnded && <CatchUpList eventId={eventId} locale={locale} />}

          <MaterialViewer
            item={viewerItem}
            open={viewerOpen}
            onOpenChange={(next) => {
              setViewerOpen(next);
              if (!next) setViewerItem(null);
            }}
            locale={locale}
          />
        </>
      )}
    </div>
  );
}
