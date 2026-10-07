import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { registerSummary } from '../../lib/meetRegister';
import { cn } from '../../lib/utils';
import { getRegisterReport, type RegisterCounts, type RegisterReport } from '../../services/api/meetRegister';
import { activeLocale, t, type Locale, type MessageKey } from '../../lib/i18n';
import { useLocale } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

const LEFT_ALONE: Record<string, MessageKey> = {
  lesson_not_proven: 'meetViews.registerReport.lessonNotProven', nobody_joined: 'meetViews.registerReport.nobodyJoined',
  partial: 'meetViews.registerReport.partial', excused: 'meetViews.registerReport.excused',
  cancelled: 'meetViews.registerReport.cancelled', removed: 'meetViews.registerReport.removed',
  frozen: 'meetViews.registerReport.frozen', no_access: 'meetViews.registerReport.noAccess',
  person_changed_it: 'meetViews.registerReport.personChangedIt', lesson_moved: 'meetViews.registerReport.lessonMoved',
};

function leftAlone(counts: RegisterCounts, locale: Locale = activeLocale()): string {
  const parts = Object.entries(counts.left_alone).filter(([, n]) => n > 0).map(([k, n]) => t('meetViews.registerReport.leftAloneItem', {
    count: n, reason: LEFT_ALONE[k] ? t(LEFT_ALONE[k], undefined, locale) : k,
  }, locale));
  return parts.length ? parts.join(' · ') : '—';
}

/**
 * The register's numbers for the last 14 days, per teacher (owner, 2026-09-23). In shadow it is the
 * week's evidence: how many marks Meet would write, and how many of those contradict the teacher about
 * attending. Live, the same table shows what Meet wrote and what people changed after it.
 */
export function RegisterReportPanel({ refreshKey }: { refreshKey?: unknown }) {
  const [report, setReport] = useState<RegisterReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const say = (key: MessageKey) => t(key, undefined, locale);

  useEffect(() => {
    getRegisterReport().then((r) => { setReport(r); setFailed(false); }).catch(() => setFailed(true));
  }, [refreshKey]);

  if (failed || (report && (report.mode === 'off' || report.total.lessons === 0))) return null;
  const live = report?.mode === 'live';
  const total = report?.total;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div>
          <div className="text-sm font-semibold text-foreground">{say(live ? 'meetViews.registerReport.titleLive' : 'meetViews.registerReport.titleShadow')}</div>
          <div className="text-xs text-muted-foreground">
            {!total ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {say('common.loading')}</span>
              : registerSummary(total, live, locale)}
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 flex-none text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && report && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{say('meet.talkPanel.teacher')}</th>
                <th className="px-3 py-2 text-right font-medium">{say('meetViews.shared.lessons')}</th>
                <th className="px-3 py-2 text-right font-medium">{say(live ? 'meetViews.registerReport.meetWrote' : 'meetViews.registerReport.wouldWrite')}</th>
                <th className="px-3 py-2 text-right font-medium" title={say('meetViews.registerReport.contradictsHint')}>{say('meetViews.registerReport.contradicts')}</th>
                <th className="px-3 py-2 text-right font-medium">{say('meetViews.registerReport.waited')}</th>
                <th className="px-3 py-2 text-right font-medium">{say('meet.issue.overrides')}</th>
                {live && (
                  <th className="px-3 py-2 text-right font-medium"
                    title={say('meetViews.registerReport.noScoresHint')}>
                    {say('meetViews.registerReport.noScores')}
                  </th>
                )}
                <th className="px-4 py-2 font-medium">{say('meetViews.registerReport.leftAlone')}</th>
              </tr>
            </thead>
            <tbody>
              {report.teachers.map((row) => (
                <tr key={row.teacher_id ?? 'none'} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground">{row.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.lessons}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.writes}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', row.changes > 0 && 'font-semibold text-rose-700 dark:text-rose-300')}>{row.changes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.held}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.overrides}</td>
                  {live && (
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={cn((row.scores_missed ?? 0) > 0 && 'font-semibold text-rose-700 dark:text-rose-300')}>{row.scores_missed ?? 0}</span>
                      {(row.scores_open ?? 0) > 0 && <span className="ml-1 text-xs text-muted-foreground">(+{row.scores_open})</span>}
                    </td>
                  )}
                  <td className="px-4 py-2 text-xs text-muted-foreground">{leftAlone(row, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RegisterReportPanel;
