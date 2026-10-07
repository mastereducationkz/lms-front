import { describe, expect, it } from 'vitest';
import type { NotificationEvent, NotificationSettings } from '../services/api/notificationCenter';
import { applyToggle, cellFor, columnAvailable, isClock, matrixColumns, toggleUpdate } from './notificationMatrix';

const on = (enabled = true, switchable = true) => ({ enabled, default: enabled, switchable });

// Shapes as GET /me/notification-settings returns them (lms-backend preferences.settings_document).
const lessonStarting: NotificationEvent = {
  key: 'lesson_starting',
  label: 'Lesson starting soon',
  description: '30 minutes before each lesson.',
  channels: { in_app: on(true, false), email: on(), telegram: on(), push: on(), web_push: on(false) },
};
const curatorAssignment: NotificationEvent = {
  key: 'curator_assignment',
  label: 'Новый студент на онбординге',
  description: 'Вам назначили студента.',
  channels: { in_app: on(true, false), telegram: on(), push: on(false), web_push: on(false) },
};
const doc = (events: NotificationEvent[], available: Partial<Record<string, boolean>> = {}): NotificationSettings => ({
  language: 'en',
  channels: Object.fromEntries(['in_app', 'email', 'telegram', 'push', 'web_push'].map((c) => [c, { available: c === 'in_app' || !!available[c] }])),
  events,
  quiet_hours: { enabled: false, start: '22:00', end: '08:00', timezone: 'Asia/Almaty' },
});

describe('notification grid', () => {
  it('in-app is always on and locked', () => {
    expect(cellFor(lessonStarting, 'in_app')).toEqual({ present: true, enabled: true, locked: true });
  });

  it('one Push column covers the browser and the mobile app: on if either is on', () => {
    expect(cellFor(lessonStarting, 'push')).toEqual({ present: true, enabled: true, locked: false });
    expect(cellFor(curatorAssignment, 'push')).toEqual({ present: true, enabled: false, locked: false });
  });

  it('curators have no email column at all', () => {
    expect(matrixColumns(doc([curatorAssignment]))).toEqual(['in_app', 'telegram', 'push']);
    expect(matrixColumns(doc([lessonStarting, curatorAssignment]))).toEqual(['in_app', 'email', 'telegram', 'push']);
    expect(cellFor(curatorAssignment, 'email')).toEqual({ present: false, enabled: false, locked: true });
  });

  it('flipping Push sends both transports; flipping email only email', () => {
    expect(toggleUpdate(lessonStarting, 'push', false)).toEqual({ events: { lesson_starting: { web_push: false, push: false } } });
    expect(toggleUpdate(lessonStarting, 'email', false)).toEqual({ events: { lesson_starting: { email: false } } });
    expect(toggleUpdate(lessonStarting, 'in_app', false)).toEqual({ events: { lesson_starting: {} } });
  });

  it('applies a flip locally to that event only', () => {
    const next = applyToggle(doc([lessonStarting, curatorAssignment]), 'curator_assignment', 'push', true);
    expect(cellFor(next.events[1], 'push').enabled).toBe(true);
    expect(next.events[1].channels.web_push?.enabled).toBe(true);
    expect(next.events[0]).toBe(lessonStarting);
  });

  it('a channel is available when the person can be reached on it', () => {
    const d = doc([lessonStarting], { email: true, web_push: true });
    expect(columnAvailable(d, 'in_app')).toBe(true);
    expect(columnAvailable(d, 'email')).toBe(true);
    expect(columnAvailable(d, 'telegram')).toBe(false);
    expect(columnAvailable(d, 'push')).toBe(true);
  });

  it('quiet hours take HH:MM only', () => {
    expect(isClock('22:00')).toBe(true);
    expect(isClock('07:30')).toBe(true);
    expect(isClock('24:00')).toBe(false);
    expect(isClock('7:30')).toBe(false);
  });
});
