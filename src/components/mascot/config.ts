/**
 * Student orca avatars (owner, 2026-10-04): a mix-and-match mascot built from five layers.
 *
 * A look is stored as a compact, versioned code — `v1.h3.g0.e2.p5.b4` — in `users.mascot`.
 * The backend validates the same code (lms-backend `src/auth/mascot.py`, PART_COUNTS): adding a
 * part means appending it to the END of its list here AND raising the count there. Never reorder
 * or remove an entry: saved codes point at positions.
 */

export type MascotCategory = 'hat' | 'eyewear' | 'expression' | 'prop' | 'background';

export interface MascotConfig {
  hat: number;
  eyewear: number;
  expression: number;
  prop: number;
  background: number;
}

export interface MascotPart {
  key: string;
  label: string;
}

export const HATS: MascotPart[] = [
  { key: 'none', label: 'No hat' },
  { key: 'graduate', label: 'Graduate cap' },
  { key: 'headphones', label: 'Headphones' },
  { key: 'astronaut', label: 'Astronaut' },
  { key: 'cape', label: 'Superhero cape' },
  { key: 'crown', label: 'Crown' },
  { key: 'wizard', label: 'Wizard hat' },
  { key: 'detective', label: 'Detective' },
  { key: 'ninja', label: 'Ninja band' },
  { key: 'pirate', label: 'Pirate hat' },
  { key: 'party', label: 'Party hat' },
  { key: 'takiya', label: 'Тақия' },
  { key: 'beanie', label: 'Beanie & scarf' },
  { key: 'nightcap', label: 'Nightcap' },
  { key: 'cap', label: 'Backwards cap' },
  { key: 'bandana', label: 'Rockstar bandana' },
  { key: 'master-hoodie', label: 'Master hoodie' },
];

export const EYEWEAR: MascotPart[] = [
  { key: 'none', label: 'None' },
  { key: 'round', label: 'Round glasses' },
  { key: 'shades', label: 'Sunglasses' },
  { key: 'stars', label: 'Star glasses' },
  { key: 'hearts', label: 'Heart glasses' },
  { key: 'monocle', label: 'Monocle' },
  { key: 'eyepatch', label: 'Eyepatch' },
  { key: 'goggles', label: 'Goggles' },
];

export const EXPRESSIONS: MascotPart[] = [
  { key: 'happy', label: 'Happy' },
  { key: 'wink', label: 'Wink' },
  { key: 'cool', label: 'Cool' },
  { key: 'starstruck', label: 'Star-eyes' },
  { key: 'determined', label: 'Determined' },
  { key: 'sleepy', label: 'Sleepy' },
  { key: 'surprised', label: 'Surprised' },
  { key: 'laughing', label: 'Laughing' },
];

export const PROPS: MascotPart[] = [
  { key: 'none', label: 'Nothing' },
  { key: 'laptop', label: 'Laptop' },
  { key: 'book', label: 'Book' },
  { key: 'coffee', label: 'Late-night coffee' },
  { key: 'pillow', label: 'Pillow' },
  { key: 'calculator', label: 'Calculator' },
  { key: 'quill', label: 'Quill' },
  { key: 'rocket', label: 'Rocket' },
  { key: 'guitar', label: 'Guitar' },
  { key: 'controller', label: 'Game controller' },
  { key: 'magnifier', label: 'Magnifying glass' },
  { key: 'decks', label: 'DJ decks' },
  { key: 'wave', label: 'Surf wave' },
  { key: 'pencil', label: 'Pencil' },
  { key: 'trophy', label: 'Trophy' },
  { key: 'cupcake', label: 'Cupcake' },
];

export const BACKGROUNDS: MascotPart[] = [
  { key: 'sat', label: 'SAT blue' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'sunset', label: 'Sunset' },
  { key: 'mint', label: 'Mint' },
  { key: 'night', label: 'Starry night' },
  { key: 'lemon', label: 'Lemon' },
  { key: 'coral', label: 'Coral' },
  { key: 'space', label: 'Deep space' },
  { key: 'forest', label: 'Forest' },
  { key: 'lilac', label: 'Lilac' },
  { key: 'master', label: 'Master blue' },
];

export const CATEGORY_PARTS: Record<MascotCategory, MascotPart[]> = {
  hat: HATS,
  eyewear: EYEWEAR,
  expression: EXPRESSIONS,
  prop: PROPS,
  background: BACKGROUNDS,
};

/** Order of the segments in a code, with their one-letter tags. */
const SEGMENTS: [MascotCategory, string][] = [
  ['hat', 'h'],
  ['eyewear', 'g'],
  ['expression', 'e'],
  ['prop', 'p'],
  ['background', 'b'],
];

export const MASCOT_VERSION = 'v1';

export function serializeMascot(config: MascotConfig): string {
  return [MASCOT_VERSION, ...SEGMENTS.map(([cat, tag]) => `${tag}${config[cat]}`)].join('.');
}

/** Parses a stored code; returns null for anything that isn't a valid v1 code. */
export function parseMascot(code: string | null | undefined): MascotConfig | null {
  if (!code) return null;
  const parts = code.trim().split('.');
  if (parts.length !== SEGMENTS.length + 1 || parts[0] !== MASCOT_VERSION) return null;
  const config = {} as MascotConfig;
  for (let i = 0; i < SEGMENTS.length; i++) {
    const [cat, tag] = SEGMENTS[i];
    const m = new RegExp(`^${tag}(\\d{1,2})$`).exec(parts[i + 1]);
    if (!m) return null;
    const n = Number(m[1]);
    if (n >= CATEGORY_PARTS[cat].length) return null;
    config[cat] = n;
  }
  return config;
}

export function isValidMascot(code: string | null | undefined): boolean {
  return parseMascot(code) !== null;
}

/** 32-bit integer hash with good avalanche (lowbias32). */
function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Deterministic pseudo-random generator, used for seeding and for Shuffle. */
export function makeRng(seed: number): () => number {
  let state = mix(seed >>> 0 || 1);
  return () => {
    state = mix(state + 0x9e3779b9);
    return state / 0x100000000;
  };
}

const pick = (rng: () => number, n: number) => Math.floor(rng() * n);

/** A random but always good-looking look: most orcas wear something and hold something. */
export function randomMascot(rng: () => number): MascotConfig {
  return {
    hat: rng() < 0.85 ? 1 + pick(rng, HATS.length - 1) : 0,
    eyewear: rng() < 0.35 ? 1 + pick(rng, EYEWEAR.length - 1) : 0,
    expression: pick(rng, EXPRESSIONS.length),
    prop: rng() < 0.8 ? 1 + pick(rng, PROPS.length - 1) : 0,
    background: pick(rng, BACKGROUNDS.length),
  };
}

/** The automatic orca of a student who hasn't chosen one: same id → same orca, for ever. */
export function seedMascot(userId: number | string): MascotConfig {
  const n = typeof userId === 'number' ? userId : Number.parseInt(String(userId), 10);
  return randomMascot(makeRng(Number.isFinite(n) ? n : hashString(String(userId))));
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The look to draw for a user: their saved code, else their automatic one. */
export function resolveMascot(code: string | null | undefined, userId: number | string): MascotConfig {
  return parseMascot(code) ?? seedMascot(userId);
}
