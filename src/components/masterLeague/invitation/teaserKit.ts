/** The kit pieces shown as a teaser («This could be you»): one look per piece, found by key so it follows the catalogue. */
import { CATEGORY_PARTS, type MascotCategory, type MascotConfig } from '@/components/mascot/config';
import type { LeagueTheme } from '@/lib/leagueThemeName';

const indexOf = (category: MascotCategory, key: string): number => Math.max(0, CATEGORY_PARTS[category].findIndex((p) => p.key === key));

const BASE: MascotConfig = { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0 };

/** Six small looks, each wearing one piece of the season's kit; the first is the full dress. */
export function teaserLooks(theme: LeagueTheme = 'football'): { key: string; config: MascotConfig }[] {
  const wear = (key: string, patch: Partial<MascotConfig>) => ({ key, config: { ...BASE, ...patch } });
  if (theme === 'studio') {
    return [
      wear('studio_headphones', { hat: indexOf('hat', 'studio_headphones'), frame: indexOf('frame', 'gold_record'), expression: 4 }),
      wear('vinyl_snapback', { hat: indexOf('hat', 'vinyl_snapback') }),
      wear('vintage_mic', { prop: indexOf('prop', 'vintage_mic') }),
      wear('mixing_fader', { prop: indexOf('prop', 'mixing_fader') }),
      wear('master_tape', { prop: indexOf('prop', 'master_tape') }),
      wear('studio_booth', { background: indexOf('background', 'studio_booth') }),
    ];
  }
  return [
    wear('league_jersey', { hat: indexOf('hat', 'league_jersey'), frame: indexOf('frame', 'league_crest'), expression: 4 }),
    wear('hat_trick_topper', { hat: indexOf('hat', 'hat_trick_topper') }),
    wear('silver_whistle', { prop: indexOf('prop', 'silver_whistle') }),
    wear('squad_pennant', { prop: indexOf('prop', 'squad_pennant') }),
    wear('gold_clipboard', { prop: indexOf('prop', 'gold_clipboard') }),
    wear('stadium_lights', { background: indexOf('background', 'stadium_lights') }),
  ];
}
