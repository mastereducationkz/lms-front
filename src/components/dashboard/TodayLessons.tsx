import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, Clock, RotateCw, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { clockKz, joinState } from '../../lib/classLessonPage';
import { lessonPath } from '../../lib/lessonLinks';
import { meetJoinUrl } from '../../lib/meetLinks';
import { formatDate, formatDateTime } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import { groupLine, lessonChips, todaySummary, type ChipTone, type TodayChip } from '../../lib/todayLessons';
import { getTodayLessons, type TodayLesson, type TodayLessons as TodayData } from '../../services/api/classLessons';

// The day moves on its own: a lesson starts, a register gets marked, a recording lands.
const REFRESH_MS = 60_000;

const CHIP_TONE: Record<ChipTone, string> = {
  action: 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/70',
  todo: 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/70',
  info: 'bg-sky-50 text-sky-800 ring-sky-200 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/70',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/70',
  muted: 'bg-muted text-muted-foreground ring-gray-200 dark:ring-border',
};

interface Props {
  role?: string | null;
  workspaceEmail?: string | null;
}

/**
 * «Today» on the teacher dashboard (owner, 2026-09-28): the day's lessons in order, each opening its lesson
 * page, with what it still needs as chips that lead to the right section — the register, scores,
 * homework, the recap — and «Join» once the room opens. Shown to anyone who teaches today; a teacher with
 * nothing today sees when the next lesson is.
 */
