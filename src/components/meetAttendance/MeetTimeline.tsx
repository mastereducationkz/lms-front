import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { barFor, clock, flagTone, position, verdictDiffers, verdictHint, verdictText, MARK_LABEL, type Axis } from '../../lib/meetAttendance';
import { registerNote } from '../../lib/meetRegister';
import type { MeetAccount, MeetFlag, MeetMark, MeetPresence, MeetVerdict } from '../../services/api/meetAttendance';
import type { StudentRegister } from '../../services/api/meetRegister';
import { FlagChip, type FlagReviewing } from './FlagReview';
import type { MessageKey } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

export { FlagChip };

export type RowKind = 'teacher' | 'student' | 'unknown' | 'other' | 'not_tracked';

export interface TimelineRow {
  key: string;
  name: string;
  kind: RowKind;
  /** The LMS person the row is; what a review of their flags is saved against. */
  userId?: number;
  /** Students only: the mark the teacher saved. */
  mark?: MeetMark;
  presence: MeetPresence;
  flags: MeetFlag[];
  accounts: MeetAccount[];
  /** A short second line, e.g. the person's role for "others". */
  note?: string;
  /** Students only: Meet's verdict under the rules (2026-09-16). */
  verdict?: MeetVerdict;
  /** Students only: what the register says about this student in this lesson (2026-09-23). */
  register?: StudentRegister | null;
}

const BAR: Record<RowKind, string> = {
  teacher: 'bg-violet-500 dark:bg-violet-400',
  student: 'bg-emerald-500 dark:bg-emerald-400',
  unknown: 'bg-amber-400 dark:bg-amber-500',
  other: 'bg-sky-500 dark:bg-sky-400',
  not_tracked: 'bg-slate-300 dark:bg-accent',
};

const MARK_CHIP: Record<string, string> = {
  present: 'bg-emerald-500 text-white',
  late: 'bg-amber-400 text-gray-900',
  absent: 'bg-rose-500 text-white',
  removed: 'bg-slate-300 dark:bg-border text-foreground',
};

function MarkChip({ mark }: { mark: MeetMark | undefined }) {
  const t = useT();
  const label = mark ? MARK_LABEL[mark] : t('meet.participants.notMarked');
  return (
    <span
      title={t('meetViews.timeline.markIs', { mark: label })}
      aria-label={t('meetViews.timeline.markIs', { mark: label })}
      className={cn(
        'inline-flex h-4 w-4 flex-none items-center justify-center rounded text-[9px] font-bold',
        mark ? MARK_CHIP[mark] : 'border border-dashed border-muted-foreground/40 text-muted-foreground',
      )}
    >
      {mark ? MARK_LABEL[mark][0] : '–'}
    </span>
  );
}

const VERDICT_TONE: Record<string, string> = {
  present: 'text-emerald-700 ring-emerald-300 dark:text-emerald-300 dark:ring-emerald-800',
  late: 'text-amber-800 ring-amber-300 dark:text-amber-300 dark:ring-amber-800',
  absent: 'text-rose-700 ring-rose-300 dark:text-rose-300 dark:ring-rose-800',
  unknown: 'text-muted-foreground ring-border',
};

/**
 * Meet's verdict beside the mark: a lettered square where the name column is narrow, words where
 * there is room. Outlined, so it never reads as a mark; «≠» when the two say different things.
 */
