import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { toast } from '../Toast';
import { errorMessage, formatDateTime } from './shared';
import { getAutomaticMessages } from '../../services/api/announcements';
import type { AutomaticMessage } from '../../services/api/announcements';
import { AUTOMATIC_KINDS, KIND_LABELS, isLongText, type AutomaticKind } from '../../lib/automaticMessages';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

const PAGE = 50;
const PERIODS = [1, 7, 30, 90] as const;
const PERIOD_KEYS = {
  1: 'announcements.automatic.period.1',
  7: 'announcements.automatic.period.7',
  30: 'announcements.automatic.period.30',
  90: 'announcements.automatic.period.90',
} as const;
const select = 'rounded-md border border-input bg-background px-3 py-2 text-sm';

const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

/**
 * Everything the bot has posted on its own account - digests, weekly-test notices, homework and lesson notices, webinar
 * posts ... - newest first, for the record. Read from Support's own log of outbound messages; what staff wrote is in
 * History.
 */
export function AutomaticMessagesTab() {
  const t = useT();
  const [days, setDays] = useState<number>(7);
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AutomaticMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const latest = useRef(0);

  // A word typed in the search box is asked for once the typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const page = await getAutomaticMessages({ days, kind, status, q: query, limit: PAGE, offset: 0 });
      if (ticket !== latest.current) return;                       // a newer filter has been asked for since
      setItems(page.items);
      setTotal(page.total);
      setOpen(new Set());
    } catch (error) {
      if (ticket === latest.current) toast(errorMessage(error, t('announcements.automatic.loadFailed')), 'error');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [days, kind, status, query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await getAutomaticMessages({ days, kind, status, q: query, limit: PAGE, offset: items.length });
      setItems((current) => [...current, ...page.items]);
      setTotal(page.total);
    } catch (error) {
      toast(errorMessage(error, t('announcements.automatic.loadFailed')), 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (id: number) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('announcements.automatic.hint')}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="auto-days" className="block text-xs font-medium">{t('announcements.automatic.period')}</label>
          <select id="auto-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={`mt-1 ${select}`}>
            {PERIODS.map((p) => <option key={p} value={p}>{t(PERIOD_KEYS[p])}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="auto-kind" className="block text-xs font-medium">{t('announcements.automatic.kindLabel')}</label>
          <select id="auto-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`mt-1 ${select}`}>
            <option value="">{t('announcements.automatic.allKinds')}</option>
            {AUTOMATIC_KINDS.map((k) => <option key={k} value={k}>{t(KIND_LABELS[k])}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="auto-status" className="block text-xs font-medium">{t('announcements.automatic.statusLabel')}</label>
          <select id="auto-status" value={status} onChange={(e) => setStatus(e.target.value)} className={`mt-1 ${select}`}>
            <option value="">{t('announcements.automatic.anyStatus')}</option>
            <option value="sent">{t('announcements.automatic.status.sent')}</option>
            <option value="failed">{t('announcements.automatic.status.failed')}</option>
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="auto-search" className="block text-xs font-medium">{t('announcements.automatic.search')}</label>
          <Input id="auto-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1"
                 placeholder={t('announcements.automatic.searchPlaceholder')} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />{t('announcements.automatic.refresh')}
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t('announcements.automatic.empty')}</CardContent></Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t('announcements.automatic.showing', { shown: items.length, total })}</p>
          <div className="space-y-3">
            {items.map((item) => {
              const long = isLongText(item.text);
              const expanded = open.has(item.id);
              const kindKey = (AUTOMATIC_KINDS as readonly string[]).includes(item.kind) ? KIND_LABELS[item.kind as AutomaticKind] : KIND_LABELS.other;
              return (
                <Card key={item.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatDateTime(item.sent_at ?? item.created_at)}</span>
                      <Badge variant="outline">{t(kindKey)}</Badge>
                      <span className="font-medium text-foreground">{item.chat_title ?? '—'}</span>
                      <Badge className={STATUS_STYLE[item.status] ?? 'bg-muted text-muted-foreground'}>{item.status}</Badge>
                    </div>
                    <p className={`whitespace-pre-wrap break-words text-sm ${long && !expanded ? 'line-clamp-4' : ''}`}>{item.text}</p>
                    {long && (
                      <button type="button" onClick={() => toggle(item.id)} className="text-xs font-medium text-primary hover:underline">
                        {expanded ? t('announcements.automatic.showLess') : t('announcements.automatic.showMore')}
                      </button>
                    )}
                    {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {items.length < total && (
            <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
              {t('announcements.automatic.loadMore')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
