import type { MaterialItem } from '../services/api/classMaterials';
import { validateLinkUrl } from './classMaterials';

/**
 * «Материалы урока» — which UI a material shows, derived purely from the item's own kind/ext.
 * Split out from `classMaterials.ts` (Task 11's copy/format module) because this is
 * view-selection logic for `MaterialRow`/`MaterialViewer`, not copy or formatting.
 */

export type MaterialIconKind = 'file' | 'image' | 'audio' | 'link' | 'presentation';

/**
 * The lucide icon a row shows: `presentation` only for ppt/pptx (not the other Office
 * formats, which read as a plain file), the file's own kind for image/audio, `link` for a
 * link item, and `file` for everything else.
 */
export function materialIconKind(item: Pick<MaterialItem, 'kind' | 'file'>): MaterialIconKind {
  if (item.kind === 'link') return 'link';
  const file = item.file;
  if (!file) return 'file';
  if (file.kind === 'image' || file.kind === 'audio') return file.kind;
  if (file.ext === 'ppt' || file.ext === 'pptx') return 'presentation';
  return 'file';
}

export type ViewerContentKind = 'image' | 'pdf' | 'audio' | 'download' | 'link';

/**
 * What `MaterialViewer` renders once it's asked to open an item — decided from the item
 * alone, before the signed URL even comes back, so the dialog is already the right shape
 * while it loads: a pdf gets an inline iframe, Office and HEIC/HEIF (both `kind: 'file'`
 * per D13) only a "download" button, images and audio follow the file's own kind, and a
 * link never gets a dialog at all.
 */
export function viewerContentKind(item: Pick<MaterialItem, 'kind' | 'file'>): ViewerContentKind {
  if (item.kind === 'link') return 'link';
  const file = item.file;
  if (!file) return 'download';
  if (file.kind === 'image') return 'image';
  if (file.kind === 'audio') return 'audio';
  if (file.ext === 'pdf') return 'pdf';
  return 'download';
}

/**
 * The href a link row renders as a real `<a target="_blank">`: the item's own URL, but only an
 * http(s) one (`validateLinkUrl`, the rule the backend enforces on attach). A file item, or a
 * link whose URL is missing or not http(s), gets no anchor, so a stored `javascript:` URL can
 * never become clickable. Opening through a plain anchor (not `window.open` after awaiting the
 * open log) is what keeps iOS Safari and a slow Chrome from blocking it as a popup.
 */
export function safeLinkHref(item: Pick<MaterialItem, 'kind' | 'url'>): string | null {
  if (item.kind !== 'link' || !item.url) return null;
  return validateLinkUrl(item.url) === null ? item.url : null;
}

export type PickerListState = 'ready' | 'loading' | 'failed' | 'empty';

/**
 * What the list area of a picker dialog («Из моих файлов», «Скопировать из урока…») shows. Rows
 * on screen always win; with none, a load in flight shows a spinner, and a failed load shows a
 * Retry line — never the "nothing here yet" text, which would tell a teacher their shelf is empty
 * when it only failed to load.
 */
export function pickerListState(p: { loading: boolean; failed: boolean; count: number }): PickerListState {
  if (p.count > 0) return 'ready';
  if (p.loading) return 'loading';
  if (p.failed) return 'failed';
  return 'empty';
}

export type MaterialsVisibility = 'hidden' | 'error';

/** True only for a response whose HTTP status is exactly 404 — the "this lesson isn't yours
 *  to see" answer (§4.5). A network error (no `response` at all), a timeout, or a 5xx is a
 *  different thing entirely and must not be mistaken for "you can't see this". */
function isNotFoundError(err: unknown): boolean {
  const status = (err as { response?: { status?: unknown } } | null | undefined)?.response?.status;
  return status === 404;
}

/**
 * What `ClassMaterialsSection` does when it can't show its normal content. A parent never
 * even gets a request, and a 404 means the lesson isn't this viewer's to see — both hide the
 * section outright, exactly like a missing recording (nothing here a viewer needs to act on).
 * Any other failure — a 5xx, a network blip with no `response` at all, a timeout — is NOT the
 * same as "you can't see this": hiding it would make a teacher's real, already-attached
 * materials look like they vanished, so it renders a muted retry line instead.
 */
export function materialsVisibility(input: { isParent: boolean; error?: unknown }): MaterialsVisibility {
  if (input.isParent) return 'hidden';
  return isNotFoundError(input.error) ? 'hidden' : 'error';
}

/**
 * Whether `ClassMaterialsSection` can skip its network fetch and use the `initialData` a
 * caller (Task 13, after a mutation) already has in hand — only true the very first time for
 * a given lesson. A retry (`attempt > 0`) always goes back to the network even for the same
 * `eventId`: the point of a retry is to try again, not to hand back the same payload.
 */
export function canSkipFetch(
  initialData: { lesson: { id: number } } | undefined,
  eventId: number,
  attempt: number,
): boolean {
  return !!initialData && initialData.lesson.id === eventId && attempt === 0;
}
