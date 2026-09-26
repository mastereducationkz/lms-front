import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// `services/api` (the barrel) transitively loads `services/api/client`, which
// touches `document`/`localStorage` at module scope — neither exists under
// vitest's node environment. Mock the barrel so the component can be rendered
// in isolation, the same way the repo's other unit tests avoid the DOM entirely.
vi.mock('../services/api', () => ({
  default: { revealCollegeBoardPassword: vi.fn().mockResolvedValue('super-secret-value') },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import apiClient from '../services/api';
import { CollegeBoardPasswordReveal } from './CollegeBoardPasswordReveal';

describe('CollegeBoardPasswordReveal', () => {
  it('renders the masked placeholder and never the plaintext before it is opened', () => {
    const html = renderToStaticMarkup(
      createElement(CollegeBoardPasswordReveal, { userId: 1, hasPassword: true, lang: 'en' }),
    );

    expect(html).toContain('••••••');
    expect(html).not.toContain('super-secret-value');
    expect(apiClient.revealCollegeBoardPassword).not.toHaveBeenCalled();
  });

  it('renders a dash placeholder and no reveal control when no password is stored', () => {
    const html = renderToStaticMarkup(
      createElement(CollegeBoardPasswordReveal, { userId: 1, hasPassword: false, lang: 'en' }),
    );

    expect(html).toContain('—');
    expect(html).not.toContain('••••••');
  });

  it('renders the Russian label by default', () => {
    const html = renderToStaticMarkup(
      createElement(CollegeBoardPasswordReveal, { userId: 1, hasPassword: true }),
    );

    expect(html).toContain('Показать');
  });
});
