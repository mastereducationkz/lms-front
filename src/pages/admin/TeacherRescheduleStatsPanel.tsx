import { useState, useEffect } from 'react';
import { getTeacherRequestStats, type TeacherRequestStats } from '../../services/api/lesson-requests';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/lessonRequests';

/** "2026-08" default = current month, computed without pulling in a date lib. */
function currentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function TeacherRescheduleStatsPanel() {
  const t = useT();
  const [month, setMonth] = useState<string>(currentYearMonth());
  const [rows, setRows] = useState<TeacherRequestStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const [yStr, mStr] = month.split('-');
    const year = Number(yStr);
    const mon = Number(mStr);
    if (!year || !mon) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTeacherRequestStats(year, mon, 2)
      .then(data => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setError(t('lessonRequests.stats.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('lessonRequests.stats.month')}
          <Input
            type="month"
            className="h-9 w-[180px]"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/15 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="px-6 py-4 border-b">
          <CardTitle className="text-lg">{t('lessonRequests.stats.title')}</CardTitle>
          <CardDescription>
            {loading
              ? t('common.loading')
              : t('lessonRequests.stats.description', { count: rows.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('lessonRequests.stats.teacher')}</TableHead>
                <TableHead className="text-right w-[90px]">{t('lessonRequests.stats.total')}</TableHead>
                <TableHead className="text-right w-[110px]">{t('lessonRequests.type.substitution')}</TableHead>
                <TableHead className="text-right w-[110px]">{t('lessonRequests.type.reschedule')}</TableHead>
                <TableHead className="text-right w-[110px]">{t('lessonRequests.type.cancel')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {t('lessonRequests.stats.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(r => (
                  <TableRow key={r.teacher_id} className="font-medium">
                    <TableCell>{r.teacher_name}</TableCell>
                    <TableCell className="text-right font-bold">{r.total}</TableCell>
                    <TableCell className="text-right">{r.by_type.substitution}</TableCell>
                    <TableCell className="text-right">{r.by_type.reschedule}</TableCell>
                    <TableCell className="text-right">{r.by_type.cancel}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
