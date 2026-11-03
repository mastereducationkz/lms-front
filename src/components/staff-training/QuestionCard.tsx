import { useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/react';
import type { AnswerResult, ClipQuestion } from '@/services/api/staffTraining';
import { errorText, pick } from './model';
import '@/lib/i18n/catalogs/staffTraining';

interface Props {
  question: ClipQuestion;
  index: number;
  total: number;
  locale: 'ru' | 'en';
  /** Sends the choice; the page keeps the clip's totals. Throws for a refusal. */
  onAnswer: (question: ClipQuestion, chosen: string[]) => Promise<AnswerResult>;
  /** «Показать момент»: the page seeks the video to `ms` and plays. */
  onShowMoment: (ms: number) => void;
}

/**
 * One question. A right answer closes it for good; a wrong one shows the one sentence that explains it and offers
 * to jump to that moment in the video. Retries are unlimited. The server only sends the explanation with a wrong
 * answer, so before one there is nothing to show.
 */
export default function QuestionCard({ question, index, total, locale, onAnswer, onShowMoment }: Props) {
  const t = useT();
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const passed = question.passed || result?.correct === true;
  const multi = question.kind === 'multi';

  const toggle = (id: string) => {
    if (passed) return;
    setError(null);
    setChosen((now) => (multi ? (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]) : [id]));
  };

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await onAnswer(question, chosen));
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      data-question={question.id}
      data-passed={passed}
      className={cn('rounded-2xl border bg-card p-4 shadow-sm @lg:p-5', passed ? 'border-emerald-300 dark:border-emerald-800' : 'border-border')}
    >
      <p className="text-xs font-medium text-muted-foreground">{t('staffTraining.question.count', { n: index + 1, total })}</p>
      <h3 className="mt-1 text-base font-semibold text-foreground">{pick(question.prompt, locale)}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{t(multi ? 'staffTraining.question.multi' : 'staffTraining.question.single')}</p>

      <fieldset className="mt-3 space-y-2" disabled={passed || busy}>
        <legend className="sr-only">{pick(question.prompt, locale)}</legend>
        {question.options.map((option) => {
          const on = chosen.includes(option.id);
          return (
            <label
              key={option.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors',
                on ? 'border-primary bg-brand-subtle/50' : 'border-border hover:bg-muted/50',
                (passed || busy) && 'cursor-default opacity-80',
              )}
            >
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={`question-${question.id}`}
                value={option.id}
                checked={on}
                onChange={() => toggle(option.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
              />
              <span className="min-w-0 text-foreground">{pick(option.text, locale)}</span>
            </label>
          );
        })}
      </fieldset>

      {passed ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {result?.correct ? t('staffTraining.question.correct') : t('staffTraining.question.passed')}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={check} disabled={busy || chosen.length === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {busy ? t('staffTraining.question.checking') : t('staffTraining.question.check')}
          </Button>
        </div>
      )}

      {result && !result.correct && (
        <div role="alert" data-explain className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
          <p className="flex items-center gap-2 font-medium"><XCircle className="h-4 w-4 shrink-0" aria-hidden />{t('staffTraining.question.wrong')}</p>
          {result.explain && (
            <>
              <p className="mt-1.5">{pick(result.explain.text, locale)}</p>
              <Button variant="outline" size="sm" className="mt-2.5 bg-background" onClick={() => onShowMoment(result.explain!.ms)}>
                {t('staffTraining.question.showMoment')}
              </Button>
            </>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </article>
  );
}
