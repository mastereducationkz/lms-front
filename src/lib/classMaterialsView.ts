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
