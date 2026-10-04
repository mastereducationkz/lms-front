/**
 * Opens the share dialog in its own small React root, so any surface — an achievement card, the
 * unlock celebration that is closing, a list row — can launch it without hosting it. The dialog
 * and the card renderer load on first use (they pull in react-dom/server and the QR encoder).
 */
import { createRoot } from 'react-dom/client';
import type { ShareItem } from './shareItems';

let open = false;

export async function openShareDialog(item: ShareItem): Promise<void> {
  if (open) return;
  open = true;
  try {
    const { default: ShareDialog } = await import('./ShareDialog');
    const host = document.createElement('div');
    host.setAttribute('data-share-dialog', '');
    document.body.appendChild(host);
    const root = createRoot(host);
    const close = () => {
      open = false;
      // Let the dialog's closing animation finish before tearing the root down.
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      }, 200);
    };
    root.render(<ShareDialog item={item} onClose={close} />);
  } catch {
    open = false;
  }
}
