/**
 * The profile's "your groups" rows: each group with its teacher and its curator.
 *
 * Staff rows (/admin/groups for a teacher, /leaderboard/curator/groups for a curator) already
 * carry teacher_name and curator_name. A student's /users/groups/me carries only the ids, so the
 * names (and avatars) come from the people that student can message (/messages/available-contacts),
 * which lists their teachers and curators. A person missing there shows as "not assigned yet"
 * rather than a bare id.
 */
import type { Group } from '@/types';

export interface ProfilePerson {
  id: number;
  name: string;
  avatarUrl?: string | null;
  mascot?: string | null;
}

export interface ProfileGroup {
  id: number;
  name: string;
  program: string | null;
  teacher: ProfilePerson | null;
  curator: ProfilePerson | null;
}

export interface ChatContact {
  user_id: number;
  name: string;
  role: string;
  avatar_url?: string | null;
  mascot?: string | null;
}

/** Groups that still run: a finished or archived group is history, not "your group". */
const current = (g: Group) => g.is_active !== false && !g.is_over;

export function groupsFromStaffRows(rows: Group[]): ProfileGroup[] {
  return rows.filter(current).map((g) => ({
    id: g.id,
    name: g.name,
    program: g.program_type ?? null,
    teacher: g.teacher_id && g.teacher_name ? { id: g.teacher_id, name: g.teacher_name } : null,
    curator: g.curator_id && g.curator_name ? { id: g.curator_id, name: g.curator_name } : null,
  }));
}

export function groupsWithContacts(rows: Group[], contacts: ChatContact[]): ProfileGroup[] {
  const byId = new Map(contacts.map((c) => [c.user_id, c]));
  const person = (id: number | null | undefined): ProfilePerson | null => {
    const c = id ? byId.get(id) : undefined;
    return c ? { id: c.user_id, name: c.name, avatarUrl: c.avatar_url ?? null, mascot: c.mascot ?? null } : null;
  };
  return rows.filter(current).map((g) => ({
    id: g.id,
    name: g.name,
    program: g.program_type ?? null,
    teacher: person(g.teacher_id),
    curator: person(g.curator_id),
  }));
}

const PROGRAM_LABELS: Record<string, string> = { sat: 'SAT', ielts: 'IELTS', nuet: 'NUET', general_english: 'English' };

/** "SAT", "IELTS", "NUET", "English"; nothing for a programme we don't name. */
export function programChip(program: string | null | undefined): string | null {
  return program ? PROGRAM_LABELS[program] ?? null : null;
}
