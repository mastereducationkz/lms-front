import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { barFor, clock, flagText, flagTone, position, MARK_LABEL, type Axis } from '../../lib/meetAttendance';
import type { MeetAccount, MeetFlag, MeetMark, MeetPresence } from '../../services/api/meetAttendance';

export type RowKind = 'teacher' | 'student' | 'unknown' | 'other' | 'not_tracked';

export interface TimelineRow {
  key: string;
  name: string;
  kind: RowKind;
  /** Students only: the mark the teacher saved. */
  mark?: MeetMark;
  presence: MeetPresence;
  flags: MeetFlag[];
  accounts: MeetAccount[];
  /** A short second line, e.g. the person's role for "others". */
  note?: string;
}

const BAR: Record<RowKind, string> = {
  teacher: 'bg-violet-500 dark:bg-violet-400',
  student: 'bg-emerald-500 dark:bg-emerald-400',
  unknown: 'bg-amber-400 dark:bg-amber-500',
  other: 'bg-sky-500 dark:bg-sky-400',
  not_tracked: 'bg-slate-300 dark:bg-slate-600',
};

const MARK_CHIP: Record<string, string> = {
  present: 'bg-emerald-500 text-white',
  late: 'bg-amber-400 text-gray-900',
  absent: 'bg-rose-500 text-white',
  removed: 'bg-slate-300 text-slate-700',
};

function MarkChip({ mark }: { mark: MeetMark | undefined }) {
  const label = mark ? MARK_LABEL[mark] : 'Not marked';
  return (
    <span
      title={`Mark: ${label}`}
      aria-label={`Mark: ${label}`}
      className={cn(
        'inline-flex h-4 w-4 flex-none items-center justify-center rounded text-[9px] font-bold',
        mark ? MARK_CHIP[mark] : 'border border-dashed border-muted-foreground/40 text-muted-foreground',
      )}
    >
      {mark ? MARK_LABEL[mark][0] : '–'}
    </span>
  );
}

export function FlagChip({ flag }: { flag: MeetFlag }) {
  const tone = flagTone(flag.code);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-px text-[11px] font-medium leading-4',
        tone === 'mismatch'
          ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900'
          : 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900',
      )}
    >
      {flagText(flag)}
    </span>
  );
}

const KIND_LABEL: Record<MeetAccount['kind'], string> = { signed_in: 'Google', guest: 'Guest', phone: 'Phone' };

function Track({ axis, row, heldBack }: { axis: Axis; row: TimelineRow; heldBack: boolean }) {
  const bandLeft = position(axis, axis.lessonStart);
  const bandWidth = position(axis, axis.lessonEnd) - bandLeft;
  const bars = row.presence.sessions
    .map((span) => ({ span, bar: barFor(axis, span) }))
    .filter((b): b is { span: typeof b.span; bar: NonNullable<typeof b.bar> } => b.bar !== null);
  return (
    <div className="relative h-6 overflow-hidden rounded bg-muted/30">
      <div className="absolute inset-y-0 bg-muted/70" style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }} />
      {axis.ticks.map((t) => (
        <div key={t.at} className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${position(axis, t.at)}%` }} />
      ))}
      {bars.map(({ span, bar }) => (
        <div
          key={span.joined_at}
          title={`${clock(span.joined_at)}–${span.left_at ? clock(span.left_at) : 'now'}`}
          className={cn('absolute inset-y-1 rounded-sm', BAR[row.kind])}
          style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
        />
      ))}
      {bars.length === 0 && (
        <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-muted-foreground">
          {/* While someone in the room is unconfirmed, "not in the room" may simply be untrue. */}
          {heldBack ? 'No confirmed account yet' : 'Not in the room'}
        </span>
      )}
    </div>
  );
}

interface Props {
  axis: Axis;
  rows: TimelineRow[];
  compact?: boolean;
  /** When set, each linked account shows an × that makes it unknown again. */
  onUnlink?: (participantId: number) => void;
  busy?: boolean;
  /** Some account in the room is unconfirmed, so an empty row is "not known yet", not "absent". */
  heldBack?: boolean;
}

/**
 * One row per person over the lesson's time. The shaded band is the lesson itself; bars are
 * the stretches each person was in the room (overlapping devices already merged).
 */
export function MeetTimeline({ axis, rows, compact = false, onUnlink, busy = false, heldBack = false }: Props) {
  const nameCol = compact ? '7.5rem' : 'minmax(9rem, 15rem)';
  return (
    <div role="table" aria-label="Who was in the room, and when" className="text-sm">
      <div role="row" className="grid items-end gap-x-3 pb-1" style={{ gridTemplateColumns: `${nameCol} 1fr` }}>
        <span role="columnheader" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {compact ? 'Person' : 'Person · mark'}
        </span>
        <div role="columnheader" className="relative h-4">
          {axis.ticks.map((t) => (
            <span
              key={t.at}
              className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ left: `${position(axis, t.at)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <div
            role="row"
            key={row.key}
            className={cn(
              'grid items-center gap-x-3 py-1.5',
              row.flags.some((f) => flagTone(f.code) === 'mismatch') && 'bg-rose-50/50 dark:bg-rose-950/20',
            )}
            style={{ gridTemplateColumns: `${nameCol} 1fr` }}
          >
            <div role="cell" className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                {row.kind === 'student' && <MarkChip mark={row.mark} />}
                {row.kind === 'unknown' && (
                  <span title="Not confirmed yet" className="inline-flex h-4 w-4 flex-none items-center justify-center rounded bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">?</span>
                )}
                <span className={cn('truncate text-[13px]', row.kind === 'teacher' ? 'font-semibold' : 'font-medium')} title={row.name}>
                  {row.name}
                </span>
                {row.kind === 'teacher' && <span className="flex-none text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-300">Teacher</span>}
              </div>
              {row.note && <div className="truncate text-[11px] text-muted-foreground">{row.note}</div>}
              {row.flags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.flags.map((f) => <FlagChip key={f.code} flag={f} />)}
                </div>
              )}
              {!compact && onUnlink && row.accounts.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.accounts.map((a) => (
                    <span key={a.participant_id} className="inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-px text-[11px] text-muted-foreground">
                      <span className="truncate">{KIND_LABEL[a.kind]} · {a.display_name || 'no name'}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onUnlink(a.participant_id)}
                        aria-label={`Not ${row.name}: forget ${a.display_name || 'this account'}`}
                        title="Not this person — ask again"
                        className="rounded hover:text-foreground disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div role="cell">
              <Track axis={axis} row={row} heldBack={heldBack && (row.kind === 'student' || row.kind === 'teacher')} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
