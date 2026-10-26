import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatDate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import type { PastPaperCatalogEntry } from '@/services/api/pastPapers';
import type { PastPaperCatalogState } from '../../hooks/usePastPaperCatalog';
import '@/lib/i18n/catalogs/pastPapers';

interface Content {
  paper_id?: number | null;
  paper_title?: string;
  is_partial?: boolean;
}

interface Props {
  content: Content;
  onContentChange: (content: Content) => void;
  /** The paper list from `usePastPaperCatalog`, read once by the editor that owns the task types. */
  catalogState: PastPaperCatalogState;
  groupIds?: number[];
  /** Group names for the per-group counts. */
  groupNames?: Record<number, string>;
}

/**
 * The teacher's paper picker: a searchable list of SAT's published papers, each showing, for the
 * homework's groups, how many students already did it ("already done by 3 of 12") and how many are
 * in the middle of it. Picking writes `paper_id / paper_title / is_partial`; the server confirms
 * them against the catalog on save. Renders nothing while the feature is switched off.
 */
export default function PastPaperTaskEditor({ content, onContentChange, catalogState, groupIds = [], groupNames = {} }: Props) {
  const t = useT();
  const [query, setQuery] = useState('');
  const { catalog, loading, failed, reload } = catalogState;

  const papers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = catalog?.papers ?? [];
    return needle ? list.filter((p) => p.title.toLowerCase().includes(needle)) : list;
  }, [catalog, query]);

  // Switched off: a task already stored in an old homework still names its paper, nothing can be picked.
  if (catalog && !catalog.enabled) {
    return content.paper_id != null ? <p className="text-sm font-medium">{content.paper_title}</p> : null;
  }

  const pick = (paper: PastPaperCatalogEntry) =>
    onContentChange({ ...content, paper_id: paper.id, paper_title: paper.title, is_partial: paper.is_partial });

  return (
    <div className="space-y-3">
      {content.paper_id != null && (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="picked-paper">
          <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span className="font-medium">{content.paper_title}</span>
          {content.is_partial && <Badge variant="outline">{t('pastPapers.partial')}</Badge>}
        </p>
      )}

      {loading && !catalog && <p className="text-sm text-muted-foreground">{t('pastPapers.picker.loading')}</p>}

      {(failed || (catalog && !catalog.available)) && (
        <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
          {t('pastPapers.picker.unavailable')}
          <Button type="button" variant="link" size="sm" className="px-1" onClick={reload}>
            {t('pastPapers.picker.retry')}
          </Button>
        </p>
      )}

      {catalog?.available && (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('pastPapers.picker.search')}
              aria-label={t('pastPapers.picker.search')}
              className="pl-8"
            />
          </div>
          {groupIds.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('pastPapers.picker.chooseGroups')}</p>
          )}
          <ul className="max-h-72 space-y-1.5 overflow-y-auto" aria-label={t('pastPapers.picker.listLabel')}>
            {papers.length === 0 && <li className="p-2 text-sm text-muted-foreground">{t('pastPapers.picker.noMatch')}</li>}
            {papers.map((paper) => {
              const selected = paper.id === content.paper_id;
              const groups = paper.groups.filter((g) => groupIds.includes(g.group_id));
              return (
                <li key={paper.id}>
                  <button
                    type="button"
                    onClick={() => pick(paper)}
                    aria-pressed={selected}
                    className={`w-full rounded-md border p-2.5 text-left text-sm transition-colors hover:bg-muted/50 ${selected ? 'border-brand bg-brand-surface' : 'border-border'}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{paper.title}</span>
                      {paper.is_partial && <Badge variant="outline">{t('pastPapers.partial')}</Badge>}
                      {paper.is_prediction && <Badge variant="outline">{t('pastPapers.prediction')}</Badge>}
                      {paper.test_date && (
                        <span className="text-xs text-muted-foreground">{t('pastPapers.picker.testDate', { date: formatDate(paper.test_date) })}</span>
                      )}
                    </span>
                    {groups.map((g) => (
                      <span key={g.group_id} className="mt-0.5 block text-xs text-muted-foreground" data-testid="group-count">
                        {groupNames[g.group_id] ? `${groupNames[g.group_id]}: ` : ''}
                        {t('pastPapers.picker.alreadyDone', { done: g.done, total: g.total })}
                        {g.in_progress > 0 && ` · ${t('pastPapers.picker.inProgress', { count: g.in_progress })}`}
                      </span>
                    ))}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
