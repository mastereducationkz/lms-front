/**
 * The matchday track: one pip per lesson of the season, ending in a trophy for The Final. Gold with
 * a tick = attended, a hollow dash = missed, a dashed ring = not marked yet, a pulsing gold ring =
 * today, a quiet ring = still to come. The number sits in every pip that isn't ticked, and every pip
 * has its words for a screen reader (matchday, state, and the day for the ones to come).
 *
 * A studio season reads the same row as a tracklist: square-cornered track numbers in the group's
 * colours, ending in a record for Release Day.
 */
import { Check, Disc3, Minus, Trophy } from 'lucide-react';
import { pipLabel } from '@/lib/leagueSeason';
import { themedKey } from '@/lib/leagueTheme';
import { formatDate } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import type { LeagueLesson, LeaguePhase } from '@/services/api/masterLeague';
import { FOOTBALL_LOOK, type LeagueLook } from './leagueLook';
import '@/lib/i18n/catalogs/studentHome';

const pipSize = (look: LeagueLook) =>
  `flex h-[22px] w-[22px] shrink-0 items-center justify-center ${look.pipShape} text-[10px] font-bold tabular-nums @lg:h-6 @lg:w-6`;

/** A pip is its own list item; inside the studio's last pair it is a span that keeps the list-item role. */
type PipTag = 'li' | 'span';

function Pip({ item, look, as: Tag = 'li' }: { item: LeagueLesson; look: LeagueLook; as?: PipTag }) {
  const locale = useLocale();
  const label = pipLabel(item, locale, look.theme);
  return (
    <Tag title={label} role={Tag === 'span' ? 'listitem' : undefined} className={`${pipSize(look)} ${look.pip[item.state]}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex items-center justify-center">
        {item.state === 'attended' ? <Check className="h-3 w-3" strokeWidth={3.4} /> : item.state === 'missed' ? <Minus className="h-3 w-3" strokeWidth={3} /> : item.number}
      </span>
    </Tag>
  );
}

/** The end of the track: quiet until the exam, pulsing on the day, lit once it has happened. */
function FinalPip({ phase, examDate, look, as: Tag = 'li' }: { phase: LeaguePhase; examDate: string | null; look: LeagueLook; as?: PipTag }) {
  const t = useT();
  const locale = useLocale();
  const label = examDate
    ? t(themedKey('studentHome.league.pip.finalOn', look.theme), { date: formatDate(examDate, { day: 'numeric', month: 'short' }, locale) })
    : t(themedKey('studentHome.league.pip.final', look.theme));
  const style = phase === 'after' ? look.pipEnd.done : phase === 'exam_day' ? look.pipEnd.today : look.pipEnd.ahead;
  const Icon = look.theme === 'studio' ? Disc3 : Trophy;
  return (
    <Tag title={label} role={Tag === 'span' ? 'listitem' : undefined} className={`${pipSize(look)} ml-1 ${style}`}>
      <span className="sr-only">{label}</span>
      <Icon aria-hidden className="h-3 w-3" strokeWidth={2.6} />
    </Tag>
  );
}

export default function LeagueTrack({ items, phase, examDate, look = FOOTBALL_LOOK }: {
  items: LeagueLesson[]; phase: LeaguePhase; examDate: string | null; look?: LeagueLook;
}) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <ol aria-label={t(themedKey('studentHome.league.track', look.theme))} className="mt-3 flex flex-wrap items-center gap-1.5">
      {look.theme === 'studio' ? (
        <>
          {items.slice(0, -1).map((item) => <Pip key={item.id} item={item} look={look} />)}
          {/* the last track and Release Day never part: on a phone the record does not wrap onto a row of its own */}
          <li role="none" className="flex shrink-0 items-center gap-1.5">
            <Pip item={items[items.length - 1]} look={look} as="span" />
            <FinalPip phase={phase} examDate={examDate} look={look} as="span" />
          </li>
        </>
      ) : (
        <>
          {items.map((item) => <Pip key={item.id} item={item} look={look} />)}
          <FinalPip phase={phase} examDate={examDate} look={look} />
        </>
      )}
    </ol>
  );
}
