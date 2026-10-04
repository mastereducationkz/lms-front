import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ default: { get: vi.fn() }, api: { get: vi.fn() } }));

import { normalizeFeedPage } from './classMaterials';

// LMS-FRONT-B: a resolved feed response without `groups` crashed «Материалы» into the error screen.
describe('normalizeFeedPage', () => {
  it('passes a normal page through', () => {
    const page = { lessons: [], next_before: '2026-10-01', groups: [{ id: 1, name: 'A' }] };
    expect(normalizeFeedPage(page)).toEqual(page);
  });

  it('treats missing groups as no groups and a missing cursor as the end', () => {
    expect(normalizeFeedPage({ lessons: [] })).toEqual({ lessons: [], next_before: null, groups: [] });
  });

  it('turns a body that is not a feed page into a failed load, never a crash later', () => {
    for (const bad of [undefined, null, '', '<!doctype html>', {}, { lessons: 'x' }]) {
      expect(() => normalizeFeedPage(bad)).toThrow('Unexpected class-materials feed response');
    }
  });
});
