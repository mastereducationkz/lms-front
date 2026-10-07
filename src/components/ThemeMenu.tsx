import { useTheme } from 'next-themes';
import { Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { THEME_OPTIONS, type ThemeChoice } from '../lib/theme';
import type { MessageKey } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/chatLive';
import '@/lib/i18n/catalogs/settings';

// lib/theme's labels are English; the menu shows Settings' words for the same three choices.
const THEME_KEYS: Record<string, MessageKey> = {
  light: 'settings.appearance.light',
  dark: 'settings.appearance.dark',
  system: 'settings.appearance.system',
};

export default function ThemeMenu() {
  const t = useT();
  const { theme = 'system', setTheme, resolvedTheme } = useTheme();
  const Current = THEME_OPTIONS.find((o) => o.value === theme)?.icon ?? THEME_OPTIONS[2].icon;
  const name = (value: string) => (THEME_KEYS[value] ? t(THEME_KEYS[value]) : value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-9 h-9 rounded-lg bg-card border flex items-center justify-center text-muted-foreground hover:bg-muted dark:hover:text-foreground transition-colors"
          aria-label={t('chatLive.theme.label')}
          title={theme === 'system' && resolvedTheme
            ? t('chatLive.theme.currentResolved', { theme: name(theme), resolved: name(resolvedTheme) })
            : t('chatLive.theme.current', { theme: name(theme) })}
        >
          <Current className="w-4 h-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value as ThemeChoice)} className="gap-2">
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="flex-1">{THEME_KEYS[value] ? t(THEME_KEYS[value]) : label}</span>
            {theme === value && <Check className="w-4 h-4 text-brand" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