export function VerdictChip({ verdict, mark, compact = false }: { verdict: MeetVerdict; mark: MeetMark | undefined; compact?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const text = t('meetViews.verdict.meetSays', { verdict: verdictText(verdict, locale) });
  const differs = verdictDiffers(mark, verdict);
  const hint = verdictHint(verdict, locale);
  const versus = mark ? t('meetViews.timeline.markSays', { verdict: text, mark: MARK_LABEL[mark] }) : t('meetViews.timeline.markSaysNothing', { verdict: text });
  const title = [differs ? versus : text, hint].filter(Boolean).join('\n');
  const tone = VERDICT_TONE[verdict.verdict ?? 'unknown'];
  if (compact) {
    return (
      <span title={title} aria-label={title}
        className={cn('inline-flex h-4 w-4 flex-none items-center justify-center rounded text-[9px] font-bold ring-1 ring-inset',
          tone)}>
        {verdict.verdict ? MARK_LABEL[verdict.verdict][0] : verdict.provisional ? `${MARK_LABEL[verdict.provisional][0]}?` : '?'}
      </span>
    );
  }
  return (
    <span title={title}
      className={cn('inline-flex max-w-full items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium leading-4 ring-1 ring-inset', tone)}>
      {differs && <span aria-hidden>≠</span>}
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}

const KIND_LABEL: Record<MeetAccount['kind'], MessageKey> = {
  signed_in: 'meetViews.timeline.kindGoogle', guest: 'meetViews.timeline.kindGuest', phone: 'meetViews.timeline.kindPhone',
};

function Track({ axis, row, heldBack }: { axis: Axis; row: TimelineRow; heldBack: boolean }) {
  const t = useT();
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
          title={`${clock(span.joined_at)}–${span.left_at ? clock(span.left_at) : t('meet.strips.now')}`}
          className={cn('absolute inset-y-1 rounded-sm', BAR[row.kind])}
          style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
        />
      ))}
      {bars.length === 0 && (
        <span className="absolute inset-y-0 left-2 flex items-center text-[11px] text-muted-foreground">
          {/* While someone in the room is unconfirmed, "not in the room" may simply be untrue. */}
          {t(heldBack ? 'meetViews.timeline.noConfirmed' : 'meet.participants.notInRoom')}
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
  /** When set, flags the viewer may answer open the review form. */
  reviewing?: FlagReviewing;
}

/**
 * One row per person over the lesson's time. The shaded band is the lesson itself; bars are
 * the stretches each person was in the room (overlapping devices already merged).
 */
export function MeetTimeline({ axis, rows, compact = false, onUnlink, busy = false, heldBack = false, reviewing }: Props) {
  const t = useT();
  const locale = useLocale();
  const nameCol = compact ? '7.5rem' : 'minmax(9rem, 15rem)';
  return (
    <div role="table" aria-label={t('meetViews.timeline.table')} className="text-sm">
      <div role="row" className="grid items-end gap-x-3 pb-1" style={{ gridTemplateColumns: `${nameCol} 1fr` }}>
        <span role="columnheader" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t(compact ? 'meet.grid.person' : 'meetViews.timeline.personMark')}
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
              row.flags.some((f) => !f.review && flagTone(f.code) === 'mismatch') && 'bg-rose-50/50 dark:bg-rose-950/20',
            )}
            style={{ gridTemplateColumns: `${nameCol} 1fr` }}
          >
            <div role="cell" className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                {row.kind === 'student' && <MarkChip mark={row.mark} />}
                {row.kind === 'student' && compact && row.verdict && <VerdictChip verdict={row.verdict} mark={row.mark} compact />}
                {row.kind === 'unknown' && (
                  <span title={t('meetViews.shared.notConfirmedYet')} className="inline-flex h-4 w-4 flex-none items-center justify-center rounded bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">?</span>
                )}
                <span className={cn('truncate text-[13px]', row.kind === 'teacher' ? 'font-semibold' : 'font-medium')} title={row.name}>
                  {row.name}
                </span>
                {row.kind === 'teacher' && <span className="flex-none text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-300">{t('meet.participants.teacher')}</span>}
              </div>
              {row.note && <div className="truncate text-[11px] text-muted-foreground">{row.note}</div>}
              {row.kind === 'student' && !compact && row.verdict && (
                <div className="mt-1 flex"><VerdictChip verdict={row.verdict} mark={row.mark} /></div>
              )}
              {row.kind === 'student' && !compact && row.register && (
                <div className="mt-0.5 whitespace-pre-line text-[11px] leading-snug text-muted-foreground">
                  {registerNote(row.register, locale)}
                </div>
              )}
              {row.flags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.flags.map((f) => (
                    <FlagChip key={f.code} flag={f} userId={row.userId} personName={row.name} reviewing={reviewing}
                      lateToo={row.flags.some((g) => g.code === 'late')} />
                  ))}
                </div>
              )}
              {!compact && onUnlink && row.accounts.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.accounts.map((a) => (
                    <span key={a.participant_id} className="inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-px text-[11px] text-muted-foreground">
                      <span className="truncate">{t(KIND_LABEL[a.kind])} · {a.display_name || t('meetViews.timeline.noName')}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onUnlink(a.participant_id)}
                        aria-label={t('meetViews.timeline.forget', { name: row.name, account: a.display_name || t('meetViews.timeline.thisAccount') })}
                        title={t('meetViews.timeline.askAgain')}
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
