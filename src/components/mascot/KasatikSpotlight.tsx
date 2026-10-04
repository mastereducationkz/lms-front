/** The two «Meet your Kasatik» surfaces: a coachmark on the desktop sidebar avatar, a dashboard card on mobile. */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNextStep } from 'nextstepjs';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import Orca from './Orca';
import { seedMascot } from './config';
import {
  dismissSpotlight,
  isSpotlightDismissed,
  onboardingPending,
  shouldShowSpotlight,
  spotlightVersion,
  subscribeSpotlight,
} from './spotlight';

export const ORCA_SECTION_ID = 'your-orca';

function useKasatikSpotlight() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isNextStepVisible } = useNextStep();
  useSyncExternalStore(subscribeSpotlight, spotlightVersion, spotlightVersion);
  const userId = user?.id ?? '';
  const visible = !!user && shouldShowSpotlight({
    role: user.role,
    mascot: user.mascot,
    dismissed: isSpotlightDismissed(userId),
    tourActive: isNextStepVisible || onboardingPending(userId, user.onboarding_completed),
    assignmentZeroGate: user.role === 'student' && !user.special_group_only_student && user.assignment_zero_completed === false,
    pathname,
  });
  return {
    visible,
    userId,
    later: () => dismissSpotlight(userId),
    customize: () => navigate(`/profile#${ORCA_SECTION_ID}`),
  };
}

function useIsDesktop(): boolean {
  const query = '(min-width: 1024px)';
  const [desktop, setDesktop] = useState(() => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      const mq = window.matchMedia(query);
      const on = () => setDesktop(mq.matches);
      mq.addEventListener('change', on);
      return () => mq.removeEventListener('change', on);
    } catch {
      return undefined;
    }
  }, []);
  return desktop;
}

function SpotlightBody({ userId, onCustomize, onLater }: { userId: string; onCustomize: () => void; onLater: () => void }) {
  return (
    <div className="flex gap-3">
      <Orca config={seedMascot(userId)} size={56} className="rounded-full shrink-0" title="Your Kasatik" />
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white">Meet your Kasatik!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your study buddy is ready — dress it up with outfits, props and Master merch.
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={onCustomize}>
            Customize
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onLater}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Wraps the desktop sidebar avatar: a soft pulsing ring plus a popover card just past the sidebar's edge. */
export function KasatikCoachmark({ children, sideOffset = 24 }: { children: ReactNode; sideOffset?: number }) {
  const { visible, userId, later, customize } = useKasatikSpotlight();
  const desktop = useIsDesktop();
  if (!visible || !desktop) return <>{children}</>;
  return (
    <Popover open>
      <PopoverAnchor asChild>
        <span className="relative inline-flex shrink-0 rounded-full">
          <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-[#2563EB] opacity-60 animate-ping" />
          <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-[#2563EB]" />
          {children}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={sideOffset}
        className="w-80 rounded-2xl border-blue-100 dark:border-blue-900 shadow-lg"
        role="dialog"
        aria-label="Meet your Kasatik"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={later}
      >
        <SpotlightBody userId={String(userId)} onCustomize={customize} onLater={later} />
      </PopoverContent>
    </Popover>
  );
}

/** The mobile surface: a compact card at the top of the student dashboard (hidden on desktop). */
export function KasatikSpotlightCard({ className = '' }: { className?: string }) {
  const { visible, userId, later, customize } = useKasatikSpotlight();
  if (!visible) return null;
  return (
    <section
      aria-label="Meet your Kasatik"
      onKeyDown={(e) => {
        if (e.key === 'Escape') later();
      }}
      className={`lg:hidden rounded-2xl border border-blue-100 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-4 ${className}`}
    >
      <SpotlightBody userId={String(userId)} onCustomize={customize} onLater={later} />
    </section>
  );
}
