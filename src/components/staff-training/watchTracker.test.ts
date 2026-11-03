import { describe, expect, it } from 'vitest';
import { WatchTracker, beatEveryMs, resumeAtMs } from './watchTracker';

describe('WatchTracker', () => {
  it('records what played as one interval and carries on after a collect', () => {
    const w = new WatchTracker();
    w.begin(40_000);
    [40_250, 40_500, 41_000, 42_000].forEach((p) => w.tick(p));
    expect(w.collect()).toEqual([[40_000, 42_000]]);
    w.tick(43_000);
    expect(w.collect()).toEqual([[42_000, 43_000]]);
    expect(w.collect()).toEqual([]);
  });

  it('turns a seek into no interval at all: dragging to the end is not watching', () => {
    const w = new WatchTracker();
    w.begin(0);
    w.tick(1000);
    w.stop(1000); // `seeking` closes what was playing
    w.begin(100_000); // `seeked` while playing: the new position is a start, not a played stretch
    expect(w.collect()).toEqual([[0, 1000]]);
    w.tick(101_000);
    expect(w.collect()).toEqual([[100_000, 101_000]]);
  });

  it('treats a jump between two ticks as a seek even when no event said so', () => {
    const w = new WatchTracker();
    w.begin(0);
    w.tick(500);
    w.tick(90_000);
    w.tick(90_500);
    expect(w.collect()).toEqual([[0, 500], [90_000, 90_500]]);
    w.tick(10_000); // backwards
    w.tick(10_400);
    expect(w.collect()).toEqual([[10_000, 10_400]]);
  });

  it('flushes the last stretch when the video ends', () => {
    const w = new WatchTracker();
    w.begin(118_000);
    w.tick(119_000);
    w.stop(120_000);
    expect(w.collect()).toEqual([[118_000, 120_000]]);
    expect(w.playing).toBe(false);
  });

  it('keeps nothing while paused, and drops an empty interval', () => {
    const w = new WatchTracker();
    w.begin(5000);
    w.stop(5000);
    expect(w.collect()).toEqual([]);
    w.tick(6000); // a stray timeupdate after the pause
    expect(w.collect()).toEqual([]);
  });

  it('puts a beat that did not arrive back in the queue, oldest first', () => {
    const w = new WatchTracker();
    w.begin(0);
    w.tick(2000);
    const lost = w.collect();
    w.tick(4000);
    w.restore(lost);
    expect(w.collect()).toEqual([[0, 2000], [2000, 4000]]);
  });
});

describe('beatEveryMs', () => {
  it('beats every 10 s at every speed the player offers, and faster only beyond 2×', () => {
    for (const rate of [1, 1.25, 1.5, 2]) expect(beatEveryMs(rate)).toBe(10_000);
    expect(beatEveryMs(3)).toBe(1500);
  });

  it('keeps each beat inside the server budget (wall time × 2 + 2 s) at every speed', () => {
    for (const rate of [1, 1.25, 1.5, 2, 2.5, 3, 4]) {
      const wall = beatEveryMs(rate);
      expect(wall * rate).toBeLessThanOrEqual(wall * 2 + 2000);
    }
  });
});

describe('resumeAtMs', () => {
  it('resumes where the person stopped, but starts over at the very start or the very end', () => {
    expect(resumeAtMs(41_000, 104_000)).toBe(41_000);
    expect(resumeAtMs(800, 104_000)).toBe(0);
    expect(resumeAtMs(102_500, 104_000)).toBe(0);
    expect(resumeAtMs(0, 104_000)).toBe(0);
  });
});
