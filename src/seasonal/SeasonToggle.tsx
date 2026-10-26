/**
 * Settings → Appearance: switch the season's decorations on or off for this device. Shown only
 * while a season runs; the greeting's «Turn off decorations» flips the same switch.
 */
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/seasonal';
import { useSeason } from './SeasonProvider';

export function SeasonToggle() {
  const t = useT();
  const { season, enabled, setEnabled } = useSeason();
  if (!season) return null;
  const id = 'season-decorations';
  return (
    // The settings card separates its rows with a rule; this row follows it.
    <div /* taste-skill-ignore */ className="flex items-start gap-3 border-t border-border px-4 py-4 sm:px-5">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-describedby={`${id}-hint`}
        onClick={() => setEnabled(!enabled)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 flex-none items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          enabled ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        {/* The app's own switch knob, as in meetAttendance/TalkSettingsButton. */}
        <span /* taste-skill-ignore */ className={cn('inline-block h-4 w-4 rounded-full bg-card shadow transition', enabled ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </button>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-foreground">{t('seasonal.toggle.label')}</span>
        <span id={`${id}-hint`} className="block text-xs text-muted-foreground">{t('seasonal.toggle.hint')}</span>
      </label>
    </div>
  );
}
