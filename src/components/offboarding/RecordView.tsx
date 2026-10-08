import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import ConfirmDialog from '../ConfirmDialog';
import { toast } from '../Toast';
import { StatusBadge } from './parts';
import { Checklist, HandoverList, OpenItemsList, OwnedSummary, StepsList, ownedAnything } from './RecordSections';
import { OPEN_STATUSES, hasBlockers, recordActions } from '../../lib/offboarding';
import {
  cancelOffboarding,
  confirmOffboarding,
  reactivateOffboarding,
  retryStep,
  setChecklistItem,
  type OffboardingRecord,
  type StepName,
} from '../../services/api/offboarding';
import { useOffboardLauncher } from './useOffboardLauncher';
import { roleLabel } from '../../lib/roleLabel';
import { formatDate, formatDateTime } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

interface RecordViewProps {
  record: OffboardingRecord;
  viewerId: number | null;
  onChanged: (record: OffboardingRecord) => void;
  /** Fetch the record again (after a hand-over from here, which changes its open items). */
  onReload: () => void;
}

type Action = 'cancel' | 'confirm' | 'reactivate';

const RUN: Record<Action, (id: number) => Promise<OffboardingRecord>> = {
  cancel: cancelOffboarding,
  confirm: confirmOffboarding,
  reactivate: reactivateOffboarding,
};

const DONE = { cancel: 'offboarding.open.cancelled', confirm: 'offboarding.open.confirmed', reactivate: 'offboarding.record.reactivated' } as const;

