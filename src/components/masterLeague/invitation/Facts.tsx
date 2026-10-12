/** What Master League is in two lines, then the two dates that matter: the Final and the deadline. */
import type { ReactNode } from 'react';
import { CalendarClock, Flag, Gift, Users } from 'lucide-react';
import { deadlineLabel, examLabel } from '@/lib/leagueInvitation';
import { useT } from '@/lib/i18n/react';
import type { Locale } from '@/lib/i18n';
import type { LeagueInvitation } from '@/services/api/leagueInvitation';
import '@/lib/i18n/catalogs/studentHome';

function Line({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B1B4D] text-amber-300">{icon}</span>
      <p className="min-w-0 text-[15px] leading-snug text-foreground">{children}</p>
    </li>
  );
}

function Fact({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted/60 p-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <span aria-hidden className="text-amber-600 dark:text-amber-300">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-base font-extrabold leading-tight text-foreground">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

export default function Facts({ invitation, locale }: { invitation: LeagueInvitation; locale: Locale }) {
  const t = useT();
  return (
    <section aria-label={t('studentHome.leagueInvite.what.heading')} className="rounded-3xl border bg-card p-5 text-card-foreground">
      <ul className="space-y-3">
        <Line icon={<Flag className="h-4 w-4" />}>{t('studentHome.leagueInvite.what.one')}</Line>
        <Line icon={<Users className="h-4 w-4" />}>{t('studentHome.leagueInvite.what.two')}</Line>
      </ul>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Fact
          icon={<Gift className="h-3.5 w-3.5" />}
          label={t('studentHome.leagueInvite.fact.final')}
          value={examLabel(invitation.exam_date, locale)}
          note={t('studentHome.leagueInvite.fact.finalNote')}
        />
        <Fact
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label={t('studentHome.leagueInvite.fact.answer')}
          value={deadlineLabel(invitation, locale)}
        />
      </dl>
    </section>
  );
}
