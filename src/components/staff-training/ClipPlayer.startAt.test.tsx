// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClipPlayer from './ClipPlayer';
import { clip, memoryStorage, mount, unmount } from './__tests__/kit';

vi.mock('@/contexts/AuthContext', async () => (await import('./__tests__/kit')).authMock('curator'));
const api = vi.hoisted(() => ({ sendBeat: vi.fn(), sendBeatOnExit: vi.fn() }));
vi.mock('@/services/api/staffTraining', () => api);

const videoEl = () => document.querySelector('video[data-clip-video]') as HTMLVideoElement;

async function show(startAtMs: number | undefined, lastPositionMs: number) {
  await mount(<ClipPlayer clip={clip({ progress: { watch_pct: 40, last_position_ms: lastPositionMs, watched: false, questions_passed: false } })}
    locale="en" onBeat={vi.fn()} onChanged={vi.fn()} startAtMs={startAtMs} />);
  const v = videoEl();
  const state = { time: 0 };
  Object.defineProperty(v, 'currentTime', { configurable: true, get: () => state.time, set: (n: number) => { state.time = n; } });
  v.play = vi.fn(() => Promise.resolve());
  await act(async () => { v.dispatchEvent(new Event('loadedmetadata')); });
  return { state, v };
}

beforeEach(() => {
  api.sendBeat.mockReset().mockResolvedValue({ watch_pct: 0, watched: false });
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'WEBVTT\n' }) as Response));
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(async () => { await unmount(); vi.unstubAllGlobals(); });

describe('ClipPlayer opened from a search result (?t=)', () => {
  it('starts at the linked second and plays, not where the viewer stopped last time', async () => {
    const { state, v } = await show(42_000, 41_000);
    expect(state.time).toBe(42);
    expect(v.play).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Resumed');
  });

  it('keeps the normal resume when no second is linked', async () => {
    const { state, v } = await show(undefined, 41_000);
    expect(state.time).toBe(41);
    expect(v.play).not.toHaveBeenCalled();
  });

  it('ignores a linked second beyond the end of the clip', async () => {
    const { state } = await show(500_000, 41_000);
    expect(state.time).toBe(41);
  });

  it('counts nothing for the jump itself', async () => {
    await show(42_000, 0);
    expect(api.sendBeat).not.toHaveBeenCalled();
  });
});
