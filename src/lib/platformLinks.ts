// Centralized map of learning tracks to their dedicated Master Education platforms.
//
// These are public marketing/app hostnames, not secrets, so they are declared here
// rather than in the environment: `.env.production` is committed and baked into the
// image at build time, so an env var would add a deploy step without adding safety.
// An override is still supported for staging.
//
// There is no SSO deep-link or token-handoff helper in this codebase - the LMS is an
// OIDC relying party only. All three platforms share the same Zitadel session, so the
// target's "Continue with Master Education" completes silently when the IdP session is
// live. Anything richer would be new work in the target repos.
import type { CourseType } from '../types';

export type PlatformTrack = Extract<CourseType, 'sat' | 'nuet' | 'ielts'>;

export interface PlatformLink {
  track: PlatformTrack;
  url: string;
  label: string;
  description: string;
}

const env = (import.meta as any).env ?? {};

export const PLATFORM_URLS: Record<PlatformTrack, string> = {
  sat: env.VITE_SAT_PLATFORM_URL || 'https://sat.mastereducation.kz',
  nuet: env.VITE_NUET_PLATFORM_URL || 'https://nuet.mastereducation.kz',
  ielts: env.VITE_IELTS_PLATFORM_URL || 'https://ielts.mastereducation.kz',
};

const PLATFORM_DESCRIPTIONS: Record<PlatformTrack, string> = {
  sat: 'Practice tests, question bank and score analytics',
  nuet: 'NUET practice sets and mock exams',
  ielts: 'Speaking, writing and full mock tests',
};

const TRACK_ORDER: PlatformTrack[] = ['sat', 'nuet', 'ielts'];

const isPlatformTrack = (value: unknown): value is PlatformTrack =>
  value === 'sat' || value === 'nuet' || value === 'ielts';

/**
 * Map a student's resolved program types to their platform links.
 *
 * Deduplicates (a student in two SAT groups gets one SAT tile) and returns a stable
 * SAT -> NUET -> IELTS order so the row does not reshuffle between renders.
 * `general_english` intentionally has no platform and yields nothing.
 */
export const platformLinksForTracks = (
  tracks: Iterable<CourseType | string | undefined | null>,
): PlatformLink[] => {
  const seen = new Set<PlatformTrack>();
  for (const track of tracks) {
    if (isPlatformTrack(track)) seen.add(track);
  }
  return TRACK_ORDER.filter((t) => seen.has(t)).map((track) => ({
    track,
    url: PLATFORM_URLS[track],
    label: track.toUpperCase(),
    description: PLATFORM_DESCRIPTIONS[track],
  }));
};
