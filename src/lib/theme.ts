import { Monitor, Moon, Sun } from 'lucide-react';

export type ThemeChoice = 'light' | 'dark' | 'system';

// next-themes stores the pick under localStorage "theme"; nothing stored means "system".
export const THEME_PROVIDER_PROPS = {
  attribute: 'class',
  defaultTheme: 'system',
  enableSystem: true,
  disableTransitionOnChange: true,
} as const;

export const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export const THEME_COLORS = { light: '#ffffff', dark: '#0f172a' } as const;

/** Whether a stored choice (or none) renders dark, given the device's setting. */
export function isDarkChoice(saved: string | null | undefined, systemDark: boolean): boolean {
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return systemDark;
}
