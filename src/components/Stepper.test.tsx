import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined) };
});

import Stepper from './Stepper';

const STEPS = ['Basics', 'Program', 'Materials', 'Knowledge check', 'Publishing'];

describe('Stepper', () => {
  it('fits narrow widths: labels only from a 56rem container, current step named below', () => {
    const html = renderToStaticMarkup(<Stepper steps={STEPS} current={1} />);
    expect(html).toContain('@container');
    // Every label stays readable for screen readers, visible only when the row is wide.
    expect(html.match(/sr-only @4xl:not-sr-only/g)).toHaveLength(5);
    expect(html).toContain('Step 2 of 5: Program');
    expect(html).toContain('aria-current="step"');
    // Short connectors, no 2rem margins below the breakpoint.
    expect(html).toContain('mx-2 @4xl:mx-4');
  });
});
