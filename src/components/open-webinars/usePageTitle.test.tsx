// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePageTitle } from './usePageTitle';
import { mount, unmount } from '../../pages/publicWebinarsTestKit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Page({ title }: { title: string | null | undefined }) {
  usePageTitle(title);
  return null;
}

afterEach(async () => { await unmount(); document.title = ''; });

describe('usePageTitle', () => {
  it('names the tab after the page and brings the old title back', async () => {
    document.title = 'Master LMS';
    await mount(<Page title="Webinar: Applying to Universities in China" />);
    expect(document.title).toBe('Webinar: Applying to Universities in China · Master Education');
    await unmount();
    expect(document.title).toBe('Master LMS');
  });

  it('leaves the title alone while there is nothing to say yet (loading, missing)', async () => {
    document.title = 'Master LMS';
    await mount(<Page title="" />);
    expect(document.title).toBe('Master LMS');
    await act(async () => { /* a second, empty page changes nothing either */ });
    expect(document.title).toBe('Master LMS');
  });
});
