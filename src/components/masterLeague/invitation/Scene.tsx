/**
 * Every scene of the invitation page that is not the offer itself: the seat being confirmed, the
 * welcome, and the honest endings (declined, closed, taken back), plus «nothing here» and «could
 * not load». One navy card each, Kasatik in the kit with the face that fits, one way back.
 */
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import Orca from '@/components/mascot/Orca';
import { LeagueCrestSvg } from '@/components/mascot/art/LeagueCrest';
import { leagueKitConfig } from '@/components/mascot/leagueKit';
import { chosenOption, deadlineLabel, localizeSchedule, squadName, type InvitationScene } from '@/lib/leagueInvitation';
import { useLeagueT } from '../useLeagueLocale';
import type { Locale } from '@/lib/i18n';
import type { LeagueInvitation } from '@/services/api/leagueInvitation';
import '@/lib/i18n/catalogs/studentHome';

export type SceneName = Exclude<InvitationScene, 'open'> | 'failed';

/** Kasatik's face per scene: delighted for good news, a wink for «no problem», a gentle smile for the rest, surprised when something broke. */
const FACE: Record<SceneName, number> = {
  seatRequested: 7, enrolled: 3, ended: 0, declined: 1, expired: 0, withdrawn: 0, alreadyIn: 0, none: 0, failed: 6,
};

interface SceneProps {
  scene: SceneName;
  invitation: LeagueInvitation | null;
  locale: Locale;
  /** Where «back» goes; the dashboard. */
  dashboardTo?: string;
  onRetry?: () => void;
}

const button = 'inline-flex min-h-12 items-center justify-center rounded-2xl bg-amber-300 px-6 text-base font-extrabold text-blue-950 transition-colors hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export default function Scene({ scene, invitation, locale, dashboardTo = '/dashboard', onRetry }: SceneProps) {
  const t = useLeagueT();
  const titleId = `${useId()}scene`;
  const heading = useRef<HTMLHeadingElement>(null);
  // The page just changed under the student (their answer went through, a reload came back): move a screen reader to the new headline.
  useEffect(() => heading.current?.focus({ preventScroll: true }), [scene]);
  const squad = invitation ? chosenOption(invitation) : null;
  const params = {
    squad: squad ? squadName(squad) : '',
    schedule: squad ? localizeSchedule(squad.schedule_text, locale) : '',
    when: invitation ? deadlineLabel(invitation, locale) : '',
  };
  const withSquad = (key: 'requested' | 'enrolled') =>
    squad ? t(`studentHome.leagueInvite.${key}.body`, params) : t(`studentHome.leagueInvite.${key}.bodyNoSquad`);
  const copy: Record<SceneName, { title: string; body: string; hint?: string }> = {
    seatRequested: { title: t('studentHome.leagueInvite.requested.title'), body: withSquad('requested'), hint: t('studentHome.leagueInvite.requested.wrong') },
    enrolled: { title: t('studentHome.leagueInvite.enrolled.title'), body: withSquad('enrolled') },
    ended: { title: t('studentHome.leagueInvite.ended.title'), body: t('studentHome.leagueInvite.ended.body') },
    declined: { title: t('studentHome.leagueInvite.declined.title'), body: t('studentHome.leagueInvite.declined.body') },
    expired: { title: t('studentHome.leagueInvite.expired.title'), body: t('studentHome.leagueInvite.expired.body', params) },
    withdrawn: { title: t('studentHome.leagueInvite.withdrawn.title'), body: t('studentHome.leagueInvite.withdrawn.body') },
    alreadyIn: { title: t('studentHome.leagueInvite.alreadyIn.title'), body: t('studentHome.leagueInvite.alreadyIn.body') },
    none: { title: t('studentHome.leagueInvite.none.title'), body: t('studentHome.leagueInvite.none.body') },
    failed: { title: t('studentHome.leagueInvite.failed.title'), body: t('studentHome.leagueInvite.failed.body') },
  };
  const { title, body, hint } = copy[scene];
  const good = scene === 'seatRequested' || scene === 'enrolled' || scene === 'alreadyIn';
  return (
    <section
      aria-labelledby={titleId}
      role={scene === 'seatRequested' ? 'status' : undefined}
      className="relative isolate overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#07122E_0%,#0B1B4D_45%,#14307A_100%)] px-5 pb-7 pt-8 text-center text-white shadow-[0_24px_48px_-28px_rgba(11,27,77,0.95)] ring-1 ring-amber-300/25 @lg:px-10"
    >
      {good && <div aria-hidden className="mli-rays -z-10" />}
      <div className="relative mx-auto w-fit">
        <div className={good ? 'mli-bob' : undefined}>
          <Orca
            config={{ ...leagueKitConfig(), expression: FACE[scene] }}
            size={132}
            title={t('studentHome.leagueInvite.kitAlt')}
            className="h-[112px] w-[112px] @lg:h-[132px] @lg:w-[132px]"
          />
        </div>
        {good && <LeagueCrestSvg size={40} className="absolute -right-4 -top-1 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]" />}
      </div>
      <h1 ref={heading} id={titleId} tabIndex={-1} className="mt-4 text-2xl font-extrabold leading-tight outline-none @lg:text-3xl">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-blue-100 @lg:text-base">{body}</p>
      {hint && <p className="mx-auto mt-3 max-w-md text-xs text-amber-200">{hint}</p>}
      <div className="mt-6">
        {scene === 'failed' ? (
          <button type="button" onClick={onRetry} className={button}>{t('studentHome.leagueInvite.failed.retry')}</button>
        ) : (
          <Link to={dashboardTo} className={button}>{t('studentHome.leagueInvite.dashboard')}</Link>
        )}
      </div>
    </section>
  );
}
