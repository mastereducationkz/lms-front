/**
 * «Your result is recorded: 1520. May we congratulate you in the group chat?» (owner, 2026-10-13).
 * A card on the season banner, shown only once staff verified the student's official result and only
 * after the exam. Yes and No are equal buttons; no answer means nothing is ever posted, and the card
 * says so. Only the student's own tap writes an answer (`POST /master-league/me/result-consent`);
 * until the line is posted they can take it back. Hidden while loading, on an error, and when there
 * is no verified result.
 *
 * `LeagueResultConsentView` is the pure picture; `LeagueResultConsent` adds the fetch and the tap.
 */
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/react';
import {
  answerResultConsent, getResultConsent, type ConsentDecision, type ResultConsent,
} from '@/services/api/masterLeague';
import '@/lib/i18n/catalogs/studentHome';

const SOLID =
  'inline-flex items-center rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-blue-950 transition-colors hover:bg-amber-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';
const QUIET =
  'inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-amber-100 ring-1 ring-white/20 transition-colors hover:bg-white/15 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

interface ViewProps {
  consent: ResultConsent;
  busy?: boolean;
  failed?: boolean;
  onAnswer?: (decision: ConsentDecision) => void;
}

export function LeagueResultConsentView({ consent, busy = false, failed = false, onAnswer }: ViewProps) {
  const t = useT();
  const { state, can_answer: canAnswer } = consent;
  const answer = (decision: ConsentDecision) => () => onAnswer?.(decision);
  return (
    <div role="group" aria-label={t('studentHome.league.consent.region')} className="relative border-t border-white/10 px-4 py-3 @lg:px-6">
      <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-amber-300/30">
        <p className="text-sm font-extrabold text-white">{t('studentHome.league.consent.title', { total: consent.result_total })}</p>
        {state === 'ask' && (
          <>
            <p className="mt-1 text-xs text-blue-100">{t('studentHome.league.consent.question')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" disabled={busy || !canAnswer} onClick={answer('yes')} className={SOLID}>
                {t('studentHome.league.consent.yes')}
              </button>
              <button type="button" disabled={busy || !canAnswer} onClick={answer('no')} className={QUIET}>
                {t('studentHome.league.consent.no')}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-blue-100/80">{t('studentHome.league.consent.hint')}</p>
          </>
        )}
        {state === 'yes' && (
          <div role="status" className="mt-1">
            <p className="text-xs text-blue-100">{t('studentHome.league.consent.yesDone')}</p>
            {canAnswer && (
              <button type="button" disabled={busy} onClick={answer('no')} className={`${QUIET} mt-2`}>
                {t('studentHome.league.consent.takeBack')}
              </button>
            )}
          </div>
        )}
        {state === 'no' && (
          <div role="status" className="mt-1">
            <p className="text-xs text-blue-100">{t('studentHome.league.consent.noDone')}</p>
            {canAnswer && (
              <button type="button" disabled={busy} onClick={answer('yes')} className={`${QUIET} mt-2`}>
                {t('studentHome.league.consent.changeYes')}
              </button>
            )}
          </div>
        )}
        {state === 'posted' && (
          <p role="status" className="mt-1 text-xs text-blue-100">{t('studentHome.league.consent.posted')}</p>
        )}
        {failed && <p role="alert" className="mt-2 text-xs text-amber-200">{t('studentHome.league.consent.failed')}</p>}
      </div>
    </div>
  );
}

export default function LeagueResultConsent({ enabled }: { enabled: boolean }) {
  const [consent, setConsent] = useState<ResultConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    getResultConsent().then((c) => { if (alive) setConsent(c); });
    return () => { alive = false; };
  }, [enabled]);

  if (!consent) return null;
  const answer = async (decision: ConsentDecision) => {
    if (inFlight.current) return; // a double click is one answer
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const next = await answerResultConsent(decision);
      if (next) setConsent(next);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return <LeagueResultConsentView consent={consent} busy={busy} failed={failed} onAnswer={answer} />;
}
