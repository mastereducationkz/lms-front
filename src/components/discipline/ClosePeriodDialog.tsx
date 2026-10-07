import { Loader2, Lock } from 'lucide-react';

import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { money } from '../../lib/discipline';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherInsights';

/**
 * Confirming that a half-month is finished.
 *
 * Closing freezes the totals — payroll is paid on them and the register stops recomputing —
 * so this is the one action on the page that cannot be undone from the page. It replaces a
 * `window.confirm`, which could only render the figures as plain text in a box the browser
 * owns, and could not show the one thing that should stop a head teacher: findings still
 * waiting to be priced.
 */
export default function ClosePeriodDialog({
  open, label, fine, teachers, unpriced, busy, onCancel, onConfirm,
}: {
  open: boolean;
  label: string;
  fine: number;
  teachers: number;
  /** Findings with no amount yet. The server refuses to close while any remain. */
  unpriced: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const blocked = unpriced > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> {t('teacherInsights.discipline.close.title', { label })}
          </DialogTitle>
          <DialogDescription>
            {t('teacherInsights.discipline.close.hint')}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-1 rounded-md bg-muted p-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('teacherInsights.discipline.close.fines')}</dt>
            <dd className="font-medium tabular-nums">{money(fine)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('teacherInsights.discipline.close.teachers')}</dt>
            <dd className="font-medium tabular-nums">{teachers}</dd>
          </div>
        </dl>

        {/* The server refuses in this case; saying so here saves a round trip and an error. */}
        {blocked && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {t('teacherInsights.discipline.close.unpriced', { count: unpriced })}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={onConfirm} disabled={busy || blocked}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('teacherInsights.discipline.close.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
