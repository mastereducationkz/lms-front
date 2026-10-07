import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessagesSquare, Sparkles, UserCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDateTime, type MessageKey, type TFunction } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import {
  correctBotQuestionTopic, getBotQuestionsSummary, listBotQuestions,
  type BotOutcome, type BotQuestion, type BotQuestionsSummary,
} from '../../services/api/aiLabels';
import '@/lib/i18n/catalogs/announcements';

const OUTCOMES: { key: BotOutcome; name: MessageKey; hint: MessageKey }[] = [
  { key: 'answered', name: 'announcements.bot.outcomeAnswered', hint: 'announcements.bot.outcomeAnsweredHint' },
  { key: 'curator', name: 'announcements.bot.outcomeCurator', hint: 'announcements.bot.outcomeCuratorHint' },
  { key: 'private', name: 'announcements.bot.outcomePrivate', hint: 'announcements.bot.outcomePrivateHint' },
  { key: 'silent', name: 'announcements.bot.outcomeSilent', hint: 'announcements.bot.outcomeSilentHint' },
];
const PERIODS = [7, 30, 90];

function outcomeName(tr: TFunction, outcome: BotOutcome): string {
  const found = OUTCOMES.find((o) => o.key === outcome);
  return found ? tr(found.name) : '';
}

function when(iso: string): string {
  return formatDateTime(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * What students ask the group bot (owner, 2026-09-30): Jev reads each question after the fact and says
 * what it was about; the table puts that beside what the bot did — so the gaps (what goes to curators)
 * are visible. Staff can correct a topic; the correction is kept beside Jev's.
 */
export function BotQuestionsTab() {
  const tr = useT();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<BotQuestionsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<{ topic?: string; outcome?: BotOutcome } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setSummary(await getBotQuestionsSummary(days)); } catch (e) { setError((e as Error).message); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!summary) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const totals = OUTCOMES.map((o) => summary.topics.reduce((sum, t) => sum + t[o.key], 0));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessagesSquare className="h-4 w-4" aria-hidden />
          {tr('announcements.bot.summary', {
            questions: tr('announcements.bot.questions', { count: summary.total }),
            days: tr('common.days', { count: summary.days }),
          })}
          {summary.unlabelled > 0 && ` · ${tr('announcements.bot.unlabelled', { count: summary.unlabelled })}`}
          {!summary.configured && ` · ${tr('announcements.bot.notConfigured')}`}
        </p>
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={tr('announcements.bot.period')}>
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => setDays(p)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium', days === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
              {tr('common.days', { count: p })}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" aria-hidden />{tr('announcements.bot.topic')}</span></th>
              <th className="px-3 py-2 text-right font-medium">{tr('common.all')}</th>
              {OUTCOMES.map((o) => <th key={o.key} className="px-3 py-2 text-right font-medium" title={tr(o.hint)}>{tr(o.name)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {summary.topics.map((t) => (
              <tr key={t.topic} className={cn(pick?.topic === t.topic && !pick.outcome && 'bg-primary/5')}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => setPick({ topic: t.topic })} className="font-medium text-foreground hover:underline">{t.label}</button>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{t.total}</td>
                {OUTCOMES.map((o) => (
                  <td key={o.key} className="px-3 py-2 text-right tabular-nums">
                    {t[o.key] ? (
                      <button type="button" onClick={() => setPick({ topic: t.topic, outcome: o.key })}
                        className={cn('hover:underline', o.key === 'curator' && 'font-semibold text-amber-700 dark:text-amber-400',
                          pick?.topic === t.topic && pick.outcome === o.key && 'rounded bg-primary/10 px-1')}>
                        {t[o.key]}
                      </button>
                    ) : <span className="text-muted-foreground">·</span>}
                  </td>
                ))}
              </tr>
            ))}
            {summary.topics.length > 0 && (
              <tr className="bg-muted/30 text-xs font-semibold">
                <td className="px-3 py-2">{tr('announcements.bot.total')}</td>
                <td className="px-3 py-2 text-right tabular-nums">{summary.total - summary.unlabelled}</td>
                {totals.map((n, i) => <td key={OUTCOMES[i].key} className="px-3 py-2 text-right tabular-nums">{n}</td>)}
              </tr>
            )}
          </tbody>
        </table>
        {summary.topics.length === 0 && <p className="p-4 text-sm text-muted-foreground">{tr('announcements.bot.nothingLabelled')}</p>}
      </div>
      {pick && <QuestionList days={days} topic={pick.topic} outcome={pick.outcome} labels={summary.labels} onChanged={() => void load()} />}
    </div>
  );
}

function QuestionList({ days, topic, outcome, labels, onChanged }: {
  days: number; topic?: string; outcome?: BotOutcome; labels: Record<string, string>; onChanged: () => void;
}) {
  const tr = useT();
  const [rows, setRows] = useState<BotQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setRows(null);
    listBotQuestions(days, topic, outcome).then((r) => { if (alive) setRows(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [days, topic, outcome]);
  const fix = async (row: BotQuestion, next: string) => {
    try {
      const saved = await correctBotQuestionTopic(row.id, next || null);
      setRows((prev) => prev && prev.map((r) => (r.id === row.id ? { ...r, topic: saved.topic, corrected: Boolean(next) } : r)));
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!rows) return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  return (
    <section className="rounded-xl border border-border">
      <h3 className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground">
        {topic ? labels[topic] ?? topic : tr('announcements.bot.allTopics')}{outcome ? ` · ${outcomeName(tr, outcome)}` : ''} · {rows.length}
      </h3>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="min-w-0">
              <p className="whitespace-pre-wrap break-words text-foreground">{r.question}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {when(r.created_at)} · {r.group ?? r.chat_title ?? '—'} · {outcomeName(tr, r.outcome)}
                {r.intent ? ` (${r.intent})` : ''}
              </p>
            </div>
            <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {r.corrected ? <UserCheck className="h-3.5 w-3.5" aria-label={tr('announcements.bot.setByPerson')} /> : <Sparkles className="h-3.5 w-3.5" aria-label="Jev" />}
              <select value={r.topic ?? ''} onChange={(e) => void fix(r, e.target.value)}
                className="rounded-md border border-border bg-card px-1.5 py-1 text-xs text-foreground" aria-label={tr('announcements.bot.topic')}>
                {!r.topic && <option value="">—</option>}
                {Object.entries(labels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
              {r.confidence != null && !r.corrected && <span className="tabular-nums">{Math.round(r.confidence * 100)}%</span>}
            </label>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">{tr('announcements.bot.noQuestions')}</p>}
    </section>
  );
}
