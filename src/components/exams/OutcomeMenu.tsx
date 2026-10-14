import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  recordOutcome, removeOutcome,
  type ExamOutcomeReason, type ExamResultRow,
} from '../../services/api/exams';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

const ORDER: ExamOutcomeReason[] = ['not_taking', 'declined', 'unreachable'];

/**
 * Close out a sitting with no score: «Не сдаёт», «Не хочет делиться», «Не удалось связаться».
 * Offered regardless of the ask date — past the deadline is exactly when it is needed. The
 * CRM «Сбор результатов» task closes on it at its next hourly pass.
 *
 * Rendered in a portal (Popover) because the table sits in an overflow-x-auto wrapper that
 * would clip an absolutely positioned menu on the last rows.
 */
export function OutcomeMenu({ row, examType, onChanged, onError }: {
  row: ExamResultRow;
  examType: 'sat' | 'ielts' | 'nuet';
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ExamOutcomeReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const planned = row.planned_test_date;
  // The PLANNED sitting has a result (an older sitting's result does not count - retakes).
  if (!planned || row.sitting_has_result || row.triage_status === 'completed') return null;
  const key = { student_id: row.student.student_id, exam_type: examType, planned_test_date: planned };

  const reset = () => { setPicked(null); setNote(''); };
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); setOpen(false); reset(); onChanged(); }
    catch { onError(t('exams.outcome.saveFailed')); }
    finally { setBusy(false); }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          {t('exams.outcome.button')} <ChevronDown className="ml-1 h-3 w-3" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2 text-left">
        {picked === null ? (
          <ul className="space-y-0.5">
            {ORDER.map((reason) => (
              <li key={reason}>
                <button type="button" disabled={busy || row.outcome_reason === reason}
                        onClick={() => setPicked(reason)}
                        className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50">
                  {t(`exams.outcome.${reason}`)}
                </button>
              </li>
            ))}
            {row.outcome_reason && (
              <li className="border-t pt-1 mt-1">
                <button type="button" disabled={busy}
                        onClick={() => act(() => removeOutcome(key))}
                        className="w-full rounded px-2 py-1.5 text-left text-sm text-red-600 hover:bg-muted">
                  {t('exams.outcome.undo')}
                </button>
              </li>
            )}
          </ul>
        ) : (
          <div className="space-y-2">
            <div className="text-sm font-medium">{t(`exams.outcome.${picked}`)}</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
                      placeholder={t('exams.outcome.notePlaceholder')}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm" />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPicked(null)} disabled={busy}>
                {t('exams.outcome.back')}
              </Button>
              <Button size="sm" disabled={busy}
                      onClick={() => act(() => recordOutcome({
                        ...key, reason: picked, ...(note.trim() ? { note: note.trim() } : {}),
                      }))}>
                {t('exams.outcome.save')}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
