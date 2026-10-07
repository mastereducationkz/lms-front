import { useEffect, useId, useState, type ReactNode } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { dismissInstallNudge, dismissPushNudge, installNudgeVisible, pushNudgeVisible, trackPwa } from '../../services/pwaInstall';
import { enablePush, usePushStatus } from '../../services/webPush';
import { useInstallFlow } from './useInstallFlow';
import { useDashboardPrompt } from './useDashboardPrompt';

const SOLID = 'bg-brand-solid text-brand-solid-foreground hover:bg-brand-solid-hover';

interface NudgeProps {
  variant: 'student' | 'teacher';
  /** Drawn at 56 px on the student card, 32 px on the teacher line. */
  art: (compact: boolean) => ReactNode;
  title: string;
  body: string;
  action: string;
  busy?: boolean;
  onAction: () => void;
  dismiss: string;
  onDismiss: () => void;
}

/** The card's two shapes: a tinted panel for students, one quiet line for teachers. */
function Nudge({ variant, art, title, body, action, busy, onAction, dismiss, onDismiss }: NudgeProps) {
  const id = useId();
  if (variant === 'teacher') {
    return (
      <section aria-label={title} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {art(true)}
          <p className="min-w-0 text-sm text-foreground">{body}</p>
        </div>
        <div className="flex flex-none items-center gap-1">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onAction}>
            {action}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={onDismiss}>
            {dismiss}
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby={id} className="@container rounded-2xl border border-brand-border bg-brand-surface p-4 text-brand-surface-foreground sm:p-5">
      <div className="flex items-start gap-4 @xl:items-center">
        {art(false)}
        <div className="min-w-0 flex-1 @xl:flex @xl:items-center @xl:gap-6">
          <div className="min-w-0 flex-1">
            <h2 id={id} className="text-base font-semibold leading-snug [text-wrap:balance]">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 opacity-80 [text-wrap:pretty]">{body}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 @xl:mt-0 @xl:flex-none">
            <Button type="button" className={`h-10 px-5 ${SOLID}`} disabled={busy} onClick={onAction}>
              {action}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 text-brand-surface-foreground/80 hover:bg-brand-subtle hover:text-brand-subtle-foreground"
              onClick={onDismiss}
            >
              {dismiss}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The app's own icon, landing on the card the way it will on a home screen. */
function AppIcon({ compact }: { compact: boolean }) {
  if (compact) return <img src="/icons/icon-96.png" alt="" width={32} height={32} className="h-8 w-8 flex-none rounded-lg ring-1 ring-border" />;
  return (
    <img
      src="/icons/icon-192.png"
      alt=""
      width={56}
      height={56}
      className="h-14 w-14 flex-none rounded-[14px] bg-white shadow-[0_8px_20px_-8px_hsl(var(--brand-solid)/0.55)] ring-1 ring-black/5 motion-safe:duration-700 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-75 motion-safe:slide-in-from-top-2"
    />
  );
}

function BellTile({ compact }: { compact: boolean }) {
  return (
    <div
      className={`flex flex-none items-center justify-center bg-card text-brand ring-1 ring-brand-border ${compact ? 'h-8 w-8 rounded-lg' : 'h-14 w-14 rounded-[14px]'}`}
    >
      <BellRing className={compact ? 'h-4 w-4' : 'h-6 w-6'} aria-hidden />
    </div>
  );
}

/**
 * The dashboard's invitation to install the app (owner, 2026-10-07), then, inside the installed
 * app, to turn on lesson reminders. Pacing in src/lib/installNudge.ts, one-at-a-time in
 * src/lib/dashboardPrompt.ts; nothing renders when neither is due.
 */
export default function InstallAppCard({ variant = 'student' }: { variant?: 'student' | 'teacher' }) {
  const { snapshot, t, start, sheet, oneTap } = useInstallFlow('dashboard');
  // One prompt at a time: the Kasatik spotlight, the tour and tips go first (lib/dashboardPrompt).
  const gate = useDashboardPrompt();
  const showInstall = gate.allowed && installNudgeVisible(snapshot);
  const pushCandidate = gate.allowed && !showInstall && pushNudgeVisible(snapshot);
  const push = usePushStatus(pushCandidate);
  const showPush = pushCandidate && push === 'default';
  const [busy, setBusy] = useState(false);
  const { noteShown } = gate;

  useEffect(() => {
    if (!showInstall) return;
    noteShown();
    trackPwa('install_prompt_shown', { surface: 'dashboard', variant, one_tap: oneTap });
  }, [showInstall, variant, oneTap, noteShown]);
  useEffect(() => {
    if (!showPush) return;
    noteShown();
    trackPwa('push_prompt_shown', { surface: 'dashboard', variant });
  }, [showPush, variant, noteShown]);

  if (showInstall) {
    const { platform } = snapshot.platform;
    const inApp = platform === 'ios-in-app' || platform === 'android-in-app';
    const computer = platform === 'desktop';
    return (
      <>
        <Nudge
          variant={variant}
          art={(compact) => <AppIcon compact={compact} />}
          title={inApp ? t.cardTitleInApp : computer ? t.cardTitleComputer : t.cardTitlePhone}
          body={variant === 'teacher' ? t.teacherLine : inApp ? t.cardBodyInApp : computer ? t.cardBodyComputer : t.cardBody}
          action={oneTap ? t.install : t.showMeHow}
          onAction={start}
          dismiss={t.notNow}
          onDismiss={() => dismissInstallNudge('dashboard')}
        />
        {sheet}
      </>
    );
  }

  if (showPush) {
    const turnOn = async () => {
      setBusy(true);
      try {
        // First await in the tap: Safari only shows the permission dialog inside the gesture.
        const status = await enablePush();
        if (status === 'granted') toast.success(t.pushOnToast);
        else if (status === 'denied') {
          toast(t.pushBlockedToast);
          dismissPushNudge();
        }
      } catch {
        toast.error(t.remindersFailed);
      } finally {
        setBusy(false);
      }
    };
    return (
      <Nudge
        variant={variant}
        art={(compact) => <BellTile compact={compact} />}
        title={t.pushTitle}
        body={variant === 'teacher' ? t.pushTitle : t.pushBody}
        action={t.turnOn}
        busy={busy}
        onAction={turnOn}
        dismiss={t.notNow}
        onDismiss={dismissPushNudge}
      />
    );
  }

  return null;
}
