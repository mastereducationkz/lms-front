import { describe, expect, it } from 'vitest';
import { isMeetLink, matchesMeetFilter, meetInvitationText, meetJoinUrl, seesMeetMarks } from './meetLinks';

const MEET = 'https://meet.google.com/nee-tsrk-vap';

describe('meetJoinUrl', () => {
  it('points the link at the work account', () => {
    const url = new URL(meetJoinUrl(MEET, 'gulzada@mastereducation.kz'));
    expect(url.hostname).toBe('meet.google.com');
    expect(url.pathname).toBe('/nee-tsrk-vap');
    expect(url.searchParams.get('authuser')).toBe('gulzada@mastereducation.kz');
  });

  it('leaves the link untouched for someone without a work account', () => {
    // Students: no Workspace account, nothing to select.
    expect(meetJoinUrl(MEET, null)).toBe(MEET);
    expect(meetJoinUrl(MEET, undefined)).toBe(MEET);
    expect(meetJoinUrl(MEET, '   ')).toBe(MEET);
  });

  it('never rewrites links that are not Google Meet', () => {
    // Weekly tests link to the exam platforms; other events may use Zoom.
    const platform = 'https://sat.mastereducation.kz/sets/12';
    expect(meetJoinUrl(platform, 'gulzada@mastereducation.kz')).toBe(platform);
    const lookalike = 'https://meet.google.com.evil.example/abc';
    expect(meetJoinUrl(lookalike, 'gulzada@mastereducation.kz')).toBe(lookalike);
  });

  it('replaces an existing authuser instead of adding a second one', () => {
    // A link pasted from someone's browser may already carry their account index.
    const url = new URL(meetJoinUrl(`${MEET}?authuser=0`, 'gulzada@mastereducation.kz'));
    expect(url.searchParams.getAll('authuser')).toEqual(['gulzada@mastereducation.kz']);
  });

  it('keeps any other query parameters', () => {
    const url = new URL(meetJoinUrl(`${MEET}?hs=122`, 'gulzada@mastereducation.kz'));
    expect(url.searchParams.get('hs')).toBe('122');
  });

  it('normalises the address', () => {
    const url = new URL(meetJoinUrl(MEET, '  Gulzada@MasterEducation.kz '));
    expect(url.searchParams.get('authuser')).toBe('gulzada@mastereducation.kz');
  });

  it('survives junk input without throwing', () => {
    expect(meetJoinUrl('', 'gulzada@mastereducation.kz')).toBe('');
    expect(meetJoinUrl(null, 'gulzada@mastereducation.kz')).toBe('');
    expect(meetJoinUrl('not a url', 'gulzada@mastereducation.kz')).toBe('not a url');
  });
});

describe('meetInvitationText', () => {
  const lesson = {
    title: 'July 8 SAT - Gulzada: Lesson 29',
    groups: ['July 8 SAT - Gulzada'],
    start_datetime: '2026-09-10T14:00:00Z',
    end_datetime: '2026-09-10T15:00:00Z',
    meeting_url: MEET,
  };

  it('reads as a Russian invitation a group chat can use as is', () => {
    expect(meetInvitationText(lesson)).toBe(
      [
        'Приглашение на урок',
        'July 8 SAT, урок 29',
        'Четверг, 10 сентября, 19:00–20:00 (время Алматы)',
        `Google Meet: ${MEET}`,
        'Подключайтесь за пару минут до начала.',
      ].join('\n'),
    );
  });

  it('uses the lesson\'s clean link, never an account-bound one', () => {
    expect(meetInvitationText(lesson)).not.toContain('authuser');
  });

  it('copes with a lesson that has no number', () => {
    const text = meetInvitationText({ ...lesson, title: 'Mock exam', groups: [] });
    expect(text.split('\n')[1]).toBe('Mock exam');
  });
});

describe('isMeetLink', () => {
  it('recognises a Google Meet room and nothing else', () => {
    expect(isMeetLink(MEET)).toBe(true);
    expect(isMeetLink(`${MEET}?authuser=gulzada@mastereducation.kz`)).toBe(true);
    expect(isMeetLink('https://zoom.us/j/123')).toBe(false);
    expect(isMeetLink('not a url')).toBe(false);
    expect(isMeetLink('')).toBe(false);
    expect(isMeetLink(null)).toBe(false);
    expect(isMeetLink(undefined)).toBe(false);
  });
});

describe('matchesMeetFilter', () => {
  const withMeet = { event_type: 'class', meeting_url: MEET };
  const zoom = { event_type: 'class', meeting_url: 'https://zoom.us/j/123' };
  const none = { event_type: 'class', meeting_url: null };
  const webinar = { event_type: 'webinar', meeting_url: MEET };

  it('lets everything through when off', () => {
    for (const e of [withMeet, zoom, none, webinar]) expect(matchesMeetFilter(e, 'all')).toBe(true);
  });

  it('"with" keeps class lessons that have a Meet room', () => {
    expect(matchesMeetFilter(withMeet, 'with')).toBe(true);
    expect(matchesMeetFilter(zoom, 'with')).toBe(false);
    expect(matchesMeetFilter(none, 'with')).toBe(false);
  });

  it('"without" keeps class lessons with no Meet room, a non-Meet link included', () => {
    expect(matchesMeetFilter(none, 'without')).toBe(true);
    expect(matchesMeetFilter(zoom, 'without')).toBe(true);
    expect(matchesMeetFilter(withMeet, 'without')).toBe(false);
  });

  it('never matches events that are not class lessons', () => {
    expect(matchesMeetFilter(webinar, 'with')).toBe(false);
    expect(matchesMeetFilter({ event_type: 'weekly_test', meeting_url: null }, 'without')).toBe(false);
  });
});

describe('seesMeetMarks', () => {
  it('is staff only', () => {
    for (const role of ['admin', 'head_curator', 'head_teacher', 'curator', 'teacher']) expect(seesMeetMarks(role)).toBe(true);
    for (const role of ['student', '', null, undefined]) expect(seesMeetMarks(role)).toBe(false);
  });
});
