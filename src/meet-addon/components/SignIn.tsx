import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, Loader2, LogIn } from 'lucide-react';
import { client } from '../api';
import { openSignInPopup, runHandoff, type HandoffState } from '../handoff';

/**
 * «Sign in with LMS»: the panel has no LMS session of its own (Meet's iframe sees none of the
 * LMS cookies), so the teacher approves one from a normal LMS window. See `handoff.ts`.
 */
export default function SignIn({ meetingCode, onSignedIn }: { meetingCode: string; onSignedIn: () => void }) {
  const [state, setState] = useState<HandoffState | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const start = () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    // Synchronously, inside the click: a popup opened after an await is blocked.
    const popup = openSignInPopup();
    void runHandoff(meetingCode, { client, popup, signal: controller.signal }, (next) => {
      if (!controller.signal.aborted) setState(next);
    }).then((outcome) => {
      if (outcome === 'approved' && !controller.signal.aborted) onSignedIn();
    });
  };

  const busy = state?.kind === 'starting' || state?.kind === 'waiting';
  return (
    <div className="flex flex-col items-center px-2 py-10 text-center">
      <img src="/meet-addon/logo-256.png" alt="" className="mb-4 h-12 w-12" />
      <h1 className="text-base font-semibold text-foreground">Master LMS in Meet</h1>
      <p className="mt-1 max-w-[18rem] text-sm text-muted-foreground">
        This lesson's room, scores, notes and materials, next to the call. Sign in once with your LMS account.
      </p>

      {!busy && (
        <button
          type="button"
          onClick={start}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-solid-hover"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          {state?.kind === 'expired' || state?.kind === 'denied' || state?.kind === 'error' ? 'Try again' : 'Sign in with LMS'}
        </button>
      )}

      {state?.kind === 'starting' && <Line><Loader2 className="h-4 w-4 animate-spin" />Opening the LMS…</Line>}
      {state?.kind === 'waiting' && (
        <div className="mt-5 w-full max-w-[18rem] rounded-xl border border-border bg-muted p-3 text-left text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            {state.popupBlocked ? 'Your browser blocked the window' : 'Waiting for you to allow it…'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {state.popupBlocked
              ? 'Open the LMS sign-in page and press «Allow» there:'
              : 'Press «Allow» in the LMS window. Closed it by mistake?'}
          </p>
          <a
            href={state.linkUrl}
            target="lms-meet-addon-link"
            rel="opener"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            Open the LMS sign-in page <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      )}
      {state?.kind === 'denied' && <Line tone="rose">The request was declined in the LMS.</Line>}
      {state?.kind === 'expired' && <Line tone="amber">The sign-in link expired before it was allowed.</Line>}
      {state?.kind === 'error' && <Line tone="rose">{state.message}</Line>}
      {state?.kind === 'approved' && <Line><Loader2 className="h-4 w-4 animate-spin" />Signed in, loading the lesson…</Line>}
    </div>
  );
}

function Line({ children, tone }: { children: ReactNode; tone?: 'rose' | 'amber' }) {
  const color = tone === 'rose' ? 'text-rose-700 dark:text-rose-300' : tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground';
  return <p className={`mt-4 flex items-center justify-center gap-2 text-sm ${color}`}>{children}</p>;
}
