// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle, text, unmount } from '@/components/staff-training/__tests__/kit';
import { type } from '@/pages/publicWebinarsTestKit';
import type { AnswerResponse, SearchResponse } from '@/services/api/staffTrainingSearch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/components/staff-training/__tests__/kit')).authMock('curator'));
const api = vi.hoisted(() => ({ searchTraining: vi.fn(), answerTraining: vi.fn() }));
vi.mock('@/services/api/staffTrainingSearch', () => api);

import SearchPage from './SearchPage';

const response = (over: Partial<SearchResponse> = {}): SearchResponse => ({
  query: 'student disappeared quietly',
  answer_available: true,
  results: [
    {
      document: { kind: 'clip', clip_id: 7, title: { ru: 'Риск ухода', en: 'Risk of leaving' }, role_tracks: ['curator'] },
      score: 0.81,
      moments: [
        { chunk_id: 311, start_ms: 42_000, label: '0:42', text: { ru: 'Здесь нет активности.', en: 'Students with no activity.' }, highlight: { ru: 'Здесь <mark>нет активности</mark>.', en: 'Students with <mark>no activity</mark>.' } },
        { chunk_id: 312, start_ms: 60_000, label: '1:00', text: { ru: 'Создайте задачу.', en: 'Create a task.' }, highlight: { ru: 'Создайте задачу.', en: 'Create a task.' } },
      ],
    },
    {
      document: { kind: 'handbook', key: 'crm-curator', title: { ru: 'Справочник куратора', en: 'Curator handbook' }, url: 'https://h.test/curator.html' },
      score: 0.4,
      moments: [{ chunk_id: 900, start_ms: null, label: '', anchor: 'card-8', url: 'https://h.test/curator.html#card-8', text: { ru: 'Риск ухода: позвонить ученику.', en: '' }, highlight: { ru: 'Риск ухода: позвонить ученику.', en: '' } }],
    },
    {
      document: { kind: 'task', task_id: 3, title: { ru: 'Отметьте посещаемость', en: 'Mark attendance' }, role_tracks: ['curator', 'head_curator'] },
      score: 0.3,
      moments: [{ chunk_id: 950, start_ms: null, label: '', text: { ru: 'Откройте урок.', en: 'Open the lesson.' }, highlight: { ru: 'Откройте урок.', en: 'Open the lesson.' } }],
    },
  ],
  ...over,
});

const answered = (over: Partial<AnswerResponse> = {}): AnswerResponse => ({
  answer: 'Open «Risk of leaving».', unknown: false, reason: null,
  citations: [{ chunk_id: 311, label: '0:42', clip_id: 7, kind: 'clip', start_ms: 42_000, task_id: null }], ...over,
});

const open = (url = '/training/search?q=student%20disappeared%20quietly') => mount(
  <MemoryRouter initialEntries={[url]}><Routes><Route path="/training/search" element={<SearchPage />} /></Routes></MemoryRouter>,
);
const links = () => Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
const buttonNamed = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(label));

beforeEach(() => {
  api.searchTraining.mockReset().mockResolvedValue(response());
  api.answerTraining.mockReset().mockResolvedValue(answered());
});
afterEach(unmount);

