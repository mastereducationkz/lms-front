import { describe, expect, it } from 'vitest';
import {
  allToOptions,
  almatyToday,
  checklistText,
  createRequest,
  dialogStage,
  formProblems,
  handoverItems,
  initialAssignments,
  latestLastDay,
  mayOfferOffboard,
  mayUseEmergency,
  mergeAssignments,
  ownerOptions,
  reassignPlan,
  recordActions,
  targetRef,
  unresolvedItems,
  type OffboardForm,
} from './offboarding';
import type { Blockers, OffboardingRecord, OffboardPreview, OwnerCandidates } from '../services/api/offboarding';

const NO_BLOCKERS: Blockers = { groups: [], lessons: [], courses: [], sat_native: [], sat_checked: true };

const headT = { id: 55, name: 'Head T.', role: 'head_teacher' };
const dana = { id: 61, name: 'Dana S.', role: 'teacher' };
const meru = { id: 80, name: 'Meruyert', role: 'curator' };
const headC = { id: 81, name: 'Head C.', role: 'head_curator' };

const candidates: OwnerCandidates = {
  teachers: [headT, dana],
  curators: [meru, headC],
  head_teachers: [headT],
};

// The API.md §2 example preview.
const preview = {
  blockers: {
    ...NO_BLOCKERS,
    groups: [
      { id: 310, name: 'SAT Sep - Aida', role: 'teacher' as const, program_type: 'sat' as const, students: 12, future_lessons: 18 },
      { id: 311, name: 'SAT Oct - Aida', role: 'curator' as const },
    ],
    lessons: [{ id: 9911, title: 'IELTS Oct - Dana: Lesson 4', start_at: '2026-10-12T09:00:00Z', group_id: 402, group_name: 'IELTS Oct - Dana' }],
    courses: [{ id: 7, title: 'SAT Math' }],
  },
  suggested_owners: [
    { kind: 'group_teacher' as const, id: 310, owner: headT },
    { kind: 'lesson' as const, id: 9911, owner: dana },
    { kind: 'course_head' as const, id: 7, owner: null },
  ],
};

const record = (patch: Partial<OffboardingRecord>): OffboardingRecord => ({
  id: 7, lms_user_id: 123, crm_user_id: null, target: { name: 'Aida K.', role: 'teacher' },
  mode: 'scheduled', last_day: '2026-10-31', effective_at: '2026-10-31T18:59:59Z', reason_code: 'resigned',
  requested_by: { lms_user_id: 1, name: 'Owner', role: 'admin' }, status: 'pending', steps: {}, checklist: [],
  created_at: '2026-10-08T10:00:00Z', ...patch,
});

describe('the hand-over list', () => {
  const items = handoverItems(preview);

  it('lists groups, then lessons, then courses, each with the seat it frees', () => {
    expect(items.map((i) => i.key)).toEqual(['group_teacher:310', 'group_curator:311', 'lesson:9911', 'course_head:7']);
    expect(items[0].movingLessons).toBe(18);
    expect(items[2]).toMatchObject({ startAt: '2026-10-12T09:00:00Z', groupName: 'IELTS Oct - Dana' });
  });

  it('preselects the suggested owner and leaves the rest unchosen', () => {
    expect(initialAssignments(items)).toEqual({
      'group_teacher:310': 55, 'group_curator:311': null, 'lesson:9911': 61, 'course_head:7': null,
    });
  });

  it('keeps choices made by hand when a recheck brings the list back', () => {
    const edited = { ...initialAssignments(items), 'group_teacher:310': 61, 'group_curator:311': 80 };
    const after = handoverItems({ ...preview, blockers: { ...preview.blockers, courses: [] } });
    expect(mergeAssignments(edited, after)).toEqual({ 'group_teacher:310': 61, 'group_curator:311': 80, 'lesson:9911': 61 });
  });

  it('offers each item only people who may take it, plus a suggestion outside the pool', () => {
    expect(ownerOptions(items[1], candidates).map((p) => p.id)).toEqual([80, 81]);
    expect(ownerOptions(items[3], candidates).map((p) => p.id)).toEqual([55]);
    const outsider = { ...items[0], suggested: { id: 99, name: 'New head' } };
    expect(ownerOptions(outsider, candidates).map((p) => p.id)).toEqual([99, 55, 61]);
  });

  it('offers «hand everything to» only people who fit every kind listed', () => {
    expect(allToOptions(items, candidates)).toEqual([]); // nobody is both a teacher and a curator
    const teacherOnly = items.filter((i) => i.kind !== 'group_curator');
    expect(allToOptions(teacherOnly, candidates).map((p) => p.id)).toEqual([55]); // the course needs a head teacher
    expect(allToOptions(items.filter((i) => i.kind === 'group_curator'), candidates).map((p) => p.id)).toEqual([80, 81]);
  });

  it('sends the chosen items and reports the unchosen ones', () => {
    const plan = reassignPlan(items, initialAssignments(items));
    expect(plan.items).toEqual([
      { kind: 'group_teacher', id: 310, new_owner_id: 55 },
      { kind: 'lesson', id: 9911, new_owner_id: 61 },
    ]);
    expect(plan.missing.map((i) => i.key)).toEqual(['group_curator:311', 'course_head:7']);
  });
});

