/**
 * Trying on rewards you haven't earned yet (owner, 2026-10-04): a locked part can go on the
 * builder's preview, never into the saved look — the avatar everyone sees keeps earned parts only.
 * Pure helpers, so the builder's rules are testable without rendering it.
 */
import { achievementField } from '@/lib/achievements';
import { activeLocale, t, type Locale } from '@/lib/i18n';
import {
  CATEGORY_OF_TAG,
  CATEGORY_PARTS,
  isLockedPart,
  isRewardPart,
  partLabel,
  rewardPart,
  usesLockedPart,
  type LayerTag,
  type LockedParts,
  type MascotCategory,
  type MascotConfig,
} from './config';
import '@/lib/i18n/catalogs/studentHome';

export interface TryPart {
  category: MascotCategory;
  index: number;
}

/** Layer order of the code, so "the first locked part" is stable: outfit before frame. */
const ORDER: MascotCategory[] = ['hat', 'eyewear', 'expression', 'prop', 'background', 'frame'];

/**
 * `?try=h17,f3` → the reward parts to put on. Unknown layers, free parts, out-of-range indices and a
 * second part for the same layer are dropped, so a hand-edited link can't break the builder.
 */
export function parseTryParam(value: string | null | undefined): TryPart[] {
  if (!value) return [];
  const out: TryPart[] = [];
  const taken = new Set<MascotCategory>();
  for (const raw of value.split(',')) {
    const m = /^([hgepbf])(\d{1,3})$/.exec(raw.trim());
    if (!m) continue;
    const category = CATEGORY_OF_TAG[m[1] as LayerTag];
    const index = Number(m[2]);
    if (!category || taken.has(category) || index >= CATEGORY_PARTS[category].length || !isRewardPart(category, index)) continue;
    taken.add(category);
    out.push({ category, index });
  }
  return out;
}

/** The `try` value for an achievement's rewards, e.g. Graduate Gold → `h17,f3`. */
export function tryParam(rewards: { layer: LayerTag; index: number }[]): string {
  return rewards.map((r) => `${r.layer}${r.index}`).join(',');
}

/** Where «Try it on» goes: the profile builder, wearing the rewards, scrolled to the builder. */
export function tryOnHref(rewards: { layer: LayerTag; index: number }[], sectionId: string): string {
  return `/profile?try=${encodeURIComponent(tryParam(rewards))}#${sectionId}`;
}

/** The look with the given parts put on. */
export function wearParts(config: MascotConfig, parts: TryPart[]): MascotConfig {
  return parts.reduce<MascotConfig>((c, p) => ({ ...c, [p.category]: p.index }), config);
}

/** The locked parts this look is wearing, in layer order. */
export function lockedInLook(config: MascotConfig, locked: LockedParts | null | undefined): TryPart[] {
  return ORDER.filter((category) => isLockedPart(category, config[category], locked)).map((category) => ({
    category,
    index: config[category],
  }));
}

/** What «Back to my look» restores: the last look that wore nothing locked. */
export function nextBaseline(baseline: MascotConfig, next: MascotConfig, locked: LockedParts | null | undefined): MascotConfig {
  return usesLockedPart(next, locked) ? baseline : next;
}

interface AchievementLike {
  key: string;
  title: string;
  how_to: string | null;
  hint?: string | null;
  secret: boolean;
  unlocked: boolean;
  progress: { current: number; target: number } | null;
}

export interface SaveBlock {
  part: TryPart;
  partName: string;
  /** The Save button while the look wears a locked part. */
  label: string;
  howTo: string | null;
  progress: { current: number; target: number } | null;
  achievementKey: string;
  /** Other achievements this look also needs (parts of the same achievement don't count). */
  moreAchievements: number;
}

/**
 * Why this look can't be saved, or null when it can. Names the first locked part's achievement;
 * a still-secret achievement keeps its secret (only its hint shows).
 */
export function saveBlock(
  config: MascotConfig,
  locked: LockedParts | null | undefined,
  achievements: AchievementLike[] | null | undefined,
  locale: Locale = activeLocale(),
): SaveBlock | null {
  const wearing = lockedInLook(config, locked);
  if (wearing.length === 0) return null;
  const part = wearing[0];
  const reward = rewardPart(part.category, part.index);
  const a = reward ? achievements?.find((x) => x.key === reward.achievement) : undefined;
  const secret = !!a && a.secret && !a.unlocked;
  const label = !a
    ? t('studentHome.mascot.earnAnyToKeep', undefined, locale)
    : secret
      ? t('studentHome.mascot.earnSecretToKeep', undefined, locale)
      : t('studentHome.mascot.earnToKeep', { title: achievementField(a, 'title', locale) }, locale);
  const hint = a ? achievementField(a, 'hint', locale) : null;
  return {
    part,
    partName: partLabel(part.category, part.index, locale),
    label,
    howTo: !a
      ? null
      : secret
        ? (hint ? t('studentHome.achievements.secretHint', { hint }, locale) : t('studentHome.achievements.secret', undefined, locale))
        : achievementField(a, 'how_to', locale),
    progress: secret ? null : a?.progress ?? null,
    achievementKey: a?.key ?? reward?.achievement ?? '',
    moreAchievements: new Set(
      wearing.slice(1).map((w) => rewardPart(w.category, w.index)?.achievement).filter((k) => k && k !== reward?.achievement),
    ).size,
  };
}

