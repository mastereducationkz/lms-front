import { api } from './client';

/**
 * Staff offboarding (docs/offboarding/SPEC.md; shapes in docs/offboarding/API.md): the LMS-front
 * side of `/admin/offboarding/*`. Reads never use the request cache — a record moves on its own
 * (the scheduler runs it at the end of the last day) and two admins act on the same list.
 * Mutations go through the client, whose /admin rule drops the cached groups, users and lessons
 * a handover changes.
 *
 * Refusals come back as `OffboardingError`: the server's sentence (already in the reader's
 * language when its reason_code is in the catalog), the code, and the blockers when the request
 * was refused because the person still owns something.
 */

const BASE = '/admin/offboarding';
const NO_CACHE = { cache: false } as never;

export type Programme = 'sat' | 'ielts' | 'general_english' | 'nuet';
export const PROGRAMMES: readonly Programme[] = ['sat', 'ielts', 'general_english', 'nuet'];

export type OffboardingStatus =
  | 'awaiting_confirmation' | 'pending' | 'blocked' | 'completed' | 'cancelled' | 'reactivated';

/** `emergency` (SPEC §12 Q93, admins only): at once, ignoring what they own; offered only when config lists it. */
export type OffboardingMode = 'scheduled' | 'immediate' | 'emergency';
export type ReasonCode = 'resigned' | 'dismissed' | 'contract_ended' | 'test_or_duplicate' | 'other';
export const REASON_CODES: readonly ReasonCode[] = ['resigned', 'dismissed', 'contract_ended', 'test_or_duplicate', 'other'];

export type StepName = 'lms' | 'zitadel_ielts' | 'sat' | 'support' | 'crm' | 'notify';
export const STEP_NAMES: readonly StepName[] = ['lms', 'zitadel_ielts', 'sat', 'support', 'crm', 'notify'];
export type StepStatus = 'pending' | 'done' | 'failed' | 'refused' | 'skipped';

export interface OffboardingConfig {
  enabled: boolean;
  reasons: ReasonCode[];
  /** Always all three; whether THIS caller may use `emergency` is `can_emergency`. */
  modes: OffboardingMode[];
  programmes: Programme[];
  can_emergency: boolean;
}

export interface Person {
  id: number;
  name: string;
  role?: string | null;
}

export interface OffboardTarget {
  lms_user_id: number | null;
  crm_user_id: number | null;
  name: string;
  email?: string | null;
  /** The LMS role; null for CRM-only staff. */
  role: string | null;
  crm_roles?: string[];
  crm_checked?: boolean;
  is_active?: boolean;
  is_admin?: boolean;
}

export type ReassignKind = 'group_teacher' | 'group_curator' | 'lesson' | 'course_head';

export interface BlockerGroup {
  id: number;
  name: string;
  /** The seat they hold in it; a person who is both gets two rows. */
  role: 'teacher' | 'curator';
  program_type?: Programme | null;
  students?: number;
  /** Future class lessons that move with a teacher handover. */
  future_lessons?: number;
  /** Preview only: the programme default (or the course's head teacher); null when none fits. */
  suggested_owner?: Person | null;
}

/** A future lesson that does NOT move with a listed group (substitution, override, webinar…). */
export interface BlockerLesson {
  id: number;
  title: string;
  start_at: string;
  group_id?: number | null;
  group_name?: string | null;
  event_type?: string | null;
  suggested_owner?: Person | null;
}

export interface BlockerCourse {
  id: number;
  title: string;
  course_type?: string | null;
  suggested_owner?: Person | null;
}

export interface SatNativeGroup {
  id: number | string;
  name: string;
  exam_type?: string | null;
  role_on_group?: string | null;
  active_students?: number | null;
}

export interface Blockers {
  groups: BlockerGroup[];
  lessons: BlockerLesson[];
  courses: BlockerCourse[];
  sat_native: SatNativeGroup[];
  /** False when SAT did not answer: a warning, not a block (SPEC §3). */
  sat_checked: boolean;
  sat_warning?: string | null;
}

