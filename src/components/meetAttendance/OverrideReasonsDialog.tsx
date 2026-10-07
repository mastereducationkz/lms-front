import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import type { MeetFlagCode, MeetReviewOptions } from '../../services/api/meetAttendance';
import { reasonComplete, type OverrideAsk, type OverrideReason } from '../../lib/meetRegister';
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meet';

const FLAG: Partial<Record<MeetFlagCode, MessageKey>> = {
  marked_absent_was_in_room: 'meet.override.flagMarkedAbsentWasInRoom',
  marked_present_too_short: 'meet.override.flagMarkedPresentTooShort',
  marked_present_not_joined: 'meet.override.flagMarkedPresentNotJoined',
};

/**
 * Meet took the register (2026-09-23): a teacher may change its mark, and says why. Asked once, when
 * the journal is saved — the cell is a click-to-cycle toggle, and a question on every click would
 * make correcting a mark a chore. The reasons are the owner's presets for the flag the change raises.
 */
export function OverrideReasonsDialog({ open, items, options, onCancel, onConfirm }: {
  open: boolean;
  items: OverrideAsk[];
  options: MeetReviewOptions;
  onCancel: () => void;
  onConfirm: (reasons: Map<string, OverrideReason>) => void;
}) {
  const [given, setGiven] = useState<Map<string, OverrideReason>>(new Map());
  useEffect(() => { if (open) setGiven(new Map()); }, [open]);
  const t = useT();
  const ready = items.length > 0 && items.every((item) => reasonComplete(given.get(item.key)));
  const set = (key: string, patch: Partial<OverrideReason>) => setGiven((prev) => {
    const next = new Map(prev);
    next.set(key, { ...(next.get(key) ?? { code: '', text: null }), ...patch });
    return next;
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('meet.override.title')}</DialogTitle>
          <DialogDescription>{t('meet.override.description')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const reason = given.get(item.key);
            const presets = options[item.flag]?.reasons ?? [{ key: 'other', label: t('meet.reason.other') }];
            const flag = FLAG[item.flag];
            return (
              <div key={item.key} className="rounded-lg border border-border p-3">
                <div className="text-sm font-medium text-foreground">{item.studentName} · {item.lessonLabel}</div>
                <div className="text-xs text-muted-foreground">{flag && t(flag)}</div>
                <select
                  aria-label={t('meet.override.reasonFor', { name: item.studentName })}
                  value={reason?.code ?? ''}
                  onChange={(e) => set(item.key, { code: e.target.value })}
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="" disabled>{t('meet.override.choose')}</option>
                  {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                {reason?.code === 'other' && (
                  <textarea
                    aria-label={t('meet.override.describe')}
                    value={reason.text ?? ''}
                    maxLength={500}
                    rows={2}
                    onChange={(e) => set(item.key, { text: e.target.value })}
                    placeholder={t('meet.override.describe')}
                    className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            {t('meet.override.back')}
          </button>
          <button type="button" disabled={!ready} onClick={() => onConfirm(given)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {t('meet.override.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OverrideReasonsDialog;
