import { describe, expect, it } from 'vitest';
import { surnameInitial, teacherFirstName, teacherGroupTail } from './groupNames';

describe('teacherFirstName', () => {
  it('takes the second word of «Фамилия Имя Отчество»', () => {
    // The reported bug: the first word went into group names, so they carried surnames.
    expect(teacherFirstName('Кенжебаев Арсен')).toBe('Арсен');
    expect(teacherFirstName('Орынбасар Ақжол Ерғалиұлы')).toBe('Ақжол');
    expect(teacherFirstName('  Есен   Нұрғалы  Беғалыұлы ')).toBe('Нұрғалы');
  });

  it("ignores a head's title in the ФИО", () => {
    expect(teacherFirstName('Head of NUET Керимхан Альбар')).toBe('Альбар');
    expect(surnameInitial('Head of SAT Абдураимов Азамат')).toBe('А.');
  });

  it('treats a one-word name as the first name and never returns undefined', () => {
    expect(teacherFirstName('Коркем')).toBe('Коркем');
    expect(teacherFirstName('')).toBe('');
    expect(teacherFirstName(undefined)).toBe('');
    expect(surnameInitial('Коркем')).toBe('');
  });
});

describe('teacherGroupTail', () => {
  it('is the first name when nobody else has it', () => {
    expect(teacherGroupTail('Кенжебаев Арсен', ['Кенжебаев Арсен', 'Шадеева Арайлым'])).toBe('Арсен');
  });

  it('adds the surname initial for a shared first name', () => {
    const teachers = ['Ақтай Мирас Айқынұлы', 'Қиясбек Мирас', 'Кенжебаев Арсен'];
    expect(teacherGroupTail('Ақтай Мирас Айқынұлы', teachers)).toBe('Мирас А.');
    expect(teacherGroupTail('Қиясбек Мирас', teachers)).toBe('Мирас Қ.');
  });

  it('does not count two accounts with the identical full name as a clash', () => {
    expect(teacherGroupTail('Абдураимов Азамат', ['Абдураимов Азамат', 'Абдураимов Азамат'])).toBe('Азамат');
  });
});
