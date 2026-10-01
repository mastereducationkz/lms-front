import { describe, expect, it } from 'vitest';
import {
  LIBRARY_MAX_BYTES, filterLibrary, filterSection, hasAnyItems, initialMaterialsTab, libraryNotificationPath,
  missingChunks, moveId, planChunks, preCheckLibraryFile, programLabel, retryDelayMs, toMaterialItem, uploadPercent,
  withoutOwnSections,
} from './library';
import type { LibraryItem, LibrarySection, LibraryView } from '../services/api/library';

const MB = 1024 * 1024;

function item(id: number, title: string, extra: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id, kind: 'file', title, position: id,
    file: { id: id * 10, ext: 'pdf', mime_type: 'application/pdf', kind: 'file', size_bytes: 1000, original_name: `${title}.pdf` },
    url: null, added_by: null, added_at: '2026-10-01T10:00:00Z', removed: null, open_count: null,
    can_remove: false, can_moderate: false, ...extra,
  };
}

function section(id: number, title: string, items: LibraryItem[], extra: Partial<LibrarySection> = {}): LibrarySection {
  return {
    id, scope: 'program', program_type: 'ielts', title, teachers_only: false, position: id, owner: null,
    can_manage: false, items, ...extra,
  };
}

const view: LibraryView = {
  programs: [
    { program: 'ielts', label: 'IELTS', can_manage: false, sections: [
      section(1, 'Cambridge 18', [item(1, 'Test 1 Listening'), item(2, 'Test 1 Reading')]),
      section(2, 'Grammar', [item(3, 'Murphy Essential')]),
    ] },
    { program: 'sat', label: 'SAT', can_manage: false, sections: [] },
  ],
  groups: [
    { group_id: 7, group_name: 'IELTS July 8', teacher_name: 'Гульзада', sections: [
      section(9, 'Worksheets', [item(9, 'Linking words')], { scope: 'teacher', program_type: null }),
    ] },
  ],
  can_create_teacher_sections: false,
};

describe('preCheckLibraryFile', () => {
  it('takes a book up to 150 MB, which a lesson upload would refuse', () => {
    expect(preCheckLibraryFile({ name: 'Cambridge 18.pdf', size: 120 * MB })).toBeNull();
    expect(preCheckLibraryFile({ name: 'scan.pdf', size: LIBRARY_MAX_BYTES + 1 })).toBe('library_too_large');
  });

  it('keeps the lesson rules for type, video and empty files', () => {
    expect(preCheckLibraryFile({ name: 'audio.zip', size: 10 })).toBe('unsupported_type');
    expect(preCheckLibraryFile({ name: 'lesson.mp4', size: 10 })).toBe('video_not_allowed');
    expect(preCheckLibraryFile({ name: 'track 01.mp3', size: 0 })).toBe('empty_file');
  });
});

describe('chunk planner', () => {
  it('cuts a file into chunk-sized ranges with a shorter last one', () => {
    expect(planChunks(12, 5)).toEqual([
      { index: 0, start: 0, end: 5 }, { index: 1, start: 5, end: 10 }, { index: 2, start: 10, end: 12 },
    ]);
    expect(planChunks(10, 5)).toHaveLength(2);
    expect(planChunks(0, 5)).toEqual([]);
  });

  it('resumes with only the chunks the server has not confirmed', () => {
    const plan = planChunks(12, 5);
    expect(missingChunks(plan, [0, 2]).map((c) => c.index)).toEqual([1]);
    expect(missingChunks(plan, [])).toHaveLength(3);
  });

  it('reports progress from confirmed chunks plus the bytes in flight', () => {
    const plan = planChunks(100, 40);
    expect(uploadPercent(plan, [])).toBe(0);
    expect(uploadPercent(plan, [0])).toBe(40);
    expect(uploadPercent(plan, [0], 20)).toBe(60);
    expect(uploadPercent(plan, [0, 1, 2])).toBe(100);
  });

  it('backs off 1 s, 2 s, 4 s between tries', () => {
    expect([1, 2, 3].map(retryDelayMs)).toEqual([1000, 2000, 4000]);
  });
});

