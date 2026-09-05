import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { UnitPicker, type PickedUnit } from '../../components/checkpoints/UnitPicker';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  checkCheckpointQuiz, deadlineCountdown, formatDeadline, getCheckpointMatrix, lateLabel, listCheckpointDefinitions, listCheckpointGroups,
  listUnitOptions, openCheckpoint, reopenCheckpoint, STATUS_CLASS, STATUS_LABEL, updateCheckpointDeadline,
  updateCheckpointDefinition, updateCheckpointGroupSettings,
  type CheckpointCell, type CheckpointDefinition, type CheckpointGroup, type CheckpointMatrix, type CheckpointQuizCheck, type UnitOption,
} from '../../services/api/checkpoints';

/** Local-datetime input value → ISO string the backend stores as naive UTC. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);

/** ISO string → `datetime-local` input value in the browser's local timezone. */
const toLocalInputValue = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function StatusChip({ status, skipped }: { status: CheckpointCell['status']; skipped?: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[status]}`}>{skipped ? 'Skipped' : STATUS_LABEL[status]}</span>;
}

export default function CheckpointsAdminPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  // Mirrors the backend: every staff role manages the groups it can see (the server scopes
  // teachers and curators to their own groups); definitions belong to admins and head roles.
  const canManage = ['admin', 'head_curator', 'head_teacher', 'teacher', 'curator'].includes(role);
  const canEditDefinitions = ['admin', 'head_curator', 'head_teacher'].includes(role);
  const [groups, setGroups] = useState<CheckpointGroup[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<CheckpointMatrix | null>(null);
  const [definitions, setDefinitions] = useState<CheckpointDefinition[]>([]);
  const [checks, setChecks] = useState<Record<number, CheckpointQuizCheck>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ studentId: number; cell: CheckpointCell } | null>(null);
  const [deadlineInput, setDeadlineInput] = useState('');
  // Pending unit choices per definition (absent = showing the live binding), and the course's
  // units for the picker, fetched once per course.
  const [unitEdits, setUnitEdits] = useState<Record<number, PickedUnit[]>>({});
  const [unitOptions, setUnitOptions] = useState<Record<number, UnitOption[]>>({});

  useEffect(() => {
    listCheckpointGroups('sat').then(setGroups).catch(() => toast.error('Failed to load groups'));
    listCheckpointDefinitions().then(setDefinitions).catch(() => toast.error('Failed to load definitions'));
  }, []);

  useEffect(() => {
    const wanted = new Map<number, number>();               // course_id -> a definition of that course
    definitions.forEach((d) => { if (!wanted.has(d.course_id)) wanted.set(d.course_id, d.id); });
    wanted.forEach((definitionId, courseId) => {
      setUnitOptions((prev) => {
        if (prev[courseId]) return prev;
        listUnitOptions(definitionId)
          .then((opts) => setUnitOptions((p) => ({ ...p, [courseId]: opts })))
          .catch(() => toast.error('Failed to load the course units'));
        return prev;
      });
    });
  }, [definitions]);

  const reloadGen = useRef(0);

  const reload = useCallback(async () => {
    if (!groupId) return;
    const gen = ++reloadGen.current;
    setLoading(true);
    try {
      const result = await getCheckpointMatrix(groupId);
      if (reloadGen.current === gen) setMatrix(result);
    } catch {
      toast.error('Failed to load matrix');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { setSelected(null); setMatrix(null); void reload(); }, [reload]);

  useEffect(() => {
    setSelected((prev) => {
      if (!prev || !matrix) return prev;
      const freshCell = matrix.students
        .find((s) => s.student_id === prev.studentId)
        ?.cells.find((c) => c.checkpoint_id === prev.cell.checkpoint_id);
      if (!freshCell) return null;
      if (freshCell === prev.cell) return prev;
      return { studentId: prev.studentId, cell: freshCell };
    });
  }, [matrix]);

  const group = useMemo(() => groups.find((g) => g.id === groupId) ?? null, [groups, groupId]);

  // The block most of the group is working on: median of each student's highest fully completed
  // block, plus one — the same rule as scripts/checkpoint_pilot.py. The highest block, not the
  // longest contiguous run: one unit of an early block never marked complete must not drag the
  // suggestion back to the start. A group enabled at this number gets at most the checkpoint it
  // just finished, not every block it did weeks ago.
  const suggestedStart = useMemo(() => {
    if (!matrix || matrix.students.length === 0) return null;
    const highs = matrix.students.map((s) => Math.max(0, ...s.cells
      .filter((c) => c.units.length > 0 && c.units.every((u) => u.completed))
      .map((c) => c.number))).sort((a, b) => a - b);
    const n = highs.length;
    const median = n % 2 ? highs[(n - 1) / 2] : Math.floor((highs[n / 2 - 1] + highs[n / 2]) / 2);
    const max = Math.max(1, ...matrix.definitions.map((d) => d.number));
    return Math.min(max, median + 1);
  }, [matrix]);

  const run = async (label: string, fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? `${label} failed`);
      setBusy(false);
      return false;
    }
    toast.success(label);
    try {
      const [, groupsResult, definitionsResult] = await Promise.all([
        reload(), listCheckpointGroups('sat'), listCheckpointDefinitions(),
      ]);
      setGroups(groupsResult);
      setDefinitions(definitionsResult);
    } catch (e) {
      console.warn(`Failed to refresh checkpoints admin data after ${label}`, e);
    } finally {
      setBusy(false);
    }
    return true;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">SAT Checkpoints</h1>

      {/* ---- group picker + settings ---- */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-96">
          <label className="text-xs text-muted-foreground">Group</label>
          <SearchableSelect
            className="w-full"
            value={groupId ? String(groupId) : null}
            onChange={(v) => setGroupId(Number(v))}
            placeholder="Choose a SAT group"
            searchPlaceholder="Search by group or teacher…"
            options={groups.map((g) => ({
              value: String(g.id),
              label: `${g.name}${g.checkpoints_enabled ? ' · ON' : ''}`,
              hint: `${g.teacher_name ? `${g.teacher_name} · ` : ''}${g.student_count}`,
            }))}
          />
        </div>
        {group && (
          <>
            <label className="flex items-center gap-2 rounded-lg border px-3 h-10 select-none">
              <input type="checkbox" checked={group.checkpoints_enabled} disabled={!canManage || busy}
                     onChange={(e) => run(e.target.checked ? 'Checkpoints enabled' : 'Checkpoints disabled',
                       () => updateCheckpointGroupSettings(group.id, { enabled: e.target.checked }))} />
              <span className="text-sm">Checkpoints enabled</span>
            </label>
            <div>
              <label className="text-xs text-muted-foreground">Auto-open from checkpoint #</label>
              <Input key={group.id} type="number" min={1} className="w-24" defaultValue={group.checkpoints_start_number} disabled={!canManage || busy}
                     onBlur={(e) => {
                       const n = Number(e.target.value);
                       if (n >= 1 && n !== group.checkpoints_start_number) {
                         void run('Start number saved', () => updateCheckpointGroupSettings(group.id, { start_number: n }));
                       }
                     }} />
              <p className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">
                Set this before enabling. Checkpoints below it never auto-open and never hold later units back (a mid-course group).
                {suggestedStart != null && (
                  <> Suggested: <strong className="text-foreground">{suggestedStart}</strong>{suggestedStart > 1 ? ` — half the group has finished block ${suggestedStart - 1}.` : ' — nobody has finished block 1 yet.'}</>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading} aria-label="Reload matrix">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </>
        )}
      </div>

      {/* ---- matrix ---- */}
      {matrix && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Student</th>
                {matrix.definitions.map((d) => (
                  <th key={d.id} className="px-3 py-2 text-left whitespace-nowrap">
                    <div>{d.title}{!d.is_active && <span className="ml-1 text-[10px] text-muted-foreground">(inactive)</span>}</div>
                    {canManage && (
                      <div className="mt-1 flex gap-1">
                        <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => run(`${d.title} opened for group`, () => openCheckpoint(matrix.group.id, d.id, {}))}>Open all</Button>
                        <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => window.confirm(`Reopen ${d.title} for the whole group (new 24-hour deadline)?`)
                                  && run(`${d.title} reopened for group`, () => reopenCheckpoint(matrix.group.id, d.id, {}))}>Reopen all</Button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.students.map((s) => (
                <tr key={s.student_id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div>{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.email}</div>
                  </td>
                  {s.cells.map((cell) => (
                    <td key={cell.checkpoint_id} className="px-3 py-2 align-top">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => { setSelected({ studentId: s.student_id, cell }); setDeadlineInput(toLocalInputValue(cell.deadline)); }}
                        aria-label={`${s.name} — Checkpoint ${cell.number}, ${STATUS_LABEL[cell.status]}`}
                      >
                        <StatusChip status={cell.status} skipped={cell.skipped} />
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {cell.units.map((u) => (u.completed ? '✓' : '·')).join(' ')}
                          {cell.deadline && cell.status !== 'completed' && <> · due {formatDeadline(cell.deadline)} ({deadlineCountdown(cell.deadline)})</>}
                          {cell.status === 'completed' && <> · {cell.correct_answers}/{cell.total_questions} ({cell.percentage}%)</>}
                          {cell.late && <span className="text-red-600"> · {lateLabel(cell)}</span>}
                        </div>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">
            Under each chip, one mark per required unit in order: ✓ completed, · not yet. A checkpoint opens for a student when every mark is ✓ (definition active, group enabled, number not below the group's start). Deadline is 24 hours from opening; a later submission is accepted and shown as late.
          </p>
        </div>
      )}

      {/* ---- cell detail ---- */}
      {selected && matrix && (
        <div className="rounded-lg border p-4 space-y-3 max-w-xl">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">
              {matrix.students.find((s) => s.student_id === selected.studentId)?.name} · Checkpoint {selected.cell.number}
            </h2>
            <StatusChip status={selected.cell.status} skipped={selected.cell.skipped} />
          </div>
          <ul className="text-sm space-y-1">
            {selected.cell.units.map((u) => (
              <li key={u.lesson_id}>{u.completed ? '✅' : '⬜'} {u.kind === 'verbal' ? 'Verbal' : 'Math'} — {u.title}</li>
            ))}
          </ul>
          {selected.cell.locked_reason && <p className="text-sm text-muted-foreground">{selected.cell.locked_reason}</p>}
          <dl className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
            <dt>Opened</dt><dd>{formatDeadline(selected.cell.opened_at) || '—'} {selected.cell.opened_by ? `(${selected.cell.opened_by})` : ''}</dd>
            <dt>Deadline</dt><dd>{formatDeadline(selected.cell.deadline) || '—'}</dd>
            <dt>Submitted</dt><dd>{formatDeadline(selected.cell.submitted_at) || '—'}{selected.cell.submitted_at && (selected.cell.late ? <span className="text-red-600"> · {lateLabel(selected.cell)}</span> : ' · on time')}</dd>
            <dt>Result</dt><dd>{selected.cell.percentage != null ? `${selected.cell.correct_answers}/${selected.cell.total_questions} (${selected.cell.percentage}%)` : '—'}</dd>
            <dt>Reopened</dt><dd>{selected.cell.reopen_count}×</dd>
          </dl>
          {canManage && (
            <div className="flex flex-wrap items-end gap-2">
              {selected.cell.status === 'locked' && (
                <Button size="sm" disabled={busy} onClick={() => run('Checkpoint opened',
                  () => openCheckpoint(matrix.group.id, selected.cell.checkpoint_id, { student_ids: [selected.studentId] }))}>
                  Open for student
                </Button>
              )}
              {selected.cell.status !== 'locked' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run('Checkpoint reopened',
                  () => reopenCheckpoint(matrix.group.id, selected.cell.checkpoint_id, { student_ids: [selected.studentId] }))}>
                  Reopen (new 24 hours)
                </Button>
              )}
              {selected.cell.id != null && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">New deadline (your local time)</label>
                    <Input type="datetime-local" value={deadlineInput} onChange={(e) => setDeadlineInput(e.target.value)} />
                  </div>
                  <Button size="sm" variant="outline" disabled={busy || !deadlineInput} onClick={async () => {
                    const ok = await run('Deadline updated',
                      () => updateCheckpointDeadline(selected.cell.id!, toIso(deadlineInput)!));
                    if (ok) setDeadlineInput('');
                  }}>
                    Set deadline
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- definitions ---- */}
      <div className="space-y-2">
        <h2 className="font-medium">Checkpoint definitions</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-left">Required units (2 Verbal lessons + 1 Math lesson; a lesson may be 2 units)</th>
                <th className="px-3 py-2 text-left">Questions</th>
                <th className="px-3 py-2 text-left">Quiz</th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((d) => {
                const current: PickedUnit[] = d.required_units.map((u) => ({ lesson_id: u.lesson_id, kind: u.kind, title: u.title }));
                const edit = unitEdits[d.id] ?? current;
                const unitsChanged = edit.map((u) => u.lesson_id).join(',') !== current.map((u) => u.lesson_id).join(',');
                const unitsValid = edit.filter((u) => u.kind === 'verbal').length >= 2 && edit.some((u) => u.kind === 'math') && edit.length <= 4;
                const discardUnits = () => setUnitEdits((prev) => { const next = { ...prev }; delete next[d.id]; return next; });
                const check = checks[d.id];
                return (
                  <tr key={d.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{d.title}</td>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={d.is_active} disabled={!canEditDefinitions || busy}
                             aria-label={`${d.title} active`}
                             onChange={(e) => run(`${d.title} ${e.target.checked ? 'activated' : 'deactivated'}`,
                               () => updateCheckpointDefinition(d.id, { is_active: e.target.checked }))} />
                    </td>
                    <td className="min-w-[24rem] px-3 py-2">
                      {canEditDefinitions ? (
                        <div className="space-y-1.5">
                          <UnitPicker
                            options={unitOptions[d.course_id] ?? []}
                            loading={!unitOptions[d.course_id]}
                            selected={edit}
                            disabled={busy}
                            onChange={(next) => setUnitEdits((prev) => ({ ...prev, [d.id]: next }))}
                          />
                          {unitsChanged && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="outline" disabled={busy || !unitsValid} onClick={() => {
                                void run(`${d.title} units saved`, () => updateCheckpointDefinition(d.id, {
                                  required_units: edit.map((u) => ({ lesson_id: u.lesson_id, kind: u.kind })),
                                })).then((ok) => { if (ok) discardUnits(); });
                              }}>Save</Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={discardUnits}>Cancel</Button>
                              {!unitsValid && <span className="text-[11px] text-red-600">Pick 2–3 Verbal and 1–2 Math units (4 at most)</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {d.required_units.map((u) => `${u.kind === 'verbal' ? 'V' : 'M'}:${u.title}`).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {d.question_count}/{d.total_questions}
                      <Button size="sm" variant="ghost" className="ml-1" onClick={async () => {
                        try { const res = await checkCheckpointQuiz(d.id); setChecks((prev) => ({ ...prev, [d.id]: res })); } catch { toast.error('Check failed'); }
                      }}>Check</Button>
                      {check && (
                        <div className="text-[11px] text-muted-foreground">
                          E{check.by_difficulty.easy} M{check.by_difficulty.medium} H{check.by_difficulty.hard} ?{check.by_difficulty.unset}
                          {check.problems.length === 0 ? <div className="text-emerald-600">OK</div> : check.problems.map((p) => <div key={p} className="text-red-600">{p}</div>)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {d.quiz ? (
                        <Link className="text-primary hover:underline" to={`/course/${d.quiz.course_id}/lesson/${d.quiz.lesson_id}/edit`}>Edit questions</Link>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
