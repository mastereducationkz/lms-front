'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { THEME_COLORS } from '../lib/theme';

// Keeps the browser/PWA bar colour in step with the resolved theme.
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && resolvedTheme) meta.setAttribute('content', resolvedTheme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light);
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
