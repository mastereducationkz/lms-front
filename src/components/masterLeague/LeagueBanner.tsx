/**
 * The Master League season banner (owner, 2026-10-13): on a league student's dashboard, from the day
 * they are signed until the season's paperwork is done. Navy and gold, Kasatik in the kit, the
 * matchday track, the countdown to The Final and one line from the coach. It is part of the page,
 * never a popup, and it is not dismissible: it is their season. Renders nothing for anyone else.
 *
 * `LeagueBannerView` is the pure picture (data and clock in, markup out) so it can be rendered
 * statically for review; `LeagueBanner` adds the fetch and the clock.
 */
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import Orca from '@/components/mascot/Orca';
import { MasterMark } from '@/components/mascot/art/MasterMark';
import { leagueKitConfig } from '@/components/mascot/leagueKit';
import { useAuth } from '@/contexts/AuthContext';
import {
  attendanceText, coachNote, groupTail, homeworkText, needsTicker, phaseCopy,
} from '@/lib/leagueSeason';
import { useLocale, useT } from '@/lib/i18n/react';
import type { Locale } from '@/lib/i18n';
import type { MyLeague } from '@/services/api/masterLeague';
import LeagueGoals from './LeagueGoals';
import LeagueResultConsent from './LeagueResultConsent';
import LeagueTelegramLine from './LeagueTelegramLine';
import LeagueTrack from './LeagueTrack';
import { useMyLeague, useNow } from './useMyLeague';
import '@/lib/i18n/catalogs/studentHome';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10">
      <div className="text-lg font-extrabold leading-tight tabular-nums text-white">{value}</div>
      <div className="text-[10px] leading-tight text-blue-100 @lg:text-[11px]">{label}</div>
    </div>
  );
}

interface ViewProps {
  league: MyLeague;
  userId: number | string;
  now: number;
  locale: Locale;
  /** The goals drawer starts open (the static review render); the live banner starts closed. */
  defaultOpen?: boolean;
  /** Quiet rows between the figures and the coach's line (the result question, the Telegram offer); each renders nothing when it has nothing to say. */
  children?: ReactNode;
}

export function LeagueBannerView({ league, userId, now, locale, defaultOpen = false, children }: ViewProps) {
  const t = useT();
  const uid = useId();
  const [open, setOpen] = useState(defaultOpen);
  const copy = phaseCopy(league, now, locale);
  const goalsId = `${uid}goals`;
  const headingId = `${uid}title`;

  return (
    <section
      aria-labelledby={headingId}
      className="relative isolate mt-2 overflow-hidden rounded-3xl border border-amber-300/30 bg-[linear-gradient(135deg,#07122E_0%,#0B1B4D_38%,#14307A_78%,#1E4DB8_100%)] text-white shadow-[0_18px_40px_-22px_rgba(11,27,77,0.9)]"
    >
      {/* the emblem, large and quiet; a gold glow low on the left */}
      <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-10 -top-14 h-64 w-64 @lg:h-80 @lg:w-80">
        <MasterMark x={100} y={100} size={190} color="#fff" opacity={0.07} />
      </svg>
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-amber-300/15 blur-3xl" />

      <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 @lg:grid-cols-[auto_minmax(0,1fr)_16rem] @lg:gap-x-6 @lg:p-6">
        <div className="shrink-0 @lg:row-span-2">
          <Orca config={leagueKitConfig()} size={112} title={t('studentHome.league.kitAlt')} className="h-20 w-20 @lg:h-28 @lg:w-28" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
            {t('studentHome.league.eyebrow', { group: groupTail(league.group.name) })}
          </p>
          <h2 id={headingId} className="mt-0.5 text-xl font-extrabold leading-tight @lg:text-2xl">{copy.title}</h2>
          <p className="mt-1 text-sm text-blue-100">{copy.sub}</p>
          {copy.kickoff && <p className="mt-0.5 text-xs font-semibold text-amber-200">{copy.kickoff}</p>}
        </div>
        <div className="col-span-2 min-w-0 @lg:col-span-1 @lg:col-start-2">
          <LeagueTrack items={league.lessons.items} phase={league.phase} examDate={league.exam_date} />
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-2 @lg:col-span-1 @lg:col-start-3 @lg:row-span-2 @lg:row-start-1 @lg:grid-cols-2">
          <Stat value={attendanceText(league.attendance, locale)} label={t('studentHome.league.stat.attendance')} />
          <Stat value={homeworkText(league.homework, locale)} label={t('studentHome.league.stat.homework')} />
          <div className="min-w-0 rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/10 @lg:col-span-2">
            <div className="text-[11px] leading-snug text-blue-100">{t('studentHome.league.stat.squad', { count: league.squad_size })}</div>
          </div>
        </div>
      </div>

      {children}

      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/10 px-4 py-3 @lg:px-6">
        <p className="min-w-0 flex-1 basis-full text-xs italic text-blue-100/90 @lg:basis-0">
          <span className="font-semibold not-italic text-amber-300">{t('studentHome.league.coach')}: </span>
          {coachNote(copy.noteKey, now, userId, locale, league.days_to_exam)}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={goalsId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-white/15 transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          {open ? t('studentHome.league.goals.close') : t('studentHome.league.goals.open')}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </div>
      {open && <LeagueGoals id={goalsId} goals={league.achievements} />}
    </section>
  );
}

export default function LeagueBanner() {
  const { user } = useAuth();
  const locale = useLocale();
  const league = useMyLeague(user?.role === 'student');
  const ticking = league !== null && needsTicker(league, Date.now());
  const now = useNow(ticking);
  if (!user || !league) return null;
  return (
    <LeagueBannerView league={league} userId={user.id} now={now} locale={locale}>
      <LeagueResultConsent enabled={league.phase === 'after'} />
      <LeagueTelegramLine userId={user.id} />
    </LeagueBannerView>
  );
}
