import { describe, expect, it } from 'vitest';
import { isBannerShaped, programLabel, programOf, progressSummary } from './courseProgram';

describe('programOf', () => {
  it('reads the programme from the real course titles', () => {
    expect(programOf('Master SAT: Verbal and Maths')).toBe('sat');
    expect(programOf('Master IELTS')).toBe('ielts');
    expect(programOf('NUET')).toBe('nuet');
    expect(programOf('General English. From A2 to B1')).toBe('english');
    expect(programOf('Pre-SAT Foundations')).toBe('sat');
  });

  it('does not match look-alike words and falls back to other', () => {
    expect(programOf('Satellite physics')).toBe('other');
    expect(programOf('')).toBe('other');
    expect(programOf(null)).toBe('other');
  });
});

describe('programLabel', () => {
  it('names the chip, with Pre-SAT kept distinct', () => {
    expect(programLabel('Master SAT: Verbal and Maths')).toBe('SAT');
    expect(programLabel('Pre SAT Grammar')).toBe('Pre-SAT');
    expect(programLabel('Master IELTS')).toBe('IELTS');
    expect(programLabel('General English. From A2 to B1')).toBe('English');
    expect(programLabel('Something else')).toBe('Course');
  });
});

describe('isBannerShaped', () => {
  it('accepts banners and photos, rejects square logos and portraits', () => {
    expect(isBannerShaped(1600, 900)).toBe(true);
    expect(isBannerShaped(1200, 900)).toBe(true); // 4:3 photo
    expect(isBannerShaped(500, 500)).toBe(false); // the Master logo
    expect(isBannerShaped(600, 900)).toBe(false);
    expect(isBannerShaped(0, 0)).toBe(false);
  });
});

describe('progressSummary', () => {
  it('puts the percentage before the lesson count', () => {
    expect(progressSummary(15, '1 из 31 урока')).toBe('15% · 1 из 31 урока');
    expect(progressSummary(64.4, '')).toBe('64%');
    expect(progressSummary(null, '0 из 24 уроков')).toBe('0% · 0 из 24 уроков');
    expect(progressSummary(140, '')).toBe('100%');
  });
});
