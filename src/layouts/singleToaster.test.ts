import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Two <Toaster/>s subscribe to the same sonner store, so every toast rendered (and was announced
// to screen readers) twice. The one global Toaster lives in routes/Router.tsx, inside ThemeProvider.
describe('toasts', () => {
  it('mounts exactly one Toaster, in the router', () => {
    const count = (path: string) => (readFileSync(new URL(path, import.meta.url), 'utf8').match(/<Toaster\b/g) || []).length;
    expect(count('../routes/Router.tsx')).toBe(1);
    expect(count('./AppLayout.tsx')).toBe(0);
  });
});
