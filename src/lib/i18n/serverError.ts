import './catalogs/serverErrors';
import type { Locale } from './locale';
import { hasMessage, t } from './translate';

/**
 * The backend answers a refusal in English with a stable `reason_code` and, when the sentence
 * has blanks, `reason_details` (lms-backend src/utils/coded_errors.py). A code the catalog knows
 * (`serverErrors.<code>`) has its `detail` rewritten in the reader's language, so the ~90 places
 * that show `response.data.detail` need no change; any other body is left as the server sent it.
 */
export function localizeServerError(data: unknown, locale?: Locale): void {
  if (!data || typeof data !== 'object') return;
  const body = data as { reason_code?: unknown; reason_details?: unknown; detail?: unknown };
  if (typeof body.reason_code !== 'string') return;
  const key = `serverErrors.${body.reason_code}`;
  if (!hasMessage(key)) return;
  const details = body.reason_details && typeof body.reason_details === 'object' ? body.reason_details : {};
  const params = Object.fromEntries(
    Object.entries(details).filter((entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number'),
  );
  body.detail = t(key, params, locale);
}
