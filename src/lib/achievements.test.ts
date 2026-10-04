import { describe, expect, it } from 'vitest';
import { parseMascot, resolveMascot } from '../components/mascot/config';
import type { Achievement, GroupStars } from '../services/api/achievementsUi';
import {
  achievementNotificationPath,
  almostThere,
  byExcitement,
  celebrationReward,
  celebrationTitle,
  groupByCategory,
  nextAchievement,
  recentlyUnlocked,
  resolveHighlight,
  shouldShowCelebration,
  starFromLabel,
  starQuota,
  starQuotaLabel,
  validStarReason,
  withReward,
} from './achievements';

const ach = (over: Partial<Achievement> & { key: string }): Achievement => ({
  title: over.key,
  description: null,
  how_to: null,
  tier: 'rare',
  category: 'consistency',
  secret: false,
  unlocked: false,
  unlocked_at: null,
  seen: true,
  progress: null,
  count: 0,
  rewards: [],
  unlock_id: null,
  ...over,
});

describe('almost there', () => {
  const list = [
    ach({ key: 'on_time_20', progress: { current: 14, target: 20 } }),
    ach({ key: 'live_ace', progress: { current: 18, target: 20 } }),
    ach({ key: 'checkpoint_pro', progress: { current: 1, target: 5 } }),
    ach({ key: 'streak_7', progress: { current: 6, target: 7 } }),
    ach({ key: 'done', unlocked: true, progress: { current: 5, target: 5 } }),
    ach({ key: 'secret', secret: true, progress: { current: 4, target: 5 } }),
    ach({ key: 'no_progress' }),
  ];

  it('picks the closest by share done, never unlocked, secret or unmeasured ones', () => {
    expect(almostThere(list).map((a) => a.key)).toEqual(['live_ace', 'streak_7', 'on_time_20']);
  });

  it('breaks a tie by fewer steps left', () => {
    const tie = [
      ach({ key: 'big', progress: { current: 10, target: 20 } }),
      ach({ key: 'small', progress: { current: 2, target: 4 } }),
    ];
    expect(almostThere(tie).map((a) => a.key)).toEqual(['small', 'big']);
  });

  it('falls back to the first visible locked one for the dashboard tile', () => {
    expect(nextAchievement([ach({ key: 'secret', secret: true }), ach({ key: 'first_splash', tier: 'earned' })])?.key).toBe('first_splash');
    expect(nextAchievement([ach({ key: 'x', unlocked: true })])).toBeNull();
  });
});

