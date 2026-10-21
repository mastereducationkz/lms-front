import { preflightOpenAccess, saveOpenAccess, type PreflightBody } from '../../services/api/openWebinars';
import { accessBody, type AccessDraft } from './accessModel';
import type { CreateEventRequest, Event } from '../../types';

export type CreateOutcome =
  /** The event exists and is open as chosen. */
  | { kind: 'created'; event: Event }
  /** The event exists, but saving its public access failed: open its edit page and show `message` there. */
  | { kind: 'access_failed'; event: Event; message: string };

/**
 * The create form's Save for a webinar that opens to everyone, in the order that leaves nothing half-made:
 *  1. preflight — the server's refusals (no host, no Workspace account, bad address, no policy…) are raised
 *     BEFORE any event exists, so a refusal here creates nothing and the error is thrown to the form;
 *  2. create the event — a failure also throws, with nothing to clean up;
 *  3. PUT the access — a failure NOW cannot undo the event, so it is returned, not thrown: the caller
 *     takes the person to the event's edit page with the message, where the card can be fixed and saved.
 */
export async function createWithAccess(options: {
  create: (data: CreateEventRequest) => Promise<Event>;
  eventData: CreateEventRequest;
  draft: AccessDraft & { mode: 'open' | 'registration'; pipelineId: number };
  preflight: PreflightBody;
  /** Said when the failure carries no message of its own. */
  fallbackMessage: string;
}): Promise<CreateOutcome> {
  await preflightOpenAccess(options.preflight);
  const event = await options.create(options.eventData);
  try {
    await saveOpenAccess(event.id, accessBody(options.draft));
  } catch (failure) {
    return { kind: 'access_failed', event, message: failure instanceof Error && failure.message ? failure.message : options.fallbackMessage };
  }
  return { kind: 'created', event };
}
