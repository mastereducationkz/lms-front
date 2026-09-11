import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  clockTicks,
  formatDuration,
  minuteShade,
  percent,
  talkGrid,
  type TalkLocale,
} from '../../lib/meetTalk';
import type { TalkPerson, TalkRecord, TalkRole } from '../../services/api/meetTalk';

const TEXT = {
  en: {
    everyone: 'Whole class', notThisClass: 'not in this class',
    legend: 'Each strip is the lesson minute by minute; darker = more speech.',
    classLegend: 'Whole class: teacher at the bottom, students on top, empty = silence.',
    play: 'Click a minute to play it.',
    minute: (at: string, seconds: number) => (seconds > 0 ? `${at} · spoke ${formatDuration(seconds)}` : `${at} · said nothing`),
    classMinute: (at: string, t: number, s: number) => `${at} · teacher ${formatDuration(t)}, students ${formatDuration(s)}`,
    asked: (n: number) => `asked ${n}`, answered: (n: number) => `answered ${n}`,
    now: 'now',
  },
  ru: {
    everyone: 'Весь класс', notThisClass: 'не из этой группы',
    legend: 'Каждая полоса — урок по минутам; чем темнее, тем больше человек говорил.',
    classLegend: 'Весь класс: снизу преподаватель, сверху ученики, пусто — тишина.',
    play: 'Нажмите на минуту, чтобы включить запись с неё.',
    minute: (at: string, seconds: number) => (seconds > 0 ? `${at} · говорил ${formatDuration(seconds, 'ru')}` : `${at} · ничего не сказал`),
    classMinute: (at: string, t: number, s: number) => `${at} · преподаватель ${formatDuration(t, 'ru')}, ученики ${formatDuration(s, 'ru')}`,
    asked: (n: number) => `спросил ${n}`, answered: (n: number) => `ответил ${n}`,
    now: 'сейчас',
  },
} as const;

// Three shades per role for a minute: a few words, a sentence or two, most of the minute.
// Written out whole so Tailwind keeps every class.
const SHADE: Record<TalkRole, string[]> = {
  teacher: ['', 'bg-violet-400/35 dark:bg-violet-400/30', 'bg-violet-500/65 dark:bg-violet-400/60', 'bg-violet-600 dark:bg-violet-400'],
  student: ['', 'bg-emerald-400/40 dark:bg-emerald-400/30', 'bg-emerald-500/70 dark:bg-emerald-400/60', 'bg-emerald-600 dark:bg-emerald-400'],
  unknown: ['', 'bg-amber-300/60 dark:bg-amber-400/30', 'bg-amber-400 dark:bg-amber-400/60', 'bg-amber-600 dark:bg-amber-400'],
  other: ['', 'bg-sky-400/40 dark:bg-sky-400/30', 'bg-sky-500/70 dark:bg-sky-400/60', 'bg-sky-600 dark:bg-sky-400'],
};

const DOT: Record<TalkRole, string> = {
  teacher: 'bg-violet-500', student: 'bg-emerald-500', unknown: 'bg-amber-500', other: 'bg-sky-500',
};

interface Props {
  talk: TalkRecord;
  locale: TalkLocale;
  /** Where the video is, in lesson seconds; null or undefined draws no playhead. */
  playhead?: number | null;
  /** When given, clicking a minute plays it: lesson seconds of that minute's start, and whose strip it was (null: the class). */
  onSeek?: (lessonSeconds: number, key: string | null) => void;
  className?: string;
}

/**
 * Who spoke when, for a narrow column: the whole class minute by minute, then one strip per person
 * under their full name and total — no name is cut, nothing scrolls sideways. The video's position
 * runs through every strip; clicking a minute plays it.
 */
