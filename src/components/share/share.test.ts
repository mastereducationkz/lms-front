import { describe, expect, it } from 'vitest';
import { CATALOG_KEYS } from './share.fixtures';
import {
  achievementText,
  crownText,
  formatShareName,
  isIOSDevice,
  PROUD_LINES,
  saveMethod,
  shareButtons,
  shareErrorMessage,
  starText,
} from './shareCopy';
import { achievementItem, crownItem, starItem } from './shareItems';
import type { Achievement } from '@/services/api/achievementsUi';

const ach = (over: Partial<Achievement> = {}): Achievement => ({
  key: 'full_marks_3', title: 'Clean Sheet', description: 'Every homework on time, four weeks in a row.', how_to: null,
  tier: 'rare', category: 'consistency', secret: false, unlocked: true, unlocked_at: '2026-10-04T09:00:00Z',
  seen: true, progress: null, count: 1, rewards: [{ layer: 'g', index: 8, name: 'Gold-star glasses' }], ...over,
});
const user = { id: 7055, name: 'Аружан Касымова', mascot: 'v2.h4.g1.e0.p3.b2.f0', role: 'student' };

describe('the name on the card', () => {
  it('shortens to first name + last initial, or shows all, or nothing', () => {
    expect(formatShareName('Аружан Касымова', 'short')).toBe('Аружан К.');
    expect(formatShareName('  Аружан   Касымова ', 'full')).toBe('Аружан Касымова');
    expect(formatShareName('Аружан Касымова', 'none')).toBeNull();
    expect(formatShareName('Мадина', 'short')).toBe('Мадина');
    expect(formatShareName('aigerim nurlanova', 'short')).toBe('aigerim N.');
    expect(formatShareName('', 'short')).toBeNull();
    expect(formatShareName(null, 'full')).toBeNull();
  });
});

describe('card wording', () => {
  it('has a first-person proud line for every achievement in the catalogue', () => {
    for (const key of CATALOG_KEYS) expect(PROUD_LINES[key], key).toMatch(/\.$/);
    for (const line of Object.values(PROUD_LINES)) expect(line).not.toMatch(/\byou\b/i);
  });

  it('picks the pill, lead and colourway from the tier', () => {
    expect(achievementText(ach())).toEqual({
      pill: 'Rare achievement', lead: 'I just unlocked', title: 'Clean Sheet',
      line: 'Every homework on time, four weeks running.', accent: 'blue',
    });
    expect(achievementText(ach({ key: 'graduate_gold', title: 'Graduate Gold', tier: 'legendary' })).accent).toBe('gold');
    expect(achievementText(ach({ key: 'graduate_gold', tier: 'legendary' })).pill).toBe('Legendary achievement');
    expect(achievementText(ach({ key: 'nauryz', tier: 'seasonal' })).accent).toBe('emerald');
    expect(achievementText(ach({ key: 'something_new', description: 'A new badge.' })).line).toBe('A new badge.');
  });

  it('quotes the reason on a Star of the Week and names who chose it', () => {
    const t = starText({ reason: 'Handed in every homework on time!', awarded_by_role: 'curator' });
    expect(t).toMatchObject({ pill: 'Chosen by my curator', title: 'Star of the Week', lead: null, accent: 'gold' });
    expect(t.line).toBe('“Handed in every homework on time.”');
    expect(starText({ reason: 'x', awarded_by_role: 'admin' }).pill).toBe('Chosen by my teacher');
  });

  it('dates the crown and names the lesson', () => {
    const t = crownText({ lesson_title: 'Unit 7 — Transitions', lesson_date: '2026-10-03' });
    expect(t).toMatchObject({ pill: 'Live lesson · 3 Oct', lead: 'My teacher crowned me', title: 'Kasatik of the Lesson', line: 'Unit 7 — Transitions' });
    expect(crownText({ lesson_title: null, lesson_date: null })).toMatchObject({ pill: 'Live lesson', line: null });
  });
});

describe('what can be shared', () => {
  it('only an unlocked achievement, wearing its rewards', () => {
    expect(achievementItem(ach({ unlocked: false }), user)).toBeNull();
    const item = achievementItem(ach({ key: 'graduate_gold', rewards: [{ layer: 'h', index: 17, name: 'Gold Master hoodie' }, { layer: 'f', index: 3, name: 'Gold laurel frame' }] }), user);
    expect(item).toMatchObject({ kind: 'achievement', ref: 'graduate_gold', userName: 'Аружан Касымова' });
    expect(item?.orca).toMatchObject({ hat: 17, frame: 3, eyewear: 1, prop: 3, background: 2 });
  });

  it('a star needs its id; a crown always gets the crown', () => {
    expect(starItem({ reason: 'r', awarded_by_role: 'teacher', awarded_by_name: 'T', week: '2026-09-28', created_at: '' }, user)).toBeNull();
    const star = starItem({ id: 12, reason: 'r', awarded_by_role: 'teacher', awarded_by_name: 'T', week: '2026-09-28', created_at: '' }, user);
    expect(star).toMatchObject({ kind: 'star', ref: '12' });
    expect(star?.orca.hat).toBe(25);
    expect(crownItem({ event_id: 90, lesson_title: 'L', lesson_date: null, crowned_at: null }, user)).toMatchObject({ kind: 'kasatik_lesson', ref: '90', crown: true });
  });
});

describe('sharing fallbacks', () => {
  it('offers Share where files can be shared and Save image always; a laptop leads with Save', () => {
    expect(shareButtons({ canShareFiles: true, isDesktop: false })).toEqual({ share: true, primary: 'share' });
    expect(shareButtons({ canShareFiles: false, isDesktop: false })).toEqual({ share: false, primary: 'save' });
    expect(shareButtons({ canShareFiles: true, isDesktop: true })).toEqual({ share: true, primary: 'save' });
    expect(shareButtons({ canShareFiles: false, isDesktop: true })).toEqual({ share: false, primary: 'save' });
  });

  it('saves through the share sheet on iOS, by download elsewhere', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
    expect(isIOSDevice({ userAgent: iphone })).toBe(true);
    expect(isIOSDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIOSDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIOSDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe(false);
    expect(saveMethod({ ios: true, canShareFiles: true })).toBe('sheet');
    expect(saveMethod({ ios: true, canShareFiles: false })).toBe('download');
    expect(saveMethod({ ios: false, canShareFiles: true })).toBe('download');
  });

  it('never calls a failure «cancelled», and stays quiet when the student closes the sheet', () => {
    expect(shareErrorMessage({ name: 'AbortError' })).toBeNull();
    expect(shareErrorMessage({ name: 'NotAllowedError' })).toMatch(/blocked/);
    expect(shareErrorMessage(new TypeError('boom'))).toMatch(/Download/);
    expect(shareErrorMessage(new TypeError('boom'))).not.toMatch(/cancel/i);
  });
});
