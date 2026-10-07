import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Eye, Folder, LayoutGrid, Loader2, RotateCcw, Search, Video, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { SearchableSelect, type SearchableOption } from '../components/ui/searchable-select';
import RecordingCard from '../components/recordings/RecordingCard';
import RecordingDatePicker from '../components/recordings/RecordingDatePicker';
import RecordingFoldersView from '../components/recordings/RecordingFoldersView';
import RecordingPlayerDialog, { type RecordingMeta } from '../components/recordings/RecordingPlayerDialog';
import { useLiveRecordings } from '../components/recordings/useLiveRecordings';
import { cx } from '../components/calendar/calendarUtils';
import { getEventDetails } from '../services/api/events';
import {
  listRecordings, type RecordingFacets, type RecordingLibraryItem, type RecordingPeriod, type RecordingsKind,
} from '../services/api/recordings';
import { dayHeading, groupByDay, parseWatchParam } from '../lib/recordings';
import type { MessageKey } from '../lib/i18n';
import { useLocale, useT } from '../lib/i18n/react';
import { summaryHint, summaryLine, type RecordingViewSummary } from '../lib/recordingViews';
import { getRecordingViewSummary } from '../services/api/recordingViews';
import '@/lib/i18n/catalogs/recordings';

const PAGE_SIZE = 24;
type StatusFilter = 'all' | 'ready' | 'pending' | 'failed';
type RecordingView = 'gallery' | 'folders';

/** What the lesson and webinar pages say differently; everything else they share. */
const KIND_COPY = {
  lesson: {
    title: 'recordings.library.title',
    scopeStudent: 'recordings.library.scopeStudent',
    scopeTeacher: 'recordings.library.scopeTeacher',
    scopeCurator: 'recordings.library.scopeCurator',
    scopeAll: 'recordings.library.scopeAll',
    search: 'recordings.library.search',
    emptyBody: 'recordings.library.emptyBody',
    noMatchBody: 'recordings.library.noMatchBody',
    recording: 'recordings.library.recording',
  },
  webinar: {
    title: 'recordings.webinars.title',
    scopeStudent: 'recordings.webinars.scopeStudent',
    scopeTeacher: 'recordings.webinars.scopeTeacher',
    scopeCurator: 'recordings.webinars.scopeCurator',
    scopeAll: 'recordings.webinars.scopeAll',
    search: 'recordings.webinars.search',
    emptyBody: 'recordings.webinars.emptyBody',
    noMatchBody: 'recordings.webinars.noMatchBody',
    recording: 'recordings.webinars.recording',
  },
} as const satisfies Record<RecordingsKind, Record<string, MessageKey>>;

const PERIOD_LABEL: Record<RecordingPeriod, MessageKey> = {
  all: 'recordings.library.periodAll',
  '30d': 'recordings.library.period30d',
  '7d': 'recordings.library.period7d',
};

const STATUS_LABEL: Record<StatusFilter, MessageKey> = {
  all: 'recordings.library.statusAll',
  ready: 'recordings.library.statusReady',
  pending: 'recordings.library.statusPending',
  failed: 'recordings.library.statusFailed',
};

function toMeta(item: RecordingLibraryItem): RecordingMeta {
  return {
    eventId: item.event_id,
    title: item.title,
    start: item.start_datetime,
    end: item.end_datetime,
    groups: item.groups,
    eventType: item.event_type ?? null,
    teacher: item.teacher?.name ?? null,
    durationSeconds: item.duration_seconds,
  };
}

/**
 * The Recordings library: every lesson recording the viewer may watch, grouped by day.
 *
 * What is listed is decided by the server (`GET /recordings`), with the same rule as the Watch
 * button — "own lessons only": a student sees their groups, a teacher their lessons, a curator
 * their groups, oversight roles everything. A recording opens in a player dialog whose URL
 * (`?watch=<lesson id>`) can be shared: whoever opens it sees it only if they may.
 */
