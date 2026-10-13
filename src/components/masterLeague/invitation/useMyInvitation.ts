/**
 * The student's invitation, fetched on mount, again when the tab comes back after a while, and every
 * few seconds for a little while after they accepted (until the CRM has enrolled them, the page shows
 * «seat requested»). `status` is honest: a failed read is `error`, never «no invitation».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clockOffset, ENROL_POLL_MS, shouldPollEnrolment } from '@/lib/leagueInvitation';
import { getMyInvitation, type LeagueInvitation } from '@/services/api/leagueInvitation';

const REFRESH_AFTER_MS = 2 * 60 * 1000;

export type InvitationLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; invitation: LeagueInvitation | null; offset: number };

export function useMyInvitation(enabled: boolean) {
  const [state, setState] = useState<InvitationLoad>({ status: 'loading' });
  const lastLoad = useRef(0);
  /** When the current answer arrived (or the page opened): the poll for the enrolment runs for a while from then. */
  const polling = useRef(Date.now());

  const load = useCallback((quiet = false) => {
    lastLoad.current = Date.now();
    if (!quiet) setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    return getMyInvitation().then(
      (invitation) => setState({ status: 'ready', invitation, offset: clockOffset(invitation?.server_now ?? null, Date.now()) }),
      // A background refresh that fails keeps what the page already shows; a first load that fails says so.
      () => setState((s) => (quiet && s.status === 'ready' ? s : { status: 'error' })),
    );
  }, []);

  /** Take a fresh answer from an action (the server's reply to an answer) without another request. */
  const adopt = useCallback((invitation: LeagueInvitation) => {
    polling.current = Date.now();
    setState({ status: 'ready', invitation, offset: clockOffset(invitation.server_now, Date.now()) });
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const guarded = (quiet: boolean) => { if (alive) void load(quiet); };
    guarded(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REFRESH_AFTER_MS) guarded(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, load]);

  const invitation = state.status === 'ready' ? state.invitation : null;
  const waiting = shouldPollEnrolment(invitation, Date.now() - polling.current);
  useEffect(() => {
    if (!enabled || !waiting) return undefined;
    const id = window.setInterval(() => {
      if (!shouldPollEnrolment(invitation, Date.now() - polling.current)) {
        window.clearInterval(id);
        return;
      }
      void load(true);
    }, ENROL_POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, waiting, invitation, load]);

  return { state, reload: () => load(false), adopt };
}
