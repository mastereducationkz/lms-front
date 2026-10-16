import { useEffect, useState } from 'react';
import type { TFunction } from '../../lib/i18n/translate';
import '@/lib/i18n/catalogs/openWebinars';

/** Milliseconds until `target` (never negative); ticks every second, which is plenty for a minutes display. */
export function useCountdown(target: string | null | undefined): number {
  const goal = target ? new Date(target).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!Number.isFinite(goal)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [goal]);
  return Number.isFinite(goal) ? Math.max(goal - now, 0) : 0;
}

/** «2 d 3 h 15 min» / «3 h 15 min» / «12 min» / «any moment now». */
export function countdownText(ms: number, t: TFunction): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(t('openWebinars.countdown.d', { n: days }));
  if (days || hours) parts.push(t('openWebinars.countdown.h', { n: hours }));
  if (!days) parts.push(t('openWebinars.countdown.min', { n: minutes }));
  return totalMinutes < 1 ? t('openWebinars.countdown.soon') : parts.join(' ');
}
