import { describe, expect, it } from 'vitest';
import { hasCurator } from './curator';

describe('hasCurator', () => {
  it('reads the real group titles the way staff name them', () => {
    // Every approved group on 2026-09-10.
    const withCurator = [
      'July 1 NUET with curator',
      'July 1 with curator',
      'July 2 IELTS with curator',
      'June 10 IELTS with curator',
      'June 2 Nuet with curator',
      'June 7 IELTS with curator',
      'June 9 IELTS with curator',
      'NUET June 1 with curator 🤍',
    ];
    const without = ['SAT September 7 2026', 'IT отдел', 'Отдел продукта'];
    for (const title of withCurator) expect(hasCurator(title), title).toBe(true);
    for (const title of without) expect(hasCurator(title), title).toBe(false);
  });

  it('counts a mentor as a curator', () => {
    // One group says "with mentor" for the same role.
    expect(hasCurator('June 14 IELTS with mentor')).toBe(true);
  });

  it('reads the role tagged after a separator', () => {
    // How the chats created in September are named.
    for (const title of [
      'SAT August 19|Curator',
      'SAT July 3|Curator',
      'SAT September 1 | curator',
      'SAT July 7 // Mentor',
      'IELTS July 2 - Curator 🤍',
      'SAT July 8 (curator)',
      'SAT сентябрь | Куратор',
    ]) {
      expect(hasCurator(title), title).toBe(true);
    }
  });

  it('does not read "without curator" as having one', () => {
    expect(hasCurator('SAT October without curator')).toBe(false);
    expect(hasCurator('IELTS without mentor')).toBe(false);
  });

  it('ignores case and extra spaces', () => {
    expect(hasCurator('IELTS WITH CURATOR')).toBe(true);
    expect(hasCurator('IELTS With  Mentor')).toBe(true);
  });

  it('accepts the Russian spelling', () => {
    expect(hasCurator('SAT сентябрь с куратором')).toBe(true);
    expect(hasCurator('IELTS С ментором')).toBe(true);
    expect(hasCurator('SAT сентябрь без куратора')).toBe(false);
  });

  it('accepts the plural', () => {
    expect(hasCurator('IELTS with curators')).toBe(true);
    expect(hasCurator('SAT с кураторами')).toBe(true);
  });

  it('needs "with" before the role, as a word of its own', () => {
    // A staff chat named after the role is not a group that has one.
    expect(hasCurator('Curators team')).toBe(false);
    expect(hasCurator('Кураторы')).toBe(false);
    expect(hasCurator('IELTS with curatorship')).toBe(false);
  });

  it('does not read a staff chat named after the team as a tagged role', () => {
    expect(hasCurator('Master | Curators')).toBe(false);
    expect(hasCurator('Отдел | Кураторы')).toBe(false);
    expect(hasCurator('SAT|Curatorship')).toBe(false);
    expect(hasCurator('SAT July 3|No curator')).toBe(false);
  });

  it('treats an empty title as without', () => {
    expect(hasCurator('')).toBe(false);
  });
});
