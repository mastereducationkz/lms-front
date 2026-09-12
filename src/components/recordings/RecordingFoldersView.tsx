import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Folder, FolderOpen, Loader2, RotateCcw, UserRound, Video } from 'lucide-react';
import RecordingCard from './RecordingCard';
import { cx } from '../calendar/calendarUtils';
import {
  listRecordingFolders, listRecordings,
  type RecordingFolderGroup, type RecordingFolderTeacher, type RecordingLibraryItem,
  type RecordingLibraryQuery,
} from '../../services/api/recordings';
import { dayHeading, groupByDay, type Locale } from '../../lib/recordings';

const PAGE_SIZE = 24;
const FOLDER_BUTTON_CLASS = 'inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-muted';

const TEXT = {
  en: {
    root: 'Teachers', folders: 'Folders', groups: 'groups', videos: 'videos',
    noTeacher: 'No teacher assigned', noFolders: 'No folders match these filters.',
    noVideos: 'No recordings match these filters in this group.', error: 'The folders could not be loaded.',
    retry: 'Try again', more: 'Show more', active: 'Active', finished: 'Finished', archived: 'Archived',
    substitution: (name: string) => `Substitution · regular teacher: ${name}`,
  },
  ru: {
    root: 'Учителя', folders: 'Папки', groups: 'групп', videos: 'видео',
    noTeacher: 'Учитель не назначен', noFolders: 'Нет папок по этим фильтрам.',
    noVideos: 'В этой группе нет записей по этим фильтрам.', error: 'Не удалось загрузить папки.',
    retry: 'Повторить', more: 'Показать ещё', active: 'Активная', finished: 'Завершена', archived: 'Архивная',
    substitution: (name: string) => `Замена · основной учитель: ${name}`,
  },
};

type FolderFilters = Omit<RecordingLibraryQuery, 'limit' | 'cursor'>;

interface Props {
  filters: FolderFilters;
  locale: Locale;
  onOpen: (item: RecordingLibraryItem) => void;
}

function numberLabel(n: number, word: string): string {
  return `${n} ${word}`;
}

function groupStateClass(state: RecordingFolderGroup['state']): string {
  if (state === 'finished') return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300';
  if (state === 'archived') return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300';
  return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300';
}

/**
 * A Drive-like navigation view backed by a compact server index. It deliberately fetches a
 * normal paginated recording page only after a group is opened, so it never infers a tree from
 * the first gallery page and never exposes a media URL in the navigation response.
 */
