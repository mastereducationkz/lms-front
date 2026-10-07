import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined) };
});

import { ThemeProvider } from './ThemeProvider';
import ThemeMenu from './ThemeMenu';
import { THEME_PROVIDER_PROPS } from '../lib/theme';

describe('ThemeMenu', () => {
  it('renders an accessible trigger of the same size as before', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider {...THEME_PROVIDER_PROPS}>
        <ThemeMenu />
      </ThemeProvider>,
    );
    expect(html).toContain('aria-label="Theme"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('w-9 h-9');
  });
});
