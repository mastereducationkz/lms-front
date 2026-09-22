import { describe, expect, it } from 'vitest';
import { reportErrorMessage } from './questionReport';

describe('reportErrorMessage', () => {
  it('shows the server’s reason when the report was refused', () => {
    // A student told "please try again" after a 400 will just try again, with the same
    // message, for ever. The server already says exactly what is wrong.
    const err = { response: { status: 400, data: { detail: 'Опишите ошибку хотя бы парой слов.' } } };
    expect(reportErrorMessage(err)).toBe('Опишите ошибку хотя бы парой слов.');
  });

  it('shows the reason for a rate limit too', () => {
    const err = { response: { status: 429, data: { detail: 'Вы уже отправили 10 сообщений.' } } };
    expect(reportErrorMessage(err)).toBe('Вы уже отправили 10 сообщений.');
  });

  it('falls back to a generic line when the server said nothing useful', () => {
    expect(reportErrorMessage({ response: { status: 500, data: {} } }))
      .toBe('Failed to submit report. Please try again.');
    expect(reportErrorMessage(new Error('network'))).toBe('Failed to submit report. Please try again.');
    expect(reportErrorMessage(undefined)).toBe('Failed to submit report. Please try again.');
  });

  it('ignores a non-string detail rather than rendering [object Object]', () => {
    // FastAPI validation errors put an array in `detail`.
    const err = { response: { status: 422, data: { detail: [{ msg: 'field required' }] } } };
    expect(reportErrorMessage(err)).toBe('Failed to submit report. Please try again.');
  });
});
