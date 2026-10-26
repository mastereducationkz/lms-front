import type { SeasonId } from './calendar';

/**
 * The student dashboard banner's look during a season — only for students who never picked a
 * banner colour themselves; a chosen colour always wins. Same shape as DashboardHero's presets.
 */
export interface SeasonHero {
  key: string;
  css: string;
  tile: string;
  hue: number;
  sat: number;
}

const HEROES: Record<SeasonId, SeasonHero> = {
  // A Halloween night, one flat deep violet (an image value, as the banner reads it); white text
  // and the flip board read at >= 13:1.
  halloween: { key: 'halloween', css: 'linear-gradient(#2d1a4a, #2d1a4a)', tile: '#22133a', hue: 268, sat: 34 }, // taste-skill-ignore
};

export function seasonHero(season: SeasonId | null): SeasonHero | null {
  return season ? HEROES[season] : null;
}
