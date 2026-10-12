import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ListChecks, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { formatTime } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { failureDetail, getTelegramChecklist, type TelegramChecklist } from '../../services/api/masterLeagueSetup';
import { MasterLeagueGroupChecklist } from './MasterLeagueGroupChecklist';
import '@/lib/i18n/catalogs/announcements';

/** Coming back to the tab (after fixing something in Telegram) re-reads at most this often. */
const REFOCUS_REFRESH_MS = 15_000;

interface Props {
  /** Bump it to re-read the checklist, for example after the chat links below changed. */
  refreshKey?: number;
  /** Jump to the Groups tab, where a chat is approved. */
  onOpenGroups?: () => void;
}

/**
 * Master League groups only: which Telegram setup steps are still open (lms-backend
 * `GET /master-league/telegram-checklist`, read-only). Nothing in Telegram happens by itself for a
 * new group, and linking a chat too early breaks its greeting for good, so the card says what is
 * done, what to do next and what has to wait. It renders nothing while no Master League group is
 * live, which is most of the year.
 */
export function MasterLeagueChecklistCard({ refreshKey = 0, onOpenGroups }: Props) {
  const t = useT();
  const [data, setData] = useState<TelegramChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ detail: string | null } | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  // Only the newest request may write: a slow answer must not overwrite a fresher one.
  const latest = useRef(0);
  const startedAt = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    startedAt.current = Date.now();
    setLoading(true);
    try {
      const next = await getTelegramChecklist();
      if (mine !== latest.current) return;
      setData(next);
      setFailure(null);
      setCheckedAt(new Date());
    } catch (error) {
      if (mine !== latest.current) return;
      setFailure({ detail: failureDetail(error) });
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => () => { latest.current += 1; }, []);

  useEffect(() => {
    const refocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - startedAt.current > REFOCUS_REFRESH_MS) void load();
    };
    document.addEventListener('visibilitychange', refocus);
    window.addEventListener('focus', refocus);
    return () => {
      document.removeEventListener('visibilitychange', refocus);
      window.removeEventListener('focus', refocus);
    };
  }, [load]);

  if (!data && loading) {
    return (
      <div role="status" className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('announcements.mlChecklist.loading')}
      </div>
    );
  }
  if (data && data.groups.length === 0 && !failure) return null;

  const groups = data?.groups ?? [];
  return (
    <Card aria-busy={loading}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
              {t('announcements.mlChecklist.title')}
            </CardTitle>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('announcements.mlChecklist.intro')}</p>
          </div>
          <div className="flex items-center gap-3">
            {checkedAt && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {t('announcements.mlChecklist.updated', { time: formatTime(checkedAt) })}
              </span>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              {t('announcements.page.refresh')}
            </Button>
          </div>
        </div>

        {failure && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t('announcements.mlChecklist.loadFailed')}</p>
              {failure.detail && <p className="break-words">{failure.detail}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void load()} disabled={loading}>
              {t('announcements.mlChecklist.retry')}
            </Button>
          </div>
        )}
        {data?.registry_error && (
          <div role="status" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <p className="min-w-0 break-words">
              {t('announcements.mlChecklist.supportDown')}
              {' '}<span className="text-xs">{data.registry_error}</span>
            </p>
          </div>
        )}
      </CardHeader>

      {groups.length > 0 && (
        <CardContent className={`grid gap-4 pt-0 ${groups.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {groups.map((group) => (
            <MasterLeagueGroupChecklist key={group.id} group={group} onOpenGroups={onOpenGroups} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
