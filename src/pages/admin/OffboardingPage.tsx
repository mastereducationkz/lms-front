import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Settings, ShieldCheck, UserMinus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import ConfirmDialog from '../../components/ConfirmDialog';
import { toast } from '../../components/Toast';
import { StatusBadge } from '../../components/offboarding/parts';
import { useAuth } from '../../contexts/AuthContext';
import { useOffboardingConfig } from '../../hooks/useOffboardingConfig';
import { recordActions, unresolvedItems } from '../../lib/offboarding';
import {
  cancelOffboarding,
  confirmOffboarding,
  listOffboardings,
  type OffboardingRecord,
} from '../../services/api/offboarding';
import { roleLabel } from '../../lib/roleLabel';
import { formatDate, type MessageKey } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

type Tab = 'open' | 'needs' | 'history';
const HISTORY = ['completed', 'cancelled', 'reactivated'] as const;
const PAGE = 100;
const TABS: ReadonlyArray<{ tab: Tab; label: MessageKey; empty: MessageKey }> = [
  { tab: 'open', label: 'offboarding.page.leavingSoon', empty: 'offboarding.page.emptyLeaving' },
  { tab: 'needs', label: 'offboarding.page.needsReassignment', empty: 'offboarding.page.emptyNeeds' },
  { tab: 'history', label: 'offboarding.page.history', empty: 'offboarding.page.emptyHistory' },
];

/**
 * Offboarding (SPEC §9): «Leaving soon» — records waiting for their last day, a second admin, or
 * a hand-over — with cancel and confirm; «Needs reassignment» — emergency switch-offs whose groups
 * and lessons nobody has taken over yet (SPEC §12, read from completed records); and the history. Heads see the records of the people
 * they may offboard (the server scopes the list).
 */
export default function OffboardingPage() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const config = useOffboardingConfig(user?.role);
  const viewerId = user?.id != null ? Number(user.id) : null;
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('open');
  const [records, setRecords] = useState<OffboardingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ record: OffboardingRecord; action: 'cancel' | 'confirm' } | null>(null);

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'needs') {
        const page = await listOffboardings(['completed'], { limit: 500 });
        const needs = page.items.filter((r) => unresolvedItems(r).length > 0);
        setRecords(needs);
        setTotal(needs.length);
        return;
      }
      const page = await listOffboardings(tab === 'open' ? 'open' : HISTORY, { limit: PAGE, offset });
      setRecords((current) => (offset ? [...current, ...page.items] : page.items));
      setTotal(page.total);
    } catch (e) {
      setError((e instanceof Error && e.message) || t('offboarding.page.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  useEffect(() => {
    if (config?.enabled) load();
  }, [config?.enabled, load]);

  const act = async () => {
    if (!asking) return;
    const { record, action } = asking;
    setAsking(null);
    try {
      await (action === 'cancel' ? cancelOffboarding(record.id) : confirmOffboarding(record.id));
      toast(t(action === 'cancel' ? 'offboarding.open.cancelled' : 'offboarding.open.confirmed'), 'success');
      load();
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.open.actionFailed'), 'error');
    }
  };

  if (config && !config.enabled) {
    return <p className="p-6 text-sm text-muted-foreground">{t('offboarding.page.disabled')}</p>;
  }

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <UserMinus className="h-6 w-6" aria-hidden="true" />
            {t('offboarding.page.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('offboarding.page.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" asChild>
                <Link to="/admin/offboarding/access-review"><ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />{t('offboarding.page.accessReview')}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/admin/offboarding/settings"><Settings className="mr-2 h-4 w-4" aria-hidden="true" />{t('offboarding.page.settings')}</Link>
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('offboarding.page.refresh')}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t('offboarding.page.startHint')}</p>

      <div role="tablist" className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {TABS.map((item) => (
          <button key={item.tab} role="tab" aria-selected={tab === item.tab} className={tabClass(tab === item.tab)} onClick={() => setTab(item.tab)}>
            {t(item.label)}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {!loading && !error && records.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(TABS.find((item) => item.tab === tab)!.empty)}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('offboarding.col.person')}</TableHead>
                <TableHead>{t('offboarding.col.lastDay')}</TableHead>
                {isAdmin && <TableHead>{t('offboarding.col.reason')}</TableHead>}
                <TableHead>{t('offboarding.col.status')}</TableHead>
                <TableHead>{t('offboarding.col.requestedBy')}</TableHead>
                <TableHead className="text-right">{t('offboarding.col.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const allowed = recordActions(record, viewerId);
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="whitespace-nowrap font-medium text-foreground">{record.target.name}</div>
                      {record.target.role && <div className="text-xs text-muted-foreground">{roleLabel(record.target.role, locale)}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(record.last_day)}
                      <div className="text-xs text-muted-foreground">{t(`offboarding.mode.${record.mode}`)}</div>
                    </TableCell>
                    {isAdmin && <TableCell>{record.reason_code ? t(`offboarding.reason.${record.reason_code}`) : '—'}</TableCell>}
                    <TableCell>
                      <StatusBadge status={record.status} />
                      {unresolvedItems(record).length > 0 && (
                        <div className="mt-1 text-xs text-destructive">{t('offboarding.page.openItemsCount', { count: unresolvedItems(record).length })}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{record.requested_by?.name ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {tab === 'open' && allowed.confirm && (
                          <Button size="sm" onClick={() => setAsking({ record, action: 'confirm' })}>{t('offboarding.page.confirm')}</Button>
                        )}
                        {tab === 'open' && allowed.cancel && (
                          <Button size="sm" variant="outline" onClick={() => setAsking({ record, action: 'cancel' })}>{t('offboarding.page.cancel')}</Button>
                        )}
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/admin/offboarding/${record.id}`}>{t('offboarding.page.view')}</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {records.length < total && (
        <Button variant="outline" onClick={() => load(records.length)} disabled={loading}>{t('offboarding.page.more')}</Button>
      )}

      <ConfirmDialog
        open={asking !== null}
        description={asking ? t(asking.action === 'cancel' ? 'offboarding.open.cancelQuestion' : 'offboarding.record.confirmQuestion', { name: asking.record.target.name }) : undefined}
        confirmText={asking ? t(asking.action === 'cancel' ? 'offboarding.open.cancel' : 'offboarding.open.confirm') : undefined}
        onConfirm={act}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
