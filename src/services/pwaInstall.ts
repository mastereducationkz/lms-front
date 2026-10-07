/**
 * Installing the LMS as an app (owner, 2026-10-07: «very very important» that students learn
 * they can). This module is the browser glue; the decisions are pure and tested:
 *  - src/lib/pwaPlatform.ts: which install path this browser has;
 *  - src/lib/installNudge.ts: when the dashboard may ask.
 *
 * `startPwaInstall()` runs from main.tsx before React, so Chrome's one-off `beforeinstallprompt`
 * is caught and kept for the moment someone taps «Install». React reads the state through
 * `usePwaInstall()` (useSyncExternalStore). Per-user state lives in localStorage, every access
 * wrapped: a private window or blocked storage just means the card behaves as on a first day.
 */
import { useSyncExternalStore } from 'react';
import { detectPlatform, displayModeFrom, type DisplayMode, type PlatformInfo } from '../lib/pwaPlatform';
import {
  installNudgeDue,
  parseNudgeState,
  pushNudgeDue,
  recordDismiss,
  recordInstalled,
  recordPushDismiss,
  recordSubmission,
  recordVisit,
  EMPTY_NUDGE,
  type NudgeState,
} from '../lib/installNudge';
import { APP_TIMEZONE } from '../lib/datetime';
import { langForRole, type Lang } from '../lib/achievementsAnalytics';
import { addSentryBreadcrumb, setSentryTag } from '../lib/sentry';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export interface PwaUser {
  id: number | string;
  role?: string | null;
  /** `onboarding_completed_at` from /auth/me: proof of an earlier visit (installNudge.ts). */
  onboardingCompletedAt?: string | null;
}

export interface PwaInstallSnapshot {
  platform: PlatformInfo;
  displayMode: DisplayMode;
  /** A deferred `beforeinstallprompt` is waiting: one tap opens the browser's own dialog. */
  canPrompt: boolean;
  /** `appinstalled` fired in this tab. */
  installedHere: boolean;
  user: PwaUser | null;
  nudge: NudgeState;
}

/** Where a prompt was shown or acted on, for the breadcrumbs. */
export type InstallSurface = 'dashboard' | 'settings' | 'sheet';

const STORAGE_PREFIX = 'lms_pwa_install_v1_';

let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();

let snapshot: PwaInstallSnapshot = {
  platform: { platform: 'unsupported', shareInMoreMenu: false, iosBrowser: null, inAppName: null },
  displayMode: 'browser',
  canPrompt: false,
  installedHere: false,
  user: null,
  nudge: { ...EMPTY_NUDGE },
};

function update(patch: Partial<PwaInstallSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

/** "2026-10-07" in Kazakhstan time, the app's calendar. */
export function dayString(at: number | string | Date): string {
  return new Date(at).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

function storageKey(user: PwaUser): string {
  return `${STORAGE_PREFIX}${user.id}`;
}

function load(user: PwaUser): NudgeState {
  try {
    return parseNudgeState(localStorage.getItem(storageKey(user)));
  } catch {
    return { ...EMPTY_NUDGE };
  }
}

function save(nudge: NudgeState): void {
  const user = snapshot.user;
  if (!user) return;
  try {
    localStorage.setItem(storageKey(user), JSON.stringify(nudge));
  } catch {
    // Storage full or blocked: the state lives for this page load only.
  }
  update({ nudge });
}

/** A breadcrumb on the next error report: event names and platform only, no PII. */
export function trackPwa(event: string, data: Record<string, string | number | boolean> = {}): void {
  addSentryBreadcrumb('pwa', event, { platform: snapshot.platform.platform, display_mode: snapshot.displayMode, ...data });
}

function currentDisplayMode(): DisplayMode {
  const nav = navigator as Navigator & { standalone?: boolean };
  return displayModeFrom((q) => !!window.matchMedia?.(q).matches, nav.standalone);
}

/** Called once from main.tsx, before the app renders. */
export function startPwaInstall(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const displayMode = currentDisplayMode();
  update({
    displayMode,
    platform: detectPlatform({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      telegramWebview: 'TelegramWebviewProxy' in window,
    }),
  });
  setSentryTag('display_mode', displayMode);

  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep Chrome's mini-infobar away: the dashboard card asks at a better moment.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    update({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    update({ canPrompt: false, installedHere: true });
    if (snapshot.user) save(recordInstalled(snapshot.nudge, Date.now()));
    trackPwa('appinstalled');
  });
  // A Chromium tab that just installed can hand itself over to the app window.
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => {
    const mode = currentDisplayMode();
    update({ displayMode: mode });
    setSentryTag('display_mode', mode);
  });
}

