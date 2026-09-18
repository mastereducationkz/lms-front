import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  generateParentReport,
  saveParentReport,
  type ParentStudentResponse,
  type ParentTemplateKey,
} from '../../services/api/reports';

const TEMPLATE_LABELS: Record<ParentTemplateKey, string> = {
  t1: 'Шаблон 1 — подробный',
  t2: 'Шаблон 2 — про активность',
  t3: 'Шаблон 3 — короткий',
  t4: 'Шаблон 4 — рекомендации',
  t5: 'Шаблон 5 — есть что обсудить',
};

interface Props {
  studentId: number;
  studentName: string;
  /** Понедельник недели, `YYYY-MM-DD`. */
  week: string;
  initial: ParentStudentResponse | null;
  onSaved?: (response: ParentStudentResponse) => void;
}

export default function ParentReportCard({ studentId, studentName, week, initial, onSaved }: Props) {
  const [state, setState] = useState<ParentStudentResponse | null>(initial);
  const [body, setBody] = useState(initial?.report?.body ?? '');
  const [note, setNote] = useState(initial?.report?.curator_note ?? '');
  const [template, setTemplate] = useState<ParentTemplateKey | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Какой отчёт показан. Ученик и неделя — это и есть его личность; всё остальное
  // (новый объект с теми же данными) личность не меняет.
  const identity = `${studentId}:${week}`;
  const shown = useRef(identity);
  const live = useRef(identity);
  // Трогал ли куратор текст руками. Если трогал — чужое обновление его не затирает.
  const dirty = useRef(false);
  // Всегда содержит то, что последним легло в state. Замыкание, снятое до await,
  // этого не знает: пока запрос летит, родитель может принести свежие данные.
  const latest = useRef<ParentStudentResponse | null>(initial);

  useLayoutEffect(() => {
    live.current = identity;
  }, [identity]);

  useEffect(() => {
    if (shown.current !== identity) {
      // Другой ученик или другая неделя: это другой отчёт, сбрасываем всё.
      shown.current = identity;
      dirty.current = false;
      latest.current = initial;
      setState(initial);
      setBody(initial?.report?.body ?? '');
      setNote(initial?.report?.curator_note ?? '');
      setError(null);
      return;
    }
    // Тот же отчёт, но родитель принёс свежие данные — например, массовая генерация
    // по группе. Серверное состояние принимаем всегда, а текст куратора перезаписываем,
    // только если он его не трогал: иначе недописанная заметка исчезает без предупреждения.
    latest.current = initial;
    setState(initial);
    if (!dirty.current) {
      setBody(initial?.report?.body ?? '');
      setNote(initial?.report?.curator_note ?? '');
    }
  }, [initial, identity]);

  const generate = async () => {
    const issuedFor = identity;
    setBusy(true);
    setError(null);
    try {
      const next = await generateParentReport(studentId, {
        week,
        template: template || undefined,
        note: note.trim() || undefined,
      });
      // Карточку успели переключить — ответ относится к другому отчёту, он не наш.
      if (live.current !== issuedFor) return;
      dirty.current = false;
      latest.current = next;
      setState(next);
      setBody(next.report?.body ?? '');
      setNote(next.report?.curator_note ?? '');
      onSaved?.(next);
    } catch {
      if (live.current === issuedFor) setError('Не удалось сгенерировать отчёт');
    } finally {
      // Безусловно: этот флаг только выключает кнопки, и не сбросить его означает
      // оставить карточку навсегда заблокированной, если куратор ушёл с неё во время запроса.
      setBusy(false);
    }
  };

  const save = async () => {
    const issuedFor = identity;
    setBusy(true);
    setError(null);
    try {
      const row = await saveParentReport(studentId, {
        week,
        body,
        note: note.trim() || null,
      });
      if (live.current !== issuedFor) return;
      dirty.current = false;
      // Сливаем на самое свежее, что у нас есть, а не на снимок до запроса.
      const base = latest.current;
      if (!base) return;
      const next = { ...base, report: row };
      latest.current = next;
      setState(next);
      // Родитель держит свой кэш карточек — без этого он так и будет показывать
      // в списке карточек текст, которого на сервере уже нет.
      onSaved?.(next);
    } catch {
      if (live.current === issuedFor) setError('Не удалось сохранить правку');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Буфера нет по http и он может быть запрещён настройками. Молчать здесь нельзя:
      // куратор нажал кнопку, ничего не произошло, и он отправит родителю пустое сообщение.
      setError('Не удалось скопировать — выделите текст и скопируйте вручную');
    }
  };

  const suggested = state?.suggested_template;

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900">{studentName}</h3>
        {state?.report && (
          <span className="text-xs text-gray-500">
            {state.report.template_auto ? 'шаблон выбран автоматически' : 'шаблон выбран вручную'}
          </span>
        )}
      </header>

      {suggested && (
        <p className="text-xs text-gray-600">{state?.suggested_reason}</p>
      )}

      {state?.prose_degraded && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Текстовые формулировки сгенерировать не удалось — цифры, посещаемость и ДЗ
          проставлены, остальное допишите вручную.
        </p>
      )}

      {state?.facts.test_unavailable && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Платформа тестов не ответила — блок с результатами теста пропущен.
        </p>
      )}

      <label className="block text-sm text-gray-700">
        Заметка куратора
        <textarea
          className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm"
          rows={2}
          value={note}
          onChange={e => { dirty.current = true; setNote(e.target.value); }}
          placeholder="Что вы знаете об ученике, чего нет в данных"
          disabled={busy}
        />
      </label>

      <div className="flex items-center gap-2">
        <select
          className="border border-gray-300 rounded-lg p-2 text-sm"
          value={template}
          onChange={e => setTemplate(e.target.value as ParentTemplateKey | '')}
        >
          <option value="">
            {suggested ? `Автовыбор (${TEMPLATE_LABELS[suggested]})` : 'Автовыбор'}
          </option>
          {(Object.keys(TEMPLATE_LABELS) as ParentTemplateKey[]).map(key => (
            <option key={key} value={key}>{TEMPLATE_LABELS[key]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white disabled:opacity-50"
        >
          {state?.report ? 'Перегенерировать' : 'Сгенерировать'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {(state?.report || body) && (
        <>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono whitespace-pre-wrap"
            rows={14}
            value={body}
            onChange={e => { dirty.current = true; setBody(e.target.value); }}
            disabled={busy}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300"
            >
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 disabled:opacity-50"
            >
              Сохранить правку
            </button>
          </div>
        </>
      )}
    </section>
  );
}
