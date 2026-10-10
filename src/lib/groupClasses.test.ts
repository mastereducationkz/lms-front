import { describe, expect, it, vi } from 'vitest';
import { classPickerView, fetchGroupClasses, upcomingClasses, type ClassEvent } from './groupClasses';

const now = new Date('2026-10-10T10:00:00Z');
const ev = (id: number, iso: string, extra: Partial<ClassEvent> = {}): ClassEvent => ({
  id, title: `Lesson ${id}`, scheduled_at: iso, lesson_number: id, is_past: false, ...extra,
});

describe('upcomingClasses', () => {
  it('keeps only classes that have not started, in date order', () => {
    const got = upcomingClasses([
      ev(3, '2026-10-14T10:00:00Z'),
      ev(1, '2026-10-08T10:00:00Z', { is_past: true }),
      ev(2, '2026-10-12T10:00:00Z'),
      ev(4, '2026-10-10T09:59:00Z'),            // started a minute ago, even if the server did not flag it
    ], now);
    expect(got.map((e) => e.id)).toEqual([2, 3]);
  });

  it('a class starting this very minute is still upcoming', () => {
    expect(upcomingClasses([ev(1, '2026-10-10T10:00:00Z')], now).map((e) => e.id)).toEqual([1]);
  });
});

describe('classPickerView', () => {
  it('says so while the classes load', () => {
    expect(classPickerView({ status: 'loading' }, null, now)).toEqual({ kind: 'loading' });
  });

  it('keeps a failure apart from an empty group', () => {
    expect(classPickerView({ status: 'error', forbidden: false }, null, now)).toEqual({ kind: 'error', forbidden: false });
    expect(classPickerView({ status: 'error', forbidden: true }, null, now)).toEqual({ kind: 'error', forbidden: true });
    expect(classPickerView({ status: 'ready', events: [] }, null, now)).toEqual({ kind: 'empty' });
  });

  it('a group whose lessons are all in the past is empty, not an error', () => {
    const events = [ev(1, '2026-10-02T10:00:00Z', { is_past: true }), ev(2, '2026-10-09T10:00:00Z', { is_past: true })];
    expect(classPickerView({ status: 'ready', events }, null, now)).toEqual({ kind: 'empty' });
  });

  it('lists the upcoming classes', () => {
    const view = classPickerView({ status: 'ready', events: [ev(2, '2026-10-12T10:00:00Z'), ev(1, '2026-10-11T10:00:00Z')] }, null, now);
    expect(view.kind).toBe('options');
    if (view.kind === 'options') expect(view.options.map((o) => [o.event.id, o.held])).toEqual([[1, false], [2, false]]);
  });

  it('still offers a class that was picked and has since been held (a deep link to a recent lesson)', () => {
    const events = [ev(5, '2026-10-09T10:00:00Z', { is_past: true }), ev(6, '2026-10-12T10:00:00Z')];
    const view = classPickerView({ status: 'ready', events }, 5, now);
    expect(view.kind).toBe('options');
    if (view.kind === 'options') expect(view.options.map((o) => [o.event.id, o.held])).toEqual([[5, true], [6, false]]);
  });

  it('a picked class that is not in the list adds nothing', () => {
    const view = classPickerView({ status: 'ready', events: [ev(6, '2026-10-12T10:00:00Z')] }, 99, now);
    expect(view.kind === 'options' && view.options.map((o) => o.event.id)).toEqual([6]);
  });
});

const failure = (status?: number) => Object.assign(new Error('x'), status === undefined ? {} : { response: { status } });

describe('fetchGroupClasses', () => {
  it('returns the classes', async () => {
    const load = vi.fn().mockResolvedValue([ev(1, '2026-10-12T10:00:00Z')]);
    expect(await fetchGroupClasses(load, { delayMs: 0 })).toEqual({ status: 'ready', events: [ev(1, '2026-10-12T10:00:00Z')] });
  });

  it('tries once more after a transient failure (server error, network, rate limit)', async () => {
    for (const status of [500, 503, 429, undefined]) {
      const load = vi.fn().mockRejectedValueOnce(failure(status)).mockResolvedValueOnce([]);
      expect(await fetchGroupClasses(load, { delayMs: 0 })).toEqual({ status: 'ready', events: [] });
      expect(load).toHaveBeenCalledTimes(2);
    }
  });

  it('gives up with an error after the retry fails too', async () => {
    const load = vi.fn().mockRejectedValue(failure(500));
    expect(await fetchGroupClasses(load, { delayMs: 0 })).toEqual({ status: 'error', forbidden: false });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('a refusal is final, flagged, and not retried', async () => {
    const load = vi.fn().mockRejectedValue(failure(403));
    expect(await fetchGroupClasses(load, { delayMs: 0 })).toEqual({ status: 'error', forbidden: true });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('other client errors are not retried either', async () => {
    const load = vi.fn().mockRejectedValue(failure(404));
    expect(await fetchGroupClasses(load, { delayMs: 0 })).toEqual({ status: 'error', forbidden: false });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
