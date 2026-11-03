import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/react';
import type { AnswerResponse } from '@/services/api/staffTrainingSearch';
import { citationLink } from './links';
import '@/lib/i18n/catalogs/staffTraining';

export type AnswerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; answer: AnswerResponse }
  | { status: 'failed' };

interface Props {
  state: AnswerState;
  /** Titles of the cited clips by chunk id, so a chip reads «Title · 0:42». */
  titleOf: (chunkId: number) => string;
  onAsk: () => void;
}

const NOTICES = { cap_reached: 'staffTraining.search.answer.cap', user_limit: 'staffTraining.search.answer.userLimit', error: 'staffTraining.search.answer.error' } as const;

/**
 * The short written answer. It only ever appears after the results; «I don't know» is a normal answer, not an error;
 * when answers are paused (monthly cap, daily limit) it says so in one line and the results carry on working.
 */
export default function AnswerPanel({ state, titleOf, onAsk }: Props) {
  const t = useT();
  if (state.status === 'idle') {
    return (
      <div data-answer="idle">
        <Button variant="outline" size="sm" onClick={onAsk}><Sparkles className="mr-2 h-4 w-4" aria-hidden />{t('staffTraining.search.answer.button')}</Button>
      </div>
    );
  }
  if (state.status === 'loading') {
    return <p role="status" data-answer="loading" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('staffTraining.search.answer.loading')}</p>;
  }
  if (state.status === 'failed') {
    return <p data-answer="error" className="text-sm text-muted-foreground">{t('staffTraining.search.answer.error')}</p>;
  }
  const { answer } = state;
  if (answer.reason === 'disabled') return null;
  if (answer.reason) return <p data-answer={answer.reason} className="text-sm text-muted-foreground">{t(NOTICES[answer.reason])}</p>;
  if (answer.unknown || !answer.answer) {
    return (
      <div data-answer="unknown" role="status" className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium text-foreground">{t('staffTraining.search.answer.unknown')}</p>
        <p className="mt-1 text-muted-foreground">{t('staffTraining.search.answer.unknownHint')}</p>
      </div>
    );
  }
  return (
    <section data-answer="answer" aria-labelledby="st-answer" className="rounded-2xl border border-primary/30 bg-primary/5 p-4 @lg:p-5">
      <h2 id="st-answer" className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" aria-hidden />{t('staffTraining.search.answer.title')}</h2>
      <p className="mt-2 text-base leading-relaxed text-foreground">{answer.answer}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">{t('staffTraining.search.answer.sources')}</span>
        {answer.citations.map((c) => {
          const { to, href } = citationLink(c);
          const label = [titleOf(c.chunk_id), c.label].filter(Boolean).join(' · ');
          const cls = 'inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted';
          if (to) return <Link key={c.chunk_id} to={to} data-citation={c.chunk_id} className={cls}><span className="truncate">{label}</span></Link>;
          if (href) return <a key={c.chunk_id} href={href} target="_blank" rel="noopener noreferrer" data-citation={c.chunk_id} className={cls}><span className="truncate">{label}</span><ExternalLink className="h-3 w-3 shrink-0" aria-hidden /></a>;
          return <span key={c.chunk_id} data-citation={c.chunk_id} className={cls}><span className="truncate">{label}</span></span>;
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t('staffTraining.search.answer.note')}</p>
    </section>
  );
}
