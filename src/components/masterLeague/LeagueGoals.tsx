/** The six season goals as chips: gold when done, with a small count for the one that counts (the hat-trick). */
import { Check, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { goalViews } from '@/lib/leagueSeason';
import { useLocale, useT } from '@/lib/i18n/react';
import type { LeagueGoal } from '@/services/api/masterLeague';
import '@/lib/i18n/catalogs/studentHome';

export default function LeagueGoals({ goals, id }: { goals: LeagueGoal[]; id: string }) {
  const t = useT();
  const locale = useLocale();
  const views = goalViews(goals, locale);
  return (
    <div id={id} className="border-t border-white/10 px-4 pb-4 pt-3 @lg:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">{t('studentHome.league.goals.title')}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {views.map((g) => (
          <li
            key={g.key}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
              g.unlocked ? 'bg-amber-300 font-semibold text-blue-950' : 'bg-white/10 text-blue-50'
            }`}
          >
            {g.unlocked ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <Lock className="h-3 w-3 opacity-70" aria-hidden />}
            <span>{g.title}</span>
            {!g.unlocked && g.progress && (
              <span className="tabular-nums text-blue-100/80">
                {Math.min(g.progress.current, g.progress.target)}/{g.progress.target}
              </span>
            )}
            <span className="sr-only">{g.unlocked ? t('studentHome.league.goal.done') : t('studentHome.league.goal.open')}</span>
          </li>
        ))}
      </ul>
      <Link to="/achievements" className="mt-3 inline-block text-xs font-medium text-amber-200 underline-offset-2 hover:underline">
        {t('studentHome.league.goals.all')}
      </Link>
    </div>
  );
}
