// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClipPlayer from './ClipPlayer';
import { clip, click, memoryStorage, mount, settle, text, unmount } from './__tests__/kit';

vi.mock('@/contexts/AuthContext', async () => (await import('./__tests__/kit')).authMock('curator'));
const api = vi.hoisted(() => ({ sendBeat: vi.fn(), sendBeatOnExit: vi.fn() }));
vi.mock('@/services/api/staffTraining', () => api);

const VTT = 'WEBVTT\n\n00:00:02.000 --> 00:00:05.000 line:12%\nОткройте журнал.\n';

/** A <video> jsdom can drive: position, paused and duration the test controls; events fired by hand. */
function drive(video: HTMLVideoElement, durationSec = 104) {
  const state = { time: 0, paused: true };
  Object.defineProperty(video, 'currentTime', { configurable: true, get: () => state.time, set: (v: number) => { state.time = v; } });
  Object.defineProperty(video, 'paused', { configurable: true, get: () => state.paused });
  Object.defineProperty(video, 'duration', { configurable: true, get: () => durationSec });
  video.play = vi.fn(() => Promise.resolve());
  const fire = (name: string) => act(async () => { video.dispatchEvent(new Event(name)); });
  return {
    state,
    fire,
    play: async (at: number) => { state.time = at; state.paused = false; await fire('play'); },
    tick: async (to: number) => { state.time = to; await fire('timeupdate'); },
    pause: async () => { state.paused = true; await fire('pause'); },
    seek: async (to: number) => { state.time = to; await fire('seeking'); await fire('seeked'); },
  };
}

const videoEl = () => document.querySelector('video[data-clip-video]') as HTMLVideoElement;

async function show(over = {}, handlers: { onBeat?: () => void; onChanged?: () => void } = {}) {
  await mount(<ClipPlayer clip={clip({ progress: { watch_pct: 0, last_position_ms: 0, watched: false, questions_passed: false }, ...over })} locale="en" onBeat={handlers.onBeat ?? vi.fn()} onChanged={handlers.onChanged ?? vi.fn()} />);
  return drive(videoEl());
}

const beats = () => api.sendBeat.mock.calls.map(([, body]) => body);

