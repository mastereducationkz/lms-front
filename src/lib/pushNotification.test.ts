import { describe, expect, it } from 'vitest';
import { DEFAULT_BADGE, DEFAULT_ICON, DEFAULT_TITLE, buildNotification, parsePushData, pickClientIndex, safeTargetUrl } from './pushNotification';

const ORIGIN = 'https://lms.mastereducation.kz';
const data = (value: unknown) => ({
  json: () => (typeof value === 'string' ? JSON.parse(value) : value),
  text: () => (typeof value === 'string' ? value : JSON.stringify(value)),
});

describe('parsePushData', () => {
  it('reads the JSON payload', () => {
    expect(parsePushData(data({ title: 'Lesson in 15 min', url: '/calendar' }))).toEqual({ title: 'Lesson in 15 min', url: '/calendar' });
  });
  it('falls back to the text as the body, and to nothing at all', () => {
    expect(parsePushData(data('plain words'))).toEqual({ body: 'plain words' });
    expect(parsePushData(null)).toEqual({});
  });
});

describe('buildNotification', () => {
  it('the notification center’s own payload shape', () => {
    const { title, options } = buildNotification(
      { title: 'Homework graded', body: 'Reading warm-up: 9/10', url: `${ORIGIN}/homework/12`, tag: 'homework_graded:881', event: 'homework_graded' } as never,
      ORIGIN,
    );
    expect(title).toBe('Homework graded');
    expect(options).toMatchObject({ body: 'Reading warm-up: 9/10', tag: 'homework_graded:881', data: { url: `${ORIGIN}/homework/12` } });
  });

  it('a lesson reminder: title, body, tag, our icon and badge, the tap target', () => {
    const { title, options } = buildNotification(
      { title: 'SAT Oct-26 starts in 15 minutes', body: 'Join from your calendar', url: '/calendar?event=12', tag: 'lesson-12' },
      ORIGIN,
    );
    expect(title).toBe('SAT Oct-26 starts in 15 minutes');
    expect(options).toMatchObject({
      body: 'Join from your calendar',
      tag: 'lesson-12',
      icon: DEFAULT_ICON,
      badge: DEFAULT_BADGE,
      requireInteraction: false,
      data: { url: `${ORIGIN}/calendar?event=12` },
    });
  });

  it('an empty push still shows something sensible', () => {
    const { title, options } = buildNotification({}, ORIGIN);
    expect(title).toBe(DEFAULT_TITLE);
    expect(options.body).toBe('');
    expect(options.data.url).toBe(`${ORIGIN}/dashboard`);
    expect('tag' in options).toBe(false);
  });

  it('never points a tap or an image at another site', () => {
    const { options } = buildNotification({ url: 'https://evil.example/phish', icon: 'https://evil.example/x.png', badge: '//evil.example/b.png' }, ORIGIN);
    expect(options.data.url).toBe(`${ORIGIN}/dashboard`);
    expect(options.icon).toBe(DEFAULT_ICON);
    expect(options.badge).toBe(DEFAULT_BADGE);
  });

  it('keeps extra data but the url is always ours', () => {
    const { options } = buildNotification({ url: '/homework/5', data: { kind: 'homework', url: 'https://evil.example' } }, ORIGIN);
    expect(options.data).toEqual({ kind: 'homework', url: `${ORIGIN}/homework/5` });
  });

  it('caps runaway text', () => {
    const { title, options } = buildNotification({ title: 'x'.repeat(500), body: 'y'.repeat(2000) }, ORIGIN);
    expect(title).toHaveLength(120);
    expect(options.body).toHaveLength(400);
  });
});

describe('safeTargetUrl', () => {
  it('resolves relative paths and rejects other origins and junk', () => {
    expect(safeTargetUrl('/live', ORIGIN)).toBe(`${ORIGIN}/live`);
    expect(safeTargetUrl(`${ORIGIN}/homework`, ORIGIN)).toBe(`${ORIGIN}/homework`);
    expect(safeTargetUrl('javascript:alert(1)', ORIGIN)).toBe(`${ORIGIN}/dashboard`);
    // The notification center passes CRM links through for staff.
    expect(safeTargetUrl('https://crm.mastereducation.kz/students/5', ORIGIN)).toBe('https://crm.mastereducation.kz/students/5');
    expect(safeTargetUrl('http://crm.mastereducation.kz/students/5', ORIGIN)).toBe(`${ORIGIN}/dashboard`);
    expect(safeTargetUrl('https://mastereducation.kz.evil.example/', ORIGIN)).toBe(`${ORIGIN}/dashboard`);
    expect(safeTargetUrl(42, ORIGIN)).toBe(`${ORIGIN}/dashboard`);
  });
});

describe('pickClientIndex', () => {
  const target = `${ORIGIN}/calendar`;
  it('reuses a window already on the page, then the focused one, then any', () => {
    expect(pickClientIndex([], target)).toBe(-1);
    expect(pickClientIndex([{ url: `${ORIGIN}/dashboard` }, { url: target }], target)).toBe(1);
    expect(pickClientIndex([{ url: `${ORIGIN}/a` }, { url: `${ORIGIN}/b`, focused: true }], target)).toBe(1);
    expect(pickClientIndex([{ url: `${ORIGIN}/a`, visibilityState: 'hidden' }, { url: `${ORIGIN}/b`, visibilityState: 'visible' }], target)).toBe(1);
    expect(pickClientIndex([{ url: `${ORIGIN}/a` }, { url: `${ORIGIN}/b` }], target)).toBe(0);
  });
});
