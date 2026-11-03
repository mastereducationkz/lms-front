import { Link } from 'react-router-dom';
import { BookText, ClipboardCheck, ExternalLink, PlayCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/react';
import type { SearchMoment, SearchResult } from '@/services/api/staffTrainingSearch';
import { pick } from '../model';
import { ROLE_KEYS } from '../ProgressList';
import { renderHighlight } from './highlight';
import { clipLink, momentLink, safeUrl, taskLink } from './links';
import '@/lib/i18n/catalogs/staffTraining';

type Locale = 'ru' | 'en';

function snippet(moment: SearchMoment, locale: Locale): string {
  const other: Locale = locale === 'ru' ? 'en' : 'ru';
  return moment.highlight[locale] || moment.highlight[other] || '';
}

const ICONS = { clip: PlayCircle, task: ClipboardCheck, handbook: BookText } as const;

/** One document with its best moments: a clip (each moment jumps to its second), a practice task, or a handbook section. */
export default function SearchResultCard({ result, locale }: { result: SearchResult; locale: Locale }) {
  const t = useT();
  const doc = result.document;
  const Icon = ICONS[doc.kind];
  const title = pick(doc.title, locale);
  const head = doc.kind === 'clip' ? clipLink(doc.clip_id, null) : doc.kind === 'task' ? taskLink(doc.task_id) : null;
  const handbookHref = doc.kind === 'handbook' ? safeUrl(doc.url) : null;

  return (
    <li data-result={doc.kind} className="rounded-2xl border border-border bg-card p-4 shadow-sm @lg:p-5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-foreground">
            {head ? <Link to={head} className="hover:underline">{title}</Link>
              : handbookHref ? <a href={handbookHref} target="_blank" rel="noopener noreferrer" className="hover:underline">{title}</a> : title}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{t(`staffTraining.search.kind.${doc.kind}`)}</span>
            {doc.kind !== 'handbook' && doc.role_tracks.filter((role) => role in ROLE_KEYS).map((role) => <span key={role}>{t(ROLE_KEYS[role])}</span>)}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {result.moments.map((moment) => {
          const to = momentLink(doc, moment);
          const sectionHref = doc.kind === 'handbook' ? safeUrl(moment.url) : null;
          const label = moment.label || (doc.kind === 'clip' ? t('staffTraining.search.fromStart') : '');
          const chip = 'inline-flex shrink-0 items-center rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular-nums text-foreground';
          return (
            <li key={moment.chunk_id} data-moment={moment.chunk_id} className="flex items-start gap-3 text-sm">
              {to && label ? (
                <Link to={to} className={`${chip} hover:bg-primary hover:text-primary-foreground`} aria-label={moment.label ? t('staffTraining.search.momentLink', { time: moment.label }) : label}>{label}</Link>
              ) : sectionHref ? (
                <a href={sectionHref} target="_blank" rel="noopener noreferrer" className={`${chip} gap-1 hover:bg-primary hover:text-primary-foreground`} aria-label={t('staffTraining.search.openSection')}>
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
              <p className="min-w-0 flex-1 text-foreground/90">{renderHighlight(snippet(moment, locale))}</p>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
