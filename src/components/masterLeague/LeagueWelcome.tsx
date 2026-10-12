/**
 * The welcome moment (owner, 2026-10-13): what a student sees once when «Signed to the League»
 * lands. It goes through the same one-popup queue as every other celebration (UnlockCelebration
 * decides when it opens and marks the unlocks seen); this is only the picture and the two choices.
 * Navy and gold, slow rays behind Kasatik in the kit, the crest on its shoulder, then the squad, the
 * Final's date and the matchday count. «Put on the kit» saves jersey + crest in ONE look.
 */
import { useEffect, useState, type ElementType } from 'react';
import { Check } from 'lucide-react';
import Confetti from '@/components/achievements/Confetti';
import Orca from '@/components/mascot/Orca';
import { LeagueCrestSvg } from '@/components/mascot/art/LeagueCrest';
import { leagueKitConfig } from '@/components/mascot/leagueKit';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { achievementField } from '@/lib/achievements';
import { groupTail } from '@/lib/leagueSeason';
import { formatDate } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import type { Achievement } from '@/services/api/achievementsUi';
import { getMyLeague, type MyLeague } from '@/services/api/masterLeague';
import '@/lib/i18n/catalogs/studentHome';

const CONFETTI = ['#F7C948', '#FFE07A', '#2563EB', '#5B8DFF', '#FFFFFF'];

const CSS = `
.ml-rays{position:absolute;left:50%;top:40%;width:170%;aspect-ratio:1;transform:translate(-50%,-50%);
  background:repeating-conic-gradient(from 0deg,rgba(247,201,72,.2) 0 6deg,transparent 6deg 16deg);
  -webkit-mask-image:radial-gradient(circle,#000 0,transparent 60%);mask-image:radial-gradient(circle,#000 0,transparent 60%);
  animation:ml-spin 60s linear infinite}
@keyframes ml-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes ml-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.ml-bob{animation:ml-bob 3.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ml-rays,.ml-bob{animation:none}}
`;

interface SceneProps {
  /** Every unlock announced now; «Signed to the League» is the headline, the rest are listed. */
  items: Achievement[];
  league: MyLeague | null;
  saving: boolean;
  onClose: (wear: boolean) => void;
}

interface BodyProps extends SceneProps {
  /** The dialog's own title/description parts; the static review render passes plain elements. */
  Title?: ElementType;
  Description?: ElementType;
}

/** The scene itself, without the fetch or the dialog shell: the live component and the static review render both use it. */
export function LeagueWelcomeBody({ items, league, saving, onClose, Title = DialogTitle, Description = DialogDescription }: BodyProps) {
  const t = useT();
  const locale = useLocale();
  const others = items.filter((a) => a.key !== 'ml_signed');
  const total = league?.lessons.total ?? 0;
  const date = league?.exam_date ? formatDate(league.exam_date, { day: 'numeric', month: 'long' }, locale) : '';
  const group = league ? groupTail(league.group.name) : '';
  return (
    <>
      <style>{CSS}</style>
      <div>
        <div className="relative isolate overflow-hidden bg-[linear-gradient(160deg,#07122E_0%,#0B1B4D_45%,#14307A_100%)] px-6 pb-7 pt-9 text-center text-white">
          <div aria-hidden className="ml-rays -z-10" />
          <div className="relative mx-auto w-fit">
            <div className="ml-bob">
              <Orca config={leagueKitConfig()} size={152} title={t('studentHome.league.kitAlt')} />
            </div>
            <LeagueCrestSvg size={46} className="absolute -right-5 -top-1 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]" />
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">{t('studentHome.league.welcome.eyebrow')}</p>
          <Title className="mt-1 text-2xl font-extrabold leading-tight text-white">{t('studentHome.league.welcome.title')}</Title>
          <Description className="mt-2 text-sm text-blue-100">
            {total > 0 ? t('studentHome.league.welcome.line', { count: total }) : t('studentHome.league.welcome.lineNoCount')}
          </Description>
          {group && (
            <p className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-amber-200 ring-1 ring-white/15">
              {date ? t('studentHome.league.welcome.squad', { group, date }) : t('studentHome.league.welcome.squadNoDate', { group })}
            </p>
          )}
        </div>
        {others.length > 0 && (
          <div className="px-6 pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t('studentHome.league.welcome.alsoUnlocked')}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {others.map((a) => (
                <li key={a.key} className="flex items-center gap-1 rounded-full bg-blue-950 px-2.5 py-1 text-xs font-semibold text-amber-300">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  {achievementField(a, 'title', locale)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2 px-6 py-5 sm:flex-row">
          <Button
            type="button"
            className="flex-1 bg-amber-300 font-bold text-blue-950 hover:bg-amber-200"
            disabled={saving}
            onClick={() => onClose(true)}
          >
            {t('studentHome.league.welcome.wear')}
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => onClose(false)}>
            {t('studentHome.league.welcome.go')}
          </Button>
        </div>
      </div>
    </>
  );
}

export default function LeagueWelcome({ items, saving, onClose }: Omit<SceneProps, 'league'>) {
  const [league, setLeague] = useState<MyLeague | null>(null);
  useEffect(() => {
    let alive = true;
    getMyLeague().then((res) => { if (alive) setLeague(res); });
    return () => { alive = false; };
  }, []);
  return (
    <>
      <Confetti colors={CONFETTI} />
      <Dialog open onOpenChange={(o) => { if (!o) onClose(false); }}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl border-0 p-0">
          <LeagueWelcomeBody items={items} league={league} saving={saving} onClose={onClose} />
        </DialogContent>
      </Dialog>
    </>
  );
}