export interface SuggestedOwner {
  kind: ReassignKind;
  id: number;
  owner: Person | null;
}

/** Active staff who may receive items: teachers include head teachers, curators head curators. */
export interface OwnerCandidates {
  teachers: Person[];
  curators: Person[];
  head_teachers: Person[];
}

export interface Actor {
  lms_user_id?: number | null;
  crm_user_id?: number | null;
  name: string;
  role?: string | null;
}

export interface StepResult {
  status: StepStatus;
  detail?: string | null;
  at?: string | null;
  attempts?: number;
  /** SAT only: its answer (deactivated, already_inactive, protected, …). */
  reason?: string | null;
}

export type ChecklistKind = 'workspace' | 'amocrm' | 'telegram_chat' | 'sat' | 'support' | 'crm' | 'zitadel_ielts';

export interface ChecklistItem {
  id: string;
  kind: ChecklistKind | string;
  /** English; `params` let the front phrase it in the reader's language. */
  text: string;
  params?: Record<string, unknown> | null;
  done: boolean;
  done_at?: string | null;
  done_by?: Actor | null;
}

export interface OwnedSnapshot {
  groups?: Array<{ id: number; name: string; role?: string | null; program_type?: string | null; running?: boolean }>;
  courses_headed?: Array<{ id: number; title: string }>;
  telegram_chats?: Array<{ support_group_id?: number | null; chat_title: string; group_id?: number | null; group_name?: string | null }>;
  captured_at?: string | null;
}

export interface Handover {
  kind: ReassignKind;
  item_id: number;
  label: string;
  to_user_id: number;
  to_name: string;
  moved_lessons?: number | null;
  at: string;
  by?: Actor | null;
}

/** An item an emergency switch-off left assigned to the leaver, until someone reassigns it (SPEC §12). */
export interface OpenItem {
  kind: ReassignKind;
  id: number;
  label: string;
  program_type?: string | null;
  /** Lessons only. */
  start_at?: string | null;
  resolved: boolean;
  resolved_at?: string | null;
  /** `reassigned`: someone else holds it; `ended`: the group finished, the lesson passed or was cancelled. */
  resolution?: 'reassigned' | 'ended' | null;
  resolved_to?: { id: number; name: string } | null;
}

export interface RecordPermissions {
  cancel: boolean;
  confirm: boolean;
  reactivate: boolean;
  tick_checklist: boolean;
  /** Failed or refused steps this caller may re-run (sat, support, crm). */
  retry_steps?: StepName[];
}

export interface OffboardingRecord {
  id: number;
  lms_user_id: number | null;
  crm_user_id: number | null;
  target: { name: string; role: string | null; email?: string | null };
  mode: OffboardingMode;
  /** Almaty calendar date, YYYY-MM-DD. */
  last_day: string;
  effective_at: string;
  /** Null unless the viewer is an admin. */
  reason_code: ReasonCode | null;
  note?: string | null;
  requested_by: Actor | null;
  confirmed_by?: Actor | null;
  status: OffboardingStatus;
  steps: Partial<Record<StepName, StepResult>>;
  reactivation_steps?: Partial<Record<StepName, StepResult>> | null;
  checklist: ChecklistItem[];
  owned_snapshot?: OwnedSnapshot | null;
  handovers?: Handover[];
  blocked_reason?: { blockers: Blockers; at: string } | null;
  /** Emergency records only: what was left assigned to them (SPEC §12 Q93). */
  open_items?: OpenItem[] | null;
  /** Completed with an unresolved open item. */
  needs_reassignment?: boolean;
  created_at: string;
  cancelled_at?: string | null;
  cancelled_by?: Actor | null;
  completed_at?: string | null;
  reactivated_at?: string | null;
  reactivated_by?: Actor | null;
  allowed?: RecordPermissions;
}

export interface OffboardPreview {
  target: OffboardTarget;
  can_offboard: boolean;
  /** The caller is an admin and the target may be offboarded; an open record does not prevent it. */
  can_emergency?: boolean;
  why_not?: { code: string; message: string } | null;
  needs_second_admin: boolean;
  blocked: boolean;
  blockers: Blockers;
  suggested_owners: SuggestedOwner[];
  candidates: OwnerCandidates;
  open_record?: OffboardingRecord | null;
}

