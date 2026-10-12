/**
 * /league-invitation (owner, 2026-10-13): the Master League invitation a student answers in the LMS.
 * The bell, a push and Telegram all open it; the dashboard card links to it. GET the invitation, show
 * the scene it calls for, send «I'm in» (with the squad) or «Not this time», and say honestly what
 * happened. The CRM enrols an accepting student within minutes; this page then says «you're in».
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import InvitationView, { type Saving } from '@/components/masterLeague/invitation/InvitationView';
import { useMyInvitation } from '@/components/masterLeague/invitation/useMyInvitation';
import { useMyLeague, useNow } from '@/components/masterLeague/useMyLeague';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale, useT } from '@/lib/i18n/react';
import { msLeft, sceneOf, tickEvery } from '@/lib/leagueInvitation';
import { answerInvitation, InvitationAnswerError } from '@/services/api/leagueInvitation';
import '@/lib/i18n/catalogs/studentHome';

export default function LeagueInvitationPage() {
  const { user } = useAuth();
  const t = useT();
  const locale = useLocale();
  const { state, reload, adopt } = useMyInvitation(user?.role === 'student');
  const league = useMyLeague(user?.role === 'student');
  const [saving, setSaving] = useState<Saving>(null);
  const [notice, setNotice] = useState<'changed' | 'retry' | null>(null);
  const [declining, setDeclining] = useState(false);
  /** Set the instant an answer leaves, before React re-renders: a double tap cannot send two. */
  const sending = useRef(false);

  const ready = state.status === 'ready' ? state : null;
  const offset = ready?.offset ?? 0;
  const invitation = ready?.invitation ?? null;
  // The countdown ticks while the offer is open; the scene flips to «closed» the moment the deadline passes.
  const tick = invitation?.state === 'open' ? tickEvery(msLeft(invitation, Date.now(), offset)) : null;
  const now = useNow(tick !== null, tick ?? 30_000);

  useEffect(() => { document.title = t('studentHome.leagueInvite.page'); }, [t]);

  const scene = useMemo(
    () => (ready ? sceneOf(invitation, now, offset, league !== null) : null),
    [ready, invitation, now, offset, league],
  );

  const answer = async (accept: boolean, groupId: number | null) => {
    if (sending.current) return;
    sending.current = true;
    setSaving(accept && groupId !== null ? { kind: 'accept', groupId } : { kind: 'decline' });
    setNotice(null);
    try {
      adopt(await answerInvitation(accept, groupId));
      setDeclining(false);
    } catch (error) {
      const changed = error instanceof InvitationAnswerError && error.kind === 'changed';
      setNotice(changed ? 'changed' : 'retry');
      if (changed) { setDeclining(false); void reload(); }
    } finally {
      sending.current = false;
      setSaving(null);
    }
  };

  if (state.status === 'loading') {
    return (
      <div role="status" aria-label={t('studentHome.leagueInvite.loading')} className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }
  return (
    <InvitationView
      scene={scene ?? 'failed'}
      invitation={invitation}
      now={now}
      offset={offset}
      locale={locale}
      saving={saving}
      notice={notice}
      declining={declining}
      onChoose={(groupId) => void answer(true, groupId)}
      onAskDecline={() => setDeclining(true)}
      onKeep={() => setDeclining(false)}
      onDecline={() => void answer(false, null)}
      onRetry={() => void reload()}
    />
  );
}
