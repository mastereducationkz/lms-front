import { describe, expect, it, vi } from 'vitest';

// The modules under test are pure; their imports reach the axios client and the auth context,
// which need a browser at import time.
vi.mock('../../../services/api/client', () => ({ api: {} }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, updateUser: () => {} }) }));
import { readNdjson, type LookupEvent } from '../../../services/api/lookup';
import { pickLookupLang } from './lookupLang';
import { MAX_CONTEXT_CHARS, contextAround, lookupAllowed, selectionKind } from './selection';
import { IDLE, lookupReducer, type LookupState } from './useLookupStream';

describe('what a selection is', () => {
  it('1–3 words is the dictionary, more is a phrase, past 400 characters is too long', () => {
    expect(selectionKind('  Meticulous, ')).toBe('word');
    expect(selectionKind('by and large')).toBe('word');
    expect(selectionKind('took it for granted')).toBe('phrase');
    expect(selectionKind(' '.repeat(200) + 'a'.repeat(400) + '\n'.repeat(50))).toBe('word');
    expect(selectionKind('word '.repeat(81))).toBe('too_long');
    expect(selectionKind(' — ')).toBe('empty');
  });

  it('sends the sentence around the selection as context, capped', () => {
    const block = 'The river was wide. We sat on the bank and watched the boats. Then it rained.';
    expect(contextAround('bank', block)).toBe('We sat on the bank and watched the boats.');
    const long = `${'w '.repeat(300)}target ${'w '.repeat(300)}.`;
    const window = contextAround('target', long)!;
    expect(window.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
    expect(window).toContain('target');
  });

  it('is off in quiz questions and in checkpoints, on in text and video steps', () => {
    expect(lookupAllowed('text', 'lesson')).toBe(true);
    expect(lookupAllowed('video_text', undefined)).toBe(true);
    expect(lookupAllowed('quiz', 'lesson')).toBe(false);
    expect(lookupAllowed('text', 'checkpoint')).toBe(false);
    expect(lookupAllowed('video_text', 'checkpoint')).toBe(false);
  });

  it('translates into the account language, then this browser’s, then Russian', () => {
    expect(pickLookupLang('kk', 'ru')).toBe('kk');
    expect(pickLookupLang(undefined, 'kk')).toBe('kk');
    expect(pickLookupLang(undefined, 'en')).toBe('ru');
    expect(pickLookupLang(null, null)).toBe('ru');
  });
});

describe('the lookup state', () => {
  const started = (id: number): LookupState => lookupReducer(IDLE, { type: 'start', id, mode: 'word', lang: 'ru' });
  const feed = (state: LookupState, id: number, ...events: LookupEvent[]) =>
    events.reduce((s, event) => lookupReducer(s, { type: 'event', id, event }), state);

  it('builds fields from deltas, then takes the finished value', () => {
    const state = feed(started(1), 1,
      { type: 'delta', field: 'translation', text: 'бер' },
      { type: 'delta', field: 'translation', text: 'ег' });
    expect(state.fields.translation).toBe('берег');
    expect(state.status).toBe('streaming');
    const finished = feed(state, 1, { type: 'field', field: 'translation', value: 'берег (реки)' });
    expect(finished.fields.translation).toBe('берег (реки)');
    expect(finished.finished.translation).toBe(true);
  });

  it('drops a late answer to an earlier selection (the stale-answer bug)', () => {
    let state = feed(started(1), 1, { type: 'delta', field: 'translation', text: 'old' });
    state = lookupReducer(state, { type: 'start', id: 2, mode: 'word', lang: 'ru' });
    state = feed(state, 1, { type: 'field', field: 'translation', value: 'OLD ANSWER' },
      { type: 'done', result: { mode: 'word', translation: 'OLD', headword: null, pos: null, definition: null, example: null } });
    expect(state.id).toBe(2);
    expect(state.fields).toEqual({});
    expect(state.status).toBe('loading');
  });

  it('a stream that ends without done or error is an error, not a half card', () => {
    const state = lookupReducer(feed(started(3), 3, { type: 'delta', field: 'translation', text: 'x' }), { type: 'end', id: 3 });
    expect(state.status).toBe('error');
    expect(state.error?.code).toBe('cut_off');
  });

  it('done carries the whole result, phrases included', () => {
    const phrase = lookupReducer(IDLE, { type: 'start', id: 4, mode: 'phrase', lang: 'kk' });
    const state = feed(phrase, 4, { type: 'done', result: { mode: 'phrase', translation: 'Аударма', glosses: [{ term: 'a', meaning: 'b', note: 'c' }] } });
    expect(state.status).toBe('done');
    expect(state.fields.translation).toBe('Аударма');
    expect(state.glosses).toHaveLength(1);
  });
});

describe('the NDJSON reader', () => {
  const streamOf = (chunks: Uint8Array[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });

  it('parses only whole lines, across chunk and multi-byte boundaries', async () => {
    const bytes = new TextEncoder().encode(
      '{"type":"meta","mode":"word","lang":"kk","cached":false}\n{"type":"delta","field":"translation","text":"мұқият"}\nnot json\n{"type":"done","result":{"mode":"word"}}',
    );
    const chunks = [bytes.slice(0, 7), bytes.slice(7, 70), bytes.slice(70, 71), bytes.slice(71)];
    const events: LookupEvent[] = [];
    await readNdjson(streamOf(chunks), (event) => events.push(event));
    expect(events.map((e) => e.type)).toEqual(['meta', 'delta', 'done']);
    expect((events[1] as { text: string }).text).toBe('мұқият');
  });
});
