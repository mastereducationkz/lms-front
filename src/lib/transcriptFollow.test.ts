import { describe, expect, it } from 'vitest';
import {
  blockSeekTarget,
  columnAt,
  currentLineIndex,
  isSpeaking,
  lessonAt,
  recordingAt,
  revealScrollTop,
} from './transcriptFollow';

// The video starts 10 minutes before the lesson: lesson_at = at - 600.
const OFFSET = 600;
const line = (at: number, end: number, speaker_key: string | null = 'u1') => ({ at, end, lesson_at: at - OFFSET, speaker_key });
const lines = [line(610, 640, 'u9'), line(641, 645, 'u1'), line(700, 760, 'u9'), line(900, 905, 'u2')];

describe('the line being said now', () => {
  it('is the last one begun by the video’s time', () => {
    expect(currentLineIndex(lines, 0)).toBe(-1);
    expect(currentLineIndex(lines, 610)).toBe(0);
    expect(currentLineIndex(lines, 642)).toBe(1);
    expect(currentLineIndex(lines, 800)).toBe(2);
    expect(currentLineIndex(lines, 5000)).toBe(3);
    expect(currentLineIndex([], 10)).toBe(-1);
    expect(currentLineIndex(lines, null)).toBe(-1);
  });

  it('counts as spoken until a moment after it ends', () => {
    expect(isSpeaking(lines[2], 761)).toBe(true);
    expect(isSpeaking(lines[2], 765)).toBe(false);
    expect(isSpeaking(undefined, 700)).toBe(false);
  });
});

describe('keeping it in view', () => {
  const view = { top: 1000, height: 400 };
  it('leaves the list alone while the line sits comfortably', () => {
    expect(revealScrollTop(view, { top: 1100, height: 30 })).toBeNull();
  });
  it('brings a line below or above the comfortable band a third of the way down', () => {
    expect(revealScrollTop(view, { top: 1380, height: 30 })).toBe(1260);
    expect(revealScrollTop(view, { top: 900, height: 30 })).toBe(780);
    expect(revealScrollTop(view, { top: 20, height: 30 })).toBe(0);
  });
});

describe('two clocks', () => {
  it('turns video time into lesson time and back', () => {
    expect(lessonAt(900, OFFSET)).toBe(300);
    expect(lessonAt(900, null)).toBeNull();
    expect(recordingAt(300, OFFSET)).toBe(900);
    expect(recordingAt(-900, OFFSET)).toBe(0);
    expect(recordingAt(300, null)).toBeNull();
  });

  it('finds the playhead’s block', () => {
    const columns = [{ from: 0, to: 300 }, { from: 300, to: 600 }];
    expect(columnAt(columns, 299)).toBe(0);
    expect(columnAt(columns, 300)).toBe(1);
    expect(columnAt(columns, 900)).toBe(-1);
    expect(columnAt(columns, null)).toBe(-1);
  });
});

describe('a picked block plays from', () => {
  it('the first thing that person said in it', () => {
    expect(blockSeekTarget(lines, { key: 'u9', from: 60, to: 300 }, OFFSET)).toBe(700);
  });
  it('the block’s start when a long turn began before it', () => {
    expect(blockSeekTarget(lines, { key: 'u9', from: 30, to: 300 }, OFFSET)).toBe(630);
  });
  it('the block’s start when that person said nothing then, and nowhere without an offset', () => {
    expect(blockSeekTarget(lines, { key: 'u2', from: 0, to: 60 }, OFFSET)).toBe(600);
    expect(blockSeekTarget(lines, { key: 'u2', from: 0, to: 60 }, null)).toBeNull();
    expect(blockSeekTarget(lines, { key: null, from: 0, to: 60 }, null)).toBe(610);
  });
});
