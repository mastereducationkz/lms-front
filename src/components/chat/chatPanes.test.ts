import { describe, expect, it } from 'vitest';
import { chatPaneClasses } from './chatPanes';

describe('chatPaneClasses', () => {
  it('shows only the thread list on phones while no chat is open', () => {
    const c = chatPaneClasses(false);
    expect(c.list).toBe('flex');
    expect(c.conversation).toBe('hidden lg:flex');
    expect(c.back).toBe('hidden');
  });

  it('shows only the conversation and a back button on phones once a chat is open', () => {
    const c = chatPaneClasses(true);
    expect(c.list).toBe('hidden lg:flex');
    expect(c.conversation).toBe('flex');
    expect(c.back).toBe('lg:hidden');
  });

  it('always shows both cards from lg up', () => {
    for (const open of [false, true]) {
      const c = chatPaneClasses(open);
      expect(c.list).toMatch(/(^| )(lg:)?flex$/);
      expect(c.conversation).toMatch(/(^| )(lg:)?flex$/);
    }
  });
});
