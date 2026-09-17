import { describe, expect, it } from 'vitest';
import { canBeExcused, excusePayload, isValidExcuseNote } from './excusedAbsence';

describe('canBeExcused', () => {
  it('только отметка о пропуске может быть уважительной', () => {
    expect(canBeExcused('missed', false)).toBe(true);
    expect(canBeExcused('absent', false)).toBe(true);
    expect(canBeExcused('attended', false)).toBe(false);
    expect(canBeExcused('late', false)).toBe(false);
    expect(canBeExcused('cancelled', false)).toBe(false);
    expect(canBeExcused('registered', false)).toBe(false);
  });

  it('на будущем уроке нечего оправдывать', () => {
    // Бэкенд отдаёт неотмеченному уроку «missed» по умолчанию; сетка рисует «—».
    expect(canBeExcused('missed', true)).toBe(false);
  });
});

describe('isValidExcuseNote', () => {
  it('пустая причина и пробелы не годятся', () => {
    expect(isValidExcuseNote('болел')).toBe(true);
    expect(isValidExcuseNote('   ')).toBe(false);
    expect(isValidExcuseNote('')).toBe(false);
    expect(isValidExcuseNote(null)).toBe(false);
    expect(isValidExcuseNote(undefined)).toBe(false);
  });
});

describe('excusePayload', () => {
  it('нетронутая строка не несёт поля вообще', () => {
    // Это главное правило файла: и сетка, и панель замен пересохраняют строки,
    // которых никто не касался. `excused: false` в таком payload стёр бы причину,
    // поставленную кем-то другим.
    expect(excusePayload(false, false, null)).toEqual({});
    expect(excusePayload(false, true, 'болел')).toEqual({});
  });

  it('поставленная причина едет целиком', () => {
    expect(excusePayload(true, true, '  болел  ')).toEqual({
      excused: true,
      excuse_note: 'болел',
    });
  });

  it('снятая уважительность едет явным false', () => {
    expect(excusePayload(true, false, null)).toEqual({
      excused: false,
      excuse_note: null,
    });
  });
});
