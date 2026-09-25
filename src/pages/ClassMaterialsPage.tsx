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
import { getGroups } from '../services/api/groups';
import { materialsLocale, t } from '../lib/classMaterials';
import { buildVisibleLessons, mergeFeedLessons, shouldFetchDeepLinkDirectly, toFeedEntry } from '../lib/classMaterialsFeed';

/** Same set as the backend's `MODERATOR_ROLES` (global constraints): the feed refuses these
 *  roles a page without a `group_id` (400 `group_required`), so the page must ask for one
 *  before it ever calls the feed at all. */
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
 * pick a group before anything loads at all, since the feed itself requires one from them.
 *
 * A `?lesson=<id>` deep link (from a Telegram notice or the bell) is resolved once: if the
 * lesson is already on the loaded page it's scrolled to and rung; otherwise it's fetched on its
 * own and pinned at the top. See `classMaterialsFeed.ts` for the pure decision logic.
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
  const [moderatorGroups, setModeratorGroups] = useState<GroupOption[]>([]);
  const [feedGroups, setFeedGroups] = useState<GroupOption[]>([]);

  const [entries, setEntries] = useState<FeedLessonEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);

  const [pinnedEntry, setPinnedEntry] = useState<FeedLessonEntry | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const deepLinkResolved = useRef(false);

  const [viewerItem, setViewerItem] = useState<MaterialItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const awaitingGroup = isModerator && groupId === null;

  // Moderators pick from every active group up front — the feed won't tell them which groups
  // exist until they've already chosen one. `/admin/groups` is the same group listing the
  // event-management admin screens use, and its own access rule already matches exactly the
  // three moderator roles here.
  useEffect(() => {
    if (!isModerator) return undefined;
    let cancelled = false;
    getGroups()
      .then((groups) => {
        if (cancelled) return;
        setModeratorGroups(groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isModerator]);

  useEffect(() => {
    if (awaitingGroup) {
      setLoading(false);
      return undefined;
    }
    const request = ++latest.current;
    setLoading(true);
    setFailed(false);
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
    return undefined;
  }, [awaitingGroup, groupId, q, reloadKey]);

  const loadMore = useCallback(() => {
    if (!nextBefore || loadingMore) return;
    const request = latest.current;
    setLoadingMore(true);
    getClassMaterialsFeed({ groupId: groupId ?? undefined, q: q || undefined, before: nextBefore })
      .then((page) => {
        if (request !== latest.current) return;
        setEntries((prev) => mergeFeedLessons(prev, page.lessons));
        setNextBefore(page.next_before);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoadingMore(false));
  }, [nextBefore, loadingMore, groupId, q]);

  // The deep link resolves exactly once: as soon as the lesson turns up on a loaded page, or —
  // if it never will (the feed hasn't had its chance yet, or a moderator hasn't even picked a
  // group) — by asking for it directly. See `shouldFetchDeepLinkDirectly`.
  useEffect(() => {
    if (!deepLinkId || deepLinkResolved.current) return;
    const foundInEntries = entries.some((entry) => entry.lesson.id === deepLinkId);
    if (foundInEntries) {
      deepLinkResolved.current = true;
      setHighlightId(deepLinkId);
      return;
    }
    if (!shouldFetchDeepLinkDirectly({
      lessonId: deepLinkId, loadedFeedOnce: loadedOnce, foundInEntries, moderatorAwaitingGroup: awaitingGroup,
    })) return;
    deepLinkResolved.current = true;
    getClassMaterials(deepLinkId)
      .then((data) => {
        setPinnedEntry(toFeedEntry(data));
        setHighlightId(deepLinkId);
      })
      .catch(() => undefined); // 404 (or anything else) → the link just doesn't resolve
  }, [deepLinkId, entries, loadedOnce, awaitingGroup]);

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
    () => (isModerator
      ? toOptions(feedGroups.length ? feedGroups : moderatorGroups)
      : toOptions(feedGroups, t('allGroups', locale))),
    [isModerator, feedGroups, moderatorGroups, locale],
  );
  const showGroupSelect = isModerator || feedGroups.length > 1;
  const groupSelectValue = isModerator ? (groupId === null ? null : String(groupId)) : (groupId === null ? ALL_GROUPS : String(groupId));

  const searching = q.trim().length > 0;

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
            ariaLabel={t('allGroups', locale)}
            className="h-11 w-full text-sm"
          />
        )}
      </div>

      {awaitingGroup ? (
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

          {!loading && !failed && nextBefore && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t('loadMore', locale)}
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
