/**
 * Where the Master League invitation lives and which bell rows open it. Kept free of imports so the
 * notifications API and the bell can use it without pulling the page's copy into the main bundle.
 */
export const LEAGUE_INVITATION_PATH = '/league-invitation';

/** The bell's rows for the invitation and its reminder (lms-backend notification types); both open the page. */
export const LEAGUE_INVITATION_NOTIFICATION_TYPES = ['master_league_invitation', 'master_league_reminder'];

/** The page a bell row opens, or null when the row is not the invitation's. */
export function invitationNotificationPath(notificationType: string): string | null {
  return LEAGUE_INVITATION_NOTIFICATION_TYPES.includes(notificationType) ? LEAGUE_INVITATION_PATH : null;
}
