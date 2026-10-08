import { describe, expect, it } from 'vitest';
import { localizeServerError, serverMessage } from './serverError';

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

describe('serverMessage', () => {
  it('words a code sent inside a body (a per-item result) in the reader’s language', () => {
    expect(serverMessage('offboarding_owner_role', 'Dana S. cannot take a lesson', 'ru')).toBe('Этому человеку такое передать нельзя');
  });

  it('keeps the server’s sentence for an unknown code, no code, or a sentence with unfilled blanks', () => {
    expect(serverMessage('brand_new_code', 'As sent', 'ru')).toBe('As sent');
    expect(serverMessage(null, 'As sent', 'ru')).toBe('As sent');
    expect(serverMessage('staff_leaving', 'Aida is leaving on 2026-10-31', 'ru')).toBe('Aida is leaving on 2026-10-31');
  });
});
