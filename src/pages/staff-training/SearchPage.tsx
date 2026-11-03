import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLocale, useT } from '@/lib/i18n/react';
import { answerTraining, searchTraining, type SearchResponse } from '@/services/api/staffTrainingSearch';
import { BackLink, LoadError, Loading, PageShell } from '@/components/staff-training/PageShell';
import AnswerPanel, { type AnswerState } from '@/components/staff-training/search/AnswerPanel';
import SearchBox from '@/components/staff-training/search/SearchBox';
import SearchResultCard from '@/components/staff-training/search/SearchResultCard';
import { wantsAutoAnswer } from '@/components/staff-training/search/links';
import { errorText, pick, statusOf } from '@/components/staff-training/model';
import { useLoad } from '@/components/staff-training/useLoad';
import '@/lib/i18n/catalogs/staffTraining';

const MAX_EXCERPTS = 8;

/** The chunks the answer may use: the best moments of the results, in the order they are shown. */
const excerptIds = (data: SearchResponse | null): number[] =>
  (data?.results ?? []).flatMap((r) => r.moments.map((m) => m.chunk_id)).slice(0, MAX_EXCERPTS);

/** /training/search?q=…: results grouped by clip, handbook or task, then (for a question) a short grounded answer. */
export default function SearchPage() {
  const t = useT();
  const locale = useLocale();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const { data, error, loading, reload } = useLoad<SearchResponse | null>(() => (q ? searchTraining(q) : Promise.resolve(null)), q);
  const [answer, setAnswer] = useState<AnswerState>({ status: 'idle' });

  const ask = useCallback(async (query: string, ids: number[]) => {
    setAnswer({ status: 'loading' });
    try {
      const result = await answerTraining(query, ids);
      setAnswer({ status: 'done', answer: result });
    } catch {
      setAnswer({ status: 'failed' });
    }
  }, []);

  // A new search starts with a clean answer; a question of three words or more is answered by itself, shorter ones on a button.
  useEffect(() => {
    setAnswer({ status: 'idle' });
    if (!data || !q || !data.answer_available || !wantsAutoAnswer(q)) return;
    const ids = excerptIds(data);
    if (!ids.length) return;
    let current = true;
    setAnswer({ status: 'loading' });
    answerTraining(q, ids)
      .then((result) => { if (current) setAnswer({ status: 'done', answer: result }); })
      .catch(() => { if (current) setAnswer({ status: 'failed' }); });
    return () => { current = false; };
  }, [data, q]);

  const titleOf = useMemo(() => {
    const byChunk = new Map<number, string>();
    for (const r of data?.results ?? []) for (const m of r.moments) byChunk.set(m.chunk_id, pick(r.document.title, locale));
    return (chunkId: number) => byChunk.get(chunkId) ?? '';
  }, [data, locale]);

  const submit = (query: string) => setParams({ q: query });
  const off = !!error && statusOf(error) === 404;
  const showButton = !!data && data.answer_available && !wantsAutoAnswer(q) && answer.status === 'idle';

  return (
    <PageShell>
      <BackLink to="/training">{t('staffTraining.backToTrack')}</BackLink>
      <header className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('staffTraining.search.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('staffTraining.search.subtitle')}</p>
      </header>
      <SearchBox initial={q} onSubmit={submit} autoFocus={!q} />

      {!q ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Search className="h-4 w-4" aria-hidden />{t('staffTraining.search.idle')}</p>
      ) : off ? (
        <p role="status" className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t('staffTraining.off')}</p>
      ) : error ? (
        <LoadError message={errorText(error, t, 'staffTraining.loadFailed')} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <section className="space-y-4" aria-live="polite" aria-label={t('staffTraining.search.resultsFor', { query: data.query || q })}>
          {data.answer_available && (
            showButton
              ? <AnswerPanel state={answer} titleOf={titleOf} onAsk={() => void ask(q, excerptIds(data))} />
              : answer.status !== 'idle' && <AnswerPanel state={answer} titleOf={titleOf} onAsk={() => undefined} />
          )}
          {data.results.length === 0 ? (
            <p data-no-results className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t('staffTraining.search.noResults', { query: data.query || q })}</p>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground">{t('staffTraining.search.resultsFor', { query: data.query || q })}</h2>
              <ul className="space-y-3">
                {data.results.map((r) => <SearchResultCard key={`${r.document.kind}-${'clip_id' in r.document ? r.document.clip_id : 'task_id' in r.document ? r.document.task_id : r.document.key}`} result={r} locale={locale} />)}
              </ul>
            </>
          )}
        </section>
      )}
    </PageShell>
  );
}
