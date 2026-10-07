/**
 * The platform tour and the one-time page tips (owner, 2026-10-07). nextstepjs is gone: its cards
 * landed off-screen and its overlay froze the page until a reload. This decides who sees what and
 * when, remembers it on the server (lib/guide/state), and mounts the layers that draw it.
 *
 * - Students, teachers and curators get their tour once, by itself, on the dashboard (students after
 *   Assignment Zero). Head teachers, head curators, admins and parents never get one by itself, and
 *   never the welcome screens.
 * - Done, Skip, Close or Escape mark it seen on every device. Leaving the page, the back button or a
 *   reload never do: an unfinished tour resumes where it was, next time on the dashboard.
 * - «Replay tour» (the menu under the name, Settings) runs it again for the roles that have one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import WelcomeScreens from './WelcomeScreens';
import UserAvatar from './mascot/UserAvatar';
import { attention } from '../lib/attention';
import {
  NO_LOCAL_MARKS,
  TOUR_VERSION,
  assignmentZeroGate,
  autoTourFor,
  marksToSync,
  readUiState,
  replayTourFor,
  shouldAutoStartTour,
  shouldShowWelcome,
  tipDismissed,
  withTipDismissed,
  withTourSeen,
  type LocalMarks,
  type TourKind,
  type UiState,
} from '../lib/guide/state';
import { readLocalMarks, readTourProgress, writeLocalMarks, writeTourProgress } from '../lib/guide/storage';
import { dismissTip as postTipDismissed, markTourSeen as postTourSeen } from '../services/api/uiState';
import type { User } from '../types';
import TourLayer from './guide/TourLayer';
import TipsLayer from './guide/TipsLayer';
import { TOURS } from './guide/tours';
import { tourStore, useGuide, type TourOrigin } from './guide/tourStore';

export default function OnboardingManager({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const { pathname } = useLocation();
  const guide = useGuide();
  const userRef = useRef<User | null>(user);
  userRef.current = user;
  // AuthContext hands out a new updateUser on every render: read it through a ref so the callbacks
  // below (and the effects that use them) stay put.
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;
  const uid = user?.id ?? null;
  const [marks, setMarks] = useState<LocalMarks>(NO_LOCAL_MARKS);
  useEffect(() => setMarks(uid !== null ? readLocalMarks(uid) : NO_LOCAL_MARKS), [uid]);
  const server = useMemo(() => readUiState(user?.ui_state), [user?.ui_state]);
  const welcomedFor = useRef<string | number | null>(null);

  const saveMarks = useCallback((userId: string | number, next: LocalMarks) => {
    writeLocalMarks(userId, next);
    setMarks(next);
  }, []);

  const setUiState = useCallback((state: UiState, extra?: Partial<User>) => {
    const current = userRef.current;
    if (!current) return;
    const next = { ...current, ...extra, ui_state: state };
    userRef.current = next;
    updateUserRef.current(next);
  }, []);

  /** The server answered: its state is the truth, and the local marks it now holds can go. */
  const confirm = useCallback((state: UiState) => {
    const current = userRef.current;
    if (!current) return;
    setUiState(state);
    const local = readLocalMarks(current.id);
    saveMarks(current.id, {
      tourVersion: local.tourVersion > state.tour_version_seen ? local.tourVersion : 0,
      tips: local.tips.filter((key) => !state.tips[key]),
    });
  }, [setUiState, saveMarks]);

  // What this device marked and the server never got (offline, a failed request): sent again.
  const serverKnown = server !== null;
  useEffect(() => {
    if (uid === null || !serverKnown) return;
    const todo = marksToSync(readUiState(userRef.current?.ui_state), readLocalMarks(uid));
    if (todo.tourVersion) postTourSeen(todo.tourVersion).then(confirm).catch(() => undefined);
    for (const key of todo.tips) postTipDismissed(key).then(confirm).catch(() => undefined);
  }, [uid, serverKnown, confirm]);

  const markTourSeen = useCallback(() => {
    const current = userRef.current;
    if (!current) return;
    const local = readLocalMarks(current.id);
    saveMarks(current.id, { ...local, tourVersion: Math.max(local.tourVersion, TOUR_VERSION) });
    setUiState(withTourSeen(readUiState(current.ui_state)), { onboarding_completed: true });
    postTourSeen(TOUR_VERSION).then(confirm).catch(() => undefined);
  }, [saveMarks, setUiState, confirm]);

  const dismissTip = useCallback((key: string) => {
    const current = userRef.current;
    if (!current) return;
    const local = readLocalMarks(current.id);
    if (!local.tips.includes(key)) saveMarks(current.id, { ...local, tips: [...local.tips, key] });
    setUiState(withTipDismissed(readUiState(current.ui_state), key));
    postTipDismissed(key).then(confirm).catch(() => undefined);
  }, [saveMarks, setUiState, confirm]);

  const holdQueueForTour = useCallback((current: User) => {
    // One calm popup at a time: the visit the tour runs in shows nothing else.
    if (current.role !== 'student') return;
    attention.begin(current.id, true);
    attention.markOnboardingVisit();
    attention.declare('onboarding', 'wants');
    attention.take('onboarding');
  }, []);

  const start = useCallback((kind: TourKind, origin: TourOrigin, stepId: string) => {
    const current = userRef.current;
    if (!current) return;
    if (origin === 'auto') holdQueueForTour(current);
    tourStore.start({ kind, origin, stepId, path: '/dashboard' });
    writeTourProgress(current.id, { kind, stepId, origin });
  }, [holdQueueForTour]);

  const goTo = useCallback((stepId: string) => {
    const session = tourStore.get().session;
    const current = userRef.current;
    if (!session || !current) return;
    tourStore.goTo(stepId);
    writeTourProgress(current.id, { kind: session.kind, stepId, origin: session.origin });
  }, []);

  const end = useCallback(() => {
    const current = userRef.current;
    // Seen first, then gone: nothing may see «no tour running, still owed» in between.
    if (current) {
      writeTourProgress(current.id, null);
      markTourSeen();
    }
    tourStore.stop();
    if (current?.role === 'student') {
      attention.release('onboarding');
      attention.declare('onboarding', 'none');
    }
  }, [markTourSeen]);

  // Leaving the page (a link, the back button) pauses an automatic tour and drops a replay — neither
  // counts as seen. The welcome screens give way too.
  useEffect(() => {
    const { session, welcome } = tourStore.get();
    if (welcome && pathname !== '/dashboard') tourStore.setWelcome(false);
    if (!session || pathname === session.path) return;
    tourStore.stop();
    if (session.origin === 'replay' && uid !== null) writeTourProgress(uid, null);
  }, [pathname, uid]);

  // On the dashboard: a replay that was asked for, a tour this tab already started, or a new one.
  useEffect(() => {
    if (!user || pathname !== '/dashboard' || guide.session || guide.welcome) return;
    if (guide.replayRequested) {
      tourStore.clearReplay();
      const kind = replayTourFor(user.role);
      if (kind) start(kind, 'replay', TOURS[kind].steps[0].id);
      return;
    }
    const progress = readTourProgress(user.id);
    const owed = shouldAutoStartTour(user, pathname, marks);
    if (progress && progress.kind === replayTourFor(user.role) && (progress.origin === 'replay' || owed)) {
      start(progress.kind, progress.origin, progress.stepId);
      return;
    }
    const kind = autoTourFor(user.role);
    if (!owed || !kind) return;
    if (welcomedFor.current !== user.id && shouldShowWelcome(user, false)) {
      welcomedFor.current = user.id;
      holdQueueForTour(user);
      tourStore.setWelcome(true);
      return;
    }
    start(kind, 'auto', TOURS[kind].steps[0].id);
  }, [user, pathname, guide.session, guide.welcome, guide.replayRequested, marks, start, holdQueueForTour]);

  const isDismissed = useCallback((key: string) => tipDismissed(key, server, marks), [server, marks]);
  const finishWelcome = useCallback(() => tourStore.setWelcome(false), []);
  const session = guide.session;

  return (
    <>
      {children}
      {guide.welcome && user && (
        <WelcomeScreens userName={user.full_name || user.name || ''} userRole={user.role} onComplete={finishWelcome} />
      )}
      {session && user && (
        <TourLayer
          key={`${session.kind}:${session.origin}`}
          tour={TOURS[session.kind]}
          stepId={session.stepId}
          welcomeLeading={
            <UserAvatar userId={user.id} name={user.name} avatarUrl={user.avatar_url} mascot={user.mascot} isStudent={user.role === 'student'} size={40} />
          }
          onGoTo={goTo}
          onEnd={end}
        />
      )}
      {user && server && (
        <TipsLayer
          role={user.role}
          pathname={pathname}
          busy={session !== null || guide.welcome || assignmentZeroGate(user)}
          dismissed={isDismissed}
          onDismiss={dismissTip}
        />
      )}
    </>
  );
}
