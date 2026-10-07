import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, Lock, Undo2, X } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { cellMark, cellText, cellTitle, cellTone, money, showsProgramTabs, type DisciplineCell } from '../lib/discipline';
import DayPanel from '../components/discipline/DayPanel';
import ClosePeriodDialog from '../components/discipline/ClosePeriodDialog';
import {
  closePeriod,
  exportUrl,
  getRegister,
  listPeriods,
  type DisciplinePeriodInfo,
  type DisciplineRegister,
} from '../services/api/discipline';
import { formatDate } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherInsights';

/**
 * The head teachers' register, in place of «Attendance and Late lessons 16.09-31.10».
 *
 * Teachers down, days across, one tab per programme — the shape they already read. The numbers
 * come from the Meet record: 200 ₸ for every whole minute late or cut short, a missed lesson
 * priced by a person. Clicking a day opens what the LMS actually saw.
 *
 * Minutes a teacher gave back by staying past the end carry a «gave back» icon and their own colour,
 * so «опоздал и отработал» is distinguishable from «опоздал» without opening the day.
 */

const TONE_CLASS: Record<string, string> = {
  late: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  // Teal, not amber: the minutes came back. Still a finding, still fined until a head
  // teacher decides otherwise — but it must not read as the same day as one that did not.
  made_up: 'bg-teal-100 text-teal-900 dark:bg-teal-950/50 dark:text-teal-300',
  early: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  miss: 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-300',
  unmeasurable: 'text-gray-300 dark:text-muted-foreground',
  clear: 'text-gray-300 dark:text-muted-foreground',
  none: '',
};

const dayHead = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return { day: date.getUTCDate(), weekday: formatDate(iso, { weekday: 'short' }) };
};

export default function TeacherDisciplinePage() {
  const { user } = useAuth();
  const t = useT();
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
      .catch((err) => setError(err?.response?.data?.detail || t('teacherInsights.discipline.loadPeriodsFailed')));
  }, []);

  const load = useCallback(async () => {
    if (!periodKey) return;
    setLoading(true);
    setError('');
    try {
      setRegister(await getRegister(periodKey, program || undefined));
    } catch (err: any) {
      setError(err?.response?.data?.detail || t('teacherInsights.discipline.loadRegisterFailed'));
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

  // Closing freezes what payroll is paid on, so it asks in a dialog that can show the figures
  // being frozen. A native confirm could only show them as unformatted text in a box the
  // browser controls, and gave no way to say what went wrong when the server refused.
  const [closing, setClosing] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  const close = async () => {
    if (!register) return;
    setCloseBusy(true);
    setError('');
    try {
      await closePeriod(register.period.key);
      setClosing(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || t('teacherInsights.discipline.closeFailed'));
      setClosing(false);
    } finally {
      setCloseBusy(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('teacherInsights.discipline.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('teacherInsights.discipline.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={index >= periods.length - 1}
                  onClick={() => setPeriodKey(periods[index + 1]?.key)} aria-label={t('teacherInsights.discipline.earlierPeriod')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[13rem] text-center text-sm font-medium">
            {register?.period.label || '—'}
            {register?.period.closed && <Lock className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" />}
          </span>
          <Button variant="outline" size="sm" disabled={index <= 0}
                  onClick={() => setPeriodKey(periods[index - 1]?.key)} aria-label={t('teacherInsights.discipline.laterPeriod')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <a href={periodKey ? exportUrl(periodKey, program || undefined) : '#'}>
            <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" />{t('teacherInsights.discipline.excel')}</Button>
          </a>
          {canDecide && register && !register.period.closed && (
            <Button size="sm" onClick={() => setClosing(true)}><Lock className="mr-1.5 h-4 w-4" />{t('teacherInsights.discipline.closePeriod')}</Button>
          )}
        </div>
      </header>

      {showsProgramTabs(programs, program) && (
        <div className="flex flex-wrap gap-2">
          <Button variant={program ? 'outline' : 'default'} size="sm" onClick={() => setProgram('')}>{t('common.all')}</Button>
          {programs.map((name) => (
            <Button key={name} variant={program === name ? 'default' : 'outline'} size="sm"
                    onClick={() => setProgram(name)}>{name}</Button>
          ))}
        </div>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

      {register && !loading && register.teachers.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {program
            ? t('teacherInsights.discipline.noProgramLessons', { program })
            : t('teacherInsights.discipline.empty')}
        </p>
      )}

      {register && !loading && register.teachers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">{t('teacherInsights.discipline.col.teacher')}</th>
                {register.days.map((day) => {
                  const head = dayHead(day);
                  return (
                    <th key={day} className="px-1 py-2 text-center text-xs font-medium text-muted-foreground">
                      <div>{head.day}</div>
                      <div className="text-[10px] uppercase">{head.weekday}</div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-right font-medium">{t('teacherInsights.discipline.col.late')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('teacherInsights.discipline.col.missed')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('teacherInsights.discipline.col.fine')}</th>
              </tr>
            </thead>
            <tbody>
              {register.teachers.map((row) => (
                <tr key={row.teacher_id} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                    <span className="font-medium">{row.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{row.program}</span>
                  </td>
                  {register.days.map((day) => {
                    const cell = (row.days[day] || {
                      late_minutes: 0, early_minutes: 0, misses: 0, fine: 0, unpriced: 0,
                      made_up_minutes: 0,
                      lessons: 0, measured: 0, unmeasurable: 0, decided: 0, state: 'none',
                    }) as DisciplineCell;
                    const text = cellText(cell);
                    const mark = cellMark(cell);
                    return (
                      <td key={day} className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          title={cellTitle(cell)}
                          disabled={!cell.lessons}
                          onClick={() => setOpenDay({ teacherId: row.teacher_id, name: row.name, day })}
                          className={cn('min-w-[2.2rem] rounded px-1 py-0.5 text-xs',
                            TONE_CLASS[cellTone(cell)],
                            cell.lessons ? 'hover:ring-1 hover:ring-border' : 'cursor-default')}
                        >
                          {mark === 'miss' ? (
                            <X className="mx-auto h-3.5 w-3.5" strokeWidth={2.5} aria-label={t('teacherInsights.discipline.missedLesson')} />
                          ) : (
                            <span className="inline-flex items-center gap-0.5">
                              {text || (cell.lessons ? '·' : '')}
                              {mark === 'made_up' && <Undo2 className="h-3 w-3" aria-label={t('teacherInsights.discipline.madeUpMark')} />}
                            </span>
                          )}
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
              <tr className="border-t-2 border-border bg-muted font-medium">
                <td className="sticky left-0 z-10 bg-muted px-3 py-2">{t('teacherInsights.shared.total')}</td>
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
        <p className="text-xs text-muted-foreground">
          {t('teacherInsights.discipline.unmeasurableNote', { unmeasurable: register.totals.unmeasurable, lessons: register.totals.lessons })}
        </p>
      ) : null}

      <ClosePeriodDialog
        open={closing}
        label={register?.period.label || ''}
        fine={register?.totals.fine ?? 0}
        teachers={register?.teachers.length ?? 0}
        unpriced={register?.totals.unpriced ?? 0}
        busy={closeBusy}
        onCancel={() => setClosing(false)}
        onConfirm={close}
      />

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
