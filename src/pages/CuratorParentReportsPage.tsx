import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import ParentReportCard from '../components/parentReports/ParentReportCard';
import { mondayOf, shiftWeek, weekLabel } from '../lib/parentReportWeek';
import {
  fetchParentGroupOverview,
  fetchParentStudentFacts,
  generateParentReport,
  type ParentGroupOverview,
  type ParentStudentResponse,
} from '../services/api/reports';

/** Сколько генераций идёт одновременно. Больше — без выигрыша: упирается в LLM. */
const CONCURRENCY = 4;

export default function CuratorParentReportsPage() {
  const [params, setParams] = useSearchParams();
  const groupId = Number(params.get('group') || 0);
  const [week, setWeek] = useState(() => params.get('week') || mondayOf(new Date()));

  const [overview, setOverview] = useState<ParentGroupOverview | null>(null);
  const [details, setDetails] = useState<Record<number, ParentStudentResponse | null>>({});
  const [loading, setLoading] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchParentGroupOverview(groupId, week);
      setOverview(data);
      const loaded = await Promise.all(
        data.students.map(async s => {
          try {
            return [s.id, await fetchParentStudentFacts(s.id, week)] as const;
          } catch {
            return [s.id, null] as const;
          }
        }),
      );
      setDetails(Object.fromEntries(loaded));
    } catch {
      setError('Не удалось загрузить группу');
    } finally {
      setLoading(false);
    }
  }, [groupId, week]);

  useEffect(() => { void load(); }, [load]);

  const generateMissing = async () => {
    if (!overview) return;
    const pending = overview.students.filter(s => !details[s.id]?.report);
    setBulkRunning(true);
    try {
      // Очередь с ограничением: браузер не должен выпускать 20 LLM-запросов разом.
      const queue = [...pending];
      const workers = Array.from({ length: CONCURRENCY }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const student = next;
          try {
            const result = await generateParentReport(student.id, { week });
            setDetails(prev => ({ ...prev, [student.id]: result }));
          } catch {
            // Падение одного ученика не должно останавливать остальных —
            // куратор увидит пустую карточку и нажмёт «Сгенерировать» точечно.
          }
        }
      });
      await Promise.all(workers);
    } finally {
      setBulkRunning(false);
    }
  };

  const setWeekAndUrl = (next: string) => {
    setWeek(next);
    setParams(prev => {
      const copy = new URLSearchParams(prev);
      copy.set('week', next);
      return copy;
    });
  };

  const missingCount = overview
    ? overview.students.filter(s => !details[s.id]?.report).length
    : 0;

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Отчёты родителям</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 border border-gray-300 rounded"
            onClick={() => setWeekAndUrl(shiftWeek(week, -1))}
          >
            ←
          </button>
          <span className="text-sm text-gray-700 min-w-[7.5rem] text-center">
            {weekLabel(week)}
          </span>
          <button
            type="button"
            className="px-2 py-1 border border-gray-300 rounded"
            onClick={() => setWeekAndUrl(shiftWeek(week, 1))}
          >
            →
          </button>
        </div>
      </header>

      {!groupId && (
        <p className="text-sm text-gray-600">
          Откройте страницу с карточки группы — нужен параметр <code>?group=</code>.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Загружаем…</p>}

      {overview && (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generateMissing}
              disabled={bulkRunning || missingCount === 0}
              className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white disabled:opacity-50"
            >
              {bulkRunning
                ? 'Генерируем…'
                : `Сгенерировать всем, у кого нет (${missingCount})`}
            </button>
            <span className="text-sm text-gray-600">
              Готово {overview.students.length - missingCount} из {overview.students.length}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {overview.students.map(student => (
              <ParentReportCard
                key={`${student.id}-${week}`}
                studentId={student.id}
                studentName={student.name}
                week={week}
                initial={details[student.id] ?? null}
                onSaved={next => setDetails(prev => ({ ...prev, [student.id]: next }))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
