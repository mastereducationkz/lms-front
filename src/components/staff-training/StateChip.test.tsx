// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setActiveLocale } from '@/lib/i18n';
import StateChip from './StateChip';
import { mount, text, unmount } from './__tests__/kit';

vi.mock('@/contexts/AuthContext', async () => (await import('./__tests__/kit')).authMock('admin'));

afterEach(async () => { await unmount(); setActiveLocale('en'); });

describe('StateChip', () => {
  it('says each of the four states in words', async () => {
    const states = { done: 'Done', in_progress: 'In progress', stuck: 'Stuck', not_started: 'Not started' } as const;
    for (const [state, label] of Object.entries(states)) {
      await mount(<StateChip state={state as keyof typeof states} />);
      expect(text()).toBe(label);
      expect(document.querySelector('[data-state]')?.getAttribute('data-state')).toBe(state);
      await unmount();
    }
  });

  it('speaks Russian to a curator', async () => {
    setActiveLocale('ru');
    await mount(<StateChip state="stuck" />);
    expect(text()).toBe('Застрял');
  });

  it('falls back to "not started" for a state it does not know', async () => {
    await mount(<StateChip state={'mystery' as 'done'} />);
    expect(text()).toBe('Not started');
  });
});
