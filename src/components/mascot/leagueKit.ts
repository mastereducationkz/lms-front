/**
 * The Master League kit (owner, 2026-10-13): what Kasatik wears on the season banner and in the
 * welcome scene, and the one-tap «Put on the kit» look. Indices are looked up by part key, never
 * hard-coded, so the kit follows the catalogue.
 */
import { CATEGORY_PARTS, applyPart, type MascotCategory, type MascotConfig } from './config';

const indexOf = (category: MascotCategory, key: string): number => CATEGORY_PARTS[category].findIndex((p) => p.key === key);

/** The banner's Kasatik: jersey, crest frame, stadium lights, whistle and a determined face. It is decoration, owned or not. */
export function leagueKitConfig(): MascotConfig {
  return {
    hat: indexOf('hat', 'league_jersey'),
    eyewear: 0,
    expression: 4, // determined
    prop: indexOf('prop', 'silver_whistle'),
    background: indexOf('background', 'stadium_lights'),
    frame: indexOf('frame', 'league_crest'),
  };
}

/** The look «Put on the kit» saves: the student's own look with the jersey and the crest frame put on, in ONE code. */
export function leagueKitCode(code: string | null | undefined, userId: number | string): string {
  const withJersey = applyPart(code, userId, 'h', indexOf('hat', 'league_jersey'));
  return applyPart(withJersey, userId, 'f', indexOf('frame', 'league_crest'));
}