/** Who is signed in (AuthContext). Loads their state and counts today as a day of use. */
export function setPwaUser(user: PwaUser | null): void {
  if (!user) {
    update({ user: null, nudge: { ...EMPTY_NUDGE } });
    return;
  }
  const same = snapshot.user && String(snapshot.user.id) === String(user.id);
  const nudge = same ? snapshot.nudge : load(user);
  update({ user });
  const visited = recordVisit(nudge, dayString(Date.now()));
  if (snapshot.displayMode === 'standalone') save(recordInstalled(visited, Date.now()));
  else if (visited !== nudge || !same) save(visited);
}

/** The interface language for PWA copy: Russian for curators, English for everyone else. */
export function pwaLang(): Lang {
  return langForRole(snapshot.user?.role);
}

/** Called after a homework submission succeeds: the second trigger for the install card. */
export function notePwaHomeworkSubmitted(): void {
  if (!snapshot.user || snapshot.nudge.submittedAt) return;
  save(recordSubmission(snapshot.nudge, Date.now()));
}

/** Opens the browser's own install dialog, when it offered one. */
export async function promptInstall(surface: InstallSurface): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  trackPwa('install_prompt_opened', { surface });
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    // A prompt can be shown once; Chrome fires a fresh event later if it may ask again.
    deferred = null;
    update({ canPrompt: false });
    trackPwa(outcome === 'accepted' ? 'install_prompt_accepted' : 'install_prompt_dismissed', { surface, native: true });
    // Cancelling the browser's own dialog counts as «Not now».
    if (snapshot.user) save(outcome === 'accepted' ? recordInstalled(snapshot.nudge, Date.now()) : recordDismiss(snapshot.nudge, Date.now()));
    return outcome;
  } catch {
    deferred = null;
    update({ canPrompt: false });
    return 'unavailable';
  }
}

/** «Not now» on the dashboard card: 14 days' quiet; the third time, for good. */
export function dismissInstallNudge(surface: InstallSurface): void {
  trackPwa('install_prompt_dismissed', { surface, native: false });
  if (snapshot.user) save(recordDismiss(snapshot.nudge, Date.now()));
}

/** iPhones never say when the app was added; the sheet's «It's on my Home Screen» does. */
export function markInstalledByHand(): void {
  trackPwa('install_marked_done');
  if (snapshot.user) save(recordInstalled(snapshot.nudge, Date.now()));
}

export function dismissPushNudge(): void {
  trackPwa('push_prompt_dismissed');
  if (snapshot.user) save(recordPushDismiss(snapshot.nudge, Date.now()));
}

/** Installed already, or running inside the installed app. */
export function isInstalled(s: PwaInstallSnapshot): boolean {
  return s.displayMode === 'standalone' || s.installedHere || !!s.nudge.installedAt;
}

/**
 * Whether this browser offers an install path at all. Android and desktop Chrome only get the
 * card with a prompt in hand: no prompt there usually means it's installed already.
 */
export function installAvailable(s: PwaInstallSnapshot): boolean {
  if (s.displayMode === 'standalone' || s.installedHere) return false;
  switch (s.platform.platform) {
    case 'ios-safari':
    case 'ios-in-app':
    case 'android-in-app':
      return true;
    case 'android':
    case 'desktop':
      return s.canPrompt;
    default:
      return false;
  }
}

/** The dashboard install card: an install path, not installed, and the pacing rules say yes. */
export function installNudgeVisible(s: PwaInstallSnapshot, now = Date.now()): boolean {
  if (!s.user || isInstalled(s) || !installAvailable(s)) return false;
  return installNudgeDue(s.nudge, {
    now,
    today: dayString(now),
    tourDoneDay: s.user.onboardingCompletedAt ? dayString(s.user.onboardingCompletedAt) : null,
  });
}

/** The «turn on lesson reminders» card: only inside the installed app. */
export function pushNudgeVisible(s: PwaInstallSnapshot, now = Date.now()): boolean {
  return !!s.user && s.displayMode === 'standalone' && pushNudgeDue(s.nudge, now);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallSnapshot(): PwaInstallSnapshot {
  return snapshot;
}

export function usePwaInstall(): PwaInstallSnapshot {
  return useSyncExternalStore(subscribe, getPwaInstallSnapshot, getPwaInstallSnapshot);
}
