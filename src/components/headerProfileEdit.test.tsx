// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The owner's "why does the header refresh when I change the language?": a profile edit hands out
// a new user object (the language save does it twice). The streak square and the bell must keep
// still through that, and look again only when someone else signs in.
let currentUser: Record<string, unknown> | null = null;
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(undefined), useAuth: () => ({ user: currentUser }) };
});
vi.mock('../services/api', () => ({ getDailyStreak: vi.fn() }));
vi.mock('../services/api/notifications', () => ({
  BELL_NOTIFICATION_TYPES: ['class_materials'],
  getUnreadNotificationCount: vi.fn(async () => 2),
  getNotifications: vi.fn(async () => []),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));
vi.mock('../services/api/achievementsUi', () => ({ getMyAchievements: vi.fn(async () => ({ achievements: [] })) }));

import { getDailyStreak } from '../services/api';
import { getUnreadNotificationCount } from '../services/api/notifications';
import StreakIcon from './StreakIcon';
import NotificationsBell from './NotificationsBell';

const streak = (studentId: number) => ({
  student_id: studentId, student_name: 'A', daily_streak: 4, longest_streak: 9, last_activity_date: '2026-10-06',
  streak_status: 'at_risk', is_active_today: false, total_study_time_minutes: 0,
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  vi.mocked(getDailyStreak).mockImplementation(async () => streak(Number(currentUser?.id)) as never);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

const render = async () => {
  await act(async () => root.render(<MemoryRouter><StreakIcon /><NotificationsBell /></MemoryRouter>));
};
const square = () => host.querySelector('[data-tour="streak-display"]');

describe('the header through a profile edit', () => {
  it('keeps the streak square and the bell still when the same person edits their profile', async () => {
    currentUser = { id: '1', role: 'student', name: 'Aruzhan', ui_language: 'en' };
    await render();
    const before = square();
    expect(before).not.toBeNull();
    expect(getDailyStreak).toHaveBeenCalledTimes(1);
    expect(getUnreadNotificationCount).toHaveBeenCalledTimes(1);

    // The language save: an optimistic copy, then the server's.
    currentUser = { ...currentUser, ui_language: 'ru' };
    await render();
    currentUser = { ...currentUser, name: 'Aruzhan B.' };
    await render();

    expect(getDailyStreak).toHaveBeenCalledTimes(1);
    expect(getUnreadNotificationCount).toHaveBeenCalledTimes(1);
    expect(square()).toBe(before); // never unmounted
  });

  it('looks again when someone else signs in', async () => {
    currentUser = { id: '1', role: 'student', name: 'Aruzhan' };
    await render();
    currentUser = { id: '3', role: 'student', name: 'Madina' };
    await render();
    expect(getDailyStreak).toHaveBeenCalledTimes(2);
    expect(getUnreadNotificationCount).toHaveBeenCalledTimes(2);
    expect(square()).not.toBeNull();
  });
});
