import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getRegisterReport, type RegisterCounts, type RegisterReport } from '../../services/api/meetRegister';

const LEFT_ALONE: Record<string, string> = {
  lesson_not_proven: 'teacher not in the lesson', nobody_joined: 'nobody joined', partial: 'call data missing',
  excused: 'excused', cancelled: 'cancelled', removed: 'removed', frozen: 'frozen', no_access: 'no access',
  person_changed_it: 'marked by a person', lesson_moved: 'lesson moved',
};

function leftAlone(counts: RegisterCounts): string {
  const parts = Object.entries(counts.left_alone).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${LEFT_ALONE[k] ?? k}`);
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
          <div className="text-sm font-semibold text-foreground">{live ? 'Register — last 14 days' : 'Register shadow run — last 14 days'}</div>
          <div className="text-xs text-muted-foreground">
            {!total ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</span>
              : live
                ? `${total.lessons} lessons · Meet wrote ${total.writes} marks · ${total.held} students waited for a teacher · ${total.overrides} changed after Meet`
                : `${total.lessons} lessons · Meet would write ${total.writes} marks · ${total.changes} would contradict the teacher (present ↔ absent) · ${total.held} would wait for a teacher`}
          </div>
        </div>
        <ChevronDown className={cn('h-4 w-4 flex-none text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && report && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Teacher</th>
                <th className="px-3 py-2 text-right font-medium">Lessons</th>
                <th className="px-3 py-2 text-right font-medium">{live ? 'Meet wrote' : 'Would write'}</th>
                <th className="px-3 py-2 text-right font-medium" title="Meet disagrees with the teacher's mark about attending">Contradicts</th>
                <th className="px-3 py-2 text-right font-medium">Waited</th>
                <th className="px-3 py-2 text-right font-medium">Changed after Meet</th>
                <th className="px-4 py-2 font-medium">Left alone</th>
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
                  <td className="px-4 py-2 text-xs text-muted-foreground">{leftAlone(row)}</td>
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
