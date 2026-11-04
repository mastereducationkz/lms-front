import { describe, expect, it } from 'vitest';
import { hasMessage, t } from '@/lib/i18n';
import '@/lib/i18n/catalogs/serverErrors';

// Every refusal code lms-backend's staff_training package raises (lms-backend PR #347) plus the copy's 502.
const CODES = [
  'staff_training_off', 'staff_training_staff_only', 'staff_training_progress_forbidden', 'staff_training_not_found',
  'staff_training_clip_changed', 'staff_training_watch_first', 'staff_training_bad_answer', 'staff_training_bad_request',
  'staff_training_check_rate', 'staff_training_reset_limit', 'staff_training_new_hire_locked', 'training_copy_unavailable', 'training_copy_preparing',
  'staff_training_service_off', 'staff_training_service_key', 'staff_training_version_stale', 'staff_training_media_missing',
  'staff_training_media_too_large', 'staff_training_manifest_invalid', 'staff_training_sha_required', 'staff_training_sha_mismatch',
  'staff_training_unknown_role', 'staff_training_unknown_item',
];

describe('the coded-error catalog for staff training', () => {
  it('words every code the backend raises, in both languages', () => {
    for (const code of CODES) {
      const key = `serverErrors.${code}`;
      expect(hasMessage(key), key).toBe(true);
      expect(t(key as never, undefined, 'en'), key).not.toBe(key);
      expect(t(key as never, undefined, 'ru'), key).toMatch(/[А-Яа-я]/);
    }
  });
});
