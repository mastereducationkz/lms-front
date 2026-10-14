import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { openResultProof, type ExamResultRow } from '../../services/api/exams';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

/**
 * Every recorded attempt of one student, newest first, in a popup. Replaces the rows that used
 * to expand inside the grid: those inherited the grid's columns and sticky cell, and overlapped.
 */
export function AttemptsDialog({ row, examType, onClose, onError }: {
  row: ExamResultRow;
  examType: 'sat' | 'ielts' | 'nuet';
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const isSat = examType === 'sat';
  const isIelts = examType === 'ielts';

  const sections = (a: ExamResultRow['attempts'][number]) => {
    if (isSat) return `V ${a.verbal_score ?? '—'} · M ${a.math_score ?? '—'}`;
    if (isIelts) {
      const bands = [a.listening_band, a.reading_band, a.writing_band, a.speaking_band];
      return bands.some((b) => b != null) ? `L ${a.listening_band ?? '—'} · R ${a.reading_band ?? '—'} · W ${a.writing_band ?? '—'} · S ${a.speaking_band ?? '—'}` : '';
    }
    return '';
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('exams.row.attemptHistory')}</DialogTitle>
          <p className="text-sm text-muted-foreground">{row.student.full_name}</p>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t('exams.columns.testDate')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('exams.columns.total')}</th>
                {(isSat || isIelts) && <th className="py-2 pr-3" />}
                <th className="py-2 pr-3 font-medium">{t('exams.columns.status')}</th>
                <th className="py-2 font-medium">{t('exams.columns.proof')}</th>
              </tr>
            </thead>
            <tbody>
              {row.attempts.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{a.test_date}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{Number(a.total_score)}</td>
                  {(isSat || isIelts) && <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">{sections(a)}</td>}
                  <td className="py-2 pr-3 text-muted-foreground">{a.status}</td>
                  <td className="py-2">
                    {a.has_proof ? (
                      <button type="button"
                              onClick={() => openResultProof(a.id).catch(() => onError(t('exams.errors.openFileFailed')))}
                              className="text-primary hover:underline">{t('exams.row.view')}</button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
