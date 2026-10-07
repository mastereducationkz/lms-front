/**
 * One lookup at a time. Starting another, resetting or unmounting aborts the one in flight, and
 * every event carries the id of the lookup it belongs to, so a late answer to an old selection can
 * never land on the card for the new one.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  LookupFailure,
  streamLookup,
  type LookupEvent,
  type LookupGloss,
  type LookupLang,
  type LookupMode,
  type LookupResult,
} from '../../../services/api/lookup';

export type WordField = 'translation' | 'headword' | 'pos' | 'definition' | 'example';

export interface LookupError {
  code: string;
  message: string;
  retryAfter?: number;
}

export interface LookupState {
  id: number;
  status: 'idle' | 'loading' | 'streaming' | 'done' | 'error';
  mode: LookupMode | null;
  lang: LookupLang;
  cached: boolean;
  /** Text so far per field; `finished` says which are final. */
  fields: Partial<Record<WordField, string>>;
  finished: Partial<Record<WordField, true>>;
  glosses: LookupGloss[];
  result: LookupResult | null;
  error: LookupError | null;
}

export const IDLE: LookupState = {
  id: 0, status: 'idle', mode: null, lang: 'ru', cached: false,
  fields: {}, finished: {}, glosses: [], result: null, error: null,
};

export type LookupAction =
  | { type: 'start'; id: number; mode: LookupMode; lang: LookupLang }
  | { type: 'event'; id: number; event: LookupEvent }
  | { type: 'end'; id: number }
  | { type: 'fail'; id: number; error: LookupError }
  | { type: 'reset'; id: number };

const FIELDS: WordField[] = ['translation', 'headword', 'pos', 'definition', 'example'];
const isField = (name: string): name is WordField => (FIELDS as string[]).includes(name);

function fromResult(state: LookupState, result: LookupResult): LookupState {
  if (result.mode === 'phrase') {
    return { ...state, status: 'done', result, fields: { translation: result.translation }, finished: { translation: true }, glosses: result.glosses };
  }
  const fields: LookupState['fields'] = {};
  const finished: LookupState['finished'] = {};
  for (const name of FIELDS) {
    const value = result[name];
    if (value) fields[name] = value;
    finished[name] = true;
  }
  return { ...state, status: 'done', result, fields, finished };
}

export function lookupReducer(state: LookupState, action: LookupAction): LookupState {
  if (action.type === 'start') {
    return { ...IDLE, id: action.id, status: 'loading', mode: action.mode, lang: action.lang };
  }
  if (action.type === 'reset') return { ...IDLE, id: action.id, lang: state.lang };
  // Anything for a lookup that is no longer the current one is dropped: the stale-answer guard.
  if (action.id !== state.id || state.status === 'done' || state.status === 'error' || state.status === 'idle') {
    return state;
  }
  if (action.type === 'fail') return { ...state, status: 'error', error: action.error };
  if (action.type === 'end') {
    return { ...state, status: 'error', error: { code: 'cut_off', message: 'The answer was cut off. Try again.' } };
  }
  const event = action.event;
  switch (event.type) {
    case 'meta':
      return { ...state, mode: event.mode, lang: event.lang, cached: event.cached };
    case 'delta':
      if (!isField(event.field) || state.finished[event.field]) return state;
      return { ...state, status: 'streaming', fields: { ...state.fields, [event.field]: (state.fields[event.field] ?? '') + event.text } };
    case 'field':
      if (!isField(event.field)) return state;
      return {
        ...state, status: 'streaming',
        fields: { ...state.fields, [event.field]: event.value },
        finished: { ...state.finished, [event.field]: true },
      };
    case 'gloss': {
      const glosses = state.glosses.slice();
      glosses[event.index] = event.value;
      return { ...state, status: 'streaming', glosses };
    }
    case 'done':
      return fromResult(state, event.result);
    case 'error':
      return { ...state, status: 'error', error: { code: event.code, message: event.message } };
    default:
      return state;
  }
}

function asError(error: unknown): LookupError {
  if (error instanceof LookupFailure) return { code: error.code, message: error.message, retryAfter: error.retryAfter };
  return { code: 'network', message: "Couldn't reach the dictionary. Check your connection and try again." };
}

export function useLookupStream() {
  const [state, dispatch] = useReducer(lookupReducer, IDLE);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  const abort = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  const start = useCallback(
    (request: { text: string; context?: string; lang: LookupLang; mode: LookupMode }) => {
      abort();
      const id = ++sequence.current;
      const own = new AbortController();
      controller.current = own;
      dispatch({ type: 'start', id, mode: request.mode, lang: request.lang });
      streamLookup(request, (event) => {
        if (!own.signal.aborted) dispatch({ type: 'event', id, event });
      }, own.signal)
        .then(() => {
          if (!own.signal.aborted) dispatch({ type: 'end', id });
        })
        .catch((error: unknown) => {
          if (!own.signal.aborted) dispatch({ type: 'fail', id, error: asError(error) });
        });
    },
    [abort],
  );

  const reset = useCallback(() => {
    abort();
    dispatch({ type: 'reset', id: ++sequence.current });
  }, [abort]);

  // Leaving the lesson step aborts whatever is still streaming.
  useEffect(() => abort, [abort]);

  return { state, start, reset };
}
