/** The weekly unlocks trend and the learning-day streak histogram (S3), on recharts. */
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AchievementsAnalytics } from '@/services/api/achievementsAnalytics';
import { weekLabel } from '@/lib/achievementsAnalytics';
import { useT } from '@/lib/i18n/react';

const AXIS = { fontSize: 11, fill: 'currentColor' };
const TIP = {
  contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--popover-foreground))', fontSize: 12 },
  labelStyle: { color: 'hsl(var(--popover-foreground))' },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
  cursor: { fill: 'hsl(var(--brand) / 0.08)' },
};

export function TrendChart({ trend }: { trend: AchievementsAnalytics['trend'] }) {
  const t = useT();
  const data = trend.map((w) => ({ week: weekLabel(w.week), unlocks: w.unlocks }));
  return (
    <div className="h-56 text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip
            {...TIP}
            formatter={(v: number) => [v, t('achievements.chart.unlocks')]}
            labelFormatter={(l: string) => t('achievements.chart.weekFrom', { date: l })}
          />
          <Bar dataKey="unlocks" fill="hsl(var(--brand-solid))" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StreakHistogram({ streaks }: { streaks: AchievementsAnalytics['streaks'] }) {
  const t = useT();
  const current = t('achievements.chart.current');
  const longest = t('achievements.chart.longest');
  const data = streaks.buckets.map((b, i) => ({ bucket: b, [current]: streaks.current[i] ?? 0, [longest]: streaks.longest[i] ?? 0 }));
  return (
    <div className="h-56 text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip {...TIP} labelFormatter={(l: string) => t('achievements.chart.daysInRow', { days: l })} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey={current} fill="#F97316" radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey={longest} fill="#93C5FD" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
