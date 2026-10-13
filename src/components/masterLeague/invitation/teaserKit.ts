/** The kit pieces shown as a teaser («This could be you»): one look per piece, found by key so it follows the catalogue. */
import { CATEGORY_PARTS, type MascotCategory, type MascotConfig } from '@/components/mascot/config';

const indexOf = (category: MascotCategory, key: string): number => Math.max(0, CATEGORY_PARTS[category].findIndex((p) => p.key === key));

const BASE: MascotConfig = { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0 };

/** Six small looks, each wearing one piece of the League kit; the first is the full dress. */
export function teaserLooks(): { key: string; config: MascotConfig }[] {
  const wear = (key: string, patch: Partial<MascotConfig>) => ({ key, config: { ...BASE, ...patch } });
  return [
    wear('league_jersey', { hat: indexOf('hat', 'league_jersey'), frame: indexOf('frame', 'league_crest'), expression: 4 }),
    wear('hat_trick_topper', { hat: indexOf('hat', 'hat_trick_topper') }),
    wear('silver_whistle', { prop: indexOf('prop', 'silver_whistle') }),
    wear('squad_pennant', { prop: indexOf('prop', 'squad_pennant') }),
    wear('gold_clipboard', { prop: indexOf('prop', 'gold_clipboard') }),
    wear('stadium_lights', { background: indexOf('background', 'stadium_lights') }),
  ];
}
