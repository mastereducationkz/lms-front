import { useCallback, useEffect, useRef, useState } from 'react';
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

/** Сколько запросов держим одновременно: упирается в LLM и во внешние платформы, больше не ускоряет. */
const CONCURRENCY = 4;

/** Ключ кэша карточек. Без недели ответ за прошлую неделю лёг бы в карточку текущей. */
const cardKey = (studentId: number, week: string) => `${studentId}:${week}`;

/** Очередь с ограничением: и загрузка фактов, и массовая генерация ходят через неё. */
async function runBounded<T>(items: T[], worker: (item: T) => Promise<void>, limit: number) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      await worker(next);
    }
  });
  await Promise.all(runners);
}

export default function CuratorParentReportsPage() {
  const [params, setParams] = useSearchParams();
  const groupId = Number(params.get('group') || 0);
  const weekParam = params.get('week');
  const [week, setWeek] = useState(() => weekParam || mondayOf(new Date()));

  const [overview, setOverview] = useState<ParentGroupOverview | null>(null);
  const [details, setDetails] = useState<Record<string, ParentStudentResponse | null>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // У каждой загрузки свой номер. Ответ со старым номером не применяется: куратор мог
  // переключить неделю, пока запрос летел, и тогда эти данные уже не про то, что на экране.
  const loadId = useRef(0);

  // Неделю ведёт адресная строка. Без этой синхронизации кнопка «назад» меняла бы URL,
  // не меняя экран, — куратор видит одну неделю, а адрес говорит про другую.
  useEffect(() => {
    const next = weekParam || mondayOf(new Date());
    setWeek(prev => (prev === next ? prev : next));
  }, [weekParam]);

  const load = useCallback(async () => {
    if (!groupId) return;
    const token = ++loadId.current;
    setLoading(true);
    setError(null);
    // Чистим прошлую неделю сразу: показать её карточки под заголовком новой — хуже,
    // чем показать «Загружаем…».
    setOverview(null);
    setDetails({});
    setFailed({});
    try {
      const data = await fetchParentGroupOverview(groupId, week);
      if (token !== loadId.current) return;
      setOverview(data);
      const loaded: Record<string, ParentStudentResponse | null> = {};
      await runBounded(
        data.students,
        async student => {
          try {
            loaded[cardKey(student.id, week)] = await fetchParentStudentFacts(student.id, week);
          } catch {
            loaded[cardKey(student.id, week)] = null;
          }
        },
        CONCURRENCY,
      );
      if (token !== loadId.current) return;
      setDetails(loaded);
    } catch {
      if (token === loadId.current) setError('Не удалось загрузить группу');
    } finally {
      if (token === loadId.current) setLoading(false);
    }
  }, [groupId, week]);

  useEffect(() => {
    void load();
  }, [load]);

  const generateMissing = async () => {
    if (!overview) return;
    const forWeek = week;
    const token = loadId.current;
    const pending = overview.students.filter(s => !details[cardKey(s.id, forWeek)]?.report);
    setBulkRunning(true);
    try {
      await runBounded(
        pending,
        async student => {
          const key = cardKey(student.id, forWeek);
          try {
            const result = await generateParentReport(student.id, { week: forWeek });
            if (token !== loadId.current) return;
            setDetails(prev => ({ ...prev, [key]: result }));
            setFailed(prev => {
              if (!prev[key]) return prev;
              const next = { ...prev };
              delete next[key];
              return next;
            });
          } catch {
            // Падение одного ученика не останавливает очередь, но и не молчит: куратор
            // должен отличать «ещё не пробовали» от «попробовали и не вышло».
            if (token === loadId.current) setFailed(prev => ({ ...prev, [key]: true }));
          }
        },
        CONCURRENCY,
      );
    } finally {
      setBulkRunning(false);
    }
  };

  const goToWeek = (next: string) => {
    setParams(prev => {
      const copy = new URLSearchParams(prev);
      copy.set('week', next);
      return copy;
    });
  };

  const students = overview?.students ?? [];
  const missingCount = students.filter(s => !details[cardKey(s.id, week)]?.report).length;
  const failedCount = students.filter(s => failed[cardKey(s.id, week)]).length;
  const busy = loading || bulkRunning;

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Отчёты родителям</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
            disabled={busy}
            onClick={() => goToWeek(shiftWeek(week, -1))}
          >
            ←
          </button>
          <span className="text-sm text-gray-700 min-w-[7.5rem] text-center">
            {weekLabel(week)}
          </span>
          <button
            type="button"
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
            disabled={busy}
            onClick={() => goToWeek(shiftWeek(week, 1))}
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

      {overview && !loading && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generateMissing}
              disabled={busy || missingCount === 0}
              className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white disabled:opacity-50"
            >
              {bulkRunning
                ? 'Генерируем…'
                : `Сгенерировать всем, у кого нет (${missingCount})`}
            </button>
            <span className="text-sm text-gray-600">
              Готово {students.length - missingCount} из {students.length}
            </span>
            {failedCount > 0 && (
              <span className="text-sm text-amber-700">
                Не получилось: {failedCount} — откройте карточку и попробуйте ещё раз
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {students.map(student => (
              <div key={cardKey(student.id, week)} className="space-y-1">
                {failed[cardKey(student.id, week)] && (
                  <p className="text-xs text-amber-700">
                    Не удалось сгенерировать при массовом запуске
                  </p>
                )}
                <ParentReportCard
                  studentId={student.id}
                  studentName={student.name}
                  week={week}
                  initial={details[cardKey(student.id, week)] ?? null}
                  onSaved={next =>
                    setDetails(prev => ({ ...prev, [cardKey(student.id, week)]: next }))
                  }
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
