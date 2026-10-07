import { useEffect, useState } from 'react';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { isClock } from '../../lib/notificationMatrix';
import type { QuietHours } from '../../services/api/notificationCenter';

/**
 * Quiet hours (owner: OFF by default): Telegram and push wait until the window ends; in-app and
 * email are never held back (lms-backend catalog.DEFERRABLE_CHANNELS). Times save once valid.
 */
export default function QuietHoursRow({ value, onSave }: { value: QuietHours; onSave: (next: QuietHours) => void }) {
  const t = useT();
  const [start, setStart] = useState(value.start);
  const [end, setEnd] = useState(value.end);
  useEffect(() => {
    setStart(value.start);
    setEnd(value.end);
  }, [value.start, value.end]);

  const commit = (nextStart: string, nextEnd: string) => {
    if (!isClock(nextStart) || !isClock(nextEnd)) return;
    if (nextStart === value.start && nextEnd === value.end) return;
    onSave({ ...value, start: nextStart, end: nextEnd });
  };
  const invalid = (start && !isClock(start)) || (end && !isClock(end));

  return (
    <div className="border-t border-border px-4 py-4 sm:px-5">
      <div className="text-sm font-medium text-foreground">{t('settings.quiet.title')}</div>
      <p className="mt-0.5 text-sm text-muted-foreground [text-wrap:pretty]">{t('settings.quiet.description')}</p>
      <label htmlFor="quiet-on" className="mt-3 inline-flex min-h-9 items-center gap-2 text-sm text-foreground">
        <Checkbox
          id="quiet-on"
          checked={value.enabled}
          onCheckedChange={(v) => onSave({ ...value, enabled: v === true })}
          className="data-[state=checked]:border-brand-solid data-[state=checked]:bg-brand-solid data-[state=checked]:text-brand-solid-foreground"
        />
        {t('settings.quiet.toggle')}
      </label>
      {value.enabled && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="quiet-start" className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('settings.quiet.from')}
            </label>
            <Input id="quiet-start" type="time" step={60} value={start} onChange={(e) => setStart(e.target.value)} onBlur={() => commit(start, end)} className="w-32" />
          </div>
          <div>
            <label htmlFor="quiet-end" className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('settings.quiet.until')}
            </label>
            <Input id="quiet-end" type="time" step={60} value={end} onChange={(e) => setEnd(e.target.value)} onBlur={() => commit(start, end)} className="w-32" />
          </div>
          {invalid && <p className="w-full text-xs text-destructive">{t('settings.quiet.invalid')}</p>}
        </div>
      )}
    </div>
  );
}
