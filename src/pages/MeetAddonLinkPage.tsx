import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, MonitorPlay, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  handoffIdFrom, mayUsePanel, rememberLinkForLogin, stateFromError, stateFromInfo, type LinkState,
} from '../lib/meetAddonLink';
import { answerHandoff, describeHandoff, HandoffRequestError } from '../services/api/meetAddonHandoff';
import { requestPairSecret } from '../lib/addonPairing';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/publicPages';

/**
 * `/meet-addon/link?h=<id>` — the popup the Meet side panel opens (owner, 2026-09-28). The teacher
 * is signed in here as usual (SSO included), sees what is asking, and allows or denies it; the
 * panel, polling, then gets its own session. Not inside ProtectedRoute: a signed-out teacher's
 * link has to survive the SSO round trip (see `rememberLinkForLogin`).
 */
export default function MeetAddonLinkPage() {
  const { loading, isAuthenticated, user } = useAuth();
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const id = handoffIdFrom(location.search);
  const [state, setState] = useState<LinkState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [pairSecret, setPairSecret] = useState<string | null>(null);

  useEffect(() => {
    if (loading || isAuthenticated) return;
    rememberLinkForLogin(`${location.pathname}${location.search}`);
    navigate('/login', { replace: true, state: { from: location } });
  }, [loading, isAuthenticated, location, navigate]);

  useEffect(() => {
    if (loading || !isAuthenticated || !id) return;
    if (!mayUsePanel(user?.role)) { setState({ kind: 'staff_only' }); return; }
    let live = true;
    // Ask the Meet panel that opened this window for the pair secret while reading the handoff:
    // with it, «Allow» works whatever network the panel and this window each came from.
    Promise.all([
      describeHandoff(id),
      requestPairSecret(window.opener, window, window.location.origin, id),
    ])
      .then(([info, secret]) => {
        if (!live) return;
        setPairSecret(secret);
        setState(stateFromInfo(info, Boolean(secret)));
      })
      .catch((e) => {
        if (!live) return;
        const err = e instanceof HandoffRequestError ? e : new HandoffRequestError(null, null);
        setState(stateFromError(err.status, err.detail));
      });
    return () => { live = false; };
  }, [loading, isAuthenticated, id, user?.role]);

  const answer = async (approve: boolean) => {
    if (!id) return;
    setBusy(true);
    try {
      await answerHandoff(id, approve, pairSecret);
      setState({ kind: 'done', approved: approve });
      window.setTimeout(() => { try { window.close(); } catch { /* not ours to close */ } }, approve ? 1500 : 800);
    } catch (e) {
      const err = e instanceof HandoffRequestError ? e : new HandoffRequestError(null, null);
      setState(stateFromError(err.status, err.detail));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !isAuthenticated) {
    return <Frame><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></Frame>;
  }
  if (!id) {
    return <Frame><Message icon={<XCircle className="h-8 w-8 text-muted-foreground" />} title={t('publicPages.meetLink.incompleteTitle')} text={t('publicPages.meetLink.reopenText')} /></Frame>;
  }

  return (
    <Frame>
      {state.kind === 'loading' && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
      {(state.kind === 'ask' || state.kind === 'other_network') && (
        <div className="text-center">
          <MonitorPlay className="mx-auto h-10 w-10 text-brand" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-foreground">{t('publicPages.meetLink.askTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {fill(t(state.info.meeting_code ? 'publicPages.meetLink.askTextInMeeting' : 'publicPages.meetLink.askText'), {
              code: <b className="font-mono">{state.info.meeting_code}</b>,
              name: <b>{user?.name || user?.email}</b>,
            })}
          </p>
          {state.kind === 'other_network' ? (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 p-3 text-left text-sm text-amber-900 dark:text-amber-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
              <span>
                {t('publicPages.meetLink.otherNetworkWarning')}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">{t('publicPages.meetLink.onlyAllowIfYou')}</p>
          )}
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(false)}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              {t('publicPages.meetLink.deny')}
            </button>
            {state.kind === 'ask' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void answer(true)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-solid px-5 py-2 text-sm font-semibold text-white hover:bg-brand-solid-hover disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t('publicPages.meetLink.allow')}
              </button>
            )}
          </div>
        </div>
      )}
      {state.kind === 'done' && (
        <Message
          icon={state.approved ? <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-10 w-10 text-muted-foreground" />}
          title={state.approved ? t('publicPages.meetLink.doneTitle') : t('publicPages.meetLink.deniedTitle')}
          text={state.approved ? t('publicPages.meetLink.doneText') : t('publicPages.meetLink.deniedText')}
        />
      )}
      {state.kind === 'answered' && <Message icon={<CheckCircle2 className="h-10 w-10 text-muted-foreground" />} title={t('publicPages.meetLink.answeredTitle')} text={t('publicPages.meetLink.answeredText')} />}
      {state.kind === 'expired' && <Message icon={<XCircle className="h-10 w-10 text-muted-foreground" />} title={t('publicPages.meetLink.expiredTitle')} text={t('publicPages.meetLink.reopenText')} />}
      {state.kind === 'staff_only' && <Message icon={<ShieldAlert className="h-10 w-10 text-muted-foreground" />} title={t('publicPages.meetLink.staffOnlyTitle')} text={t('publicPages.meetLink.staffOnlyText')} />}
      {state.kind === 'error' && <Message icon={<XCircle className="h-10 w-10 text-rose-500 dark:text-rose-400" />} title={t('publicPages.meetLink.errorTitle')} text={state.message} />}
    </Frame>
  );
}

/** A message with {name} placeholders, each drawn as the given node (a bold name, a meeting code). */
function fill(text: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{name && name in nodes ? nodes[name] : part}</Fragment>;
  });
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}

function Message({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-3 text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
