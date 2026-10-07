import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, Loader2, RefreshCw, Square, SquareCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { SearchableSelect } from '../../components/ui/searchable-select';
import { UnitPicker, type PickedUnit } from '../../components/checkpoints/UnitPicker';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { canEditCourseContent } from '../../lib/courseAccess';
import {
  checkCheckpointQuiz, deadlineCountdown, formatDeadline, getCheckpointMatrix, lateLabel, listCheckpointDefinitions, listCheckpointGroups,
  listUnitOptions, openCheckpoint, reopenCheckpoint, STATUS_CLASS, updateCheckpointDeadline,
  updateCheckpointDefinition, updateCheckpointGroupSettings,
  type CheckpointCell, type CheckpointDefinition, type CheckpointGroup, type CheckpointMatrix, type CheckpointQuizCheck, type UnitOption,
} from '../../services/api/checkpoints';
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/adminPages';

const STATUS_KEY: Record<CheckpointCell['status'], MessageKey> = {
  locked: 'adminPages.checkpoints.status.locked',
  available: 'adminPages.checkpoints.status.available',
  completed: 'adminPages.checkpoints.status.completed',
  overdue: 'adminPages.checkpoints.status.overdue',
  reopened: 'adminPages.checkpoints.status.reopened',
};

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
  const t = useT();
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[status]}`}>{skipped ? t('adminPages.checkpoints.status.skipped') : t(STATUS_KEY[status])}</span>;
}

export default function CheckpointsAdminPage() {
  const { user } = useAuth();
  const t = useT();
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
    listCheckpointGroups('sat').then(setGroups).catch(() => toast.error(t('adminPages.checkpoints.loadGroupsFailed')));
    listCheckpointDefinitions().then(setDefinitions).catch(() => toast.error(t('adminPages.checkpoints.loadDefinitionsFailed')));
  }, [t]);

  useEffect(() => {
    const wanted = new Map<number, number>();               // course_id -> a definition of that course
    definitions.forEach((d) => { if (!wanted.has(d.course_id)) wanted.set(d.course_id, d.id); });
    wanted.forEach((definitionId, courseId) => {
      setUnitOptions((prev) => {
        if (prev[courseId]) return prev;
        listUnitOptions(definitionId)
          .then((opts) => setUnitOptions((p) => ({ ...p, [courseId]: opts })))
          .catch(() => toast.error(t('adminPages.checkpoints.loadUnitsFailed')));
        return prev;
      });
    });
  }, [definitions, t]);

  const reloadGen = useRef(0);

  const reload = useCallback(async () => {
    if (!groupId) return;
    const gen = ++reloadGen.current;
    setLoading(true);
    try {
      const result = await getCheckpointMatrix(groupId);
      if (reloadGen.current === gen) setMatrix(result);
    } catch {
      toast.error(t('adminPages.checkpoints.loadMatrixFailed'));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

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
      toast.error(e?.response?.data?.detail ?? t('adminPages.checkpoints.actionFailed', { action: label }));
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
      <h1 className="text-2xl font-semibold">{t('adminPages.checkpoints.title')}</h1>

      {/* ---- group picker + settings ---- */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-96">
          <label className="text-xs text-muted-foreground">{t('adminPages.checkpoints.group')}</label>
          <SearchableSelect
            className="w-full"
            value={groupId ? String(groupId) : null}
            onChange={(v) => setGroupId(Number(v))}
            placeholder={t('adminPages.checkpoints.chooseGroup')}
            searchPlaceholder={t('adminPages.checkpoints.searchGroup')}
            options={groups.map((g) => ({
              value: String(g.id),
              label: g.checkpoints_enabled ? t('adminPages.checkpoints.groupOn', { name: g.name }) : g.name,
              hint: `${g.teacher_name ? `${g.teacher_name} · ` : ''}${g.student_count}`,
            }))}
          />
        </div>
        {group && (
          <>
            <label className="flex items-center gap-2 rounded-lg border px-3 h-10 select-none">
              <input type="checkbox" checked={group.checkpoints_enabled} disabled={!canManage || busy}
                     onChange={(e) => run(e.target.checked ? t('adminPages.checkpoints.enabled') : t('adminPages.checkpoints.disabled'),
                       () => updateCheckpointGroupSettings(group.id, { enabled: e.target.checked }))} />
              <span className="text-sm">{t('adminPages.checkpoints.enabled')}</span>
            </label>
            <div>
              <label className="text-xs text-muted-foreground">{t('adminPages.checkpoints.autoOpenFrom')}</label>
              <Input key={group.id} type="number" min={1} className="w-24" defaultValue={group.checkpoints_start_number} disabled={!canManage || busy}
                     onBlur={(e) => {
                       const n = Number(e.target.value);
                       if (n >= 1 && n !== group.checkpoints_start_number) {
                         void run(t('adminPages.checkpoints.startSaved'), () => updateCheckpointGroupSettings(group.id, { start_number: n }));
                       }
                     }} />
              <p className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">
                {t('adminPages.checkpoints.startHelp')}
                {suggestedStart != null && (
                  <> {t('adminPages.checkpoints.suggested')} <strong className="text-foreground">{suggestedStart}</strong> {suggestedStart > 1 ? t('adminPages.checkpoints.suggestedHalfDone', { block: suggestedStart - 1 }) : t('adminPages.checkpoints.suggestedNoneDone')}</>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading} aria-label={t('adminPages.checkpoints.reloadMatrix')}>
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
                <th className="px-3 py-2 text-left">{t('adminPages.checkpoints.student')}</th>
                {matrix.definitions.map((d) => (
                  <th key={d.id} className="px-3 py-2 text-left whitespace-nowrap">
                    <div>{d.title}{!d.is_active && <span className="ml-1 text-[10px] text-muted-foreground">{t('adminPages.checkpoints.inactive')}</span>}</div>
                    {canManage && (
                      <div className="mt-1 flex gap-1">
                        <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => run(t('adminPages.checkpoints.openedForGroup', { title: d.title }), () => openCheckpoint(matrix.group.id, d.id, {}))}>{t('adminPages.checkpoints.openAll')}</Button>
                        <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => window.confirm(t('adminPages.checkpoints.reopenAllConfirm', { title: d.title }))
                                  && run(t('adminPages.checkpoints.reopenedForGroup', { title: d.title }), () => reopenCheckpoint(matrix.group.id, d.id, {}))}>{t('adminPages.checkpoints.reopenAll')}</Button>
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
                        aria-label={t('adminPages.checkpoints.cellLabel', { name: s.name, number: cell.number, status: t(STATUS_KEY[cell.status]) })}
                      >
                        <StatusChip status={cell.status} skipped={cell.skipped} />
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-0.5 align-[-1px]" aria-label={t('adminPages.checkpoints.unitsCompleted', { done: cell.units.filter((u) => u.completed).length, total: cell.units.length })}>
                            {cell.units.map((u) => (u.completed
                              ? <Check key={u.lesson_id} className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} aria-hidden="true" />
                              : <Circle key={u.lesson_id} className="h-2 w-2" aria-hidden="true" />))}
                          </span>
                          {cell.deadline && cell.status !== 'completed' && <> · {t('adminPages.checkpoints.due', { date: formatDeadline(cell.deadline), countdown: deadlineCountdown(cell.deadline) })}</>}
                          {cell.status === 'completed' && <> · {cell.correct_answers}/{cell.total_questions} ({cell.percentage}%)</>}
                          {cell.late && <span className="text-red-600 dark:text-red-400"> · {lateLabel(cell)}</span>}
                        </div>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">
            {t('adminPages.checkpoints.legendStart')} <Check className="inline h-3 w-3 align-[-2px] text-emerald-600 dark:text-emerald-400" strokeWidth={3} aria-label={t('adminPages.checkpoints.legendCheck')} /> {t('adminPages.checkpoints.legendCompleted')} <Circle className="inline h-2 w-2" aria-label={t('adminPages.checkpoints.legendCircle')} /> {t('adminPages.checkpoints.legendNotYet')} {t('adminPages.checkpoints.legendRule')}
          </p>
        </div>
      )}

      {/* ---- cell detail ---- */}
      {selected && matrix && (
        <div className="rounded-lg border p-4 space-y-3 max-w-xl">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">
              {t('adminPages.checkpoints.cellTitle', { name: matrix.students.find((s) => s.student_id === selected.studentId)?.name ?? '', number: selected.cell.number })}
            </h2>
            <StatusChip status={selected.cell.status} skipped={selected.cell.skipped} />
          </div>
          <ul className="text-sm space-y-1">
            {selected.cell.units.map((u) => (
              <li key={u.lesson_id} className="flex items-start gap-1.5">
                {u.completed
                  ? <SquareCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={t('adminPages.checkpoints.unitCompleted')} />
                  : <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={t('adminPages.checkpoints.unitNotCompleted')} />}
                <span>{u.kind === 'verbal' ? t('adminPages.checkpoints.verbal') : t('adminPages.checkpoints.math')} — {u.title}</span>
              </li>
            ))}
          </ul>
          {selected.cell.locked_reason && <p className="text-sm text-muted-foreground">{selected.cell.locked_reason}</p>}
          <dl className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
            <dt>{t('adminPages.checkpoints.opened')}</dt><dd>{formatDeadline(selected.cell.opened_at) || '—'} {selected.cell.opened_by ? `(${selected.cell.opened_by})` : ''}</dd>
            <dt>{t('adminPages.checkpoints.deadline')}</dt><dd>{formatDeadline(selected.cell.deadline) || '—'}</dd>
            <dt>{t('adminPages.checkpoints.submitted')}</dt><dd>{formatDeadline(selected.cell.submitted_at) || '—'}{selected.cell.submitted_at && (selected.cell.late ? <span className="text-red-600 dark:text-red-400"> · {lateLabel(selected.cell)}</span> : ` · ${t('adminPages.checkpoints.onTime')}`)}</dd>
            <dt>{t('adminPages.checkpoints.result')}</dt><dd>{selected.cell.percentage != null ? `${selected.cell.correct_answers}/${selected.cell.total_questions} (${selected.cell.percentage}%)` : '—'}</dd>
            <dt>{t('adminPages.checkpoints.reopenCount')}</dt><dd>{selected.cell.reopen_count}×</dd>
          </dl>
          {canManage && (
            <div className="flex flex-wrap items-end gap-2">
              {selected.cell.status === 'locked' && (
                <Button size="sm" disabled={busy} onClick={() => run(t('adminPages.checkpoints.checkpointOpened'),
                  () => openCheckpoint(matrix.group.id, selected.cell.checkpoint_id, { student_ids: [selected.studentId] }))}>
                  {t('adminPages.checkpoints.openForStudent')}
                </Button>
              )}
              {selected.cell.status !== 'locked' && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(t('adminPages.checkpoints.checkpointReopened'),
                  () => reopenCheckpoint(matrix.group.id, selected.cell.checkpoint_id, { student_ids: [selected.studentId] }))}>
                  {t('adminPages.checkpoints.reopenForStudent')}
                </Button>
              )}
              {selected.cell.id != null && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('adminPages.checkpoints.newDeadline')}</label>
                    <Input type="datetime-local" value={deadlineInput} onChange={(e) => setDeadlineInput(e.target.value)} />
                  </div>
                  <Button size="sm" variant="outline" disabled={busy || !deadlineInput} onClick={async () => {
                    const ok = await run(t('adminPages.checkpoints.deadlineUpdated'),
                      () => updateCheckpointDeadline(selected.cell.id!, toIso(deadlineInput)!));
                    if (ok) setDeadlineInput('');
                  }}>
                    {t('adminPages.checkpoints.setDeadline')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- definitions ---- */}
      <div className="space-y-2">
        <h2 className="font-medium">{t('adminPages.checkpoints.definitions')}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">{t('adminPages.checkpoints.active')}</th>
                <th className="px-3 py-2 text-left">{t('adminPages.checkpoints.requiredUnits')}</th>
                <th className="px-3 py-2 text-left">{t('adminPages.checkpoints.questions')}</th>
                <th className="px-3 py-2 text-left">{t('adminPages.checkpoints.quiz')}</th>
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
                             aria-label={t('adminPages.checkpoints.definitionActive', { title: d.title })}
                             onChange={(e) => run(t(e.target.checked ? 'adminPages.checkpoints.definitionActivated' : 'adminPages.checkpoints.definitionDeactivated', { title: d.title }),
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
                                void run(t('adminPages.checkpoints.unitsSaved', { title: d.title }), () => updateCheckpointDefinition(d.id, {
                                  required_units: edit.map((u) => ({ lesson_id: u.lesson_id, kind: u.kind })),
                                })).then((ok) => { if (ok) discardUnits(); });
                              }}>{t('common.save')}</Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={discardUnits}>{t('common.cancel')}</Button>
                              {!unitsValid && <span className="text-[11px] text-red-600 dark:text-red-400">{t('adminPages.checkpoints.unitsInvalid')}</span>}
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
                        try { const res = await checkCheckpointQuiz(d.id); setChecks((prev) => ({ ...prev, [d.id]: res })); } catch { toast.error(t('adminPages.checkpoints.checkFailed')); }
                      }}>{t('adminPages.checkpoints.check')}</Button>
                      {check && (
                        <div className="text-[11px] text-muted-foreground">
                          E{check.by_difficulty.easy} M{check.by_difficulty.medium} H{check.by_difficulty.hard} ?{check.by_difficulty.unset}
                          {check.problems.length === 0 ? <div className="text-emerald-600 dark:text-emerald-400">OK</div> : check.problems.map((p) => <div key={p} className="text-red-600 dark:text-red-400">{p}</div>)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {/* Questions are course content: head curators view them, admins and head
                          teachers edit them (2026-10-03). */}
                      {d.quiz ? (
                        canEditCourseContent(role) ? (
                          <Link className="text-primary hover:underline" to={`/course/${d.quiz.course_id}/lesson/${d.quiz.lesson_id}/edit`}>{t('adminPages.checkpoints.editQuestions')}</Link>
                        ) : (
                          <Link className="text-primary hover:underline" to={`/course/${d.quiz.course_id}/lesson/${d.quiz.lesson_id}`}>{t('adminPages.checkpoints.viewQuestions')}</Link>
                        )
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
