import { describe, expect, it, vi } from 'vitest';
import { runWithConcurrency } from './uploadQueue';

describe('runWithConcurrency', () => {
  it('runs every task exactly once', async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 3, async (task) => {
      seen.push(task);
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('never runs more than `concurrency` tasks at once', async () => {
    let active = 0;
    let maxActive = 0;
    const tasks = Array.from({ length: 8 }, (_, i) => i);
    await runWithConcurrency(tasks, 3, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('keeps the queue going when one task fails', async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3], 2, async (task) => {
      if (task === 2) throw new Error('boom');
      seen.push(task);
    });
    expect(seen.sort()).toEqual([1, 3]);
  });

  it('never spawns more workers than there are tasks', async () => {
    let starts = 0;
    await runWithConcurrency([1, 2], 5, async () => {
      starts += 1;
    });
    expect(starts).toBe(2);
  });

  it('resolves immediately for an empty task list', async () => {
    const run = vi.fn();
    await runWithConcurrency([], 3, run);
    expect(run).not.toHaveBeenCalled();
  });
});
