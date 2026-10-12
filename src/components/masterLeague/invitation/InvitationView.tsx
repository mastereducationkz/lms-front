/**
 * The whole invitation page as a picture: data and clock in, markup out (no fetch, no router
 * state), so the live page and the static review render share it. The offer reads top to bottom:
 * hero, what it is, the squads (the answer), the teaser, a quiet «not this time». Every other state
 * is one honest scene (./Scene).
 */
import type { Locale } from '@/lib/i18n';
import { useLeagueT } from '../useLeagueLocale';
import type { InvitationScene } from '@/lib/leagueInvitation';
import type { LeagueInvitation } from '@/services/api/leagueInvitation';
import Decline from './Decline';
import Facts from './Facts';
import Hero from './Hero';
import Scene from './Scene';
import SlotCards from './SlotCards';
import Teaser from './Teaser';
import { INVITATION_CSS } from './styles';
import '@/lib/i18n/catalogs/studentHome';

export type Saving = { kind: 'accept'; groupId: number } | { kind: 'decline' } | null;

export interface InvitationViewProps {
  scene: InvitationScene | 'failed';
  invitation: LeagueInvitation | null;
  /** The device clock (ms) and how far it is from the server's. */
  now: number;
  offset: number;
  locale: Locale;
  saving?: Saving;
  /** Why the last answer did not go through. */
  notice?: 'changed' | 'retry' | null;
  declining?: boolean;
  onChoose?: (groupId: number) => void;
  onAskDecline?: () => void;
  onKeep?: () => void;
  onDecline?: () => void;
  onRetry?: () => void;
}

export default function InvitationView(props: InvitationViewProps) {
  const t = useLeagueT();
  const { scene, invitation, now, offset, locale, saving = null, notice = null, declining = false } = props;
  const none = () => undefined;
  let body;
  if (scene === 'open' && invitation) {
    const busy = saving !== null;
    body = (
      <>
        <Hero invitation={invitation} now={now} offset={offset} locale={locale} />
        {notice && (
          <p role="alert" className="rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
            {t(notice === 'changed' ? 'studentHome.leagueInvite.error.changed' : 'studentHome.leagueInvite.error.retry')}
          </p>
        )}
        <Facts invitation={invitation} locale={locale} />
        <SlotCards
          options={invitation.options}
          locale={locale}
          savingGroup={saving?.kind === 'accept' ? saving.groupId : null}
          busy={busy}
          onChoose={props.onChoose ?? none}
        />
        <Teaser />
        <Decline
          confirming={declining}
          saving={saving?.kind === 'decline'}
          disabled={busy}
          onAsk={props.onAskDecline ?? none}
          onKeep={props.onKeep ?? none}
          onConfirm={props.onDecline ?? none}
        />
        <p className="text-center text-xs text-muted-foreground">{t('studentHome.leagueInvite.help')}</p>
      </>
    );
  } else {
    body = <Scene scene={scene === 'open' ? 'none' : scene} invitation={invitation} locale={locale} onRetry={props.onRetry} />;
  }
  return (
    <div className="@container mx-auto w-full max-w-3xl space-y-4 pb-10">
      <style>{INVITATION_CSS}</style>
      {body}
    </div>
  );
}
