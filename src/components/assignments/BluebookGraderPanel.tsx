import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  getBluebookResult,
  openBluebookReport,
  overrideBluebookResult,
  type BluebookResultDetail,
} from '../../services/api/exams';

/**
 * What a grader sees for a Bluebook task: the parsed scores, the source PDF, and a way
 * to correct a value.
 *
 * Both matter. The student cannot type or edit a Bluebook score - it is read from the
 * official report - so whoever grades the work has to be able to open that report,
 * otherwise "the report says 720" is an unverifiable claim. And when a parse is wrong
 * there has to be a route to fix it that does not involve editing the database by hand.
 * Corrections record who made them and why, so a corrected score is never mistaken for
 * a parsed one.
 */

interface Props {
  assignmentId: number;
  studentId: number;
  /** Values echoed in the submission payload, used until the authoritative row loads. */
  fallback?: {
    test_number?: number;
    verbal_score?: number;
    math_score?: number;
    total_score?: number;
    report_date?: string | null;
    student_name?: string | null;
    name_matches?: boolean;
  } | null;
}

export function BluebookGraderPanel({ assignmentId, studentId, fallback }: Props) {
  const [result, setResult] = useState<BluebookResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [verbal, setVerbal] = useState('');
  const [math, setMath] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(assignmentId) || !Number.isFinite(studentId)) {
      setLoading(false);
      return;
    }
    try {
      const row = await getBluebookResult(assignmentId, studentId);
      setResult(row);
      setVerbal(String(row.verbal_score));
      setMath(String(row.math_score));
    } catch {
      setResult(null);   // fall back to the submission payload below
    } finally {
      setLoading(false);
    }
  }, [assignmentId, studentId]);

  useEffect(() => { load(); }, [load]);

  const invalid = (raw: string) => {
    const n = Number(raw);
    return raw === '' || Number.isNaN(n) || n < 200 || n > 800 || n % 10 !== 0;
  };
  const canSave = !invalid(verbal) && !invalid(math) && reason.trim().length >= 3 && !saving;

  const saveOverride = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await overrideBluebookResult(result.id, {
        verbal_score: Number(verbal),
        math_score: Number(math),
        reason: reason.trim(),
      });
      setResult(updated);
      setEditing(false);
      setReason('');
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not save the correction.');
    } finally {
      setSaving(false);
    }
  };

  const shown = result ?? (fallback ? {
    id: 0,
    test_number: fallback.test_number ?? 0,
    verbal_score: fallback.verbal_score ?? 0,
    math_score: fallback.math_score ?? 0,
    total_score: fallback.total_score ?? 0,
    report_date: fallback.report_date ?? null,
    report_student_name: fallback.student_name ?? null,
    report_name_matches: fallback.name_matches ?? null,
    has_report: false,
    overridden_at: null,
    override_reason: null,
  } as BluebookResultDetail : null);

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading the submitted report…</p>;
  }
  if (!shown) {
    return (
      <p className="text-xs text-muted-foreground">
        No official report has been submitted for this task yet.
      </p>
    );
  }

  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium">
          From the official report — SAT Practice {shown.test_number}
          {shown.report_date ? ` · ${shown.report_date}` : ''}
        </div>
        <div className="flex items-center gap-2">
          {(result?.has_report ?? false) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openBluebookReport(assignmentId, studentId).catch(
                () => setError('Could not open the report.'))}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Open PDF
            </Button>
          )}
          {result && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Correct scores
            </Button>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[11px] text-muted-foreground">Reading &amp; Writing</div>
            <div className="text-lg font-semibold">{shown.verbal_score}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Math</div>
            <div className="text-lg font-semibold">{shown.math_score}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Total</div>
            <div className="text-lg font-bold">{shown.total_score}</div>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="bb-ov-v" className="text-[11px] font-medium">Reading &amp; Writing</label>
              <Input id="bb-ov-v" type="number" min={200} max={800} step={10} value={verbal}
                     aria-invalid={invalid(verbal)}
                     onChange={(e) => setVerbal(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label htmlFor="bb-ov-m" className="text-[11px] font-medium">Math</label>
              <Input id="bb-ov-m" type="number" min={200} max={800} step={10} value={math}
                     aria-invalid={invalid(math)}
                     onChange={(e) => setMath(e.target.value)} className="mt-1" />
            </div>
            <div>
              <span className="text-[11px] font-medium">Total</span>
              <output className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold"
                      aria-live="polite">
                {invalid(verbal) || invalid(math) ? '—' : Number(verbal) + Number(math)}
              </output>
            </div>
          </div>
          <div>
            <label htmlFor="bb-ov-r" className="text-[11px] font-medium">
              Reason for the correction *
            </label>
            <Input id="bb-ov-r" value={reason} className="mt-1"
                   placeholder="e.g. report was for a retake; parsed value was wrong"
                   onChange={(e) => setReason(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Recorded with your name, so a corrected score is never mistaken for a
              parsed one. Scores must be 200–800 in steps of 10.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setReason(''); }}
                    disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={saveOverride} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save correction'}
            </Button>
          </div>
        </div>
      )}

      {shown.report_student_name && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Report name: {shown.report_student_name}
          {shown.report_name_matches === false && (
            <span className="ml-1 inline-flex items-center gap-1 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              does not match the account name — check this is the student's own report
            </span>
          )}
        </div>
      )}

      {shown.overridden_at && (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-500">
          Corrected by staff on {shown.overridden_at.slice(0, 10)}
          {shown.override_reason ? ` — ${shown.override_reason}` : ''}
        </p>
      )}

      {error && <p className="mt-2 text-[11px] text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  );
}

export default BluebookGraderPanel;
