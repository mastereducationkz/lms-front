/**
 * The Master League kit (owner, 2026-10-13): what Kasatik wears on the season banner and in the
 * welcome scene, and the one-tap «Put on the kit» look. Indices are looked up by part key, never
 * hard-coded, so the kit follows the catalogue. Each season has its own kit (owner, 2026-11-02):
 * football is the jersey under stadium lights, studio is the headphones and a vintage mic in the
 * booth, inside a gold record.
 */
import type { LeagueTheme } from '@/lib/leagueThemeName';
import { CATEGORY_PARTS, applyPart, type MascotCategory, type MascotConfig } from './config';

const indexOf = (category: MascotCategory, key: string): number => CATEGORY_PARTS[category].findIndex((p) => p.key === key);

interface Kit {
  hat: string;
  prop: string;
  background: string;
  frame: string;
}

const KITS: Record<LeagueTheme, Kit> = {
  football: { hat: 'league_jersey', prop: 'silver_whistle', background: 'stadium_lights', frame: 'league_crest' },
  studio: { hat: 'studio_headphones', prop: 'vintage_mic', background: 'studio_booth', frame: 'gold_record' },
};

/** The banner's Kasatik in the season's kit with a determined face. It is decoration, owned or not. */
export function leagueKitConfig(theme: LeagueTheme = 'football'): MascotConfig {
  const kit = KITS[theme] ?? KITS.football;
  return {
    hat: indexOf('hat', kit.hat),
    eyewear: 0,
    expression: 4, // determined
    prop: indexOf('prop', kit.prop),
    background: indexOf('background', kit.background),
    frame: indexOf('frame', kit.frame),
  };
}

/**
 * The look «Put on the kit» saves: the student's own look with the two «Signed» rewards of their
 * season put on (football: jersey + crest frame; studio: headphones + gold record frame), in ONE code.
 */
export function leagueKitCode(code: string | null | undefined, userId: number | string, theme: LeagueTheme = 'football'): string {
  const kit = KITS[theme] ?? KITS.football;
  const withHat = applyPart(code, userId, 'h', indexOf('hat', kit.hat));
  return applyPart(withHat, userId, 'f', indexOf('frame', kit.frame));
}
