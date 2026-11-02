/**
 * «This could be you»: the six season goals as locked tiles and the kit that goes with them as
 * small, dimmed Kasatiks. Nothing here is earned yet; it is what the season is for. A studio season
 * shows its own goals' names and its studio look.
 */
import { useId } from 'react';
import { Lock } from 'lucide-react';
import Orca from '@/components/mascot/Orca';
import { LEAGUE_GOAL_KEYS } from '@/lib/leagueSeason';
import { withTheme, type LeagueTheme } from '@/lib/leagueTheme';
import { FOOTBALL_LOOK, type LeagueLook } from '../leagueLook';
import { useLeagueT } from '../useLeagueLocale';
import type { MessageKey } from '@/lib/i18n';
import { teaserLooks } from './teaserKit';
import '@/lib/i18n/catalogs/studentHome';

/** `idPrefix` fixes the SVG ids for a static render of several pages into one document; the page leaves it to React. */
export default function Teaser({ idPrefix, theme, look = FOOTBALL_LOOK }: { idPrefix?: string; theme?: LeagueTheme; look?: LeagueLook }) {
  const t = withTheme(useLeagueT(), theme);
  const prefix = idPrefix ?? `mlt${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const looks = teaserLooks(theme);
  return (
    <section
      aria-labelledby={`${prefix}-title`}
      className={`relative overflow-hidden rounded-3xl ${look.teaser} p-5 text-white ring-1 ring-white/10`}
    >
      <h2 id={`${prefix}-title`} className="text-xl font-extrabold leading-tight">{t('studentHome.leagueInvite.teaser.title')}</h2>
      <p className={`mt-0.5 text-sm ${look.muted}`}>{t('studentHome.leagueInvite.teaser.sub')}</p>
      <ul aria-hidden className="mt-4 grid grid-cols-6 gap-2 @lg:max-w-md @lg:gap-3">
        {looks.map((kit, i) => (
          <li key={kit.key} className="relative opacity-70 saturate-50">
            <Orca config={kit.config} size={52} idPrefix={`${prefix}k${i}`} className="h-auto w-full" title="" />
            <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ${look.theme === 'studio' ? 'bg-black/70' : 'bg-[#0B1B4D]'} ring-1 ring-amber-300/60`}>
              <Lock className={`h-2.5 w-2.5 ${look.accent}`} />
            </span>
          </li>
        ))}
      </ul>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 @lg:grid-cols-3">
        {LEAGUE_GOAL_KEYS.map((key) => (
          <li key={key} className="min-w-0 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
            <span aria-hidden className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-300/15 ${look.accent}`}>
              <Lock className="h-3 w-3" />
            </span>
            <p className="text-[13px] font-bold leading-tight">{t(`studentHome.achievement.${key}.title` as MessageKey)}</p>
            <p className={`mt-0.5 text-[11.5px] leading-snug ${look.theme === 'studio' ? look.mutedSoft : 'text-blue-100/85'}`}>{t(`studentHome.achievement.${key}.description` as MessageKey)}</p>
            <span className="sr-only">{t('studentHome.leagueInvite.teaser.locked')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
