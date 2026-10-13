import { beforeEach, describe, expect, it, vi } from 'vitest';

// `./client` touches `document`/`localStorage` at module scope, which vitest's node environment doesn't have.
vi.mock('./client', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { api } from './client';
import { answerInvitation, asInvitation, getMyInvitation, InvitationAnswerError } from './leagueInvitation';

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;

const raw = (over: Record<string, unknown> = {}) => ({
  id: 5,
  state: 'open',
  cohort_name: 'Ноябрь 2026',
  exam_date: '2026-11-07',
  invited_at: '2026-10-14T11:00:00Z',
  expires_at: '2026-10-16T11:00:00Z',
  responded_at: null,
  seconds_left: 169200,
  options: [{ group_id: 376, label: 'Master League Dreamville', schedule_text: 'Пн, Ср 18:00; Сб 11:00', seats_left: null }],
  chosen_group_id: null,
  member_status: null,
  server_now: '2026-10-14T12:00:00Z',
  ...over,
});

beforeEach(() => { get.mockReset(); post.mockReset(); });

describe('asInvitation', () => {
  it('reads the server\'s answer', () => {
    expect(asInvitation(raw())).toEqual({
      id: 5, state: 'open', cohort_name: 'Ноябрь 2026', exam_date: '2026-11-07', expires_at: '2026-10-16T11:00:00Z',
      responded_at: null, server_now: '2026-10-14T12:00:00Z', chosen_group_id: null, member_status: null,
      options: [{ group_id: 376, label: 'Master League Dreamville', schedule_text: 'Пн, Ср 18:00; Сб 11:00', seats_left: null }],
    });
  });

  it('keeps what an accepted student needs', () => {
    const accepted = asInvitation(raw({ state: 'accepted', chosen_group_id: 376, responded_at: '2026-10-14T12:01:00Z', member_status: 'enrolled' }));
    expect(accepted).toMatchObject({ state: 'accepted', chosen_group_id: 376, member_status: 'enrolled' });
  });

  it.each([
    ['null', null],
    ['an HTML page', '<html>502</html>'],
    ['an error envelope', { detail: 'Internal error' }],
    ['an unknown state', raw({ state: 'maybe' })],
    ['no deadline', raw({ expires_at: undefined })],
    ['a deadline that is not a time', raw({ expires_at: 'tomorrow' })],
    ['no exam day', raw({ exam_date: undefined })],
  ])('refuses %s', (_label, data) => {
    expect(asInvitation(data)).toBeNull();
  });

  it('drops options without a squad, blanks the rest, and tolerates a missing or odd seat count', () => {
    const inv = asInvitation(raw({ options: [{ label: 'x' }, { group_id: 1, seats_left: 'many' }, null] }));
    expect(inv?.options).toEqual([{ group_id: 1, label: '', schedule_text: '', seats_left: null }]);
    expect(asInvitation(raw({ options: 'nope' }))?.options).toEqual([]);
  });

  it('ignores a member status it does not know', () => {
    expect(asInvitation(raw({ member_status: 'ghost' }))?.member_status).toBeNull();
  });
});

describe('getMyInvitation', () => {
  it('is null when there is no invitation', async () => {
    get.mockResolvedValueOnce({ data: null });
    expect(await getMyInvitation()).toBeNull();
    expect(get).toHaveBeenCalledWith('/master-league/invitation', { cache: false });
  });

  it('returns the invitation', async () => {
    get.mockResolvedValueOnce({ data: raw() });
    expect((await getMyInvitation())?.id).toBe(5);
  });

  it('rejects, rather than say «nothing», when the answer is not understood or the request fails', async () => {
    get.mockResolvedValueOnce({ data: '<html>502</html>' });
    await expect(getMyInvitation()).rejects.toThrow();
    get.mockRejectedValueOnce(new Error('Network Error'));
    await expect(getMyInvitation()).rejects.toThrow('Network Error');
  });
});

describe('answerInvitation', () => {
  it('sends «I\'m in» with the squad and returns the invitation as it now stands', async () => {
    post.mockResolvedValueOnce({ data: raw({ state: 'accepted', chosen_group_id: 376 }) });
    const inv = await answerInvitation(true, 376);
    expect(post).toHaveBeenCalledWith('/master-league/invitation/answer', { accept: true, group_id: 376 });
    expect(inv).toMatchObject({ state: 'accepted', chosen_group_id: 376 });
  });

  it('sends «Not this time» without a squad', async () => {
    post.mockResolvedValueOnce({ data: raw({ state: 'declined' }) });
    await answerInvitation(false, 376);
    expect(post).toHaveBeenCalledWith('/master-league/invitation/answer', { accept: false, group_id: null });
  });

  it.each([[400], [409]])('calls a %i «changed»: the server looked and the invitation had moved on', async (status) => {
    post.mockRejectedValueOnce({ response: { status, data: { detail: 'This invitation has run out' } } });
    await expect(answerInvitation(true, 376)).rejects.toMatchObject({ kind: 'changed', status });
  });

  it.each([[500], [502], [undefined]])('calls %s «retry»: nothing was saved, the button can be pressed again', async (status) => {
    post.mockRejectedValueOnce(status ? { response: { status } } : new Error('Network Error'));
    const error = await answerInvitation(true, 376).catch((e) => e);
    expect(error).toBeInstanceOf(InvitationAnswerError);
    expect(error.kind).toBe('retry');
  });

  it('calls a reply it cannot read «retry» too', async () => {
    post.mockResolvedValueOnce({ data: '' });
    await expect(answerInvitation(true, 376)).rejects.toMatchObject({ kind: 'retry' });
  });
});
