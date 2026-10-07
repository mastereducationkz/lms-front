import { useState, type ReactNode } from 'react';
import { useLocale } from '../../lib/i18n/react';
import { markInstalledByHand, promptInstall, trackPwa, usePwaInstall, type InstallSurface, type PwaInstallSnapshot } from '../../services/pwaInstall';
import InstallSheet, { sheetKindFor } from './InstallSheet';
import { installCopy, type InstallCopy } from './installCopy';

export interface InstallFlow {
  snapshot: PwaInstallSnapshot;
  t: InstallCopy;
  /** The browser's own one-tap dialog is ready. */
  oneTap: boolean;
  /** Tap handler: the native prompt when there is one, else the instructions sheet. */
  start: () => void;
  /** Render this somewhere in the tree; it's the (closed) instructions sheet. */
  sheet: ReactNode;
}

/** One install action for every surface (dashboard card, Settings): prompt or instructions. */
export function useInstallFlow(surface: InstallSurface): InstallFlow {
  const snapshot = usePwaInstall();
  const t = installCopy(useLocale());
  const [open, setOpen] = useState(false);
  const kind = snapshot.canPrompt ? null : sheetKindFor(snapshot.platform);

  const start = () => {
    if (snapshot.canPrompt) {
      void promptInstall(surface);
      return;
    }
    if (!kind) return;
    trackPwa('install_sheet_opened', { surface, kind });
    setOpen(true);
  };

  const sheet = kind ? (
    <InstallSheet kind={kind} platform={snapshot.platform} t={t} open={open} onOpenChange={setOpen} onMarkedInstalled={markInstalledByHand} />
  ) : null;

  return { snapshot, t, oneTap: snapshot.canPrompt, start, sheet };
}
