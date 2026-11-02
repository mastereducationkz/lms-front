/** The Master League band on the achievements page: the season's emblem, a line about the season, how many are won. */
import { themedKey, type LeagueTheme } from '@/lib/leagueTheme';
import { useT } from '@/lib/i18n/react';
import { SeasonEmblem } from './LeagueArt';
import { leagueLook } from './leagueLook';
import '@/lib/i18n/catalogs/studentHome';

export default function LeagueSectionHeader({ unlocked, total, id, theme }: { unlocked: number; total: number; id: string; theme?: LeagueTheme }) {
  const t = useT();
  const look = leagueLook(theme);
  return (
    <div className="flex items-center gap-3 text-white">
      <SeasonEmblem look={look} size={38} />
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-lg font-extrabold leading-tight">{t('studentHome.league.section.title')}</h2>
        <p className={`text-xs ${look.muted}`}>{t(themedKey('studentHome.league.section.subtitle', theme))}</p>
      </div>
      <span className={`shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-bold tabular-nums ${look.accent} ring-1 ring-white/15`}>
        {unlocked} / {total}
      </span>
    </div>
  );
}
