import { describe, expect, it } from 'vitest';
import { canStartAdding, pickerGroupFor } from './classMaterialsAdd';

describe('who is offered "Add materials" on the Materials tab', () => {
  it.each(['teacher', 'head_teacher', 'admin'])('%s', (role) => {
    expect(canStartAdding(role)).toBe(true);
  });

  it.each(['student', 'parent', 'curator', 'head_curator', undefined, null, ''])('%s is not', (role) => {
    expect(canStartAdding(role as never)).toBe(false);
  });
});

describe('which group the lesson picker starts on', () => {
  const groups = [{ id: 4 }, { id: 9 }];

  it('keeps the group the feed is already filtered to', () => {
    expect(pickerGroupFor(groups, 9)).toBe(9);
  });

  it('takes the only group there is', () => {
    expect(pickerGroupFor([{ id: 4 }], null)).toBe(4);
  });

  it('asks the user to pick when there are several and none is chosen', () => {
    expect(pickerGroupFor(groups, null)).toBeNull();
  });

  it('ignores a preferred group the user no longer has', () => {
    expect(pickerGroupFor(groups, 77)).toBeNull();
    expect(pickerGroupFor([{ id: 4 }], 77)).toBe(4);
  });

  it('has nothing to start on without groups', () => {
    expect(pickerGroupFor([], null)).toBeNull();
  });
});