export default function TodayLessons({ role, workspaceEmail }: Props) {
  const locale = useLocale();
  const t = useT();
  const [data, setData] = useState<TodayData | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setData(await getTodayLessons());
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setNow(new Date());
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(tick, REFRESH_MS);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); };
  }, [load]);

  // Only people who teach need this card; everyone else sees nothing rather than an empty day.
  if (data && data.lessons.length === 0 && role !== 'teacher') return null;
  if (!data && !failed && role !== 'teacher') return null;

  const clock = (iso: string) => clockKz(iso, locale);
  const dateLabel = data ? formatDate(data.date, { weekday: 'long', day: 'numeric', month: 'long' }, locale) : '';

  return (
    <Card className="shadow-sm border border-border overflow-hidden" aria-labelledby="today-lessons-title" data-tour="today-lessons">
      <CardHeader className="px-4 sm:px-6 py-4 border-b border-border bg-card">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <div className="flex items-baseline gap-2">
            <CardTitle id="today-lessons-title" className="text-lg font-bold text-foreground">
              {t('teacher.today.title')}
            </CardTitle>
            {dateLabel && <span className="text-sm text-muted-foreground first-letter:uppercase">{dateLabel}</span>}
          </div>
          {data && data.lessons.length > 0 && (
            <p className="text-sm text-muted-foreground">{todaySummary(data.lessons, now, locale, clock)}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {failed && !data ? (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 text-sm text-muted-foreground">
            <span>{t('teacher.today.loadFailed')}</span>
            <button type="button" onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-foreground ring-1 ring-gray-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:ring-border">
              <RotateCw className="h-3.5 w-3.5" aria-hidden />{t('common.retry')}
            </button>
          </div>
        ) : !data ? (
          <ul aria-busy="true" className="divide-y divide-border">
            {[0, 1].map((i) => (
              <li key={i} className="flex gap-4 px-4 sm:px-6 py-4">
                <Skeleton className="h-9 w-12" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-5 w-1/2" /></div>
              </li>
            ))}
          </ul>
        ) : data.lessons.length === 0 ? (
          <EmptyDay data={data} locale={locale} />
        ) : (
          <ol className="py-1">
            {data.lessons.map((lesson, i) => (
              <LessonRow key={lesson.id} lesson={lesson} now={now} locale={locale} workspaceEmail={workspaceEmail}
                first={i === 0} last={i === data.lessons.length - 1} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function LessonRow({ lesson, now, locale, workspaceEmail, first, last }: {
  lesson: TodayLesson; now: Date; locale: 'ru' | 'en'; workspaceEmail?: string | null; first: boolean; last: boolean;
}) {
  const t = useT();
  const chips = lessonChips(lesson, locale);
  const join = joinState(lesson, now);
  const cancelled = lesson.status === 'cancelled';
  const live = lesson.status === 'live';
  return (
    <li className={cn(
      'group relative flex gap-3 sm:gap-4 px-4 sm:px-6 py-3 transition-colors hover:bg-gray-50 focus-within:bg-gray-50 dark:hover:bg-secondary/40 dark:focus-within:bg-secondary/40',
      live && 'bg-emerald-50/40 dark:bg-emerald-950/10',
    )}>
      <div className="w-12 shrink-0 pt-0.5 text-right tabular-nums">
        <div className={cn('text-sm font-semibold', cancelled ? 'text-gray-400 line-through dark:text-muted-foreground' : 'text-foreground')}>
          {clockKz(lesson.start, locale)}
        </div>
        <div className="text-xs text-muted-foreground">{clockKz(lesson.end, locale)}</div>
      </div>

      {/* The day as a line: one dot per lesson, the running one breathing. */}
      <div className="relative flex w-3 shrink-0 justify-center" aria-hidden>
        <span className={cn('absolute left-1/2 w-px -translate-x-1/2 bg-gray-200 dark:bg-border', first ? 'top-3' : '-top-3', last ? 'h-3' : '-bottom-3')} />
        <span className="relative mt-1.5 flex h-2.5 w-2.5">
          {live && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />}
          <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-card',
            live ? 'bg-emerald-500' : lesson.status === 'upcoming' ? 'bg-card ring-blue-500 dark:ring-brand'
              : cancelled ? 'bg-rose-300 dark:bg-rose-800' : lesson.done ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-secondary')} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          to={lessonPath(lesson.id)}
          className={cn(
            'block font-semibold leading-snug text-gray-900 outline-none after:absolute after:inset-0 after:content-[""] focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring dark:text-foreground',
            cancelled && 'text-gray-400 line-through dark:text-muted-foreground',
          )}
        >
          {groupLine(lesson, locale)}
          {live && <span className="ml-2 align-middle text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t('teacher.today.live')}</span>}
        </Link>
        {lesson.topic && <p className="mt-0.5 truncate text-sm text-muted-foreground">{lesson.topic}</p>}
        {chips.length > 0 && (
          <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
            {chips.map((chip) => <ChipView key={chip.key} chip={chip} lessonId={lesson.id} />)}
          </div>
        )}
        {/* On a phone the action sits under the chips, so the title keeps the full width. */}
        {join.kind !== 'hidden' && (
          <div className="relative z-10 mt-2.5 sm:hidden">
            <JoinAction join={join} url={lesson.join.url} workspaceEmail={workspaceEmail} locale={locale} wide />
          </div>
        )}
      </div>

      <div className="relative z-10 hidden shrink-0 items-start pt-0.5 sm:flex">
        <JoinAction join={join} url={lesson.join.url} workspaceEmail={workspaceEmail} locale={locale} />
      </div>
    </li>
  );
}

function JoinAction({ join, url, workspaceEmail, locale, wide = false }: {
  join: ReturnType<typeof joinState>; url: string | null; workspaceEmail?: string | null; locale: 'ru' | 'en'; wide?: boolean;
}) {
  const t = useT();
  return (
    <>
        {join.kind === 'open' ? (
          <a
            href={meetJoinUrl(url, workspaceEmail)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-card', wide && 'w-full py-2')}
          >
            <Video className="h-4 w-4" aria-hidden />{t('teacher.today.join')}
          </a>
        ) : join.kind === 'soon' ? (
          <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground', !wide && 'pt-1')}>
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {t('teacher.today.opensAt', { time: clockKz(join.opensAt, locale) })}
          </span>
        ) : wide ? null : (
          <ChevronRight className="mt-0.5 h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-muted-foreground" aria-hidden />
        )}
    </>
  );
}

function ChipView({ chip, lessonId }: { chip: TodayChip; lessonId: number }) {
  const className = cn(
    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
    CHIP_TONE[chip.tone],
  );
  const body = <>{chip.tone === 'done' && <Check className="h-3 w-3" aria-hidden />}{chip.label}</>;
  return chip.section ? (
    <Link to={lessonPath(lessonId, chip.section)}
      className={cn(className, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      {body}
    </Link>
  ) : (
    <span className={className}>{body}</span>
  );
}

function EmptyDay({ data, locale }: { data: TodayData; locale: 'ru' | 'en' }) {
  const t = useT();
  const next = data.next;
  const nextWhen = next ? formatDateTime(new Date(next.start), {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }, locale) : null;
  return (
    <div className="flex flex-col gap-3 px-4 sm:px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium text-foreground">{t('teacher.today.empty')}</p>
          {next && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t('teacher.today.next')}{' '}
              <Link to={lessonPath(next.id)} className="font-medium text-brand-subtle-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                {nextWhen}{next.groups.length ? ` · ${next.groups[0].replace(/\s+-\s+[^-]+$/, '')}` : ''}
              </Link>
            </p>
          )}
        </div>
      </div>
      <Link to="/calendar" className="self-start text-sm font-medium text-gray-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded sm:self-auto dark:text-foreground">
        {t('teacher.today.openCalendar')}
      </Link>
    </div>
  );
}
