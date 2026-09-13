/**
 * Put an announcement back on the clipboard in both forms browsers understand.
 *
 * The composer is a textarea, so its paste operation reads the plain-text form
 * (the original Telegram HTML, including tags). Rich-text destinations receive
 * the HTML fragment instead. Keeping both means an announcement can be reused
 * without losing its formatting in either case.
 */
export async function copyAnnouncementHtml(body: string): Promise<void> {
  const clipboard = navigator.clipboard;
  if (!clipboard) throw new Error('Clipboard is unavailable');

  if (clipboard.write && typeof ClipboardItem !== 'undefined') {
    try {
      await clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([body], { type: 'text/plain' }),
          'text/html': new Blob([body.replace(/\n/g, '<br>')], { type: 'text/html' }),
        }),
      ]);
      return;
    } catch {
      // Some browsers expose ClipboardItem but deny rich writes. The raw HTML
      // is still exactly what the announcement textarea needs.
    }
  }

  await clipboard.writeText(body);
}
