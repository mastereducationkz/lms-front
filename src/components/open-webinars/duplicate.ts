import type { OpenAccess } from '../../services/api/openWebinars';
import type { Event } from '../../types';
import { parseAsUTC } from '../../lib/datetime';
import { isOpenRole, type AccessDraft } from './accessModel';

/**
 * «Duplicate» of an open webinar (owner, 2026-11-04): the create form opens prefilled from a source webinar and
 * nothing is saved until Create. What repeats from one webinar to the next is copied; what is per webinar
 * (date and time, title, English texts, banner, guest speaker, address, a pasted meeting link) is left empty.
 */

/** The query parameter the create form reads the source webinar from. */
export const DUPLICATE_PARAM = 'duplicate';

/**
 * Where «Duplicate» goes: the create form of the role's own route, with the source in the URL. A head curator
 * creates from the curator route (the admin one is for admins and head teachers); null for a role that cannot.
 */
export function duplicateHref(role: string | null | undefined, eventId: number): string | null {
  if (!isOpenRole(role)) return null;
  const base = role === 'head_curator' ? '/curator/events/create' : '/admin/events/create';
  return `${base}?${DUPLICATE_PARAM}=${eventId}`;
}

/** The source id in the create form's URL, or null when there is none (or it is not a number). */
export function duplicateIdOf(search: URLSearchParams): number | null {
  const raw = search.get(DUPLICATE_PARAM);
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** The event fields the create form starts from; the ones left out start empty. */
export type DuplicateSeed = Pick<Event, 'event_type' | 'is_online'> &
  Partial<Pick<Event, 'description' | 'teacher_id' | 'course_ids' | 'group_ids' | 'max_participants'>>;

export interface DuplicateDraft {
  /** The source's title, named in the note on the form. */
  sourceTitle: string;
  seed: DuplicateSeed;
  /** The source's length; the end follows the start the user picks. null when the source's times are unusable. */
  durationMinutes: number | null;
  access: AccessDraft;
}

/** The create form's starting point from a source webinar and its public access settings. */
export function duplicateDraftOf(event: Event, access: OpenAccess): DuplicateDraft {
  const courses = event.course_ids ?? [];
  const groups = event.group_ids ?? [];
  const minutes = Math.round((parseAsUTC(event.end_datetime).getTime() - parseAsUTC(event.start_datetime).getTime()) / 60000);
  return {
    sourceTitle: event.title,
    seed: {
      event_type: 'webinar',
      is_online: event.is_online ?? true,
      description: event.description ?? '',
      teacher_id: event.teacher_id ?? undefined,
      course_ids: [...courses],
      group_ids: [...groups],
      max_participants: event.max_participants ?? undefined,
    },
    durationMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
    access: {
      mode: access.access_mode,
      pipelineId: access.lead_pipeline_id,
      presenter: access.presenter ?? null,
      askProfile: access.ask_profile ?? false,
      // A webinar with neither a course nor a group was only a public page; so is its copy.
      noAudience: courses.length === 0 && groups.length === 0,
      // Per webinar: a new address is made from the new title, the banner and the guest speaker are chosen again.
      slug: '',
      speakerId: null,
      bannerUrl: null,
      titleEn: '',
      descriptionEn: '',
    },
  };
}

/** A `datetime-local` value moved by `minutes` (Almaty has no daylight saving, so plain arithmetic is exact). */
export function shiftLocal(local: string, minutes: number): string {
  const [date, time] = local.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time ?? '').split(':').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d, h, min || 0) + minutes * 60000);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}T${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
}

/**
 * The end after the start changed to `nextStart`: start + the source's length while the end is empty or still the one
 * it filled in itself; an end the user typed is kept.
 */
export function endAfterStart(prev: { start: string; end: string }, nextStart: string, minutes: number | null): string {
  if (!minutes || !nextStart) return prev.end;
  const filledByUs = !prev.end || (!!prev.start && prev.end === shiftLocal(prev.start, minutes));
  return filledByUs ? shiftLocal(nextStart, minutes) || prev.end : prev.end;
}