describe('recent unlocks and categories', () => {
  it('lists the newest unlocks first', () => {
    const list = [
      ach({ key: 'a', unlocked: true, unlocked_at: '2026-10-01T10:00:00Z' }),
      ach({ key: 'b', unlocked: true, unlocked_at: '2026-10-03T10:00:00Z' }),
      ach({ key: 'c' }),
    ];
    expect(recentlyUnlocked(list).map((a) => a.key)).toEqual(['b', 'a']);
  });

  it('groups in page order and keeps unknown categories at the end', () => {
    const groups = groupByCategory([
      ach({ key: 's', category: 'seasonal' }),
      ach({ key: 'g', category: 'getting_started' }),
      ach({ key: 'x', category: 'brand_new' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['getting_started', 'seasonal', 'other']);
  });
});

describe('the orca wearing a reward', () => {
  it('puts one reward on the current look and saves it as v2', () => {
    expect(withReward('v1.h3.g0.e2.p5.b4', 7, { layer: 'p', index: 20, name: 'Golden clock' })).toBe('v2.h3.g0.e2.p20.b4.f0');
    expect(withReward('v2.h3.g0.e2.p5.b4.f1', 7, { layer: 'f', index: 3, name: 'Gold laurel frame' })).toBe('v2.h3.g0.e2.p5.b4.f3');
  });

  it('starts from the automatic orca when nothing is saved', () => {
    const auto = resolveMascot(null, 42);
    expect(parseMascot(withReward(null, 42, { layer: 'b', index: 11, name: 'Sparkle' }))).toEqual({ ...auto, background: 11 });
  });

  it('dresses the orca in the most exciting new reward', () => {
    const list = [
      ach({ key: 'hand_in_hero', tier: 'earned', rewards: [{ layer: 'p', index: 17, name: 'Pencil' }] }),
      ach({ key: 'graduate_gold', tier: 'legendary', rewards: [{ layer: 'h', index: 17, name: 'Gold Master hoodie' }, { layer: 'f', index: 3, name: 'Gold laurel frame' }] }),
      ach({ key: 'on_time_5', tier: 'rare', rewards: [{ layer: 'p', index: 19, name: 'Clock pin' }] }),
    ];
    expect(celebrationReward(list, ['hand_in_hero', 'on_time_5', 'graduate_gold'])?.reward.name).toBe('Gold Master hoodie');
    expect(celebrationReward(list, ['hand_in_hero'])?.reward.name).toBe('Pencil');
    expect(celebrationReward(list, [])).toBeNull();
  });
});

describe('the celebration', () => {
  const base = {
    role: 'student',
    unseen: ['first_splash'],
    tourActive: false,
    assignmentZeroGate: false,
    pathname: '/dashboard',
    celebrated: new Set<string>(),
  };

  it('shows for a student with something new', () => {
    expect(shouldShowCelebration(base)).toBe(true);
  });

  it('never shows to staff, over the tour, on the Assignment Zero gate, or twice', () => {
    expect(shouldShowCelebration({ ...base, role: 'curator' })).toBe(false);
    expect(shouldShowCelebration({ ...base, tourActive: true })).toBe(false);
    expect(shouldShowCelebration({ ...base, assignmentZeroGate: true })).toBe(false);
    expect(shouldShowCelebration({ ...base, pathname: '/assignment-zero' })).toBe(false);
    expect(shouldShowCelebration({ ...base, celebrated: new Set(['first_splash']) })).toBe(false);
    expect(shouldShowCelebration({ ...base, unseen: [] })).toBe(false);
  });

  it('lists the new unlocks most exciting first', () => {
    const list = [
      ach({ key: 'e', tier: 'earned' }),
      ach({ key: 'r', tier: 'rare' }),
      ach({ key: 'l', tier: 'legendary' }),
      ach({ key: 's', tier: 'social' }),
    ];
    expect(byExcitement(list).map((a) => a.key)).toEqual(['l', 'r', 's', 'e']);
  });

  it('batches the title', () => {
    expect(celebrationTitle(1)).toBe('Achievement unlocked!');
    expect(celebrationTitle(5)).toBe('You unlocked 5 achievements!');
  });
});

describe('the bell', () => {
  const list = [ach({ key: 'perfect_month', unlock_id: 77 }), ach({ key: 'live_wire', unlock_id: 12 })];

  it('opens the unlocked card by matching related_id to unlock_id', () => {
    expect(achievementNotificationPath({ notification_type: 'achievement_unlocked', related_id: 77 }, list)).toBe('/achievements#perfect_month');
  });

  it('falls back to the page when the unlock can’t be resolved', () => {
    expect(achievementNotificationPath({ notification_type: 'achievement_unlocked', related_id: 999 }, list)).toBe('/achievements');
    expect(achievementNotificationPath({ notification_type: 'achievement_unlocked', related_id: 77 }, null)).toBe('/achievements');
    expect(achievementNotificationPath({ notification_type: 'achievement_unlocked', related_id: null }, list)).toBe('/achievements');
  });

  it('leaves every other notice alone', () => {
    expect(achievementNotificationPath({ notification_type: 'library', related_id: 77 }, list)).toBeNull();
  });

  it('deep-links only to an achievement that exists', () => {
    expect(resolveHighlight(list, '#live_wire')).toBe('live_wire');
    expect(resolveHighlight(list, '#nope')).toBeNull();
    expect(resolveHighlight(list, '')).toBeNull();
  });
});

describe('Star of the Week', () => {
  const stars = (over: Partial<GroupStars>): GroupStars => ({ this_week: [], history: [], can_award: true, my_role: 'curator', ...over });
  const award = (role: string) => ({ reason: 'r', awarded_by_name: 'Aida K', awarded_by_role: role, week: '2026-W40', created_at: '' });

  it('gives each role one star a week per group', () => {
    expect(starQuota(stars({}))).toBe(1);
    expect(starQuota(stars({ this_week: [award('teacher')] }))).toBe(1);
    expect(starQuota(stars({ this_week: [award('curator')] }))).toBe(0);
    expect(starQuota(stars({ can_award: false }))).toBe(0);
  });

  it('labels the quota in the page’s language', () => {
    expect(starQuotaLabel(1, 'en')).toBe('You can give 1 star this week');
    expect(starQuotaLabel(0, 'ru')).toBe('Звезда этой недели уже выдана');
  });

  it('wants a reason of 1–140 characters', () => {
    expect(validStarReason('  ')).toBe(false);
    expect(validStarReason('Helped everyone')).toBe(true);
    expect(validStarReason('x'.repeat(141))).toBe(false);
  });

  it('tells the student who gave it, by first name', () => {
    expect(starFromLabel(award('curator'))).toBe('from your curator Aida');
    expect(starFromLabel(award('teacher'))).toBe('from your teacher Aida');
    expect(starFromLabel(award('admin'))).toBe('from Master Education');
  });
});
