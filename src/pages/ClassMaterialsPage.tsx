import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { SearchableSelect, type SearchableOption } from '../components/ui/searchable-select';
import LessonMaterialsCard from '../components/class-materials/LessonMaterialsCard';
import MaterialViewer from '../components/class-materials/MaterialViewer';
import {
  getClassMaterials, getClassMaterialsFeed,
  type FeedLessonEntry, type MaterialItem,
} from '../services/api/classMaterials';
import { materialsLocale, t } from '../lib/classMaterials';
import {
  buildVisibleLessons, feedFooter, filtersChanged, mergeFeedLessons, shouldFetchDeepLinkDirectly, toFeedEntry,
  type FeedFilters,
} from '../lib/classMaterialsFeed';

/** Same set as the backend's `MODERATOR_ROLES` (global constraints). Per Controller Ruling 15,
 *  a moderator's group-less feed call answers 200 (empty `lessons`, all active `groups`) rather
 *  than 400 `group_required` — the picker is filled from that call, and lessons only load once
 *  a group is actually chosen. */
const MODERATOR_ROLES = new Set(['admin', 'head_curator', 'head_teacher']);

const SEARCH_DEBOUNCE_MS = 400;
const HIGHLIGHT_MS = 2000;
const ALL_GROUPS = 'all';

type GroupOption = { id: number; name: string };

function toOptions(groups: GroupOption[], allLabel?: string): SearchableOption[] {
  const sorted = groups.slice().sort((a, b) => a.name.localeCompare(b.name));
  const rows = sorted.map((g) => ({ value: String(g.id), label: g.name }));
  return allLabel ? [{ value: ALL_GROUPS, label: allLabel }, ...rows] : rows;
}

/**
 * «Материалы» — the searchable, group-filterable feed of every lesson the viewer may see
 * materials for (§8.2 of the spec). Students/teachers/curators get their own groups and may
 * narrow by one when they have more than one; moderators (admin/head_curator/head_teacher) must
 * pick a group before any lesson loads, since the feed only ever hands them lessons for one.
 *
 * A `?lesson=<id>` deep link (from a Telegram notice or the bell) is resolved once per id: if
 * the lesson is already on the loaded page it's scrolled to and rung; otherwise it's fetched on
 * its own and pinned at the top. A new id (the bell clicked while already on this page) starts
 * over. See `classMaterialsFeed.ts` for the pure decision logic.
 */
