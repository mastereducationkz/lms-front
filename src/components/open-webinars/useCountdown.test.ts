import { describe, expect, it } from 'vitest';
import { t } from '../../lib/i18n/translate';
import { countdownText } from './useCountdown';
import '@/lib/i18n/catalogs/openWebinars';

const en = (key: Parameters<typeof t>[0], params?: Parameters<typeof t>[1]) => t(key, params, 'en');
const ru = (key: Parameters<typeof t>[0], params?: Parameters<typeof t>[1]) => t(key, params, 'ru');
const minutes = (n: number) => n * 60_000;

describe('the countdown to a webinar', () => {
  it('shows days and hours far out, hours and minutes close in, minutes in the last hour', () => {
    expect(countdownText(minutes(2 * 1440 + 3 * 60 + 15), en)).toBe('2 d 3 h');
    expect(countdownText(minutes(3 * 60 + 15), en)).toBe('3 h 15 min');
    expect(countdownText(minutes(12), en)).toBe('12 min');
  });

  it('says «any moment now» in the last minute, in the visitor’s language', () => {
    expect(countdownText(30_000, en)).toBe('any moment now');
    expect(countdownText(30_000, ru)).toBe('совсем скоро');
    expect(countdownText(minutes(90), ru)).toBe('1 ч 30 мин');
  });
});
