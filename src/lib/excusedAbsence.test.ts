import { describe, expect, it } from 'vitest';
import { canBeExcused, displaysAsAbsence, excuseAwareStatus, excusePayload, isValidExcuseNote } from './excusedAbsence';

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

describe('excuseAwareStatus', () => {
  it('уважительная строка со статусом "registered" едет как "missed"', () => {
    // `registered` — это то, во что бэкенд переписывает легаси-спеллинги импорта
    // (`no`, `0`...). Сетка красит такую ячейку обычным амбером «Ув.», но отправка
    // сырого `registered` вместе с `excused: true` роняет весь батч 422-й — сервер
    // не считает `registered` пропуском.
    expect(excuseAwareStatus('registered', true, true)).toBe('missed');
  });

  it('нетронутая строка продолжает слать сырой статус, даже если уважительна', () => {
    // Нетронутая строка не несёт `excused` в payload вообще (см. excusePayload),
    // так что подменять статус ей незачем — и не нужно, раз никакой `excused: true`
    // рядом с ним не летит.
    expect(excuseAwareStatus('registered', false, true)).toBe('registered');
  });

  it('снятая уважительность не подменяет статус', () => {
    expect(excuseAwareStatus('registered', true, false)).toBe('registered');
  });

  it('обычный пропуск с уважительностью и так уже "missed" — статус не меняется', () => {
    expect(excuseAwareStatus('missed', true, true)).toBe('missed');
  });

  it('нормальный статус вне пропуска едет как есть', () => {
    expect(excuseAwareStatus('attended', false, false)).toBe('attended');
  });
});

describe('displaysAsAbsence', () => {
  it('охватывает всё, что рисуется как «Не был»', () => {
    // Шире, чем isAbsenceStatus: `registered` не хранится как пропуск, но сетка красит его
    // красным «Не был», а бэкенд сворачивает в него любой нераспознанный статус.
    expect(displaysAsAbsence('missed')).toBe(true);
    expect(displaysAsAbsence('absent')).toBe(true);
    expect(displaysAsAbsence('registered')).toBe(true);
    expect(displaysAsAbsence('attended')).toBe(false);
    expect(displaysAsAbsence('late')).toBe(false);
    expect(displaysAsAbsence('cancelled')).toBe(false);
  });
});
