/**
 * When a season is on (owner, 2026-10-26: Halloween across the LMS until the night of 31 October).
 *
 * Every boundary is an instant written with Almaty's offset (+05:00, all of Kazakhstan since March
 * 2024), so a device whose clock is set to another zone still switches at Almaty midnight. The end
 * is enforced here, in the bundle: no deploy is needed to take a season down, and a PWA still
 * running last week's bundle drops it on time too.
 */

export type SeasonId = 'halloween';

export interface Season {
  id: SeasonId;
  /** Inclusive. */
  startsAt: string;
  /** Exclusive: the first instant the season is over. */
  endsAt: string;
}

export const SEASONS: readonly Season[] = [
  { id: 'halloween', startsAt: '2026-10-26T00:00:00+05:00', endsAt: '2026-11-01T00:00:00+05:00' },
];

/** The season on at `now` (ms since epoch), or null. */
export function seasonAt(now: number, seasons: readonly Season[] = SEASONS): SeasonId | null {
  const on = seasons.find((s) => Date.parse(s.startsAt) <= now && now < Date.parse(s.endsAt));
  return on ? on.id : null;
}

/** The next instant a season starts or ends after `now`, or null when none is left. */
export function nextChangeAt(now: number, seasons: readonly Season[] = SEASONS): number | null {
  const ahead = seasons
    .flatMap((s) => [Date.parse(s.startsAt), Date.parse(s.endsAt)])
    .filter((t) => t > now);
  return ahead.length ? Math.min(...ahead) : null;
}
