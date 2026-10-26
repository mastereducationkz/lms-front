import type { MessageKey } from '@/lib/i18n';
import '@/lib/i18n/catalogs/seasonal';

/** Treats live in the catalog as seasonal.halloween.treat.1 … .8. */
export const TREAT_COUNT = 8;
/** The first treat on a device points at the hunt. */
export const HUNT_HINT = 6;

/** The next treat to show: the hunt hint first, then any but the one just shown. */
export function nextTreat(previous: number | null, random: () => number = Math.random): number {
  if (previous === null) return HUNT_HINT;
  const pick = 1 + Math.floor(random() * (TREAT_COUNT - 1));
  return pick >= previous ? pick + 1 : pick;
}

export const treatKey = (n: number) => `seasonal.halloween.treat.${n}` as MessageKey;
