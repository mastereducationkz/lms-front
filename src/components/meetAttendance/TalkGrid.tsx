import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  blockShade,
  blockTime,
  formatDuration,
  percent,
  talkGrid,
  type TalkLocale,
} from '../../lib/meetTalk';
import { columnAt } from '../../lib/transcriptFollow';
import type { TalkRecord, TalkRole } from '../../services/api/meetTalk';

/** One block picked in the grid: a person's (or, with key null, the class's) five minutes. */
export interface TalkFocus {
  key: string | null;
  name: string;
  from: number;
  to: number;
  /** "20:15–20:20" on the Almaty clock. */
  label: string;
}

const TEXT = {
  en: {
    person: 'Person', total: 'Total', everyone: 'Whole class',
    teacher: 'teacher', students: 'students', silence: 'silence',
    legend: (minutes: number) => `Each block is ${minutes} minutes; the darker it is, the longer that person spoke in it.`,
    classKey: 'Whole class:', rest: 'the rest is silence',
    pick: 'Click a block to read what was said then.',
    pickPlay: 'Click a block to play it and read what was said.',
    now: 'the video is here',
    few: 'a few words', long: '2½ min or more',
    said: (name: string, range: string, time: string) => `${name} · ${range} · spoke ${time}`,
    quiet: (name: string, range: string) => `${name} · ${range} · said nothing`,
    class: (range: string, t: string, s: string, q: string) => `${range} · teacher ${t}, students ${s}, silence ${q}`,
  },
  ru: {
    person: 'Кто', total: 'Всего', everyone: 'Весь класс',
    teacher: 'преподаватель', students: 'ученики', silence: 'тишина',
    legend: (minutes: number) => `Каждый блок — ${minutes} минут; чем темнее, тем дольше человек говорил в нём.`,
    classKey: 'Весь класс:', rest: 'остальное — тишина',
    pick: 'Нажмите на блок, чтобы прочитать, что было сказано.',
    pickPlay: 'Нажмите на блок, чтобы включить его и прочитать, что было сказано.',
    now: 'видео здесь',
    few: 'пара слов', long: '2½ мин и больше',
    said: (name: string, range: string, time: string) => `${name} · ${range} · говорил ${time}`,
    quiet: (name: string, range: string) => `${name} · ${range} · ничего не сказал`,
    class: (range: string, t: string, s: string, q: string) => `${range} · преподаватель ${t}, ученики ${s}, тишина ${q}`,
  },
} as const;

// Five shades per role, lightest to darkest. Written out whole so Tailwind keeps every class.
const SHADE: Record<TalkRole, string[]> = {
  teacher: ['', 'bg-violet-500/15 dark:bg-violet-400/20', 'bg-violet-500/30 dark:bg-violet-400/35', 'bg-violet-500/50 dark:bg-violet-400/50', 'bg-violet-500/75 dark:bg-violet-400/75', 'bg-violet-600 dark:bg-violet-400'],
  student: ['', 'bg-emerald-500/15 dark:bg-emerald-400/20', 'bg-emerald-500/30 dark:bg-emerald-400/35', 'bg-emerald-500/50 dark:bg-emerald-400/50', 'bg-emerald-500/75 dark:bg-emerald-400/75', 'bg-emerald-600 dark:bg-emerald-400'],
  unknown: ['', 'bg-amber-400/20 dark:bg-amber-400/20', 'bg-amber-400/35 dark:bg-amber-400/35', 'bg-amber-400/55 dark:bg-amber-400/50', 'bg-amber-500/80 dark:bg-amber-400/75', 'bg-amber-600 dark:bg-amber-400'],
  other: ['', 'bg-sky-500/15 dark:bg-sky-400/20', 'bg-sky-500/30 dark:bg-sky-400/35', 'bg-sky-500/50 dark:bg-sky-400/50', 'bg-sky-500/75 dark:bg-sky-400/75', 'bg-sky-600 dark:bg-sky-400'],
};

const INK: Record<TalkRole, string> = {
  teacher: 'text-violet-800 dark:text-violet-200',
  student: 'text-emerald-800 dark:text-emerald-200',
  unknown: 'text-amber-800 dark:text-amber-200',
  other: 'text-sky-800 dark:text-sky-200',
};

