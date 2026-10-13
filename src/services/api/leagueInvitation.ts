/**
 * Master League invitation (owner, 2026-10-13): the student's own invitation and their answer.
 * GET /master-league/invitation is the open invitation, else the last one so the page can say what
 * happened, else null; POST /master-league/invitation/answer records «I'm in» (with the squad) or
 * «Not this time». Shapes follow lms-backend src/master_league/invitations.py.
 *
 * A failed read is an error, never «no invitation»: the page must not tell a student there is nothing
 * for them just because a request dropped.
 */
import { api } from './client';

export type InvitationState = 'open' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
export type MemberStatus = 'enrolled' | 'dropped' | 'completed';

export interface InvitationOption {
  group_id: number;
  /** The group's name, «Master League Dreamville». */
  label: string;
  /** The CRM writes it in Russian: «Пн, Ср 18:00; Сб 11:00». */
  schedule_text: string;
  /** The CRM no longer sends a capacity (groups have no limit): null. Tolerated if a number ever appears, never shown. */
  seats_left: number | null;
}

export interface LeagueInvitation {
  id: number;
  state: InvitationState;
  cohort_name: string;
  /** YYYY-MM-DD, the day of the SAT. */
  exam_date: string;
  /** Naive UTC + «Z». */
  expires_at: string;
  responded_at: string | null;
  /** The server's clock when it answered, so a wrong clock on the device cannot move the deadline. */
  server_now: string | null;
  options: InvitationOption[];
  chosen_group_id: number | null;
  /** Once the CRM has enrolled an accepting student; null until then. */
  member_status: MemberStatus | null;
}

const STATES: readonly InvitationState[] = ['open', 'accepted', 'declined', 'expired', 'withdrawn'];
const MEMBER: readonly MemberStatus[] = ['enrolled', 'dropped', 'completed'];

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** The one place a raw answer becomes a LeagueInvitation; null for anything that is not one. */
export function asInvitation(data: unknown): LeagueInvitation | null {
  const d = (data ?? {}) as Record<string, any>;
  if (!STATES.includes(d.state) || typeof d.id !== 'number') return null;
  const expires = str(d.expires_at);
  const exam = str(d.exam_date);
  if (!expires || !Number.isFinite(Date.parse(expires)) || !exam) return null;
  const options: InvitationOption[] = Array.isArray(d.options)
    ? d.options
        .filter((o: any) => o && typeof o.group_id === 'number')
        .map((o: any) => ({
          group_id: o.group_id,
          label: typeof o.label === 'string' ? o.label : '',
          schedule_text: typeof o.schedule_text === 'string' ? o.schedule_text : '',
          seats_left: typeof o.seats_left === 'number' && Number.isFinite(o.seats_left) ? o.seats_left : null,
        }))
    : [];
  return {
    id: d.id,
    state: d.state,
    cohort_name: typeof d.cohort_name === 'string' ? d.cohort_name : '',
    exam_date: exam,
    expires_at: expires,
    responded_at: str(d.responded_at),
    server_now: str(d.server_now),
    options,
    chosen_group_id: typeof d.chosen_group_id === 'number' ? d.chosen_group_id : null,
    member_status: MEMBER.includes(d.member_status) ? d.member_status : null,
  };
}

/** The student's invitation, or null when there is none. Rejects when the answer is not understood. */
export async function getMyInvitation(): Promise<LeagueInvitation | null> {
  const response = await api.get('/master-league/invitation', { cache: false } as never);
  const data = response?.data;
  if (data === null) return null;
  const invitation = asInvitation(data);
  if (!invitation) throw new Error('Unexpected invitation answer');
  return invitation;
}

/** Why an answer was not saved: the invitation moved on (try the page again) or the request failed (try the button again). */
export class InvitationAnswerError extends Error {
  constructor(readonly kind: 'changed' | 'retry', readonly status: number | null) {
    super(kind === 'changed' ? 'The invitation changed' : 'The answer was not saved');
  }
}

/** Send the answer; resolves with the invitation as it stands afterwards. */
export async function answerInvitation(accept: boolean, groupId: number | null): Promise<LeagueInvitation> {
  try {
    const response = await api.post('/master-league/invitation/answer', { accept, group_id: accept ? groupId : null });
    const invitation = asInvitation(response?.data);
    if (!invitation) throw new InvitationAnswerError('retry', null);
    return invitation;
  } catch (error) {
    if (error instanceof InvitationAnswerError) throw error;
    const status = (error as { response?: { status?: number } })?.response?.status ?? null;
    // 400/409: the server looked and refused (closed, withdrawn, a different answer already given).
    throw new InvitationAnswerError(status === 400 || status === 409 ? 'changed' : 'retry', status);
  }
}
