import { useTheme } from 'next-themes';
import { Check } from 'lucide-react';
import type { ThemeChoice } from '../../lib/theme';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { SettingsSection } from './SettingsSection';

// Each theme drawn as a small window in its own colours (the app's light and dark tokens), so the
// choice reads at a glance. These are illustrations of the themes, not UI colours of this page.
const PALETTE = {
  light: { bg: '#ffffff', bar: '#f4f4f5', line: '#e4e4e7', accent: '#2563eb' },
  dark: { bg: '#121317', bar: '#1a1c20', line: '#2e3138', accent: '#60a5fa' },
} as const;

function Window({ theme }: { theme: 'light' | 'dark' }) {
  const p = PALETTE[theme];
  return (
    <div className="h-full w-full p-2" style={{ background: p.bg }}>
      <div className="mb-2 h-2 w-full rounded-sm" style={{ background: p.bar }} />
      <div className="mb-1.5 h-1.5 w-3/4 rounded-full" style={{ background: p.line }} />
      <div className="mb-1.5 h-1.5 w-1/2 rounded-full" style={{ background: p.line }} />
      <div className="mt-2.5 h-2.5 w-8 rounded-sm" style={{ background: p.accent }} />
    </div>
  );
}

function Preview({ choice }: { choice: ThemeChoice }) {
  if (choice !== 'system') return <Window theme={choice} />;
  return (
    <div className="relative h-full w-full">
      <Window theme="light" />
      <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
        <Window theme="dark" />
      </div>
    </div>
  );
}

/** Theme for this device: System (the default since #131), Light or Dark. */
export default function AppearanceSection() {
  const t = useT();
  const { theme = 'system', setTheme } = useTheme();
  const options: { value: ThemeChoice; label: string; hint?: string }[] = [
    { value: 'system', label: t('settings.appearance.system'), hint: t('settings.appearance.systemHint') },
    { value: 'light', label: t('settings.appearance.light') },
    { value: 'dark', label: t('settings.appearance.dark') },
  ];
  return (
    <SettingsSection id="appearance" title={t('settings.appearance.title')} description={t('settings.appearance.description')}>
      <div role="radiogroup" aria-label={t('settings.appearance.title')} className="grid grid-cols-3 gap-3 p-4 sm:p-5">
        {options.map((o) => {
          const active = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(o.value)}
              className="group min-w-0 rounded-xl text-left focus-visible:outline-none"
            >
              <div
                className={`relative aspect-[4/3] overflow-hidden rounded-lg border transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring ${
                  active ? 'border-brand ring-2 ring-brand/40' : 'border-border group-hover:border-muted-foreground/40'
                }`}
              >
                <Preview choice={o.value} />
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-solid text-brand-solid-foreground shadow-sm">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </div>
              <div className="mt-2 truncate text-sm font-medium text-foreground">{o.label}</div>
              {o.hint && <div className="truncate text-xs text-muted-foreground">{o.hint}</div>}
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
