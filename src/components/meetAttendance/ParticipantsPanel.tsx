import { useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  MARK_LABEL,
  MARK_LABEL_RU,
  classOrder,
  clock,
  flagText,
  flagTextRu,
  isMismatch,
  type ParticipantRow,
  type ParticipantsView,
} from '../../lib/meetAttendance';
import type { MeetFlag, MeetMark } from '../../services/api/meetAttendance';

type Locale = 'ru' | 'en';

const TEXT = {
  ru: {
    title: 'Участники урока',
    show: 'Показать список участников',
    hide: 'Скрыть список',
    inRoom: (n: number, total: number) => `В комнате ${n} из ${total} ${total === 1 ? 'ученика' : 'учеников'}`,
    classSize: (n: number) => `Учеников в группе: ${n}`,
    teacher: 'Преподаватель',
    disagree: (n: number) => `${n} ${n === 1 ? 'отметка расходится' : 'отметки расходятся'} с Meet`,
    noMeet: 'Подключения к Meet для этого урока не записаны — ниже список учеников и их отметки.',
    waiting: 'Кто подключался, появится примерно через 20 минут после урока. Пока — список учеников и отметки.',
    heldBack: 'Некоторые аккаунты в комнате ещё не подтверждены, поэтому «не заходил» может быть неточным.',
    partial: 'Часть данных из Google ещё не пришла.',
    student: 'Ученик', mark: 'Отметка', room: 'В комнате', notes: 'Замечания',
    notInRoom: 'Не заходил', noAccount: 'Аккаунт не подтверждён', notMarked: 'Не отмечен',
    joins: (n: number) => `${n} ${n < 5 ? 'входа' : 'входов'}`,
    unconfirmed: 'Неподтверждённые аккаунты', others: 'Другие участники',
    guest: 'гость', google: 'Google-аккаунт', phone: 'телефон', min: 'мин',
  },
  en: {
    title: 'Participants',
    show: 'Show participants',
    hide: 'Hide list',
    inRoom: (n: number, total: number) => `${n} of ${total} students in the room`,
    classSize: (n: number) => `${n} students in the class`,
    teacher: 'Teacher',
    disagree: (n: number) => `${n} mark${n === 1 ? '' : 's'} disagree with Meet`,
    noMeet: 'No Meet joins were recorded for this lesson — below is the class with its marks.',
    waiting: 'Who joined appears about 20 minutes after the lesson. Until then, the class and its marks.',
    heldBack: 'Some accounts in the room are not confirmed yet, so "not in the room" may be wrong.',
    partial: 'Part of this lesson has not come through from Google yet.',
    student: 'Student', mark: 'Mark', room: 'In the room', notes: 'Notes',
    notInRoom: 'Not in the room', noAccount: 'Account not confirmed', notMarked: 'Not marked',
    joins: (n: number) => `${n} joins`,
    unconfirmed: 'Unconfirmed accounts', others: 'Others in the room',
    guest: 'guest', google: 'Google account', phone: 'phone', min: 'min',
  },
} as const;

const MARK_CHIP: Record<Exclude<MeetMark, null>, string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  late: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  absent: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  removed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function Mark({ mark, locale }: { mark: MeetMark; locale: Locale }) {
  const t = TEXT[locale];
  if (!mark) {
    return <span className="inline-flex rounded border border-dashed border-muted-foreground/40 px-1.5 py-px text-[11px] text-muted-foreground">{t.notMarked}</span>;
  }
  return (
    <span className={cn('inline-flex rounded px-1.5 py-px text-[11px] font-medium', MARK_CHIP[mark])}>
      {(locale === 'ru' ? MARK_LABEL_RU : MARK_LABEL)[mark]}
    </span>
  );
}

function Flag({ flag, locale }: { flag: MeetFlag; locale: Locale }) {
  return (
    <span className={cn(
      'inline-flex rounded px-1.5 py-px text-[11px] font-medium leading-4 ring-1 ring-inset',
      isMismatch(flag.code)
        ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900'
        : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900',
    )}>
      {locale === 'ru' ? flagTextRu(flag) : flagText(flag)}
    </span>
  );
}

