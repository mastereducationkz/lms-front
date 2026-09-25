import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getClassMaterials, type LessonMaterials, type MaterialItem } from '../../services/api/classMaterials';
import { materialsLocale, openedCount, pendingAfterClass, t } from '../../lib/classMaterials';
import { parseAsUTC } from '../../lib/datetime';
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
 * Hides itself entirely for a parent (no request even fires), and when the lesson isn't this
 * viewer's to see at all (`GET` answers 404) or any other fetch failure — never showing an
 * error a student or teacher can't act on from here, the same call `LessonRecordingSection`
 * makes for a missing recording.
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
  const [hidden, setHidden] = useState(false);
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
    setHidden(false);
    getClassMaterials(eventId)
      .then((res) => {
        if (cancelled) return;
        fetchedForRef.current = eventId;
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        fetchedForRef.current = eventId;
        setHidden(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, isParent]);

  if (isParent || hidden) return null;

  if (loading || !data) {
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

  const visibleCount = data.items.filter((item) => !item.removed).length;
  const pending = data.pending_after_end;
  const showEmpty = !data.can_manage && visibleCount === 0 && pending === 0;
  const showPending = !data.can_manage && pending > 0;
  const lessonEnded = hasEnded(data.lesson.end_datetime);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">{t('sectionTitle', locale)}</h3>

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
    </div>
  );
}