export interface ReassignItem {
  kind: ReassignKind;
  id: number;
  new_owner_id: number;
}

export type ReassignRequest =
  | { lms_user_id: number; items: ReassignItem[] }
  | { lms_user_id: number; all_to: number };

export interface ReassignItemResult {
  kind: ReassignKind;
  id: number;
  ok: boolean;
  new_owner_id?: number;
  moved_lessons?: number | null;
  error?: { code: string; message: string } | null;
}

export interface ReassignResult {
  results: ReassignItemResult[];
  /** Recomputed after the moves. */
  blockers: Blockers;
}

export interface CreateOffboardingRequest {
  lms_user_id?: number | null;
  crm_user_id?: number | null;
  mode: OffboardingMode;
  last_day: string;
  reason_code: ReasonCode;
  note?: string | null;
}

export interface RecordList {
  items: OffboardingRecord[];
  total: number;
}

export interface DefaultHeads {
  head_teacher_id: number | null;
  head_teacher_name?: string | null;
  head_curator_id: number | null;
  head_curator_name?: string | null;
}

export interface OffboardingSettings {
  enabled: boolean;
  default_heads: Record<Programme, DefaultHeads>;
  notify_user_ids: number[];
  notify_users?: Person[];
  access_review_excluded_user_ids: number[];
  updated_at?: string | null;
  updated_by?: string | null;
}

/** PUT: every key optional, only the keys sent change. */
export interface OffboardingSettingsUpdate {
  default_heads?: Partial<Record<Programme, { head_teacher_id: number | null; head_curator_id: number | null }>>;
  notify_user_ids?: number[];
  access_review_excluded_user_ids?: number[];
}

export type TargetRef = { lms_user_id: number } | { crm_user_id: number };

export class OffboardingError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly details: Record<string, unknown>;
  /** Present on 409 offboarding_blocked: what they still own. */
  readonly blockers: Blockers | null;

  constructor(message: string, status: number | null, code: string | null, details: Record<string, unknown>) {
    super(message);
    this.name = 'OffboardingError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.blockers = details.blockers && typeof details.blockers === 'object' ? normaliseBlockers(details.blockers) : null;
  }
}

export function toOffboardingError(error: unknown): OffboardingError {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  const data = (response?.data ?? {}) as { detail?: unknown; reason_code?: unknown; reason_details?: unknown };
  const detail = typeof data.detail === 'string' ? data.detail : '';
  const code = typeof data.reason_code === 'string' ? data.reason_code : null;
  const details = data.reason_details && typeof data.reason_details === 'object' ? (data.reason_details as Record<string, unknown>) : {};
  return new OffboardingError(detail, response?.status ?? null, code, details);
}

async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await request()).data;
  } catch (error) {
    throw toOffboardingError(error);
  }
}

/** Blockers with every list present, whatever the server left out. */
export function normaliseBlockers(raw: unknown): Blockers {
  const b = (raw ?? {}) as Partial<Blockers>;
  return {
    groups: Array.isArray(b.groups) ? b.groups : [],
    lessons: Array.isArray(b.lessons) ? b.lessons : [],
    courses: Array.isArray(b.courses) ? b.courses : [],
    sat_native: Array.isArray(b.sat_native) ? b.sat_native : [],
    sat_checked: b.sat_checked !== false,
    sat_warning: b.sat_warning ?? null,
  };
}

const DISABLED: OffboardingConfig = { enabled: false, reasons: [], modes: [], programmes: [], can_emergency: false };

/**
 * The feature switch. Anything but a clear "enabled" — the endpoint missing (backend not
 * deployed), forbidden for this role, or down — reads as off, so no button shows by mistake.
 */