describe('the search page', () => {
  it('searches the address’s query and groups the results by clip, handbook and task', async () => {
    await open();
    expect(api.searchTraining).toHaveBeenCalledWith('student disappeared quietly');
    expect(Array.from(document.querySelectorAll('[data-result]')).map((el) => el.getAttribute('data-result'))).toEqual(['clip', 'handbook', 'task']);
    expect(text()).toContain('Risk of leaving');
    expect(text()).toContain('Curator');                                  // the roles whose tracks hold the clip
    expect(document.querySelectorAll('mark')).toHaveLength(1);
    expect(document.querySelector('mark')?.textContent).toBe('no activity');
  });

  it('links each moment to its second, a task to its page, and a handbook section to its own address', async () => {
    await open();
    expect(links()).toContain('/training/clips/7?t=42');
    expect(links()).toContain('/training/clips/7?t=60');
    expect(links()).toContain('/training/clips/7');
    expect(links()).toContain('/training/tasks/3');
    expect(links()).toContain('https://h.test/curator.html#card-8');
    const external = document.querySelector('a[href="https://h.test/curator.html#card-8"]') as HTMLAnchorElement;
    expect(external.rel).toContain('noopener');
    expect(external.target).toBe('_blank');
  });

  it('shows the handbook text even without an address, and never invents a link', async () => {
    api.searchTraining.mockResolvedValue(response({ results: [{
      document: { kind: 'handbook', key: 'crm-curator', title: { ru: 'С', en: 'Curator handbook' }, url: null },
      score: 0.4, moments: [{ chunk_id: 900, start_ms: null, label: '', anchor: 'card-8', url: null, text: { ru: 'Позвонить ученику.', en: '' }, highlight: { ru: 'Позвонить ученику.', en: '' } }],
    }] }));
    await open();
    expect(text()).toContain('Позвонить ученику.');                        // the other language fills a text with no English
    expect(document.querySelectorAll('li[data-result] a')).toHaveLength(0);
  });

  it('asks for a short answer by itself for a question of three words, with the chunk ids of the results', async () => {
    await open();
    expect(api.answerTraining).toHaveBeenCalledWith('student disappeared quietly', [311, 312, 900, 950]);
    expect(text()).toContain('Short answer');
    expect(text()).toContain('Open «Risk of leaving».');
    const chip = document.querySelector('[data-citation="311"]') as HTMLAnchorElement;
    expect(chip.getAttribute('href')).toBe('/training/clips/7?t=42');
    expect(chip.textContent).toBe('Risk of leaving · 0:42');
    expect(text()).toContain('using only our videos and handbooks');
  });

  it('shows the results first: while the answer is being written they are already there', async () => {
    let finish: (a: AnswerResponse) => void = () => undefined;
    api.answerTraining.mockReturnValue(new Promise<AnswerResponse>((resolve) => { finish = resolve; }));
    await open();
    expect(document.querySelector('[data-answer="loading"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-result]')).toHaveLength(3);
    finish(answered());
    await settle();
    expect(document.querySelector('[data-answer="answer"]')).not.toBeNull();
  });

  it('gives a button for a short query, and writes the answer only when it is pressed', async () => {
    await open('/training/search?q=student%20disappeared');
    expect(api.answerTraining).not.toHaveBeenCalled();
    await click(buttonNamed('Write a short answer') ?? null);
    await settle();
    expect(api.answerTraining).toHaveBeenCalledWith('student disappeared', [311, 312, 900, 950]);
    expect(text()).toContain('Open «Risk of leaving».');
  });

  it('says «I don’t know» as a normal answer and keeps the results', async () => {
    api.answerTraining.mockResolvedValue({ answer: null, unknown: true, citations: [], reason: null });
    await open();
    expect(document.querySelector('[data-answer="unknown"]')?.textContent).toContain('I don’t know');
    expect(document.querySelectorAll('[data-result]')).toHaveLength(3);
  });

  it('is quiet when answers are off, says so in one line when they are paused, and always keeps the results', async () => {
    api.answerTraining.mockResolvedValue({ answer: null, unknown: false, citations: [], reason: 'disabled' });
    await open();
    expect(document.querySelector('[data-answer]')).toBeNull();
    await unmount();
    api.answerTraining.mockResolvedValue({ answer: null, unknown: false, citations: [], reason: 'cap_reached' });
    await open();
    expect(document.querySelector('[data-answer="cap_reached"]')?.textContent).toContain('paused until next month');
    expect(document.querySelectorAll('[data-result]')).toHaveLength(3);
    await unmount();
    api.answerTraining.mockRejectedValue(new Error('boom'));
    await open();
    expect(document.querySelector('[data-answer="error"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-result]')).toHaveLength(3);
  });

  it('offers no answer when the server says there is nothing strong enough to answer from', async () => {
    api.searchTraining.mockResolvedValue(response({ answer_available: false }));
    await open();
    expect(api.answerTraining).not.toHaveBeenCalled();
    expect(document.querySelector('[data-answer]')).toBeNull();
    expect(document.querySelectorAll('[data-result]')).toHaveLength(3);
  });

  it('says so when nothing was found', async () => {
    api.searchTraining.mockResolvedValue(response({ results: [], answer_available: false, query: 'zzz qqq' }));
    await open('/training/search?q=zzz%20qqq');
    expect(document.querySelector('[data-no-results]')?.textContent).toContain('Nothing found for “zzz qqq”');
  });

  it('searches again when a new question is typed, and starts the answer afresh', async () => {
    await open();
    api.searchTraining.mockClear();
    api.answerTraining.mockClear();
    await type('#st-search-input', 'how to freeze a student');
    await click(buttonNamed('Search') ?? null);
    await settle();
    expect(api.searchTraining).toHaveBeenCalledWith('how to freeze a student');
    expect(api.answerTraining).toHaveBeenCalledWith('how to freeze a student', [311, 312, 900, 950]);
  });

  it('does nothing without a query, and a blank one cannot be submitted', async () => {
    await open('/training/search');
    expect(api.searchTraining).not.toHaveBeenCalled();
    expect(text()).toContain('Type a few words and press Search.');
    expect((buttonNamed('Search') as HTMLButtonElement).disabled).toBe(true);
  });

  it('says staff training is off when the server answers 404, and offers a retry for other failures', async () => {
    api.searchTraining.mockRejectedValue(Object.assign(new Error('x'), { cause: { response: { status: 404 } } }));
    await open();
    expect(text()).toContain('not switched on yet');
    await unmount();
    api.searchTraining.mockRejectedValue(new Error('network'));
    await open();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(buttonNamed('Try again')).toBeTruthy();
  });
});
