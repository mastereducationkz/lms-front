import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOffboardingConfig } from '../../hooks/useOffboardingConfig';
import { mayOfferOffboard } from '../../lib/offboarding';
import type { OffboardingRecord, TargetRef } from '../../services/api/offboarding';

// The dialog downloads on first use: most visits to a staff page never open it.
const OffboardDialog = lazy(() => import('./OffboardDialog'));

export interface OffboardCandidate {
  id: string | number;
  role: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
}

export interface OffboardLauncher {
  /** Offboarding is switched on for this viewer. */
  enabled: boolean;
  /** Whether to show the action on this person (the server checks again). */
  canOffboard: (person: OffboardCandidate) => boolean;
  open: (person: OffboardCandidate) => void;
  /** Open for anyone the server can look up, CRM-only staff included (the access review). */
  openTarget: (ref: TargetRef, name: string) => void;
  /** Render once, anywhere in the page. */
  dialog: ReactNode;
}

/** Everything a page needs to offer «Offboard» on its staff rows. */
export function useOffboardLauncher(onChanged?: (record: OffboardingRecord) => void): OffboardLauncher {
  const { user } = useAuth();
  const config = useOffboardingConfig(user?.role);
  const [target, setTarget] = useState<{ ref: TargetRef; name: string } | null>(null);
  const enabled = !!config?.enabled;

  const canOffboard = useCallback(
    (person: OffboardCandidate) => enabled && mayOfferOffboard(user, person),
    [enabled, user],
  );
  const open = useCallback((person: OffboardCandidate) => {
    setTarget({ ref: { lms_user_id: Number(person.id) }, name: person.name || person.full_name || person.email || '' });
  }, []);
  const openTarget = useCallback((ref: TargetRef, name: string) => setTarget({ ref, name }), []);

  const dialog = target && config?.enabled ? (
    <Suspense fallback={null}>
      <OffboardDialog
        open
        onOpenChange={(isOpen) => { if (!isOpen) setTarget(null); }}
        target={target.ref}
        name={target.name}
        config={config}
        onChanged={onChanged}
      />
    </Suspense>
  ) : null;

  return { enabled, canOffboard, open, openTarget, dialog };
}
