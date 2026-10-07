import { useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  classOrder,
  clock,
  flagText,
  isMismatch,
  markLabel,
  reasonText,
  verdictDiffers,
  verdictHint,
  verdictText,
  type ParticipantRow,
  type ParticipantsView,
} from '../../lib/meetAttendance';
import { t, type Locale, type MessageKey } from '../../lib/i18n';
import { useLocale } from '../../lib/i18n/react';
import type { MeetFlag, MeetMark, MeetWaitingStage } from '../../services/api/meetAttendance';

const STAGE: Record<MeetWaitingStage, MessageKey> = {
  lesson_running: 'meet.participants.stageLessonRunning',
  call_open: 'meet.participants.stageCallOpen',
  collecting: 'meet.participants.stageCollecting',
  awaiting_google: 'meet.participants.stageAwaitingGoogle',
  settling: 'meet.participants.stageSettling',
};

const ROLE: Record<string, MessageKey> = {
  curator: 'meet.webinar.roleCurator',
  head_curator: 'meet.webinar.roleHeadCurator',
  teacher: 'meet.webinar.roleTeacher',
  head_teacher: 'meet.webinar.roleHeadTeacher',
  admin: 'meet.webinar.roleAdmin',
};

const MARK_CHIP: Record<Exclude<MeetMark, null>, string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  late: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  absent: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  removed: 'bg-muted text-muted-foreground',
};

function Mark({ mark, locale }: { mark: MeetMark; locale: Locale }) {
  if (!mark) {
    return <span className="inline-flex rounded border border-dashed border-muted-foreground/40 px-1.5 py-px text-[11px] text-muted-foreground">{t('meet.participants.notMarked', undefined, locale)}</span>;
  }
  return (
    <span className={cn('inline-flex rounded px-1.5 py-px text-[11px] font-medium', MARK_CHIP[mark])}>
      {markLabel(mark, locale)}
    </span>
  );
}

const isOpenMismatch = (flag: MeetFlag) => isMismatch(flag.code) && !flag.review;

/** A flag, and once someone answered it, the answer on its own line — in words an accountant can read. */
function Flag({ flag, locale }: { flag: MeetFlag; locale: Locale }) {
  const reviewed = t('meet.participants.reviewed', undefined, locale);
  const reason = reasonText(flag.review);
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-0.5">
      <span className={cn(
        'inline-flex max-w-full items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium leading-4 ring-1 ring-inset',
        flag.review
          ? 'bg-muted text-muted-foreground ring-border'
          : isMismatch(flag.code)
            ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900'
            : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900',
      )}>
        {flag.review && <Check className="h-3 w-3 flex-none" aria-label={reviewed} />}
        <span className="min-w-0">{flagText(flag, locale)}</span>
      </span>
      {flag.review && (
        <span className="px-0.5 text-[11px] leading-snug text-muted-foreground">
          {reason ? t('meet.participants.reason', { reason }, locale) : reviewed}
        </span>
      )}
    </span>
  );
}

function Stretch({ row, locale, heldBack }: { row: Pick<ParticipantRow, 'first_join' | 'last_leave' | 'minutes_in_lesson' | 'joins'>; locale: Locale; heldBack: boolean }) {
  if (!row.first_join) {
    return <span className="text-muted-foreground">{t(heldBack ? 'meet.participants.noAccount' : 'meet.participants.notInRoom', undefined, locale)}</span>;
  }
  return (
    <span className="tabular-nums">
      {clock(row.first_join)}–{clock(row.last_leave)}
      <span className="text-muted-foreground"> · {t('meet.duration.minutes', { minutes: row.minutes_in_lesson }, locale)}
        {row.joins > 1 ? ` · ${t('meet.participants.joins', { count: row.joins }, locale)}` : ''}</span>
    </span>
  );
}

