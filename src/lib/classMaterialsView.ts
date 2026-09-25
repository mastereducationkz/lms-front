import type { MaterialItem } from '../services/api/classMaterials';

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
