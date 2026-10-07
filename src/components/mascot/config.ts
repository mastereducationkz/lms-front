/**
 * Student orca avatars (owner, 2026-10-04): a mix-and-match mascot built from six layers.
 *
 * A look is stored as a compact, versioned code — `v2.h3.g0.e2.p5.b4.f0` — in `users.mascot`
 * (v1 codes, without the frame, still parse and mean frame 0). The backend validates the same code
 * (lms-backend `src/auth/mascot.py`, PART_COUNTS): adding a part means appending it to the END of
 * its list here AND raising the count there. Never reorder or remove an entry: saved codes point at
 * positions.
 *
 * Achievements (owner, 2026-10-04): every part that existed before them stays FREE (FREE_COUNTS);
 * the parts appended after are REWARDS, each unlocked by one achievement (REWARD_PARTS, mirroring
 * the shared contract and the backend catalogue). Automatic orcas, Shuffle and presets only ever
 * use free parts.
 */

export type MascotCategory = 'hat' | 'eyewear' | 'expression' | 'prop' | 'background' | 'frame';

export interface MascotConfig {
  hat: number;
  eyewear: number;
  expression: number;
  prop: number;
  background: number;
  frame: number;
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
  { key: 'takiya', label: 'Takiya' },
  { key: 'beanie', label: 'Beanie & scarf' },
  { key: 'nightcap', label: 'Nightcap' },
  { key: 'cap', label: 'Backwards cap' },
  { key: 'bandana', label: 'Rockstar bandana' },
  { key: 'master-hoodie', label: 'Master hoodie' },
  // ── rewards (achievements) ──
  { key: 'gold_master_hoodie', label: 'Gold Master hoodie' },
  { key: 'diamond_crown', label: 'Diamond crown' },
  { key: 'golden_kalpak', label: 'Golden kalpak' },
  { key: 'explorer_hat', label: 'Explorer hat' },
  { key: 'warrior_headband', label: 'Warrior headband' },
  { key: 'quiz_cap', label: 'Quiz cap' },
  { key: 'garland_scarf', label: 'Light-garland scarf' },
  { key: 'team_scarf', label: 'Team scarf' },
  { key: 'star_cape', label: 'Gold-star cape' },
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
  // ── rewards ──
  { key: 'gold_star_glasses', label: 'Gold-star glasses' },
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
  // ── rewards ──
  { key: 'swim_ring', label: 'Swim ring' },
  { key: 'fin_pencil', label: 'Pencil behind the fin' },
  { key: 'compass', label: 'Compass' },
  { key: 'clock_pin', label: 'Clock pin' },
  { key: 'golden_clock', label: 'Golden clock' },
  { key: 'bronze_medal', label: 'Bronze medal' },
  { key: 'jetpack', label: 'Jetpack' },
  { key: 'boomerang', label: 'Boomerang' },
  { key: 'diploma', label: 'Diploma' },
  { key: 'lucky_charm', label: 'Lucky charm' },
  { key: 'lightning_badge', label: 'Lightning badge' },
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
  // ── rewards ──
  { key: 'sparkle', label: 'Sparkle' },
  { key: 'sunrise', label: 'Sunrise' },
  { key: 'aurora', label: 'Aurora' },
];

export const FRAMES: MascotPart[] = [
  { key: 'none', label: 'No frame' },
  // ── rewards ──
  { key: 'flame', label: 'Flame frame' },
  { key: 'blue_flame', label: 'Blue-flame frame' },
  { key: 'gold_laurel', label: 'Gold laurel frame' },
  { key: 'star_ring', label: 'Star ring frame' },
];

export const CATEGORY_PARTS: Record<MascotCategory, MascotPart[]> = {
  hat: HATS,
  eyewear: EYEWEAR,
  expression: EXPRESSIONS,
  prop: PROPS,
  background: BACKGROUNDS,
  frame: FRAMES,
};

/** One-letter layer tags, as in the code and the achievements API (`locked_parts`, `rewards`). */
export type LayerTag = 'h' | 'g' | 'e' | 'p' | 'b' | 'f';

/** Order of the segments in a code, with their one-letter tags. */
const SEGMENTS: [MascotCategory, LayerTag][] = [
  ['hat', 'h'],
  ['eyewear', 'g'],
  ['expression', 'e'],
  ['prop', 'p'],
  ['background', 'b'],
  ['frame', 'f'],
];

export const CATEGORY_OF_TAG: Record<LayerTag, MascotCategory> = Object.fromEntries(
  SEGMENTS.map(([cat, tag]) => [tag, cat]),
) as Record<LayerTag, MascotCategory>;
export const TAG_OF_CATEGORY: Record<MascotCategory, LayerTag> = Object.fromEntries(SEGMENTS) as Record<MascotCategory, LayerTag>;

export const MASCOT_VERSION = 'v2';

/** How many parts of each layer are free: everything that existed before achievements. */
export const FREE_COUNTS: Record<MascotCategory, number> = {
  hat: 17, eyewear: 8, expression: 8, prop: 16, background: 11, frame: 1,
};

