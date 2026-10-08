import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { TableCell, TableRow } from '../ui/table';
import { toast } from '../Toast';
import { StatusBadge } from './parts';
import { rowActions } from '../../lib/accessReview';
import {
  keepAccessReviewRow,
  unkeepAccessReviewRow,
  type AccessReviewRow,
} from '../../services/api/accessReview';
import type { TargetRef } from '../../services/api/offboarding';
import { targetRef } from '../../lib/offboarding';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

interface AccessReviewRowViewProps {
  row: AccessReviewRow;
  onChanged: (row: AccessReviewRow) => void;
  onOffboard: (ref: TargetRef, name: string) => void;
  onClearContacts: (row: AccessReviewRow) => void;
}

const CONTACTS = ['personal_email', 'avatar', 'telegram'] as const;

/** One account of the access review with its decision: keep (with a reason), offboard, or clear contacts. */
export default function AccessReviewRowView({ row, onChanged, onOffboard, onClearContacts }: AccessReviewRowViewProps) {
  const t = useT();
  const [keeping, setKeeping] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const actions = rowActions(row);
  const name = row.person?.name || row.account.name || row.account.email || row.account.key;
  const system = t(`offboarding.review.systemName.${row.system}`);
  const target = row.offboard_target ? targetRef(row.offboard_target) : null;

  const act = async (run: () => Promise<AccessReviewRow>) => {
    setBusy(true);
    try {
      onChanged(await run());
      setKeeping(null);
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.review.actionFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const stored = row.contacts ? CONTACTS.filter((c) => row.contacts![c]).map((c) => t(`offboarding.review.contact.${c}`)) : [];

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm font-medium">{system}</TableCell>
      <TableCell>
        <div className="font-medium text-foreground">{name}</div>
        {row.account.email && row.account.email !== name && <div className="text-xs text-muted-foreground">{row.account.email}</div>}
        <div className="text-xs text-muted-foreground">
          {[row.account.role, row.account.is_active ? null : t('offboarding.review.inactiveAccount'),
            row.account.last_seen ? t('offboarding.review.lastSeen', { date: formatDate(row.account.last_seen) }) : null]
            .filter(Boolean).join(' · ')}
        </div>
      </TableCell>
      <TableCell className="max-w-sm text-sm">
        <div className="text-foreground">{t(`offboarding.review.category.${row.category}`)}</div>
        {row.why && <div className="text-xs text-muted-foreground">{row.why}</div>}
        {row.contacts && (
          <div className="mt-1 text-xs text-muted-foreground">
            {row.contacts.last_day_source === 'offboarding'
              ? t('offboarding.review.lastDay', { date: formatDate(row.contacts.last_day) })
              : t('offboarding.review.lastChange', { date: formatDate(row.contacts.last_day) })}
            {stored.length > 0 && <> · {t('offboarding.review.stored', { list: stored.join(', ') })}</>}
          </div>
        )}
      </TableCell>
      <TableCell className="min-w-[16rem] space-y-2">
        {row.offboarding && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={row.offboarding.status} />
            <Link to={`/admin/offboarding/${row.offboarding.record_id}`} className="text-xs underline">{t('offboarding.result.openRecord')}</Link>
          </div>
        )}
        {row.decision === 'keep' && row.keep && (
          <p className="text-sm text-muted-foreground">{t('offboarding.review.keptBy', { name: row.keep.by?.name ?? '—', reason: row.keep.reason })}</p>
        )}
        {row.decision === 'contacts_cleared' && <p className="text-sm text-muted-foreground">{t('offboarding.review.contactsCleared')}</p>}
        {!row.decision && row.previous_keep && (
          <p className="text-xs text-amber-700 dark:text-amber-300">{t('offboarding.review.previousKeep', { reason: row.previous_keep.reason })}</p>
        )}

        {keeping !== null ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              autoFocus
              value={keeping}
              maxLength={500}
              onChange={(e) => setKeeping(e.target.value)}
              placeholder={t('offboarding.review.keepReason')}
              aria-label={t('offboarding.review.keepReason')}
              className="sm:w-56"
            />
            <Button size="sm" disabled={busy || !keeping.trim()} onClick={() => act(() => keepAccessReviewRow(row.id, keeping.trim()))}>
              {t('offboarding.review.keepSave')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setKeeping(null)}>{t('offboarding.dialog.back')}</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {actions.includes('keep') && (
              <Button size="sm" variant="outline" onClick={() => setKeeping(row.previous_keep?.reason ?? '')}>{t('offboarding.review.keep')}</Button>
            )}
            {actions.includes('unkeep') && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => unkeepAccessReviewRow(row.id))}>{t('offboarding.review.unkeep')}</Button>
            )}
            {actions.includes('offboard') && target && (
              <Button size="sm" variant="outline" onClick={() => onOffboard(target, name)}>{t('offboarding.review.offboard')}</Button>
            )}
            {actions.includes('clear_contacts') && (
              <Button size="sm" variant="outline" onClick={() => onClearContacts(row)}>{t('offboarding.review.clearContacts')}</Button>
            )}
          </div>
        )}
        {actions.includes('by_hand') && keeping === null && (
          <p className="text-xs text-muted-foreground">{t('offboarding.review.byHand', { system })}</p>
        )}
      </TableCell>
    </TableRow>
  );
}
