/**
 * The colours a Master League screen wears (owner, 2026-11-02). Football is the one navy-and-gold
 * look of season 1, written here class for class as it always was. Studio (season 2) takes its
 * group's palette by the tail of the group's name:
 *   Off-Season — warm grey and burnt orange, an empty court at dawn;
 *   Section.80 — deep purple and gold, a cassette and its tracklist;
 *   any other studio group — charcoal and gold.
 * Every surface is dark in both app themes, so light text on it keeps AA contrast either way.
 * Class strings are whole literals so Tailwind sees them.
 */
import type { LessonState } from '@/services/api/masterLeague';
import { groupTail } from '@/lib/leagueSeason';
import { studioGroupLook, type LeagueTheme, type StudioGroupLook } from '@/lib/leagueTheme';

export type LeagueLookId = 'football' | StudioGroupLook;

export interface LeagueLook {
  id: LeagueLookId;
  theme: LeagueTheme;
  /** The season banner's surface: border, gradient, text, shadow. */
  banner: string;
  /** The deep gradient of the welcome scene, the invitation hero, its scenes and the golden header. */
  scene: string;
  /** The invitation's outer shadow and ring. */
  sceneEdge: string;
  /** The dashboard invitation card's surface. */
  card: string;
  /** One squad's card on the invitation. */
  slot: string;
  /** The teaser's surface. */
  teaser: string;
  /** The achievements page band. */
  band: string;
  /** A soft glow in a corner. */
  glow: string;
  accent: string;
  accentSoft: string;
  muted: string;
  faint: string;
  /** The muted colour a step quieter (a goal's count, the producer's note). */
  mutedSoft: string;
  coachText: string;
  /** A done goal chip. */
  done: string;
  /** A filled control or a done chip, with its text. */
  solid: string;
  solidHover: string;
  focus: string;
  /** A small dark chip on a light surface (the welcome's «also unlocked»), with its text. */
  chip: string;
  /** The emblem's label colour (studio) — football keeps its crest. */
  label: string;
  /** Pips: shape and one class per lesson state, then the end pip (the Final / Release Day). */
  pipShape: string;
  pip: Record<LessonState, string>;
  pipEnd: { done: string; today: string; ahead: string };
  confetti: string[];
}

export const FOOTBALL_LOOK: LeagueLook = {
  id: 'football',
  theme: 'football',
  banner: 'border-amber-300/30 bg-[linear-gradient(135deg,#07122E_0%,#0B1B4D_38%,#14307A_78%,#1E4DB8_100%)] text-white shadow-[0_18px_40px_-22px_rgba(11,27,77,0.9)]',
  scene: 'bg-[linear-gradient(160deg,#07122E_0%,#0B1B4D_45%,#14307A_100%)]',
  sceneEdge: 'shadow-[0_24px_48px_-28px_rgba(11,27,77,0.95)] ring-1 ring-amber-300/25',
  card: 'border-amber-300/40 bg-[linear-gradient(135deg,#07122E_0%,#0B1B4D_45%,#14307A_100%)] text-white shadow-[0_18px_40px_-22px_rgba(11,27,77,0.9)]',
  slot: 'bg-[linear-gradient(145deg,#0B1B4D_0%,#14307A_100%)] p-5 text-white shadow-[0_18px_36px_-24px_rgba(11,27,77,0.95)] ring-1 ring-amber-300/30',
  teaser: 'bg-[linear-gradient(160deg,#07122E_0%,#0B1B4D_100%)]',
  band: 'border-amber-300/30 bg-[linear-gradient(135deg,#07122E_0%,#0B1B4D_45%,#14307A_100%)] p-4 shadow-[0_18px_40px_-26px_rgba(11,27,77,0.9)]',
  glow: 'bg-amber-300/15',
  accent: 'text-amber-300',
  accentSoft: 'text-amber-200',
  muted: 'text-blue-100',
  faint: 'text-blue-50',
  mutedSoft: 'text-blue-100/80',
  coachText: 'text-blue-100/90',
  done: 'bg-amber-300 font-semibold text-blue-950',
  solid: 'bg-amber-300 text-blue-950',
  solidHover: 'hover:bg-amber-200',
  focus: 'focus-visible:outline-amber-300',
  chip: 'bg-blue-950 text-amber-300',
  label: '#F7C948',
  pipShape: 'rounded-full',
  pip: {
    attended: 'bg-amber-300 text-blue-950 shadow-[0_0_10px_rgba(252,211,77,0.55)]',
    missed: 'border-2 border-white/35 text-white/60',
    unmarked: 'border-2 border-dashed border-amber-200/80 text-amber-100',
    today: 'border-2 border-amber-300 bg-amber-300/20 text-amber-200 animate-pulse motion-reduce:animate-none',
    upcoming: 'border border-white/30 bg-white/5 text-white/80',
  },
  pipEnd: {
    done: 'bg-amber-300 text-blue-950 shadow-[0_0_12px_rgba(252,211,77,0.7)]',
    today: 'border-2 border-amber-300 bg-amber-300/20 text-amber-200 animate-pulse motion-reduce:animate-none',
    ahead: 'border border-amber-200/60 text-amber-200',
  },
  confetti: ['#F7C948', '#FFE07A', '#2563EB', '#5B8DFF', '#FFFFFF'],
};

