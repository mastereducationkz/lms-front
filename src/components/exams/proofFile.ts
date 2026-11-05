/** Client-side check of a score report before upload. Mirrors lms-backend `upload_result_proof`: the
 *  server sniffs magic bytes (JPEG/PNG/GIF/WEBP/PDF, 10 MB, not empty) and has the last word. */

export const PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PROOF_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf,.jpg,.jpeg,.png,.gif,.webp,.pdf';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
};
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);

export type ProofProblem = 'empty' | 'type' | 'size';

/** The file's type: its own, or the one its extension names when the browser reports none. */
export function proofMime(file: Pick<File, 'name' | 'type'>): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? '';
}

export const isPdf = (file: Pick<File, 'name' | 'type'>) => proofMime(file) === 'application/pdf';

/** `null` when the file is acceptable, else the first reason it is not. */
export function proofProblem(file: Pick<File, 'name' | 'type' | 'size'>): ProofProblem | null {
  if (!ALLOWED_MIMES.has(proofMime(file))) return 'type';
  if (file.size <= 0) return 'empty';
  if (file.size > PROOF_MAX_BYTES) return 'size';
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
