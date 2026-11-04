import { describe, expect, it } from 'vitest';
import { duplicateDraftOf, duplicateHref, duplicateIdOf, endAfterStart, shiftLocal } from './duplicate';
import type { OpenAccess } from '../../services/api/openWebinars';
import type { Event } from '../../types';

const SOURCE = {
  id: 77, title: 'SAT Math open day', description: 'Bring a calculator.', event_type: 'webinar',
  start_datetime: '2026-11-01T09:00:00', end_datetime: '2026-11-01T10:30:00', location: 'Room 4', is_online: true,
  meeting_url: 'https://meet.google.com/abc-defg-hij', created_by: 1, is_active: true, is_recurring: false, participant_count: 0,
  course_ids: [3, 4], group_ids: [9], teacher_id: 5, max_participants: 300,
} as Event;

const ACCESS = {
  event_id: 77, open: true, access_mode: 'registration', slug: 'sat-math-open-day', speaker_id: 12, presenter: 'speaker',
  lead_pipeline_id: 10520038, banner_url: '/uploads/webinar_banners/a.png', title_en: 'SAT Math', description_en: 'Bring one.',
  ask_profile: true,
} as OpenAccess;

describe('duplicateDraftOf: what a copy of an open webinar starts from', () => {
  const draft = duplicateDraftOf(SOURCE, ACCESS);

  it('copies the webinar type, host, courses, groups, description, online flag and capacity', () => {
    expect(draft.seed).toEqual({
      event_type: 'webinar', is_online: true, description: 'Bring a calculator.', teacher_id: 5,
      course_ids: [3, 4], group_ids: [9], max_participants: 300,
    });
    expect(draft.sourceTitle).toBe('SAT Math open day');
  });

  it('leaves the title, the times, the location and the pasted meeting link empty', () => {
    const seed = draft.seed as Partial<Event>;
    expect(seed.title).toBeUndefined();
    expect(seed.start_datetime).toBeUndefined();
    expect(seed.end_datetime).toBeUndefined();
    expect(seed.meeting_url).toBeUndefined();
    expect(seed.location).toBeUndefined();
    expect(seed.is_recurring).toBeUndefined();
  });

  it('keeps the length: 90 minutes', () => {
    expect(draft.durationMinutes).toBe(90);
  });

  it('copies who can join, the pipeline, the extra questions and the presenter mode', () => {
    expect(draft.access).toMatchObject({ mode: 'registration', pipelineId: 10520038, askProfile: true, presenter: 'speaker', noAudience: false });
  });

  it('leaves the address, banner, guest speaker and English texts empty', () => {
    expect(draft.access).toMatchObject({ slug: '', bannerUrl: null, speakerId: null, titleEn: '', descriptionEn: '' });
  });

  it('a webinar with no course and no group was only a public page, and so is the copy', () => {
    expect(duplicateDraftOf({ ...SOURCE, course_ids: [], group_ids: undefined }, ACCESS).access.noAudience).toBe(true);
  });

  it('is a webinar even if the source says otherwise, and has no length when its times are unusable', () => {
    const odd = duplicateDraftOf({ ...SOURCE, event_type: 'class', end_datetime: SOURCE.start_datetime }, { ...ACCESS, access_mode: 'open', ask_profile: undefined });
    expect(odd.seed.event_type).toBe('webinar');
    expect(odd.durationMinutes).toBeNull();
    expect(odd.access).toMatchObject({ mode: 'open', askProfile: false });
  });
});

describe('duplicateHref: who gets «Duplicate» and where it goes', () => {
  it.each([['admin', '/admin/events/create?duplicate=77'], ['head_teacher', '/admin/events/create?duplicate=77'], ['head_curator', '/curator/events/create?duplicate=77']])(
    '%s → %s', (role, href) => { expect(duplicateHref(role, 77)).toBe(href); },
  );
  it.each(['teacher', 'curator', 'student', undefined])('%s gets nothing', (role) => {
    expect(duplicateHref(role, 77)).toBeNull();
  });
  it('reads the source id back from the URL', () => {
    expect(duplicateIdOf(new URLSearchParams('duplicate=77'))).toBe(77);
    expect(duplicateIdOf(new URLSearchParams('duplicate=abc'))).toBeNull();
    expect(duplicateIdOf(new URLSearchParams(''))).toBeNull();
  });
});

describe('the end follows the chosen start', () => {
  it('moves a datetime-local across midnight', () => {
    expect(shiftLocal('2026-12-31T23:30', 90)).toBe('2027-01-01T01:00');
  });
  it('fills an empty end, and moves the end it filled itself', () => {
    expect(endAfterStart({ start: '', end: '' }, '2026-11-10T14:00', 90)).toBe('2026-11-10T15:30');
    expect(endAfterStart({ start: '2026-11-10T14:00', end: '2026-11-10T15:30' }, '2026-11-11T16:00', 90)).toBe('2026-11-11T17:30');
  });
  it('keeps an end the user typed, and does nothing without a length', () => {
    expect(endAfterStart({ start: '2026-11-10T14:00', end: '2026-11-10T16:00' }, '2026-11-11T16:00', 90)).toBe('2026-11-10T16:00');
    expect(endAfterStart({ start: '', end: '' }, '2026-11-10T14:00', null)).toBe('');
  });
});
