import { useState } from 'react';
import { Loader2, Sparkles, UserCheck, Wand2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  FACT_TEXT, TRIAGE_LABELS, labelInfo, type ReportTriage, type SortMode, type TriageLabel,
} from '../../../lib/reportTriage';
import { correctReportTriage, runReportTriage } from '../../../services/api/aiLabels';
import type { MessageKey, TFunction } from '../../../lib/i18n';
import { useT } from '../../../lib/i18n/react';
import '@/lib/i18n/catalogs/adminPages';

/** Label names and hints in the reader's language (lib/reportTriage keeps the English originals). */
const LABEL_TEXT: Record<TriageLabel, { name: MessageKey; hint: MessageKey }> = {
  key_wrong: { name: 'adminPages.questionReports.triage.label.keyWrong', hint: 'adminPages.questionReports.triage.label.keyWrongHint' },
  grading_issue: { name: 'adminPages.questionReports.triage.label.gradingIssue', hint: 'adminPages.questionReports.triage.label.gradingIssueHint' },
  question_broken: { name: 'adminPages.questionReports.triage.label.questionBroken', hint: 'adminPages.questionReports.triage.label.questionBrokenHint' },
  cant_tell: { name: 'adminPages.questionReports.triage.label.cantTell', hint: 'adminPages.questionReports.triage.label.cantTellHint' },
  student_wrong: { name: 'adminPages.questionReports.triage.label.studentWrong', hint: 'adminPages.questionReports.triage.label.studentWrongHint' },
  junk: { name: 'adminPages.questionReports.triage.label.junk', hint: 'adminPages.questionReports.triage.label.junkHint' },
};

const FACT_KEY: Record<string, MessageKey> = {
  question_missing: 'adminPages.questionReports.triage.fact.questionMissing',
  no_text: 'adminPages.questionReports.preview.noText',
  has_image: 'adminPages.questionReports.triage.fact.hasImage',
  no_key: 'adminPages.questionReports.triage.fact.noKey',
  key_conflict: 'adminPages.questionReports.triage.fact.keyConflict',
  key_out_of_range: 'adminPages.questionReports.triage.fact.keyOutOfRange',
};

const factText = (t: TFunction, fact: string) => (FACT_KEY[fact] ? t(FACT_KEY[fact]) : FACT_TEXT[fact] ?? fact);

/**
 * Jev's triage on the question-reports page (owner, 2026-09-30): a chip per report, a filter/sort bar,
 * and a panel to correct the label. A label changes no status; staff still decide.
 */
export function TriageChip({ triage }: { triage?: ReportTriage | null }) {
  const t = useT();
  const info = labelInfo(triage?.effective_label);
  if (!triage || (!info && !triage.facts.length)) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {info && (
        <span className={cn('inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold', info.tone)}
          title={`${t(LABEL_TEXT[info.key].hint)}${triage.corrected_label ? ` · ${t('adminPages.questionReports.triage.setByPerson')}` : triage.confidence != null ? ` · Jev ${Math.round(triage.confidence * 100)}%` : ''}`}>
          {triage.corrected_label ? <UserCheck className="h-3 w-3" aria-hidden /> : <Sparkles className="h-3 w-3" aria-hidden />}
          {t(LABEL_TEXT[info.key].name)}
        </span>
      )}
      {triage.facts.filter((f) => f !== 'has_image').map((f) => (
        <span key={f} className="rounded border border-rose-300 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:border-rose-800 dark:text-rose-300">
          {factText(t, f)}
        </span>
      ))}
    </span>
  );
}

export function TriageBar({ counts, filter, onFilter, sort, onSort, onLabelled }: {
  counts: Record<string, number>;
  filter: string;
  onFilter: (label: string) => void;
  sort: SortMode;
  onSort: (mode: SortMode) => void;
  onLabelled: () => void;
}) {
  const t = useT();
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const run = async () => {
    setRunning(true);
    setNote(null);
    try {
      const done = await runReportTriage();
      setNote(done.due
        ? t('adminPages.questionReports.triage.labelledWaiting', { labelled: done.labelled, due: done.due })
        : t('adminPages.questionReports.triage.labelled', { labelled: done.labelled }));
      onLabelled();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setRunning(false);
    }
  };
  const chip = (key: string, name: string, tone?: string) => (
    <button key={key} type="button" onClick={() => onFilter(filter === key ? '' : key)}
      className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition',
        filter === key ? 'ring-2 ring-brand' : 'hover:opacity-80', tone ?? 'border-border text-foreground')}>
      {name}<span className="tabular-nums opacity-70">{counts[key] ?? 0}</span>
    </button>
  );
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />{t('adminPages.questionReports.triage.barTitle')}
        </span>
        {TRIAGE_LABELS.map((l) => chip(l.key, t(LABEL_TEXT[l.key].name), l.tone))}
        {chip('none', t('adminPages.questionReports.triage.notLabelled'))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          {t('adminPages.questionReports.triage.order')}
          <select value={sort} onChange={(e) => onSort(e.target.value as SortMode)}
            className="rounded-lg border px-2 py-1 text-xs dark:border-border dark:bg-card dark:text-foreground">
            <option value="newest">{t('adminPages.questionReports.triage.newestFirst')}</option>
            <option value="urgent">{t('adminPages.questionReports.triage.urgentFirst')}</option>
          </select>
        </label>
        <button type="button" onClick={() => void run()} disabled={running}
          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-medium hover:bg-muted disabled:opacity-50 dark:border-border">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" aria-hidden />}{t('adminPages.questionReports.triage.labelNow')}
        </button>
        {note && <span className="text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

export function TriagePanel({ reportId, triage, onChanged }: {
  reportId: number;
  triage?: ReportTriage | null;
  onChanged: (next: ReportTriage) => void;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jev = labelInfo(triage?.label);
  const save = async (label: TriageLabel | null) => {
    setSaving(true);
    setError(null);
    try {
      onChanged(await correctReportTriage(reportId, label));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-lg border p-3 text-sm dark:border-border">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />{t('adminPages.questionReports.triage.panelTitle')}
      </p>
      <p className="text-foreground dark:text-foreground">
        {jev ? <>Jev: <b>{t(LABEL_TEXT[jev.key].name)}</b>{triage?.confidence != null && ` (${Math.round(triage.confidence * 100)}%)`} — {t(LABEL_TEXT[jev.key].hint)}</>
          : t('adminPages.questionReports.triage.notLabelledYet')}
      </p>
      {!!triage?.facts.length && (
        <ul className="mt-1.5 list-disc pl-5 text-xs text-rose-700 dark:text-rose-300">
          {triage.facts.map((f) => <li key={f}>{factText(t, f)}</li>)}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor={`triage-${reportId}`}>{t('adminPages.questionReports.triage.yourLabel')}</label>
        <select id={`triage-${reportId}`} value={triage?.corrected_label ?? ''} disabled={saving}
          onChange={(e) => void save((e.target.value || null) as TriageLabel | null)}
          className="rounded-lg border px-2 py-1 text-xs dark:border-border dark:bg-card dark:text-foreground">
          <option value="">{jev ? t('adminPages.questionReports.triage.agreeWithJev', { label: t(LABEL_TEXT[jev.key].name) }) : t('adminPages.questionReports.triage.none')}</option>
          {TRIAGE_LABELS.map((l) => <option key={l.key} value={l.key}>{t(LABEL_TEXT[l.key].name)}</option>)}
        </select>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {error && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{t('adminPages.questionReports.triage.footnote')}</p>
    </div>
  );
}
