/** The Master League band on the achievements page: crest, a line about the season, how many are won. */
import { LeagueCrestSvg } from '@/components/mascot/art/LeagueCrest';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

export default function LeagueSectionHeader({ unlocked, total, id }: { unlocked: number; total: number; id: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 text-white">
      <LeagueCrestSvg size={38} />
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-lg font-extrabold leading-tight">{t('studentHome.league.section.title')}</h2>
        <p className="text-xs text-blue-100">{t('studentHome.league.section.subtitle')}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-bold tabular-nums text-amber-300 ring-1 ring-white/15">
        {unlocked} / {total}
      </span>
    </div>
  );
}
