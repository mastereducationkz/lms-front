/**
 * The unlock moment (owner, 2026-10-04), announced through the one-popup queue (lib/attention):
 * a visit opens with the full modal — the orca already wearing the most exciting reward, every new
 * unlock listed, confetti — only for a legendary unlock or a big batch (the launch grant); smaller
 * and mid-session unlocks are a toast that opens the card. The onboarding visit announces nothing:
 * it all waits for the next one. Whatever is announced is marked seen as it's shown.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTourActive } from '@/components/guide/tourStore';
import { useAuth } from '@/contexts/AuthContext';
import { parseMascot, rewardLabel } from '@/components/mascot/config';
import { onboardingPending } from '@/components/mascot/spotlight';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/Toast';
import { updateMyMascot } from '@/services/api/auth';
import {
  ACHIEVEMENTS_CHECK_EVENT,
  achievementField,
  byExcitement,
  celebrationReward,
  celebrationTitle,
  tierLabel,
  withReward,
} from '@/lib/achievements';
import { useLocale, useT } from '@/lib/i18n/react';
import { getMyAchievements, markAchievementsSeen, type MyAchievements } from '@/services/api/achievementsUi';
import { attention, celebrationMode, useAttention } from '@/lib/attention';
import { showAchievementToast } from './achievementToast';
import Confetti from './Confetti';
import RewardPreview from './RewardPreview';
import { ShareCelebrationButton } from '@/components/share/ShareButtons';
import { tierStyle } from './tierStyle';
import '@/lib/i18n/catalogs/studentHome';

/** Per page load: whether the visit's opening announcement was decided, and what's been announced. */
const openingDecided = new Set<string>();
const announced = new Map<string, Set<string>>();
const announcedFor = (uid: string) => {
  let s = announced.get(uid);
  if (!s) announced.set(uid, (s = new Set()));
  return s;
};

