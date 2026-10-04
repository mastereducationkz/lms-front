/**
 * The unlock moment (owner, 2026-10-04): when the student has unseen achievements — on load, or
 * when the bell's poll sees a new notice — ONE modal shows their orca already wearing the most
 * exciting reward, lists every new unlock (the launch's retro grant arrives as one batch) and
 * throws confetti. «Wear it now» saves the look; both buttons mark everything seen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNextStep } from 'nextstepjs';
import { useAuth } from '@/contexts/AuthContext';
import { parseMascot } from '@/components/mascot/config';
import { onboardingPending } from '@/components/mascot/spotlight';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/Toast';
import { updateMyMascot } from '@/services/api/auth';
import {
  ACHIEVEMENTS_CHECK_EVENT,
  byExcitement,
  celebrationReward,
  celebrationTitle,
  shouldShowCelebration,
  TIER_LABEL,
  withReward,
} from '@/lib/achievements';
import { getMyAchievements, markAchievementsSeen, type MyAchievements } from '@/services/api/achievementsUi';
import Confetti from './Confetti';
import RewardPreview from './RewardPreview';
import { ShareCelebrationButton } from '@/components/share/ShareButtons';
import { tierStyle } from './tierStyle';

export default function UnlockCelebration() {
  const { user, updateUser } = useAuth();
  const { pathname } = useLocation();
  const { isNextStepVisible } = useNextStep();
  const [data, setData] = useState<MyAchievements | null>(null);
  const [saving, setSaving] = useState(false);
  const [, rerender] = useState(0);
  const celebrated = useRef(new Set<string>());
  const isStudent = user?.role === 'student';

  const load = useCallback(() => {
    getMyAchievements()
      .then(setData)
      .catch(() => {
        /* no achievements service yet, or offline — nothing to celebrate */
      });
  }, []);

  useEffect(() => {
    if (!isStudent) return undefined;
    load();
    window.addEventListener(ACHIEVEMENTS_CHECK_EVENT, load);
    return () => window.removeEventListener(ACHIEVEMENTS_CHECK_EVENT, load);
  }, [isStudent, load]);

  if (!user || !isStudent || !data) return null;

  const fresh = data.unseen.filter((k) => !celebrated.current.has(k));

  const open = shouldShowCelebration({
    role: user.role,
    unseen: data.unseen,
    tourActive: isNextStepVisible || onboardingPending(user.id, user.onboarding_completed),
    assignmentZeroGate: !user.special_group_only_student && user.assignment_zero_completed === false,
    pathname,
    celebrated: celebrated.current,
  });
  if (!open || fresh.length === 0) return null;

  const items = byExcitement(data.achievements.filter((a) => fresh.includes(a.key)));
  const pick = celebrationReward(data.achievements, fresh);
  // Only offer to wear what this build can draw — a part it doesn't know would make the saved
  // look unreadable here and fall back to the automatic orca.
  const wearable = pick !== null && parseMascot(withReward(user.mascot, user.id, pick.reward)) !== null;

  const close = (wear: boolean) => {
    fresh.forEach((k) => celebrated.current.add(k));
    markAchievementsSeen(fresh).catch(() => {});
    if (wear && pick && wearable) {
      setSaving(true);
      updateMyMascot(withReward(user.mascot, user.id, pick.reward))
        .then((updated) => {
          updateUser({ ...user, mascot: updated.mascot ?? null });
          toast(`Your Kasatik is wearing the ${pick.reward.name}!`, 'success');
        })
        .catch((e: Error) => toast(e.message || 'Could not save your orca', 'error'))
        .finally(() => setSaving(false));
    }
    rerender((n) => n + 1);
  };

  return (
    <>
      <Confetti />
      <Dialog open onOpenChange={(o) => { if (!o) close(false); }}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl border-0 p-0">
          <div className="relative bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E3A8A] px-6 pb-6 pt-8 text-center text-white">
            <div aria-hidden className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative mx-auto w-fit rounded-full bg-white/15 p-2 ring-4 ring-white/25">
              <RewardPreview code={user.mascot} userId={user.id} reward={pick?.reward} size={128} />
            </div>
            <DialogTitle className="relative mt-4 text-2xl font-bold text-white">{celebrationTitle(items.length)}</DialogTitle>
            <DialogDescription className="relative mt-1 text-sm text-blue-100">
              {pick ? `Your Kasatik has something new to wear: the ${pick.reward.name}.` : 'Look what you’ve earned.'}
            </DialogDescription>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto px-6">
            {items.map((a) => (
              <li key={a.key} className="flex items-center gap-3 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tierStyle(a.tier).badge}`}>
                  {TIER_LABEL[a.tier] ?? a.tier}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.title}</span>
                  {a.rewards.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">{a.rewards.map((r) => r.name).join(' + ')}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t border-border px-6 py-4">
            <ShareCelebrationButton achievement={items[0]} onOpen={() => close(false)} />
            {wearable && (
              <Button
                type="button"
                className="flex-1 bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                disabled={saving}
                onClick={() => close(true)}
              >
                Wear it now
              </Button>
            )}
            <Button type="button" variant="outline" className={wearable ? '' : 'flex-1'} onClick={() => close(false)}>
              {wearable ? 'Later' : 'Awesome!'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
