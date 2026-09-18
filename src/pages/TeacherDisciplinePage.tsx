import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, Lock } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { cellText, cellTitle, cellTone, money, showsProgramTabs, type DisciplineCell } from '../lib/discipline';
import DayPanel from '../components/discipline/DayPanel';
import {
  closePeriod,
  exportUrl,
  getRegister,
  listPeriods,
  type DisciplinePeriodInfo,
  type DisciplineRegister,
} from '../services/api/discipline';

/**
 * The head teachers' register, in place of «Attendance and Late lessons 16.09-31.10».
 *
 * Teachers down, days across, one tab per programme — the shape they already read. The numbers
 * come from the Meet record: 200 ₸ for every whole minute late or cut short, a missed lesson
 * priced by a person. Clicking a day opens what the LMS actually saw.
 */

const TONE_CLASS: Record<string, string> = {
  late: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  early: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  miss: 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-300',
  unmeasurable: 'text-gray-300 dark:text-gray-600',
  clear: 'text-gray-300 dark:text-gray-700',
  none: '',
};

const dayHead = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return { day: date.getUTCDate(), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()] };
};

export default function TeacherDisciplinePage() {
  const { user } = useAuth();
  const canDecide = user?.role === 'admin' || user?.role === 'head_teacher';

  const [periods, setPeriods] = useState<DisciplinePeriodInfo[]>([]);
  const [periodKey, setPeriodKey] = useState<string>('');
  const [program, setProgram] = useState<string>('');
  const [register, setRegister] = useState<DisciplineRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDay, setOpenDay] = useState<{ teacherId: number; name: string; day: string } | null>(null);

  useEffect(() => {
    listPeriods()
      .then((data) => {
        setPeriods(data.periods);
        setPeriodKey((current) => current || data.periods[0]?.key || '');
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Could not load the periods'));
  }, []);

  const load = useCallback(async () => {
    if (!periodKey) return;
    setLoading(true);
    setError('');
    try {
      setRegister(await getRegister(periodKey, program || undefined));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load the register');
      setRegister(null);
    } finally {
      setLoading(false);
    }
  }, [periodKey, program]);

  useEffect(() => { load(); }, [load]);

  const index = periods.findIndex((p) => p.key === periodKey);
  // The tabs come from the server's list of the period's programmes, which does not change when
  // one is chosen. Deriving them from the rows on screen made every tab — «All» included —
  // disappear as soon as a programme was picked, leaving no way back.
  const programs = register?.programs || [];

  const close = async () => {
    if (!register) return;
    const message = `Close ${register.period.label}?\n\n`
      + `${money(register.totals.fine)} in fines across ${register.teachers.length} teachers.\n`
      + 'The numbers freeze — payroll is paid on them.';
    if (!window.confirm(message)) return;
    try {
      await closePeriod(register.period.key);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not close the period');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Teacher discipline</h1>
          <p className="text-sm text-gray-500">
            Lateness and missed lessons from the Meet record · 200 ₸ a minute · since 16.09.2026
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={index >= periods.length - 1}
                  onClick={() => setPeriodKey(periods[index + 1]?.key)} aria-label="Earlier period">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[13rem] text-center text-sm font-medium">
            {register?.period.label || '—'}
            {register?.period.closed && <Lock className="ml-1 inline h-3.5 w-3.5 text-gray-500" />}
          </span>
          <Button variant="outline" size="sm" disabled={index <= 0}
                  onClick={() => setPeriodKey(periods[index - 1]?.key)} aria-label="Later period">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <a href={periodKey ? exportUrl(periodKey, program || undefined) : '#'}>
            <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" />Excel</Button>
          </a>
          {canDecide && register && !register.period.closed && (
            <Button size="sm" onClick={close}><Lock className="mr-1.5 h-4 w-4" />Close period</Button>
          )}
        </div>
      </header>

      {showsProgramTabs(programs, program) && (
        <div className="flex flex-wrap gap-2">
          <Button variant={program ? 'outline' : 'default'} size="sm" onClick={() => setProgram('')}>All</Button>
          {programs.map((name) => (
            <Button key={name} variant={program === name ? 'default' : 'outline'} size="sm"
                    onClick={() => setProgram(name)}>{name}</Button>
          ))}
        </div>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}

      {register && !loading && register.teachers.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
          {program
            ? `No ${program} lessons in this period yet.`
            : 'Nothing in this period yet. The register starts on 16.09.2026, when the rule took effect.'}
        </p>
      )}

      {register && !loading && register.teachers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium dark:bg-gray-800/60">Teacher</th>
                {register.days.map((day) => {
                  const head = dayHead(day);
                  return (
                    <th key={day} className="px-1 py-2 text-center text-xs font-medium text-gray-500">
                      <div>{head.day}</div>
                      <div className="text-[10px] uppercase">{head.weekday}</div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-right font-medium">Late</th>
                <th className="px-3 py-2 text-right font-medium">Missed</th>
                <th className="px-3 py-2 text-right font-medium">Fine</th>
              </tr>
            </thead>
            <tbody>
              {register.teachers.map((row) => (
                <tr key={row.teacher_id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 dark:bg-gray-900">
                    <span className="font-medium">{row.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{row.program}</span>
                  </td>
                  {register.days.map((day) => {
                    const cell = (row.days[day] || {
                      late_minutes: 0, early_minutes: 0, misses: 0, fine: 0, unpriced: 0,
                      lessons: 0, measured: 0, unmeasurable: 0, decided: 0, state: 'none',
                    }) as DisciplineCell;
                    const text = cellText(cell);
                    return (
                      <td key={day} className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          title={cellTitle(cell)}
                          disabled={!cell.lessons}
                          onClick={() => setOpenDay({ teacherId: row.teacher_id, name: row.name, day })}
                          className={cn('min-w-[2.2rem] rounded px-1 py-0.5 text-xs',
                            TONE_CLASS[cellTone(cell)],
                            cell.lessons ? 'hover:ring-1 hover:ring-gray-300' : 'cursor-default')}
                        >
                          {text || (cell.lessons ? '·' : '')}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right">{row.totals.late_minutes || '—'}</td>
                  <td className="px-3 py-1.5 text-right">{row.totals.misses || '—'}</td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {money(row.totals.fine)}
                    {row.totals.unpriced > 0 && (
                      <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">+{row.totals.unpriced}?</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-800/60">
                <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 dark:bg-gray-800/60">Total</td>
                <td colSpan={register.days.length} />
                <td className="px-3 py-2 text-right">{register.totals.late_minutes || '—'}</td>
                <td className="px-3 py-2 text-right">{register.totals.misses || '—'}</td>
                <td className="px-3 py-2 text-right">{money(register.totals.fine)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {register?.totals.unmeasurable ? (
        <p className="text-xs text-gray-500">
          {register.totals.unmeasurable} of {register.totals.lessons} lessons had no LMS Meet room, so the
          LMS could not judge them. They are marked «·», never as on time.
        </p>
      ) : null}

      {openDay && (
        <DayPanel
          teacherId={openDay.teacherId}
          teacherName={openDay.name}
          day={openDay.day}
          canDecide={canDecide && !register?.period.closed}
          onClose={() => setOpenDay(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
