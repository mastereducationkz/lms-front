/**
 * One prompt at a time on the dashboard (owner, 2026-10-07). The install card, and inside the
 * installed app the reminders card, appear only when nothing else is asking for attention:
 *  - the onboarding tour or its welcome is not on screen, nor still owed;
 *  - no one-time page tip is open;
 *  - the «Meet your Kasatik» spotlight isn't showing or waiting its turn: Kasatik comes first;
 *  - for students, the visit is a quiet one (lib/attention: not the first visit, no blocking popup
 *    shown or still deciding in it).
 * Once the card has appeared in a visit it stays for the rest of it, except while a tour runs.
 */
export interface DashboardPromptInput {
  tourActive: boolean;
  tipOpen: boolean;
  /** The Kasatik spotlight would show for this student (visible now, or on a quieter moment). */
  spotlightFirst: boolean;
  /** Students: the attention queue lets a nudge show. Staff have no queue: always true. */
  quietVisit: boolean;
  shownThisVisit: boolean;
}

export function dashboardPromptAllowed(i: DashboardPromptInput): boolean {
  if (i.tourActive) return false;
  if (i.shownThisVisit) return true;
  return !i.tipOpen && !i.spotlightFirst && i.quietVisit;
}
