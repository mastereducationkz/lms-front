import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../ui/input';
import { PROGRAM_BADGE_STYLES } from '../../lib/groupPicker';
import { hasCurator } from './curator';
import { PROGRAM_CHIP_LABELS, PROGRAM_ORDER, detectPrograms } from './programs';
import type { ProgramKey } from './programs';
import type { TelegramGroup } from '../../services/api/announcements';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

/**
 * Search, program and curator filters for lists of Telegram groups.
 *
 * Shared by the announcement composer's recipient picker and the Groups tab, so
 * the two can't disagree about which groups count as "SAT". Programs and
 * curators both come from the group's title, via `detectPrograms` and
 * `hasCurator` — Telegram groups carry no metadata of their own.
 *
 * The hook only decides what is SHOWN. Anything that selects groups keeps its
 * own selection state, so narrowing the view never unticks a pick.
 */

/** A program filter, or the "no program in the name" bucket. */
export type ProgramFilterKey = ProgramKey | 'other';

/** Groups whose name says they have a curator (or mentor), or the rest. */
export type CuratorFilterKey = 'with' | 'without';

export function useGroupFilters(groups: TelegramGroup[]) {
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState<Set<ProgramFilterKey>>(new Set());
  // One at a time: "with" and "without" together would just mean everything.
  const [curatorFilter, setCuratorFilter] = useState<CuratorFilterKey | null>(null);

  const programsById = useMemo(
    () => new Map(groups.map((group) => [group.id, detectPrograms(group.title || '')])),
    [groups],
  );
  const curatorById = useMemo(
    () => new Map(groups.map((group) => [group.id, hasCurator(group.title || '')])),
    [groups],
  );

  const searchMatched = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return groups;
    return groups.filter((group) =>
      (group.title || String(group.telegram_chat_id)).toLocaleLowerCase().includes(query),
    );
  }, [groups, search]);

  /**
   * What's shown, plus the per-chip counts. Each row of chips is counted with
   * the search and the OTHER row applied, so every chip says what clicking it
   * would show: with "With curator" on, "IELTS" counts IELTS groups that have one.
   */
  const { visibleGroups, programCounts, curatorCounts } = useMemo(() => {
    const programCounts: Record<ProgramFilterKey | 'all', number> = {
      all: 0,
      sat: 0,
      ielts: 0,
      nuet: 0,
      general_english: 0,
      other: 0,
    };
    const curatorCounts: Record<CuratorFilterKey, number> = { with: 0, without: 0 };
    const visibleGroups: TelegramGroup[] = [];

    for (const group of searchMatched) {
      const programs = programsById.get(group.id) ?? [];
      const curator = curatorById.get(group.id) ? 'with' : 'without';
      const programMatch =
        programFilter.size === 0 ||
        (programs.length === 0
          ? programFilter.has('other')
          : programs.some((program) => programFilter.has(program)));
      const curatorMatch = curatorFilter === null || curatorFilter === curator;

      if (curatorMatch) {
        programCounts.all += 1;
        if (programs.length === 0) programCounts.other += 1;
        for (const program of programs) programCounts[program] += 1;
      }
      if (programMatch) curatorCounts[curator] += 1;
      if (programMatch && curatorMatch) visibleGroups.push(group);
    }
    return { visibleGroups, programCounts, curatorCounts };
  }, [searchMatched, programFilter, curatorFilter, programsById, curatorById]);

  const toggleProgram = (key: ProgramFilterKey) => {
    setProgramFilter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return {
    search,
    setSearch,
    programFilter,
    toggleProgram,
    showAllPrograms: () => setProgramFilter(new Set()),
    curatorFilter,
    /** Picking the active one again turns the filter off. */
    toggleCurator: (key: CuratorFilterKey) =>
      setCuratorFilter((current) => (current === key ? null : key)),
    clearFilters: () => {
      setSearch('');
      setProgramFilter(new Set());
      setCuratorFilter(null);
    },
    programsOf: (group: TelegramGroup): ProgramKey[] => programsById.get(group.id) ?? [],
    programCounts,
    curatorCounts,
    visibleGroups,
    isFiltering: search.trim() !== '' || programFilter.size > 0 || curatorFilter !== null,
  };
}

export type GroupFilters = ReturnType<typeof useGroupFilters>;

/** The search box, the SAT / IELTS / NUET / GE chips and the curator chips. */
export function GroupFilterBar({ filters }: { filters: GroupFilters }) {
  const t = useT();
  const {
    search,
    setSearch,
    programFilter,
    toggleProgram,
    programCounts,
    curatorFilter,
    toggleCurator,
    curatorCounts,
  } = filters;
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSearch('');
          }}
          placeholder={t('announcements.filters.search')}
          aria-label={t('announcements.filters.searchLabel')}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label={t('announcements.filters.clearSearch')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('announcements.filters.byProgram')}>
          <FilterChip
            label={t('common.all')}
            count={programCounts.all}
            active={programFilter.size === 0}
            onClick={filters.showAllPrograms}
          />
          {PROGRAM_ORDER.map((key) => (
            <FilterChip
              key={key}
              label={PROGRAM_CHIP_LABELS[key]}
              count={programCounts[key]}
              active={programFilter.has(key)}
              activeClassName={PROGRAM_BADGE_STYLES[key]}
              onClick={() => toggleProgram(key)}
            />
          ))}
          {/* Only offered when something actually lands there — usually staff
              chats whose names carry no program. */}
          {(programCounts.other > 0 || programFilter.has('other')) && (
            <FilterChip
              label={t('announcements.filters.other')}
              count={programCounts.other}
              active={programFilter.has('other')}
              onClick={() => toggleProgram('other')}
            />
          )}
        </div>

        {/* No "All" chip here: with neither picked, the filter is simply off. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('announcements.filters.byCurator')}>
          <FilterChip
            label={t('announcements.filters.withCurator')}
            count={curatorCounts.with}
            active={curatorFilter === 'with'}
            onClick={() => toggleCurator('with')}
          />
          <FilterChip
            label={t('announcements.filters.withoutCurator')}
            count={curatorCounts.without}
            active={curatorFilter === 'without'}
            onClick={() => toggleCurator('without')}
          />
        </div>
      </div>
    </div>
  );
}

/** The program tags beside a group's name, in the LMS's own program colours. */
export function ProgramBadges({ programs }: { programs: ProgramKey[] }) {
  return (
    <>
      {programs.map((key) => (
        <span
          key={key}
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${PROGRAM_BADGE_STYLES[key]}`}
        >
          {PROGRAM_CHIP_LABELS[key]}
        </span>
      ))}
    </>
  );
}

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  /** Colour when active; defaults to the primary colour. Program chips pass the
   *  LMS's own program badge colours so SAT reads blue here as everywhere else. */
  activeClassName?: string;
}

function FilterChip({ label, count, active, onClick, activeClassName }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // An empty chip is a dead end — but never disable an ACTIVE one, or a
      // search that empties it would leave it stuck on with no way to turn it off.
      disabled={count === 0 && !active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? `border-current ${activeClassName ?? 'bg-primary text-primary-foreground'}`
          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
