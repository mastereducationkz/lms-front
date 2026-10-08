// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedLessonEntry, LessonBrief } from '../../services/api/classMaterials';

const h = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../services/api/classMaterials', () => ({ listManageableLessons: h.list }));
// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import AddToLessonDialog from './AddToLessonDialog';
import LessonMaterialsCard from './LessonMaterialsCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const lesson = (id: number, patch: Partial<LessonBrief> = {}): LessonBrief => ({
  id, title: 'Lesson', start_datetime: '2026-10-12T09:00:00', end_datetime: '2026-10-12T10:00:00',
  is_active: true, topic: null, group_ids: [1], group_names: ['SAT-3'], ...patch,
});
const entry = (patch: Partial<FeedLessonEntry> = {}, lessonPatch: Partial<LessonBrief> = {}): FeedLessonEntry => ({
  lesson: lesson(7, lessonPatch), items: [], pending_after_end: 0, ...patch,
});

let root: Root | null = null;
let host: HTMLDivElement;
async function mount(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
}
const flush = () => act(async () => { await Promise.resolve(); });
const buttons = (scope: ParentNode = document.body) => Array.from(scope.querySelectorAll('button'));
const byText = (text: string, scope: ParentNode = document.body) => buttons(scope).find((b) => b.textContent?.trim() === text);

beforeEach(() => h.list.mockReset());
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('the lesson card on the Materials tab', () => {
  const card = (e: FeedLessonEntry, onAdd?: (id: number) => void) => (
    <MemoryRouter>
      <LessonMaterialsCard entry={e} locale="en" onOpenItem={() => undefined} onAdd={onAdd} />
    </MemoryRouter>
  );

  it('offers Add on a lesson the viewer manages, and asks to add to that lesson', async () => {
    const onAdd = vi.fn();
    await mount(card(entry({ can_manage: true }), onAdd));
    const add = byText('Add', host);
    expect(add).toBeTruthy();
    await act(async () => { add!.click(); });
    expect(onAdd).toHaveBeenCalledWith(7);
  });

  it('offers nothing to a viewer who does not manage the lesson', async () => {
    await mount(card(entry({ can_manage: false }), vi.fn()));
    expect(byText('Add', host)).toBeUndefined();
  });

  it('offers nothing when the page gave no way to add', async () => {
    await mount(card(entry({ can_manage: true })));
    expect(byText('Add', host)).toBeUndefined();
  });

  it('does not offer Add on a cancelled lesson', async () => {
    await mount(card(entry({ can_manage: true }, { is_active: false }), vi.fn()));
    expect(byText('Add', host)).toBeUndefined();
  });

  it('invites a manager to add the first material instead of telling them the teacher has not', async () => {
    await mount(card(entry({ can_manage: true }), vi.fn()));
    expect(host.textContent).toContain('Add the first material');
    expect(host.textContent).not.toContain("hasn't added");
  });

  it('keeps the plain empty line for everyone else', async () => {
    await mount(card(entry({ can_manage: false })));
    expect(host.textContent).toContain("hasn't added");
  });
});

describe('the lesson picker', () => {
  const rows = [
    { lesson: lesson(21, { topic: 'Algebra' }), item_count: 0 },
    { lesson: lesson(22, { topic: 'Geometry' }), item_count: 3 },
  ];
  const dialog = (props: Partial<React.ComponentProps<typeof AddToLessonDialog>> = {}) => (
    <AddToLessonDialog
      open
      onOpenChange={vi.fn()}
      groups={[{ id: 1, name: 'SAT-3' }]}
      initialGroupId={null}
      locale="en"
      onPick={vi.fn()}
      {...props}
    />
  );

  it('lists the lessons of the only group straight away, with how many materials each has', async () => {
    h.list.mockResolvedValue(rows);
    await mount(dialog());
    await flush();
    expect(h.list).toHaveBeenCalledWith(1);
    expect(document.body.textContent).toContain('Algebra');
    expect(document.body.textContent).toContain('Geometry');
    expect(document.body.textContent).toContain('3 items');
  });

  it('hands the chosen lesson over and closes', async () => {
    h.list.mockResolvedValue(rows);
    const onPick = vi.fn();
    const onOpenChange = vi.fn();
    await mount(dialog({ onPick, onOpenChange }));
    await flush();
    const row = buttons().find((b) => b.textContent?.includes('Geometry'));
    await act(async () => { row!.click(); });
    expect(onPick).toHaveBeenCalledWith(22);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('asks for a group first when there are several and none is chosen, and loads nothing yet', async () => {
    await mount(dialog({ groups: [{ id: 1, name: 'SAT-3' }, { id: 2, name: 'IELTS-1' }] }));
    await flush();
    expect(h.list).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Pick a group');
  });

  it('starts on the group the feed is already filtered to', async () => {
    h.list.mockResolvedValue(rows);
    await mount(dialog({ groups: [{ id: 1, name: 'SAT-3' }, { id: 2, name: 'IELTS-1' }], initialGroupId: 2 }));
    await flush();
    expect(h.list).toHaveBeenCalledWith(2);
  });

  it('says so when the group has no lesson the viewer can add to', async () => {
    h.list.mockResolvedValue([]);
    await mount(dialog());
    await flush();
    expect(document.body.textContent).toContain('No lessons in this group that you can add materials to');
  });

  it('offers a retry when the lessons cannot be loaded', async () => {
    h.list.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(rows);
    await mount(dialog());
    await flush();
    const retry = byText('Retry');
    expect(retry).toBeTruthy();
    await act(async () => { retry!.click(); });
    await flush();
    expect(document.body.textContent).toContain('Algebra');
  });
});
