import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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
