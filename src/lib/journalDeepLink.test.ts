import { describe, expect, it } from 'vitest';
import { deepLinkedFinishedGroup } from './journalDeepLink';

const groups = [{ id: 1, is_over: false }, { id: 2, is_over: true }, { id: 3 }];

describe('deepLinkedFinishedGroup', () => {
  it('names the linked group when it is finished, so the hide-completed box must give way', () => {
    expect(deepLinkedFinishedGroup(groups, '2')).toBe(2);
  });

  it('leaves a running group alone: the box hides nothing it asked for', () => {
    expect(deepLinkedFinishedGroup(groups, '1')).toBeNull();
    expect(deepLinkedFinishedGroup(groups, '3')).toBeNull();
  });

  it('ignores a missing, malformed or unknown id', () => {
    expect(deepLinkedFinishedGroup(groups, null)).toBeNull();
    expect(deepLinkedFinishedGroup(groups, '')).toBeNull();
    expect(deepLinkedFinishedGroup(groups, 'abc')).toBeNull();
    expect(deepLinkedFinishedGroup(groups, '99')).toBeNull();
  });
});
