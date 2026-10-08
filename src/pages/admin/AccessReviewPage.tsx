import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import ConfirmDialog from '../../components/ConfirmDialog';
import { toast } from '../../components/Toast';
import { useOffboardLauncher } from '../../components/offboarding/useOffboardLauncher';
import { useAuth } from '../../contexts/AuthContext';
import { useOffboardingConfig } from '../../hooks/useOffboardingConfig';
import {
  clearContactDetails,
  getAccessReview,
  keepAccessReviewRow,
  rowActions,
  type AccessReview,
  type AccessReviewRow,
} from '../../services/api/accessReview';
import { targetRef } from '../../lib/offboarding';
import { formatDate, formatDateTime, hasMessage } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

/**
 * Access review (SPEC §10): accounts in any system that do not belong to an active staff member,
 * each kept with a reason or offboarded; former staff whose contact details outlived three years.
 * The review is built by the backend once a month; this page shows whatever rows it returns.
 */
export default function AccessReviewPage() {
  const t = useT();
  const { user } = useAuth();
  const config = useOffboardingConfig(user?.role);
  const launcher = useOffboardLauncher(() => load());
  const [review, setReview] = useState<AccessReview | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keeping, setKeeping] = useState<{ id: AccessReviewRow['id']; reason: string } | null>(null);
  const [clearing, setClearing] = useState<AccessReviewRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReview(await getAccessReview());
    } catch (e) {
      setError((e instanceof Error && e.message) || t('offboarding.review.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (config?.enabled) load();
  }, [config?.enabled, load]);

  const keep = async () => {
    if (!keeping?.reason.trim()) return;
    try {
      await keepAccessReviewRow(keeping.id, keeping.reason.trim());
      setKeeping(null);
      load();
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.review.actionFailed'), 'error');
    }
  };

  const clear = async () => {
    const row = clearing;
    setClearing(null);
    if (!row) return;
    try {
      await clearContactDetails(row.id);
      toast(t('offboarding.review.cleared'), 'success');
      load();
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.review.actionFailed'), 'error');
    }
  };

  const whyListed = (row: AccessReviewRow) => {
    const key = `offboarding.review.kind.${row.kind}`;
    return row.kind && hasMessage(key) ? t(key) : row.reason ?? '';
  };

  if (config && !config.enabled) {
    return <p className="p-6 text-sm text-muted-foreground">{t('offboarding.page.disabled')}</p>;
  }

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <Button variant="ghost" asChild className="-ml-2 w-fit pl-0 text-muted-foreground">
        <Link to="/admin/offboarding"><ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />{t('offboarding.record.back')}</Link>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            {t('offboarding.review.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('offboarding.review.subtitle')}</p>
          {review?.built_at && <p className="text-xs text-muted-foreground">{t('offboarding.review.builtAt', { date: formatDateTime(review.built_at) })}</p>}
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {t('offboarding.page.refresh')}
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {review === null && <p className="text-sm text-muted-foreground">{t('offboarding.review.notReady')}</p>}
      {review && review.rows.length === 0 && <p className="text-sm text-muted-foreground">{t('offboarding.review.empty')}</p>}

      {review && review.rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('offboarding.review.system')}</TableHead>
                <TableHead>{t('offboarding.review.account')}</TableHead>
                <TableHead>{t('offboarding.review.why')}</TableHead>
                <TableHead>{t('offboarding.review.decision')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {review.rows.map((row) => {
                const actions = rowActions(row);
                const ref = targetRef({ lms_user_id: row.lms_user_id ?? null, crm_user_id: row.crm_user_id ?? null });
                const isKeeping = keeping?.id === row.id;
                return (
                  <TableRow key={`${row.system}:${row.id}`}>
                    <TableCell className="whitespace-nowrap text-sm uppercase">{row.system}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{row.name || row.account}</div>
                      {row.name && <div className="text-xs text-muted-foreground">{row.account}</div>}
                      {row.last_login && <div className="text-xs text-muted-foreground">{t('offboarding.review.lastLogin', { date: formatDate(row.last_login) })}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{whyListed(row)}</TableCell>
                    <TableCell>
                      {row.decision?.action === 'keep' && !isKeeping && (
                        <p className="mb-2 text-sm text-muted-foreground">
                          {row.decision.by
                            ? t('offboarding.review.keptBy', { name: row.decision.by, reason: row.decision.reason })
                            : t('offboarding.review.kept', { reason: row.decision.reason })}
                        </p>
                      )}
                      {isKeeping ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            autoFocus
                            value={keeping.reason}
                            onChange={(e) => setKeeping({ id: row.id, reason: e.target.value })}
                            placeholder={t('offboarding.review.keepReason')}
                            aria-label={t('offboarding.review.keepReason')}
                            className="sm:w-64"
                          />
                          <Button size="sm" onClick={keep} disabled={!keeping.reason.trim()}>{t('offboarding.review.keepSave')}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setKeeping(null)}>{t('offboarding.dialog.back')}</Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {actions.includes('keep') && (
                            <Button size="sm" variant="outline" onClick={() => setKeeping({ id: row.id, reason: row.decision?.reason ?? '' })}>{t('offboarding.review.keep')}</Button>
                          )}
                          {actions.includes('offboard') && ref && (
                            <Button size="sm" variant="outline" onClick={() => launcher.openTarget(ref, row.name || row.account)}>{t('offboarding.review.offboard')}</Button>
                          )}
                          {actions.includes('clear_contacts') && (
                            <Button size="sm" variant="outline" onClick={() => setClearing(row)}>{t('offboarding.review.clearContacts')}</Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {launcher.dialog}
      <ConfirmDialog
        open={clearing !== null}
        description={clearing ? t('offboarding.review.clearQuestion', { name: clearing.name || clearing.account }) : undefined}
        confirmText={t('offboarding.review.clearContacts')}
        onConfirm={clear}
        onCancel={() => setClearing(null)}
      />
    </div>
  );
}
