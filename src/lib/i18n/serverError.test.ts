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

describe('the open-webinar refusals', () => {
  it('words the presenter, delete and retype refusals in Russian and in English', () => {
    const speaker = { detail: 'x', reason_code: 'speaker_required' };
    localizeServerError(speaker, 'ru');
    expect(speaker.detail).toBe('Выберите приглашённого спикера либо назовите ведущего или никого.');
    const gone = { detail: 'x', reason_code: 'webinar_public_delete', reason_details: { event_ids: [7] } };
    localizeServerError(gone, 'en');
    expect(gone.detail).toBe('This webinar already took place and has a public page, registrations or a recording, so it stays as history. Withdraw its recording if it should no longer be public.');
    const retype = { detail: 'x', reason_code: 'webinar_public_retype' };
    localizeServerError(retype, 'en');
    expect(retype.detail).toContain('so its type cannot change');
  });

  it('has a sentence for every code the open-webinar endpoints and the public form can refuse with', () => {
    const codes = ['bad_presenter', 'speaker_required', 'captcha_failed', 'too_many', 'slug_locked', 'series_not_supported', 'banner_invalid', 'banner_too_large',
      'close_after_start', 'close_has_registrations', 'not_open', 'recording_not_ready', 'recording_not_published', 'event_not_found',
      'webinar_public_retype', 'webinar_public_host', 'webinar_public_delete'];
    for (const code of codes) {
      for (const locale of ['en', 'ru'] as const) {
        const body = { detail: 'server English', reason_code: code };
        localizeServerError(body, locale);
        expect(body.detail, `${code} (${locale})`).not.toBe('server English');
      }
    }
  });
});
