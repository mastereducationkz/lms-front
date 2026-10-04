/**
 * Which programme a course belongs to, read from its title — «Master SAT: Verbal and Maths»,
 * «Master IELTS», «NUET», «General English. From A2 to B1». Drives the course card's generated
 * cover (owner, 2026-10-04: a clean gradient per programme instead of a cropped logo).
 */
export type ProgramKey = 'sat' | 'ielts' | 'nuet' | 'english' | 'other';

export function programOf(title: string | null | undefined): ProgramKey {
  const t = title ?? '';
  if (/\bIELTS\b/i.test(t)) return 'ielts';
  if (/\bNUET\b/i.test(t)) return 'nuet';
  if (/\bSAT\b/i.test(t)) return 'sat'; // Pre-SAT included
  if (/english|английск|ағылшын/i.test(t)) return 'english';
  return 'other';
}

/** The short label on the cover chip: «SAT», «Pre-SAT», «IELTS», «NUET», «English», «Course». */
export function programLabel(title: string | null | undefined): string {
  const program = programOf(title);
  if (program === 'sat' && /\bpre[\s_-]*sat\b/i.test(title ?? '')) return 'Pre-SAT';
  return PROGRAM_LABELS[program];
}

const PROGRAM_LABELS: Record<ProgramKey, string> = {
  sat: 'SAT',
  ielts: 'IELTS',
  nuet: 'NUET',
  english: 'English',
  other: 'Course',
};

/**
 * An uploaded cover is shown full-bleed only when it is banner-shaped. Square and portrait
 * images are logos or icons (every course's «cover» was the square Master logo, cropped into a
 * giant emblem) — the generated cover already carries the brand, so they fall back to it.
 */
export const MIN_COVER_RATIO = 1.3;

export function isBannerShaped(width: number, height: number): boolean {
  return width > 0 && height > 0 && width / height >= MIN_COVER_RATIO;
}

/** «15% · 1 из 31 урока» — the percentage first, then the lesson count when there is one. */
export function progressSummary(percentage: number | null | undefined, lessons: string): string {
  const pct = `${Math.max(0, Math.min(100, Math.round(percentage ?? 0)))}%`;
  return lessons ? `${pct} · ${lessons}` : pct;
}
