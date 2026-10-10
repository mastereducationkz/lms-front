import { useEffect, useState, type ReactNode } from 'react';
import { Repeat } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getEventSeries } from '../../services/api';
import type { EventSeriesSummary } from '../../services/api/events';
import { hostSuggestion } from '../../lib/eventSeries';
import { useT } from '../../lib/i18n/react';
import type { Event } from '../../types';
import { SeriesScopePicker, type SeriesScope } from './SeriesScope';
import '@/lib/i18n/catalogs/adminPages';

/** Where the event being edited stands in its recurring series, and which weeks the edit applies to. */
export function useEventSeries(event?: Event) {
  const [summary, setSummary] = useState<EventSeriesSummary | null>(null);
  const [scope, setScope] = useState<SeriesScope>('this');
  useEffect(() => {
    if (!event?.series_id) return;
    let cancelled = false;
    getEventSeries(event.id).then((info) => { if (!cancelled) setSummary(info); }).catch(() => { /* the edit still works on this event */ });
    return () => { cancelled = true; };
  }, [event?.id, event?.series_id]);
  const canFollow = !!summary && summary.following > 1;
  return { summary, scope: canFollow ? scope : 'this' as SeriesScope, setScope, wholeSeries: canFollow && scope === 'following' };
}

/** The «Weekly series - event 3 of 50» card of the edit form: apply the changes to this event or to the rest. */
export function SeriesEditSection({ summary, scope, onScopeChange, children }: {
  summary: EventSeriesSummary;
  scope: SeriesScope;
  onScopeChange: (scope: SeriesScope) => void;
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="w-5 h-5" aria-hidden />
          {t('adminPages.events.series.formTitle', { position: summary.position ?? '–', total: summary.total })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.following > 1 && (
          <>
            <p className="text-sm font-medium">{t('adminPages.events.series.applyTo')}</p>
            <SeriesScopePicker value={scope} onChange={onScopeChange} following={summary.following} name="series-edit-scope" />
            {scope === 'following' && <p className="text-xs text-muted-foreground">{t('adminPages.events.series.followingHint')}</p>}
          </>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * A title is plain text: changing the host does not rename the event. When the title names a host, this offers it with
 * the new host's given name in it - applied only on a click.
 */
export function HostTitleSuggestion({ title, oldHost, newHost, onUse }: { title: string; oldHost: string; newHost: string; onUse: (title: string) => void }) {
  const t = useT();
  const suggestion = hostSuggestion(title, oldHost, newHost);
  if (!suggestion) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
      <span>{t('adminPages.events.series.hostSuggest')}</span>
      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onUse(suggestion)}>
        {t('adminPages.events.series.useTitle', { title: suggestion })}
      </Button>
    </div>
  );
}
