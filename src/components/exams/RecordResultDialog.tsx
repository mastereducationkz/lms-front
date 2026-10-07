import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  createExamResult,
  uploadResultProof,
  type ExamResultRow,
  type SatOfficialDate,
} from '../../services/api/exams';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherInsights';

/**
 * Record a new exam attempt for one student, optionally with the score report attached.
 *
 * Recording never overwrites: each save is a new attempt, so a retake sits alongside
 * the earlier sitting rather than destroying it. The total is derived server-side from
 * the section scores, so it is shown read-only here and never sent.
 */

type ExamType = 'sat' | 'ielts' | 'nuet';

interface Props {
  row: ExamResultRow;
  examType: ExamType;
  officialDates: SatOfficialDate[];
  onClose: () => void;
  onSaved: () => void;
}

const IELTS_BANDS = ['', '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5',
  '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9'];

export function RecordResultDialog({ row, examType, officialDates, onClose, onSaved }: Props) {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  const [testDate, setTestDate] = useState(row.planned_test_date ?? '');
  const [verbal, setVerbal] = useState('');
  const [math, setMath] = useState('');
  const [overall, setOverall] = useState('');
  const [listening, setListening] = useState('');
  const [reading, setReading] = useState('');
  const [writing, setWriting] = useState('');
  const [speaking, setSpeaking] = useState('');
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSat = examType === 'sat';
  const isIelts = examType === 'ielts';

  const satTotal = useMemo(() => {
    const v = Number(verbal), m = Number(math);
    return verbal && math && !Number.isNaN(v) && !Number.isNaN(m) ? v + m : null;
  }, [verbal, math]);

  // Mirrors the server rules exactly, so the user is told before the round trip.
  const sectionInvalid = (raw: string) => {
    if (!raw) return false;
    const n = Number(raw);
    return Number.isNaN(n) || n < 200 || n > 800 || n % 10 !== 0;
  };

  const problems: string[] = [];
  if (!testDate) problems.push(t('teacherInsights.recordResult.dateRequired'));
  if (testDate && testDate > today) problems.push(t('teacherInsights.recordResult.dateFuture'));
  if (isSat) {
    if (!verbal || !math) problems.push(t('teacherInsights.recordResult.bothSections'));
    if (sectionInvalid(verbal)) problems.push(t('teacherInsights.recordResult.verbalRange'));
    if (sectionInvalid(math)) problems.push(t('teacherInsights.recordResult.mathRange'));
  } else if (!overall) {
    problems.push(isIelts ? t('teacherInsights.recordResult.overallRequired') : t('teacherInsights.recordResult.totalRequired'));
  }
  const canSave = problems.length === 0 && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createExamResult({
        student_id: row.student.student_id,
        exam_type: examType,
        test_date: testDate,
        ...(isSat ? { verbal_score: Number(verbal), math_score: Number(math) } : {}),
        ...(!isSat ? { total_score: Number(overall) } : {}),
        ...(isIelts && listening ? { listening_band: Number(listening) } : {}),
        ...(isIelts && reading ? { reading_band: Number(reading) } : {}),
        ...(isIelts && writing ? { writing_band: Number(writing) } : {}),
        ...(isIelts && speaking ? { speaking_band: Number(speaking) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      // Proof is attached after the result exists, so a failed upload never costs the
      // score itself - the user can retry the attachment from the row.
      if (proof) {
        try {
          await uploadResultProof(created.id, proof);
        } catch {
          setError(t('teacherInsights.recordResult.proofFailed'));
          onSaved();
          setSaving(false);
          return;
        }
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(
        e?.response?.status === 409
          ? t('teacherInsights.recordResult.duplicate')
          : typeof detail === 'string' ? detail : t('teacherInsights.recordResult.saveFailed'),
      );
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog" aria-modal="true" aria-labelledby="rr-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-lg bg-background p-5 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 id="rr-title" className="text-lg font-semibold">{t('teacherInsights.recordResult.title', { exam: examType.toUpperCase() })}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{row.student.full_name}</p>

        {row.attempts.length > 0 && (
          <div className="mt-3 rounded-md border bg-muted/40 p-2 text-xs">
            <span className="font-medium">{t('teacherInsights.recordResult.existingAttempts')} </span>
            {row.attempts.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ' · '}
                {a.test_date} — {Number(a.total_score)}
              </span>
            ))}
            <div className="text-muted-foreground mt-1">
              {t('teacherInsights.recordResult.appendOnly')}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="rr-date" className="text-xs font-medium">{t('teacherInsights.recordResult.testDate')}</label>
            {isSat && officialDates.length > 0 && (
              <select
                className="mt-1 mb-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={officialDates.some((d) => d.test_date === testDate) ? testDate : ''}
                onChange={(e) => e.target.value && setTestDate(e.target.value)}
                aria-label={t('teacherInsights.recordResult.pickOfficialAria')}
              >
                <option value="">{t('teacherInsights.recordResult.pickOfficial')}</option>
                {officialDates.filter((d) => d.is_past).map((d) => (
                  <option key={d.test_date} value={d.test_date}>{d.label}</option>
                ))}
              </select>
            )}
            <Input id="rr-date" type="date" max={today} value={testDate}
                   onChange={(e) => setTestDate(e.target.value)} />
          </div>

          {isSat && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="rr-v" className="text-xs font-medium">{t('teacherInsights.recordResult.verbalRequired')}</label>
                <Input id="rr-v" type="number" min={200} max={800} step={10} value={verbal}
                       aria-invalid={sectionInvalid(verbal)}
                       onChange={(e) => setVerbal(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label htmlFor="rr-m" className="text-xs font-medium">{t('teacherInsights.recordResult.mathRequired')}</label>
                <Input id="rr-m" type="number" min={200} max={800} step={10} value={math}
                       aria-invalid={sectionInvalid(math)}
                       onChange={(e) => setMath(e.target.value)} className="mt-1" />
              </div>
              <div>
                <span className="text-xs font-medium">{t('teacherInsights.shared.total')}</span>
                <output className="mt-1 block w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-semibold"
                        aria-live="polite">
                  {satTotal ?? '—'}
                </output>
              </div>
            </div>
          )}

          {isIelts && (
            <>
              <div>
                <label htmlFor="rr-o" className="text-xs font-medium">{t('teacherInsights.recordResult.overallBand')}</label>
                <select id="rr-o" value={overall} onChange={(e) => setOverall(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {IELTS_BANDS.map((b) => <option key={b} value={b}>{b || t('teacherInsights.recordResult.select')}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([[t('teacherInsights.recordResult.listening'), listening, setListening], [t('teacherInsights.recordResult.reading'), reading, setReading],
                   [t('teacherInsights.recordResult.writing'), writing, setWriting], [t('teacherInsights.recordResult.speaking'), speaking, setSpeaking]] as const)
                  .map(([label, value, setter]) => (
                    <div key={label}>
                      <label className="text-xs font-medium">{label}</label>
                      <select value={value} onChange={(e) => (setter as any)(e.target.value)}
                              aria-label={t('teacherInsights.recordResult.bandAria', { section: label })}
                              className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
                        {IELTS_BANDS.map((b) => <option key={b} value={b}>{b || '—'}</option>)}
                      </select>
                    </div>
                  ))}
              </div>
            </>
          )}

          {examType === 'nuet' && (
            <div>
              <label htmlFor="rr-t" className="text-xs font-medium">{t('teacherInsights.recordResult.totalScore')}</label>
              <Input id="rr-t" type="number" value={overall} className="mt-1"
                     onChange={(e) => setOverall(e.target.value)} />
            </div>
          )}

          <div>
            <label htmlFor="rr-proof" className="text-xs font-medium">
              {t('teacherInsights.recordResult.proof')}
            </label>
            <input id="rr-proof" type="file" accept="image/*,application/pdf"
                   onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                   className="mt-1 block w-full text-sm" />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('teacherInsights.recordResult.proofHint')}
            </p>
          </div>

          <div>
            <label htmlFor="rr-notes" className="text-xs font-medium">{t('teacherInsights.recordResult.notes')}</label>
            <Input id="rr-notes" value={notes} className="mt-1"
                   onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {problems.length > 0 && (
          <ul className="mt-3 text-xs text-amber-700 dark:text-amber-500 list-disc pl-4">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={save} disabled={!canSave}>
            {saving ? t('teacherInsights.shared.saving') : t('teacherInsights.recordResult.saveAttempt')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RecordResultDialog;