beforeEach(() => {
  api.sendBeat.mockReset().mockResolvedValue({ watch_pct: 12, watched: false });
  api.sendBeatOnExit.mockReset();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:fake-${n += 1}`);
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => VTT }) as Response));
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(async () => { await unmount(); vi.unstubAllGlobals(); });

describe('ClipPlayer: what counts as watched', () => {
  it('reports exactly the stretch that played when the video is paused', async () => {
    const v = await show();
    await v.play(40_000 / 1000);
    for (const sec of [40.25, 40.5, 41, 42]) await v.tick(sec);
    await v.pause();
    await settle();
    expect(beats()).toEqual([{ content_version: 2, played: [[40_000, 42_000]], position_ms: 42_000 }]);
    expect(api.sendBeat.mock.calls[0][0]).toBe(7);
  });

  it('turns a seek into no interval: dragging to the end adds nothing', async () => {
    const v = await show();
    await v.play(0);
    await v.tick(1);
    await v.seek(100); // the viewer drags to near the end while it plays
    await v.tick(100.5);
    await v.pause();
    await settle();
    expect(beats().map((b) => b.played)).toEqual([[[0, 1000]], [[100_000, 100_500]]]);
    const covered = beats().flatMap((b) => b.played as [number, number][]).reduce((sum, [a, b]) => sum + (b - a), 0);
    expect(covered).toBe(1500);
  });

  it('flushes the last stretch when the video ends', async () => {
    const v = await show();
    Object.defineProperty(videoEl(), 'duration', { configurable: true, get: () => 120 });
    await v.play(118);
    await v.tick(119);
    v.state.time = 120;
    await v.fire('ended');
    await settle();
    expect(beats()[0].played).toEqual([[118_000, 120_000]]);
  });

  it('sends nothing for a seek made while paused', async () => {
    const v = await show();
    await v.seek(60);
    await settle();
    expect(api.sendBeat).not.toHaveBeenCalled();
  });

  it('keeps what it could not send for the next beat', async () => {
    api.sendBeat.mockRejectedValueOnce(new Error('offline'));
    const v = await show();
    await v.play(10);
    await v.tick(12);
    await v.pause();
    await settle();
    await v.play(12);
    await v.tick(14);
    await v.pause();
    await settle();
    expect(beats()[1].played).toEqual([[10_000, 12_000], [12_000, 14_000]]);
  });

  it('sends the last beat with keepalive when the tab is hidden', async () => {
    const v = await show();
    await v.play(5);
    await v.tick(8);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    expect(api.sendBeatOnExit).toHaveBeenCalledWith(7, { content_version: 2, played: [[5000, 8000]], position_ms: 8000 });
  });

  it('shows what the server counted, and asks the page to reload a clip that changed (409)', async () => {
    const onBeat = vi.fn();
    const onChanged = vi.fn();
    const v = await show({}, { onBeat, onChanged });
    await v.play(0);
    await v.tick(2);
    await v.pause();
    await settle();
    expect(onBeat).toHaveBeenCalledWith({ watch_pct: 12, watched: false });
    expect(text()).toContain('Watched 12%');
    api.sendBeat.mockRejectedValueOnce(Object.assign(new Error('x'), { cause: { response: { data: { reason_code: 'staff_training_clip_changed' } } } }));
    await v.play(2);
    await v.tick(4);
    await v.pause();
    await settle();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});

describe('ClipPlayer: resume, subtitles, speed', () => {
  it('picks up where the viewer stopped', async () => {
    await mount(<ClipPlayer clip={clip()} locale="en" onBeat={vi.fn()} onChanged={vi.fn()} />);
    const v = drive(videoEl());
    await v.fire('loadedmetadata');
    expect(v.state.time).toBe(41);
    expect(text()).toContain('picked up where you stopped, at 0:41');
  });

  it('starts over when the saved position is the very end', async () => {
    await mount(<ClipPlayer clip={clip({ progress: { watch_pct: 100, last_position_ms: 103_000, watched: true, questions_passed: false } })} locale="en" onBeat={vi.fn()} onChanged={vi.fn()} />);
    const v = drive(videoEl());
    await v.fire('loadedmetadata');
    expect(v.state.time).toBe(0);
  });

  it('attaches both subtitle files as blob tracks with the VTT text untouched (the cue `line:` reaches the browser)', async () => {
    await mount(<ClipPlayer clip={clip()} locale="en" onBeat={vi.fn()} onChanged={vi.fn()} />);
    await settle();
    const tracks = Array.from(document.querySelectorAll('track'));
    expect(tracks.map((t) => [t.getAttribute('srclang'), t.getAttribute('label'), t.getAttribute('src')?.startsWith('blob:')])).toEqual([
      ['ru', 'Русский', true],
      ['en', 'English', true],
    ]);
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/vtt');
    const body = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(blob); });
    expect(body).toBe(VTT);
    expect(body).toContain('line:12%');
  });

  it('defaults to Russian, remembers a switch to English, and can turn subtitles off', async () => {
    await mount(<ClipPlayer clip={clip()} locale="en" onBeat={vi.fn()} onChanged={vi.fn()} />);
    await settle();
    const radio = (label: string) => Array.from(document.querySelectorAll('[role="radio"]')).find((b) => b.textContent === label) as HTMLElement;
    expect(radio('Русский').getAttribute('aria-checked')).toBe('true');
    await click(radio('English'));
    expect(radio('English').getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem('st:subtitles')).toBe('en');
    await click(radio('Off'));
    expect(localStorage.getItem('st:subtitles')).toBe('off');
  });

  it('shows the chosen language through the browser’s own track list, and follows its menu', async () => {
    const tracks = [{ language: 'ru', mode: 'disabled' }, { language: 'en', mode: 'disabled' }];
    const listeners: (() => void)[] = [];
    const list = Object.assign(tracks, { addEventListener: (_: string, fn: () => void) => listeners.push(fn), removeEventListener: () => undefined });
    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', { configurable: true, get: () => list });
    try {
      await mount(<ClipPlayer clip={clip()} locale="en" onBeat={vi.fn()} onChanged={vi.fn()} />);
      await settle();
      expect(tracks.map((t) => t.mode)).toEqual(['showing', 'hidden']);
      const radio = (label: string) => Array.from(document.querySelectorAll('[role="radio"]')).find((b) => b.textContent === label) as HTMLElement;
      await click(radio('English'));
      expect(tracks.map((t) => t.mode)).toEqual(['hidden', 'showing']);
      tracks[1].mode = 'hidden'; // the viewer picks «Off» in the browser's own CC menu
      await act(async () => { listeners.forEach((fn) => fn()); });
      expect(radio('Off').getAttribute('aria-checked')).toBe('true');
    } finally {
      delete (HTMLMediaElement.prototype as { textTracks?: unknown }).textTracks;
    }
  });

  it('keeps going without subtitles when a file does not load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => '' }) as Response));
    await mount(<ClipPlayer clip={clip()} locale="en" onBeat={vi.fn()} onChanged={vi.fn()} />);
    await settle();
    expect(document.querySelectorAll('track')).toHaveLength(0);
    expect(videoEl()).not.toBeNull();
    expect(text()).toContain('subtitles didn’t load');
  });

  it('sets the speed, and a click on a sentence jumps there and plays', async () => {
    await mount(<ClipPlayer clip={clip()} locale="en" onBeat={vi.fn()} onChanged={vi.fn()} />);
    const v = drive(videoEl());
    const speed = Array.from(document.querySelectorAll('[role="radio"]')).find((b) => b.textContent === '1.5×') as HTMLElement;
    await click(speed);
    expect(videoEl().playbackRate).toBe(1.5);
    await click(document.querySelector('[data-segment="1"]'));
    expect(v.state.time).toBe(7.4);
    expect(videoEl().play).toHaveBeenCalled();
  });
});