/** Off-Season: dawn training — warm grey, burnt orange, the first light on an empty court. */
const OFF_SEASON: LeagueLook = {
  id: 'offSeason',
  theme: 'studio',
  banner: 'border-[#F08A4B]/35 bg-[linear-gradient(135deg,#1A1512_0%,#2A231E_40%,#45322A_78%,#7A4126_100%)] text-white shadow-[0_18px_40px_-22px_rgba(42,30,22,0.9)]',
  scene: 'bg-[linear-gradient(160deg,#1A1512_0%,#2A231E_45%,#5A3826_100%)]',
  sceneEdge: 'shadow-[0_24px_48px_-28px_rgba(42,30,22,0.95)] ring-1 ring-[#F08A4B]/30',
  card: 'border-[#F08A4B]/40 bg-[linear-gradient(135deg,#1A1512_0%,#2A231E_45%,#5A3826_100%)] text-white shadow-[0_18px_40px_-22px_rgba(42,30,22,0.9)]',
  slot: 'bg-[linear-gradient(145deg,#2A231E_0%,#5A3826_100%)] p-5 text-white shadow-[0_18px_36px_-24px_rgba(42,30,22,0.95)] ring-1 ring-[#F08A4B]/35',
  teaser: 'bg-[linear-gradient(160deg,#1A1512_0%,#2A231E_100%)]',
  band: 'border-[#F08A4B]/35 bg-[linear-gradient(135deg,#1A1512_0%,#2A231E_45%,#5A3826_100%)] p-4 shadow-[0_18px_40px_-26px_rgba(42,30,22,0.9)]',
  glow: 'bg-[#F08A4B]/20',
  accent: 'text-[#F7A56B]',
  accentSoft: 'text-[#FBC9A2]',
  muted: 'text-[#EADFD4]',
  faint: 'text-[#F6EFE8]',
  mutedSoft: 'text-[#EADFD4]/80',
  coachText: 'text-[#EADFD4]/90',
  done: 'bg-[#F7A56B] font-semibold text-[#1F130B]',
  solid: 'bg-[#F7A56B] text-[#1F130B]',
  solidHover: 'hover:bg-[#FBC9A2]',
  focus: 'focus-visible:outline-[#F7A56B]',
  chip: 'bg-[#2A231E] text-[#F7A56B]',
  label: '#F08A4B',
  pipShape: 'rounded-[6px]',
  pip: {
    attended: 'bg-[#F7A56B] text-[#1F130B] shadow-[0_0_10px_rgba(240,138,75,0.55)]',
    missed: 'border-2 border-white/35 text-white/60',
    unmarked: 'border-2 border-dashed border-[#FBC9A2]/80 text-[#FBC9A2]',
    today: 'border-2 border-[#F7A56B] bg-[#F7A56B]/20 text-[#FBC9A2] animate-pulse motion-reduce:animate-none',
    upcoming: 'border border-white/30 bg-white/5 text-white/80',
  },
  pipEnd: {
    done: 'bg-[#F7A56B] text-[#1F130B] shadow-[0_0_12px_rgba(240,138,75,0.7)]',
    today: 'border-2 border-[#F7A56B] bg-[#F7A56B]/20 text-[#FBC9A2] animate-pulse motion-reduce:animate-none',
    ahead: 'border border-[#FBC9A2]/60 text-[#FBC9A2]',
  },
  confetti: ['#F08A4B', '#F7A56B', '#FBC9A2', '#E8C268', '#FFFFFF'],
};