// On a phone the blocks scroll sideways; the names stay put.
// Full height, and a shadow in the page colour over the gap beside it, so nothing peeks through.
const STICKY = 'max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:self-stretch max-sm:bg-background '
  + 'max-sm:shadow-[6px_0_0_hsl(var(--background))]';
// A side panel is narrow at every screen size.
const STICKY_ALWAYS = 'sticky left-0 z-10 self-stretch bg-background shadow-[6px_0_0_hsl(var(--background))]';

const DOT: Record<TalkRole, string> = {
  teacher: 'bg-violet-500', student: 'bg-emerald-500', unknown: 'bg-amber-500', other: 'bg-sky-500',
};

interface Props {
  talk: TalkRecord;
  locale: TalkLocale;
  /** The block whose words the transcript is showing, if any. */
  focus?: TalkFocus | null;
  /** When given, blocks are buttons: picking one shows what was said in it. */
  onPick?: (focus: TalkFocus | null) => void;
  /** Where the video is, in lesson seconds: its block column is marked. Beside a player only. */
  playhead?: number | null;
  /** Picking a block also plays the video from it (the legend says so). */
  plays?: boolean;
  /** A narrow side panel: slimmer blocks without their times (still in each block's tooltip). */
  dense?: boolean;
}

/**
 * Who spoke when, as a table: a row per person, a column per five minutes, each block shaded by
 * how long that person spoke in it — and saying it, «1:40». The top row is the whole class:
 * teacher and students against the silence. The exact stretches are one toggle away.
 */