describe('moveId', () => {
  it('swaps with the neighbour and refuses to move past either end', () => {
    expect(moveId([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(moveId([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
    expect(moveId([1, 2, 3], 1, -1)).toBeNull();
    expect(moveId([1, 2, 3], 3, 1)).toBeNull();
    expect(moveId([1, 2, 3], 4, 1)).toBeNull();
  });
});

describe('search', () => {
  it('keeps a whole section whose title matches, else only its matching items', () => {
    expect(filterSection(view.programs[0].sections[0], 'cambridge')?.items).toHaveLength(2);
    expect(filterSection(view.programs[0].sections[0], 'reading')?.items.map((i) => i.id)).toEqual([2]);
    expect(filterSection(view.programs[0].sections[1], 'reading')).toBeNull();
  });

  it('matches a file by its original name and ignores case', () => {
    const s = section(5, 'Misc', [item(5, 'Book', { file: { ...item(5, 'x').file!, original_name: 'Destination B2.pdf' } })]);
    expect(filterSection(s, 'DESTINATION')?.items).toHaveLength(1);
  });

  it('drops blocks left empty by a search, and nothing without one', () => {
    expect(filterLibrary(view, '')).toBe(view);
    const found = filterLibrary(view, 'linking');
    expect(found.programs).toEqual([]);
    expect(found.groups.map((g) => g.group_id)).toEqual([7]);
  });
});

describe('library views', () => {
  it('leaves a teacher’s own sections out of the group blocks', () => {
    expect(withoutOwnSections(view.groups, [9])).toEqual([]);
    expect(withoutOwnSections(view.groups, [1])).toHaveLength(1);
  });

  it('knows when a student has nothing to read yet', () => {
    expect(hasAnyItems(view)).toBe(true);
    expect(hasAnyItems({ ...view, programs: [{ ...view.programs[1] }], groups: [] })).toBe(false);
  });

  it('labels programs', () => {
    expect(programLabel('general_english')).toBe('General English');
    expect(programLabel('nuet')).toBe('NUET');
  });
});

describe('toMaterialItem', () => {
  it('gives the lesson row what it needs, never the lesson-only gates', () => {
    const row = toMaterialItem(item(1, 'Test 1', { can_remove: true, can_moderate: true }));
    expect(row).toMatchObject({ id: 1, title: 'Test 1', hidden_until_end: false, show_after_end: false, can_detach: true });
    expect(row.can_rename).toBe(false); // a file is renamed on the shelf, not per section
    const link = toMaterialItem(item(2, 'Quizlet', { kind: 'link', file: null, url: 'https://quizlet.com', can_remove: true }));
    expect(link.can_rename).toBe(true);
  });

  it('marks a moderated item removed with its reason', () => {
    const row = toMaterialItem(item(3, 'Leak', { removed: { reason: 'answer key', removed_at: '2026-10-01T10:00:00Z', removed_by_name: 'Admin' } }));
    expect(row.removed).toEqual({ kind: 'moderated', reason: 'answer key', removed_at: '2026-10-01T10:00:00Z', removed_by_name: 'Admin' });
  });
});

describe('the materials page tab', () => {
  it('opens the library from ?tab=library, unless a lesson deep link is present', () => {
    expect(initialMaterialsTab(new URLSearchParams('tab=library'))).toBe('library');
    expect(initialMaterialsTab(new URLSearchParams('tab=library&lesson=5'))).toBe('lessons');
    expect(initialMaterialsTab(new URLSearchParams(''))).toBe('lessons');
  });

  it('sends library bell items to the library tab and leaves the rest to the caller', () => {
    expect(libraryNotificationPath('library')).toBe('/materials?tab=library');
    expect(libraryNotificationPath('library_item_removed')).toBe('/materials?tab=library');
    expect(libraryNotificationPath('class_materials')).toBeNull();
  });
});
