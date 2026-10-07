import { describe, expect, it } from 'vitest';
import { localizeServerError } from './serverError';

describe('localizeServerError', () => {
  it('shows a known refusal in the reader’s language, with its blanks filled', () => {
    const body = { detail: 'No more than 4000 characters', reason_code: 'lesson_note_too_long', reason_details: { max: 4000 } };
    localizeServerError(body, 'ru');
    expect(body.detail).toBe('Не больше 4000 символов');
    localizeServerError(body, 'en');
    expect(body.detail).toBe('No more than 4000 characters');
  });

  it('keeps the server’s text for a code it does not know, or no code at all', () => {
    const unknown = { detail: 'Checkpoint “2” isn’t open yet.', reason_code: 'checkpoint_not_open', reason_details: { missing_units: ['Unit 3'] } };
    localizeServerError(unknown, 'ru');
    expect(unknown.detail).toBe('Checkpoint “2” isn’t open yet.');
    const plain = { detail: 'Request already resolved' };
    localizeServerError(plain, 'ru');
    expect(plain.detail).toBe('Request already resolved');
  });

  it('ignores bodies that are not objects', () => {
    expect(() => localizeServerError(undefined)).not.toThrow();
    expect(() => localizeServerError('Bad Gateway')).not.toThrow();
  });
});
