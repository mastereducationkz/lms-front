/**
 * Pure logic behind every dropdown (Select, NativeSelect, SearchableSelect): text folding, search,
 * the rows a query shows, keyboard moves and type-ahead. No React and no DOM, so it is unit-tested
 * on its own (logic.test.ts).
 */
import type { ReactNode } from 'react';

/** The search box shows from this many listed options (owner, 2026-11-02); shorter lists jump by typing. */
export const SEARCH_THRESHOLD = 6;
/** At most this many matching rows render; a muted line asks to narrow the search. */
export const ROW_LIMIT = 300;
/** PageUp / PageDown move this many rows. */
export const PAGE_STEP = 8;
/** Type-ahead keeps typed letters together for this long. */
export const TYPEAHEAD_MS = 500;

export interface DropdownOption {
  kind: 'option';
  key: string;
  value: string;
  /** What the row and the trigger show. */
  label: ReactNode;
  /** The label as plain text: the trigger's title, search and type-ahead. */
  text: string;
  /** More searchable text that is not the label (Radix `textValue`, a hint). */
  keywords?: string;
  /** Secondary text on the right of the row. */
  hint?: ReactNode;
  disabled?: boolean;
  /** Never listed (native `<option hidden>`), yet shown on the trigger when it is the value. */
  hidden?: boolean;
  /** Key of the group header this option sits under. */
  group?: string;
  className?: string;
}

export interface DropdownGroupLabel {
  kind: 'group';
  key: string;
  label: ReactNode;
  text: string;
}

export interface DropdownSeparator {
  kind: 'separator';
  key: string;
}

export type DropdownEntry = DropdownOption | DropdownGroupLabel | DropdownSeparator;

export type DropdownRow =
  | { kind: 'option'; option: DropdownOption; index: number }
  | { kind: 'group'; key: string; label: ReactNode }
  | { kind: 'separator'; key: string };

export interface DropdownView {
  rows: DropdownRow[];
  /** The listed options in row order; `index` in an option row points here. */
  options: DropdownOption[];
  /** How many options match, before the row limit. */
  matched: number;
  capped: boolean;
}

// Folding pairs as code points, so this file holds no Cyrillic literals (the UI-language scan
// keeps Russian text in the ru catalog): ё→е, and the Kazakh letters ә ғ қ ң ө ұ ү һ і → а г к н о у у х и.
const FOLD_PAIRS: Array<[number, number]> = [
  [0x451, 0x435],
  [0x4d9, 0x430],
  [0x493, 0x433],
  [0x49b, 0x43a],
  [0x4a3, 0x43d],
  [0x4e9, 0x43e],
  [0x4b1, 0x443],
  [0x4af, 0x443],
  [0x4bb, 0x445],
  [0x456, 0x438],
];
const FOLD = new Map(FOLD_PAIRS.map(([from, to]) => [String.fromCharCode(from), String.fromCharCode(to)]));
const FOLD_RE = new RegExp(`[${FOLD_PAIRS.map(([from]) => String.fromCharCode(from)).join('')}]`, 'g');

/** Lower case, ё→е and Kazakh letters to their Russian look-alikes; Latin and Cyrillic stay as typed. */
export function foldText(text: string): string {
  return text.toLowerCase().replace(FOLD_RE, (ch) => FOLD.get(ch) ?? ch);
}

/** The words of a query, folded; empty when the query is blank. */
export function searchWords(query: string): string[] {
  return foldText(query).split(/\s+/).filter(Boolean);
}

/** Every word must appear somewhere in the label, keywords or group label: "aug gulz" finds "August 19 SAT - Gulzada". */
export function optionMatches(option: DropdownOption, words: string[], groupText = ''): boolean {
  if (!words.length) return true;
  const haystack = foldText(`${option.text} ${option.keywords ?? ''} ${groupText}`);
  return words.every((word) => haystack.includes(word));
}

/** Options a person can see in the list (hidden ones never are). */
export function listedCount(entries: DropdownEntry[]): number {
  return entries.reduce((n, e) => n + (e.kind === 'option' && !e.hidden ? 1 : 0), 0);
}

