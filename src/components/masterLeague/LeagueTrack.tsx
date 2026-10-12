/**
 * The matchday track: one pip per lesson of the season, ending in a trophy for The Final. Gold with
 * a tick = attended, a hollow dash = missed, a dashed ring = not marked yet, a pulsing gold ring =
 * today, a quiet ring = still to come. The number sits in every pip that isn't ticked, and every pip
 * has its words for a screen reader (matchday, state, and the day for the ones to come).
 */
import { Check, Minus, Trophy } from 'lucide-react';
import { pipLabel } from '@/lib/leagueSeason';
import { formatDate } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import type { LeagueLesson, LeaguePhase, LessonState } from '@/services/api/masterLeague';
import '@/lib/i18n/catalogs/studentHome';

const PIP: Record<LessonState, string> = {
  attended: 'bg-amber-300 text-blue-950 shadow-[0_0_10px_rgba(252,211,77,0.55)]',
  missed: 'border-2 border-white/35 text-white/60',
  unmarked: 'border-2 border-dashed border-amber-200/80 text-amber-100',
  today: 'border-2 border-amber-300 bg-amber-300/20 text-amber-200 animate-pulse motion-reduce:animate-none',
  upcoming: 'border border-white/30 bg-white/5 text-white/80',
};

const PIP_SIZE = 'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums @lg:h-6 @lg:w-6';

function Pip({ item }: { item: LeagueLesson }) {
  const locale = useLocale();
  const label = pipLabel(item, locale);
  return (
    <li title={label} className={`${PIP_SIZE} ${PIP[item.state]}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex items-center justify-center">
        {item.state === 'attended' ? <Check className="h-3 w-3" strokeWidth={3.4} /> : item.state === 'missed' ? <Minus className="h-3 w-3" strokeWidth={3} /> : item.number}
      </span>
    </li>
  );
}

/** The trophy at the end of the track: quiet until the Final, pulsing on the day, gold once it has been played. */
function FinalPip({ phase, examDate }: { phase: LeaguePhase; examDate: string | null }) {
  const t = useT();
  const locale = useLocale();
  const label = examDate
    ? t('studentHome.league.pip.finalOn', { date: formatDate(examDate, { day: 'numeric', month: 'short' }, locale) })
    : t('studentHome.league.pip.final');
  const style = phase === 'after'
    ? 'bg-amber-300 text-blue-950 shadow-[0_0_12px_rgba(252,211,77,0.7)]'
    : phase === 'exam_day'
      ? 'border-2 border-amber-300 bg-amber-300/20 text-amber-200 animate-pulse motion-reduce:animate-none'
      : 'border border-amber-200/60 text-amber-200';
  return (
    <li title={label} className={`${PIP_SIZE} ml-1 ${style}`}>
      <span className="sr-only">{label}</span>
      <Trophy aria-hidden className="h-3 w-3" strokeWidth={2.6} />
    </li>
  );
}

export default function LeagueTrack({ items, phase, examDate }: { items: LeagueLesson[]; phase: LeaguePhase; examDate: string | null }) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <ol aria-label={t('studentHome.league.track')} className="mt-3 flex flex-wrap items-center gap-1.5">
      {items.map((item) => <Pip key={item.id} item={item} />)}
      <FinalPip phase={phase} examDate={examDate} />
    </ol>
  );
}
