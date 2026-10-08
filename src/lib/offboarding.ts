import type {
  Blockers,
  ChecklistItem,
  CreateOffboardingRequest,
  OffboardingMode,
  OffboardingRecord,
  OffboardingStatus,
  OffboardPreview,
  OwnerCandidates,
  Person,
  ReasonCode,
  ReassignItem,
  ReassignKind,
  RecordPermissions,
  StepStatus,
  TargetRef,
} from '../services/api/offboarding';
import '@/lib/i18n/catalogs/offboarding';

/** «Leaving soon»: records that have not run yet (the server's `status=open`). */
export const OPEN_STATUSES: readonly OffboardingStatus[] = ['awaiting_confirmation', 'pending', 'blocked'];

/**
 * The Offboard dialog's rules, kept out of the components so they can be tested
 * (docs/offboarding/SPEC.md §3–§6, API.md §2). The server decides who may do what; these only
 * decide what the dialog shows and what it sends.
 */

/** Which candidate list can take over an item of this kind (API.md /reassign rules). */
export const POOL_OF: Record<ReassignKind, keyof OwnerCandidates> = {
  group_teacher: 'teachers',
  group_curator: 'curators',
  lesson: 'teachers',
  course_head: 'head_teachers',
};

/** One thing the person owns that someone else must take over before they can leave. */
export interface HandoverItem {
  key: string;
  kind: ReassignKind;
  id: number;
  label: string;
  /** Groups: future lessons that move with the teacher seat. */
  movingLessons?: number;
  /** Lessons: when it starts (UTC ISO) and in which group. */
  startAt?: string;
  groupName?: string | null;
  suggested: Person | null;
}

export const itemKey = (kind: ReassignKind, id: number) => `${kind}:${id}`;

/**
 * The reassignable blockers in the order the dialog lists them, each with its suggested owner.
 * The server lists only lessons that do not move with a listed group (substitutions, overrides,
 * webinars), so every lesson here needs its own choice.
 */
export function handoverItems(preview: Pick<OffboardPreview, 'blockers' | 'suggested_owners'>): HandoverItem[] {
  const suggested = new Map((preview.suggested_owners ?? []).map((s) => [itemKey(s.kind, s.id), s.owner ?? null]));
  const { blockers } = preview;
  const make = (kind: ReassignKind, id: number, label: string, extra: Partial<HandoverItem> = {}): HandoverItem => ({
    key: itemKey(kind, id), kind, id, label, suggested: suggested.get(itemKey(kind, id)) ?? null, ...extra,
  });
  return [
    ...blockers.groups.map((g) => g.role === 'curator'
      ? make('group_curator', g.id, g.name)
      : make('group_teacher', g.id, g.name, { movingLessons: g.future_lessons ?? 0 })),
    ...blockers.lessons.map((l) => make('lesson', l.id, l.title, { startAt: l.start_at, groupName: l.group_name ?? null })),
    ...blockers.courses.map((c) => make('course_head', c.id, c.title)),
  ];
}

export type Assignments = Record<string, number | null>;

/** Every item starts on its suggested owner (the programme default); the person can change each. */
export function initialAssignments(items: HandoverItem[]): Assignments {
  return mergeAssignments({}, items);
}

/** After a recheck: keep the choices already made for items still listed, suggest for new ones. */
export function mergeAssignments(previous: Assignments, items: HandoverItem[]): Assignments {
  return Object.fromEntries(items.map((i) => [i.key, i.key in previous ? previous[i.key] : i.suggested?.id ?? null]));
}

/** The people one may pick for an item: its candidate pool, plus the suggestion if it is not in it. */
export function ownerOptions(item: HandoverItem, candidates: OwnerCandidates | null | undefined): Person[] {
  const pool = [...(candidates?.[POOL_OF[item.kind]] ?? [])];
  if (item.suggested && !pool.some((p) => p.id === item.suggested!.id)) pool.unshift(item.suggested);
  return pool;
}

/**
 * Who can take over EVERYTHING in one go: the people eligible for every kind of item listed
 * (a curator's groups need a curator, a head teacher's courses a head teacher). The server's
 * `all_to` would skip what does not fit; offering only these keeps «all» meaning all.
 */
export function allToOptions(items: HandoverItem[], candidates: OwnerCandidates | null | undefined): Person[] {
  const pools = [...new Set(items.map((i) => POOL_OF[i.kind]))];
  if (!pools.length || !candidates) return [];
  const [first, ...rest] = pools.map((pool) => candidates[pool] ?? []);
  return first.filter((p) => rest.every((list) => list.some((q) => q.id === p.id)));
}

/** The reassign request for the items that have an owner chosen; `missing` lists the rest. */
export function reassignPlan(items: HandoverItem[], assignments: Assignments): { items: ReassignItem[]; missing: HandoverItem[] } {
  const chosen: ReassignItem[] = [];
  const missing: HandoverItem[] = [];
  for (const item of items) {
    const owner = assignments[item.key];
    if (owner == null) missing.push(item);
    else chosen.push({ kind: item.kind, id: item.id, new_owner_id: owner });
  }
  return { items: chosen, missing };
}

/** Anything still owned blocks the request — SAT-native groups too, though only SAT admin can move them. */
export function hasBlockers(blockers: Blockers): boolean {
  return blockers.groups.length + blockers.lessons.length + blockers.courses.length + blockers.sat_native.length > 0;
}

