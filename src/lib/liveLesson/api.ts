import type {
  CurrentLive, LiveMode, LiveRecord, LiveSettings, LiveState, MistakePreview, PopcheckPreview, QuestionRef,
  StartActivity, Suggestions, FunResult, ReactionKind,
} from './types';

/**
 * `/live` endpoints (lms-backend `src/live_lesson/routes.py`), over whichever client the caller has:
 * the main app's axios instance or the Meet panel's Bearer-token fetch. Both adapt to `Requester`.
 */
export type Requester = <T>(path: string, init?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }) => Promise<T>;

export function liveApi(request: Requester) {
  const base = (id: number) => `/live/lessons/${id}`;
  const post = <T,>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body });
  return {
    current: () => request<CurrentLive>('/live/current'),
    state: (id: number) => request<LiveState>(`${base(id)}/state`),
    record: (id: number) => request<LiveRecord>(`${base(id)}/record`),
    seen: (id: number) => post<null>(`${base(id)}/seen`),
    start: (id: number, data: StartActivity) => post<{ id: number }>(`${base(id)}/activities`, data),
    close: (id: number, activityId: number) => post<{ ok: boolean }>(`${base(id)}/activities/${activityId}/close`),
    reveal: (id: number, activityId: number) => post<{ ok: boolean }>(`${base(id)}/activities/${activityId}/reveal`),
    answer: (id: number, activityId: number, value: unknown, item?: number) =>
      post<{ id: number; item: number; hidden: boolean }>(`${base(id)}/activities/${activityId}/answers`, { value, item }),
    hide: (id: number, answerId: number, hidden: boolean) => post<{ ok: boolean }>(`${base(id)}/answers/${answerId}/hide`, { hidden }),
    timer: (id: number, action: 'start' | 'pause' | 'resume' | 'add' | 'stop', seconds?: number, attach = true) =>
      post<{ ok: boolean }>(`${base(id)}/timer`, { action, seconds, attach }),
    pick: (id: number) => post<{ id: number; user_id: number }>(`${base(id)}/picks`),
    pickOutcome: (id: number, pickId: number, outcome: 'answered' | 'no_answer' | 'skipped' | null) =>
      post<{ id: number | null; user_id?: number }>(`${base(id)}/picks/${pickId}`, { outcome }),
    popcheckPreview: (id: number, exclude: QuestionRef[] = [], count = 3) =>
      post<PopcheckPreview>(`${base(id)}/popcheck/preview`, { exclude, count }),
    mistakePreview: (id: number) => request<MistakePreview>(`${base(id)}/mistake/preview`),
    suggestions: (id: number) => request<Suggestions>(`${base(id)}/suggestions`),
    // The fun layer (owner, 2026-10-04).
    react: (id: number, kind: ReactionKind) => post<FunResult>(`${base(id)}/react`, { kind }),
    lost: (id: number) => post<FunResult>(`${base(id)}/lost`),
    hand: (id: number, up: boolean) => post<FunResult>(`${base(id)}/hand`, { up }),
    callHand: (id: number, userId: number) => post<void>(`${base(id)}/hands/${userId}/call`),
    pauseReactions: (id: number, paused: boolean) => post<void>(`${base(id)}/reactions`, { paused }),
    crownSuggestion: (id: number) => request<{ user_id: number | null }>(`${base(id)}/crown/suggestion`),
    crown: (id: number, userId: number | null) => post<void>(`${base(id)}/crown`, { user_id: userId }),
    recap: (id: number, show: boolean) => post<void>(`${base(id)}/recap`, { show }),
    confirm: (id: number, userIds?: number[]) => post<{ written: number }>(`${base(id)}/suggestions/confirm`, { user_ids: userIds ?? null }),
    settings: () => request<LiveSettings>('/live/settings'),
    setMode: (mode: LiveMode) => request<LiveSettings>('/live/settings', { method: 'PUT', body: { mode } }),
  };
}

export type LiveApi = ReturnType<typeof liveApi>;
