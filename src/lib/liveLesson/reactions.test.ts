import { describe, expect, it } from 'vitest';
import { addReaction, cooldownLeft, emptyBubbles, lostShowing, MAX_BUBBLES, prune } from './reactions';
import type { ReactionEvent } from './types';

const r = (kind: ReactionEvent['kind'], user_id?: number, extra: Partial<ReactionEvent> = {}): ReactionEvent =>
  ({ event_id: 1, kind, at: '', user_id, name: user_id ? `S${user_id}` : null, ...extra });

describe('reaction bubbles', () => {
  it('merges identical reactions within a second into one bubble with a count', () => {
    let s = emptyBubbles();
    s = addReaction(s, r('fire', 1), 0);
    s = addReaction(s, r('fire', 2), 400);
    s = addReaction(s, r('fire', 3), 900);
    expect(s.bubbles).toHaveLength(1);
    expect(s.bubbles[0].count).toBe(3);
    expect(s.bubbles[0].person?.user_id).toBe(3);
    s = addReaction(s, r('fire', 4), 1100);
    expect(s.bubbles).toHaveLength(2);
  });
  it('keeps kinds apart', () => {
    let s = emptyBubbles();
    s = addReaction(s, r('fire', 1), 0);
    s = addReaction(s, r('love', 2), 10);
    expect(s.bubbles.map((b) => b.kind)).toEqual(['fire', 'love']);
  });
  it('caps what floats and counts the rest', () => {
    let s = emptyBubbles();
    const kinds: ReactionEvent['kind'][] = ['love', 'laugh', 'fire', 'clap', 'mindblown', 'splash'];
    // 170 ms apart: the same kind comes back after 1020 ms (no merge) and everything is still in flight.
    for (let i = 0; i < MAX_BUBBLES + 4; i += 1) s = addReaction(s, r(kinds[i % 6], i + 1), i * 170);
    expect(s.bubbles).toHaveLength(MAX_BUBBLES);
    expect(s.overflow).toBe(4);
  });
  it('draws an anonymous reaction as a plain orca', () => {
    const s = addReaction(emptyBubbles(), r('splash', 5, { anonymous: true }), 0);
    expect(s.bubbles[0].person).toBeNull();
  });
  it('lets finished bubbles go', () => {
    const s = addReaction(emptyBubbles(), r('clap', 1), 0);
    expect(prune(s, 5000).bubbles).toHaveLength(0);
  });
});

describe('lost and cooldown', () => {
  it('shows «lost» only while fresh', () => {
    expect(lostShowing({ count: 4, until: 1000 }, 500)).toBe(4);
    expect(lostShowing({ count: 4, until: 1000 }, 1500)).toBe(0);
    expect(lostShowing(null, 0)).toBe(0);
  });
  it('drains the cooldown ring', () => {
    expect(cooldownLeft(3000, 3000, 0)).toBe(1);
    expect(cooldownLeft(3000, 3000, 1500)).toBe(0.5);
    expect(cooldownLeft(3000, 3000, 3500)).toBe(0);
  });
});