export default function RecordingFoldersView({ filters, locale, onOpen }: Props) {
  const t = TEXT[locale];
  const [tree, setTree] = useState<RecordingFolderTeacher[] | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeFailed, setTreeFailed] = useState(false);
  const [treeReload, setTreeReload] = useState(0);
  const [teacherId, setTeacherId] = useState<number | null | undefined>(undefined);
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  const treeRequest = useRef(0);

  useEffect(() => {
    const request = ++treeRequest.current;
    setTreeLoading(true);
    setTreeFailed(false);
    // A global filter changes the meaning of every count, so navigation returns to its root.
    setTeacherId(undefined);
    setGroupId(undefined);
    listRecordingFolders(filters)
      .then((response) => request === treeRequest.current && setTree(response.teachers))
      .catch(() => request === treeRequest.current && setTreeFailed(true))
      .finally(() => request === treeRequest.current && setTreeLoading(false));
  }, [filters, treeReload]);

  const selectedTeacher = useMemo(
    () => teacherId === undefined ? undefined : tree?.find((teacher) => teacher.id === teacherId),
    [teacherId, tree],
  );
  const selectedGroup = useMemo(
    () => groupId === undefined ? undefined : selectedTeacher?.groups.find((group) => group.id === groupId),
    [groupId, selectedTeacher],
  );

  const [items, setItems] = useState<RecordingLibraryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosFailed, setVideosFailed] = useState(false);
  const [videosReload, setVideosReload] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const videoRequest = useRef(0);

  useEffect(() => {
    const request = ++videoRequest.current;
    if (!selectedTeacher || !selectedGroup) {
      setItems([]);
      setCursor(null);
      setVideosLoading(false);
      setVideosFailed(false);
      return;
    }
    setVideosLoading(true);
    setVideosFailed(false);
    listRecordings({ ...filters, teacher_id: selectedTeacher.id, group_id: selectedGroup.id, limit: PAGE_SIZE })
      .then((page) => {
        if (request !== videoRequest.current) return;
        setItems(page.items);
        setCursor(page.next_cursor);
      })
      .catch(() => request === videoRequest.current && setVideosFailed(true))
      .finally(() => request === videoRequest.current && setVideosLoading(false));
  }, [filters, selectedGroup, selectedTeacher, videosReload]);

  const loadMore = async () => {
    if (!cursor || loadingMore || !selectedTeacher || !selectedGroup) return;
    const request = videoRequest.current;
    setLoadingMore(true);
    try {
      const page = await listRecordings({
        ...filters, teacher_id: selectedTeacher.id, group_id: selectedGroup.id, limit: PAGE_SIZE, cursor,
      });
      if (request !== videoRequest.current) return;
      setItems((previous) => [...previous, ...page.items]);
      setCursor(page.next_cursor);
    } catch {
      if (request === videoRequest.current) setVideosFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const stateLabel = (state: RecordingFolderGroup['state']) => t[state];
  const days = useMemo(() => groupByDay(items), [items]);
  const now = new Date();
  const substitutionFor = selectedTeacher && selectedGroup?.regular_teacher
    && selectedTeacher.id !== selectedGroup.regular_teacher.id
    ? selectedGroup.regular_teacher.name
    : null;

  if (treeLoading && !tree) {
    return <FolderSkeleton />;
  }

  if (treeFailed && !tree) {
    return (
      <EmptyState icon={<Folder className="h-6 w-6" aria-hidden />} title={t.error}>
        <button type="button" onClick={() => setTreeReload((key) => key + 1)} className={`${FOLDER_BUTTON_CLASS} mt-5`}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t.retry}
        </button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <nav aria-label={t.folders} className="flex min-h-7 flex-wrap items-center gap-1 text-sm">
        <button type="button" onClick={() => { setTeacherId(undefined); setGroupId(undefined); }}
          className={cx('rounded px-1.5 py-0.5 font-medium hover:bg-muted', teacherId === undefined ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {t.root}
        </button>
        {selectedTeacher && <>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          <button type="button" onClick={() => setGroupId(undefined)}
            className={cx('max-w-[15rem] truncate rounded px-1.5 py-0.5 font-medium hover:bg-muted', groupId === undefined ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {selectedTeacher.name ?? t.noTeacher}
          </button>
        </>}
        {selectedGroup && <>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="max-w-[15rem] truncate px-1.5 py-0.5 font-medium text-foreground">{selectedGroup.name}</span>
        </>}
      </nav>

      {teacherId === undefined ? (
        tree && tree.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tree.map((teacher) => (
              <button key={teacher.id ?? 'unassigned'} type="button" onClick={() => setTeacherId(teacher.id)}
                className="group flex min-h-28 items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-muted/40 hover:shadow">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary/15">
                  <UserRound className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{teacher.name ?? t.noTeacher}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{numberLabel(teacher.group_count, t.groups)} · {numberLabel(teacher.video_count, t.videos)}</span>
                </span>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        ) : <EmptyState icon={<Folder className="h-6 w-6" aria-hidden />} title={t.noFolders} />
      ) : !selectedTeacher ? (
        <EmptyState icon={<Folder className="h-6 w-6" aria-hidden />} title={t.noFolders} />
      ) : groupId === undefined ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {selectedTeacher.groups.map((group) => (
            <button key={group.id} type="button" onClick={() => setGroupId(group.id)}
              className="group flex min-h-32 items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-muted/40 hover:shadow">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <FolderOpen className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{group.name}</span>
                <span className={cx('mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', groupStateClass(group.state))}>{stateLabel(group.state)}</span>
                <span className="mt-2 block text-xs text-muted-foreground">{numberLabel(group.video_count, t.videos)}</span>
                {group.substitution_count > 0 && group.regular_teacher?.name && (
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{t.substitution(group.regular_teacher.name)}</span>
                )}
              </span>
              <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      ) : !selectedGroup ? (
        <EmptyState icon={<Folder className="h-6 w-6" aria-hidden />} title={t.noFolders} />
      ) : videosLoading ? <FolderSkeleton /> : videosFailed && items.length === 0 ? (
        <EmptyState icon={<Video className="h-6 w-6" aria-hidden />} title={t.error}>
          <button type="button" onClick={() => setVideosReload((key) => key + 1)} className={`${FOLDER_BUTTON_CLASS} mt-5`}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t.retry}
          </button>
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState icon={<Video className="h-6 w-6" aria-hidden />} title={t.noVideos} />
      ) : (
        <div className="space-y-7">
          {days.map((day) => (
            <section key={day.key} aria-labelledby={`folder-day-${day.key}`}>
              <h2 id={`folder-day-${day.key}`} className="sticky top-0 z-10 -mx-1 mb-3 flex items-baseline gap-2 bg-background/90 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                <span className="text-[15px] font-semibold text-foreground">{dayHeading(day.key, now, locale)}</span>
                <span className="text-[13px] tabular-nums text-muted-foreground">{day.items.length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {day.items.map((item) => <RecordingCard key={item.event_id} item={item} locale={locale} onOpen={onOpen} substitutionFor={substitutionFor} />)}
              </div>
            </section>
          ))}
          {cursor && (
            <div className="flex justify-center pt-1">
              <button type="button" onClick={loadMore} disabled={loadingMore} className={`${FOLDER_BUTTON_CLASS} disabled:opacity-60`}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {t.more}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</span>
    <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>{children}
  </div>;
}

function FolderSkeleton() {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
    {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-muted/40" />)}
  </div>;
}
