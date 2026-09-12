import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Folder, LayoutGrid, Loader2, RotateCcw, Search, Video, X } from 'lucide-react';
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
import { cx } from '../components/calendar/calendarUtils';
import { getEventDetails } from '../services/api/events';
import {
  listRecordings, type RecordingFacets, type RecordingLibraryItem, type RecordingPeriod,
} from '../services/api/recordings';
import { dayHeading, groupByDay, parseWatchParam, recordingsLocale, type Locale } from '../lib/recordings';

const PAGE_SIZE = 24;
type StatusFilter = 'all' | 'ready' | 'pending' | 'failed';
type RecordingView = 'gallery' | 'folders';

function plural(n: number, locale: Locale, [one, few, many]: [string, string, string]): string {
  if (locale === 'en') return `${n} ${n === 1 ? one : few}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? one
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few
      : many;
  return `${n} ${form}`;
}

const TEXT = {
  en: {
    title: 'Lesson recordings',
    recordings: ['recording', 'recordings', 'recordings'] as [string, string, string],
    scope: {
      student: 'Recordings of your group’s lessons.',
      teacher: 'Recordings of the lessons you teach.',
      curator: 'Recordings of your groups’ lessons.',
      all: 'Every lesson recording in the school.',
    },
    search: 'Search by group or lesson',
    clearSearch: 'Clear search',
    periods: { all: 'All time', '30d': 'Last 30 days', '7d': 'Last 7 days' } as Record<RecordingPeriod, string>,
    allGroups: 'All groups',
    allTeachers: 'All teachers',
    searchGroups: 'Search groups…',
    noGroup: 'No group matches',
    searchTeachers: 'Search teachers…',
    noTeacher: 'No teacher matches',
    groupState: { finished: 'Finished', archived: 'Archived' },
    views: { gallery: 'Gallery', folders: 'Folders' },
    statuses: { all: 'Any status', ready: 'Ready to watch', pending: 'Processing', failed: 'Failed' } as Record<StatusFilter, string>,
    clear: 'Clear filters',
    emptyTitle: 'No recordings yet',
    emptyBody: 'Recordings appear here shortly after a lesson ends. You can also open any past lesson from the calendar.',
    openCalendar: 'Open the calendar',
    noMatchTitle: 'No recordings match these filters',
    noMatchBody: 'Try another date, period, group or search.',
    error: 'The recordings could not be loaded.',
    retry: 'Try again',
    more: 'Show more',
    recording: 'Lesson recording',
  },
  ru: {
    title: 'Записи уроков',
    recordings: ['запись', 'записи', 'записей'] as [string, string, string],
    scope: {
      student: 'Записи уроков вашей группы.',
      teacher: 'Записи ваших уроков.',
      curator: 'Записи уроков ваших групп.',
      all: 'Все записи уроков школы.',
    },
    search: 'Поиск по группе или уроку',
    clearSearch: 'Очистить поиск',
    periods: { all: 'Всё время', '30d': 'Последние 30 дней', '7d': 'Последние 7 дней' } as Record<RecordingPeriod, string>,
    allGroups: 'Все группы',
    allTeachers: 'Все учителя',
    searchGroups: 'Поиск групп…',
    noGroup: 'Группы не найдены',
    searchTeachers: 'Поиск учителей…',
    noTeacher: 'Учителя не найдены',
    groupState: { finished: 'Завершена', archived: 'Архивная' },
    views: { gallery: 'Галерея', folders: 'Папки' },
    statuses: { all: 'Любой статус', ready: 'Готовы к просмотру', pending: 'Обрабатываются', failed: 'С ошибкой' } as Record<StatusFilter, string>,
    clear: 'Сбросить фильтры',
    emptyTitle: 'Записей пока нет',
    emptyBody: 'Записи появляются здесь вскоре после окончания урока. Любой прошедший урок можно открыть и из календаря.',
    openCalendar: 'Открыть календарь',
    noMatchTitle: 'Нет записей по этим фильтрам',
    noMatchBody: 'Попробуйте другую дату, период, группу или запрос.',
    error: 'Не удалось загрузить записи.',
    retry: 'Повторить',
    more: 'Показать ещё',
    recording: 'Запись урока',
  },
};

function toMeta(item: RecordingLibraryItem): RecordingMeta {
  return {
    eventId: item.event_id,
    title: item.title,
    start: item.start_datetime,
    end: item.end_datetime,
    groups: item.groups,
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
export default function LessonRecordings() {
  const { user } = useAuth();
  const locale = recordingsLocale(user?.role);
  const t = TEXT[locale];
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
  const [status, setStatus] = useState<StatusFilter>('all');
  // Gallery is deliberately the default; folders is an extra way to browse the same library.
  const [view, setView] = useState<RecordingView>('gallery');

  const [items, setItems] = useState<RecordingLibraryItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [facets, setFacets] = useState<RecordingFacets | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setQ(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  // Everything but the time range: the date picker counts its days under exactly these.
  const narrowing = useMemo(() => ({
    q: q || undefined,
    group_id: groupId === 'all' ? null : Number(groupId),
    teacher_id: teacherId === 'all' ? null : Number(teacherId),
    status: status === 'all' ? null : status,
  }), [q, groupId, teacherId, status]);
  const filters = useMemo(() => ({ ...narrowing, period, date: day }), [narrowing, period, day]);
  const filtering = !!q || !!day || period !== 'all' || groupId !== 'all' || teacherId !== 'all' || status !== 'all';

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
        teacher: event.teacher_name ?? null,
      }))
      .catch(() => !cancelled && setLinkedMeta({ eventId: watchId, title: t.recording }));
    return () => {
      cancelled = true;
    };
  }, [watchId, listedItem, loading, t.recording]);
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
  const scope = oversight ? t.scope.all
    : role === 'teacher' ? t.scope.teacher
      : role === 'curator' ? t.scope.curator
        : t.scope.student;
  const showGroups = (facets?.groups.length ?? 0) > 1;
  const showTeachers = staff && (facets?.teachers.length ?? 0) > 1;
  const groupOptions = useMemo<SearchableOption[]>(() => [
    { value: 'all', label: t.allGroups },
    ...(facets?.groups.map((group) => ({
      value: String(group.id),
      label: group.name,
      hint: group.is_over ? t.groupState.finished : group.is_active === false ? t.groupState.archived : undefined,
    })) ?? []),
  ], [facets?.groups, t]);
  const teacherOptions = useMemo<SearchableOption[]>(() => [
    { value: 'all', label: t.allTeachers },
    ...(facets?.teachers.map((teacher) => ({
      value: String(teacher.id), label: teacher.name ?? `#${teacher.id}`,
    })) ?? []),
  ], [facets?.teachers, t]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope}
            {total !== null && !loading && (
              <span className="ml-2 font-medium text-foreground/80">
                {plural(total, locale, t.recordings)}
              </span>
            )}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="recordings-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t.clearSearch}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t.periods.all}>
          {(['all', '30d', '7d'] as RecordingPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setPeriod(p); setDay(null); }}
              aria-pressed={!day && period === p}
              className={cx(
                'rounded-md px-3 py-1.5 text-[13px] font-medium transition',
                !day && period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.periods[p]}
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
            placeholder={t.allGroups} searchPlaceholder={t.searchGroups} emptyText={t.noGroup}
            ariaLabel={t.allGroups} className="h-9 w-[190px] text-sm" />
        )}

        {showTeachers && (
          <SearchableSelect options={teacherOptions} value={teacherId} onChange={setTeacherId}
            placeholder={t.allTeachers} searchPlaceholder={t.searchTeachers} emptyText={t.noTeacher}
            ariaLabel={t.allTeachers} className="h-9 w-[190px] text-sm" />
        )}

        {staff && (
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-[170px]" aria-label={t.statuses.all}>
              <SelectValue placeholder={t.statuses.all} />
            </SelectTrigger>
            <SelectContent>
              {(['all', 'ready', 'pending', 'failed'] as StatusFilter[]).map((s) => (
                <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t.views.gallery}>
          {([
            ['gallery', LayoutGrid, t.views.gallery],
            ['folders', Folder, t.views.folders],
          ] as const).map(([option, Icon, label]) => (
            <button key={option} type="button" onClick={() => setView(option)} aria-pressed={view === option}
              className={cx('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition',
                view === option ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t.clear}
          </button>
        )}
      </div>

      {/* Content */}
      {view === 'folders' ? (
        <RecordingFoldersView filters={filters} locale={locale} onOpen={openItem} />
      ) : failed && items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t.error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t.retry}
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <h2 className="mt-4 text-base font-semibold text-foreground">{filtering ? t.noMatchTitle : t.emptyTitle}</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{filtering ? t.noMatchBody : t.emptyBody}</p>
          <div className="mt-5">
            {filtering ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t.clear}
              </button>
            ) : (
              <Link
                to="/calendar"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                {t.openCalendar}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                {t.more}
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
