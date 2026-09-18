import { useEffect, useState } from 'react';

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

  useEffect(() => {
    setState(initial);
    setBody(initial?.report?.body ?? '');
    setNote(initial?.report?.curator_note ?? '');
  }, [initial, studentId, week]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await generateParentReport(studentId, {
        week,
        template: template || undefined,
        note: note.trim() || undefined,
      });
      setState(next);
      setBody(next.report?.body ?? '');
      onSaved?.(next);
    } catch {
      setError('Не удалось сгенерировать отчёт');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveParentReport(studentId, { week, body });
    } catch {
      setError('Не удалось сохранить правку');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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
          onChange={e => setNote(e.target.value)}
          placeholder="Что вы знаете об ученике, чего нет в данных"
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
            onChange={e => setBody(e.target.value)}
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