export function shouldSearch(entries: DropdownEntry[], threshold = SEARCH_THRESHOLD): boolean {
  return listedCount(entries) >= threshold;
}

/**
 * The rows a query shows: group headers only above groups with a matching row, separators only
 * without a query (never leading, trailing or doubled), at most `limit` options.
 */
export function buildView(entries: DropdownEntry[], query: string, limit = ROW_LIMIT): DropdownView {
  const words = searchWords(query);
  const groups = new Map<string, DropdownGroupLabel>();
  for (const e of entries) if (e.kind === 'group') groups.set(e.key, e);

  const rows: DropdownRow[] = [];
  const options: DropdownOption[] = [];
  let matched = 0;
  let lastGroup: string | undefined;
  let pendingSeparator: DropdownSeparator | null = null;

  for (const entry of entries) {
    if (entry.kind === 'separator') {
      if (!words.length && rows.length) pendingSeparator = entry;
      continue;
    }
    if (entry.kind === 'group') continue;
    if (entry.hidden) continue;
    const group = entry.group ? groups.get(entry.group) : undefined;
    if (!optionMatches(entry, words, group?.text)) continue;
    matched += 1;
    if (options.length >= limit) continue;
    if (pendingSeparator) {
      rows.push({ kind: 'separator', key: pendingSeparator.key });
      pendingSeparator = null;
    }
    if (entry.group !== lastGroup) {
      lastGroup = entry.group;
      if (group) rows.push({ kind: 'group', key: group.key, label: group.label });
    }
    rows.push({ kind: 'option', option: entry, index: options.length });
    options.push(entry);
  }
  return { rows, options, matched, capped: matched > limit };
}

const enabled = (options: DropdownOption[], i: number) => i >= 0 && i < options.length && !options[i].disabled;

/** First (or last) row that can be picked; -1 when none can. */
export function edgeIndex(options: DropdownOption[], edge: 'first' | 'last'): number {
  if (edge === 'first') return options.findIndex((o) => !o.disabled);
  for (let i = options.length - 1; i >= 0; i -= 1) if (!options[i].disabled) return i;
  return -1;
}

/**
 * Move `delta` rows from `from`, skipping disabled rows, never wrapping. Lands on the nearest
 * pickable row past the target; if there is none that way, the nearest one back towards `from`.
 * From nowhere (-1) a forward move starts at the first row and a backward one at the last.
 */
export function moveIndex(options: DropdownOption[], from: number, delta: number): number {
  if (!options.length || delta === 0) return enabled(options, from) ? from : edgeIndex(options, 'first');
  if (from < 0 || from >= options.length) return edgeIndex(options, delta > 0 ? 'first' : 'last');
  const step = delta > 0 ? 1 : -1;
  const target = Math.max(0, Math.min(options.length - 1, from + delta));
  for (let i = target; i >= 0 && i < options.length; i += step) if (enabled(options, i)) return i;
  for (let i = target - step; i !== from - step && i >= 0 && i < options.length; i -= step) if (enabled(options, i)) return i;
  return enabled(options, from) ? from : -1;
}

/**
 * Type-ahead: the next pickable row whose label starts with what was typed. Repeating one letter
 * ("bbb") cycles through the rows starting with it; a longer prefix may stay on the current row.
 */
export function typeAheadIndex(options: DropdownOption[], typed: string, from: number): number {
  const search = foldText(typed);
  if (!search.trim() && search.length) return -1;
  const repeated = search.length > 1 && [...search].every((ch) => ch === search[0]);
  const prefix = repeated ? search[0] : search;
  const n = options.length;
  const start = Math.max(from, 0);
  // One letter (or a repeat) starts after the current row; a growing prefix starts on it.
  const first = prefix.length === 1 && from >= 0 ? 1 : 0;
  for (let k = first; k < n + first; k += 1) {
    const i = (start + k) % n;
    if (!options[i].disabled && foldText(options[i].text).trimStart().startsWith(prefix)) return i;
  }
  return -1;
}

/** Is this key press a character for type-ahead or the search box (not a shortcut)? */
export function isPrintableKey(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}
