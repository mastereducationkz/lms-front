import { describe, expect, it } from 'vitest';
import { changeParts, initialScoreParts, type InitialScore } from './examInitial';

const sat: InitialScore = { total: '1000.00', verbal: 480, math: 520, listening: null, reading: null, writing: null,
  previous_text: 'March 2025 - Math 700, Verbal 650', change: '210.00' };
const ielts: InitialScore = { total: '6.50', verbal: null, math: null, listening: '6.5', reading: '7.0', writing: '6.0',
  previous_text: 'Overall 6.0', change: '0.50' };

describe('initialScoreParts', () => {
  it('SAT: the baseline total, Verbal and Math under it, and what the student wrote', () => {
    expect(initialScoreParts(sat, 'sat')).toEqual({ main: '1000', detail: 'V 480 · M 520', previous: 'March 2025 - Math 700, Verbal 650' });
  });

  it('IELTS: the diagnostic overall with one decimal and the three bands it covers', () => {
    expect(initialScoreParts(ielts, 'ielts')).toEqual({ main: '6.5', detail: 'L 6.5 · R 7.0 · W 6.0', previous: 'Overall 6.0' });
  });

  it('keeps the written text when there is no structured figure', () => {
    expect(initialScoreParts({ ...sat, total: null, verbal: null, math: null }, 'sat'))
      .toEqual({ main: null, detail: null, previous: 'March 2025 - Math 700, Verbal 650' });
  });

  it('has nothing for NUET (Assignment Zero asks for no score) or for a student without any', () => {
    expect(initialScoreParts(sat, 'nuet')).toEqual({ main: null, detail: null, previous: null });
    expect(initialScoreParts(null, 'sat')).toEqual({ main: null, detail: null, previous: null });
    expect(initialScoreParts(undefined, 'ielts')).toEqual({ main: null, detail: null, previous: null });
  });

  it('shows only the bands that exist', () => {
    expect(initialScoreParts({ ...ielts, reading: null, writing: null }, 'ielts').detail).toBe('L 6.5');
  });
});

describe('changeParts', () => {
  it('SAT is a whole number with a sign', () => {
    expect(changeParts('210.00', 'sat')).toEqual({ text: '+210', tone: 'up' });
    expect(changeParts('-40.00', 'sat')).toEqual({ text: '−40', tone: 'down' });
  });

  it('IELTS keeps its half band', () => {
    expect(changeParts('0.50', 'ielts')).toEqual({ text: '+0.5', tone: 'up' });
    expect(changeParts('-1.00', 'ielts')).toEqual({ text: '−1.0', tone: 'down' });
  });

  it('zero is flat, and no change means no chip', () => {
    expect(changeParts('0.00', 'sat')).toEqual({ text: '0', tone: 'flat' });
    expect(changeParts(null, 'sat')).toBeNull();
    expect(changeParts(undefined, 'ielts')).toBeNull();
  });
});