describe('dialog stage', () => {
  const base: Pick<OffboardPreview, 'open_record' | 'can_offboard' | 'blockers'> = { open_record: null, can_offboard: true, blockers: NO_BLOCKERS };

  it('goes straight to the details when nothing is owned', () => {
    expect(dialogStage(base)).toBe('details');
  });

  it('asks for a hand-over while anything is owned, SAT groups included', () => {
    expect(dialogStage({ ...base, blockers: preview.blockers })).toBe('handover');
    expect(dialogStage({ ...base, blockers: { ...NO_BLOCKERS, sat_native: [{ id: 4, name: 'September 7' }] } })).toBe('handover');
  });

  it('treats an unanswered SAT as a warning, not a block', () => {
    expect(dialogStage({ ...base, blockers: { ...NO_BLOCKERS, sat_checked: false } })).toBe('details');
  });

  it('shows an open record before anything else, and a closed one not at all', () => {
    expect(dialogStage({ ...base, can_offboard: false, open_record: record({ status: 'pending' }) })).toBe('open_record');
    expect(dialogStage({ ...base, open_record: record({ status: 'completed' }) })).toBe('details');
    expect(dialogStage({ ...base, can_offboard: false })).toBe('not_allowed');
  });
});

describe('the details form', () => {
  const today = '2026-10-08';
  const form = (patch: Partial<OffboardForm>): OffboardForm => ({ mode: 'scheduled', lastDay: '2026-10-31', reason: 'resigned', note: '', ...patch });

  it('needs a last day from today to a year ahead, and a reason', () => {
    expect(formProblems(form({}), today)).toEqual([]);
    expect(formProblems(form({ lastDay: today }), today)).toEqual([]);
    expect(formProblems(form({ lastDay: '' }), today)).toEqual(['last_day_missing']);
    expect(formProblems(form({ lastDay: '2026-10-07' }), today)).toEqual(['last_day_past']);
    expect(formProblems(form({ lastDay: '2027-10-10' }), today)).toEqual(['last_day_too_far']);
    expect(formProblems(form({ reason: '' }), today)).toEqual(['reason_missing']);
  });

  it('needs no date for «immediately»', () => {
    expect(formProblems(form({ mode: 'immediate', lastDay: '' }), today)).toEqual([]);
  });

  it('allows up to today + 366 days, across a leap day', () => {
    expect(latestLastDay('2026-10-08')).toBe('2027-10-09');
    expect(latestLastDay('2027-03-01')).toBe('2028-03-01');
  });

  it('sends today as the last day of an immediate offboarding, and no empty note', () => {
    expect(createRequest({ lms_user_id: 123 }, form({ mode: 'immediate', lastDay: '2026-12-01', note: '  ' }), today)).toEqual({
      lms_user_id: 123, mode: 'immediate', last_day: today, reason_code: 'resigned', note: null,
    });
    expect(createRequest({ crm_user_id: 45 }, form({ note: ' moved to Astana ' }), today)).toMatchObject({
      crm_user_id: 45, last_day: '2026-10-31', note: 'moved to Astana',
    });
  });

  it('reads today on Almaty’s calendar, not the browser’s', () => {
    expect(almatyToday(new Date('2026-10-08T18:59:59Z'))).toBe('2026-10-08');
    expect(almatyToday(new Date('2026-10-08T19:00:00Z'))).toBe('2026-10-09'); // midnight in Almaty (UTC+5)
  });

  it('looks a person up by LMS id first, CRM id for CRM-only staff', () => {
    expect(targetRef({ lms_user_id: 123, crm_user_id: 45 })).toEqual({ lms_user_id: 123 });
    expect(targetRef({ lms_user_id: null, crm_user_id: 45 })).toEqual({ crm_user_id: 45 });
    expect(targetRef({ lms_user_id: null, crm_user_id: null })).toBeNull();
  });
});

