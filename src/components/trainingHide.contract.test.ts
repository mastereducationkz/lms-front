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
  it('marks the greeting of every dashboard that prints the account name', () => {
    // curator + head curator (render-library found the curator one missing), student hero, parent
    expect(src('../pages/HeadCuratorDashboard.tsx')).toMatch(/<h1 data-training-hide[^>]*>\{t\('curatorDashboard\.greeting'/);
    expect(src('../pages/ParentDashboard.tsx')).toMatch(/<h1 data-training-hide[^>]*>\{t\('parent\.dashboard\.greeting'/);
    expect(src('./dashboard/DashboardHero.tsx')).toMatch(/<CardTitle data-training-hide[^>]*>\{tr\("studentHome\.hero\.welcome"/);
  });
  it('leaves no greeting message with a {name} unmarked', () => {
    // every page/component that formats a *greeting* i18n key with the user's name carries the marker on that element
    const pages = ['../pages/HeadCuratorDashboard.tsx', '../pages/ParentDashboard.tsx', './dashboard/DashboardHero.tsx', './Topbar.tsx'];
    for (const f of pages) {
      const text = src(f);
      const keyed = text.match(/[^\n]*(greeting'|hero\.welcome|welcomeBack)[^\n]*/g) ?? [];
      for (const line of keyed) expect(line + (text.split(line)[0].slice(-200))).toContain('data-training-hide');
    }
  });
});
