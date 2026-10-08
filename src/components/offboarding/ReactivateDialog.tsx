import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { toast } from '../Toast';
import { latestCompletedRecord } from '../../lib/offboarding';
import {
  listOffboardings,
  reactivateOffboarding,
  type OffboardingRecord,
} from '../../services/api/offboarding';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

export interface ReactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lmsUserId: number;
  name: string;
  /** From the server's refusal when it named the record; otherwise the newest completed one is looked up. */
  recordId: number | null;
  onChanged?: (record: OffboardingRecord) => void;
}

/**
 * Bring an offboarded staff member back (SPEC §6, §12 Q92): their accounts switch back on,
 * groups, students, lessons and course access do not. Opened where the old «active» switch was.
 */
export default function ReactivateDialog({ open, onOpenChange, lmsUserId, name, recordId, onChanged }: ReactivateDialogProps) {
  const t = useT();
  const [record, setRecord] = useState<Pick<OffboardingRecord, 'id' | 'last_day'> | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRecord(recordId != null ? { id: recordId, last_day: '' } : null);
    setMissing(false);
    if (recordId != null) return;
    let live = true;
    // Normally the refusal names the record; this is the fallback when it did not.
    listOffboardings({ status: ['completed'], lms_user_id: lmsUserId, limit: 5 })
      .then((page) => {
        if (!live) return;
        const found = latestCompletedRecord(page.items, lmsUserId);
        setRecord(found);
        setMissing(!found);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [open, recordId, lmsUserId]);

  const reactivate = async () => {
    if (!record) return;
    setBusy(true);
    try {
      const updated = await reactivateOffboarding(record.id);
      toast(t('offboarding.record.reactivated'), 'success');
      onChanged?.(updated);
      onOpenChange(false);
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.open.actionFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('offboarding.reactivate.title', { name })}</DialogTitle>
          {record?.last_day && <DialogDescription>{t('offboarding.reactivate.left', { date: formatDate(record.last_day) })}</DialogDescription>}
        </DialogHeader>
        <p className="text-sm text-foreground">
          {missing ? t('offboarding.reactivate.notFound') : t('offboarding.record.reactivateQuestion', { name })}
        </p>
        <DialogFooter className="gap-2">
          {record && (
            <Button variant="ghost" asChild>
              <Link to={`/admin/offboarding/${record.id}`}>{t('offboarding.result.openRecord')}</Link>
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('offboarding.dialog.close')}</Button>
          {!missing && (
            <Button onClick={reactivate} disabled={busy || !record}>{t('offboarding.record.reactivate')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
