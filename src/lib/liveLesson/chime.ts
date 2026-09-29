/**
 * The timer's end signal (owner, 2026-09-29): a soft two-note chime on the teacher's panel and
 * the presenter view, with a mute toggle. Students' phones vibrate instead, with no sound. It is
 * synthesised with Web Audio, so there is no audio file to load.
 */

const MUTE_KEY = 'live-lesson.chime-muted';

export function chimeMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setChimeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* private mode: the toggle still works for this page */
  }
}

let context: AudioContext | null = null;

export function playChime(): void {
  if (chimeMuted()) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    context = context ?? new Ctx();
    const ctx = context;
    void ctx.resume?.();
    const start = ctx.currentTime;
    [[880, 0], [1318.5, 0.18]].forEach(([frequency, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, start + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + delay);
      osc.stop(start + delay + 1.2);
    });
  } catch {
    /* no audio: the countdown still shows «Time's up» */
  }
}

export function vibrate(): void {
  try {
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    /* not supported */
  }
}
