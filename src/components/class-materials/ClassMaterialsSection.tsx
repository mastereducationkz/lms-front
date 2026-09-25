import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getClassMaterials, type LessonMaterials, type MaterialItem } from '../../services/api/classMaterials';
import { materialsLocale, openedCount, pendingAfterClass, t } from '../../lib/classMaterials';
import { parseAsUTC } from '../../lib/datetime';
import { canSkipFetch, materialsVisibility, type MaterialsVisibility } from '../../lib/classMaterialsView';
import MaterialRow from './MaterialRow';
import MaterialViewer from './MaterialViewer';
import CatchUpList from './CatchUpList';
import AddMaterialMenu, { type AddMaterialMenuHandle } from './AddMaterialMenu';
import ItemActionsMenu from './ItemActionsMenu';
import TopicSuggestionRow from './TopicSuggestionRow';

interface Props {
  eventId: number;
  variant?: 'dialog' | 'page';
  /** Called after any write (upload/attach/copy/edit/detach/moderate/topic save) refreshes the
   * section, so the caller can refresh anything else derived from the lesson (e.g. an
   * attachment-count badge elsewhere on the page). */
  onChanged?: () => void;
  /** Skips the initial fetch when the caller already has the payload (e.g. re-using the
   * `LessonMaterials` an attach/copy call just returned). See `canSkipFetch`. */
  initialData?: LessonMaterials;
}

/** Naive-UTC comparison, matching the backend's own rule (§4.5) for the after-class gate. */
function hasEnded(endDatetime: string): boolean {
  return parseAsUTC(endDatetime).getTime() <= Date.now();
}

/** `data` only counts as showable once it actually belongs to the lesson being displayed —
 *  the dialog can swap `eventId` on this component without unmounting it. */
function sameLesson(data: LessonMaterials | null, eventId: number): data is LessonMaterials {
  return !!data && data.lesson.id === eventId;
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
 * The fetch effect deliberately has no "already fetched this eventId" guard: an earlier version
 * kept one (to avoid a redundant re-fetch), but that meant switching from a lesson whose load
 * failed back to one that had already loaded left the failure banner stuck over valid data,
 * with a dead Retry button. Re-running unconditionally on every `eventId`/`attempt` change
 * costs one extra request in the rare case of revisiting an already-loaded lesson, in exchange
 * for never showing a stale result.
 *
 * The write flows (upload, «Из моих файлов», «Скопировать из урока…», link, per-item rename /
 * show-after-class / detach / moderate, and the topic row) live in `AddMaterialMenu` /
 * `ItemActionsMenu` / `TopicSuggestionRow`. They report back through `applyMutation`, which
 * either takes the full `LessonMaterials` a mutation already returned (attach/copy) or, for the
 * per-item endpoints that only return the one item, bumps `attempt` to refetch — the same retry
 * mechanism `retry()` uses below.
 */
export default function ClassMaterialsSection({ eventId, onChanged, initialData }: Props) {
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
  const addMenuRef = useRef<AddMaterialMenuHandle>(null);

  useEffect(() => {
    setViewerItem(null);
    setViewerOpen(false);
  }, [eventId]);

  useEffect(() => {
    if (isParent) return undefined;

    // Drop data left over from a different lesson before doing anything else, so a lesson
    // that then fails to load never shows the previous one's materials underneath the error.
    setData((prev) => (sameLesson(prev, eventId) ? prev : null));

    if (canSkipFetch(initialData, eventId, attempt)) {
      setData(initialData as LessonMaterials);
      setFailure(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setFailure(null);
    getClassMaterials(eventId)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setFailure(materialsVisibility({ isParent: false, error: err }));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `initialData` is only consulted through `canSkipFetch`, not depended on directly: a
    // caller passing a fresh object identity each render must not retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, attempt, isParent]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /** Every write flow reports back through this: attach/copy already return the full
   *  `LessonMaterials`, so those are applied directly with no extra request; everything else
   *  (rename, the after-class toggle, detach, moderate/restore) only returns the one item, so
   *  those fall back to a refetch via `attempt`. Either way `onChanged` fires once. */
  const applyMutation = useCallback(
    (updated?: LessonMaterials) => {
      if (updated && updated.lesson.id === eventId) {
        setData(updated);
        setFailure(null);
      } else {
        setAttempt((n) => n + 1);
      }
      onChanged?.();
    },
    [eventId, onChanged],
  );

  /** The topic-save response only carries `{event_id, topic}`, not a full `LessonMaterials`, so
   *  it is patched into `data` directly rather than triggering a network refetch. */
  const applyTopic = useCallback(
    (topic: string) => {
      setData((prev) => (prev && prev.lesson.id === eventId ? { ...prev, lesson: { ...prev.lesson, topic: topic || null } } : prev));
      onChanged?.();
    },
    [eventId, onChanged],
  );

  if (isParent || failure === 'hidden') return null;

  const current = sameLesson(data, eventId) ? data : null;

  // No data for THIS lesson yet and still fetching: the spinner alone, no header — the header
  // appears once there is either data or a known error to show underneath it.
  if (loading && !current) {
    return (
      <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 flex-none animate-spin" aria-hidden />
      </div>
    );
  }

  const openItem = (item: MaterialItem) => {
    setViewerItem(item);
    setViewerOpen(true);
  };

  const visibleCount = current ? current.items.filter((item) => !item.removed).length : 0;
  const pending = current?.pending_after_end ?? 0;
  const showEmpty = !!current && !current.can_manage && visibleCount === 0 && pending === 0;
  const showPending = !!current && !current.can_manage && pending > 0;
  const lessonEnded = !!current && hasEnded(current.lesson.end_datetime);

  return (
    <div
      className="mt-4 border-t border-border pt-4"
      onDragOver={(e) => {
        if (current?.can_manage) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!current?.can_manage) return;
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length) addMenuRef.current?.addFiles(files);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t('sectionTitle', locale)}</h3>
        {current?.can_manage && (
          <AddMaterialMenu ref={addMenuRef} eventId={eventId} locale={locale} onMutated={applyMutation} />
        )}
      </div>

      {failure === 'error' && (
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

      {current && (
        <>
          <TopicSuggestionRow
            key={current.lesson.id}
            lesson={current.lesson}
            visibleItems={current.items.filter((item) => !item.removed)}
            canManage={current.can_manage}
            locale={locale}
            onSaved={applyTopic}
          />

          {current.items.length > 0 && (
            <div className="mt-2 divide-y divide-border">
              {current.items.map((item) => (
                <MaterialRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  onOpen={openItem}
                  actions={
                    item.can_edit || item.can_detach || item.can_moderate ? (
                      <ItemActionsMenu item={item} locale={locale} onMutated={() => applyMutation()} />
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}

          {showEmpty && <p className="mt-2 text-sm text-muted-foreground">{t('empty', locale)}</p>}
          {showPending && <p className="mt-2 text-sm text-muted-foreground">{pendingAfterClass(pending, locale)}</p>}

          {current.homework.map((hw) => (
            <Link
              key={hw.id}
              to={`/homework/${hw.id}`}
              className="mt-2 block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('homeworkLink', locale)}
            </Link>
          ))}

          {current.stats && (
            <p className="mt-3 text-xs text-muted-foreground">
              {openedCount(current.stats.opened_count, current.stats.roster_count, locale)}
            </p>
          )}

          {current.can_see_catch_up && lessonEnded && <CatchUpList eventId={eventId} locale={locale} />}

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