/** Section.80: an 80s cassette — deep purple, gold, a tracklist on the label. */
const SECTION_80: LeagueLook = {
  id: 'section80',
  theme: 'studio',
  banner: 'border-[#F5C451]/30 bg-[linear-gradient(135deg,#120922_0%,#1F0F3D_38%,#34185F_78%,#4B2486_100%)] text-white shadow-[0_18px_40px_-22px_rgba(31,15,61,0.9)]',
  scene: 'bg-[linear-gradient(160deg,#120922_0%,#1F0F3D_45%,#3B1B6B_100%)]',
  sceneEdge: 'shadow-[0_24px_48px_-28px_rgba(31,15,61,0.95)] ring-1 ring-[#F5C451]/25',
  card: 'border-[#F5C451]/40 bg-[linear-gradient(135deg,#120922_0%,#1F0F3D_45%,#3B1B6B_100%)] text-white shadow-[0_18px_40px_-22px_rgba(31,15,61,0.9)]',
  slot: 'bg-[linear-gradient(145deg,#1F0F3D_0%,#3B1B6B_100%)] p-5 text-white shadow-[0_18px_36px_-24px_rgba(31,15,61,0.95)] ring-1 ring-[#F5C451]/30',
  teaser: 'bg-[linear-gradient(160deg,#120922_0%,#1F0F3D_100%)]',
  band: 'border-[#F5C451]/30 bg-[linear-gradient(135deg,#120922_0%,#1F0F3D_45%,#3B1B6B_100%)] p-4 shadow-[0_18px_40px_-26px_rgba(31,15,61,0.9)]',
  glow: 'bg-[#F5C451]/15',
  accent: 'text-[#F5C451]',
  accentSoft: 'text-[#F9DC8E]',
  muted: 'text-[#E5D9F7]',
  faint: 'text-[#F3EDFB]',
  mutedSoft: 'text-[#E5D9F7]/80',
  coachText: 'text-[#E5D9F7]/90',
  done: 'bg-[#F5C451] font-semibold text-[#1F0F3D]',
  solid: 'bg-[#F5C451] text-[#1F0F3D]',
  solidHover: 'hover:bg-[#F9DC8E]',
  focus: 'focus-visible:outline-[#F5C451]',
  chip: 'bg-[#1F0F3D] text-[#F5C451]',
  label: '#F5C451',
  pipShape: 'rounded-[6px]',
  pip: {
    attended: 'bg-[#F5C451] text-[#1F0F3D] shadow-[0_0_10px_rgba(245,196,81,0.55)]',
    missed: 'border-2 border-white/35 text-white/60',
    unmarked: 'border-2 border-dashed border-[#F9DC8E]/80 text-[#F9DC8E]',
    today: 'border-2 border-[#F5C451] bg-[#F5C451]/20 text-[#F9DC8E] animate-pulse motion-reduce:animate-none',
    upcoming: 'border border-white/30 bg-white/5 text-white/80',
  },
  pipEnd: {
    done: 'bg-[#F5C451] text-[#1F0F3D] shadow-[0_0_12px_rgba(245,196,81,0.7)]',
    today: 'border-2 border-[#F5C451] bg-[#F5C451]/20 text-[#F9DC8E] animate-pulse motion-reduce:animate-none',
    ahead: 'border border-[#F9DC8E]/60 text-[#F9DC8E]',
  },
  confetti: ['#F5C451', '#F9DC8E', '#8C5BD8', '#C9A8F5', '#FFFFFF'],
};

