/**
 * «Share achievement» copy (owner, 2026-10-04): every word on the story card, in one place.
 * First person — the student is the one posting it — warm and confident, never shouty.
 * English (SH3): achievement names are English, and Russian would need gendered verbs.
 */
import type { AchievementTier } from '@/services/api/achievementsUi';

export type ShareKind = 'achievement' | 'star' | 'kasatik_lesson';
export type NameMode = 'short' | 'full' | 'none';
/** The card's colourway: brand blue, gold for the big moments, emerald for seasonal. */
export type CardAccent = 'blue' | 'gold' | 'emerald';

export interface CardText {
  pill: string;
  lead: string | null;
  title: string;
  line: string | null;
  accent: CardAccent;
}

/** One proud line per achievement, in the student's own voice (key → line). */
export const PROUD_LINES: Record<string, string> = {
  hello_kasatik: 'Made my orca my own.',
  first_splash: 'Showed up for my very first lesson.',
  hand_in_hero: 'Handed in my first homework.',
  live_wire: 'Answered live in class.',
  first_checkpoint: 'Took my first SAT checkpoint.',
  on_time_5: 'Five homeworks in. All on time.',
  on_time_20: 'Twenty homeworks. Every single one on time.',
  early_bird: 'Five homeworks done a full day early.',
  perfect_month: 'A whole month without missing a lesson.',
  weekly_warrior: 'Four weekly tests, four weeks in a row.',
  score_climber: 'My weekly-test score went up three times in a row.',
  full_marks_3: 'Every homework on time, four weeks running.',
  live_ace: 'Twenty right answers in live lessons.',
  checkpoint_pro: 'Five checkpoints, each one before the deadline.',
  streak_7: 'Seven learning days in a row.',
  streak_30: 'Thirty learning days in a row.',
  comeback: 'Took a break. Came back stronger.',
  graduate_gold: 'Finished my course — and showed up for all of it.',
  verified_score: 'My official exam score is in, and verified.',
  top_score: 'A top score on the real exam.',
  streak_100: 'One hundred learning days in a row.',
  star_of_week: 'Named Star of the Week.',
  star_of_week_3: 'Star of the Week, three times over.',
  team_spirit: 'My whole group showed up, all month long.',
  nauryz: 'Kept learning right through Nauryz.',
  winter_lights: 'Kept learning through the winter holidays.',
  test_day_ready: 'Showed up right before test day.',
};

export const TIER_PILL: Record<AchievementTier, string> = {
  earned: 'Achievement',
  rare: 'Rare achievement',
  legendary: 'Legendary achievement',
  social: 'Achievement',
  seasonal: 'Seasonal achievement',
};

const ROLE_WORD: Record<string, string> = { teacher: 'teacher', curator: 'curator', admin: 'teacher' };

/** What the card prints for a name: «short» = first word + the last word's initial («Аружан К.»).
 *  Names are typed free-form, so the preview shows exactly this and the student can switch. */
export function formatShareName(name: string | null | undefined, mode: NameMode): string | null {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (mode === 'none' || words.length === 0) return null;
  if (mode === 'full' || words.length === 1) return words.join(' ');
  return `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`;
}

export function achievementText(a: { key: string; title: string; tier: AchievementTier; description?: string | null }): CardText {
  return {
    pill: TIER_PILL[a.tier] ?? 'Achievement',
    lead: 'I just unlocked',
    title: a.title,
    line: PROUD_LINES[a.key] ?? a.description ?? null,
    accent: a.tier === 'legendary' ? 'gold' : a.tier === 'seasonal' ? 'emerald' : 'blue',
  };
}

export function starText(s: { reason: string; awarded_by_role: string }): CardText {
  const reason = s.reason.trim().replace(/[.!…]+$/u, '');
  return {
    pill: `Chosen by my ${ROLE_WORD[s.awarded_by_role] ?? 'teacher'}`,
    lead: null,
    title: 'Star of the Week',
    line: reason ? `“${reason}.”` : null,
    accent: 'gold',
  };
}

const LESSON_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function crownText(c: { lesson_title: string | null; lesson_date: string | null }): CardText {
  const when = c.lesson_date ? LESSON_DATE.format(new Date(`${c.lesson_date}T00:00:00Z`)) : null;
  return {
    pill: when ? `Live lesson · ${when}` : 'Live lesson',
    lead: 'My teacher crowned me',
    title: 'Kasatik of the Lesson',
    line: c.lesson_title?.trim() || null,
    accent: 'gold',
  };
}

/** The share-sheet caption that rides along with the image (some apps show it, Stories don't). */
export const SHARE_CAPTION = 'Tag @master.education in your story!';
export const TAG_PROMPT = 'Tag @master.education in your story to get featured!';

/** How a card left the device: the system share sheet, or saved as an image. */
export type ShareMethod = 'native' | 'download';

/** The dialog's buttons. [Share] wherever the device can share files (on a phone that sheet is
 *  where Instagram, WhatsApp and Snapchat live); [Save image] always. A computer's share sheet
 *  never offers a story, so there Save image comes first. */
export function shareButtons(env: { canShareFiles: boolean; isDesktop: boolean }): { share: boolean; primary: 'share' | 'save' } {
  return { share: env.canShareFiles, primary: env.canShareFiles && !env.isDesktop ? 'share' : 'save' };
}

/** iPhone / iPad (incl. iPadOS, which reports itself as a Mac with touch). */
export function isIOSDevice(nav: { userAgent: string; platform?: string; maxTouchPoints?: number }): boolean {
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
}

/** How [Save image] saves: on iOS a download of a blob can open a tab instead of saving, so it
 *  goes through the share sheet (its «Save Image» puts the card in Photos); elsewhere a download. */
export function saveMethod(env: { ios: boolean; canShareFiles: boolean }): 'sheet' | 'download' {
  return env.ios && env.canShareFiles ? 'sheet' : 'download';
}

export const DESKTOP_HINT = 'Open the LMS on your phone to post it to your story.';

/** A share attempt's outcome, worded honestly: a closed sheet isn't an error, a failure isn't «cancelled». */
export function shareErrorMessage(error: unknown): string | null {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'AbortError') return null;
  if (name === 'NotAllowedError') return 'Your browser blocked the share sheet — tap Share again, or use Download.';
  return 'Couldn’t open sharing here — use Download instead.';
}