interface Props {
  view: ParticipantsView;
  /** The signed-in user's by default; the watch-link page, read by accountants, passes 'ru'. */
  locale?: Locale;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * The class beside a recording: how many of the lesson's students were in the room, and — on
 * request — every one of them with their mark, their time in the room and what stands out.
 * Without a Meet record it is still the whole class with marks, which is what an accountant
 * checking a lesson needs either way.
 */
export function ParticipantsPanel({ view, locale: forced, defaultOpen = false, className }: Props) {
  const userLocale = useLocale();
  const locale = forced ?? userLocale;
  const say = (key: MessageKey, params?: Record<string, string | number>) => t(key, params, locale);
  const [open, setOpen] = useState(defaultOpen);
  if (view.kind === 'webinar') {
    return <WebinarAudience view={view} locale={locale} open={open} onToggle={() => setOpen((v) => !v)} className={className} />;
  }
  const ready = view.state === 'ready';
  const students = classOrder(view.students);
  const joined = students.filter((s) => s.first_join).length;
  // Answered disagreements are not "disagreeing" any more — they are counted apart, with their reasons below.
  const disagree = students.filter((s) => s.flags.some(isOpenMismatch)).length;
  const explained = students.filter((s) => !s.flags.some(isOpenMismatch) && s.flags.some((f) => f.review && isMismatch(f.code))).length;

  const summary = ready
    ? [
        say('meet.participants.inRoom', { joined, count: students.length }),
        view.teacher?.first_join
          ? say('meet.participants.teacherTime', { from: clock(view.teacher.first_join), to: clock(view.teacher.last_leave) }) : null,
        disagree ? say('meet.participants.disagree', { count: disagree }) : null,
        explained ? say('meet.participants.explained', { count: explained }) : null,
      ].filter(Boolean).join(' · ')
    : say('meet.participants.classSize', { count: students.length });
  const note = !ready
    ? (view.waiting ? `${say(STAGE[view.waiting.stage])} ${say('meet.participants.untilThen')}`
      : view.state === 'waiting' || view.state === 'not_started' ? say('meet.participants.waiting') : say('meet.participants.noMeet'))
    : view.held_back ? say('meet.participants.heldBack') : view.partial ? say('meet.participants.partial') : null;
  const title = say('meet.participants.title');

  if (students.length === 0 && !view.teacher && view.unknown.length === 0) return null;

  return (
    <section className={cn('rounded-xl border border-border bg-card', className)} aria-label={title}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <Users className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className={cn('text-sm', disagree ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>{summary}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {say(open ? 'meet.participants.hide' : 'meet.participants.show')}
          <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} aria-hidden />
        </button>
      </div>
      {note && <p className="px-4 pb-3 text-xs text-muted-foreground">{note}</p>}

      {open && (
        <div className="border-t border-border text-sm">
          {view.teacher && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/30 px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">{say('meet.participants.teacher')}</span>
              <span className="font-medium text-foreground">{view.teacher.name}</span>
              <Stretch row={view.teacher} locale={locale} heldBack={view.held_back} />
              {view.teacher.flags.map((f) => <Flag key={f.code} flag={f} locale={locale} />)}
            </div>
          )}

          <div role="table" aria-label={title}>
            <div role="row" className={cn(
              'hidden gap-x-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid',
              ready ? 'sm:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1.3fr)_minmax(0,1.5fr)]' : 'sm:grid-cols-[minmax(0,1.5fr)_7.5rem]',
            )}>
              <span role="columnheader">{say('meet.participants.student')}</span>
              <span role="columnheader">{say('meet.participants.mark')}</span>
              {ready && <span role="columnheader">{say('meet.participants.room')}</span>}
              {ready && <span role="columnheader">{say('meet.participants.notes')}</span>}
            </div>
            <div className="divide-y divide-border/70">
              {students.map((s, i) => (
                <div
                  role="row"
                  key={`${s.name}-${i}`}
                  className={cn(
                    'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2',
                    ready ? 'sm:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1.3fr)_minmax(0,1.5fr)]' : 'sm:grid-cols-[minmax(0,1.5fr)_7.5rem]',
                    s.flags.some(isOpenMismatch) && 'bg-rose-50/60 dark:bg-rose-950/20',
                  )}
                >
                  <span role="cell" className={cn('truncate', s.first_join || !ready ? 'text-foreground' : 'text-muted-foreground')} title={s.name}>{s.name}</span>
                  <span role="cell" className="flex flex-col items-start gap-0.5">
                    <Mark mark={s.mark} locale={locale} />
                    {/* Staff pages only: the watch-link page's view never carries a verdict. */}
                    {s.verdict && (
                      <span title={verdictHint(s.verdict, locale) ?? undefined}
                        className={cn('text-[10px] leading-tight', verdictDiffers(s.mark, s.verdict) ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
                        Meet: {verdictText(s.verdict, locale)}
                      </span>
                    )}
                  </span>
                  {ready && <span role="cell" className="col-span-2 text-[13px] sm:col-span-1"><Stretch row={s} locale={locale} heldBack={view.held_back} /></span>}
                  {ready && (
                    <span role="cell" className="col-span-2 flex flex-wrap gap-1 sm:col-span-1">
                      {s.flags.map((f) => <Flag key={f.code} flag={f} locale={locale} />)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {view.unknown.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {say('meet.participants.unconfirmed')} · {view.unknown.length}
              </h3>
              <ul className="space-y-1 text-[13px]">
                {view.unknown.map((u, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2">
                    <span className="font-medium text-foreground">{u.display_name || '—'}</span>
                    <span className="text-muted-foreground">({say(u.kind === 'signed_in' ? 'meet.participants.google' : u.kind === 'phone' ? 'meet.participants.phone' : 'meet.participants.guest')})</span>
                    <Stretch row={u} locale={locale} heldBack={false} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view.others.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{say('meet.participants.others')}</h3>
              <ul className="space-y-1 text-[13px]">
                {view.others.map((o, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2">
                    <span className="font-medium text-foreground">{o.name}</span>
                    <Stretch row={o} locale={locale} heldBack={false} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * A webinar or office hours beside its recording: who came and for how long — the course's
 * audience, not a class, so no marks, no «not in the room» and nothing to confirm (2026-10-04).
 */
function WebinarAudience({ view, locale, open, onToggle, className }: {
  view: ParticipantsView; locale: Locale; open: boolean; onToggle: () => void; className?: string;
}) {
  const say = (key: MessageKey, params?: Record<string, string | number>) => t(key, params, locale);
  const title = say('meet.webinar.title');
  const ready = view.state === 'ready';
  const waiting = view.state === 'waiting' || view.state === 'not_started';
  if (!ready && !waiting) return null;
  const people = classOrder([...view.students, ...view.others]).filter((p) => p.first_join);
  const count = people.length + view.unknown.length;
  const summary = ready
    ? [say('meet.webinar.joined', { count }),
       view.teacher?.first_join ? say('meet.webinar.host', { from: clock(view.teacher.first_join), to: clock(view.teacher.last_leave) }) : null,
      ].filter(Boolean).join(' · ')
    : null;

  return (
    <section className={cn('rounded-xl border border-border bg-card', className)} aria-label={title}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <Users className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
        {ready && count > 0 && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {say(open ? 'meet.participants.hide' : 'meet.participants.show')}
            <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>
      {!ready && <p className="px-4 pb-3 text-xs text-muted-foreground">{say('meet.webinar.waiting')}</p>}
      {ready && view.partial && <p className="px-4 pb-3 text-xs text-muted-foreground">{say('meet.participants.partial')}</p>}

      {ready && open && count > 0 && (
        <div className="border-t border-border px-4 py-3 text-[13px]">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{say('meet.webinar.people')} · {count}</h3>
          <ul className="space-y-1">
            {people.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex flex-wrap gap-x-2">
                <span className="font-medium text-foreground">{p.name}</span>
                {p.role && ROLE[p.role] && <span className="text-muted-foreground">({say(ROLE[p.role])})</span>}
                <Stretch row={p} locale={locale} heldBack={false} />
              </li>
            ))}
            {view.unknown.map((u, i) => (
              <li key={`unknown-${i}`} className="flex flex-wrap gap-x-2">
                <span className="font-medium text-foreground">{u.display_name || '—'}</span>
                <span className="text-muted-foreground">({say('meet.webinar.unlinked')})</span>
                <Stretch row={u} locale={locale} heldBack={false} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
