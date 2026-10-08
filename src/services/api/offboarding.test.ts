import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import { api } from './client';
import {
  OffboardingError,
  createOffboarding,
  getOffboardingConfig,
  listOffboardings,
  previewOffboarding,
  reassignOwned,
  retryStep,
  saveOffboardingSettings,
  setChecklistItem,
} from './offboarding';
import {
  clearContactDetails,
  getAccessReview,
  getAccessReviewHistory,
  keepAccessReviewRow,
  runAccessReview,
  unkeepAccessReviewRow,
} from './accessReview';

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;
const put = api.put as unknown as ReturnType<typeof vi.fn>;

function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } });
}

beforeEach(() => {
  [get, post, put].forEach((fn) => fn.mockReset());
});

describe('the feature switch', () => {
  it('is on only when the server says so, with its lists', async () => {
    get.mockResolvedValue({ data: { enabled: true, reasons: ['resigned'], modes: ['scheduled', 'immediate', 'emergency'], programmes: ['sat'], can_emergency: true } });
    expect(await getOffboardingConfig()).toEqual({ enabled: true, reasons: ['resigned'], modes: ['scheduled', 'immediate', 'emergency'], programmes: ['sat'], can_emergency: true });
    expect(get.mock.calls[0][0]).toBe('/admin/offboarding/config');
  });

  it('reads off, a missing endpoint, a 403 for the role or a failure all as off', async () => {
    get.mockResolvedValueOnce({ data: { enabled: false, reasons: ['resigned'] } });
    expect((await getOffboardingConfig()).enabled).toBe(false);
    get.mockRejectedValueOnce(httpError(404, { detail: 'Not Found' }));
    expect((await getOffboardingConfig()).enabled).toBe(false);
    get.mockRejectedValueOnce(httpError(403, { detail: 'Forbidden' }));
    expect((await getOffboardingConfig()).enabled).toBe(false);
  });

  it('falls back to the known reasons when the server sends none', async () => {
    get.mockResolvedValue({ data: { enabled: true } });
    const config = await getOffboardingConfig();
    expect(config.reasons).toEqual(['resigned', 'dismissed', 'contract_ended', 'test_or_duplicate', 'other']);
    expect(config.modes).toEqual(['scheduled', 'immediate', 'emergency']);
    expect(config.can_emergency).toBe(false);
  });
});

describe('preview', () => {
  it('asks by LMS id without the cache, and fills lists the server left out', async () => {
    get.mockResolvedValue({ data: { target: { name: 'Aida' }, can_offboard: true, blockers: { groups: [{ id: 1 }] }, candidates: { teachers: [{ id: 2 }] } } });
    const preview = await previewOffboarding({ lms_user_id: 123 });
    expect(get.mock.calls[0]).toEqual(['/admin/offboarding/preview', { params: { lms_user_id: 123 }, cache: false }]);
    expect(preview.blockers).toEqual({ groups: [{ id: 1 }], lessons: [], courses: [], sat_native: [], sat_checked: true, sat_warning: null });
    expect(preview.candidates).toEqual({ teachers: [{ id: 2 }], curators: [], head_teachers: [] });
    expect(preview.suggested_owners).toEqual([]);
  });
});

describe('requests and refusals', () => {
  it('hands back the blockers of a 409 offboarding_blocked', async () => {
    post.mockRejectedValue(httpError(409, {
      detail: 'Still owns groups', reason_code: 'offboarding_blocked',
      reason_details: { blockers: { groups: [{ id: 310, name: 'SAT Sep', role: 'teacher' }], sat_checked: false } },
    }));
    const error = await createOffboarding({ lms_user_id: 123, mode: 'scheduled', last_day: '2026-10-31', reason_code: 'resigned' }).catch((e) => e);
    expect(error).toBeInstanceOf(OffboardingError);
    expect(error.message).toBe('Still owns groups');
    expect(error.status).toBe(409);
    expect(error.code).toBe('offboarding_blocked');
    expect(error.blockers.groups).toHaveLength(1);
    expect(error.blockers.sat_checked).toBe(false);
  });

  it('keeps the code and details of any other refusal, wrapped envelope included', async () => {
    post.mockRejectedValue(httpError(409, {
      error: 'Conflict', message: 'x', status_code: 409,
      detail: 'Open record exists', reason_code: 'offboarding_open_record', reason_details: { record_id: 7 },
    }));
    const error = await createOffboarding({ lms_user_id: 1, mode: 'immediate', last_day: '2026-10-08', reason_code: 'other' }).catch((e) => e);
    expect(error.code).toBe('offboarding_open_record');
    expect(error.details).toEqual({ record_id: 7 });
    expect(error.blockers).toBeNull();
  });

  it('returns per-item reassign results with the recomputed blockers', async () => {
    post.mockResolvedValue({ data: { results: [{ kind: 'lesson', id: 9, ok: false, error: { code: 'offboarding_owner_role', message: 'no' } }], blockers: {} } });
    const result = await reassignOwned({ lms_user_id: 1, all_to: 55 });
    expect(post.mock.calls[0]).toEqual(['/admin/offboarding/reassign', { lms_user_id: 1, all_to: 55 }]);
    expect(result.results[0].error?.code).toBe('offboarding_owner_role');
    expect(result.blockers.groups).toEqual([]);
  });

  it('escapes checklist item ids (they carry colons, e.g. telegram:210)', async () => {
    post.mockResolvedValue({ data: {} });
    await setChecklistItem(7, 'telegram:210', true);
    expect(post.mock.calls[0]).toEqual(['/admin/offboarding/7/checklist/telegram%3A210', { done: true }]);
  });
});