describe('record actions', () => {
  it('follows the server’s `allowed` when it sends one', () => {
    const allowed = { cancel: false, confirm: true, reactivate: false, tick_checklist: false };
    expect(recordActions(record({ status: 'awaiting_confirmation', allowed }), 1)).toEqual(allowed);
  });

  it('otherwise: the requester cannot be the second admin', () => {
    const waiting = record({ status: 'awaiting_confirmation' });
    expect(recordActions(waiting, 1)).toMatchObject({ cancel: true, confirm: false });
    expect(recordActions(waiting, 2)).toMatchObject({ cancel: true, confirm: true });
    expect(recordActions(record({ status: 'completed' }), 2)).toMatchObject({ cancel: false, confirm: false, reactivate: true });
  });
});

describe('who sees «Offboard»', () => {
  const admin = { id: '1', role: 'admin' };
  it('admins on any staff member but themselves; heads on their own role; never on students', () => {
    expect(mayOfferOffboard(admin, { id: 2, role: 'head_teacher' })).toBe(true);
    expect(mayOfferOffboard(admin, { id: 1, role: 'admin' })).toBe(false);
    expect(mayOfferOffboard(admin, { id: 3, role: 'student' })).toBe(false);
    expect(mayOfferOffboard({ id: 5, role: 'head_curator' }, { id: 6, role: 'curator' })).toBe(true);
    expect(mayOfferOffboard({ id: 5, role: 'head_curator' }, { id: 6, role: 'teacher' })).toBe(false);
    expect(mayOfferOffboard({ id: 7, role: 'head_teacher' }, { id: 8, role: 'teacher' })).toBe(true);
    expect(mayOfferOffboard({ id: 7, role: 'head_teacher' }, { id: 9, role: 'curator' })).toBe(false);
    expect(mayOfferOffboard({ id: 10, role: 'teacher' }, { id: 8, role: 'teacher' })).toBe(false);
    expect(mayOfferOffboard(null, { id: 8, role: 'teacher' })).toBe(false);
  });
});

describe('checklist lines', () => {
  const catalog: Record<string, string> = {
    'offboarding.checklist.workspace': 'Приостановить аккаунт {email}',
    'offboarding.checklist.telegram_chat': 'Удалить из чата «{chat_title}»',
  };
  const translate = (key: string, params: Record<string, string | number>) =>
    key in catalog ? catalog[key].replace(/\{(\w+)\}/g, (w, n: string) => (n in params ? String(params[n]) : w)) : null;

  it('phrases a known kind from its params', () => {
    expect(checklistText({ kind: 'workspace', text: 'Suspend aida@x', params: { email: 'aida@x' } }, translate)).toBe('Приостановить аккаунт aida@x');
  });

  it('falls back to the server’s text for a new kind or a missing blank', () => {
    expect(checklistText({ kind: 'github', text: 'Remove from GitHub', params: {} }, translate)).toBe('Remove from GitHub');
    expect(checklistText({ kind: 'telegram_chat', text: 'Remove them from «SAT Sep»', params: { group_id: 310 } }, translate)).toBe('Remove them from «SAT Sep»');
  });
});

describe('emergency switch-off (SPEC §12 Q93)', () => {
  it('is for admins only, and only when the server lists the mode', () => {
    expect(mayUseEmergency('admin', ['scheduled', 'immediate', 'emergency'])).toBe(true);
    expect(mayUseEmergency('admin', ['scheduled', 'immediate'])).toBe(false);
    expect(mayUseEmergency('head_curator', ['scheduled', 'immediate', 'emergency'])).toBe(false);
  });

  it('needs no date and sends today', () => {
    const form: OffboardForm = { mode: 'emergency', lastDay: '', reason: 'dismissed', note: '' };
    expect(formProblems(form, '2026-10-08')).toEqual([]);
    expect(createRequest({ lms_user_id: 9 }, form, '2026-10-08')).toMatchObject({ mode: 'emergency', last_day: '2026-10-08' });
  });

  it('lists what nobody has taken over yet', () => {
    const items = [
      { kind: 'group_teacher' as const, id: 310, label: 'SAT Sep', resolved: true },
      { kind: 'lesson' as const, id: 9911, label: 'Lesson 4' },
    ];
    expect(unresolvedItems(record({ status: 'completed', open_items: items })).map((i) => i.id)).toEqual([9911]);
    expect(unresolvedItems(record({ status: 'completed' }))).toEqual([]);
  });
});
