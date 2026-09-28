import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, MonitorPlay, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  handoffIdFrom, mayUsePanel, rememberLinkForLogin, stateFromError, stateFromInfo, type LinkState,
} from '../lib/meetAddonLink';
import { answerHandoff, describeHandoff, HandoffRequestError } from '../services/api/meetAddonHandoff';

/**
 * `/meet-addon/link?h=<id>` — the popup the Meet side panel opens (owner, 2026-09-28). The teacher
 * is signed in here as usual (SSO included), sees what is asking, and allows or denies it; the
 * panel, polling, then gets its own session. Not inside ProtectedRoute: a signed-out teacher's
 * link has to survive the SSO round trip (see `rememberLinkForLogin`).
 */
export default function MeetAddonLinkPage() {
  const { loading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const id = handoffIdFrom(location.search);
  const [state, setState] = useState<LinkState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || isAuthenticated) return;
    rememberLinkForLogin(`${location.pathname}${location.search}`);
    navigate('/login', { replace: true, state: { from: location } });
  }, [loading, isAuthenticated, location, navigate]);

  useEffect(() => {
    if (loading || !isAuthenticated || !id) return;
    if (!mayUsePanel(user?.role)) { setState({ kind: 'staff_only' }); return; }
    let live = true;
    describeHandoff(id)
      .then((info) => { if (live) setState(stateFromInfo(info)); })
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
      await answerHandoff(id, approve);
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
    return <Frame><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></Frame>;
  }
  if (!id) {
    return <Frame><Message icon={<XCircle className="h-8 w-8 text-slate-400" />} title="This link is incomplete" text="Open the LMS panel in Google Meet and press «Sign in with LMS» again." /></Frame>;
  }

  return (
    <Frame>
      {state.kind === 'loading' && <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />}
      {(state.kind === 'ask' || state.kind === 'other_network') && (
        <div className="text-center">
          <MonitorPlay className="mx-auto h-10 w-10 text-blue-600" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Connect the LMS panel in Google Meet?</h1>
          <p className="mt-2 text-sm text-slate-600">
            The Meet side panel{state.info.meeting_code ? <> in meeting <b className="font-mono">{state.info.meeting_code}</b></> : null} will
            act as <b>{user?.name || user?.email}</b>: it shows the lesson's room, scores, notes and materials, and saves scores and notes.
          </p>
          {state.kind === 'other_network' ? (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
              <span>
                This request came from a different network than this window. Approve it on the computer where Meet is open.
                If you did not just open the LMS panel in Meet, deny it.
              </span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Only allow it if you just pressed «Sign in with LMS» in Meet yourself.</p>
          )}
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(false)}
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Deny
            </button>
            {state.kind === 'ask' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void answer(true)}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}Allow
              </button>
            )}
          </div>
        </div>
      )}
      {state.kind === 'done' && (
        <Message
          icon={state.approved ? <CheckCircle2 className="h-10 w-10 text-emerald-600" /> : <XCircle className="h-10 w-10 text-slate-400" />}
          title={state.approved ? 'Done — return to Meet' : 'Denied'}
          text={state.approved ? 'The panel signs in within a few seconds. You can close this window.' : 'The Meet panel was not connected. You can close this window.'}
        />
      )}
      {state.kind === 'answered' && <Message icon={<CheckCircle2 className="h-10 w-10 text-slate-400" />} title="Already answered" text="This request was already allowed or denied. You can close this window." />}
      {state.kind === 'expired' && <Message icon={<XCircle className="h-10 w-10 text-slate-400" />} title="This link has expired" text="Open the LMS panel in Google Meet and press «Sign in with LMS» again." />}
      {state.kind === 'staff_only' && <Message icon={<ShieldAlert className="h-10 w-10 text-slate-400" />} title="For teachers only" text="The LMS panel in Google Meet is for teachers, head teachers and admins." />}
      {state.kind === 'error' && <Message icon={<XCircle className="h-10 w-10 text-rose-500" />} title="Could not connect the panel" text={state.message} />}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function Message({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-3 text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}
