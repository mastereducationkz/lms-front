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
import { activeLocale, t, type Locale, type MessageKey } from '@/lib/i18n';
import '@/lib/i18n/catalogs/studentHome';

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
  /** Its name in the wardrobe catalog (src/lib/i18n/en/studentHome/wardrobe.ts) — show it with partLabel. */
  labelKey: MessageKey;
}

export const HATS: MascotPart[] = [
  { key: 'none', labelKey: 'studentHome.wardrobe.hat.none' },
  { key: 'graduate', labelKey: 'studentHome.wardrobe.hat.graduate' },
  { key: 'headphones', labelKey: 'studentHome.wardrobe.hat.headphones' },
  { key: 'astronaut', labelKey: 'studentHome.wardrobe.hat.astronaut' },
  { key: 'cape', labelKey: 'studentHome.wardrobe.hat.cape' },
  { key: 'crown', labelKey: 'studentHome.wardrobe.hat.crown' },
  { key: 'wizard', labelKey: 'studentHome.wardrobe.hat.wizard' },
  { key: 'detective', labelKey: 'studentHome.wardrobe.hat.detective' },
  { key: 'ninja', labelKey: 'studentHome.wardrobe.hat.ninja' },
  { key: 'pirate', labelKey: 'studentHome.wardrobe.hat.pirate' },
  { key: 'party', labelKey: 'studentHome.wardrobe.hat.party' },
  { key: 'takiya', labelKey: 'studentHome.wardrobe.hat.takiya' },
  { key: 'beanie', labelKey: 'studentHome.wardrobe.hat.beanie' },
  { key: 'nightcap', labelKey: 'studentHome.wardrobe.hat.nightcap' },
  { key: 'cap', labelKey: 'studentHome.wardrobe.hat.cap' },
  { key: 'bandana', labelKey: 'studentHome.wardrobe.hat.bandana' },
  { key: 'master-hoodie', labelKey: 'studentHome.wardrobe.hat.masterHoodie' },
  // ── rewards (achievements) ──
  { key: 'gold_master_hoodie', labelKey: 'studentHome.wardrobe.hat.goldMasterHoodie' },
  { key: 'diamond_crown', labelKey: 'studentHome.wardrobe.hat.diamondCrown' },
  { key: 'golden_kalpak', labelKey: 'studentHome.wardrobe.hat.goldenKalpak' },
  { key: 'explorer_hat', labelKey: 'studentHome.wardrobe.hat.explorerHat' },
  { key: 'warrior_headband', labelKey: 'studentHome.wardrobe.hat.warriorHeadband' },
  { key: 'quiz_cap', labelKey: 'studentHome.wardrobe.hat.quizCap' },
  { key: 'garland_scarf', labelKey: 'studentHome.wardrobe.hat.garlandScarf' },
  { key: 'team_scarf', labelKey: 'studentHome.wardrobe.hat.teamScarf' },
  { key: 'star_cape', labelKey: 'studentHome.wardrobe.hat.starCape' },
];

export const EYEWEAR: MascotPart[] = [
  { key: 'none', labelKey: 'studentHome.wardrobe.eyewear.none' },
  { key: 'round', labelKey: 'studentHome.wardrobe.eyewear.round' },
  { key: 'shades', labelKey: 'studentHome.wardrobe.eyewear.shades' },
  { key: 'stars', labelKey: 'studentHome.wardrobe.eyewear.stars' },
  { key: 'hearts', labelKey: 'studentHome.wardrobe.eyewear.hearts' },
  { key: 'monocle', labelKey: 'studentHome.wardrobe.eyewear.monocle' },
  { key: 'eyepatch', labelKey: 'studentHome.wardrobe.eyewear.eyepatch' },
  { key: 'goggles', labelKey: 'studentHome.wardrobe.eyewear.goggles' },
  // ── rewards ──
  { key: 'gold_star_glasses', labelKey: 'studentHome.wardrobe.eyewear.goldStarGlasses' },
];

export const EXPRESSIONS: MascotPart[] = [
  { key: 'happy', labelKey: 'studentHome.wardrobe.expression.happy' },
  { key: 'wink', labelKey: 'studentHome.wardrobe.expression.wink' },
  { key: 'cool', labelKey: 'studentHome.wardrobe.expression.cool' },
  { key: 'starstruck', labelKey: 'studentHome.wardrobe.expression.starstruck' },
  { key: 'determined', labelKey: 'studentHome.wardrobe.expression.determined' },
  { key: 'sleepy', labelKey: 'studentHome.wardrobe.expression.sleepy' },
  { key: 'surprised', labelKey: 'studentHome.wardrobe.expression.surprised' },
  { key: 'laughing', labelKey: 'studentHome.wardrobe.expression.laughing' },
];

