/**
 * What was actually played, as the intervals the server turns into 1-second buckets (CONTRACTS K4).
 *
 * The player feeds it the video's position while it plays; a seek, a pause or the end closes the open interval. A
 * jump never becomes an interval: dragging the bar to the end must not count as watching it. The server also
 * drops any interval longer than the wall time since the previous beat (+ 2 s), so at a higher speed the beats
 * come more often (see `beatEveryMs`).
 */

export type Interval = [fromMs: number, toMs: number];

/** The largest step between two ticks that still counts as playing; anything bigger was a jump. */
const MAX_STEP_MS = 3000;
/** Never hold more than this many unsent intervals (a long offline spell). */
const MAX_PENDING = 40;

export class WatchTracker {
  private pending: Interval[] = [];
  private from: number | null = null;
  private last = 0;

  /** The video started or resumed playing at `positionMs`. */
  begin(positionMs: number): void {
    this.close();
    this.from = positionMs;
    this.last = positionMs;
  }

  /** The video's position while it plays (`timeupdate`). A step backwards or a big step forwards is a seek. */
  tick(positionMs: number): void {
    if (this.from === null) return;
    const step = positionMs - this.last;
    if (step < 0 || step > MAX_STEP_MS) {
      this.close();
      this.from = positionMs;
    }
    this.last = positionMs;
  }

  /** Pause, seeking, ended, tab hidden: the open interval ends where the video last was. */
  stop(positionMs?: number): void {
    if (this.from !== null && positionMs !== undefined) this.tick(positionMs);
    this.close();
  }

  get playing(): boolean {
    return this.from !== null;
  }

  /** Everything played since the last call, the open interval included (it carries on from where it ended). */
  collect(): Interval[] {
    const out = [...this.pending];
    this.pending = [];
    if (this.from !== null && this.last > this.from) {
      out.push([Math.round(this.from), Math.round(this.last)]);
      this.from = this.last;
    }
    return out;
  }

  /** A beat that did not arrive: its intervals go back in the queue for the next one. */
  restore(intervals: Interval[]): void {
    this.pending = [...intervals, ...this.pending].slice(-MAX_PENDING);
  }

  private close(): void {
    if (this.from !== null && this.last > this.from) this.pending.push([Math.round(this.from), Math.round(this.last)]);
    this.from = null;
    this.pending = this.pending.slice(-MAX_PENDING);
  }
}

/**
 * How often to send a beat. 10 s at normal speed. At speed r a beat covers more video than wall time, and the
 * server refuses an interval longer than wall + 2 s, so the beat comes before 2 s / (r - 1) of wall time passed.
 */
export function beatEveryMs(rate: number): number {
  if (!(rate > 1)) return 10_000;
  return Math.min(10_000, Math.max(1000, Math.floor(1500 / (rate - 1))));
}

/** Where to resume: the saved position, unless it is at the very start or within the last seconds. */
export function resumeAtMs(lastPositionMs: number, durationMs: number): number {
  if (lastPositionMs < 1500) return 0;
  if (durationMs > 0 && lastPositionMs > durationMs - 3000) return 0;
  return lastPositionMs;
}
