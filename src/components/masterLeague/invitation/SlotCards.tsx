/**
 * The squads on offer: one navy card each with its name and its weekly schedule (groups have no
 * capacity limit, so no seat counts are shown or computed). The gold button is the answer: «I'm in» for that squad. While an
 * answer is on its way every button waits, so a double tap cannot send two.
 */
import { useId } from 'react';
import { Loader2 } from 'lucide-react';
import { scheduleChips, squadName } from '@/lib/leagueInvitation';
import { withTheme, type LeagueTheme } from '@/lib/leagueTheme';
import { SeasonEmblem } from '../LeagueArt';
import { leagueLook } from '../leagueLook';
import { useLeagueT } from '../useLeagueLocale';
import type { Locale } from '@/lib/i18n';
import type { InvitationOption } from '@/services/api/leagueInvitation';
import '@/lib/i18n/catalogs/studentHome';

interface SlotProps {
  option: InvitationOption;
  locale: Locale;
  /** This squad's answer is being saved. */
  saving: boolean;
  /** Some answer is being saved, so nothing else may be sent. */
  disabled: boolean;
  onChoose: (groupId: number) => void;
  theme?: LeagueTheme;
}

function Slot({ option, locale, saving, disabled, onChoose, theme }: SlotProps) {
  const t = useLeagueT();
  const name = squadName(option);
  const look = leagueLook(theme, option.label);
  const [fill, ink] = look.solid.split(' ');
  return (
    <li className="min-w-0">
      <article
        aria-label={name}
        className={`flex h-full flex-col gap-4 rounded-3xl ${look.slot}`}
      >
        <div className="flex items-center gap-3">
          <SeasonEmblem look={look} size={30} />
          <h3 className="min-w-0 truncate text-xl font-extrabold leading-tight">{name}</h3>
        </div>
        <ul className="flex flex-wrap gap-2">
          {scheduleChips(option.schedule_text, locale).map((chip) => (
            <li key={chip} className={`rounded-full bg-white/10 px-3 py-1 text-sm font-medium tabular-nums ${look.faint} ring-1 ring-white/15`}>
              {chip}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={disabled}
          aria-busy={saving}
          aria-label={saving ? undefined : t('studentHome.leagueInvite.inFor', { squad: name })}
          onClick={() => onChoose(option.group_id)}
          className={`mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl ${fill} px-4 text-base font-extrabold ${ink} transition-colors ${look.solidHover} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed ${saving ? '' : 'disabled:opacity-50'}`}
        >
          {saving ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              {t('studentHome.leagueInvite.saving')}
            </>
          ) : (
            t('studentHome.leagueInvite.in')
          )}
        </button>
      </article>
    </li>
  );
}

interface SlotsProps {
  options: InvitationOption[];
  locale: Locale;
  /** The squad whose answer is being saved, if any. */
  savingGroup: number | null;
  /** An answer of any kind is being saved. */
  busy: boolean;
  onChoose: (groupId: number) => void;
  /** The season: a studio squad wears its own group's colours. */
  theme?: LeagueTheme;
}

export default function SlotCards({ options, locale, savingGroup, busy, onChoose, theme }: SlotsProps) {
  const t = withTheme(useLeagueT(), theme);
  const one = options.length === 1;
  const headingId = `${useId()}slots`;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div>
        <h2 id={headingId} className="text-xl font-extrabold leading-tight text-foreground">
          {t(one ? 'studentHome.leagueInvite.slots.titleOne' : 'studentHome.leagueInvite.slots.title')}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t(one ? 'studentHome.leagueInvite.slots.subOne' : 'studentHome.leagueInvite.slots.sub')}
        </p>
      </div>
      {options.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{t('studentHome.leagueInvite.slots.empty')}</p>
      ) : (
        <ul className="grid gap-3 @lg:grid-cols-2">
          {options.map((o) => (
            <Slot key={o.group_id} option={o} locale={locale} saving={savingGroup === o.group_id} disabled={busy} onChoose={onChoose} theme={theme} />
          ))}
        </ul>
      )}
    </section>
  );
}
