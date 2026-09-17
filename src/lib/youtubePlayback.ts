// Recovery helpers for the embedded YouTube lesson player. Striped or green/pink frames come from
// the student's GPU decoding YouTube's stream (seen on Windows laptops when YouTube switches
// quality), not from the lesson: a fresh player or youtube.com itself are the student's way out.

/** youtube.com link that opens the video at the whole second the student reached. */
export function youtubeWatchAt(videoId: string, seconds?: number | null): string {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const at = resumeSecond(seconds);
  return at === undefined ? url : `${url}&t=${at}s`;
}

/** Where a reloaded player starts: the whole second reached, or undefined for the beginning. */
export function resumeSecond(seconds?: number | null): number | undefined {
  const whole = Math.floor(Number(seconds));
  return Number.isFinite(whole) && whole > 0 ? whole : undefined;
}
