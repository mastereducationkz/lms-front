import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '../../services/api/apiError';

const api = vi.hoisted(() => ({ getPublicSummary: vi.fn() }));
vi.mock('../../services/api/openWebinars', () => api);

import { opensToEveryoneAhead, publicWebinarRefusal } from './deleteNotice';

const NOW = Date.parse('2026-10-21T12:00:00Z');
const ahead = (id: number, over = {}) => ({ id, event_type: 'webinar', start_datetime: '2026-10-25T09:00:00Z', ...over }) as never;
beforeEach(() => { api.getPublicSummary.mockReset(); });

describe('does cancelling this mail registrants?', () => {
  it('says yes for an upcoming webinar that is open to everyone', async () => {
    api.getPublicSummary.mockResolvedValue({ open: true });
    expect(await opensToEveryoneAhead([ahead(7)], NOW)).toBe(true);
    expect(api.getPublicSummary).toHaveBeenCalledWith(7);
  });

  it('says no for a webinar that is not open', async () => {
    api.getPublicSummary.mockResolvedValue({ open: false });
    expect(await opensToEveryoneAhead([ahead(7)], NOW)).toBe(false);
  });

  it('asks only about webinars still ahead: a class, or a webinar that has begun, is never looked up', async () => {
    api.getPublicSummary.mockResolvedValue({ open: true });
    expect(await opensToEveryoneAhead([ahead(1, { event_type: 'class' }), ahead(2, { start_datetime: '2026-10-20T09:00:00Z' })], NOW)).toBe(false);
    expect(api.getPublicSummary).not.toHaveBeenCalled();
  });

  it('is yes when any one of several is open, and treats a refused lookup as not open', async () => {
    api.getPublicSummary.mockImplementation(async (id: number) => { if (id === 8) throw new Error('Forbidden'); return { open: id === 9 }; });
    expect(await opensToEveryoneAhead([ahead(7), ahead(8)], NOW)).toBe(false);
    expect(await opensToEveryoneAhead([ahead(7), ahead(8), ahead(9)], NOW)).toBe(true);
  });
});

describe('the server’s refusal for an open webinar', () => {
  const refusal = (reason_code: string) => apiError({ response: { data: { detail: 'Already took place; stays as history.', reason_code } } }, 'failed');

  it('is shown in the server’s words for the webinar_public_* codes', () => {
    for (const code of ['webinar_public_delete', 'webinar_public_retype', 'webinar_public_host']) {
      expect(publicWebinarRefusal(refusal(code))).toBe('Already took place; stays as history.');
    }
  });

  it('is null for any other failure, which keeps its generic wording', () => {
    expect(publicWebinarRefusal(refusal('slug_taken'))).toBeNull();
    expect(publicWebinarRefusal(new Error('boom'))).toBeNull();
    expect(publicWebinarRefusal(undefined)).toBeNull();
  });
});
