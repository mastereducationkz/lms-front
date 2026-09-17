import { describe, expect, it } from 'vitest';

import { resumeSecond, youtubeWatchAt } from './youtubePlayback';

describe('youtubeWatchAt', () => {
  it('opens the video from the start when the student has not played it', () => {
    expect(youtubeWatchAt('tSx1UzrADeA')).toBe('https://www.youtube.com/watch?v=tSx1UzrADeA');
    expect(youtubeWatchAt('tSx1UzrADeA', 0)).toBe('https://www.youtube.com/watch?v=tSx1UzrADeA');
  });

  it('opens it at the whole second the student reached', () => {
    expect(youtubeWatchAt('tSx1UzrADeA', 83.7)).toBe('https://www.youtube.com/watch?v=tSx1UzrADeA&t=83s');
  });

  it('ignores a time the player could not report', () => {
    expect(youtubeWatchAt('-FlwJB_0EO8', Number.NaN)).toBe('https://www.youtube.com/watch?v=-FlwJB_0EO8');
    expect(youtubeWatchAt('-FlwJB_0EO8', -4)).toBe('https://www.youtube.com/watch?v=-FlwJB_0EO8');
    expect(youtubeWatchAt('-FlwJB_0EO8', null)).toBe('https://www.youtube.com/watch?v=-FlwJB_0EO8');
  });
});

describe('resumeSecond', () => {
  it('restarts a reloaded player where the student was', () => {
    expect(resumeSecond(12.9)).toBe(12);
  });

  it('starts from the beginning when there is nothing to resume', () => {
    expect(resumeSecond(0)).toBeUndefined();
    expect(resumeSecond(0.6)).toBeUndefined();
    expect(resumeSecond(undefined)).toBeUndefined();
    expect(resumeSecond(Number.NaN)).toBeUndefined();
  });
});
