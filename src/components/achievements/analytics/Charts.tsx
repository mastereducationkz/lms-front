/** The weekly unlocks trend and the learning-day streak histogram (S3), on recharts. */
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AchievementsAnalytics } from '@/services/api/achievementsAnalytics';
import { tr, weekLabel, type Lang } from '@/lib/achievementsAnalytics';

const AXIS = { fontSize: 11, fill: 'currentColor' };

export function TrendChart({ trend, lang }: { trend: AchievementsAnalytics['trend']; lang: Lang }) {
  const data = trend.map((t) => ({ week: weekLabel(t.week), unlocks: t.unlocks }));
  return (
    <div className="h-56 text-gray-500 dark:text-gray-400">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
          <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(37,99,235,0.06)' }}
            formatter={(v: number) => [v, tr(lang, 'Получено', 'Unlocks')]}
            labelFormatter={(l: string) => tr(lang, `7 дней с ${l}`, `7 days from ${l}`)}
          />
          <Bar dataKey="unlocks" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StreakHistogram({ streaks, lang }: { streaks: AchievementsAnalytics['streaks']; lang: Lang }) {
  const current = tr(lang, 'Сейчас', 'Current');
  const longest = tr(lang, 'Лучшая', 'Longest');
  const data = streaks.buckets.map((b, i) => ({ bucket: b, [current]: streaks.current[i] ?? 0, [longest]: streaks.longest[i] ?? 0 }));
  return (
    <div className="h-56 text-gray-500 dark:text-gray-400">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.25)" />
          <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(37,99,235,0.06)' }} labelFormatter={(l: string) => tr(lang, `${l} дн. подряд`, `${l} days in a row`)} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey={current} fill="#F97316" radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey={longest} fill="#93C5FD" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
