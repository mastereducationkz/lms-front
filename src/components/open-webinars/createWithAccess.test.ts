import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateEventRequest, Event } from '../../types';
import type { AccessDraft } from './accessModel';

const api = vi.hoisted(() => ({ preflightOpenAccess: vi.fn(), saveOpenAccess: vi.fn() }));
vi.mock('../../services/api/openWebinars', () => api);

import { createWithAccess } from './createWithAccess';

const eventData = { title: 'Open day', event_type: 'webinar', start_datetime: '2099-01-03T12:00:00Z', end_datetime: '2099-01-03T13:00:00Z' } as CreateEventRequest;
const preflight = { access_mode: 'registration', lead_pipeline_id: 10520038, title: 'Open day', start_datetime: eventData.start_datetime, end_datetime: eventData.end_datetime } as const;
const draft = { mode: 'registration', pipelineId: 10520038, slug: ' my-day ', presenter: 'speaker', speakerId: 3, bannerUrl: '/uploads/webinar_banners/1.png', noAudience: false } as AccessDraft & { mode: 'registration'; pipelineId: number };
const created = { id: 77, title: 'Open day' } as Event;

/** Every call in the order it happened. */
let order: string[];
let create: ReturnType<typeof vi.fn>;
beforeEach(() => {
  order = [];
  create = vi.fn(async () => { order.push('create'); return created; });
  api.preflightOpenAccess.mockReset().mockImplementation(async () => { order.push('preflight'); return { ok: true, slug: 'my-day' }; });
  api.saveOpenAccess.mockReset().mockImplementation(async () => { order.push('put'); return { event_id: 77 }; });
});
const run = () => createWithAccess({ create, eventData, draft, preflight, fallbackMessage: 'Something went wrong.' });

describe('creating a webinar that opens to everyone', () => {
  it('asks the server first, then creates the event, then saves its public access', async () => {
    const outcome = await run();
    expect(order).toEqual(['preflight', 'create', 'put']);
    expect(api.preflightOpenAccess).toHaveBeenCalledWith(preflight);
    expect(create).toHaveBeenCalledWith(eventData);
    expect(api.saveOpenAccess).toHaveBeenCalledWith(77, {
      access_mode: 'registration', slug: 'my-day', speaker_id: 3, presenter: 'speaker', lead_pipeline_id: 10520038, banner_url: '/uploads/webinar_banners/1.png',
    });
    expect(outcome).toEqual({ kind: 'created', event: created });
  });

  it('creates nothing when the preflight refuses: the refusal reaches the form', async () => {
    api.preflightOpenAccess.mockRejectedValue(new Error('This webinar has no host.'));
    await expect(run()).rejects.toThrow('This webinar has no host.');
    expect(create).not.toHaveBeenCalled();
    expect(api.saveOpenAccess).not.toHaveBeenCalled();
  });

  it('saves no access when the event itself cannot be created', async () => {
    create.mockRejectedValue(new Error('Group not found'));
    await expect(run()).rejects.toThrow('Group not found');
    expect(api.saveOpenAccess).not.toHaveBeenCalled();
  });

  it('keeps the event and hands back the reason when saving the access fails afterwards', async () => {
    api.saveOpenAccess.mockRejectedValue(new Error('This address is already used by another webinar.'));
    const outcome = await run();
    expect(create).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ kind: 'access_failed', event: created, message: 'This address is already used by another webinar.' });
  });

  it('falls back to a plain sentence when the failure carries none', async () => {
    api.saveOpenAccess.mockRejectedValue('nope');
    expect(await run()).toMatchObject({ kind: 'access_failed', message: 'Something went wrong.' });
  });

  it('sends no address when none was typed, so the server makes one from the title', async () => {
    await createWithAccess({ create, eventData, draft: { ...draft, slug: '  ' }, preflight, fallbackMessage: 'x' });
    expect(api.saveOpenAccess.mock.calls[0][1].slug).toBeNull();
  });

  it.each(['host', 'none'] as const)('names %s as the presenter and sends no guest speaker, even if one was picked before', async (presenter) => {
    await createWithAccess({ create, eventData, draft: { ...draft, presenter }, preflight, fallbackMessage: 'x' });
    expect(api.saveOpenAccess.mock.calls[0][1]).toMatchObject({ presenter, speaker_id: null });
  });

  it('sends no presenter while it is untouched (the server reads a chosen speaker as the speaker, else the host)', async () => {
    await createWithAccess({ create, eventData, draft: { ...draft, presenter: null }, preflight, fallbackMessage: 'x' });
    expect(api.saveOpenAccess.mock.calls[0][1]).not.toHaveProperty('presenter');
    expect(api.saveOpenAccess.mock.calls[0][1].speaker_id).toBe(3);
  });
});
