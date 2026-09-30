import { describe, expect, it } from 'vitest';
import { answerPairRequests, PAIR_REPLY, PAIR_REQUEST, requestPairSecret } from './addonPairing';

const ORIGIN = 'https://lms.test';
const H = 'h'.repeat(24);

/** Two windows that can message each other, with the origin each message comes from. */
function windows() {
  type Handler = (event: MessageEvent) => void;
  const make = (name: string) => {
    const handlers = new Set<Handler>();
    const win = {
      name,
      origin: ORIGIN,
      addEventListener: (_t: 'message', h: Handler) => handlers.add(h),
      removeEventListener: (_t: 'message', h: Handler) => handlers.delete(h),
      deliver(data: unknown, from: { origin: string } & object) {
        for (const h of [...handlers]) h({ data, origin: from.origin, source: from } as unknown as MessageEvent);
      },
      postMessage: (_d: unknown, _o: string) => {},
      count: () => handlers.size,
    };
    return win;
  };
  const panel = make('panel');
  const popup = make('popup');
  // A message posted to a window arrives only if the target origin matches that window's origin.
  panel.postMessage = (data, target) => { if (target === panel.origin) panel.deliver(data, popup); };
  popup.postMessage = (data, target) => { if (target === popup.origin) popup.deliver(data, panel); };
  return { panel, popup };
}

describe('pairing the sign-in window with its Meet panel', () => {
  it('hands the pair secret to the window the panel opened', async () => {
    const { panel, popup } = windows();
    const stop = answerPairRequests(panel, ORIGIN, H, 'pair-s3cret');
    expect(await requestPairSecret(panel, popup, ORIGIN, H)).toBe('pair-s3cret');
    stop();
    expect(panel.count()).toBe(0);
    expect(popup.count()).toBe(0);
  });

  it('answers nothing for another handoff or another origin', async () => {
    const { panel, popup } = windows();
    answerPairRequests(panel, ORIGIN, H, 'pair-s3cret');
    expect(await requestPairSecret(panel, popup, ORIGIN, 'x'.repeat(24), 20)).toBeNull();
    const replies: unknown[] = [];
    const stranger = { origin: 'https://evil.test', postMessage: (d: unknown) => replies.push(d) };
    panel.deliver({ type: PAIR_REQUEST, h: H }, stranger);
    expect(replies).toEqual([]);
  });

  it('ignores a reply that does not come from the opener', async () => {
    const { popup } = windows();
    const opener = { postMessage: () => {} };
    const pending = requestPairSecret(opener, popup, ORIGIN, H, 20);
    popup.deliver({ type: PAIR_REPLY, h: H, pair_secret: 'forged' }, { origin: ORIGIN });
    expect(await pending).toBeNull();
  });

  it('a window with no opener asks nobody', async () => {
    const { popup } = windows();
    expect(await requestPairSecret(null, popup, ORIGIN, H)).toBeNull();
  });
});
