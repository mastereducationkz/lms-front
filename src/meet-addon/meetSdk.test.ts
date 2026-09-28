import { beforeEach, describe, expect, it, vi } from 'vitest';

// The SDK is mocked at the module boundary: tests never load Google's bundle.
const createAddonSession = vi.fn();
vi.mock('@googleworkspace/meet-addons/meet.addons', () => ({
  meet: { addon: { createAddonSession: (...args: unknown[]) => createAddonSession(...args) } },
}));

import { normaliseMeetingCode, resolveMeeting } from './meetSdk';

function inMeet(code: string) {
  createAddonSession.mockResolvedValue({
    createSidePanelClient: async () => ({ getMeetingInfo: async () => ({ meetingId: 'spaces/x', meetingCode: code }) }),
  });
}

beforeEach(() => { createAddonSession.mockReset(); });

describe('resolveMeeting', () => {
  it('inside Meet: starts the SDK session with the project number and reads the meeting code', async () => {
    inMeet('abc-defg-hij');
    const found = await resolveMeeting({ projectNumber: '123456', search: '', framed: true });
    expect(found).toEqual({ kind: 'meet', meetingCode: 'abc-defg-hij' });
    expect(createAddonSession).toHaveBeenCalledWith({ cloudProjectNumber: '123456' });
  });

  it('Meet wins over a meetingCode in the URL', async () => {
    inMeet('abc-defg-hij');
    const found = await resolveMeeting({ projectNumber: '1', search: '?meetingCode=zzz-zzzz-zzz', framed: true });
    expect(found).toEqual({ kind: 'meet', meetingCode: 'abc-defg-hij' });
  });

  it('preview: a normal tab with ?meetingCode never touches the SDK', async () => {
    const found = await resolveMeeting({ projectNumber: '1', search: '?meetingCode=ABC-DEFG-HIJ', framed: false });
    expect(found).toEqual({ kind: 'preview', meetingCode: 'abc-defg-hij' });
    expect(createAddonSession).not.toHaveBeenCalled();
  });

  it('outside: a normal tab without a code explains where the panel belongs', async () => {
    expect(await resolveMeeting({ projectNumber: '1', search: '?meetingCode=nonsense', framed: false })).toEqual({ kind: 'outside' });
  });

  it('framed without a project number: unavailable, or preview when a code is given', async () => {
    expect(await resolveMeeting({ projectNumber: '', search: '', framed: true })).toMatchObject({ kind: 'unavailable' });
    expect(await resolveMeeting({ projectNumber: '', search: '?meetingCode=abc-defg-hij', framed: true }))
      .toEqual({ kind: 'preview', meetingCode: 'abc-defg-hij' });
    expect(createAddonSession).not.toHaveBeenCalled();
  });

  it('an SDK that fails is reported, not thrown', async () => {
    createAddonSession.mockRejectedValue(new Error('Not running inside Meet'));
    expect(await resolveMeeting({ projectNumber: '1', search: '', framed: true }))
      .toEqual({ kind: 'unavailable', reason: 'Not running inside Meet' });
  });

  it('an SDK that never answers gives up before Meet does', async () => {
    createAddonSession.mockReturnValue(new Promise(() => {}));
    const found = await resolveMeeting({ projectNumber: '1', search: '', framed: true, timeoutMs: 20 });
    expect(found).toMatchObject({ kind: 'unavailable' });
  });

  it('a malformed meeting code from Meet is not trusted', async () => {
    inMeet('not a code');
    expect(await resolveMeeting({ projectNumber: '1', search: '', framed: true })).toMatchObject({ kind: 'unavailable' });
  });
});

describe('normaliseMeetingCode', () => {
  it.each([
    ['abc-defg-hij', 'abc-defg-hij'],
    [' ABC-DEFG-HIJ ', 'abc-defg-hij'],
    ['abc-def-hij', null],
    ['https://meet.google.com/abc-defg-hij', null],
    [null, null],
  ])('%s → %s', (input, expected) => {
    expect(normaliseMeetingCode(input)).toBe(expected);
  });
});
