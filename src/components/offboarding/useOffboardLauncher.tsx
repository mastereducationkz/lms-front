import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOffboardingConfig } from '../../hooks/useOffboardingConfig';
import { mayOfferOffboard, refusalRoute } from '../../lib/offboarding';
import type { OffboardingRecord, TargetRef } from '../../services/api/offboarding';

// The dialogs download on first use: most visits to a staff page never open them.
const OffboardDialog = lazy(() => import('./OffboardDialog'));
const ReactivateDialog = lazy(() => import('./ReactivateDialog'));

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
  /**
   * A refusal from the old deactivate / activate paths (409 use_offboarding / use_reactivate,
   * SPEC §12 Q92) opens the right dialog instead. Returns whether it did.
   */
  handleRefusal: (error: unknown, person: OffboardCandidate) => boolean;
  /** Render once, anywhere in the page. */
  dialog: ReactNode;
}

type Open =
  | { kind: 'offboard'; ref: TargetRef; name: string }
  | { kind: 'reactivate'; lmsUserId: number; recordId: number | null; name: string };

const nameOf = (p: OffboardCandidate) => p.name || p.full_name || p.email || '';

/** Everything a page needs to offer «Offboard» (and Reactivate) on its staff rows. */
export function useOffboardLauncher(onChanged?: (record: OffboardingRecord) => void): OffboardLauncher {
  const { user } = useAuth();
  const config = useOffboardingConfig(user?.role);
  const [target, setTarget] = useState<Open | null>(null);
  const enabled = !!config?.enabled;

  const canOffboard = useCallback(
    (person: OffboardCandidate) => enabled && mayOfferOffboard(user, person),
    [enabled, user],
  );
  const open = useCallback((person: OffboardCandidate) => {
    setTarget({ kind: 'offboard', ref: { lms_user_id: Number(person.id) }, name: nameOf(person) });
  }, []);
  const openTarget = useCallback((ref: TargetRef, name: string) => setTarget({ kind: 'offboard', ref, name }), []);
  const handleRefusal = useCallback((error: unknown, person: OffboardCandidate) => {
    const route = enabled ? refusalRoute(error) : null;
    if (!route) return false;
    setTarget(route.kind === 'offboard'
      ? { kind: 'offboard', ref: { lms_user_id: Number(person.id) }, name: nameOf(person) }
      : { kind: 'reactivate', lmsUserId: Number(person.id), recordId: route.recordId, name: nameOf(person) });
    return true;
  }, [enabled]);

  const close = (isOpen: boolean) => {
    if (!isOpen) setTarget(null);
  };
  const dialog = target && config?.enabled ? (
    <Suspense fallback={null}>
      {target.kind === 'offboard' ? (
        <OffboardDialog open onOpenChange={close} target={target.ref} name={target.name} config={config} onChanged={onChanged} />
      ) : (
        <ReactivateDialog
          open
          onOpenChange={close}
          lmsUserId={target.lmsUserId}
          recordId={target.recordId}
          name={target.name}
          onChanged={onChanged}
        />
      )}
    </Suspense>
  ) : null;

  return { enabled, canOffboard, open, openTarget, handleRefusal, dialog };
}
