import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { IssueKey, TeacherTally } from '../../lib/meetAttendance';
import { percent } from '../../lib/meetTalk';
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

interface Props {
  rows: TeacherTally[];
  /** Narrow the list to one teacher's lessons with one issue. */
  onPick: (teacherId: number, issue: IssueKey | null) => void;
}

const COLUMNS: { key: IssueKey; label: MessageKey; tone: 'bad' | 'warn' }[] = [
  { key: 'teacher_late', label: 'meetViews.tally.startedLate', tone: 'warn' },
  { key: 'ended_early', label: 'meet.issue.endedEarly', tone: 'warn' },
  { key: 'teacher_not_joined', label: 'meetViews.tally.neverJoined', tone: 'bad' },
  { key: 'marks_disagree', label: 'meet.issue.marksDisagree', tone: 'bad' },
  { key: 'to_confirm', label: 'meet.issue.toConfirm', tone: 'warn' },
];

/**
 * The period by teacher — what a head or curator reports on: how often each teacher started
 * late or ended early, and where their marks disagree with the room. Each number opens exactly
 * those lessons below.
 */
export function TeacherTallyTable({ rows, onPick }: Props) {
  const t = useT();
  const [open, setOpen] = useState(true);
  if (rows.length < 2) return null;
  // Only once some lesson has talk time: an empty column says nothing.
  const talk = rows.some((r) => r.talk_lessons > 0);
  // How far each teacher's register already matches Meet's verdict — what switching teachers off would change.
  const agreement = rows.some((r) => r.verdict_compared > 0);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm" aria-label={t('meetViews.shared.byTeacher')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <h2 className="text-sm font-semibold text-foreground">{t('meetViews.shared.byTeacher')}</h2>
        <span className="text-xs text-muted-foreground">{t('meetViews.tally.summary', { count: rows.length })}</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">{t('meet.talkPanel.teacher')}</th>
                <th className="px-3 py-2 text-right">{t('meetViews.shared.lessons')}</th>
                {COLUMNS.map((c) => <th key={c.key} className="px-3 py-2 text-right">{t(c.label)}</th>)}
                {agreement && <th className="px-3 py-2 text-right" title={t('meetViews.tally.agreesHint')}>{t('meetViews.tally.agrees')}</th>}
                {talk && <th className="px-3 py-2 text-right" title={t('meetViews.tally.avgTalkHint')}>{t('meetViews.tally.avgTalk')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.teacherId}>
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => onPick(r.teacherId, null)} className="font-medium text-foreground hover:underline">
                      {r.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.lessons}</td>
                  {COLUMNS.map((c) => {
                    const n = r[c.key as keyof TeacherTally] as number;
                    return (
                      <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                        {n > 0 ? (
                          <button
                            type="button"
                            onClick={() => onPick(r.teacherId, c.key)}
                            title={c.key === 'teacher_late' ? t('meetViews.tally.lateTotal', { minutes: r.late_minutes }) : undefined}
                            className={cn(
                              'rounded px-1.5 py-0.5 font-semibold hover:bg-muted',
                              c.tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-300',
                            )}
                          >
                            {n}
                            {c.key === 'teacher_late' && <span className="ml-1 text-[11px] font-normal text-muted-foreground">({t('meet.duration.minutes', { minutes: r.late_minutes })})</span>}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                  {agreement && (
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                      title={r.verdict_compared ? t('meetViews.tally.agreeCount', { agree: r.verdict_agree, count: r.verdict_compared }) : t('meetViews.tally.noneJudged')}>
                      {r.verdict_compared === 0 ? <span className="text-muted-foreground/50">—</span> : (
                        <span className={cn('font-semibold', r.verdict_agree < r.verdict_compared ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
                          {percent(r.verdict_agree / r.verdict_compared)}
                        </span>
                      )}
                    </td>
                  )}
                  {talk && (
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                      title={r.talk_lessons ? t('meetViews.tally.overLessons', { count: r.talk_lessons }) : undefined}>
                      {r.avg_teacher_share == null ? <span className="text-muted-foreground/50">—</span> : <span className="font-semibold text-foreground">{percent(r.avg_teacher_share)}</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
