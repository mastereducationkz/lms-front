import { describe, expect, it } from 'vitest';
import { seedMascot, type LockedParts } from './config';
import { lockedInLook, nextBaseline, parseTryParam, saveBlock, tryOnHref, tryParam, wearParts } from './tryOn';

// h18 = Diamond crown (top_score), h17 = Gold Master hoodie + f3 = Gold laurel (graduate_gold),
// b12 = Sunrise (early_bird, secret), p19 = Clock pin (on_time_5).
const LOCKED: LockedParts = { h: [17, 18], f: [3], b: [12], p: [19] };
const base = { ...seedMascot(42) };
const achievements = [
  { key: 'top_score', title: '1500 Club', how_to: 'Get a verified SAT 1500+.', secret: false, unlocked: false, progress: null },
  { key: 'graduate_gold', title: 'Graduate Gold', how_to: 'Finish a course.', secret: false, unlocked: false, progress: null },
  { key: 'on_time_5', title: 'On Time ×5', how_to: 'Hand in 5 homeworks on time.', secret: false, unlocked: false, progress: { current: 3, target: 5 } },
  { key: 'early_bird', title: 'Secret achievement', how_to: null, hint: 'timing is everything', secret: true, unlocked: false, progress: null },
];

describe('the try-on deep link', () => {
  it('reads one or several reward parts', () => {
    expect(parseTryParam('h18')).toEqual([{ category: 'hat', index: 18 }]);
    expect(parseTryParam('h17,f3')).toEqual([{ category: 'hat', index: 17 }, { category: 'frame', index: 3 }]);
  });

  it('drops free parts, unknown layers, out-of-range indices and a second part per layer', () => {
    expect(parseTryParam('h3')).toEqual([]);            // a free hat — nothing to try on
    expect(parseTryParam('x18,h999,e1')).toEqual([]);
    expect(parseTryParam('h18,h17')).toEqual([{ category: 'hat', index: 18 }]);
    expect(parseTryParam(null)).toEqual([]);
  });

  it('builds the link the cards use', () => {
    const rewards = [{ layer: 'h' as const, index: 17 }, { layer: 'f' as const, index: 3 }];
    expect(tryParam(rewards)).toBe('h17,f3');
    expect(tryOnHref(rewards, 'your-orca')).toBe('/profile?try=h17%2Cf3#your-orca');
    expect(parseTryParam(decodeURIComponent('h17%2Cf3'))).toHaveLength(2);
  });
});

describe('trying on in the builder', () => {
  it('puts a locked part on and names its achievement on the Save button', () => {
    const look = wearParts(base, [{ category: 'hat', index: 18 }]);
    expect(lockedInLook(look, LOCKED)).toEqual([{ category: 'hat', index: 18 }]);
    const block = saveBlock(look, LOCKED, achievements)!;
    expect(block.label).toBe('Earn 1500 Club to keep it');
    expect(block.partName).toBe('Diamond crown');
    expect(block.moreAchievements).toBe(0);
  });

  it('with several locked parts on, names the first one in layer order and counts the other achievements', () => {
    const look = wearParts(base, [{ category: 'frame', index: 3 }, { category: 'prop', index: 19 }]);
    const block = saveBlock(look, LOCKED, achievements)!;
    expect(block.label).toBe('Earn On Time ×5 to keep it');   // prop comes before frame
    expect(block.progress).toEqual({ current: 3, target: 5 });
    expect(block.moreAchievements).toBe(1);                    // the laurel frame needs Graduate Gold
  });

  it('two parts of the same achievement count as one — Graduate Gold is hoodie + laurel', () => {
    const look = wearParts(base, [{ category: 'hat', index: 17 }, { category: 'frame', index: 3 }]);
    const block = saveBlock(look, LOCKED, achievements)!;
    expect(block.label).toBe('Earn Graduate Gold to keep it');
    expect(block.moreAchievements).toBe(0);
  });

  it('keeps a secret achievement secret — only its hint shows', () => {
    const block = saveBlock(wearParts(base, [{ category: 'background', index: 12 }]), LOCKED, achievements)!;
    expect(block.label).toBe('Earn a secret achievement to keep it');
    expect(block.howTo).toBe('Secret · hint: timing is everything');
    expect(block.progress).toBeNull();
  });

  it('a look with nothing locked saves normally; an earned reward is not «trying on»', () => {
    expect(saveBlock(base, LOCKED, achievements)).toBeNull();
    const earned = wearParts(base, [{ category: 'hat', index: 20 }]);   // Explorer hat, not in LOCKED
    expect(saveBlock(earned, LOCKED, achievements)).toBeNull();
  });

  it('without unlock data every reward counts as locked, so nothing unearned can be saved', () => {
    const block = saveBlock(wearParts(base, [{ category: 'hat', index: 20 }]), null, null)!;
    expect(block.label).toBe('Earn its achievement to keep it');
  });

  it('«Back to my look» returns to the last look that wore nothing locked', () => {
    let baseline = base;
    const freeLook = { ...base, hat: 2 };
    baseline = nextBaseline(baseline, freeLook, LOCKED);
    expect(baseline).toEqual(freeLook);
    const tryOn = wearParts(freeLook, [{ category: 'hat', index: 18 }]);
    baseline = nextBaseline(baseline, tryOn, LOCKED);
    expect(baseline).toEqual(freeLook);                                   // try-on never becomes the baseline
    const secondTry = wearParts(tryOn, [{ category: 'frame', index: 3 }]);
    expect(nextBaseline(baseline, secondTry, LOCKED)).toEqual(freeLook);
  });
});
