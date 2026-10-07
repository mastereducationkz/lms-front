/** Ready-made looks for the builder's Presets row. Each is [hat, eyewear, expression, prop, background] — free parts only. */
import type { MessageKey } from '@/lib/i18n';
import type { MascotConfig } from './config';
import '@/lib/i18n/catalogs/studentHome';

type Tuple = [number, number, number, number, number];

const RAW: [MessageKey, Tuple][] = [
  ['studentHome.wardrobe.preset.masterKasatik', [16, 0, 0, 1, 10]],
  ['studentHome.wardrobe.preset.masterGrad', [1, 0, 7, 14, 10]],
  ['studentHome.wardrobe.preset.masterHero', [4, 0, 4, 7, 10]],
  ['studentHome.wardrobe.preset.masterAstronaut', [3, 0, 3, 7, 10]],
  ['studentHome.wardrobe.preset.masterLateNight', [16, 1, 2, 3, 4]],
  ['studentHome.wardrobe.preset.classicKasatik', [0, 0, 0, 1, 0]],
  ['studentHome.wardrobe.preset.graduate', [1, 0, 0, 14, 0]],
  ['studentHome.wardrobe.preset.bookworm', [0, 1, 4, 2, 9]],
  ['studentHome.wardrobe.preset.focusMode', [2, 0, 4, 1, 1]],
  ['studentHome.wardrobe.preset.nightOwl', [13, 0, 5, 3, 4]],
  ['studentHome.wardrobe.preset.lateNightGrind', [2, 1, 2, 3, 7]],
  ['studentHome.wardrobe.preset.mathWhiz', [0, 1, 3, 5, 3]],
  ['studentHome.wardrobe.preset.verbalPoet', [0, 5, 2, 6, 2]],
  ['studentHome.wardrobe.preset.to1600', [3, 0, 3, 7, 7]],
  ['studentHome.wardrobe.preset.superhero', [4, 0, 4, 0, 6]],
  ['studentHome.wardrobe.preset.royal', [5, 0, 2, 14, 5]],
  ['studentHome.wardrobe.preset.wizard', [6, 0, 1, 6, 4]],
  ['studentHome.wardrobe.preset.detective', [7, 5, 4, 10, 8]],
  ['studentHome.wardrobe.preset.ninja', [8, 0, 4, 13, 6]],
  ['studentHome.wardrobe.preset.pirate', [9, 6, 7, 12, 1]],
  ['studentHome.wardrobe.preset.partyAnimal', [10, 3, 7, 15, 6]],
  ['studentHome.wardrobe.preset.takiya', [11, 0, 0, 2, 0]],
  ['studentHome.wardrobe.preset.winterStudy', [12, 0, 0, 3, 1]],
  ['studentHome.wardrobe.preset.sleepyhead', [13, 0, 5, 4, 9]],
  ['studentHome.wardrobe.preset.skater', [14, 2, 2, 0, 5]],
  ['studentHome.wardrobe.preset.rockstar', [15, 2, 7, 8, 7]],
  ['studentHome.wardrobe.preset.dj', [2, 2, 2, 11, 4]],
  ['studentHome.wardrobe.preset.gamer', [14, 7, 4, 9, 7]],
  ['studentHome.wardrobe.preset.surfer', [0, 2, 7, 12, 1]],
  ['studentHome.wardrobe.preset.lovestruck', [0, 4, 0, 2, 6]],
  ['studentHome.wardrobe.preset.starstruck', [0, 3, 3, 0, 5]],
  ['studentHome.wardrobe.preset.testDay', [0, 0, 4, 13, 0]],
  ['studentHome.wardrobe.preset.champion', [5, 0, 7, 14, 2]],
  ['studentHome.wardrobe.preset.spaceCadet', [3, 0, 6, 7, 4]],
  ['studentHome.wardrobe.preset.studyBuddy', [0, 1, 0, 2, 3]],
  ['studentHome.wardrobe.preset.coffeeLover', [0, 0, 1, 3, 2]],
  ['studentHome.wardrobe.preset.dreamer', [0, 0, 5, 7, 4]],
  ['studentHome.wardrobe.preset.explorer', [7, 7, 6, 10, 8]],
  ['studentHome.wardrobe.preset.cheerful', [10, 0, 0, 0, 9]],
  ['studentHome.wardrobe.preset.techie', [14, 1, 0, 1, 3]],
  ['studentHome.wardrobe.preset.wiseWizard', [6, 5, 2, 2, 9]],
  ['studentHome.wardrobe.preset.heroStudent', [4, 1, 4, 2, 0]],
  ['studentHome.wardrobe.preset.chill', [0, 2, 2, 0, 3]],
  ['studentHome.wardrobe.preset.snowDay', [12, 7, 7, 0, 1]],
  ['studentHome.wardrobe.preset.calculatorNinja', [8, 1, 4, 5, 8]],
  ['studentHome.wardrobe.preset.topScorer', [1, 2, 2, 14, 7]],
  ['studentHome.wardrobe.preset.birthday', [10, 0, 7, 15, 5]],
];

export interface MascotPreset {
  /** The look's name in the wardrobe catalog — show it with t(). */
  nameKey: MessageKey;
  config: MascotConfig;
}

export const PRESETS: MascotPreset[] = RAW.map(([nameKey, [hat, eyewear, expression, prop, background]]) => ({
  nameKey,
  // presets are free looks: no reward parts, no frame
  config: { hat, eyewear, expression, prop, background, frame: 0 },
}));