export default function ClassMaterialsPage() {
  const { user } = useAuth();
  const role = user?.role;
  const locale = materialsLocale(role);
  const isModerator = !!role && MODERATOR_ROLES.has(role);

  const [searchParams] = useSearchParams();
  const deepLinkId = useMemo(() => {
    const raw = searchParams.get('lesson');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const [rawQuery, setRawQuery] = useState('');
  const q = useDebouncedValue(rawQuery, SEARCH_DEBOUNCE_MS);

  const [groupId, setGroupId] = useState<number | null>(null);
  const [feedGroups, setFeedGroups] = useState<GroupOption[]>([]);

  const [entries, setEntries] = useState<FeedLessonEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);

  const [pinnedEntry, setPinnedEntry] = useState<FeedLessonEntry | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const deepLinkResolved = useRef(false);
  const deepLinkIdRef = useRef(deepLinkId);
  deepLinkIdRef.current = deepLinkId;
  const prevFilters = useRef<FeedFilters | null>(null);

  const [viewerItem, setViewerItem] = useState<MaterialItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Rendering only — the fetch below always runs, even for a moderator with no group chosen:
  // that call is what fills the picker in the first place (Controller Ruling 15).
  const pickingGroup = isModerator && groupId === null;

  useEffect(() => {
    const request = ++latest.current;
    setLoading(true);
    setFailed(false);
    setLoadMoreFailed(false);
    getClassMaterialsFeed({ groupId: groupId ?? undefined, q: q || undefined })
      .then((page) => {
        if (request !== latest.current) return;
        setEntries(page.lessons);
        setNextBefore(page.next_before);
        setFeedGroups(page.groups);
        setLoadedOnce(true);
      })
      .catch(() => {
        if (request === latest.current) setFailed(true);
      })
      .finally(() => {
        if (request === latest.current) setLoading(false);
      });
  }, [groupId, q, reloadKey]);

  // A group or search change drops a previously pinned deep-linked lesson — it belongs to a
  // view the viewer just filtered away from. `prevFilters` starts at `null` so the very first
  // run (mount, or a deep link resolving before any filter exists) never counts as a "change".
  useEffect(() => {
    const next: FeedFilters = { groupId, q };
    if (filtersChanged(prevFilters.current, next)) {
      setPinnedEntry(null);
      setHighlightId(null);
    }
    prevFilters.current = next;
  }, [groupId, q]);

  const loadMore = useCallback(() => {
    if (!nextBefore || loadingMore) return;
    const request = latest.current;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    getClassMaterialsFeed({ groupId: groupId ?? undefined, q: q || undefined, before: nextBefore })
      .then((page) => {
        if (request !== latest.current) return;
        setEntries((prev) => mergeFeedLessons(prev, page.lessons));
        setNextBefore(page.next_before);
      })
      .catch(() => {
        if (request === latest.current) setLoadMoreFailed(true);
      })
      .finally(() => {
        if (request === latest.current) setLoadingMore(false);
      });
  }, [nextBefore, loadingMore, groupId, q]);

  // A different `?lesson=` while mounted (e.g. a bell item clicked on this very page) is a new
  // deep link to resolve, and the previous one's pinned card goes with it. Declared before the
  // resolving effect below, so both run in this order in the same commit.
  useEffect(() => {
    deepLinkResolved.current = false;
    setPinnedEntry(null);
  }, [deepLinkId]);

  // The deep link resolves exactly once: as soon as the lesson turns up on a loaded page, or —
  // if the feed's first page (for the current group/search) already came back without it — by
  // asking for it directly. See `shouldFetchDeepLinkDirectly`.
  useEffect(() => {
    if (!deepLinkId || deepLinkResolved.current) return;
    const foundInEntries = entries.some((entry) => entry.lesson.id === deepLinkId);
    if (foundInEntries) {
      deepLinkResolved.current = true;
      setHighlightId(deepLinkId);
      return;
    }
    if (!shouldFetchDeepLinkDirectly({ lessonId: deepLinkId, loadedFeedOnce: loadedOnce, foundInEntries })) return;
    deepLinkResolved.current = true;
    getClassMaterials(deepLinkId)
      .then((data) => {
        if (data.lesson.id !== deepLinkIdRef.current) return; // the link moved on meanwhile
        setPinnedEntry(toFeedEntry(data));
        setHighlightId(deepLinkId);
      })
      .catch(() => undefined); // 404 (or anything else) → the link just doesn't resolve
  }, [deepLinkId, entries, loadedOnce]);

  useEffect(() => {
    if (highlightId === null) return undefined;
    document.getElementById(`material-lesson-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const openItem = useCallback((item: MaterialItem) => {
    setViewerItem(item);
    setViewerOpen(true);
  }, []);

  const visibleEntries = useMemo(() => buildVisibleLessons(entries, pinnedEntry), [entries, pinnedEntry]);

  const groupOptions = useMemo(
    () => (isModerator ? toOptions(feedGroups) : toOptions(feedGroups, t('allGroups', locale))),
    [isModerator, feedGroups, locale],
  );
  const showGroupSelect = isModerator || feedGroups.length > 1;
  const groupSelectValue = isModerator ? (groupId === null ? null : String(groupId)) : (groupId === null ? ALL_GROUPS : String(groupId));

  const searching = q.trim().length > 0;
  const footer = feedFooter({ loading, failed, loadMoreFailed, nextBefore });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-5 sm:px-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{t('pageTitle', locale)}</h1>
      </header>

      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder={t('search', locale)}
            aria-label={t('search', locale)}
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        {showGroupSelect && (
          <SearchableSelect
            options={groupOptions}
            value={groupSelectValue}
            onChange={(v) => setGroupId(v === ALL_GROUPS ? null : Number(v))}
            placeholder={isModerator ? t('pickGroup', locale) : t('allGroups', locale)}
            searchPlaceholder={t('searchGroups', locale)}
            emptyText={t('searchNothing', locale)}
            ariaLabel={isModerator ? t('pickGroup', locale) : t('allGroups', locale)}
            className="h-11 w-full text-sm"
          />
        )}
      </div>

      {pickingGroup ? (
        <>
          {visibleEntries.map((entry) => (
            <LessonMaterialsCard
              key={entry.lesson.id}
              entry={entry}
              locale={locale}
              onOpenItem={openItem}
              highlighted={entry.lesson.id === highlightId}
            />
          ))}
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
            {t('pickGroup', locale)}
          </p>
        </>
      ) : (
        <div className="space-y-3">
          {loading && !loadedOnce && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          )}

          {!loading && failed && visibleEntries.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">{t('loadFailed', locale)}</p>
              <button
                type="button"
                onClick={() => setReloadKey((n) => n + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t('retry', locale)}
              </button>
            </div>
          )}

          {!loading && !failed && visibleEntries.length === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
              {searching ? t('searchNothing', locale) : t('noMaterialsYet', locale)}
            </p>
          )}

          {visibleEntries.map((entry) => (
            <LessonMaterialsCard
              key={entry.lesson.id}
              entry={entry}
              locale={locale}
              onOpenItem={openItem}
              highlighted={entry.lesson.id === highlightId}
            />
          ))}

          {footer === 'loadMore' && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t('loadMore', locale)}
              </button>
            </div>
          )}

          {footer === 'loadMoreFailed' && (
            <div className="flex items-center justify-center gap-3 pt-1 text-sm text-muted-foreground">
              <span>{t('loadFailed', locale)}</span>
              <button
                type="button"
                onClick={loadMore}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-3 font-medium text-foreground hover:bg-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t('retry', locale)}
              </button>
            </div>
          )}
        </div>
      )}

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
