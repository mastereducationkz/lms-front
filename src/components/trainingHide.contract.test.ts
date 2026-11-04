import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The staff-training recorder hides the account's name and greeting (and the banner) in recorded frames by these
// attributes (docs/training, decision D8). Renaming or dropping one silently puts names back into the videos.
const src = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('the attributes the training recorder hides', () => {
  it('marks the greeting in the top bar', () => {
    expect(src('./Topbar.tsx')).toMatch(/data-training-hide>\s*\n\s*<div[^>]*>\{t\('shell\.topbar\.welcomeBack'\)\}/);
  });
  it('marks the name and avatar in the sidebar', () => {
    const sidebar = src('./Sidebar.tsx');
    expect(sidebar.match(/data-training-hide/g)?.length).toBe(2);
  });
});
