/**
 * The dashboard's nudge for an open Master League invitation: one navy-and-gold card with the time
 * left and a way in. It is part of the page, never a popup and never the attention queue's slot; the
 * bell, a push and Telegram open the page directly. For a seat still being confirmed it shows a
 * quieter line, and for everyone else it renders nothing (also while loading and on any error).
 */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Orca from '@/components/mascot/Orca';
import { leagueKitConfig } from '@/components/mascot/leagueKit';
import { useAuth } from '@/contexts/AuthContext';
import { cardKind, deadlineCountdown, LEAGUE_INVITATION_PATH, msLeft, tickEvery } from '@/lib/leagueInvitation';
import { useLeagueLocale, useLeagueT } from './useLeagueLocale';
import type { Locale } from '@/lib/i18n';
import type { LeagueInvitation } from '@/services/api/leagueInvitation';
import { useMyInvitation } from './invitation/useMyInvitation';
import { useNow } from './useMyLeague';
import '@/lib/i18n/catalogs/studentHome';

interface ViewProps {
  kind: 'open' | 'pending';
  invitation: LeagueInvitation;
  now: number;
  offset: number;
  locale: Locale;
}

/** The card's picture (data and clock in); `LeagueInvitationCard` adds the fetch and the clock. */
export function LeagueInvitationCardView({ kind, invitation, now, offset, locale }: ViewProps) {
  const t = useLeagueT();
  const open = kind === 'open';
  return (
    <section
      aria-label={t('studentHome.leagueInvite.page')}
      className="relative isolate mt-2 overflow-hidden rounded-3xl border border-amber-300/40 bg-[linear-gradient(135deg,#07122E_0%,#0B1B4D_45%,#14307A_100%)] text-white shadow-[0_18px_40px_-22px_rgba(11,27,77,0.9)]"
    >
      <div aria-hidden className="pointer-events-none absolute -bottom-14 -left-8 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3 p-4 @lg:flex-nowrap @lg:p-5">
        <Orca config={leagueKitConfig()} size={72} title="" className="h-16 w-16 shrink-0 @lg:h-[72px] @lg:w-[72px]" />
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">{t('studentHome.leagueInvite.card.eyebrow')}</p>
          <h2 className="mt-0.5 text-lg font-extrabold leading-tight">
            {t(open ? 'studentHome.leagueInvite.card.title' : 'studentHome.leagueInvite.card.pendingTitle')}
          </h2>
          <p className="mt-0.5 text-sm text-blue-100">
            {open
              ? t('studentHome.leagueInvite.card.sub', { time: deadlineCountdown(msLeft(invitation, now, offset), locale) })
              : t('studentHome.leagueInvite.card.pendingSub')}
          </p>
        </div>
        <Link
          to={LEAGUE_INVITATION_PATH}
          className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1 rounded-2xl px-5 text-sm font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white @lg:w-auto ${
            open ? 'bg-amber-300 text-blue-950 hover:bg-amber-200' : 'bg-white/10 text-amber-200 ring-1 ring-white/20 hover:bg-white/15'
          }`}
        >
          {t(open ? 'studentHome.leagueInvite.card.cta' : 'studentHome.leagueInvite.card.pendingCta')}
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export default function LeagueInvitationCard() {
  const { user } = useAuth();
  const locale = useLeagueLocale();
  const { state } = useMyInvitation(user?.role === 'student');
  const invitation = state.status === 'ready' ? state.invitation : null;
  const offset = state.status === 'ready' ? state.offset : 0;
  const tick = invitation?.state === 'open' ? tickEvery(msLeft(invitation, Date.now(), offset)) : null;
  const now = useNow(tick !== null, tick ?? 30_000);
  const kind = cardKind(invitation, now, offset);
  if (!invitation || !kind) return null;
  return <LeagueInvitationCardView kind={kind} invitation={invitation} now={now} offset={offset} locale={locale} />;
}
