import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  generateParentReport,
  saveParentReport,
  type ParentStudentResponse,
  type ParentTemplateKey,
} from '../../services/api/reports';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { MessageKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentReport';

const TEMPLATE_LABELS: Record<ParentTemplateKey, MessageKey> = {
  t1: 'studentReport.parent.template.t1',
  t2: 'studentReport.parent.template.t2',
  t3: 'studentReport.parent.template.t3',
  t4: 'studentReport.parent.template.t4',
  t5: 'studentReport.parent.template.t5',
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
  const t = useT();
  const [state, setState] = useState<ParentStudentResponse | null>(initial);
  const [body, setBody] = useState(initial?.report?.body ?? '');
  const [note, setNote] = useState(initial?.report?.curator_note ?? '');
  const [template, setTemplate] = useState<ParentTemplateKey | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
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
      if (live.current === issuedFor) setError('studentReport.parent.generateFailed');
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
      // Сливаем на самое свежее, что у нас есть, а не на снимок до запроса.
      const base = latest.current;
      if (!base) return;
      // Флаг снимается только здесь, после того как выход по !base уже позади: иначе
      // карточка считает текст сохранённым, ничего не применив, и следующий приход
      // initial молча откатит её к старому.
      dirty.current = false;
      const next = { ...base, report: row };
      latest.current = next;
      setState(next);
      // Родитель держит свой кэш карточек — без этого он так и будет показывать
      // в списке карточек текст, которого на сервере уже нет.
      onSaved?.(next);
    } catch {
      if (live.current === issuedFor) setError('studentReport.parent.saveFailed');
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
      setError('studentReport.parent.copyFailed');
    }
  };

  const suggested = state?.suggested_template;

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3 min-w-0">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{studentName}</h3>
        {state?.report && (
          <span className="text-xs text-muted-foreground">
            {t(state.report.template_auto ? 'studentReport.parent.templateAuto' : 'studentReport.parent.templateManual')}
          </span>
        )}
      </header>

      {suggested && (
        <p className="text-xs text-muted-foreground">{state?.suggested_reason}</p>
      )}

      {state?.prose_degraded && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded p-2">
          {t('studentReport.parent.proseDegraded')}
        </p>
      )}

      {state?.facts.test_unavailable && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded p-2">
          {t('studentReport.parent.testUnavailable')}
        </p>
      )}

      <label className="block text-sm text-foreground">
        {t('studentReport.parent.note')}
        <textarea
          className="mt-1 w-full border border-border bg-background text-foreground placeholder:text-muted-foreground rounded-lg p-2 text-sm"
          rows={2}
          value={note}
          onChange={e => { dirty.current = true; setNote(e.target.value); }}
          placeholder={t('studentReport.parent.notePlaceholder')}
          disabled={busy}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={template || 'auto'}
          onValueChange={value => setTemplate(value === 'auto' ? '' : value as ParentTemplateKey)}
          disabled={busy}
        >
          <SelectTrigger className="h-auto min-h-10 min-w-0 flex-1 basis-48 rounded-lg border-border py-2 text-left">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              {suggested ? t('studentReport.parent.autoSelectWith', { template: t(TEMPLATE_LABELS[suggested]) }) : t('studentReport.parent.autoSelect')}
            </SelectItem>
            {(Object.keys(TEMPLATE_LABELS) as ParentTemplateKey[]).map(key => (
              <SelectItem key={key} value={key}>{t(TEMPLATE_LABELS[key])}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="shrink-0 px-3 py-2 text-sm rounded-lg bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground disabled:opacity-50"
        >
          {state?.report ? t('studentReport.parent.regenerate') : t('studentReport.parent.generate')}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-300">{t(error)}</p>}

      {(state?.report || body) && (
        <>
          <textarea
            className="w-full border border-border bg-background text-foreground rounded-lg p-3 text-sm font-mono whitespace-pre-wrap"
            rows={14}
            value={body}
            onChange={e => { dirty.current = true; setBody(e.target.value); }}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="px-3 py-2 text-sm rounded-lg border border-border"
            >
              {copied ? t('common.copied') : t('studentReport.parent.copy')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-3 py-2 text-sm rounded-lg border border-border disabled:opacity-50"
            >
              {t('studentReport.parent.saveEdit')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
