import './catalogs/serverErrors';
import type { Locale } from './locale';
import { formatDateLong } from './format';
import { hasMessage, t } from './translate';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The backend answers a refusal in English with a stable `reason_code` and, when the sentence
 * has blanks, `reason_details` (lms-backend src/utils/coded_errors.py). A code the catalog knows
 * (`serverErrors.<code>`) has its `detail` rewritten in the reader's language, so the ~90 places
 * that show `response.data.detail` need no change; any other body is left as the server sent it.
 * A detail named `date` that is a bare ISO day (`2026-11-06`) is written as a date in the reader's
 * language; a `date` that is already text (`lesson_already_taught`) is left alone.
 */
export function localizeServerError(data: unknown, locale?: Locale): void {
  if (!data || typeof data !== 'object') return;
  const body = data as { reason_code?: unknown; reason_details?: unknown; detail?: unknown };
  if (typeof body.reason_code !== 'string') return;
  const key = `serverErrors.${body.reason_code}`;
  if (!hasMessage(key)) return;
  const details = body.reason_details && typeof body.reason_details === 'object' ? body.reason_details : {};
  const params = Object.fromEntries(
    Object.entries(details)
      .filter((entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number')
      .map(([name, value]): [string, string | number] =>
        name === 'date' && typeof value === 'string' && ISO_DAY.test(value) ? [name, formatDateLong(value, locale)] : [name, value]),
  );
  body.detail = t(key, params, locale);
}

/**
 * A refusal that arrives inside a 200 body rather than as the response (a per-item reassign
 * result, a preview's `why_not`): the catalog's sentence for `code` in the reader's language, or
 * the server's English when the code is unknown or a blank would stay unfilled.
 */
export function serverMessage(code: string | null | undefined, english: string, locale?: Locale): string {
  const key = `serverErrors.${code}`;
  if (!code || !hasMessage(key)) return english;
  const text = t(key, undefined, locale);
  return /\{\w+\}/.test(text) ? english : text;
}
