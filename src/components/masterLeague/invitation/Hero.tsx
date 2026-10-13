/**
 * The top of the invitation: Kasatik in the league kit under floodlights, «You've been picked.»,
 * and the time left. Navy and gold; the rays and beams are decoration (hidden from screen readers,
 * still under reduced motion).
 */
import { useId } from 'react';
import { Clock } from 'lucide-react';
import Orca from '@/components/mascot/Orca';
import { LeagueCrestSvg } from '@/components/mascot/art/LeagueCrest';
import { leagueKitConfig } from '@/components/mascot/leagueKit';
import { deadlineCountdown, examMonth, msLeft } from '@/lib/leagueInvitation';
import { useLeagueT } from '../useLeagueLocale';
import type { Locale } from '@/lib/i18n';
import type { LeagueInvitation } from '@/services/api/leagueInvitation';
import '@/lib/i18n/catalogs/studentHome';

/** The countdown, as a pill. `role="timer"` is silent to screen readers until asked; the deadline itself is written out below it. */
export function CountdownPill({ left, locale }: { left: number; locale: Locale }) {
  const t = useLeagueT();
  const hurry = left > 0 && left < 6 * 3_600_000;
  return (
    <div
      role="timer"
      aria-live="off"
      className={`mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-black/25 px-4 py-2 text-sm ring-1 ${hurry ? 'ring-amber-300' : 'ring-amber-300/40'}`}
    >
      <Clock aria-hidden className="h-4 w-4 text-amber-300" />
      <span className="sr-only">{t('studentHome.leagueInvite.timeLeftLabel')}: </span>
      <span className="font-bold tabular-nums text-amber-200">
        {t('studentHome.leagueInvite.left', { time: deadlineCountdown(left, locale) })}
      </span>
    </div>
  );
}

interface HeroProps {
  invitation: LeagueInvitation;
  now: number;
  offset: number;
  locale: Locale;
}

export default function Hero({ invitation, now, offset, locale }: HeroProps) {
  const t = useLeagueT();
  const titleId = `${useId()}hero`;
  return (
    <header
      aria-labelledby={titleId}
      className="relative isolate overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#07122E_0%,#0B1B4D_45%,#14307A_100%)] px-5 pb-6 pt-8 text-center text-white shadow-[0_24px_48px_-28px_rgba(11,27,77,0.95)] ring-1 ring-amber-300/25 @lg:px-10 @lg:pb-8 @lg:pt-10"
    >
      <div aria-hidden className="mli-rays -z-10" />
      <div aria-hidden className="mli-beam mli-beam-l -z-10" />
      <div aria-hidden className="mli-beam mli-beam-r -z-10" />
      <div className="relative mx-auto w-fit">
        <div className="mli-bob">
          <Orca config={leagueKitConfig()} size={168} title={t('studentHome.leagueInvite.kitAlt')} className="h-[132px] w-[132px] @lg:h-[168px] @lg:w-[168px]" />
        </div>
        <LeagueCrestSvg size={46} className="absolute -right-5 -top-1 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]" />
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
        {t('studentHome.leagueInvite.eyebrow', { month: examMonth(invitation.exam_date, locale) })}
      </p>
      <h1 id={titleId} className="mt-1 text-[1.75rem] font-extrabold leading-tight @lg:text-4xl">
        {t('studentHome.leagueInvite.hero.title')}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-blue-100 @lg:text-base">{t('studentHome.leagueInvite.hero.sub')}</p>
      <CountdownPill left={msLeft(invitation, now, offset)} locale={locale} />
    </header>
  );
}