export default function LessonRecordings({ kind = 'lesson' }: { kind?: RecordingsKind }) {
  const { user } = useAuth();
  const locale = useLocale();
  const t = useT();
  const copy = KIND_COPY[kind];
  const webinars = kind === 'webinar';
  const role = user?.role ?? '';
  const oversight = ['admin', 'head_curator', 'head_teacher'].includes(role);
  const staff = role !== '' && role !== 'student';

  const [searchParams, setSearchParams] = useSearchParams();
  const watchId = parseWatchParam(searchParams);

  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<RecordingPeriod>('all');
  // One Almaty day from the date picker; while set, it is the time range and no period is.
  const [day, setDay] = useState<string | null>(null);
  const [groupId, setGroupId] = useState('all');
  const [teacherId, setTeacherId] = useState('all');
  const [courseId, setCourseId] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  // Gallery is deliberately the default; folders is an extra way to browse the same library.
  const [view, setView] = useState<RecordingView>('gallery');
  // Webinars are for courses, not groups: no Teacher → Group folders for them.
  const shownView: RecordingView = webinars ? 'gallery' : view;

  const [items, setItems] = useState<RecordingLibraryItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [facets, setFacets] = useState<RecordingFacets | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);
  // Cards still on their way update in place — one batched request, visible tab only.
  useLiveRecordings(items, setItems, shownView === 'gallery');

  // Staff: do students who missed a lesson watch its recording? One figure, lessons only (2026-09-28).
  const [viewSummary, setViewSummary] = useState<RecordingViewSummary | null>(null);
  useEffect(() => {
    if (!staff || webinars) return undefined;
    let cancelled = false;
    getRecordingViewSummary()
      .then((summary) => { if (!cancelled) setViewSummary(summary); })
      .catch(() => { /* a figure beside the library, never a reason for it to fail */ });
    return () => { cancelled = true; };
  }, [staff, webinars]);
  const viewFigure = staff && !webinars ? summaryLine(viewSummary, locale) : null;

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setQ(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  // Everything but the time range: the date picker counts its days under exactly these.
  const narrowing = useMemo(() => ({
    kind,
    q: q || undefined,
    // Belt-and-braces against filter-state leaking between the lesson and webinar pages
    // (see Router.tsx): a lesson-page group filter must never reach the webinar page as
    // a course filter, and vice versa, even if component state were somehow shared.
    group_id: webinars || groupId === 'all' ? null : Number(groupId),
    course_id: !webinars || courseId === 'all' ? null : Number(courseId),
    teacher_id: teacherId === 'all' ? null : Number(teacherId),
    status: status === 'all' ? null : status,
  }), [kind, webinars, q, groupId, courseId, teacherId, status]);
  const filters = useMemo(() => ({ ...narrowing, period, date: day }), [narrowing, period, day]);
  const filtering = !!q || !!day || period !== 'all' || groupId !== 'all' || courseId !== 'all'
    || teacherId !== 'all' || status !== 'all';

  useEffect(() => {
    const request = ++latest.current;
    setLoading(true);
    setFailed(false);
    listRecordings({ ...filters, limit: PAGE_SIZE })
      .then((page) => {
        if (request !== latest.current) return; // a newer filter won the race
        setItems(page.items);
        setCursor(page.next_cursor);
        setTotal(page.total ?? page.items.length);
        if (page.facets) setFacets(page.facets);
      })
      .catch(() => request === latest.current && setFailed(true))
      .finally(() => request === latest.current && setLoading(false));
  }, [filters, reloadKey]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    const request = latest.current;
    setLoadingMore(true);
    try {
      const page = await listRecordings({ ...filters, limit: PAGE_SIZE, cursor });
      if (request !== latest.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setQ('');
    setPeriod('all');
    setDay(null);
    setGroupId('all');
    setCourseId('all');
    setTeacherId('all');
    setStatus('all');
  };

  // --- the player, driven by ?watch= so a recording can be linked to ----------------------
  const [linkedMeta, setLinkedMeta] = useState<RecordingMeta | null>(null);
  const listedItem = watchId ? items.find((i) => i.event_id === watchId) : undefined;
  useEffect(() => {
    setLinkedMeta(null);
    if (!watchId || listedItem || loading) return;
    let cancelled = false;
    // A link to a recording that is not on the loaded page: ask for the lesson itself. If
    // that is refused, the player still asks the recording endpoint, which decides.
    getEventDetails(watchId)
      .then((event) => !cancelled && setLinkedMeta({
        eventId: watchId,
        title: event.title,
        start: event.start_datetime,
        end: event.end_datetime,
        groups: (event.groups ?? []).map((name) => ({ name })),
        eventType: event.event_type ?? null,
        teacher: event.teacher_name ?? null,
      }))
      .catch(() => !cancelled && setLinkedMeta({ eventId: watchId, title: t(copy.recording) }));
    return () => {
      cancelled = true;
    };
  }, [watchId, listedItem, loading, t, copy.recording]);
  const playerMeta = listedItem ? toMeta(listedItem) : linkedMeta;

  const openItem = useCallback((item: RecordingLibraryItem) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('watch', String(item.event_id));
      return next;
    });
  }, [setSearchParams]);

  const closePlayer = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('watch');
      return next;
    }, { replace: true });
  };

  const days = useMemo(() => groupByDay(items), [items]);
  const now = new Date();
  const scope = t(oversight ? copy.scopeAll
    : role === 'teacher' ? copy.scopeTeacher
      : role === 'curator' ? copy.scopeCurator
        : copy.scopeStudent);
  const showGroups = !webinars && (facets?.groups.length ?? 0) > 1;
  const showCourses = webinars && (facets?.courses?.length ?? 0) > 1;
  const showTeachers = staff && (facets?.teachers.length ?? 0) > 1;
  const groupOptions = useMemo<SearchableOption[]>(() => [
    { value: 'all', label: t('recordings.library.allGroups') },
    ...(facets?.groups.map((group) => ({
      value: String(group.id),
      label: group.name,
      hint: group.is_over ? t('recordings.library.groupFinished')
        : group.is_active === false ? t('recordings.library.groupArchived') : undefined,
    })) ?? []),
  ], [facets?.groups, t]);
  const teacherOptions = useMemo<SearchableOption[]>(() => [
    { value: 'all', label: t('recordings.library.allTeachers') },
    ...(facets?.teachers.map((teacher) => ({
      value: String(teacher.id), label: teacher.name ?? `#${teacher.id}`,
    })) ?? []),
  ], [facets?.teachers, t]);
  const courseOptions = useMemo<SearchableOption[]>(() => [
    { value: 'all', label: t('recordings.library.allCourses') },
    ...(facets?.courses?.map((course) => ({ value: String(course.id), label: course.title })) ?? []),
  ], [facets?.courses, t]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t(copy.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope}
            {total !== null && !loading && (
              <span className="ml-2 font-medium text-foreground/80">
                {t('recordings.library.count', { count: total })}
              </span>
            )}
          </p>
          {viewFigure && (
            <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted-foreground" title={summaryHint(locale)}>
              <Eye className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
              <span>{viewFigure}</span>
            </p>
          )}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="recordings-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(copy.search)}
            aria-label={t(copy.search)}
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('recordings.library.clearSearch')}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t('recordings.library.periodAll')}>
          {(['all', '30d', '7d'] as RecordingPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setPeriod(p); setDay(null); }}
              aria-pressed={!day && period === p}
              className={cx(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition',
                !day && period === p ? 'bg-card text-foreground shadow-sm dark:bg-brand-surface dark:text-brand-subtle-foreground dark:shadow-[inset_0_0_0_1px_hsl(var(--brand-border))]' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(PERIOD_LABEL[p])}
            </button>
          ))}
        </div>

        <RecordingDatePicker
          value={day}
          onChange={(next) => { setDay(next); if (next) setPeriod('all'); }}
          filters={narrowing}
          locale={locale}
        />

        {showGroups && (
          <SearchableSelect options={groupOptions} value={groupId} onChange={setGroupId}
            placeholder={t('recordings.library.allGroups')} searchPlaceholder={t('recordings.library.searchGroups')}
            emptyText={t('recordings.library.noGroup')} ariaLabel={t('recordings.library.allGroups')} className="h-9 w-full text-sm sm:w-[190px]" />
        )}

        {showCourses && (
          <SearchableSelect options={courseOptions} value={courseId} onChange={setCourseId}
            placeholder={t('recordings.library.allCourses')} searchPlaceholder={t('recordings.library.searchCourses')}
            emptyText={t('recordings.library.noCourse')} ariaLabel={t('recordings.library.allCourses')} className="h-9 w-full text-sm sm:w-[190px]" />
        )}

        {showTeachers && (
          <SearchableSelect options={teacherOptions} value={teacherId} onChange={setTeacherId}
            placeholder={t('recordings.library.allTeachers')} searchPlaceholder={t('recordings.library.searchTeachers')}
            emptyText={t('recordings.library.noTeacher')} ariaLabel={t('recordings.library.allTeachers')} className="h-9 w-full text-sm sm:w-[190px]" />
        )}

        {staff && (
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-[170px]" aria-label={t('recordings.library.statusAll')}>
              <SelectValue placeholder={t('recordings.library.statusAll')} />
            </SelectTrigger>
            <SelectContent>
              {(['all', 'ready', 'pending', 'failed'] as StatusFilter[]).map((s) => (
                <SelectItem key={s} value={s}>{t(STATUS_LABEL[s])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!webinars && (
          <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t('recordings.library.viewGallery')}>
            {([
              ['gallery', LayoutGrid, t('recordings.library.viewGallery')],
              ['folders', Folder, t('recordings.library.viewFolders')],
            ] as const).map(([option, Icon, label]) => (
              <button key={option} type="button" onClick={() => setView(option)} aria-pressed={view === option}
                className={cx('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition',
                  view === option ? 'bg-card text-foreground shadow-sm dark:bg-brand-surface dark:text-brand-subtle-foreground dark:shadow-[inset_0_0_0_1px_hsl(var(--brand-border))]' : 'text-muted-foreground hover:text-foreground')}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}

        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('recordings.library.clear')}
          </button>
        )}
      </div>

      {/* Content */}
      {shownView === 'folders' ? (
        <RecordingFoldersView filters={filters} locale={locale} onOpen={openItem} />
      ) : failed && items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t('recordings.library.error')}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('common.retry')}
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="space-y-2 p-3.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3.5 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Video className="h-6 w-6 text-muted-foreground" aria-hidden />
          </span>
          <h2 className="mt-4 text-base font-semibold text-foreground">{filtering ? t('recordings.library.noMatchTitle') : t('recordings.library.emptyTitle')}</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{t(filtering ? copy.noMatchBody : copy.emptyBody)}</p>
          <div className="mt-5">
            {filtering ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t('recordings.library.clear')}
              </button>
            ) : (
              <Link
                to="/calendar"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                {t('recordings.library.openCalendar')}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-7">
          {days.map((day) => (
            <section key={day.key} aria-labelledby={`day-${day.key}`}>
              <h2
                id={`day-${day.key}`}
                className="sticky top-0 z-10 -mx-1 mb-3 flex items-baseline gap-2 bg-background/90 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75"
              >
                <span className="text-[15px] font-semibold text-foreground">{dayHeading(day.key, now, locale)}</span>
                <span className="text-[13px] tabular-nums text-muted-foreground">{day.items.length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
                {day.items.map((item) => (
                  <RecordingCard key={item.event_id} item={item} locale={locale} onOpen={openItem} />
                ))}
              </div>
            </section>
          ))}

          {cursor && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-muted disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {t('recordings.library.more')}
              </button>
            </div>
          )}
        </div>
      )}

      <RecordingPlayerDialog
        meta={playerMeta}
        open={!!watchId && !!playerMeta}
        onOpenChange={(open) => !open && closePlayer()}
        locale={locale}
      />
    </div>
  );
}
