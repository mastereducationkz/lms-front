import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, LogOut, MonitorPlay } from 'lucide-react';
import { CLOUD_PROJECT_NUMBER } from './config';
import { client, SessionLost } from './api';
import { isFramed, resolveMeeting, type MeetingSource } from './meetSdk';
import { lessons, pickLesson, type LessonChoice } from './lessons';
import SignIn from './components/SignIn';
import LessonPanel from './components/LessonPanel';
import LessonPicker from './components/LessonPicker';

type Phase =
  | { kind: 'connecting' }
  | { kind: 'nowhere'; source: MeetingSource }
  | { kind: 'signin' }
  | { kind: 'finding' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; choice: LessonChoice };

/**
 * The Google Meet side panel (owner, 2026-09-28): the lesson running in this Meet, for its
 * teacher — who is in the room, «Баллы за урок», the notes, the materials and a way into the
 * full lesson page. Attendance is Meet's to take, so there is no register here.
 */
export default function App() {
  const [source, setSource] = useState<MeetingSource | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'connecting' });
  const [chosen, setChosen] = useState<number | null>(null);

  // First thing on screen: tell Meet the panel is alive (its deadline is 10 s).
  useEffect(() => {
    let live = true;
    void resolveMeeting({ projectNumber: CLOUD_PROJECT_NUMBER, search: window.location.search, framed: isFramed() })
      .then((found) => { if (live) setSource(found); });
    return () => { live = false; };
  }, []);

  const meetingCode = source && (source.kind === 'meet' || source.kind === 'preview') ? source.meetingCode : null;

  const find = useCallback(async () => {
    if (!meetingCode) return;
    if (!client.tokens.accessToken && !client.tokens.refreshToken) {
      setPhase({ kind: 'signin' });
      return;
    }
    setPhase({ kind: 'finding' });
    try {
      const found = await lessons.byMeetCode(meetingCode);
      setPhase({ kind: 'ready', choice: pickLesson(found) });
    } catch (error) {
      if (error instanceof SessionLost) setPhase({ kind: 'signin' });
      else setPhase({ kind: 'error', message: (error as Error).message || 'Could not load the lesson' });
    }
  }, [meetingCode]);

  useEffect(() => {
    if (!source) return;
    if (!meetingCode) setPhase({ kind: 'nowhere', source });
    else void find();
  }, [source, meetingCode, find]);

  const signOut = () => {
    client.tokens.clear();
    setChosen(null);
    setPhase({ kind: 'signin' });
  };

  const lessonId = phase.kind !== 'ready' ? null : chosen ?? (phase.choice.kind === 'lesson' ? phase.choice.id : null);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {source?.kind === 'preview' && (
        <div className="bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800">
          Preview — outside Meet · {source.meetingCode}
        </div>
      )}
      <main className="flex-1 px-3 pb-4 pt-3">
        {phase.kind === 'connecting' && <Centered><Loader2 className="h-5 w-5 animate-spin text-slate-400" /><span>Connecting to Meet…</span></Centered>}
        {phase.kind === 'nowhere' && <Nowhere source={phase.source} />}
        {phase.kind === 'signin' && meetingCode && <SignIn meetingCode={meetingCode} onSignedIn={() => void find()} />}
        {phase.kind === 'finding' && <Centered><Loader2 className="h-5 w-5 animate-spin text-slate-400" /><span>Finding this Meet's lesson…</span></Centered>}
        {phase.kind === 'error' && (
          <Centered>
            <p className="text-sm text-slate-700">{phase.message}</p>
            <button type="button" onClick={() => void find()} className="mt-2 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium hover:bg-slate-50">Try again</button>
          </Centered>
        )}
        {lessonId != null ? (
          <LessonPanel
            lessonId={lessonId}
            onBack={chosen != null ? () => setChosen(null) : undefined}
            onSessionLost={() => setPhase({ kind: 'signin' })}
          />
        ) : phase.kind === 'ready' && phase.choice.kind === 'none' ? (
          <LessonPicker previous={phase.choice.previous} next={phase.choice.next} onPick={setChosen} onRefresh={() => void find()} />
        ) : null}
      </main>
      {(phase.kind === 'ready' || phase.kind === 'error') && (
        <footer className="border-t border-slate-100 px-3 py-2 text-right">
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800">
            <LogOut className="h-3 w-3" aria-hidden />Sign out of the panel
          </button>
        </footer>
      )}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-slate-600">{children}</div>;
}

function Nowhere({ source }: { source: MeetingSource }) {
  return (
    <Centered>
      <MonitorPlay className="h-8 w-8 text-slate-400" aria-hidden />
      <p className="text-base font-semibold text-slate-900">Open this panel from Google Meet</p>
      <p className="max-w-[18rem] text-sm text-slate-600">
        In a lesson's Meet, click <b>Activities</b> → <b>Master LMS</b>. The panel shows that lesson: who is in the room, scores, notes and materials.
      </p>
      {source.kind === 'unavailable' && <p className="mt-2 text-[11px] text-slate-400">{source.reason}</p>}
    </Centered>
  );
}
