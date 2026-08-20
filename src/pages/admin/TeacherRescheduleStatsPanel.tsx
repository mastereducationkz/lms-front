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

/** "2026-08" default = current month, computed without pulling in a date lib. */
function currentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function TeacherRescheduleStatsPanel() {
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
      .catch(() => { if (!cancelled) setError('Не удалось загрузить статистику'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Месяц
          <Input
            type="month"
            className="h-9 w-[180px]"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="px-6 py-4 border-b">
          <CardTitle className="text-lg">Учителя с 2+ обращениями за месяц</CardTitle>
          <CardDescription>
            {loading
              ? 'Загрузка…'
              : `Замены, переносы и отмены. Учителей: ${rows.length}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Учитель</TableHead>
                <TableHead className="text-right w-[90px]">Всего</TableHead>
                <TableHead className="text-right w-[110px]">Замена</TableHead>
                <TableHead className="text-right w-[110px]">Перенос</TableHead>
                <TableHead className="text-right w-[110px]">Отмена</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Загрузка…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Нет учителей с 2+ обращениями за этот месяц
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
