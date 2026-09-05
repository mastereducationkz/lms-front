import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  checkCheckpointQuiz, formatDeadline, getCheckpointMatrix, listCheckpointDefinitions, listCheckpointGroups,
  openCheckpoint, reopenCheckpoint, STATUS_CLASS, STATUS_LABEL, updateCheckpointDeadline,
  updateCheckpointDefinition, updateCheckpointGroupSettings,
  type CheckpointCell, type CheckpointDefinition, type CheckpointGroup, type CheckpointMatrix, type CheckpointQuizCheck,
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
  const isAdmin = user?.role === 'admin';
  const [groups, setGroups] = useState<CheckpointGroup[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [matrix, setMatrix] = useState<CheckpointMatrix | null>(null);
  const [definitions, setDefinitions] = useState<CheckpointDefinition[]>([]);
  const [checks, setChecks] = useState<Record<number, CheckpointQuizCheck>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ studentId: number; cell: CheckpointCell } | null>(null);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [unitEdits, setUnitEdits] = useState<Record<number, string>>({});

  useEffect(() => {
    listCheckpointGroups('sat').then(setGroups).catch(() => toast.error('Failed to load groups'));
    listCheckpointDefinitions().then(setDefinitions).catch(() => toast.error('Failed to load definitions'));
  }, []);

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
        <div className="w-72">
          <label className="text-xs text-muted-foreground">Group</label>
          <Select value={groupId ? String(groupId) : ''} onValueChange={(v) => setGroupId(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Choose a SAT group" /></SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name} {g.checkpoints_enabled ? '· ON' : ''} ({g.student_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {group && (
          <>
            <label className="flex items-center gap-2 rounded-lg border px-3 h-10 select-none">
              <input type="checkbox" checked={group.checkpoints_enabled} disabled={!isAdmin || busy}
                     onChange={(e) => run(e.target.checked ? 'Checkpoints enabled' : 'Checkpoints disabled',
                       () => updateCheckpointGroupSettings(group.id, { enabled: e.target.checked }))} />
              <span className="text-sm">Checkpoints enabled</span>
            </label>
            <div>
              <label className="text-xs text-muted-foreground">Auto-open from checkpoint #</label>
              <Input key={group.id} type="number" min={1} className="w-24" defaultValue={group.checkpoints_start_number} disabled={!isAdmin || busy}
                     onBlur={(e) => {
                       const n = Number(e.target.value);
                       if (n >= 1 && n !== group.checkpoints_start_number) {
                         void run('Start number saved', () => updateCheckpointGroupSettings(group.id, { start_number: n }));
                       }
                     }} />
              <p className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">
                Set this before enabling. Checkpoints below it never auto-open and never hold later units back (a mid-course group).
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
                    {isAdmin && (
                      <div className="mt-1 flex gap-1">
                        <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => run(`${d.title} opened for group`, () => openCheckpoint(matrix.group.id, d.id, {}))}>Open all</Button>
                        <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => window.confirm(`Reopen ${d.title} for the whole group (new 3-day deadline)?`)
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
                          {cell.deadline && cell.status !== 'completed' && <> · due {formatDeadline(cell.deadline)}</>}
                          {cell.status === 'completed' && <> · {cell.correct_answers}/{cell.total_questions} ({cell.percentage}%)</>}
                        </div>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
            <dt>Submitted</dt><dd>{formatDeadline(selected.cell.submitted_at) || '—'}</dd>
            <dt>Result</dt><dd>{selected.cell.percentage != null ? `${selected.cell.correct_answers}/${selected.cell.total_questions} (${selected.cell.percentage}%)` : '—'}</dd>
            <dt>Reopened</dt><dd>{selected.cell.reopen_count}×</dd>
          </dl>
          {isAdmin && (
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
                  Reopen (new 3 days)
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
                <th className="px-3 py-2 text-left">Required units (lesson ids: verbal, verbal, math)</th>
                <th className="px-3 py-2 text-left">Questions</th>
                <th className="px-3 py-2 text-left">Quiz</th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((d) => {
                const current = d.required_units.map((u) => u.lesson_id).join(', ');
                const check = checks[d.id];
                return (
                  <tr key={d.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{d.title}</td>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={d.is_active} disabled={!isAdmin || busy}
                             aria-label={`${d.title} active`}
                             onChange={(e) => run(`${d.title} ${e.target.checked ? 'activated' : 'deactivated'}`,
                               () => updateCheckpointDefinition(d.id, { is_active: e.target.checked }))} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-muted-foreground">
                        {d.required_units.map((u) => `${u.kind === 'verbal' ? 'V' : 'M'}:${u.title}`).join(' · ')}
                      </div>
                      {isAdmin && (
                        <div className="mt-1 flex gap-2">
                          <Input className="w-48" placeholder={current} value={unitEdits[d.id] ?? ''}
                                 aria-label={`${d.title} required unit ids`}
                                 onChange={(e) => setUnitEdits((prev) => ({ ...prev, [d.id]: e.target.value }))} />
                          <Button size="sm" variant="outline" disabled={busy || !(unitEdits[d.id] ?? '').trim()} onClick={() => {
                            const ids = (unitEdits[d.id] ?? '').split(',').map((x) => Number(x.trim())).filter((x) => x > 0);
                            if (ids.length !== 3) { toast.error('Enter exactly 3 lesson ids: verbal, verbal, math'); return; }
                            void run(`${d.title} units saved`, () => updateCheckpointDefinition(d.id, {
                              required_units: [
                                { lesson_id: ids[0], kind: 'verbal' }, { lesson_id: ids[1], kind: 'verbal' }, { lesson_id: ids[2], kind: 'math' },
                              ],
                            }));
                          }}>Save</Button>
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
