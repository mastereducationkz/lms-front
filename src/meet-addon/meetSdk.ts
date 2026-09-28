import { meet } from '@googleworkspace/meet-addons/meet.addons';

/**
 * Where the panel is running, and for which meeting.
 *
 * - `meet`: inside Google Meet's side panel. The SDK session is what tells Meet the panel has
 *   loaded (Meet gives up after 10 seconds), and it names the meeting.
 * - `preview`: outside Meet, with `?meetingCode=aaa-bbbb-ccc` in the URL — for checking the panel
 *   in a normal tab.
 * - `unavailable`: in a frame, but Meet did not answer (no project number, or the SDK failed).
 * - `outside`: a normal tab with no meeting code: the panel only explains where it belongs.
 */
export type MeetingSource =
  | { kind: 'meet'; meetingCode: string }
  | { kind: 'preview'; meetingCode: string }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'outside' };

const MEET_CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export function normaliseMeetingCode(code: string | null | undefined): string | null {
  const value = (code ?? '').trim().toLowerCase();
  return MEET_CODE.test(value) ? value : null;
}

interface SdkLike {
  addon: {
    createAddonSession(options: { cloudProjectNumber: string }): Promise<{
      createSidePanelClient(): Promise<{ getMeetingInfo(): Promise<{ meetingCode: string }> }>;
    }>;
  };
}

export interface ResolveOptions {
  projectNumber: string;
  /** `window.location.search` */
  search: string;
  /** Running in a frame (Meet always frames the panel). */
  framed: boolean;
  sdk?: SdkLike;
  /** Give up on Meet after this long; its own deadline is 10 s. */
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Meet did not answer in time')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function resolveMeeting(options: ResolveOptions): Promise<MeetingSource> {
  const preview = normaliseMeetingCode(new URLSearchParams(options.search).get('meetingCode'));
  let reason = 'This panel was opened outside Google Meet.';
  if (options.framed && options.projectNumber) {
    try {
      const sdk = options.sdk ?? (meet as unknown as SdkLike);
      const code = await withTimeout((async () => {
        const session = await sdk.addon.createAddonSession({ cloudProjectNumber: options.projectNumber });
        const sidePanel = await session.createSidePanelClient();
        const info = await sidePanel.getMeetingInfo();
        return info.meetingCode;
      })(), options.timeoutMs ?? 8000);
      const meetingCode = normaliseMeetingCode(code);
      if (meetingCode) return { kind: 'meet', meetingCode };
      reason = 'Meet did not say which meeting this is.';
    } catch (error) {
      reason = error instanceof Error && error.message ? error.message : 'Meet did not answer.';
    }
  } else if (options.framed) {
    reason = 'The add-on is not configured yet (no Cloud project number).';
  }
  if (preview) return { kind: 'preview', meetingCode: preview };
  return options.framed ? { kind: 'unavailable', reason } : { kind: 'outside' };
}

export function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // a cross-origin parent that refuses even the comparison is still a parent
  }
}
