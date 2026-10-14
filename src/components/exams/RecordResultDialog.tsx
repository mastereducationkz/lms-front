import { createPortal } from 'react-dom';
import { useState } from 'react';
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
import '@/lib/i18n/catalogs/exams';

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

interface AttemptForm {
  key: number; testDate: string; verbal: string; math: string; overall: string;
  listening: string; reading: string; writing: string; speaking: string;
  proof: File | null; error: string | null;
}
const blank = (key: number, testDate = ''): AttemptForm => ({
  key, testDate, verbal: '', math: '', overall: '', listening: '', reading: '',
  writing: '', speaking: '', proof: null, error: null,
});
const MAX_ATTEMPTS = 5;

export function RecordResultDialog({ row, examType, officialDates, onClose, onSaved }: Props) {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  const [blocks, setBlocks] = useState<AttemptForm[]>([blank(0, row.planned_test_date ?? '')]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSat = examType === 'sat';
  const isIelts = examType === 'ielts';

  const patch = (key: number, p: Partial<AttemptForm>) =>
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, ...p, error: null } : b)));

  const satTotal = (b: AttemptForm) => {
    const v = Number(b.verbal), m = Number(b.math);
    return b.verbal && b.math && !Number.isNaN(v) && !Number.isNaN(m) ? v + m : null;
  };

  // Mirrors the server rules exactly, so the user is told before the round trip.
  const sectionInvalid = (raw: string) => {
    if (!raw) return false;
    const n = Number(raw);
    return Number.isNaN(n) || n < 200 || n > 800 || n % 10 !== 0;
  };

  const problemsOf = (b: AttemptForm): string[] => {
    const out: string[] = [];
    if (!b.testDate) out.push(t('teacherInsights.recordResult.dateRequired'));
    if (b.testDate && b.testDate > today) out.push(t('teacherInsights.recordResult.dateFuture'));
    if (isSat) {
      if (!b.verbal || !b.math) out.push(t('teacherInsights.recordResult.bothSections'));
      if (sectionInvalid(b.verbal)) out.push(t('teacherInsights.recordResult.verbalRange'));
      if (sectionInvalid(b.math)) out.push(t('teacherInsights.recordResult.mathRange'));
    } else if (!b.overall) {
      out.push(isIelts ? t('teacherInsights.recordResult.overallRequired') : t('teacherInsights.recordResult.totalRequired'));
    }
    return out;
  };
  const dates = blocks.map((b) => b.testDate).filter(Boolean);
  const dupDates = new Set(dates).size !== dates.length;
  const allProblems = Array.from(new Set([
    ...blocks.flatMap(problemsOf),
    ...(dupDates ? [t('teacherInsights.recordResult.sameDate')] : []),
  ]));
  const canSave = allProblems.length === 0 && !saving;

  const payloadOf = (b: AttemptForm) => ({
    student_id: row.student.student_id,
    exam_type: examType,
    test_date: b.testDate,
    ...(isSat ? { verbal_score: Number(b.verbal), math_score: Number(b.math) } : {}),
    ...(!isSat ? { total_score: Number(b.overall) } : {}),
    ...(isIelts && b.listening ? { listening_band: Number(b.listening) } : {}),
    ...(isIelts && b.reading ? { reading_band: Number(b.reading) } : {}),
    ...(isIelts && b.writing ? { writing_band: Number(b.writing) } : {}),
    ...(isIelts && b.speaking ? { speaking_band: Number(b.speaking) } : {}),
    ...(notes.trim() ? { notes: notes.trim() } : {}),
  });

  // Sequential: a failed attempt stays in the form (with its reason) while the ones that
  // saved are gone, so a retry never re-submits what already went through.
  const save = async () => {
    setSaving(true);
    setError(null);
    const failed: AttemptForm[] = [];
    let savedAny = false;
    let proofFailed = false;
    for (const b of blocks) {
      try {
        const created = await createExamResult(payloadOf(b));
        savedAny = true;
        // Proof is attached after the result exists, so a failed upload never costs the
        // score itself - the user can retry the attachment from the row.
        if (b.proof) {
          try { await uploadResultProof(created.id, b.proof); }
          catch { proofFailed = true; setError(t('teacherInsights.recordResult.proofFailed')); }
        }
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        failed.push({
          ...b,
          error: e?.response?.status === 409
            ? t('teacherInsights.recordResult.duplicate')
            : typeof detail === 'string' ? detail : t('teacherInsights.recordResult.saveFailed'),
        });
      }
    }
    if (savedAny) onSaved();
    setSaving(false);
    // A failed proof upload keeps the dialog open so the message is seen; the form empties
    // (everything saved) and only «Close» remains.
    if (failed.length === 0 && !proofFailed) { onClose(); return; }
    setBlocks(failed);
  };

  // Portalled to <body>: rendered inside the page, the overlay sat under the app's top bar.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog" aria-modal="true" aria-labelledby="rr-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-lg bg-background p-5 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 id="rr-title" className="text-lg font-semibold">{t('teacherInsights.recordResult.title', { exam: examType.toUpperCase() })}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{row.student.full_name}</p>

        {row.attempts.length > 0 && (
          <div className="mt-3 rounded-md border bg-muted/40 p-2 text-xs">
            <div className="font-medium mb-1">{t('teacherInsights.recordResult.previous')}</div>
            <table className="w-full">
              <tbody>
                {row.attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-0.5">{a.test_date}</td>
                    <td className="py-0.5 text-right font-medium">{Number(a.total_score)}</td>
                    {a.verbal_score != null && <td className="py-0.5 pl-2 text-muted-foreground">V {a.verbal_score} · M {a.math_score}</td>}
                    <td className="py-0.5 pl-2 text-muted-foreground">{t(`exams.resultStatus.${a.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-muted-foreground mt-1">
              {t('teacherInsights.recordResult.appendOnly')}
            </div>
          </div>
        )}

        {blocks.map((b, i) => (
          <fieldset key={b.key} className="mt-3 rounded border p-3">
            <legend className="px-1 text-xs font-medium">
              {t('teacherInsights.recordResult.attemptN', { n: i + 1 })}
            </legend>
            {blocks.length > 1 && (
              <div className="flex justify-end -mt-2">
                <Button type="button" size="sm" variant="ghost" disabled={saving}
                        onClick={() => setBlocks((bs) => bs.filter((x) => x.key !== b.key))}>
                  {t('teacherInsights.recordResult.remove')}
                </Button>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label htmlFor={`rr-date-${b.key}`} className="text-xs font-medium">{t('teacherInsights.recordResult.testDate')}</label>
                {isSat && officialDates.length > 0 && (
                  <select
                    className="mt-1 mb-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={officialDates.some((d) => d.test_date === b.testDate) ? b.testDate : ''}
                    onChange={(e) => e.target.value && patch(b.key, { testDate: e.target.value })}
                    aria-label={t('teacherInsights.recordResult.pickOfficialAria')}
                  >
                    <option value="">{t('teacherInsights.recordResult.pickOfficial')}</option>
                    {officialDates.filter((d) => d.is_past).map((d) => (
                      <option key={d.test_date} value={d.test_date}>{d.label}</option>
                    ))}
                  </select>
                )}
                <Input id={`rr-date-${b.key}`} type="date" max={today} value={b.testDate}
                       onChange={(e) => patch(b.key, { testDate: e.target.value })} />
              </div>

              {isSat && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor={`rr-v-${b.key}`} className="text-xs font-medium">{t('teacherInsights.recordResult.verbalRequired')}</label>
                    <Input id={`rr-v-${b.key}`} type="number" min={200} max={800} step={10} value={b.verbal}
                           aria-invalid={sectionInvalid(b.verbal)}
                           onChange={(e) => patch(b.key, { verbal: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <label htmlFor={`rr-m-${b.key}`} className="text-xs font-medium">{t('teacherInsights.recordResult.mathRequired')}</label>
                    <Input id={`rr-m-${b.key}`} type="number" min={200} max={800} step={10} value={b.math}
                           aria-invalid={sectionInvalid(b.math)}
                           onChange={(e) => patch(b.key, { math: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <span className="text-xs font-medium">{t('teacherInsights.shared.total')}</span>
                    <output className="mt-1 block w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-semibold"
                            aria-live="polite">
                      {satTotal(b) ?? '—'}
                    </output>
                  </div>
                </div>
              )}

              {isIelts && (
                <>
                  <div>
                    <label htmlFor={`rr-o-${b.key}`} className="text-xs font-medium">{t('teacherInsights.recordResult.overallBand')}</label>
                    <select id={`rr-o-${b.key}`} value={b.overall} onChange={(e) => patch(b.key, { overall: e.target.value })}
                            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {IELTS_BANDS.map((band) => <option key={band} value={band}>{band || t('teacherInsights.recordResult.select')}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {([['listening', t('teacherInsights.recordResult.listening')], ['reading', t('teacherInsights.recordResult.reading')],
                       ['writing', t('teacherInsights.recordResult.writing')], ['speaking', t('teacherInsights.recordResult.speaking')]] as const)
                      .map(([field, label]) => (
                        <div key={field}>
                          <label className="text-xs font-medium">{label}</label>
                          <select value={b[field]} onChange={(e) => patch(b.key, { [field]: e.target.value })}
                                  aria-label={t('teacherInsights.recordResult.bandAria', { section: label })}
                                  className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
                            {IELTS_BANDS.map((band) => <option key={band} value={band}>{band || '—'}</option>)}
                          </select>
                        </div>
                      ))}
                  </div>
                </>
              )}

              {examType === 'nuet' && (
                <div>
                  <label htmlFor={`rr-t-${b.key}`} className="text-xs font-medium">{t('teacherInsights.recordResult.totalScore')}</label>
                  <Input id={`rr-t-${b.key}`} type="number" value={b.overall} className="mt-1"
                         onChange={(e) => patch(b.key, { overall: e.target.value })} />
                </div>
              )}

              <div>
                <label htmlFor={`rr-proof-${b.key}`} className="text-xs font-medium">
                  {t('teacherInsights.recordResult.proof')}
                </label>
                <input id={`rr-proof-${b.key}`} type="file" accept="image/*,application/pdf"
                       onChange={(e) => patch(b.key, { proof: e.target.files?.[0] ?? null })}
                       className="mt-1 block w-full text-sm" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t('teacherInsights.recordResult.proofHint')}
                </p>
              </div>
            </div>
            {b.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{b.error}</p>}
          </fieldset>
        ))}

        {blocks.length < MAX_ATTEMPTS && (
          <Button type="button" size="sm" variant="ghost" className="mt-2" disabled={saving}
                  onClick={() => setBlocks((bs) => [...bs, blank(bs.reduce((m, x) => Math.max(m, x.key), -1) + 1)])}>
            {t('teacherInsights.recordResult.addAttempt')}
          </Button>
        )}

        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="rr-notes" className="text-xs font-medium">{t('teacherInsights.recordResult.notes')}</label>
            <Input id="rr-notes" value={notes} className="mt-1"
                   onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {allProblems.length > 0 && (
          <ul className="mt-3 text-xs text-amber-700 dark:text-amber-500 list-disc pl-4">
            {allProblems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{blocks.length === 0 ? t('common.close') : t('common.cancel')}</Button>
          {blocks.length > 0 && <Button size="sm" onClick={save} disabled={!canSave}>
            {saving ? t('teacherInsights.shared.saving') : t('teacherInsights.recordResult.saveAttempt')}
          </Button>}
        </div>
      </div>
    </div>
  , document.body);
}

export default RecordResultDialog;
