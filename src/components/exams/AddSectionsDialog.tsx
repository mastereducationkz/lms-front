import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { addResultSections, type ExamResultRow } from '../../services/api/exams';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

/**
 * «+ разбивка»: Verbal and Math for a SAT result that was saved as a total only (owner, 2026-11-02).
 *
 * A sitting holds one result per student, so the form cannot take a second attempt on that date;
 * this fills the sections into the existing row instead. If they add up to another total, the server
 * corrects the total, notes it on the row and sends a verified result back to «reported».
 */
export function AddSectionsDialog({ row, onClose, onSaved }: {
  row: ExamResultRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const result = row.result!;
  const [verbal, setVerbal] = useState('');
  const [math, setMath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = (raw: string) => {
    const n = Number(raw);
    return !raw || Number.isNaN(n) || n < 200 || n > 800 || n % 10 !== 0;
  };
  const sum = !invalid(verbal) && !invalid(math) ? Number(verbal) + Number(math) : null;
  const was = Number(result.total_score);

  const save = async () => {
    if (sum == null) return;
    setSaving(true);
    setError(null);
    try {
      await addResultSections(result.id, { verbal_score: Number(verbal), math_score: Number(math) });
      onSaved();
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(e?.response?.status === 409 ? t('exams.sections.already')
        : typeof detail === 'string' ? detail : t('exams.sections.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('exams.sections.title')}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {row.student.full_name} · SAT {result.test_date} · {t('exams.sections.totalWas', { total: was })}
          </p>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="as-v" className="text-xs font-medium">Verbal</label>
            <Input id="as-v" type="number" min={200} max={800} step={10} value={verbal} className="mt-1"
                   aria-invalid={!!verbal && invalid(verbal)} onChange={(e) => setVerbal(e.target.value)} />
          </div>
          <div>
            <label htmlFor="as-m" className="text-xs font-medium">Math</label>
            <Input id="as-m" type="number" min={200} max={800} step={10} value={math} className="mt-1"
                   aria-invalid={!!math && invalid(math)} onChange={(e) => setMath(e.target.value)} />
          </div>
        </div>
        {sum != null && sum !== was && (
          <p role="alert" className="rounded-md border-2 border-amber-500 bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t('exams.sections.totalChanges', { was, now: sum })}
          </p>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={save} disabled={sum == null || saving}>{t('exams.sections.save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
