/**
 * A random id for this browser, so a QR page opened twice by the same phone counts as one «open» in the stats.
 * Kept in localStorage; where storage is blocked a fresh id per page load still counts the visit (once).
 */
const KEY = 'tl:visitor';

function randomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

let fallback: string | null = null;

export function visitorKey(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
    const fresh = randomKey();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    fallback ??= randomKey();
    return fallback;
  }
}
