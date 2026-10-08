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
import { getAccessReview, rowActions } from './accessReview';

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

describe('access review (phase 2)', () => {
  it('reads a missing endpoint as «not available yet»', async () => {
    get.mockRejectedValue(httpError(404, { detail: 'Not Found' }));
    expect(await getAccessReview()).toBeNull();
  });

  it('takes rows in an object or a bare list', async () => {
    get.mockResolvedValueOnce({ data: { built_at: '2026-11-01T01:00:00Z', rows: [{ id: 1, system: 'lms', account: 'a@x' }] } });
    expect((await getAccessReview())?.rows).toHaveLength(1);
    get.mockResolvedValueOnce({ data: [{ id: 2, system: 'crm', account: 'b@x' }] });
    expect(await getAccessReview()).toEqual({ rows: [{ id: 2, system: 'crm', account: 'b@x' }] });
  });

  it('still fails loudly on a real error', async () => {
    get.mockRejectedValue(httpError(500, { detail: 'boom' }));
    await expect(getAccessReview()).rejects.toThrow('boom');
  });

  it('offers keep/offboard by default, clear-contacts for retention rows, or what the server lists', () => {
    expect(rowActions({ id: 1, system: 'lms', account: 'a', lms_user_id: 5 })).toEqual(['keep', 'offboard']);
    expect(rowActions({ id: 1, system: 'workspace', account: 'a' })).toEqual(['keep']);
    expect(rowActions({ id: 1, system: 'lms', account: 'a', kind: 'contact_retention' })).toEqual(['clear_contacts']);
    expect(rowActions({ id: 1, system: 'lms', account: 'a', actions: ['keep'] })).toEqual(['keep']);
  });
});
