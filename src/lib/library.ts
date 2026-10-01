import { ALLOWED_EXTS, VIDEO_EXTS, fileExt, type PreCheckError } from './classMaterials';
import type { MaterialItem } from '../services/api/classMaterials';
import type {
  LibraryGroupBlock, LibraryItem, LibraryProgram, LibraryProgramBlock, LibrarySection, LibraryView,
} from '../services/api/library';

/**
 * «Библиотека» (docs/materials-library/SPEC.md) — the pure half: program labels, the search
 * filter, the chunk planner behind the resumable upload, reorder helpers and the adapter that
 * lets a library item reuse the lesson-materials row and viewer.
 */

export const PROGRAMS: { key: LibraryProgram; label: string }[] = [
  { key: 'sat', label: 'SAT' },
  { key: 'ielts', label: 'IELTS' },
  { key: 'general_english', label: 'General English' },
  { key: 'nuet', label: 'NUET' },
];

export function programLabel(program: string): string {
  return PROGRAMS.find((p) => p.key === program)?.label ?? program.toUpperCase();
}

/** The library's own cap (L4): lesson uploads keep their 50 MB, the library takes books up to 150 MB. */
export const LIBRARY_MAX_BYTES = 150 * 1024 * 1024;

export type LibraryPreCheckError = Exclude<PreCheckError, 'too_large'> | 'library_too_large';

/** `preCheckFile`'s rule with the library's size cap, checked before a byte is sent. */
export function preCheckLibraryFile(file: Pick<File, 'name' | 'size'>): LibraryPreCheckError | null {
  const ext = fileExt(file.name);
  if ((VIDEO_EXTS as readonly string[]).includes(ext)) return 'video_not_allowed';
  if (!(ALLOWED_EXTS as readonly string[]).includes(ext)) return 'unsupported_type';
  if (file.size === 0) return 'empty_file';
  if (file.size > LIBRARY_MAX_BYTES) return 'library_too_large';
  return null;
}

export interface ChunkPlan {
  index: number;
  start: number;
  end: number;
}

/** The byte ranges of a `size`-byte file cut into `chunkSize` pieces (the last one shorter). */
export function planChunks(size: number, chunkSize: number): ChunkPlan[] {
  if (size <= 0 || chunkSize <= 0) return [];
  const plan: ChunkPlan[] = [];
  for (let start = 0, index = 0; start < size; start += chunkSize, index += 1) {
    plan.push({ index, start, end: Math.min(start + chunkSize, size) });
  }
  return plan;
}

/** The chunks the server has not confirmed yet — what a resumed upload still has to send. */
export function missingChunks(plan: ChunkPlan[], received: Iterable<number>): ChunkPlan[] {
  const have = new Set(received);
  return plan.filter((chunk) => !have.has(chunk.index));
}

/** 0–100 for a progress bar: confirmed chunks plus the bytes of the one in flight. */
export function uploadPercent(plan: ChunkPlan[], done: Iterable<number>, inFlightBytes = 0): number {
  const total = plan.length ? plan[plan.length - 1].end : 0;
  if (!total) return 0;
  const have = new Set(done);
  const sent = plan.reduce((sum, chunk) => sum + (have.has(chunk.index) ? chunk.end - chunk.start : 0), 0);
  return Math.min(100, Math.round(((sent + inFlightBytes) / total) * 100));
}

/** Wait before retry `attempt` (1-based) of one chunk: 1 s, 2 s, 4 s… */
export function retryDelayMs(attempt: number): number {
  return 1000 * 2 ** Math.max(0, attempt - 1);
}

/** `ids` with `id` moved one place up (-1) or down (+1); null when it is already at that end. */
export function moveId(ids: number[], id: number, direction: -1 | 1): number[] | null {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const next = ids.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function matches(text: string | null | undefined, needle: string): boolean {
  return !!text && text.toLocaleLowerCase().includes(needle);
}

/** A section as the search leaves it: all of it when its title matches, else its matching items. */
export function filterSection(section: LibrarySection, q: string): LibrarySection | null {
  const needle = q.trim().toLocaleLowerCase();
  if (!needle) return section;
  if (matches(section.title, needle)) return section;
  const items = section.items.filter((item) => matches(item.title, needle) || matches(item.file?.original_name, needle));
  return items.length ? { ...section, items } : null;
}

function filterSections(sections: LibrarySection[], q: string): LibrarySection[] {
  return sections.map((s) => filterSection(s, q)).filter((s): s is LibrarySection => s !== null);
}

/**
 * The library with only what matches `q` (titles of sections and items, and a file's original
 * name). Without a query nothing is dropped — an empty program stays so a manager can fill it; with
 * one, blocks left empty go.
 */
export function filterLibrary(view: LibraryView, q: string): LibraryView {
  if (!q.trim()) return view;
  const programs: LibraryProgramBlock[] = view.programs
    .map((p) => ({ ...p, sections: filterSections(p.sections, q) }))
    .filter((p) => p.sections.length > 0);
  const groups: LibraryGroupBlock[] = view.groups
    .map((g) => ({ ...g, sections: filterSections(g.sections, q) }))
    .filter((g) => g.sections.length > 0);
  return { ...view, programs, groups };
}

/** Group blocks without the caller's own sections — a teacher already sees those under «Мои разделы». */
export function withoutOwnSections(groups: LibraryGroupBlock[], ownIds: Iterable<number>): LibraryGroupBlock[] {
  const own = new Set(ownIds);
  return groups
    .map((g) => ({ ...g, sections: g.sections.filter((s) => !own.has(s.id)) }))
    .filter((g) => g.sections.length > 0);
}

/** Whether the viewer has anything at all to read (the student empty state). */
export function hasAnyItems(view: LibraryView): boolean {
  const any = (sections: LibrarySection[]) => sections.some((s) => s.items.length > 0);
  return view.programs.some((p) => any(p.sections)) || view.groups.some((g) => any(g.sections));
}

/** A library item in the lesson row's shape, so `MaterialRow`/`MaterialViewer` serve both. */
export function toMaterialItem(item: LibraryItem): MaterialItem {
  return {
    id: item.id,
    event_id: 0,
    kind: item.kind,
    title: item.title,
    position: item.position,
    show_after_end: false,
    hidden_until_end: false,
    added_by: item.added_by,
    added_at: item.added_at,
    file: item.file,
    url: item.url,
    removed: item.removed ? { kind: 'moderated', ...item.removed } : null,
    can_edit: item.can_remove,
    can_rename: item.can_remove && item.kind === 'link',
    can_detach: item.can_remove,
    can_moderate: item.can_moderate,
  };
}

export type MaterialsTab = 'lessons' | 'library';

/** Which tab the «Материалы» page opens on: a lesson deep link always wins over `?tab=library`. */
export function initialMaterialsTab(params: URLSearchParams): MaterialsTab {
  if (params.get('lesson')) return 'lessons';
  return params.get('tab') === 'library' ? 'library' : 'lessons';
}

/** The bell types the library sends (SPEC §8, §7). */
export const LIBRARY_NOTIFICATION_TYPES = ['library', 'library_item_removed'];

export const LIBRARY_PATH = '/materials?tab=library';

/** Where a bell item leads: the library tab for library notices, else null (the caller's default). */
export function libraryNotificationPath(notificationType: string): string | null {
  return LIBRARY_NOTIFICATION_TYPES.includes(notificationType) ? LIBRARY_PATH : null;
}