export async function getOffboardingConfig(): Promise<OffboardingConfig> {
  try {
    const data = (await api.get(`${BASE}/config`, { cache: { ttl: 5 * 60 * 1000 } } as never)).data as Partial<OffboardingConfig>;
    if (data?.enabled !== true) return DISABLED;
    const list = <T,>(value: T[] | undefined, fallback: readonly T[]) => (Array.isArray(value) && value.length ? value : [...fallback]);
    return {
      enabled: true,
      reasons: list(data.reasons, REASON_CODES),
      modes: list(data.modes, ['scheduled', 'immediate', 'emergency'] as const),
      programmes: list(data.programmes, PROGRAMMES),
      can_emergency: data.can_emergency === true,
    };
  } catch {
    return DISABLED;
  }
}

export async function previewOffboarding(target: TargetRef): Promise<OffboardPreview> {
  const data = await call<OffboardPreview>(() => api.get(`${BASE}/preview`, { params: target, cache: false } as never));
  return {
    ...data,
    blockers: normaliseBlockers(data.blockers),
    suggested_owners: Array.isArray(data.suggested_owners) ? data.suggested_owners : [],
    candidates: {
      teachers: data.candidates?.teachers ?? [],
      curators: data.candidates?.curators ?? [],
      head_teachers: data.candidates?.head_teachers ?? [],
    },
  };
}

export async function reassignOwned(request: ReassignRequest): Promise<ReassignResult> {
  const data = await call<ReassignResult>(() => api.post(`${BASE}/reassign`, request));
  return { results: Array.isArray(data.results) ? data.results : [], blockers: normaliseBlockers(data.blockers) };
}

export function createOffboarding(request: CreateOffboardingRequest): Promise<OffboardingRecord> {
  return call(() => api.post(`${BASE}`, request));
}

export function confirmOffboarding(id: number): Promise<OffboardingRecord> {
  return call(() => api.post(`${BASE}/${id}/confirm`));
}

export function cancelOffboarding(id: number): Promise<OffboardingRecord> {
  return call(() => api.post(`${BASE}/${id}/cancel`));
}

export function reactivateOffboarding(id: number): Promise<OffboardingRecord> {
  return call(() => api.post(`${BASE}/${id}/reactivate`));
}

/**
 * A status filter: statuses and the server's tokens `open` («Leaving soon»: awaiting_confirmation,
 * pending, blocked) and `needs_reassignment` (completed emergency switch-offs with open items).
 */
export type ListToken = OffboardingStatus | 'open' | 'needs_reassignment';

export interface ListQuery {
  /** Several combine with commas; none lists every record. */
  status?: readonly ListToken[];
  lms_user_id?: number;
  crm_user_id?: number;
  limit?: number;
  offset?: number;
}

/** Newest first. */
export async function listOffboardings({ status, ...rest }: ListQuery = {}): Promise<RecordList> {
  const params: Record<string, string | number> = Object.fromEntries(
    Object.entries(rest).filter((entry): entry is [string, number] => entry[1] != null),
  );
  if (status?.length) params.status = status.join(',');
  const data = await call<RecordList>(() => api.get(`${BASE}`, { params, cache: false } as never));
  return { items: Array.isArray(data.items) ? data.items : [], total: data.total ?? 0 };
}

export function getOffboarding(id: number): Promise<OffboardingRecord> {
  return call(() => api.get(`${BASE}/${id}`, NO_CACHE));
}

/** Re-run a failed or refused sat / support / crm step once its cause is fixed (admins). */
export function retryStep(id: number, step: StepName): Promise<OffboardingRecord> {
  return call(() => api.post(`${BASE}/${id}/steps/${step}/retry`));
}

export function setChecklistItem(id: number, itemId: string, done: boolean): Promise<OffboardingRecord> {
  return call(() => api.post(`${BASE}/${id}/checklist/${encodeURIComponent(itemId)}`, { done }));
}

export function getOffboardingSettings(): Promise<OffboardingSettings> {
  return call(() => api.get(`${BASE}/settings`, NO_CACHE));
}

export function saveOffboardingSettings(update: OffboardingSettingsUpdate): Promise<OffboardingSettings> {
  return call(() => api.put(`${BASE}/settings`, update));
}
