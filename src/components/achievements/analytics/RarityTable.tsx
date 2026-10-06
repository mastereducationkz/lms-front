/** Every achievement, rarest first, with the share of active students who hold it (S3). */
import { TIER_STYLE } from '@/components/achievements/tierStyle';
import type { AnalyticsAchievement } from '@/services/api/achievementsAnalytics';
import { barWidth, formatPct, tr, type Lang } from '@/lib/achievementsAnalytics';
import { TierBadge } from './parts';

export default function RarityTable({ items, lang }: { items: AnalyticsAchievement[]; lang: Lang }) {
  // Rarest first among the held ones; the nobody-yet ones get a small group of their own at the end.
  const held = items.filter((a) => a.unlocked > 0);
  const notYet = items.filter((a) => a.unlocked === 0);
  return (
    <div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">{tr(lang, 'Достижение', 'Achievement')}</th>
            <th className="pb-2 font-medium w-[38%]">{tr(lang, 'Получили', 'Earned by')}</th>
            <th className="pb-2 font-medium text-right">{tr(lang, 'Учеников', 'Students')}</th>
            <th className="pb-2 font-medium text-right">{tr(lang, '7 дн.', '7 days')}</th>
            <th className="pb-2 font-medium text-right">{tr(lang, '30 дн.', '30 days')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {held.map((a) => (
            <tr key={a.key}>
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{a.title}</span>
                  {a.secret && <span className="text-[10px] text-muted-foreground">{tr(lang, 'секретное', 'secret')}</span>}
                </div>
                <div className="mt-1"><TierBadge tier={a.tier} lang={lang} /></div>
              </td>
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-muted dark:bg-secondary">
                    <div className={`h-2 rounded-full ${(TIER_STYLE[a.tier] ?? TIER_STYLE.earned).bar}`} style={{ width: barWidth(a.pct) }} />
                  </div>
                  <span className="w-12 text-right text-xs font-semibold tabular-nums text-foreground/80">{formatPct(a.pct)}</span>
                </div>
              </td>
              <td className="py-2.5 text-right tabular-nums">{a.unlocked}</td>
              <td className="py-2.5 text-right tabular-nums text-muted-foreground">{a.last_7_days || '—'}</td>
              <td className="py-2.5 text-right tabular-nums text-muted-foreground">{a.last_30_days || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {notYet.length > 0 && (
      <div className="mt-4 rounded-xl bg-muted dark:bg-secondary/40 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {tr(lang, `Пока никто не получил · ${notYet.length}`, `Not earned yet · ${notYet.length}`)}
        </p>
        <div className="flex flex-wrap gap-2">
          {notYet.map((a) => (
            <span key={a.key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground/80">
              {a.title}
              <TierBadge tier={a.tier} lang={lang} />
            </span>
          ))}
        </div>
      </div>
    )}
    </div>
  );
}