export default function UnlockCelebration() {
  const { user, updateUser } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tourActive = useTourActive();
  const t = useT();
  const locale = useLocale();
  const queue = useAttention(user);
  const [data, setData] = useState<MyAchievements | null>(null);
  const [saving, setSaving] = useState(false);
  // What the open modal shows (captured when it opens), and what waits for the queue's slot.
  const [modalKeys, setModalKeys] = useState<string[] | null>(null);
  const [pendingKeys, setPendingKeys] = useState<string[] | null>(null);
  const isStudent = user?.role === 'student';
  const uid = user ? String(user.id) : '';

  const load = useCallback(() => {
    getMyAchievements()
      .then(setData)
      .catch(() => {
        /* no achievements service yet, or offline — nothing to celebrate */
        attention.declare('celebration', 'none');
      });
  }, []);

  useEffect(() => {
    if (!isStudent) return undefined;
    // AppLayout remounts on every route change: only the page's first decision counts as «deciding»,
    // so the nudges waiting on the queue don't flicker on each navigation.
    if (!openingDecided.has(uid)) attention.declare('celebration', 'unknown');
    load();
    window.addEventListener(ACHIEVEMENTS_CHECK_EVENT, load);
    return () => {
      window.removeEventListener(ACHIEVEMENTS_CHECK_EVENT, load);
      attention.release('celebration');
      attention.declare('celebration', 'none');
    };
  }, [isStudent, load, uid]);

  // Never over the tour, the Assignment Zero gate or its page.
  const blocked = !user
    || tourActive
    || onboardingPending(user)
    || (!user.special_group_only_student && user.assignment_zero_completed === false)
    || pathname.startsWith('/assignment-zero');

  // Decide how the new unlocks are announced once the list arrives (and on every bell-driven reload).
  useEffect(() => {
    if (!data || !user || !isStudent || blocked || modalKeys || pendingKeys) return;
    const done = announcedFor(uid);
    const fresh = data.unseen.filter((k) => !done.has(k));
    const atVisitStart = !openingDecided.has(uid);
    openingDecided.add(uid);
    const list = data.achievements.filter((a) => fresh.includes(a.key));
    const mode = celebrationMode({
      count: fresh.length,
      legendary: list.some((a) => a.tier === 'legendary'),
      atVisitStart,
      visit: attention.visitState(),
      holder: attention.holderNow(),
    });
    if (mode === 'modal') {
      setPendingKeys(fresh);
      attention.declare('celebration', 'wants');
      return;
    }
    if (mode === 'toasts') {
      fresh.forEach((k) => done.add(k));
      markAchievementsSeen(fresh).catch(() => {});
      byExcitement(list).forEach((a) => showAchievementToast(achievementField(a, 'title', locale), () => navigate(`/achievements#${a.key}`), locale));
    }
    if (mode === 'defer') fresh.forEach((k) => done.add(k)); // kept unseen for the next visit's modal
    attention.declare('celebration', 'none');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, blocked, uid]);

  // The queue grants the slot → the modal opens, and what it shows is seen.
  const granted = queue.granted('celebration');
  useEffect(() => {
    if (!pendingKeys || !granted || modalKeys) return;
    attention.take('celebration');
    pendingKeys.forEach((k) => announcedFor(uid).add(k));
    markAchievementsSeen(pendingKeys).catch(() => {});
    setModalKeys(pendingKeys);
    setPendingKeys(null);
  }, [pendingKeys, granted, modalKeys, uid]);

  if (!user || !isStudent || !data || !modalKeys) return null;

  const fresh = modalKeys;
  const items = byExcitement(data.achievements.filter((a) => fresh.includes(a.key)));
  const pick = celebrationReward(data.achievements, fresh);
  // Only offer to wear what this build can draw — a part it doesn't know would make the saved
  // look unreadable here and fall back to the automatic orca.
  const wearable = pick !== null && parseMascot(withReward(user.mascot, user.id, pick.reward)) !== null;

  const close = (wear: boolean) => {
    setModalKeys(null);
    attention.release('celebration');
    attention.declare('celebration', 'none');
    if (wear && pick && wearable) {
      setSaving(true);
      updateMyMascot(withReward(user.mascot, user.id, pick.reward))
        .then((updated) => {
          updateUser({ ...user, mascot: updated.mascot ?? null });
          toast(t('studentHome.achievements.celebration.wearing', { part: rewardLabel(pick.reward, locale) }), 'success');
        })
        .catch((e: Error) => toast(e.message || t('studentHome.mascot.saveFailed'), 'error'))
        .finally(() => setSaving(false));
    }
  };

  return (
    <>
      <Confetti />
      <Dialog open onOpenChange={(o) => { if (!o) close(false); }}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl border-0 p-0">
          <div className="relative bg-gradient-to-br from-brand-solid via-brand-solid-hover to-blue-900 px-6 pb-6 pt-8 text-center text-white dark:from-brand-subtle dark:via-brand-surface dark:to-brand-surface dark:text-brand-surface-foreground">
            <div aria-hidden className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative mx-auto w-fit rounded-full bg-white/15 p-2 ring-4 ring-white/25">
              <RewardPreview code={user.mascot} userId={user.id} reward={pick?.reward} size={128} />
            </div>
            <DialogTitle className="relative mt-4 text-2xl font-bold text-white dark:text-brand-surface-foreground">{celebrationTitle(items.length, locale)}</DialogTitle>
            <DialogDescription className="relative mt-1 text-sm text-blue-100 dark:text-brand-subtle-foreground">
              {pick
                ? t('studentHome.achievements.celebration.newToWear', { part: rewardLabel(pick.reward, locale) })
                : t('studentHome.achievements.celebration.earned')}
            </DialogDescription>
          </div>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto px-6">
            {items.map((a) => (
              <li key={a.key} className="flex items-center gap-3 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tierStyle(a.tier).badge}`}>
                  {tierLabel(a.tier, locale)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{achievementField(a, 'title', locale)}</span>
                  {a.rewards.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">{a.rewards.map((r) => rewardLabel(r, locale)).join(' + ')}</span>
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
                className="flex-1 bg-brand-solid text-brand-solid-foreground hover:bg-brand-solid-hover"
                disabled={saving}
                onClick={() => close(true)}
              >
                {t('studentHome.achievements.celebration.wearNow')}
              </Button>
            )}
            <Button type="button" variant="outline" className={wearable ? '' : 'flex-1'} onClick={() => close(false)}>
              {wearable ? t('studentHome.achievements.celebration.later') : t('studentHome.achievements.celebration.awesome')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
