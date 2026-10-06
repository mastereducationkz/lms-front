/**
 * Kasatik Achievements (owner, 2026-10-04): every badge a student can earn, what's closest, what's
 * new, and the Stars of the Week they've received. `/achievements#<key>` scrolls to one card.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Flame, RefreshCw, Sparkles, Star, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/mascot/UserAvatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AchievementCard, { formatUnlockDate } from '@/components/achievements/AchievementCard';
import RewardPreview from '@/components/achievements/RewardPreview';
import {
  almostThere,
  groupByCategory,
  recentlyUnlocked,
  resolveHighlight,
  starFromLabel,
  TOTAL_LABEL,
} from '@/lib/achievements';
import { getMyAchievements, type MyAchievements } from '@/services/api/achievementsUi';
import { ShareStarButton } from '@/components/share/ShareButtons';
import { CrownsSection } from '@/components/share/ShareMoments';

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AchievementsPage() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const [data, setData] = useState<MyAchievements | null>(null);
  const [failed, setFailed] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(() => {
    setFailed(false);
    getMyAchievements()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const list = useMemo(() => data?.achievements ?? [], [data]);
  const highlight = useMemo(() => resolveHighlight(list, hash), [list, hash]);

  useEffect(() => {
    if (!highlight) return;
    const el = cardRefs.current[highlight];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  if (!user) return null;
  const code = user.mascot ?? null;

  if (failed) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-gray-700 dark:text-foreground">We couldn’t load your achievements right now.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-4 @2xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const near = almostThere(list, 3);
  const recent = recentlyUnlocked(list, 4);
  const groups = groupByCategory(list);
  const stars = data.star_awards ?? [];
  const starCount = list.find((a) => a.key === 'star_of_week')?.count ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-solid via-brand-solid-hover to-blue-900 p-6 sm:p-8 text-white dark:border dark:border-brand-border dark:bg-none dark:bg-brand-surface dark:text-brand-surface-foreground">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute right-24 bottom-[-60px] h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-col items-start gap-5 @lg:flex-row @lg:items-center">
          <div className="rounded-full bg-white/15 p-1.5 ring-2 ring-white/30">
            <UserAvatar userId={user.id} name={user.name} mascot={code} isStudent size={96} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Achievements</h1>
            <p className="mt-1 text-sm text-blue-100 dark:text-muted-foreground">
              Learn, show up, keep going — every badge unlocks something new for your Kasatik.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
                <Trophy className="h-4 w-4 text-amber-300" aria-hidden /> {TOTAL_LABEL(list)} unlocked
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
                <Flame className="h-4 w-4 text-orange-300" aria-hidden /> {data.streak.current}-day streak
                <span className="font-normal text-blue-100 dark:text-muted-foreground">· best {data.streak.longest}</span>
              </span>
              {starCount > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
                  <Star className="h-4 w-4 text-yellow-300" aria-hidden /> {starCount} star{starCount === 1 ? '' : 's'} of the week
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {near.length > 0 && (
        <Section title="Almost there" icon={<Sparkles className="h-4 w-4 text-brand" aria-hidden />}>
          <div className="grid gap-4 @2xl:grid-cols-3">
            {near.map((a) => (
              <AchievementCard key={a.key} achievement={a} code={code} userId={user.id} anchor={false} />
            ))}
          </div>
        </Section>
      )}

      {recent.length > 0 && (
        <Section title="Recently unlocked" icon={<Trophy className="h-4 w-4 text-amber-500" aria-hidden />}>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recent.map((a) => (
              <Link
                key={a.key}
                to={{ hash: a.key }}
                className="flex min-w-[220px] items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-brand/50"
              >
                <RewardPreview code={code} userId={user.id} reward={a.rewards[0]} size={44} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{formatUnlockDate(a.unlocked_at)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {stars.length > 0 && (
        <Section title="Stars of the Week" icon={<Star className="h-4 w-4 text-yellow-500" aria-hidden />}>
          <ul className="grid gap-3 @lg:grid-cols-2">
            {stars.map((s, i) => (
              <li
                key={`${s.created_at}-${i}`}
                className="rounded-2xl border border-yellow-200 dark:border-yellow-900/60 bg-yellow-50/60 dark:bg-yellow-950/20 p-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  <Star className="mr-1 inline h-4 w-4 fill-yellow-400 text-yellow-500 align-[-3px]" aria-hidden />Star of the Week · <span className="font-normal text-muted-foreground">{starFromLabel(s)}</span>
                </p>
                <p className="mt-1 text-sm text-gray-700 dark:text-foreground">«{s.reason}»</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatUnlockDate(s.created_at)}</p>
                <ShareStarButton star={s} className="-ml-2.5 mt-1" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CrownsSection />

      {groups.map((g) => (
        <Section key={g.key} title={g.label} icon={<span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />}>
          <div className="grid gap-4 @lg:grid-cols-2">
            {g.items.map((a) => (
              <AchievementCard
                key={a.key}
                ref={(el) => {
                  cardRefs.current[a.key] = el;
                }}
                achievement={a}
                code={code}
                userId={user.id}
                highlighted={highlight === a.key}
              />
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
