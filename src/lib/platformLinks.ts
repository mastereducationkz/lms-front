// Centralized map of learning tracks to their dedicated Master Education platforms.
//
// These are public marketing/app hostnames, not secrets, so they are declared here
// rather than in the environment: `.env.production` is committed and baked into the
// image at build time, so an env var would add a deploy step without adding safety.
// An override is still supported for staging.
//
// Deep links go through `openPlatformPage`: the LMS mints a 60-second signed handoff link
// (Platform Integration Pack §3) so the platform opens already signed in. When minting is
// unavailable (flag off, role not allowed, offline) we fall back to the bare host + path,
// where the shared Zitadel session still completes "Continue with Master Education".
import type { CourseType } from '../types';
import { mintHandoff, type HandoffPlatform } from '../services/api/handoff';
import { activeLocale, t, type Locale, type MessageKey } from './i18n';
import '@/lib/i18n/catalogs/studentHome';

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

const PLATFORM_DESCRIPTIONS: Record<PlatformTrack, MessageKey> = {
  sat: 'studentHome.programs.description.sat',
  nuet: 'studentHome.programs.description.nuet',
  ielts: 'studentHome.programs.description.ielts',
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
  locale: Locale = activeLocale(),
): PlatformLink[] => {
  const seen = new Set<PlatformTrack>();
  for (const track of tracks) {
    if (isPlatformTrack(track)) seen.add(track);
  }
  return TRACK_ORDER.filter((t) => seen.has(t)).map((track) => ({
    track,
    url: PLATFORM_URLS[track],
    label: track.toUpperCase(),
    description: t(PLATFORM_DESCRIPTIONS[track], undefined, locale),
  }));
};

// NUET lives on the SAT platform; the handoff token audience is "sat".
const handoffPlatformFor = (track: PlatformTrack): HandoffPlatform =>
  track === 'ielts' ? 'ielts' : 'sat';

const normalisePath = (path: string): string => {
  const trimmed = (path || '/').trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
  return trimmed;
};

/** The bare platform URL for `path` — the pre-handoff behaviour and the fallback. */
export const platformPageUrl = (track: PlatformTrack, path = '/'): string =>
  `${PLATFORM_URLS[track]}${normalisePath(path)}`;

/**
 * Resolve the URL to open: a fresh handoff link when the LMS can mint one, else the bare URL.
 */
export async function resolvePlatformPageUrl(track: PlatformTrack, path = '/'): Promise<string> {
  const target = normalisePath(path);
  try {
    const link = await mintHandoff(handoffPlatformFor(track), target);
    if (link?.url) return link.url;
  } catch {
    // flag off / not allowed / offline: fall back to the bare host below
  }
  return platformPageUrl(track, target);
}

/**
 * Open `path` on the platform in a new tab, signed in via handoff when possible.
 *
 * The tab is opened synchronously (still inside the click) so popup blockers allow it,
 * then pointed at the handoff link once minted; if the browser refused the blank tab we
 * open the resolved URL directly as a last resort, and if even that is blocked/throws we
 * fall back to navigating the current tab so the student is never left stuck.
 *
 * iOS Safari (LMS-FRONT-2): nulling `opener` on the pre-opened tab can leave WebKit treating
 * it as an unnavigable/foreign window, so later setting its `location` throws
 * `SecurityError: The operation is insecure` instead of navigating. Every window/location
 * operation below is therefore wrapped so that error (or a refused/blocked popup) degrades to
 * same-tab navigation rather than leaving the student on a dead blank tab with no way through.
 */
export async function openPlatformPage(track: PlatformTrack, path = '/'): Promise<void> {
  let tab: Window | null = null;
  if (typeof window !== 'undefined') {
    try {
      tab = window.open('about:blank', '_blank');
    } catch {
      tab = null;
    }
  }
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      // Falls through to the location-assignment attempt below, which handles `tab` being left
      // unusable by this the same way it handles the SecurityError case.
    }
  }
  const url = await resolvePlatformPageUrl(track, path);
  if (tab) {
    try {
      if (!tab.closed) {
        tab.location.href = url;
        return;
      }
    } catch {
      // SecurityError or similar: fall through and try a fresh tab, then the current one.
    }
    // Don't leave the student a stray blank tab next to wherever the fallback lands.
    try {
      tab.close();
    } catch {
      // Nothing more to do: the fallbacks below still get the student there.
    }
  }
  try {
    if (window.open(url, '_blank', 'noopener,noreferrer')) return;
  } catch {
    // Popup blocked/refused — common once we're past the `await` above, outside the click's
    // original gesture on mobile. Fall through to same-tab navigation.
  }
  window.location.assign(url);
}

/**
 * Recognise a platform page URL (the link of an auto-managed weekly-test calendar event) as
 * `track` + relative path, so the click can go through the signed handoff instead of a bare tab.
 */
export function parsePlatformUrl(url: string | null | undefined): { track: PlatformTrack; path: string } | null {
  const match = /^https?:\/\/([^/?#]+)([^#]*)/i.exec((url || '').trim());
  if (!match) return null;
  const host = match[1].toLowerCase();
  for (const track of Object.keys(PLATFORM_URLS) as PlatformTrack[]) {
    const base = /^https?:\/\/([^/?#]+)/i.exec(PLATFORM_URLS[track]);
    if (base && base[1].toLowerCase() === host) return { track, path: match[2] || '/' };
  }
  return null;
}