export const PROPS: MascotPart[] = [
  { key: 'none', labelKey: 'studentHome.wardrobe.prop.none' },
  { key: 'laptop', labelKey: 'studentHome.wardrobe.prop.laptop' },
  { key: 'book', labelKey: 'studentHome.wardrobe.prop.book' },
  { key: 'coffee', labelKey: 'studentHome.wardrobe.prop.coffee' },
  { key: 'pillow', labelKey: 'studentHome.wardrobe.prop.pillow' },
  { key: 'calculator', labelKey: 'studentHome.wardrobe.prop.calculator' },
  { key: 'quill', labelKey: 'studentHome.wardrobe.prop.quill' },
  { key: 'rocket', labelKey: 'studentHome.wardrobe.prop.rocket' },
  { key: 'guitar', labelKey: 'studentHome.wardrobe.prop.guitar' },
  { key: 'controller', labelKey: 'studentHome.wardrobe.prop.controller' },
  { key: 'magnifier', labelKey: 'studentHome.wardrobe.prop.magnifier' },
  { key: 'decks', labelKey: 'studentHome.wardrobe.prop.decks' },
  { key: 'wave', labelKey: 'studentHome.wardrobe.prop.wave' },
  { key: 'pencil', labelKey: 'studentHome.wardrobe.prop.pencil' },
  { key: 'trophy', labelKey: 'studentHome.wardrobe.prop.trophy' },
  { key: 'cupcake', labelKey: 'studentHome.wardrobe.prop.cupcake' },
  // ── rewards ──
  { key: 'swim_ring', labelKey: 'studentHome.wardrobe.prop.swimRing' },
  { key: 'fin_pencil', labelKey: 'studentHome.wardrobe.prop.finPencil' },
  { key: 'compass', labelKey: 'studentHome.wardrobe.prop.compass' },
  { key: 'clock_pin', labelKey: 'studentHome.wardrobe.prop.clockPin' },
  { key: 'golden_clock', labelKey: 'studentHome.wardrobe.prop.goldenClock' },
  { key: 'bronze_medal', labelKey: 'studentHome.wardrobe.prop.bronzeMedal' },
  { key: 'jetpack', labelKey: 'studentHome.wardrobe.prop.jetpack' },
  { key: 'boomerang', labelKey: 'studentHome.wardrobe.prop.boomerang' },
  { key: 'diploma', labelKey: 'studentHome.wardrobe.prop.diploma' },
  { key: 'lucky_charm', labelKey: 'studentHome.wardrobe.prop.luckyCharm' },
  { key: 'lightning_badge', labelKey: 'studentHome.wardrobe.prop.lightningBadge' },
];

export const BACKGROUNDS: MascotPart[] = [
  { key: 'sat', labelKey: 'studentHome.wardrobe.background.sat' },
  { key: 'ocean', labelKey: 'studentHome.wardrobe.background.ocean' },
  { key: 'sunset', labelKey: 'studentHome.wardrobe.background.sunset' },
  { key: 'mint', labelKey: 'studentHome.wardrobe.background.mint' },
  { key: 'night', labelKey: 'studentHome.wardrobe.background.night' },
  { key: 'lemon', labelKey: 'studentHome.wardrobe.background.lemon' },
  { key: 'coral', labelKey: 'studentHome.wardrobe.background.coral' },
  { key: 'space', labelKey: 'studentHome.wardrobe.background.space' },
  { key: 'forest', labelKey: 'studentHome.wardrobe.background.forest' },
  { key: 'lilac', labelKey: 'studentHome.wardrobe.background.lilac' },
  { key: 'master', labelKey: 'studentHome.wardrobe.background.master' },
  // ── rewards ──
  { key: 'sparkle', labelKey: 'studentHome.wardrobe.background.sparkle' },
  { key: 'sunrise', labelKey: 'studentHome.wardrobe.background.sunrise' },
  { key: 'aurora', labelKey: 'studentHome.wardrobe.background.aurora' },
];

export const FRAMES: MascotPart[] = [
  { key: 'none', labelKey: 'studentHome.wardrobe.frame.none' },
  // ── rewards ──
  { key: 'flame', labelKey: 'studentHome.wardrobe.frame.flame' },
  { key: 'blue_flame', labelKey: 'studentHome.wardrobe.frame.blueFlame' },
  { key: 'gold_laurel', labelKey: 'studentHome.wardrobe.frame.goldLaurel' },
  { key: 'star_ring', labelKey: 'studentHome.wardrobe.frame.starRing' },
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
  labelKey: MessageKey;
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
      layer, category, index, key: part.key, labelKey: part.labelKey, achievement: REWARD_ACHIEVEMENT[part.key],
    })),
);

/** A part's name in the reader's language ('Crown' / «Корона»); '' for an index this build doesn't know. */
export function partLabel(category: MascotCategory, index: number, locale: Locale = activeLocale()): string {
  const part = CATEGORY_PARTS[category]?.[index];
  return part ? t(part.labelKey, undefined, locale) : '';
}

/** An achievement reward's name: the part it puts on, in the reader's language, else the server's name. */
export function rewardLabel(reward: { layer: LayerTag; index: number; name?: string }, locale: Locale = activeLocale()): string {
  const category = CATEGORY_OF_TAG[reward.layer];
  return (category && partLabel(category, reward.index, locale)) || reward.name || '';
}

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
