import type { AccessBody, AccessMode, OpenAccess, PreflightBody } from '../../services/api/openWebinars';
import { fromDatetimeLocalKZ } from '../../lib/datetime';

/**
 * Who may open a webinar to everyone: it reaches into the CRM (every registration is a lead) and into the
 * Meet room, so it is a head's call, not every host's. A host teacher or curator only reads the result.
 */
export const OPEN_ROLES = ['admin', 'head_teacher', 'head_curator'] as const;
export const isOpenRole = (role?: string | null): boolean => !!role && (OPEN_ROLES as readonly string[]).includes(role);

/** What the «Who can join» fields hold. Never has a pipeline preselected: someone must choose where the leads go. */
export interface AccessDraft {
  mode: AccessMode;
  pipelineId: number | null;
  /** The typed address; empty lets the server make one from the title. */
  slug: string;
  speakerId: number | null;
  /** A stable relative path (`/uploads/webinar_banners/…`) or null. */
  bannerUrl: string | null;
  /** Create form only: the webinar has no group or course, just the public page. */
  noAudience: boolean;
}

export const emptyDraft = (): AccessDraft => ({ mode: 'students', pipelineId: null, slug: '', speakerId: null, bannerUrl: null, noAudience: false });

export const draftOf = (access: OpenAccess): AccessDraft => ({
  mode: access.access_mode,
  pipelineId: access.lead_pipeline_id,
  slug: access.slug ?? '',
  speakerId: access.speaker_id,
  bannerUrl: access.banner_url ?? null,
  noAudience: false,
});

/** Public access is on for this draft (it is not «students only»). */
export const isPublicMode = (draft: AccessDraft): draft is AccessDraft & { mode: 'open' | 'registration' } => draft.mode !== 'students';

/** The body of `PUT /{event_id}`. `lockedSlug`: the address can no longer change, so it is not sent. */
export function accessBody(draft: AccessDraft & { mode: 'open' | 'registration'; pipelineId: number }, lockedSlug = false): AccessBody {
  return {
    access_mode: draft.mode,
    ...(lockedSlug ? {} : { slug: draft.slug.trim() || null }),
    speaker_id: draft.speakerId,
    lead_pipeline_id: draft.pipelineId,
    banner_url: draft.bannerUrl,
  };
}

/** The event's own fields the server's guard reads (host, Meet link, dates, series), as the create form holds them. */
export interface EventFacts {
  title: string;
  teacherId?: number;
  meetingUrl: string;
  /** `datetime-local` values (Almaty time), as typed; empty while not filled in. */
  startLocal: string;
  endLocal: string;
  isRecurring: boolean;
}

const utc = (local: string): string | null => {
  try {
    const iso = fromDatetimeLocalKZ(local);
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  } catch {
    return null;
  }
};

/**
 * What the server's check needs, or null while it cannot be asked yet: a series is refused up front, and a
 * check without a pipeline, a title or a valid time span would only repeat what the form already says.
 */
export function preflightBodyOf(draft: AccessDraft, facts: EventFacts): PreflightBody | null {
  if (!isPublicMode(draft) || draft.pipelineId === null || facts.isRecurring || !facts.title.trim()) return null;
  const start = facts.startLocal ? utc(facts.startLocal) : null;
  const end = facts.endLocal ? utc(facts.endLocal) : null;
  if (!start || !end || Date.parse(start) >= Date.parse(end)) return null;
  return {
    access_mode: draft.mode,
    lead_pipeline_id: draft.pipelineId,
    title: facts.title.trim(),
    teacher_id: facts.teacherId ?? null,
    meeting_url: facts.meetingUrl.trim() || null,
    start_datetime: start,
    end_datetime: end,
    is_recurring: false,
    slug: draft.slug.trim() || null,
    speaker_id: draft.speakerId,
  };
}

/** The sentence under «Students only» when public access can no longer be closed, or null when it can. */
export function closeBlock(access: OpenAccess): 'started' | 'has_registrations' | 'other' | null {
  if (!access.open || access.can_close !== false) return null;
  return access.close_blocked_reason ?? 'other';
}
