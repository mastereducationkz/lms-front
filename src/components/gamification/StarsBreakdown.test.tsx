// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarsBreakdown as Breakdown } from '../../services/api/gamification';

// Mounted in jsdom (not rendered to a string like the repo's other component tests) because the
// pill's job is interactive: open on activation, close on Escape, hand focus back.
vi.mock('../../services/api', () => ({
  getGamificationStatus: vi.fn(),
}));
vi.mock('../../services/api/gamification', () => ({
  getStarsBreakdown: vi.fn(),
}));

import { getGamificationStatus } from '../../services/api';
import { getStarsBreakdown } from '../../services/api/gamification';
import PointsDisplay from './PointsDisplay';
import StarsBreakdown from './StarsBreakdown';

const RULES: Breakdown['rules'] = [
  { key: 'homework', label: 'Hand in homework', min: 10, max: 10, note: 'Once per homework, when you first hand it in.' },
  { key: 'grades', label: 'Get your homework graded', min: 10, max: 50, note: '10 for the grade plus up to 40 more by your score.' },
  { key: 'course_quiz', label: 'Pass a course quiz', min: 8, max: 24, note: 'Once per quiz. A higher score earns more.' },
  { key: 'daily_questions', label: 'Finish the daily questions', min: 10, max: 26, note: 'Once a day. More correct answers earn more.' },
  { key: 'teacher_bonus', label: 'Teacher bonus', min: 1, max: 50, note: 'For great work.' },
];
const STREAK = { starts_at_days: 5, start_multiplier: 1.1, step: 0.1, step_days: 2 };

const BREAKDOWN: Breakdown = {
  total: 68,
  sources: [
    { key: 'homework', label: 'Homework handed in', stars: 20 },
    { key: 'grades', label: 'Homework grades', stars: 18 },
    { key: 'course_quiz', label: 'Course quizzes', stars: 10 },
    { key: 'daily_questions', label: 'Daily questions', stars: 5 },
    { key: 'teacher_bonus', label: 'Teacher bonus', stars: 15 },
  ],
  earlier: null,
  rules: RULES,
  streak: { days: 12, multiplier: 1.4, next_multiplier: 1.5, next_at_days: 13, ...STREAK },
};

const EMPTY: Breakdown = {
  ...BREAKDOWN,
  total: 0,
  sources: BREAKDOWN.sources.map((s) => ({ ...s, stars: 0 })),
  streak: { days: 0, multiplier: 1, next_multiplier: 1.1, next_at_days: 5, ...STREAK },
};

let container: HTMLDivElement;
let root: Root;

function setNarrow(narrow: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: narrow,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // Radix's popper measures its anchor; jsdom has no ResizeObserver.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  setNarrow(false);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function pressKey(key: string) {
  const target = document.activeElement ?? document.body;
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

describe('StarsBreakdown', () => {
  it('shows the total, one bar per source in order, the streak and the rules, all as stars', () => {
    act(() => root.render(<StarsBreakdown state={{ status: 'ready', data: BREAKDOWN }} onRetry={() => {}} titleId="t" />));
    const text = container.textContent ?? '';

    expect(container.querySelector('#t')?.textContent).toBe('68stars');
    const rows = [...container.querySelectorAll('li')].slice(0, 5).map((li) => li.textContent);
    expect(rows).toEqual(['Homework handed in20', 'Homework grades18', 'Course quizzes10', 'Daily questions5', 'Teacher bonus15']);
    const widths = [...container.querySelectorAll<HTMLElement>('.stars-fill')].map((el) => el.style.width);
    expect(widths[0]).toContain('100%'); // the largest source spans the track
    expect(text).toContain('Streak bonus ×1.4');
    expect(text).toContain('Keep it going 1 more day to reach ×1.5.');
    expect(text).toContain('How to earn stars');
    expect(text).toContain('+10–50');
    expect(text).not.toMatch(/points?/i);
  });

  it('adds a row for stars the ledger does not explain', () => {
    const data = { ...BREAKDOWN, total: 75, earlier: 7 };
    act(() => root.render(<StarsBreakdown state={{ status: 'ready', data }} onRetry={() => {}} titleId="t" />));
    expect(container.textContent).toContain('Earlier stars7');
  });

  it('greets a new student with how to earn their first stars instead of empty bars', () => {
    act(() => root.render(<StarsBreakdown state={{ status: 'ready', data: EMPTY }} onRetry={() => {}} titleId="t" />));
    const text = container.textContent ?? '';
    expect(container.querySelector('#t')?.textContent).toBe('Earn your first stars');
    expect(text).not.toContain('Where your stars came from');
    expect(container.querySelectorAll('.stars-fill')).toHaveLength(0);
    for (const rule of RULES) expect(text).toContain(rule.label);
    expect(text).toContain('Learn 5 days in a row and every star you earn gets ×1.1.');
  });

  it('offers a retry when the breakdown cannot be loaded', () => {
    const onRetry = vi.fn();
    act(() => root.render(<StarsBreakdown state={{ status: 'error' }} onRetry={onRetry} titleId="t" />));
    expect(container.textContent).toContain("Couldn't load your stars");
    act(() => container.querySelector('button')!.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('PointsDisplay', () => {
  beforeEach(() => {
    vi.mocked(getGamificationStatus).mockResolvedValue({
      activity_points: 68, daily_streak: 12, monthly_points: 30, rank_this_month: null,
    });
    vi.mocked(getStarsBreakdown).mockResolvedValue(BREAKDOWN);
  });

  async function mountPill() {
    act(() => root.render(<PointsDisplay />));
    await flush();
    const pill = container.querySelector<HTMLButtonElement>('button.points-item');
    expect(pill).not.toBeNull();
    return pill!;
  }

  it('is a native button that announces its popup', async () => {
    const pill = await mountPill();
    expect(pill.type).toBe('button');
    expect(pill.getAttribute('aria-haspopup')).toBe('dialog');
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(pill.getAttribute('aria-label')).toBe('68 stars. Show where they came from');
    expect(pill.textContent).toBe('68');
  });

  it('opens the breakdown from the keyboard and closes on Escape, returning focus', async () => {
    const pill = await mountPill();
    pill.focus();
    // Enter/Space on a focused native button fire its click; jsdom does not synthesise that part.
    act(() => pill.click());
    await flush();

    expect(pill.getAttribute('aria-expanded')).toBe('true');
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Where your stars came from');
    expect(getStarsBreakdown).toHaveBeenCalledOnce();

    pressKey('Escape');
    await flush();
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(pill);
  });

  it('opens as a bottom sheet on a narrow screen', async () => {
    setNarrow(true);
    const pill = await mountPill();
    pill.focus();
    act(() => pill.click());
    await flush();

    const sheet = document.querySelector('.stars-sheet');
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.textContent).toContain('How to earn stars');

    pressKey('Escape');
    await flush();
    expect(document.querySelector('.stars-sheet')).toBeNull();
    expect(document.activeElement).toBe(pill);
  });
});
