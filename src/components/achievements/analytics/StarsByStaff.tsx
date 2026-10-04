/** Stars of the Week given per teacher and curator, per week (S3): shows who uses it. */
import type { AchievementsAnalytics } from '@/services/api/achievementsAnalytics';
import { staffRoleLabel, tr, weekLabel, type Lang } from '@/lib/achievementsAnalytics';
import { Empty } from './parts';

export default function StarsByStaff({ stars, lang, limit }: { stars: AchievementsAnalytics['stars']; lang: Lang; limit?: number }) {
  const rows = limit ? stars.by_staff.slice(0, limit) : stars.by_staff;
  if (!rows.length) return <Empty>{tr(lang, 'В этой выборке нет преподавателей или кураторов.', 'No teachers or curators in this view.')}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">{tr(lang, 'Сотрудник', 'Staff')}</th>
            {stars.weeks.map((w) => (
              <th key={w} className="pb-2 text-center font-medium tabular-nums">{weekLabel(w)}</th>
            ))}
            <th className="pb-2 text-right font-medium">{tr(lang, 'Всего', 'Total')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-border">
          {rows.map((s) => (
            <tr key={s.user_id}>
              <td className="py-2 pr-3">
                <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                <p className="text-xs text-muted-foreground">{staffRoleLabel(s.role, lang)}</p>
              </td>
              {s.per_week.map((n, i) => (
                <td key={stars.weeks[i] ?? i} className="py-2 text-center">
                  {n > 0 ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      ⭐{n > 1 ? `×${n}` : ''}
                    </span>
                  ) : (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-200 dark:bg-gray-700" aria-label="0" />
                  )}
                </td>
              ))}
              <td className={`py-2 text-right font-semibold tabular-nums ${s.total ? 'text-gray-900 dark:text-white' : 'text-muted-foreground'}`}>{s.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