describe('lists and settings', () => {
  it('sends statuses and tokens as one comma list, with the person and page filters', async () => {
    get.mockResolvedValue({ data: { items: [{ id: 1 }], total: 1 } });
    expect(await listOffboardings({ status: ['open'] })).toEqual({ items: [{ id: 1 }], total: 1 });
    expect(get.mock.calls[0][1].params).toEqual({ status: 'open' });
    await listOffboardings({ status: ['open', 'needs_reassignment'], limit: 100, offset: 100 });
    expect(get.mock.calls[1][1].params).toEqual({ status: 'open,needs_reassignment', limit: 100, offset: 100 });
    await listOffboardings({ status: ['completed'], lms_user_id: 123 });
    expect(get.mock.calls[2][1].params).toEqual({ status: 'completed', lms_user_id: 123 });
    await listOffboardings();
    expect(get.mock.calls[3][1].params).toEqual({});
  });

  it('re-runs a step by name', async () => {
    post.mockResolvedValue({ data: { id: 7 } });
    await retryStep(7, 'support');
    expect(post.mock.calls[0][0]).toBe('/admin/offboarding/7/steps/support/retry');
  });

  it('saves only the keys sent', async () => {
    put.mockResolvedValue({ data: {} });
    await saveOffboardingSettings({ notify_user_ids: [1, 4] });
    expect(put.mock.calls[0]).toEqual(['/admin/offboarding/settings', { notify_user_ids: [1, 4] }]);
  });
});

describe('access review (API.md §9)', () => {
  it('reads a missing endpoint as «not available yet», and no review yet as an empty page', async () => {
    get.mockRejectedValueOnce(httpError(404, { detail: 'Not Found', reason_code: 'offboarding_disabled' }));
    expect(await getAccessReview()).toBeNull();
    get.mockResolvedValueOnce({ data: { review: null, rows: [] } });
    expect(await getAccessReview()).toEqual({ review: null, rows: [] });
  });

  it('asks for an older review by id, without the cache', async () => {
    get.mockResolvedValue({ data: { review: { id: 2 }, rows: [{ id: 41 }] } });
    expect((await getAccessReview(2))?.rows).toHaveLength(1);
    expect(get.mock.calls[0]).toEqual(['/admin/offboarding/access-review', { params: { review_id: 2 }, cache: false }]);
  });

  it('still fails loudly on a real error', async () => {
    get.mockRejectedValue(httpError(500, { detail: 'boom' }));
    await expect(getAccessReview()).rejects.toThrow('boom');
  });

  it('runs a review, keeps, un-keeps and clears contacts with confirm: true', async () => {
    post.mockResolvedValue({ data: { review: { id: 4, status: 'building' } } });
    expect((await runAccessReview()).status).toBe('building');
    post.mockResolvedValue({ data: { id: 41 } });
    await keepAccessReviewRow(41, 'developer');
    await unkeepAccessReviewRow(41);
    await clearContactDetails(41);
    expect(post.mock.calls.slice(1)).toEqual([
      ['/admin/offboarding/access-review/41/keep', { reason: 'developer' }],
      ['/admin/offboarding/access-review/41/unkeep'],
      ['/admin/offboarding/access-review/41/clear-contacts', { confirm: true }],
    ]);
  });

  it('hands back the code of a refused run', async () => {
    post.mockRejectedValue(httpError(409, { detail: 'running', reason_code: 'access_review_running' }));
    await expect(runAccessReview()).rejects.toMatchObject({ code: 'access_review_running' });
  });

  it('lists past reviews', async () => {
    get.mockResolvedValue({ data: { items: [{ id: 3 }, { id: 2 }] } });
    expect((await getAccessReviewHistory()).map((r) => r.id)).toEqual([3, 2]);
    expect(get.mock.calls[0][0]).toBe('/admin/offboarding/access-review/history');
  });
});
