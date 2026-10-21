import { describe, expect, it } from 'vitest';
import '@/lib/i18n/catalogs/announcements';
import '@/lib/i18n/catalogs/openWebinars';
import { t } from './translate';

describe('wording owners asked for (2026-10-21)', () => {
  it('the Master League chat step asks for a similar chat title, not an identical one', () => {
    const why = (locale: 'ru' | 'en') => t('announcements.mlChecklist.steps.chat_found.why', undefined, locale);
    expect(why('ru')).toContain('похоже на название группы');
    expect(why('ru')).toContain('«SAT»');
    expect(why('ru')).not.toContain('совпадать');
    expect(why('en')).toContain('should resemble the LMS group name');
    expect(why('en')).toContain('SAT');
    expect(why('en')).not.toContain('must match');
  });

  it('withdrawing a public recording says only the public page goes; the staff archive keeps it', () => {
    expect(t('openWebinars.admin.rec.withdrawHelp', undefined, 'en')).toBe('Withdrawing removes the public page only. The recording stays in the staff archive.');
    expect(t('openWebinars.admin.rec.withdrawHelp', undefined, 'ru')).toContain('только публичную страницу');
    expect(t('openWebinars.admin.rec.withdrawHelp', undefined, 'ru')).toContain('архиве для сотрудников');
  });
});
