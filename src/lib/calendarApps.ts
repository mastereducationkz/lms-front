/**
 * One-tap "add this calendar" links for the subscribe dialog (owner, 2026-10-07: suggest the app
 * and open it, keep "Copy link"). Pure, so every device and URL is testable in node.
 *
 * The link formats, checked 2026-10-07. Google and Microsoft publish no reference for these
 * subscribe deep links; they are the forms the maintained add-to-calendar-button library
 * (add2cal, src/generators/{google,outlook,index}.ts) ships, and Microsoft's help documents the
 * "Subscribe from web" flow they open:
 *  - Apple Calendar (iOS, iPadOS, macOS): the feed as `webcal://` — the system hands it to Calendar,
 *    which offers to subscribe.
 *  - Google Calendar: `https://calendar.google.com/calendar/render?cid=<webcal URL, encoded>`,
 *    which opens Google Calendar asking to add the calendar. A group that already has a real,
 *    shared Google Calendar uses that instead (it updates at once; an ICS subscription in Google
 *    can lag a day).
 *  - Outlook.com: `https://outlook.live.com/calendar/0/addfromweb?url=<https URL>&name=<name>`;
 *    Outlook for work or school (Microsoft 365) is the same path on outlook.office.com.
 * Every link is built from the https feed only: no https, no links (just "Copy link").
 */
import { webcalUrl } from './calendarFeeds';
import { detectPlatform, isIosUserAgent, type PlatformEnv } from './pwaPlatform';

export type CalendarApp = 'apple' | 'google' | 'outlook' | 'office';

/** The order of the "Other calendar apps" menu (the device's pick is taken out of it). */
export const CALENDAR_APPS: readonly CalendarApp[] = ['google', 'apple', 'outlook', 'office'];

export interface FeedSource {
  /** The feed as served (`ics_url`). */
  icsUrl: string;
  /** What the calendar is called in the user's app. */
  name: string;
  /** A group's own shared Google Calendar, when the LMS has made one. */
  googleUrl?: string | null;
}

export type FeedLinks = Record<CalendarApp, string | null>;

const GOOGLE_RENDER = 'https://calendar.google.com/calendar/render?cid=';
const OUTLOOK_ADD = 'https://outlook.live.com/calendar/0/addfromweb';
const OFFICE_ADD = 'https://outlook.office.com/calendar/0/addfromweb';

const isGoogleCalendar = (url: string | null | undefined): url is string =>
  typeof url === 'string' && url.startsWith('https://calendar.google.com/');

export function feedLinks({ icsUrl, name, googleUrl }: FeedSource): FeedLinks {
  const webcal = webcalUrl(icsUrl);
  if (!webcal) return { apple: null, google: null, outlook: null, office: null };
  const microsoft = (base: string) => `${base}?url=${encodeURIComponent(icsUrl)}&name=${encodeURIComponent(name)}`;
  return {
    apple: webcal,
    google: isGoogleCalendar(googleUrl) ? googleUrl : GOOGLE_RENDER + encodeURIComponent(webcal),
    outlook: microsoft(OUTLOOK_ADD),
    office: microsoft(OFFICE_ADD),
  };
}

/** The app this device most likely uses: Apple on iPhone, iPad and Mac; Google on Android;
 *  Outlook on Windows; Google anywhere else. */
export function preferredApp({ userAgent = '', maxTouchPoints = 0 }: PlatformEnv): CalendarApp {
  if (isIosUserAgent(userAgent, maxTouchPoints) || /Macintosh|Mac OS X/.test(userAgent)) return 'apple';
  if (/Android/i.test(userAgent)) return 'google';
  if (/Windows NT|Windows Phone/i.test(userAgent)) return 'outlook';
  return 'google';
}

/** Telegram, Instagram & co. (#134's detection): no calendar app opens from their browsers, so
 *  "Copy link" leads there. */
export function inAppBrowser(env: PlatformEnv): { inApp: boolean; appName: string | null } {
  const { platform, inAppName } = detectPlatform(env);
  const inApp = platform === 'ios-in-app' || platform === 'android-in-app';
  return { inApp, appName: inApp ? inAppName : null };
}

/** What the dialog shows for one feed: the primary app (null = "Copy link" leads) and the rest. */
export function feedActions(links: FeedLinks, env: PlatformEnv): { primary: CalendarApp | null; others: CalendarApp[] } {
  const available = CALENDAR_APPS.filter((app) => links[app]);
  if (available.length === 0) return { primary: null, others: [] };
  if (inAppBrowser(env).inApp) return { primary: null, others: available };
  const pick = preferredApp(env);
  const primary = links[pick] ? pick : available[0];
  return { primary, others: available.filter((app) => app !== primary) };
}