function Stretch({ row, locale, heldBack }: { row: Pick<ParticipantRow, 'first_join' | 'last_leave' | 'minutes_in_lesson' | 'joins'>; locale: Locale; heldBack: boolean }) {
  const t = TEXT[locale];
  if (!row.first_join) return <span className="text-muted-foreground">{heldBack ? t.noAccount : t.notInRoom}</span>;
  return (
    <span className="tabular-nums">
      {clock(row.first_join)}–{clock(row.last_leave)}
      <span className="text-muted-foreground"> · {row.minutes_in_lesson} {t.min}{row.joins > 1 ? ` · ${t.joins(row.joins)}` : ''}</span>
    </span>
  );
}

interface Props {
  view: ParticipantsView;
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
export function ParticipantsPanel({ view, locale = 'en', defaultOpen = false, className }: Props) {
  const t = TEXT[locale];
  const [open, setOpen] = useState(defaultOpen);
  const ready = view.state === 'ready';
  const students = classOrder(view.students);
  const joined = students.filter((s) => s.first_join).length;
  const disagree = students.filter((s) => s.flags.some((f) => isMismatch(f.code))).length;

  const summary = ready
    ? [
        t.inRoom(joined, students.length),
        view.teacher?.first_join ? `${t.teacher} ${clock(view.teacher.first_join)}–${clock(view.teacher.last_leave)}` : null,
        disagree ? t.disagree(disagree) : null,
      ].filter(Boolean).join(' · ')
    : t.classSize(students.length);
  const note = !ready
    ? (view.state === 'waiting' || view.state === 'not_started' ? t.waiting : t.noMeet)
    : view.held_back ? t.heldBack : view.partial ? t.partial : null;

  if (students.length === 0 && !view.teacher && view.unknown.length === 0) return null;

  return (
    <section className={cn('rounded-xl border border-border bg-card', className)} aria-label={t.title}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <Users className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
        <span className={cn('text-sm', disagree ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground')}>{summary}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? t.hide : t.show}
          <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} aria-hidden />
        </button>
      </div>
      {note && <p className="px-4 pb-3 text-xs text-muted-foreground">{note}</p>}

      {open && (
        <div className="border-t border-border text-sm">
          {view.teacher && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-muted/30 px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">{t.teacher}</span>
              <span className="font-medium text-foreground">{view.teacher.name}</span>
              <Stretch row={view.teacher} locale={locale} heldBack={view.held_back} />
              {view.teacher.flags.map((f) => <Flag key={f.code} flag={f} locale={locale} />)}
            </div>
          )}

          <div role="table" aria-label={t.title}>
            <div role="row" className={cn(
              'hidden gap-x-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid',
              ready ? 'sm:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1.3fr)_minmax(0,1.5fr)]' : 'sm:grid-cols-[minmax(0,1.5fr)_7.5rem]',
            )}>
              <span role="columnheader">{t.student}</span>
              <span role="columnheader">{t.mark}</span>
              {ready && <span role="columnheader">{t.room}</span>}
              {ready && <span role="columnheader">{t.notes}</span>}
            </div>
            <div className="divide-y divide-border/70">
              {students.map((s, i) => (
                <div
                  role="row"
                  key={`${s.name}-${i}`}
                  className={cn(
                    'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2',
                    ready ? 'sm:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1.3fr)_minmax(0,1.5fr)]' : 'sm:grid-cols-[minmax(0,1.5fr)_7.5rem]',
                    s.flags.some((f) => isMismatch(f.code)) && 'bg-rose-50/60 dark:bg-rose-950/20',
                  )}
                >
                  <span role="cell" className={cn('truncate', s.first_join || !ready ? 'text-foreground' : 'text-muted-foreground')} title={s.name}>{s.name}</span>
                  <span role="cell"><Mark mark={s.mark} locale={locale} /></span>
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
                {t.unconfirmed} · {view.unknown.length}
              </h3>
              <ul className="space-y-1 text-[13px]">
                {view.unknown.map((u, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2">
                    <span className="font-medium text-foreground">{u.display_name || '—'}</span>
                    <span className="text-muted-foreground">({u.kind === 'signed_in' ? t.google : u.kind === 'phone' ? t.phone : t.guest})</span>
                    <Stretch row={u} locale={locale} heldBack={false} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view.others.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.others}</h3>
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
