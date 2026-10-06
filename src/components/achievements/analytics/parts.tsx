/** Small shared pieces of the staff achievements analytics (owner, 2026-10-04). */
import type { ReactNode } from 'react';
import type { AchievementTier } from '@/services/api/achievementsUi';
import { TIER_STYLE } from '@/components/achievements/tierStyle';
import UserAvatar from '@/components/mascot/UserAvatar';
import type { AnalyticsPerson } from '@/services/api/achievementsAnalytics';
import { tr, type Lang } from '@/lib/achievementsAnalytics';

const TIER_LABEL: Record<AchievementTier, [string, string]> = {
  earned: ['Базовое', 'Earned'],
  rare: ['Редкое', 'Rare'],
  legendary: ['Легендарное', 'Legendary'],
  social: ['Социальное', 'Social'],
  seasonal: ['Сезонное', 'Seasonal'],
};

export function TierBadge({ tier, lang }: { tier: AchievementTier; lang: Lang }) {
  const style = TIER_STYLE[tier] ?? TIER_STYLE.earned;
  const [ru, en] = TIER_LABEL[tier] ?? TIER_LABEL.earned;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}>
      {tr(lang, ru, en)}
    </span>
  );
}

export function Section({ title, subtitle, action, children, className = '' }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card dark:bg-card p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, accent = 'text-foreground' }: {
  label: string; value: ReactNode; hint?: ReactNode; accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card dark:bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A student with their orca, name and count — the staff-only "top earners" row (S4). */
export function PersonRow({ person, rank, lang, sub }: { person: AnalyticsPerson; rank?: number; lang: Lang; sub?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {rank !== undefined && <span className="w-5 text-right text-xs font-semibold text-muted-foreground tabular-nums">{rank}</span>}
      <UserAvatar userId={person.id} name={person.name} avatarUrl={person.avatar_url} mascot={person.mascot} isStudent size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {person.count}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{tr(lang, 'дост.', person.count === 1 ? 'badge' : 'badges')}</span>
      </span>
    </div>
  );
}

export function OrcaStack({ people, size = 28, max = 3 }: { people: AnalyticsPerson[]; size?: number; max?: number }) {
  return (
    <div className="flex -space-x-2">
      {people.slice(0, max).map((p) => (
        <span key={p.id} title={`${p.name} · ${p.count}`} className="rounded-full ring-2 ring-white dark:ring-card">
          <UserAvatar userId={p.id} name={p.name} avatarUrl={p.avatar_url} mascot={p.mascot} isStudent size={size} />
        </span>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
