/**
 * «Not this time»: a quiet text button, and one calm confirmation before it is final (a «no» cannot
 * be taken back by the student). No guilt in the words: the regular group carries on, the seat goes
 * to someone else.
 */
import { useEffect, useId, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

interface DeclineProps {
  confirming: boolean;
  saving: boolean;
  /** Some answer is being saved, so nothing else may be sent. */
  disabled: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onConfirm: () => void;
}

export default function Decline({ confirming, saving, disabled, onAsk, onKeep, onConfirm }: DeclineProps) {
  const t = useT();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const ask = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Keyboard and screen-reader users land on the question, and come back to the button if they keep their seat.
  useEffect(() => {
    if (confirming) panel.current?.focus();
    else if (wasConfirming.current) ask.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  if (!confirming) {
    return (
      <div className="text-center">
        <button
          ref={ask}
          type="button"
          disabled={disabled}
          onClick={onAsk}
          className="min-h-11 rounded-lg px-4 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {t('studentHome.leagueInvite.notNow')}
        </button>
      </div>
    );
  }
  return (
    <div
      ref={panel}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      className="rounded-3xl border bg-card p-5 text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h2 id={titleId} className="text-lg font-extrabold leading-tight">{t('studentHome.leagueInvite.decline.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('studentHome.leagueInvite.decline.body')}</p>
      <div className="mt-4 flex flex-col gap-2 @lg:flex-row-reverse">
        <button
          type="button"
          disabled={disabled}
          onClick={onKeep}
          className="min-h-11 flex-1 rounded-2xl bg-[#0B1B4D] px-4 text-sm font-bold text-white transition-colors hover:bg-[#14307A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {t('studentHome.leagueInvite.decline.keep')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onConfirm}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {saving ? t('studentHome.leagueInvite.saving') : t('studentHome.leagueInvite.decline.yes')}
        </button>
      </div>
    </div>
  );
}