/** Any other studio group: charcoal and gold, a record on the wall. */
const STUDIO_LOOK: LeagueLook = {
  id: 'studio',
  theme: 'studio',
  banner: 'border-[#E8C268]/30 bg-[linear-gradient(135deg,#0F1012_0%,#1A1B1F_40%,#26272D_78%,#3A3B42_100%)] text-white shadow-[0_18px_40px_-22px_rgba(0,0,0,0.85)]',
  scene: 'bg-[linear-gradient(160deg,#0F1012_0%,#1A1B1F_45%,#2E2F36_100%)]',
  sceneEdge: 'shadow-[0_24px_48px_-28px_rgba(0,0,0,0.9)] ring-1 ring-[#E8C268]/25',
  card: 'border-[#E8C268]/40 bg-[linear-gradient(135deg,#0F1012_0%,#1A1B1F_45%,#2E2F36_100%)] text-white shadow-[0_18px_40px_-22px_rgba(0,0,0,0.85)]',
  slot: 'bg-[linear-gradient(145deg,#1A1B1F_0%,#2E2F36_100%)] p-5 text-white shadow-[0_18px_36px_-24px_rgba(0,0,0,0.9)] ring-1 ring-[#E8C268]/30',
  teaser: 'bg-[linear-gradient(160deg,#0F1012_0%,#1A1B1F_100%)]',
  band: 'border-[#E8C268]/30 bg-[linear-gradient(135deg,#0F1012_0%,#1A1B1F_45%,#2E2F36_100%)] p-4 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]',
  glow: 'bg-[#E8C268]/15',
  accent: 'text-[#E8C268]',
  accentSoft: 'text-[#F3DCA0]',
  muted: 'text-[#DEDAD2]',
  faint: 'text-[#F1EEE8]',
  mutedSoft: 'text-[#DEDAD2]/80',
  coachText: 'text-[#DEDAD2]/90',
  done: 'bg-[#E8C268] font-semibold text-[#16171A]',
  solid: 'bg-[#E8C268] text-[#16171A]',
  solidHover: 'hover:bg-[#F3DCA0]',
  focus: 'focus-visible:outline-[#E8C268]',
  chip: 'bg-[#1A1B1F] text-[#E8C268]',
  label: '#E8C268',
  pipShape: 'rounded-[6px]',
  pip: {
    attended: 'bg-[#E8C268] text-[#16171A] shadow-[0_0_10px_rgba(232,194,104,0.55)]',
    missed: 'border-2 border-white/35 text-white/60',
    unmarked: 'border-2 border-dashed border-[#F3DCA0]/80 text-[#F3DCA0]',
    today: 'border-2 border-[#E8C268] bg-[#E8C268]/20 text-[#F3DCA0] animate-pulse motion-reduce:animate-none',
    upcoming: 'border border-white/30 bg-white/5 text-white/80',
  },
  pipEnd: {
    done: 'bg-[#E8C268] text-[#16171A] shadow-[0_0_12px_rgba(232,194,104,0.7)]',
    today: 'border-2 border-[#E8C268] bg-[#E8C268]/20 text-[#F3DCA0] animate-pulse motion-reduce:animate-none',
    ahead: 'border border-[#F3DCA0]/60 text-[#F3DCA0]',
  },
  confetti: ['#E8C268', '#F3DCA0', '#FFFFFF', '#A8802A', '#9CA3AF'],
};

const STUDIO_LOOKS: Record<StudioGroupLook, LeagueLook> = { offSeason: OFF_SEASON, section80: SECTION_80, studio: STUDIO_LOOK };

/** The look for a season and (for studio) the group's full name; no group → the season's shared look. */
export function leagueLook(theme: LeagueTheme | null | undefined, groupName?: string | null): LeagueLook {
  if (theme !== 'studio') return FOOTBALL_LOOK;
  return STUDIO_LOOKS[studioGroupLook(groupName ? groupTail(groupName) : null)];
}

/**
 * The invitation's look: the group the student chose, else the only group on offer, else (two or
 * more to choose from) the season's shared look; each squad card then wears its own group's.
 */
export function invitationLook(
  invitation: { theme?: LeagueTheme; options: { group_id: number; label: string }[]; chosen_group_id: number | null } | null,
): LeagueLook {
  if (!invitation) return FOOTBALL_LOOK;
  const chosen = invitation.options.find((o) => o.group_id === invitation.chosen_group_id);
  const only = invitation.options.length === 1 ? invitation.options[0] : undefined;
  return leagueLook(invitation.theme, (chosen ?? only)?.label ?? null);
}