/** Emergency switch-off is for admins, and only when the server offers it (SPEC §12 Q93). */
export function mayUseEmergency(viewerRole: string | null | undefined, modes: readonly OffboardingMode[]): boolean {
  return viewerRole === 'admin' && modes.includes('emergency');
}

/** Items an emergency switch-off left assigned and nobody has taken over yet. */
export function unresolvedItems(record: Pick<OffboardingRecord, 'open_items'>): NonNullable<OffboardingRecord['open_items']> {
  return (record.open_items ?? []).filter((item) => !item.resolved);
}

/** Where the dialog is, given what the preview says. */
export type DialogStage = 'not_allowed' | 'open_record' | 'handover' | 'details';

export function dialogStage(preview: Pick<OffboardPreview, 'open_record' | 'can_offboard' | 'blockers'>): DialogStage {
  if (preview.open_record && OPEN_STATUSES.includes(preview.open_record.status)) return 'open_record';
  if (!preview.can_offboard) return 'not_allowed';
  return hasBlockers(preview.blockers) ? 'handover' : 'details';
}

/** The person as the server should look them up: by LMS id when they have one (API.md §2). */
export function targetRef(target: { lms_user_id: number | null; crm_user_id: number | null }): TargetRef | null {
  if (target.lms_user_id != null) return { lms_user_id: target.lms_user_id };
  if (target.crm_user_id != null) return { crm_user_id: target.crm_user_id };
  return null;
}

/** Today in Kazakhstan as YYYY-MM-DD — the last day is an Almaty calendar date (SPEC §1). */
export function almatyToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The furthest last day the server takes: today + 366 days (API.md POST /). */
export function latestLastDay(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 366)).toISOString().slice(0, 10);
}

export interface OffboardForm {
  mode: OffboardingMode;
  lastDay: string;
  reason: ReasonCode | '';
  note: string;
}

export type FormProblem = 'last_day_missing' | 'last_day_past' | 'last_day_too_far' | 'reason_missing';

export function formProblems(form: OffboardForm, today: string): FormProblem[] {
  const problems: FormProblem[] = [];
  if (form.mode === 'scheduled') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.lastDay)) problems.push('last_day_missing');
    else if (form.lastDay < today) problems.push('last_day_past');
    else if (form.lastDay > latestLastDay(today)) problems.push('last_day_too_far');
  }
  if (!form.reason) problems.push('reason_missing');
  return problems;
}

/** The create request; "immediately" (and an emergency) means today as the last day (SPEC §1). */
export function createRequest(target: TargetRef, form: OffboardForm, today: string): CreateOffboardingRequest {
  const note = form.note.trim();
  return {
    ...target,
    mode: form.mode,
    last_day: form.mode === 'scheduled' ? form.lastDay : today,
    reason_code: form.reason as ReasonCode,
    note: note || null,
  };
}

/**
 * What the viewer may do on a record: the server's `allowed` when it sent one, otherwise the
 * same rules worked out here. The server re-checks every action either way.
 */
export function recordActions(record: OffboardingRecord, viewerId: number | null): RecordPermissions {
  if (record.allowed) return record.allowed;
  const open = OPEN_STATUSES.includes(record.status);
  return {
    cancel: open,
    // The second admin must be someone else than the one who asked (SPEC §2).
    confirm: record.status === 'awaiting_confirmation' && viewerId != null && record.requested_by?.lms_user_id !== viewerId,
    reactivate: record.status === 'completed',
    tick_checklist: true,
  };
}

/**
 * A checklist line in the reader's language: the catalog's sentence for its kind, filled from
 * `params`, or the server's English text when the kind is new or a blank is missing.
 */
export function checklistText(
  item: Pick<ChecklistItem, 'kind' | 'text' | 'params'>,
  translate: (key: string, params: Record<string, string | number>) => string | null,
): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(item.params ?? {})) {
    if (typeof v === 'string' || typeof v === 'number') params[k] = v;
  }
  const text = translate(`offboarding.checklist.${item.kind}`, params);
  return text && !/\{\w+\}/.test(text) ? text : item.text;
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const STATUS_TONE: Record<OffboardingStatus, Tone> = {
  awaiting_confirmation: 'warning',
  pending: 'info',
  blocked: 'danger',
  completed: 'success',
  cancelled: 'neutral',
  reactivated: 'neutral',
};

export const STEP_TONE: Record<StepStatus, Tone> = {
  pending: 'info',
  done: 'success',
  failed: 'danger',
  refused: 'warning',
  skipped: 'neutral',
};

export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-muted text-foreground/80',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-200',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

/** Roles the LMS can offboard at all (never students or parents, SPEC scope). */
export const STAFF_ROLES: ReadonlySet<string> = new Set(['teacher', 'head_teacher', 'curator', 'head_curator', 'admin']);

/**
 * Whether a viewer sees the Offboard action on a person, before the server's own check (API.md §4):
 * admins on any staff member but themselves, head curators on curators, head teachers on teachers.
 */
export function mayOfferOffboard(
  viewer: { id?: string | number | null; role?: string | null } | null | undefined,
  target: { id: string | number; role?: string | null },
): boolean {
  if (!viewer || !target.role || !STAFF_ROLES.has(target.role) || String(viewer.id) === String(target.id)) return false;
  if (viewer.role === 'admin') return true;
  if (viewer.role === 'head_curator') return target.role === 'curator';
  if (viewer.role === 'head_teacher') return target.role === 'teacher';
  return false;
}
