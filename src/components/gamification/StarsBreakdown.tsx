import type { ReactNode } from 'react';
import {
  AlertCircle, BadgeCheck, CalendarCheck, FileUp, Flame, HeartHandshake, ListChecks, RefreshCw, Star,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import type { StarRule, StarsBreakdown as Breakdown } from '../../services/api/gamification';
import {
  barPercent, earlierLabel, isEmptyBreakdown, starRange, streakCopy,
} from '../../lib/starsBreakdown';

export type BreakdownState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: Breakdown };

const RULE_ICONS: Record<StarRule['key'], LucideIcon> = {
  homework: FileUp,
  grades: BadgeCheck,
  course_quiz: ListChecks,
  daily_questions: CalendarCheck,
  teacher_bonus: HeartHandshake,
};

/** The panel inside the star pill's popover / bottom sheet. Presentational: the pill fetches. */
export default function StarsBreakdown({
  state,
  onRetry,
  titleId,
}: {
  state: BreakdownState;
  onRetry: () => void;
  titleId: string;
}) {
  if (state.status === 'loading') return <LoadingPanel titleId={titleId} />;
  if (state.status === 'error') return <ErrorPanel titleId={titleId} onRetry={onRetry} />;
  const { data } = state;
  const empty = isEmptyBreakdown(data);

  // Two columns once the panel is wide enough (the desktop popover), one in the phone sheet.
  return (
    <div className="stars-breakdown @container flex flex-col gap-5">
      <Header titleId={titleId} empty={empty} total={data.total} />
      {empty ? (
        <>
          <RulesList rules={data.rules} twoColumn />
          <StreakPanel data={data} />
        </>
      ) : (
        <div className="grid items-start gap-5 @[34rem]:grid-cols-2 @[34rem]:gap-x-8">
          <div className="flex min-w-0 flex-col gap-5">
            <SourceBars data={data} />
            <StreakPanel data={data} />
          </div>
          <RulesList rules={data.rules} />
        </div>
      )}
    </div>
  );
}

function StarTile() {
  return (
    <span className="stars-tile flex h-10 w-10 flex-none items-center justify-center rounded-xl" aria-hidden>
      <Star className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
    </span>
  );
}

function Header({ titleId, empty, total }: { titleId: string; empty: boolean; total: number }) {
  return (
    <div className="stars-header flex items-center gap-3">
      <StarTile />
      <div className="min-w-0">
        {empty ? (
          <>
            <h2 id={titleId} className="text-base font-semibold text-foreground">Earn your first stars</h2>
            <p className="text-sm text-foreground/70">Here is everything that adds stars to your total.</p>
          </>
        ) : (
          <>
            <h2 id={titleId} className="text-foreground">
              <span className="text-2xl font-semibold tabular-nums">{total.toLocaleString('en-US')}</span>
              <span className="ml-1.5 text-base font-medium">{total === 1 ? 'star' : 'stars'}</span>
            </h2>
            <p className="text-sm text-foreground/70">Everything you have earned so far</p>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function BarRow({ label, value, percent, tone }: { label: string; value: number; percent: number; tone: string }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-foreground">{label}</span>
        <span className={`tabular-nums font-medium ${value === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
          {value.toLocaleString('en-US')}
        </span>
      </div>
      <div className="stars-track h-1.5 overflow-hidden rounded-full" aria-hidden>
        {percent > 0 && (
          <div className="stars-fill h-full rounded-full" data-tone={tone} style={{ width: `max(${percent}%, 6px)` }} />
        )}
      </div>
    </li>
  );
}

function SourceBars({ data }: { data: Breakdown }) {
  const scale = data.earlier && data.earlier > 0
    ? [...data.sources, { key: 'other' as const, label: '', stars: data.earlier }]
    : data.sources;
  return (
    <Section title="Where your stars came from">
      <ul className="flex flex-col gap-3">
        {data.sources.map((s) => (
          <BarRow key={s.key} label={s.label} value={s.stars} percent={barPercent(s.stars, scale)} tone={s.key} />
        ))}
        {data.earlier ? (
          <BarRow
            label={earlierLabel(data.earlier)}
            value={data.earlier}
            percent={barPercent(data.earlier, scale)}
            tone="other"
          />
        ) : null}
      </ul>
    </Section>
  );
}

function StreakPanel({ data }: { data: Breakdown }) {
  const copy = streakCopy(data.streak);
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-muted/60 p-3">
      <Flame
        className={`mt-0.5 h-5 w-5 flex-none ${data.streak.multiplier > 1 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-foreground tabular-nums">{copy.title}</p>
        <p className="text-sm text-foreground">{copy.status}</p>
        <p className="text-[13px] leading-snug text-foreground/70">{copy.rule}</p>
      </div>
    </div>
  );
}

function RulesList({ rules, twoColumn = false }: { rules: StarRule[]; twoColumn?: boolean }) {
  return (
    <Section title="How to earn stars">
      <ul className={`grid gap-3 ${twoColumn ? '@[34rem]:grid-cols-2 @[34rem]:gap-x-8 @[34rem]:gap-y-4' : ''}`}>
        {rules.map((rule) => {
          const Icon = RULE_ICONS[rule.key] ?? Star;
          return (
            <li key={rule.key} className="flex items-start gap-3">
              <span
                className="stars-rule-icon flex h-8 w-8 flex-none items-center justify-center rounded-lg"
                data-tone={rule.key}
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{rule.label}</span>
                  <span className="flex-none text-sm font-semibold tabular-nums text-foreground">
                    {starRange(rule.min, rule.max)}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-foreground/70">{rule.note}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function LoadingPanel({ titleId }: { titleId: string }) {
  return (
    <div className="@container flex flex-col gap-5" aria-busy="true">
      <h2 id={titleId} className="sr-only">Loading your stars</h2>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
      <div className="grid gap-5 @[34rem]:grid-cols-2 @[34rem]:gap-x-8">
        <div className="flex flex-col gap-4">
          {[72, 56, 40, 64, 28].map((w) => (
            <div key={w} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-6" />
              </div>
              <Skeleton className="h-1.5" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        <div className="hidden flex-col gap-4 @[34rem]:flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 flex-none rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({ titleId, onRetry }: { titleId: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center" role="alert">
      <AlertCircle className="h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">Couldn't load your stars</h2>
        <p className="text-sm text-foreground/70">Check your connection and try again.</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Try again
      </button>
    </div>
  );
}