export function TalkGrid({ talk, locale, focus, onPick, playhead, plays = false, dense = false }: Props) {
  const t = TEXT[locale];
  const grid = useMemo(() => talkGrid(talk), [talk]);
  const n = grid.columns.length;
  const nowColumn = columnAt(grid.columns, playhead);
  if (n === 0) return null;
  const range = (i: number) => `${grid.columns[i].label}–${grid.columns[i + 1]?.label ?? blockEnd(grid.columns[i].label, grid.binSeconds)}`;
  // A side panel is ~30rem wide: slim blocks and tight gaps keep a lesson's blocks and the totals
  // in view without scrolling sideways.
  const template = dense
    ? `minmax(5rem, 7.5rem) repeat(${n}, minmax(0.9rem, 1fr)) minmax(3.75rem, auto)`
    : `minmax(6.5rem, 12rem) repeat(${n}, minmax(2.5rem, 1fr)) minmax(5.5rem, auto)`;
  // Label every block when there is room, every other one on a narrow screen (always in a side
  // panel). Invisible, not hidden: a hidden label would leave the grid and pull the next ones
  // into its column. The block the video is in keeps its label.
  const labelled = (i: number) => (i === nowColumn ? ''
    : dense ? (i % 3 === 0 && Math.abs(i - nowColumn) > 1 ? '' : 'invisible')
      : i % 2 === 0 ? '' : 'invisible sm:visible');
  const sticky = dense ? STICKY_ALWAYS : STICKY;

  const cell = (key: string | null, name: string, i: number, body: React.ReactNode, title: string, className: string) => {
    const picked = focus && focus.key === key && focus.from === grid.columns[i].from;
    const now = i === nowColumn;
    const common = cn('relative flex h-7 items-center justify-center rounded-[5px] text-[10px] font-semibold tabular-nums', className,
      // The block the video is in: a frame drawn by a pseudo-element, clear of the ring a picked block wears.
      now && !picked && "after:pointer-events-none after:absolute after:-inset-[3px] after:rounded-[7px] after:border after:border-primary/60 after:content-['']",
      picked && 'ring-2 ring-foreground ring-offset-1 ring-offset-background');
    if (!onPick) return <div key={i} role="cell" title={title} className={common}>{body}</div>;
    return (
      <button
        key={i}
        type="button"
        role="cell"
        title={title}
        aria-pressed={Boolean(picked)}
        onClick={() => onPick(picked ? null : { key, name, from: grid.columns[i].from, to: grid.columns[i].to, label: range(i) })}
        className={cn(common, 'transition hover:ring-2 hover:ring-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
      >
        {body}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <div role="table" aria-label={t.everyone} className={cn('grid items-center gap-y-1', dense ? 'min-w-[20rem] gap-x-0.5' : 'min-w-[36rem] gap-x-1')} style={{ gridTemplateColumns: template }}>
          <div role="row" className="contents">
            <span role="columnheader" className={cn(sticky, 'flex items-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground')}>{t.person}</span>
            {grid.columns.map((c, i) => (
              <span key={c.from} role="columnheader" title={i === nowColumn ? t.now : undefined}
                className={cn('text-[10px] tabular-nums', labelled(i),
                  // Slim side-panel columns: a label starts at its block and runs over the unlabelled ones after it.
                  dense ? 'whitespace-nowrap text-left' : 'text-center',
                  i === nowColumn ? 'font-bold text-primary' : 'text-muted-foreground')}>
                {c.label}
              </span>
            ))}
            <span role="columnheader" className="pl-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.total}</span>
          </div>

          {/* The whole class: teacher over students; the rest of the block is silence. */}
          <div role="row" className="contents">
            <span role="rowheader" className={cn(sticky, 'flex items-center truncate pr-1 text-xs font-semibold text-foreground')}>{t.everyone}</span>
            {grid.teacher.map((teacher, i) => {
              const students = grid.students[i];
              const quiet = Math.max(0, grid.binSeconds - teacher - students);
              return cell(null, t.everyone, i, (
                <span className="absolute inset-0.5 flex flex-col justify-end overflow-hidden rounded-[4px] bg-muted/60">
                  <span className="bg-emerald-500 dark:bg-emerald-400" style={{ height: `${Math.min(100, (students / grid.binSeconds) * 100)}%` }} />
                  <span className="bg-violet-500 dark:bg-violet-400" style={{ height: `${Math.min(100, (teacher / grid.binSeconds) * 100)}%` }} />
                </span>
              ), t.class(range(i), formatDuration(teacher, locale), formatDuration(students, locale), formatDuration(quiet, locale)), '');
            })}
            <span className="pl-2 text-right text-[11px] tabular-nums text-muted-foreground">
              {percent(talk.teacher_share)} / {percent(talk.students_share)}
            </span>
          </div>

          {grid.rows.map(({ person, cells }) => (
            <div key={person.key} role="row" className="contents">
              <span role="rowheader" className={cn(sticky, 'flex min-w-0 items-center gap-1.5 pr-1')} title={person.name}>
                <span className={cn('h-2 w-2 flex-none rounded-full', DOT[person.role])} aria-hidden />
                <span className={cn('truncate text-xs', person.role === 'teacher' ? 'font-semibold' : 'font-medium')}>{person.name}</span>
              </span>
              {cells.map((seconds, i) => {
                const shade = blockShade(seconds, grid.binSeconds);
                return cell(person.key, person.name, i,
                  shade > 0 && !dense && <span className="hidden sm:inline">{blockTime(seconds)}</span>,
                  seconds > 0 ? t.said(person.name, range(i), blockTime(seconds)) : t.quiet(person.name, range(i)),
                  cn(shade > 0 ? SHADE[person.role][shade] : 'bg-muted/30',
                    shade >= 4 ? 'text-white dark:text-gray-950' : INK[person.role]));
              })}
              <span className="pl-2 text-right text-xs tabular-nums">
                <span className="font-semibold text-foreground">{formatDuration(person.seconds, locale)}</span>
                {person.role !== 'other' && <span className="text-muted-foreground"> · {percent(person.share)}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{t.legend(grid.binSeconds / 60)}</span>
        <span className="inline-flex items-center gap-1" aria-hidden>
          {t.few}
          {[1, 2, 3, 4, 5].map((s) => <span key={s} className={cn('h-3 w-4 rounded-[3px]', SHADE.student[s])} />)}
          {t.long}
        </span>
        <span className="inline-flex items-center gap-1" aria-hidden>
          {t.classKey}
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500 dark:bg-violet-400" /> {t.teacher}
          <span className="ml-1 h-2.5 w-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" /> {t.students},
          <span>{t.rest}</span>
        </span>
        {onPick && <span>{plays ? t.pickPlay : t.pick}</span>}
      </div>
    </div>
  );
}

/** The last block's end: its start plus the block's length, on the same clock. */
function blockEnd(label: string, binSeconds: number): string {
  const [h, m] = label.split(':').map(Number);
  const total = (h * 60 + m + binSeconds / 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
