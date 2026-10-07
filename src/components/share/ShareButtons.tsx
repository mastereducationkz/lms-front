/**
 * The «Share» entries (SH1). Each renders nothing unless the signed-in user is a student looking
 * at something they earned — so the same card can show on a staff screen without a Share button.
 */
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { achievementField } from '@/lib/achievements';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';
import type { Achievement, StarAward } from '@/services/api/achievementsUi';
import type { Crown } from '@/services/api/shares';
import { openShareDialog } from './openShare';
import { achievementItem, crownItem, starItem, type ShareItem, type ShareUser } from './shareItems';

function useStudent(): ShareUser | null {
  const { user } = useAuth();
  return user && user.role === 'student' ? (user as ShareUser) : null;
}

function ShareEntryButton({ label, build, onOpen, className = '' }: {
  label?: string;
  build: () => ShareItem | null;
  onOpen?: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-8 gap-1.5 px-2.5 text-brand hover:bg-brand-surface hover:text-brand-subtle-foreground ${className}`}
      onClick={() => {
        const item = build();
        if (!item) return;
        onOpen?.();
        void openShareDialog(item);
      }}
    >
      <Share2 className="h-4 w-4" aria-hidden /> {label ?? t('studentHome.share.share')}
    </Button>
  );
}

/** On an unlocked achievement card (the student's own page only). */
export function ShareAchievementButton({ achievement, className }: { achievement: Achievement; className?: string }) {
  const student = useStudent();
  if (!student || !achievement.unlocked) return null;
  return <ShareEntryButton className={className} build={() => achievementItem(achievement, student)} />;
}

/** In the unlock celebration: shares the most exciting new achievement, closing the celebration first. */
export function ShareCelebrationButton({ achievement, onOpen }: { achievement: Achievement | undefined; onOpen: () => void }) {
  const student = useStudent();
  const t = useT();
  if (!student || !achievement?.unlocked) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={t('studentHome.share.shareAchievement', { title: achievementField(achievement, 'title') })}
      title={t('studentHome.share.toStory')}
      onClick={() => {
        const item = achievementItem(achievement, student);
        if (!item) return;
        onOpen();
        void openShareDialog(item);
      }}
    >
      <Share2 className="h-4 w-4" aria-hidden />
    </Button>
  );
}

export function ShareStarButton({ star, className }: { star: StarAward; className?: string }) {
  const student = useStudent();
  if (!student || star.id == null) return null;
  return <ShareEntryButton className={className} build={() => starItem(star, student)} />;
}

export function ShareCrownButton({ crown, className }: { crown: Crown; className?: string }) {
  const student = useStudent();
  if (!student) return null;
  return <ShareEntryButton className={className} build={() => crownItem(crown, student)} />;
}
