import { useTheme } from 'next-themes';
import { Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { THEME_OPTIONS, type ThemeChoice } from '../lib/theme';

export default function ThemeMenu() {
  const { theme = 'system', setTheme, resolvedTheme } = useTheme();
  const Current = THEME_OPTIONS.find((o) => o.value === theme)?.icon ?? THEME_OPTIONS[2].icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-9 h-9 rounded-lg bg-card border flex items-center justify-center text-muted-foreground hover:bg-muted dark:hover:text-foreground transition-colors"
          aria-label="Theme"
          title={`Theme: ${theme}${theme === 'system' && resolvedTheme ? ` (${resolvedTheme})` : ''}`}
        >
          <Current className="w-4 h-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value as ThemeChoice)} className="gap-2">
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {theme === value && <Check className="w-4 h-4 text-brand" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