export function TalkStrips({ talk, locale, playhead, onSeek, className }: Props) {
  const t = TEXT[locale];
  const grid = useMemo(() => talkGrid(talk, 60), [talk]);
  const n = grid.columns.length;
  const from = grid.columns[0]?.from ?? 0;
  const to = grid.columns[n - 1]?.to ?? 0;
  const ticks = useMemo(() => clockTicks(talk.start, from, to), [talk.start, from, to]);
  if (n === 0) return null;

  const at = (seconds: number) => ((seconds - from) / (to - from)) * 100;
  const now = playhead != null && playhead >= from && playhead <= to ? at(playhead) : null;
  const peak = Math.max(60, ...grid.teacher.map((x, i) => x + grid.students[i]));
  const seek = (i: number, key: string | null) => onSeek?.(grid.columns[i].from, key);

  const marker = now != null && (
    <span aria-hidden className="pointer-events-none absolute inset-y-[-2px] w-0.5 -translate-x-1/2 rounded-full bg-rose-500 shadow-[0_0_0_1px_hsl(var(--background))]"
      style={{ left: `${now}%` }} />
  );

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* The clock, over the same width as every strip. */}
      <div className="relative h-4 text-[10px] tabular-nums text-muted-foreground" aria-hidden>
        {ticks.map((tick) => (
          <span key={tick.at}
            // A clock label the «now» pill would sit on is hidden while it does.
            className={cn('absolute top-0 -translate-x-1/2 whitespace-nowrap', now != null && Math.abs(at(tick.at) - now) < 8 && 'invisible')}
            style={{ left: `${Math.min(97, Math.max(3, at(tick.at)))}%` }}>
            {tick.label}
          </span>
        ))}
        {now != null && (
          // Centred on the playhead, but kept inside the column at either end.
          <span className={cn('absolute -top-0.5 rounded bg-rose-500 px-1 text-[9px] font-semibold uppercase leading-4 text-white',
            now < 6 ? 'translate-x-0' : now > 94 ? '-translate-x-full' : '-translate-x-1/2')}
            style={{ left: `${now}%` }}>
            {t.now}
          </span>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-foreground">{t.everyone}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {percent(talk.teacher_share)} / {percent(talk.students_share)}
          </span>
        </div>
        <div className="relative flex h-7 items-end gap-px rounded-sm bg-muted/40" role="img" aria-label={t.classLegend}>
          {grid.teacher.map((teacher, i) => {
            const students = grid.students[i];
            return (
              <span key={i} title={t.classMinute(grid.columns[i].label, teacher, students)}
                onClick={onSeek ? () => seek(i, null) : undefined}
                className={cn('flex h-full min-w-0 flex-1 flex-col justify-end', onSeek && 'cursor-pointer hover:bg-foreground/5')}>
                <span className="bg-emerald-500 dark:bg-emerald-400" style={{ height: `${(students / peak) * 100}%` }} />
                <span className="bg-violet-500 dark:bg-violet-400" style={{ height: `${(teacher / peak) * 100}%` }} />
              </span>
            );
          })}
          {marker}
        </div>
      </div>

      <ul className="flex flex-col gap-2.5">
        {grid.rows.map(({ person, cells }) => (
          <li key={person.key}>
            <PersonLine person={person} locale={locale} />
            <div className="relative mt-1 flex h-2.5 gap-px overflow-visible rounded-sm bg-muted/70" role="img"
              aria-label={`${person.name}: ${formatDuration(person.seconds, locale)}`}>
              {cells.map((seconds, i) => {
                const shade = minuteShade(seconds);
                return (
                  <span key={i} title={t.minute(grid.columns[i].label, seconds)}
                    onClick={onSeek ? () => seek(i, person.key) : undefined}
                    className={cn('h-full min-w-0 flex-1 first:rounded-l-sm last:rounded-r-sm', shade ? SHADE[person.role][shade] : '',
                      onSeek && 'cursor-pointer hover:outline hover:outline-1 hover:outline-foreground/40')} />
                );
              })}
              {marker}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        <span className="inline-flex flex-wrap items-center gap-1">
          {t.legend}
          <span className="ml-1 inline-flex items-center gap-0.5" aria-hidden>
            {[1, 2, 3].map((s) => <span key={s} className={cn('h-2.5 w-3 rounded-[2px]', SHADE.student[s])} />)}
          </span>
        </span>
        <span>{t.classLegend}</span>
        {onSeek && <span>{t.play}</span>}
      </div>
    </div>
  );
}

function PersonLine({ person, locale }: { person: TalkPerson; locale: TalkLocale }) {
  const t = TEXT[locale];
  const extra = [
    person.questions != null ? t.asked(person.questions) : null,
    person.answers != null ? t.answered(person.answers) : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className={cn('relative top-[-1px] h-2 w-2 flex-none rounded-full', DOT[person.role])} aria-hidden />
        <span className={cn('break-words text-[13px] leading-snug text-foreground', person.role === 'teacher' ? 'font-semibold' : 'font-medium')}>
          {person.name}
          {person.role === 'other' && <span className="font-normal text-muted-foreground"> · {t.notThisClass}</span>}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs tabular-nums">
        <span className="font-semibold text-foreground">{formatDuration(person.seconds, locale)}</span>
        {person.role !== 'other' && <span className="text-muted-foreground"> · {percent(person.share)}</span>}
        {extra && <span className="block text-[11px] text-muted-foreground">{extra}</span>}
      </span>
    </div>
  );
}
