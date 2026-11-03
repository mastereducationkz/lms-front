// @vitest-environment jsdom
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount, text, unmount } from '@/components/staff-training/__tests__/kit';
import { type } from '@/pages/publicWebinarsTestKit';

vi.mock('@/contexts/AuthContext', async () => (await import('@/components/staff-training/__tests__/kit')).authMock('curator'));
const api = vi.hoisted(() => ({ getTrainingMe: vi.fn(), getTrainingLibrary: vi.fn() }));
vi.mock('@/services/api/staffTraining', () => api);

import TrainingHomePage from './TrainingHomePage';

const Where = () => <p data-where>{useLocation().pathname + useLocation().search}</p>;
const open = () => mount(
  <MemoryRouter initialEntries={['/training']}>
    <Routes><Route path="/training" element={<TrainingHomePage />} /><Route path="/training/search" element={<Where />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  api.getTrainingMe.mockReset().mockResolvedValue({ user: { id: 1, role: 'curator', ui_locale: 'ru' }, enrollments: [], track: null, assigned_clips: [] });
  api.getTrainingLibrary.mockReset().mockResolvedValue([]);
});
afterEach(unmount);

describe('the search box on /training', () => {
  it('sits under the title and sends the question to the search page', async () => {
    await open();
    expect(document.querySelector('form[role="search"]')).not.toBeNull();
    expect(text()).toContain('Find the moment in any video, task or handbook');
    await type('#st-search-input', 'ученик пропал & ещё');
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Search') ?? null);
    expect(document.querySelector('[data-where]')?.textContent).toBe(`/training/search?q=${encodeURIComponent('ученик пропал & ещё')}`);
  });

  it('is not shown when staff training is switched off', async () => {
    api.getTrainingMe.mockRejectedValue(Object.assign(new Error('off'), { cause: { response: { status: 404 } } }));
    await open();
    expect(document.querySelector('form[role="search"]')).toBeNull();
  });
});
