/** Ready-made looks for the builder's Presets row. Each is [hat, eyewear, expression, prop, background] — free parts only. */
import type { MascotConfig } from './config';

type Tuple = [number, number, number, number, number];

const RAW: [string, Tuple][] = [
  ['Master Kasatik', [16, 0, 0, 1, 10]],
  ['Master grad', [1, 0, 7, 14, 10]],
  ['Master hero', [4, 0, 4, 7, 10]],
  ['Master astronaut', [3, 0, 3, 7, 10]],
  ['Master late night', [16, 1, 2, 3, 4]],
  ['Classic Kasatik', [0, 0, 0, 1, 0]],
  ['Graduate', [1, 0, 0, 14, 0]],
  ['Bookworm', [0, 1, 4, 2, 9]],
  ['Focus mode', [2, 0, 4, 1, 1]],
  ['Night owl', [13, 0, 5, 3, 4]],
  ['Late-night grind', [2, 1, 2, 3, 7]],
  ['Math whiz', [0, 1, 3, 5, 3]],
  ['Verbal poet', [0, 5, 2, 6, 2]],
  ['To 1600', [3, 0, 3, 7, 7]],
  ['Superhero', [4, 0, 4, 0, 6]],
  ['Royal', [5, 0, 2, 14, 5]],
  ['Wizard', [6, 0, 1, 6, 4]],
  ['Detective', [7, 5, 4, 10, 8]],
  ['Ninja', [8, 0, 4, 13, 6]],
  ['Pirate', [9, 6, 7, 12, 1]],
  ['Party animal', [10, 3, 7, 15, 6]],
  ['Тақия', [11, 0, 0, 2, 0]],
  ['Winter study', [12, 0, 0, 3, 1]],
  ['Sleepyhead', [13, 0, 5, 4, 9]],
  ['Skater', [14, 2, 2, 0, 5]],
  ['Rockstar', [15, 2, 7, 8, 7]],
  ['DJ', [2, 2, 2, 11, 4]],
  ['Gamer', [14, 7, 4, 9, 7]],
  ['Surfer', [0, 2, 7, 12, 1]],
  ['Lovestruck', [0, 4, 0, 2, 6]],
  ['Starstruck', [0, 3, 3, 0, 5]],
  ['Test day', [0, 0, 4, 13, 0]],
  ['Champion', [5, 0, 7, 14, 2]],
  ['Space cadet', [3, 0, 6, 7, 4]],
  ['Study buddy', [0, 1, 0, 2, 3]],
  ['Coffee lover', [0, 0, 1, 3, 2]],
  ['Dreamer', [0, 0, 5, 7, 4]],
  ['Explorer', [7, 7, 6, 10, 8]],
  ['Cheerful', [10, 0, 0, 0, 9]],
  ['Techie', [14, 1, 0, 1, 3]],
  ['Wise wizard', [6, 5, 2, 2, 9]],
  ['Hero student', [4, 1, 4, 2, 0]],
  ['Chill', [0, 2, 2, 0, 3]],
  ['Snow day', [12, 7, 7, 0, 1]],
  ['Calculator ninja', [8, 1, 4, 5, 8]],
  ['Top scorer', [1, 2, 2, 14, 7]],
  ['Birthday', [10, 0, 7, 15, 5]],
];

export interface MascotPreset {
  name: string;
  config: MascotConfig;
}

export const PRESETS: MascotPreset[] = RAW.map(([name, [hat, eyewear, expression, prop, background]]) => ({
  name,
  // presets are free looks: no reward parts, no frame
  config: { hat, eyewear, expression, prop, background, frame: 0 },
}));
