import { getPublicSummary } from '../../services/api/openWebinars';
import { reasonCodeOf } from '../../services/api/apiError';
import type { Event } from '../../types';
import '@/lib/i18n/catalogs/openWebinars';

/**
 * True when one of `events` is a webinar that is still ahead and open to everyone. Cancelling (in this LMS, deleting)
 * such a webinar mails everyone who registered, so the confirmation says so. A webinar that is not open, or whose
 * state the server will not tell, counts as not open: the plain confirmation is then all there is to say.
 */
export async function opensToEveryoneAhead(events: Pick<Event, 'id' | 'event_type' | 'start_datetime'>[], now = Date.now()): Promise<boolean> {
  const ahead = events.filter((event) => event.event_type === 'webinar' && Date.parse(event.start_datetime) > now);
  const summaries = await Promise.all(ahead.map((event) => getPublicSummary(event.id).then((summary) => summary.open).catch(() => false)));
  return summaries.some(Boolean);
}

/**
 * The server's own sentence when it refused to delete or change a webinar that is open to everyone
 * (`webinar_public_retype`, `webinar_public_host`, `webinar_public_delete`), already in the reader's language; null
 * for any other failure, which keeps its generic wording.
 */
export function publicWebinarRefusal(error: unknown): string | null {
  const code = reasonCodeOf(error);
  return code?.startsWith('webinar_public_') && error instanceof Error ? error.message : null;
}
