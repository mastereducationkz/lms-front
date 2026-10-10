import { parseAsUTC } from './datetime';

/** A class of a group, as `GET /leaderboard/group-schedules/{id}` sends it. */
export interface ClassEvent {
  id: number;
  title: string;
  /** UTC with an explicit `Z`. */
  scheduled_at: string;
  lesson_number: number;
  is_past?: boolean;
}

/** Where a group's class list stands: loading, in hand, or failed (a refusal is flagged, it will not heal on retry). */
export type ClassesState =
  | { status: 'loading' }
  | { status: 'ready'; events: ClassEvent[] }
  | { status: 'error'; forbidden: boolean };

export type ClassPickerView =
  | { kind: 'loading' }
  | { kind: 'error'; forbidden: boolean }
  | { kind: 'empty' }
  | { kind: 'options'; options: { event: ClassEvent; held: boolean }[] };

/** The classes a homework can be tied to: those that have not started, soonest first. */
export function upcomingClasses(events: ClassEvent[], now: Date = new Date()): ClassEvent[] {
  return events
    .filter((e) => !e.is_past && parseAsUTC(e.scheduled_at) >= now)
    .sort((a, b) => parseAsUTC(a.scheduled_at).getTime() - parseAsUTC(b.scheduled_at).getTime());
}

/**
 * What the «Pick a class» control shows. A failed load and a group with nothing coming up are different
 * things and read differently: the first can be retried, the second means the schedule has to be extended.
 * A class that is already picked stays in the list even once it has been held (a deep link to a recent
 * lesson), flagged `held`, so the control can still show what is selected.
 */
export function classPickerView(state: ClassesState, selectedId: number | null, now: Date = new Date()): ClassPickerView {
  if (state.status === 'loading') return { kind: 'loading' };
  if (state.status === 'error') return { kind: 'error', forbidden: state.forbidden };
  const upcoming = upcomingClasses(state.events, now);
  const picked = selectedId != null && !upcoming.some((e) => e.id === selectedId)
    ? state.events.find((e) => e.id === selectedId)
    : undefined;
  const options = [
    ...(picked ? [{ event: picked, held: true }] : []),
    ...upcoming.map((event) => ({ event, held: false })),
  ];
  return options.length ? { kind: 'options', options } : { kind: 'empty' };
}

const statusOf = (error: unknown): number | undefined => (error as { response?: { status?: number } })?.response?.status;

/** Worth another try: no answer at all, a timeout, a rate limit or a server error. Other client errors will not change. */
const isTransient = (status: number | undefined): boolean =>
  status === undefined || status === 408 || status === 429 || status >= 500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Load a group's classes, once more after a transient failure. The page used to log a failure and leave the
 * list empty with nothing on screen, and linking a class is mandatory, so one dropped request meant a
 * homework that could not be saved.
 */
export async function fetchGroupClasses(
  load: () => Promise<ClassEvent[]>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<ClassesState> {
  const retries = options.retries ?? 1;
  const delayMs = options.delayMs ?? 600;
  for (let attempt = 0; ; attempt++) {
    try {
      return { status: 'ready', events: await load() };
    } catch (error) {
      const status = statusOf(error);
      if (attempt >= retries || !isTransient(status)) return { status: 'error', forbidden: status === 403 };
      await sleep(delayMs);
    }
  }
}
