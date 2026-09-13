import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyAnnouncementHtml } from './announcementClipboard';

const originalNavigator = globalThis.navigator;

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: originalNavigator,
  });
});

describe('copyAnnouncementHtml', () => {
  it('copies the original Telegram HTML for pasting into the announcement composer', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText } },
    });

    await copyAnnouncementHtml('<b>Important</b>\nRead <a href="https://example.com">this</a>.');

    expect(writeText).toHaveBeenCalledWith(
      '<b>Important</b>\nRead <a href="https://example.com">this</a>.',
    );
  });
});
