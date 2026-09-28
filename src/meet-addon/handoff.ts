import type { ApiClient } from './api';

/**
 * Signing the panel in (lms-backend `/auth/addon-handoff`, device-code style):
 *
 * 1. `POST /auth/addon-handoff` → a handoff id, a poll secret and the link to approve it at.
 * 2. The link opens in a popup, a first-party LMS window where the teacher's normal session
 *    works (SSO included). They press «Allow».
 * 3. The panel polls `POST /auth/addon-handoff/{id}/redeem` until the answer comes, and keeps
 *    the tokens it gets.
 *
 * A popup may only open from a click, and the link is known only after step 1, so the click
 * opens an empty popup first and points it at the link once it exists. A blocked popup leaves
 * the link on screen to click instead.
 */

export type HandoffState =
  | { kind: 'starting' }
  | { kind: 'waiting'; linkUrl: string; popupBlocked: boolean }
  | { kind: 'approved' }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

export type HandoffOutcome = 'approved' | 'denied' | 'expired' | 'error' | 'cancelled';

interface Created { handoff_id: string; poll_secret: string; link_url: string; expires_in: number }
interface Redeemed { status: 'pending' | 'denied' | 'approved'; access_token?: string; refresh_token?: string }

export interface PopupLike { location: { href: string }; close(): void; closed?: boolean }

export interface HandoffDeps {
  client: Pick<ApiClient, 'anonymous' | 'tokens'>;
  /** The empty popup opened from the click, or null when the browser blocked it. */
  popup: PopupLike | null;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
  signal?: AbortSignal;
}

export const POPUP_NAME = 'lms-meet-addon-link';
export const POPUP_FEATURES = 'popup,width=480,height=640';

/** Opens the empty sign-in popup. Call it synchronously inside the click handler. */
export function openSignInPopup(open: typeof window.open = window.open.bind(window)): PopupLike | null {
  try {
    return open('', POPUP_NAME, POPUP_FEATURES);
  } catch {
    return null;
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function closeQuietly(popup: PopupLike | null) {
  try {
    popup?.close();
  } catch {
    /* already gone */
  }
}

export async function runHandoff(
  meetingCode: string | null,
  deps: HandoffDeps,
  onState: (state: HandoffState) => void,
): Promise<HandoffOutcome> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const pollMs = deps.pollMs ?? 2000;
  const aborted = () => Boolean(deps.signal?.aborted);

  onState({ kind: 'starting' });
  let created: Created | null = null;
  try {
    const answer = await deps.client.anonymous<Created>('/auth/addon-handoff', { meeting_code: meetingCode });
    if (answer.status === 201 && answer.data?.handoff_id) created = answer.data;
    else {
      closeQuietly(deps.popup);
      onState({
        kind: 'error',
        message: answer.status === 429
          ? 'Too many sign-in attempts from this network. Try again in a few minutes.'
          : 'Sign-in is unavailable right now. Try again in a minute.',
      });
      return 'error';
    }
  } catch {
    closeQuietly(deps.popup);
    onState({ kind: 'error', message: 'Could not reach the LMS. Check the connection and try again.' });
    return 'error';
  }

  let popupBlocked = deps.popup === null;
  if (deps.popup) {
    try {
      deps.popup.location.href = created.link_url;
    } catch {
      popupBlocked = true;
    }
  }
  onState({ kind: 'waiting', linkUrl: created.link_url, popupBlocked });

  const deadline = now() + created.expires_in * 1000;
  while (now() < deadline) {
    await sleep(pollMs);
    if (aborted()) return 'cancelled';
    let answer: { status: number; data: Redeemed | null };
    try {
      answer = await deps.client.anonymous<Redeemed>(
        `/auth/addon-handoff/${encodeURIComponent(created.handoff_id)}/redeem`,
        { poll_secret: created.poll_secret },
      );
    } catch {
      continue; // a network blip: the next poll tries again
    }
    if (aborted()) return 'cancelled';
    if (answer.status === 404) break;
    if (answer.status !== 200 || !answer.data) continue; // 503 and friends: keep polling
    if (answer.data.status === 'approved' && answer.data.access_token && answer.data.refresh_token) {
      deps.client.tokens.set(answer.data.access_token, answer.data.refresh_token);
      closeQuietly(deps.popup);
      onState({ kind: 'approved' });
      return 'approved';
    }
    if (answer.data.status === 'denied') {
      closeQuietly(deps.popup);
      onState({ kind: 'denied' });
      return 'denied';
    }
  }
  onState({ kind: 'expired' });
  return 'expired';
}
