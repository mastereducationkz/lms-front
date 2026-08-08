import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  createExamResult,
  uploadResultProof,
  type ExamResultRow,
  type SatOfficialDate,
} from '../../services/api/exams';

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
  if (!testDate) problems.push('Test date is required.');
  if (testDate && testDate > today) problems.push('Test date cannot be in the future.');
  if (isSat) {
    if (!verbal || !math) problems.push('Both section scores are required.');
    if (sectionInvalid(verbal)) problems.push('Verbal must be 200–800 in steps of 10.');
    if (sectionInvalid(math)) problems.push('Math must be 200–800 in steps of 10.');
  } else if (!overall) {
    problems.push(isIelts ? 'Overall band is required.' : 'Total score is required.');
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
          setError('Result saved, but the proof upload failed. Attach it again from the row.');
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
          ? 'This student already has a result for that exam and date.'
          : typeof detail === 'string' ? detail : 'Could not save the result.',
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
        <h2 id="rr-title" className="text-lg font-semibold">Record {examType.toUpperCase()} result</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{row.student.full_name}</p>

        {row.attempts.length > 0 && (
          <div className="mt-3 rounded-md border bg-muted/40 p-2 text-xs">
            <span className="font-medium">Existing attempts: </span>
            {row.attempts.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ' · '}
                {a.test_date} — {Number(a.total_score)}
              </span>
            ))}
            <div className="text-muted-foreground mt-1">
              Saving adds a new attempt; nothing above is overwritten.
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="rr-date" className="text-xs font-medium">Test date *</label>
            {isSat && officialDates.length > 0 && (
              <select
                className="mt-1 mb-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={officialDates.some((d) => d.test_date === testDate) ? testDate : ''}
                onChange={(e) => e.target.value && setTestDate(e.target.value)}
                aria-label="Pick an official SAT date"
              >
                <option value="">Pick an official date…</option>
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
                <label htmlFor="rr-v" className="text-xs font-medium">Verbal *</label>
                <Input id="rr-v" type="number" min={200} max={800} step={10} value={verbal}
                       aria-invalid={sectionInvalid(verbal)}
                       onChange={(e) => setVerbal(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label htmlFor="rr-m" className="text-xs font-medium">Math *</label>
                <Input id="rr-m" type="number" min={200} max={800} step={10} value={math}
                       aria-invalid={sectionInvalid(math)}
                       onChange={(e) => setMath(e.target.value)} className="mt-1" />
              </div>
              <div>
                <span className="text-xs font-medium">Total</span>
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
                <label htmlFor="rr-o" className="text-xs font-medium">Overall band *</label>
                <select id="rr-o" value={overall} onChange={(e) => setOverall(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {IELTS_BANDS.map((b) => <option key={b} value={b}>{b || 'Select…'}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([['Listening', listening, setListening], ['Reading', reading, setReading],
                   ['Writing', writing, setWriting], ['Speaking', speaking, setSpeaking]] as const)
                  .map(([label, value, setter]) => (
                    <div key={label}>
                      <label className="text-xs font-medium">{label}</label>
                      <select value={value} onChange={(e) => (setter as any)(e.target.value)}
                              aria-label={`${label} band`}
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
              <label htmlFor="rr-t" className="text-xs font-medium">Total score *</label>
              <Input id="rr-t" type="number" value={overall} className="mt-1"
                     onChange={(e) => setOverall(e.target.value)} />
            </div>
          )}

          <div>
            <label htmlFor="rr-proof" className="text-xs font-medium">
              Proof (score report) — optional
            </label>
            <input id="rr-proof" type="file" accept="image/*,application/pdf"
                   onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                   className="mt-1 block w-full text-sm" />
            <p className="text-[11px] text-muted-foreground mt-1">
              JPEG, PNG, GIF, WEBP or PDF, up to 10 MB. Stored privately and only
              reachable by staff who can already see this student.
            </p>
          </div>

          <div>
            <label htmlFor="rr-notes" className="text-xs font-medium">Notes</label>
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
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save attempt'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RecordResultDialog;
