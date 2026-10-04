/**
 * What a share card is about (SH1): an earned achievement, a received Star of the Week, or a
 * «Kasatik of the lesson» crown — each with the student's own orca dressed for the moment.
 * Only earned things become items: the Share button never appears for anything else.
 */
import { CATEGORY_OF_TAG, CATEGORY_PARTS, resolveMascot, type MascotConfig } from '../mascot/config';
import type { Achievement, StarAward } from '@/services/api/achievementsUi';
import type { Crown } from '@/services/api/shares';
import { achievementText, crownText, starText, type CardText, type ShareKind } from './shareCopy';

export interface ShareItem {
  kind: ShareKind;
  /** achievement key | star_awards.id | events.id */
  ref: string;
  text: CardText;
  orca: MascotConfig;
  crown?: boolean;
  /** The student's own name, for the «name on the card» options. */
  userName: string;
}

export interface ShareUser {
  id: number | string;
  name?: string | null;
  mascot?: string | null;
  role?: string;
}

/** The Gold-star cape: what a Star of the Week wears on the card. */
const STAR_CAPE = 25;

/** Their saved look with each reward put on — only parts this build can draw. */
function dressed(user: ShareUser, rewards: { layer: string; index: number }[]): MascotConfig {
  const config = { ...resolveMascot(user.mascot, user.id) };
  for (const r of rewards) {
    const category = CATEGORY_OF_TAG[r.layer as keyof typeof CATEGORY_OF_TAG];
    if (category && r.index < CATEGORY_PARTS[category].length) config[category] = r.index;
  }
  return config;
}

export function achievementItem(a: Achievement, user: ShareUser): ShareItem | null {
  if (!a.unlocked) return null;
  return { kind: 'achievement', ref: a.key, text: achievementText(a), orca: dressed(user, a.rewards), userName: user.name ?? '' };
}

export function starItem(s: StarAward, user: ShareUser): ShareItem | null {
  if (s.id == null) return null;
  return {
    kind: 'star', ref: String(s.id), text: starText(s),
    orca: dressed(user, [{ layer: 'h', index: STAR_CAPE }]), userName: user.name ?? '',
  };
}

export function crownItem(c: Crown, user: ShareUser): ShareItem {
  return {
    kind: 'kasatik_lesson', ref: String(c.event_id), text: crownText(c),
    orca: dressed(user, []), crown: true, userName: user.name ?? '',
  };
}
