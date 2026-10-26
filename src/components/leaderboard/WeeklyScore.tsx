import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../lib/utils';
import { useT } from '../../lib/i18n/react';
import { SCORE_WEIGHTS, type WeeklyScore } from '../../lib/leaderboardScore';
import '@/lib/i18n/catalogs/attendance';

// A phone is 360 px wide: never wider than the screen minus the gutters.
const CONTENT_CLASS = 'w-[min(20rem,calc(100vw-1.5rem))] max-h-[70vh] overflow-y-auto p-3 text-xs leading-snug';

/**
 * A popover that opens on tap and, for a mouse, on hover. A click while it is open from hover pins it
 * (instead of closing it under the pointer); leaving a pinned one does nothing.
 */
function HoverPopover({ trigger, children, align = 'end' }: {
  trigger: (props: { onPointerEnter: (e: PointerEvent) => void; onPointerLeave: (e: PointerEvent) => void; onClick: (e: MouseEvent) => void }) => ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  return (
    <Popover open={open} onOpenChange={(next) => { pinned.current = next; setOpen(next); }}>
      <PopoverTrigger asChild>
        {trigger({
          onPointerEnter: (e) => { if (e.pointerType === 'mouse') setOpen(true); },
          onPointerLeave: (e) => { if (e.pointerType === 'mouse' && !pinned.current) setOpen(false); },
          // Radix skips its own toggle when the default is prevented.
          onClick: (e) => { if (open && !pinned.current) { e.preventDefault(); pinned.current = true; } },
        })}
      </PopoverTrigger>
      <PopoverContent align={align} collisionPadding={8} className={CONTENT_CLASS}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

const roundPercent = (value: number) => Math.round(value);

/** The percent cell's content: the number (or «—») as a button that shows the student's own sum. */
export function WeeklyScoreButton({ score, studentName, className }: {
  score: WeeklyScore;
  studentName: string;
  className?: string;
}) {
  const t = useT();
  const { attendance, homework, test, parts, percent } = score;
  const weight = (part: keyof typeof SCORE_WEIGHTS) => SCORE_WEIGHTS[part];

  return (
    <HoverPopover
      trigger={(handlers) => (
        <button
          type="button"
          {...handlers}
          aria-label={`${studentName}: ${percent === null ? '—' : `${percent}%`}. ${t('attendance.score.cellHint')}`}
          title={t('attendance.score.cellHint')}
          className={cn('w-full min-h-[2.5rem] cursor-pointer font-bold underline decoration-dotted decoration-current/40 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
        >
          {percent === null ? '—' : `${percent}%`}
        </button>
      )}
    >
      <div className="font-semibold text-sm mb-2 break-words">{studentName}</div>
      <ul className="space-y-1.5">
        <li className={cn(attendance.percent === null && 'text-muted-foreground')}>
          {attendance.percent === null
            ? t('attendance.score.attendanceNone')
            : t('attendance.score.attendance', {
                attended: attendance.attended,
                countable: attendance.countable,
                percent: roundPercent(attendance.percent),
                weight: weight('attendance'),
              })}
        </li>
        <li className={cn(homework.percent === null && 'text-muted-foreground')}>
          {homework.percent === null
            ? t('attendance.score.homeworkNone')
            : t('attendance.score.homework', { percent: roundPercent(homework.percent), weight: weight('homework') })}
        </li>
        <li className={cn(test.state === 'none' && 'text-muted-foreground')}>
          {test.state === 'scored'
            ? t('attendance.score.testScored', { percent: roundPercent(test.percent ?? 0), weight: weight('test') })
            : test.state === 'skipped'
              ? t('attendance.score.testSkipped', { weight: weight('test') })
              : t('attendance.score.testNone')}
        </li>
      </ul>
      <div className="mt-2 border-t border-border pt-2">
        <div className="font-semibold text-sm">
          {percent === null ? t('attendance.score.totalNone') : t('attendance.score.total', { percent })}
        </div>
        {parts.length > 0 && (
          <div className="mt-0.5 text-muted-foreground">
            {t('attendance.score.sum', {
              terms: parts.map((p) => `${roundPercent(p.percent)}×${p.weight}`).join(' + '),
              weights: parts.reduce((sum, p) => sum + p.weight, 0),
            })}
          </div>
        )}
      </div>
    </HoverPopover>
  );
}

/** The (i) beside the % header: what the three parts are and what is left out. */
export function WeeklyScoreExplainer() {
  const t = useT();
  return (
    <HoverPopover
      trigger={(handlers) => (
        <button
          type="button"
          {...handlers}
          aria-label={t('attendance.score.explainerOpen')}
          title={t('attendance.score.explainerOpen')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-4 w-4" />
        </button>
      )}
    >
      <div className="font-semibold text-sm mb-2">{t('attendance.score.explainerTitle')}</div>
      <p className="mb-1.5">{t('attendance.score.explainerIntro')}</p>
      <ul className="list-disc space-y-1.5 pl-4">
        <li>{t('attendance.score.explainerAttendance')}</li>
        <li>{t('attendance.score.explainerHomework')}</li>
        <li>{t('attendance.score.explainerTest')}</li>
      </ul>
      <p className="mt-2">{t('attendance.score.explainerLeftOut')}</p>
      <p className="mt-1.5">{t('attendance.score.explainerNoTest')}</p>
      <p className="mt-1.5 text-muted-foreground">{t('attendance.score.explainerNoData')}</p>
      <p className="mt-1.5 text-muted-foreground">{t('attendance.score.explainerStar')}</p>
    </HoverPopover>
  );
}
