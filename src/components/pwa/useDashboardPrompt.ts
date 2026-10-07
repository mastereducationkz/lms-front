import { useCallback, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAttention } from '../../lib/attention';
import { dashboardPromptAllowed } from '../../lib/dashboardPrompt';
import { useGuide } from '../guide/tourStore';
import { isSpotlightDismissed, onboardingPending, shouldShowSpotlight, spotlightVersion, subscribeSpotlight } from '../mascot/spotlight';

// Staff have no attention queue: «shown this visit» is kept per page load.
const staffShown = new Set<string>();

/** Whether a dashboard prompt may show now (lib/dashboardPrompt), and how to say it did. */
export function useDashboardPrompt(): { allowed: boolean; noteShown: () => void } {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const guide = useGuide();
  const queue = useAttention(user);
  useSyncExternalStore(subscribeSpotlight, spotlightVersion, spotlightVersion);
  const student = user?.role === 'student';
  const key = user ? String(user.id) : '';

  const noteShown = useCallback(() => {
    if (student) queue.noteNudgeShown('install');
    else if (key) staffShown.add(key);
  }, [student, queue, key]);

  if (!user) return { allowed: false, noteShown };
  const allowed = dashboardPromptAllowed({
    tourActive: guide.session !== null || guide.welcome || (student && onboardingPending(user)),
    tipOpen: guide.tip,
    spotlightFirst: shouldShowSpotlight({
      role: user.role,
      mascot: user.mascot,
      dismissed: isSpotlightDismissed(user.id),
      tourActive: false,
      assignmentZeroGate: student && !user.special_group_only_student && user.assignment_zero_completed === false,
      pathname,
    }),
    quietVisit: !student || (queue.firstVisitDone() && queue.nudgeAllowed('install')),
    shownThisVisit: student ? !!queue.visitState().nudges?.includes('install') : staffShown.has(key),
  });
  return { allowed, noteShown };
}
