/**
 * Look Up: POST /ai-tools/lookup/stream answers as NDJSON, one whole JSON object per line
 * (lms-backend src/content/lookup/protocol.py):
 *
 *   meta  → mode, language, cached        delta → more text of a field being written
 *   field → a field's finished value      gloss → one hard word of a phrase
 *   done  → the whole result              error → code + message (the card offers Try again)
 *
 * The request goes through the shared axios instance (auth header, token refresh) with the fetch
 * adapter, the one adapter that hands back the body as a stream.
 */
import { api } from './client';

export type LookupLang = 'ru' | 'kk';
export type LookupMode = 'word' | 'phrase';

export interface LookupGloss {
  term: string;
  meaning: string;
  note: string;
}

export interface WordResult {
  mode: 'word';
  translation: string | null;
  headword: string | null;
  pos: string | null;
  definition: string | null;
  example: string | null;
}

export interface PhraseResult {
  mode: 'phrase';
  translation: string;
  glosses: LookupGloss[];
}

export type LookupResult = WordResult | PhraseResult;

export type LookupEvent =
  | { type: 'meta'; mode: LookupMode; lang: LookupLang; cached: boolean }
  | { type: 'delta'; field: string; text: string }
  | { type: 'field'; field: string; value: string }
  | { type: 'gloss'; index: number; value: LookupGloss }
  | { type: 'done'; result: LookupResult }
  | { type: 'error'; code: string; message: string; retry?: boolean };

/** A lookup refused or failed before or while streaming. `code` picks the card's message. */
export class LookupFailure extends Error {
  constructor(
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'LookupFailure';
  }
}

/** Reads NDJSON lines off a byte stream, parsing each line only once it is complete. */
export async function readNdjson(stream: ReadableStream<Uint8Array>, onEvent: (event: LookupEvent) => void): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const emit = (line: string) => {
    if (!line.trim()) return;
    let event: LookupEvent;
    try {
      event = JSON.parse(line) as LookupEvent;
    } catch {
      return; // a line that isn't JSON is noise, never half an event
    }
    if (event && typeof event.type === 'string') onEvent(event);
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        emit(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    emit(buffer + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

async function readErrorBody(data: unknown): Promise<{ code?: string; message?: string; retry_after?: number } | null> {
  try {
    const text = data instanceof ReadableStream ? await new Response(data).text() : typeof data === 'string' ? data : null;
    const body = text ? JSON.parse(text) : data;
    const detail = (body as { detail?: unknown })?.detail;
    if (detail && typeof detail === 'object') return detail as { code?: string; message?: string };
    if (typeof detail === 'string') return { message: detail };
  } catch {
    /* fall through to the generic message */
  }
  return null;
}

export async function streamLookup(
  request: { text: string; context?: string; lang: LookupLang },
  onEvent: (event: LookupEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let response;
  try {
    response = await api.request({
      method: 'post',
      url: '/ai-tools/lookup/stream',
      data: { text: request.text, context_sentence: request.context ?? null, lang: request.lang },
      adapter: 'fetch',
      responseType: 'stream',
      headers: { Accept: 'application/x-ndjson' },
      timeout: 30000,
      signal,
    });
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    const err = error as { response?: { status?: number; data?: unknown } };
    const status = err.response?.status;
    const body = err.response ? await readErrorBody(err.response.data) : null;
    if (status === 429) {
      throw new LookupFailure('rate_limited', body?.message ?? 'Too many lookups. Wait a moment and try again.', body?.retry_after);
    }
    if (status === 422 && body?.code === 'too_long') throw new LookupFailure('too_long', body.message ?? '');
    if (status === 503) throw new LookupFailure('ai_unavailable', body?.message ?? 'The dictionary is unavailable right now. Try again in a moment.');
    if (!err.response) throw new LookupFailure('network', "Couldn't reach the dictionary. Check your connection and try again.");
    throw new LookupFailure(body?.code ?? 'failed', body?.message ?? 'The dictionary could not answer. Try again.');
  }
  await readNdjson(response.data as ReadableStream<Uint8Array>, onEvent);
}