export function serializeMascot(config: MascotConfig): string {
  return [MASCOT_VERSION, ...SEGMENTS.map(([cat, tag]) => `${tag}${config[cat] ?? 0}`)].join('.');
}

/** Parses a stored code (v2, or v1 meaning frame 0); null for anything that isn't valid. */
export function parseMascot(code: string | null | undefined): MascotConfig | null {
  if (!code) return null;
  const parts = code.trim().split('.');
  const segments = parts[0] === 'v1' ? SEGMENTS.slice(0, 5) : parts[0] === 'v2' ? SEGMENTS : null;
  if (!segments || parts.length !== segments.length + 1) return null;
  const config = { frame: 0 } as MascotConfig;
  for (let i = 0; i < segments.length; i++) {
    const [cat, tag] = segments[i];
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

/**
 * A random but always good-looking look from FREE parts only: most orcas wear something and hold
 * something. The draws use the free counts, so every automatic orca stays exactly as it was before
 * reward parts were appended.
 */
export function randomMascot(rng: () => number): MascotConfig {
  return {
    hat: rng() < 0.85 ? 1 + pick(rng, FREE_COUNTS.hat - 1) : 0,
    eyewear: rng() < 0.35 ? 1 + pick(rng, FREE_COUNTS.eyewear - 1) : 0,
    expression: pick(rng, FREE_COUNTS.expression),
    prop: rng() < 0.8 ? 1 + pick(rng, FREE_COUNTS.prop - 1) : 0,
    background: pick(rng, FREE_COUNTS.background),
    frame: 0,
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

// ── achievements: reward parts and locks ─────────────────────────────────────────────────────

export interface RewardPart {
  layer: LayerTag;
  category: MascotCategory;
  index: number;
  key: string;
  name: string;
  /** The achievement that unlocks it (shared contract, backend catalogue). */
  achievement: string;
}

const REWARD_ACHIEVEMENT: Record<string, string> = {
  gold_master_hoodie: 'graduate_gold', diamond_crown: 'top_score', golden_kalpak: 'nauryz',
  explorer_hat: 'checkpoint_pro', warrior_headband: 'weekly_warrior', quiz_cap: 'live_ace',
  garland_scarf: 'winter_lights', team_scarf: 'team_spirit', star_cape: 'star_of_week',
  gold_star_glasses: 'full_marks_3',
  swim_ring: 'first_splash', fin_pencil: 'hand_in_hero', compass: 'first_checkpoint',
  clock_pin: 'on_time_5', golden_clock: 'on_time_20', bronze_medal: 'perfect_month',
  jetpack: 'score_climber', boomerang: 'comeback', diploma: 'verified_score',
  lucky_charm: 'test_day_ready', lightning_badge: 'live_wire',
  sparkle: 'hello_kasatik', sunrise: 'early_bird', aurora: 'streak_100',
  flame: 'streak_7', blue_flame: 'streak_30', gold_laurel: 'graduate_gold', star_ring: 'star_of_week_3',
};

/** Every reward part, in layer order: (layer, index) → the achievement that unlocks it. */
export const REWARD_PARTS: RewardPart[] = SEGMENTS.flatMap(([category, layer]) =>
  CATEGORY_PARTS[category]
    .map((part, index) => ({ part, index }))
    .filter(({ index }) => index >= FREE_COUNTS[category])
    .map(({ part, index }) => ({
      layer, category, index, key: part.key, name: part.label, achievement: REWARD_ACHIEVEMENT[part.key],
    })),
);

/** `locked_parts` from GET /achievements/me: reward indices the student hasn't unlocked yet. */
export type LockedParts = Partial<Record<LayerTag, number[]>>;

export function isRewardPart(category: MascotCategory, index: number): boolean {
  return index >= FREE_COUNTS[category];
}

export function rewardPart(category: MascotCategory, index: number): RewardPart | undefined {
  return REWARD_PARTS.find((r) => r.category === category && r.index === index);
}

/**
 * Is this part locked for the student? Free parts never are. With no `locked` data (API missing
 * or failed) every reward part counts as locked, so nothing unearned can be picked.
 */
export function isLockedPart(category: MascotCategory, index: number, locked: LockedParts | null | undefined): boolean {
  if (!isRewardPart(category, index)) return false;
  if (!locked) return true;
  return (locked[TAG_OF_CATEGORY[category]] ?? []).includes(index);
}

/** Does this look use any part the student hasn't unlocked? */
export function usesLockedPart(config: MascotConfig, locked: LockedParts | null | undefined): boolean {
  return SEGMENTS.some(([cat]) => isLockedPart(cat, config[cat], locked));
}

/**
 * The student's current look (saved code, else automatic) with one part swapped in — e.g. for
 * "Wear it now" after an unlock. Returns a v2 code.
 */
export function applyPart(code: string | null | undefined, userId: number | string, layer: LayerTag, index: number): string {
  const config = resolveMascot(code, userId);
  return serializeMascot({ ...config, [CATEGORY_OF_TAG[layer]]: index });
}
