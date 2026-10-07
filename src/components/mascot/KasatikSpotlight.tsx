/** The two «Meet your Kasatik» surfaces: a coachmark on the desktop sidebar avatar, a dashboard card on mobile. */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTourActive } from '../guide/tourStore';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import Orca from './Orca';
import { useAttention } from '../../lib/attention';
import { seedMascot } from './config';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';
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
  const tourRunning = useTourActive();
  useSyncExternalStore(subscribeSpotlight, spotlightVersion, spotlightVersion);
  const queue = useAttention(user);
  const userId = user?.id ?? '';
  const visible = !!user && shouldShowSpotlight({
    role: user.role,
    mascot: user.mascot,
    dismissed: isSpotlightDismissed(userId),
    tourActive: tourRunning || onboardingPending(user),
    assignmentZeroGate: user.role === 'student' && !user.special_group_only_student && user.assignment_zero_completed === false,
    pathname,
    // One calm popup at a time: only on a quiet visit (not the first, nothing blocking shown),
    // and once up it stays for the rest of the visit.
    nudgeAllowed: queue.firstVisitDone() && queue.nudgeAllowed('spotlight'),
  });
  useEffect(() => {
    if (visible) queue.noteNudgeShown('spotlight');
  }, [visible, queue]);
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
  const t = useT();
  return (
    <div className="flex gap-3">
      <Orca config={seedMascot(userId)} size={56} className="rounded-full shrink-0" title={t('studentHome.mascot.spotlight.yourKasatik')} />
      <div className="min-w-0">
        <p className="font-semibold text-brand-surface-foreground">{t('studentHome.mascot.spotlight.title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('studentHome.mascot.spotlight.body')}
        </p>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" className="bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground" onClick={onCustomize}>
            {t('studentHome.mascot.spotlight.customize')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onLater}>
            {t('studentHome.mascot.spotlight.later')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Wraps the desktop sidebar avatar: a soft pulsing ring plus a popover card just past the sidebar's edge. */
export function KasatikCoachmark({ children, sideOffset = 24 }: { children: ReactNode; sideOffset?: number }) {
  const t = useT();
  const { visible, userId, later, customize } = useKasatikSpotlight();
  const desktop = useIsDesktop();
  if (!visible || !desktop) return <>{children}</>;
  return (
    <Popover open>
      <PopoverAnchor asChild>
        <span className="relative inline-flex shrink-0 rounded-full">
          <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-brand opacity-60 animate-ping" />
          <span aria-hidden className="pointer-events-none absolute -inset-1 rounded-full ring-2 ring-brand" />
          {children}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={sideOffset}
        className="w-80 rounded-2xl border-blue-100 dark:border-brand-border shadow-lg"
        role="dialog"
        aria-label={t('studentHome.mascot.spotlight.label')}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={later}
        // The card is portaled, but React still bubbles its clicks to the sidebar's avatar button
        // (the dropdown toggle) — «Customize» / «Later» must not open the account menu.
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <SpotlightBody userId={String(userId)} onCustomize={customize} onLater={later} />
      </PopoverContent>
    </Popover>
  );
}

/** The mobile surface: a compact card at the top of the student dashboard (hidden on desktop). */
export function KasatikSpotlightCard({ className = '' }: { className?: string }) {
  const t = useT();
  const { visible, userId, later, customize } = useKasatikSpotlight();
  if (!visible) return null;
  return (
    <section
      aria-label={t('studentHome.mascot.spotlight.label')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') later();
      }}
      className={`lg:hidden rounded-2xl border border-blue-100 dark:border-brand-border bg-blue-50/70 dark:bg-brand-surface p-4 ${className}`}
    >
      <SpotlightBody userId={String(userId)} onCustomize={customize} onLater={later} />
    </section>
  );
}