/** One offboarding: who, when, why, each system's result, the manual checklist (SPEC §1, §5, §6). */
export default function RecordView({ record, viewerId, onChanged, onReload }: RecordViewProps) {
  const t = useT();
  const locale = useLocale();
  // «Hand over what is left» reuses the Offboard dialog: for someone already switched off it shows
  // only the reassign helper (the server takes /reassign for an inactive leaver, SPEC §12 Q93).
  const handover = useOffboardLauncher(undefined, onReload);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<Action | null>(null);
  const actions = recordActions(record, viewerId);
  const name = record.target.name;
  const blockedBy = record.status === 'blocked' && record.blocked_reason?.blockers;

  const run = async (action: Action) => {
    setBusy(true);
    setAsking(null);
    try {
      onChanged(await RUN[action](record.id));
      toast(t(DONE[action]), 'success');
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.open.actionFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const retry = async (step: StepName) => {
    setBusy(true);
    try {
      onChanged(await retryStep(record.id, step));
      toast(t('offboarding.record.retried'), 'success');
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.open.actionFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const tick = async (itemId: string, done: boolean) => {
    try {
      onChanged(await setChecklistItem(record.id, itemId, done));
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.record.checklistFailed'), 'error');
    }
  };

  const question: Record<Action, string> = {
    cancel: t('offboarding.open.cancelQuestion', { name }),
    confirm: t('offboarding.record.confirmQuestion', { name }),
    reactivate: t('offboarding.record.reactivateQuestion', { name }),
  };
  const confirmText: Record<Action, string> = {
    cancel: t('offboarding.open.cancel'),
    confirm: t('offboarding.open.confirm'),
    reactivate: t('offboarding.record.reactivate'),
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
          <StatusBadge status={record.status} />
          {record.target.role && <span className="text-sm text-muted-foreground">{roleLabel(record.target.role, locale)}</span>}
        </div>
        {record.target.email && <p className="text-sm text-muted-foreground">{record.target.email}</p>}
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">{t('offboarding.col.lastDay')}</dt>
          <dd className="text-foreground">{formatDate(record.last_day)} · {t(`offboarding.mode.${record.mode}`)}</dd>
          {record.reason_code && (
            <>
              <dt className="text-muted-foreground">{t('offboarding.record.reason')}</dt>
              <dd className="text-foreground">{t(`offboarding.reason.${record.reason_code}`)}</dd>
            </>
          )}
          {record.note && (
            <>
              <dt className="text-muted-foreground">{t('offboarding.record.note')}</dt>
              <dd className="whitespace-pre-wrap text-foreground">{record.note}</dd>
            </>
          )}
        </dl>
        <ul className="text-sm text-muted-foreground">
          <li>{t('offboarding.record.requested', { name: record.requested_by?.name ?? '—', date: formatDateTime(record.created_at) })}</li>
          {record.effective_at && OPEN_STATUSES.includes(record.status) && <li>{t('offboarding.record.effectiveAt', { date: formatDateTime(record.effective_at) })}</li>}
          {record.confirmed_by && <li>{t('offboarding.record.confirmedBy', { name: record.confirmed_by.name })}</li>}
          {record.cancelled_at && <li>{t('offboarding.record.cancelledBy', { name: record.cancelled_by?.name ?? '—', date: formatDateTime(record.cancelled_at) })}</li>}
          {record.completed_at && <li>{t('offboarding.record.completedAt', { date: formatDateTime(record.completed_at) })}</li>}
          {record.reactivated_at && <li>{t('offboarding.record.reactivatedBy', { name: record.reactivated_by?.name ?? '—', date: formatDateTime(record.reactivated_at) })}</li>}
        </ul>
        {record.status === 'awaiting_confirmation' && <p className="text-sm text-foreground">{t('offboarding.result.awaiting')}</p>}
        {blockedBy && hasBlockers(blockedBy) && (
          <div role="alert" className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t('offboarding.record.blocked')}{' '}
              {[...blockedBy.groups.map((g) => g.name), ...blockedBy.lessons.map((l) => l.title), ...blockedBy.courses.map((c) => c.title), ...blockedBy.sat_native.map((g) => g.name)].join(', ')}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {actions.confirm && <Button size="sm" disabled={busy} onClick={() => setAsking('confirm')}>{t('offboarding.open.confirm')}</Button>}
          {actions.cancel && <Button size="sm" variant="outline" disabled={busy} onClick={() => setAsking('cancel')}>{t('offboarding.open.cancel')}</Button>}
          {actions.reactivate && <Button size="sm" variant="outline" disabled={busy} onClick={() => setAsking('reactivate')}>{t('offboarding.record.reactivate')}</Button>}
        </div>
      </section>

      {(record.open_items?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-foreground">{t('offboarding.record.openItems')}</h2>
          <OpenItemsList items={record.open_items ?? []} />
          {record.needs_reassignment && record.lms_user_id != null && handover.enabled && (
            <Button size="sm" onClick={() => handover.open({ id: record.lms_user_id!, role: record.target.role ?? '', name: record.target.name })}>
              {t('offboarding.record.handOverLeft')}
            </Button>
          )}
          {handover.dialog}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-foreground">{t('offboarding.record.steps')}</h2>
        <StepsList
          steps={record.steps}
          retryable={record.status === 'completed' ? actions.retry_steps : []}
          onRetry={retry}
          busy={busy}
        />
      </section>

      {record.reactivation_steps && (
        <section className="space-y-2">
          <h2 className="font-semibold text-foreground">{t('offboarding.record.reactivationSteps')}</h2>
          <StepsList
            steps={record.reactivation_steps}
            retryable={record.status === 'reactivated' ? actions.retry_steps : []}
            onRetry={retry}
            busy={busy}
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold text-foreground">{t('offboarding.record.checklist')}</h2>
        <Checklist items={record.checklist ?? []} canTick={actions.tick_checklist} onTick={tick} />
      </section>

      {(record.handovers?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-foreground">{t('offboarding.record.handovers')}</h2>
          <HandoverList handovers={record.handovers ?? []} />
        </section>
      )}

      {ownedAnything(record.owned_snapshot) && (
        <section className="space-y-2">
          <h2 className="font-semibold text-foreground">{t('offboarding.record.owned')}</h2>
          <OwnedSummary owned={record.owned_snapshot} />
        </section>
      )}

      <ConfirmDialog
        open={asking !== null}
        description={asking ? question[asking] : undefined}
        confirmText={asking ? confirmText[asking] : undefined}
        onConfirm={() => asking && run(asking)}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
