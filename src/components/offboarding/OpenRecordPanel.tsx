import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { StatusBadge } from './parts';
import { toast } from '../Toast';
import { recordActions } from '../../lib/offboarding';
import {
  cancelOffboarding,
  confirmOffboarding,
  type OffboardingRecord,
} from '../../services/api/offboarding';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

interface OpenRecordPanelProps {
  record: OffboardingRecord;
  viewerId: number | null;
  onChanged: (record: OffboardingRecord) => void;
}

/** The person already has an open offboarding: show it, with cancel and the second-admin confirm. */
export default function OpenRecordPanel({ record, viewerId, onChanged }: OpenRecordPanelProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const actions = recordActions(record, viewerId);

  const act = async (run: () => Promise<OffboardingRecord>, success: string) => {
    setBusy(true);
    try {
      const updated = await run();
      toast(success, 'success');
      onChanged(updated);
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.open.actionFailed'), 'error');
    } finally {
      setBusy(false);
      setAskCancel(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-foreground">{t('offboarding.open.title')}</h3>
        <StatusBadge status={record.status} />
      </div>
      <p className="text-sm text-muted-foreground">
        {t('offboarding.open.summary', { date: formatDate(record.last_day), name: record.requested_by?.name ?? '—' })}
      </p>
      {record.status === 'awaiting_confirmation' && <p className="text-sm text-foreground">{t('offboarding.result.awaiting')}</p>}

      {askCancel ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm text-foreground">{t('offboarding.open.cancelQuestion', { name: record.target.name })}</p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => act(() => cancelOffboarding(record.id), t('offboarding.open.cancelled'))}>
              {t('offboarding.open.cancel')}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAskCancel(false)}>{t('offboarding.dialog.back')}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.confirm && (
            <Button size="sm" disabled={busy} onClick={() => act(() => confirmOffboarding(record.id), t('offboarding.open.confirmed'))}>
              {t('offboarding.open.confirm')}
            </Button>
          )}
          {actions.cancel && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setAskCancel(true)}>{t('offboarding.open.cancel')}</Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/offboarding/${record.id}`}>{t('offboarding.result.openRecord')}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
