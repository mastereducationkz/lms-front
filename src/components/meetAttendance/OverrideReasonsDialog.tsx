import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import type { MeetReviewOptions } from '../../services/api/meetAttendance';
import { reasonComplete, type OverrideAsk, type OverrideReason } from '../../lib/meetRegister';

const FLAG: Record<'ru' | 'en', Record<string, string>> = {
  ru: {
    marked_absent_was_in_room: 'Meet: был на уроке 75% времени или больше',
    marked_present_too_short: 'Meet: на уроке меньше 75% времени',
    marked_present_not_joined: 'Meet: не заходил на урок',
  },
  en: {
    marked_absent_was_in_room: 'Meet: in the lesson for 75% of it or more',
    marked_present_too_short: 'Meet: in the lesson for under 75% of it',
    marked_present_not_joined: 'Meet: never joined',
  },
};

/**
 * Meet took the register (2026-09-23): a teacher may change its mark, and says why. Asked once, when
 * the journal is saved — the cell is a click-to-cycle toggle, and a question on every click would
 * make correcting a mark a chore. The reasons are the owner's presets for the flag the change raises.
 */
export function OverrideReasonsDialog({ open, items, options, en, onCancel, onConfirm }: {
  open: boolean;
  items: OverrideAsk[];
  options: MeetReviewOptions;
  en: boolean;
  onCancel: () => void;
  onConfirm: (reasons: Map<string, OverrideReason>) => void;
}) {
  const [given, setGiven] = useState<Map<string, OverrideReason>>(new Map());
  useEffect(() => { if (open) setGiven(new Map()); }, [open]);
  const t = (ru: string, enText: string) => (en ? enText : ru);
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
          <DialogTitle>{t('Отметки расходятся с Meet', 'These marks disagree with Meet')}</DialogTitle>
          <DialogDescription>
            {t('Meet уже отметил этих учеников по данным урока. Укажите, почему ваша отметка другая — руководители увидят причину.',
              'Meet already marked these students from the lesson’s data. Say why your mark is different — heads will see the reason.')}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const reason = given.get(item.key);
            const presets = options[item.flag]?.reasons ?? [{ key: 'other', label: 'Другое' }];
            return (
              <div key={item.key} className="rounded-lg border border-border p-3">
                <div className="text-sm font-medium text-foreground">{item.studentName} · {item.lessonLabel}</div>
                <div className="text-xs text-muted-foreground">{FLAG[en ? 'en' : 'ru'][item.flag]}</div>
                <select
                  aria-label={t(`Причина — ${item.studentName}`, `Reason — ${item.studentName}`)}
                  value={reason?.code ?? ''}
                  onChange={(e) => set(item.key, { code: e.target.value })}
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="" disabled>{t('Выберите причину', 'Choose a reason')}</option>
                  {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                {reason?.code === 'other' && (
                  <textarea
                    aria-label={t('Опишите причину', 'Describe the reason')}
                    value={reason.text ?? ''}
                    maxLength={500}
                    rows={2}
                    onChange={(e) => set(item.key, { text: e.target.value })}
                    placeholder={t('Опишите причину', 'Describe the reason')}
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
            {t('Вернуться к журналу', 'Back to the journal')}
          </button>
          <button type="button" disabled={!ready} onClick={() => onConfirm(given)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {t('Сохранить с причинами', 'Save with reasons')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OverrideReasonsDialog;
