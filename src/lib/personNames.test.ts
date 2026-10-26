import { describe, expect, it } from 'vitest';
import { firstName } from './personNames';

describe('firstName — mirrors lms-backend src/utils/person_names.py', () => {
  it('reads the second word of a Cyrillic «Фамилия Имя»', () => {
    expect(firstName('Серикова Аида')).toBe('Аида');
  });

  it('reads the middle word of «Фамилия Имя Отчество»', () => {
    expect(firstName('Ахметов Ержан Серикович')).toBe('Ержан');
  });

  it('reads the first word of a Latin-only name', () => {
    expect(firstName('Aida Serikova')).toBe('Aida');
  });

  it('keeps a single word and copes with nothing', () => {
    expect(firstName('Kerey')).toBe('Kerey');
    expect(firstName('  ')).toBe('');
    expect(firstName(null)).toBe('');
  });
});
