// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The page for a student's Master League invitation: what a tap does, what a double tap does, and what
// the page says when the server refuses or the network fails.
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { id: 7, role: 'student', ui_language: 'en' } }) };
});
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/services/api/masterLeague', () => ({ getMyLeague: vi.fn(async () => null) }));
vi.mock('@/services/api/leagueInvitation', async () => ({
  ...(await vi.importActual<typeof import('@/services/api/leagueInvitation')>('@/services/api/leagueInvitation')),
  getMyInvitation: vi.fn(),
  answerInvitation: vi.fn(),
}));

import { answerInvitation, getMyInvitation, InvitationAnswerError, type LeagueInvitation } from '@/services/api/leagueInvitation';
import LeagueInvitationPage from './LeagueInvitationPage';

const get = vi.mocked(getMyInvitation);
const answer = vi.mocked(answerInvitation);

/** Open for another two days from "now", whenever the test runs. */
const open = (over: Partial<LeagueInvitation> = {}): LeagueInvitation => ({
  id: 5,
  state: 'open',
  cohort_name: 'Ноябрь 2026',
  exam_date: '2026-11-07',
  expires_at: new Date(Date.now() + 47 * 3_600_000).toISOString(),
  responded_at: null,
  server_now: new Date().toISOString(),
  options: [
    { group_id: 376, label: 'Master League Dreamville', schedule_text: 'Пн, Ср 18:00; Сб 11:00', seats_left: 3 },
    { group_id: 377, label: 'Master League KOD', schedule_text: 'Ср, Пт 20:00; Сб 12:00', seats_left: 8 },
  ],
  chosen_group_id: null,
  member_status: null,
  ...over,
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

const render = async () => {
  await act(async () => root.render(<MemoryRouter><LeagueInvitationPage /></MemoryRouter>));
};
const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name) as HTMLButtonElement | undefined;
const click = async (name: string) => {
  const target = button(name);
  expect(target, name).toBeTruthy();
  await act(async () => { target!.click(); });
};
const text = () => host.textContent ?? '';

describe('the invitation page', () => {
  it('shows the offer, and «I’m in» sends the chosen squad once, then confirms the seat request', async () => {
    get.mockResolvedValueOnce(open());
    answer.mockResolvedValueOnce(open({ state: 'accepted', chosen_group_id: 377 }));
    await render();
    expect(text()).toContain('You’ve been picked.');
    await act(async () => { button('I’m in: KOD')!.click(); button('I’m in: KOD')!.click(); }); // a double tap
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith(true, 377);
    expect(text()).toContain('Seat requested');
    expect(text()).toContain('KOD');
    expect(text()).not.toContain('I’m in');
  });

  it('asks once before «Not this time», and a «no» is sent without a squad', async () => {
    get.mockResolvedValueOnce(open());
    answer.mockResolvedValueOnce(open({ state: 'declined' }));
    await render();
    await click('Not this time');
    expect(answer).not.toHaveBeenCalled();
    expect(text()).toContain('Pass on this invitation?');
    await click('Keep my seat'); // changing one's mind costs nothing
    expect(text()).not.toContain('Pass on this invitation?');
    await click('Not this time');
    await click('Yes, not this time');
    expect(answer).toHaveBeenCalledWith(false, null);
    expect(text()).toContain('Thanks for letting us know');
  });

  it('when the server says the invitation moved on, tells the student and shows how it stands now', async () => {
    get.mockResolvedValueOnce(open()).mockResolvedValueOnce(open({ state: 'expired' }));
    answer.mockRejectedValueOnce(new InvitationAnswerError('changed', 409));
    await render();
    await click('I’m in: Dreamville');
    expect(get).toHaveBeenCalledTimes(2);
    expect(text()).toContain('This invitation has closed');
  });

  it('when the request fails, says so, changes nothing and lets the student try again', async () => {
    get.mockResolvedValueOnce(open());
    answer.mockRejectedValueOnce(new InvitationAnswerError('retry', 502)).mockResolvedValueOnce(open({ state: 'accepted', chosen_group_id: 376 }));
    await render();
    await click('I’m in: Dreamville');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('We couldn’t save your answer');
    expect(text()).toContain('Choose your squad');
    expect(button('I’m in: Dreamville')!.disabled).toBe(false);
    await click('I’m in: Dreamville');
    expect(answer).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Seat requested');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('never says «nothing here» because a request failed: it offers a retry', async () => {
    get.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(open());
    await render();
    expect(text()).toContain('We couldn’t load your invitation');
    expect(text()).not.toContain('No invitation right now');
    await click('Try again');
    expect(text()).toContain('You’ve been picked.');
  });

  it('says plainly when there is no invitation', async () => {
    get.mockResolvedValueOnce(null);
    await render();
    expect(text()).toContain('No invitation right now');
  });

  it('turns an offer whose deadline has passed into «closed» without waiting for anyone', async () => {
    get.mockResolvedValueOnce(open({ expires_at: new Date(Date.now() - 1000).toISOString(), server_now: new Date().toISOString() }));
    await render();
    expect(text()).toContain('This invitation has closed');
    expect(button('I’m in: KOD')).toBeUndefined();
  });

  it('welcomes a student the CRM has enrolled', async () => {
    get.mockResolvedValueOnce(open({ state: 'accepted', chosen_group_id: 376, member_status: 'enrolled' }));
    await render();
    expect(text()).toContain('You’re in the squad');
    expect(text()).toContain('Welcome to Dreamville');
  });
});
