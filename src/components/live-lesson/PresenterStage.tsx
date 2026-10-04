import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Hand, Radio, Users } from 'lucide-react';
import { playChime } from '../../lib/liveLesson/chime';
import { activityLabel, correctIndices } from '../../lib/liveLesson/logic';
import { popcheckRight, rightAnswerers, votersByOption } from '../../lib/liveLesson/orcas';
import type { ActivityView, LiveState } from '../../lib/liveLesson/types';
import { CloudView, Countdown, OptionRows, QuestionBody } from './parts';
import { OrcaStack, OrcaStrip, PickReveal } from './orcas';

/**
 * The full-screen presenter view the teacher screen-shares (owner, 2026-09-29). Idle: a big QR
 * and the link. While answers come in: the question and how many answered. After «Show»: the totals.
 * Orcas (owner, 2026-10-04): a «who's here» strip, each student's orca popping into the tray as
 * they answer (never what they answered), the picker shuffling faces before it lands, and on a
 * named reveal the poll voters per option and only the RIGHT answerers of a quiz — a wrong answer
 * never goes on the big screen. Anonymous activities show no orcas at all.
 */
export default function PresenterStage({ state, seconds }: { state: LiveState; seconds: number | null }) {
  const activity = state.activity;
  const idle = !activity || (activity.status === 'closed' && !activity.revealed && !activity.answered);
  return (
    <div className="relative flex min-h-screen flex-col bg-background px-6 py-6 text-foreground sm:px-12 sm:py-10">
      <header className="flex items-center justify-between gap-4">
        <p className="inline-flex items-center gap-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
          <Radio className="h-5 w-5" aria-hidden />{state.lesson.title}
        </p>
        <div className="flex items-center gap-4">
          {activity && !idle && <SmallQr link={state.link} />}
          <Countdown seconds={seconds} paused={state.timer?.paused_left != null} large onEnd={playChime} />
        </div>
      </header>
      {state.pick && !state.pick.outcome && (
        <div className="mx-auto mt-4 flex items-center gap-4 rounded-3xl bg-amber-100 px-8 py-4 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          <p className="inline-flex flex-col items-center gap-1 text-base font-semibold uppercase tracking-wide"><Hand className="h-7 w-7" aria-hidden />Your turn</p>
          <PickReveal pickId={state.pick.id} picked={state.pick} room={state.room ?? []} size={idle ? 168 : 104} horizontal={!idle} />
        </div>
      )}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-8">
        {idle ? <Idle link={state.link} /> : <Stage activity={activity!} />}
      </main>
      {state.room && state.room.length > 0 && (
        <footer className="mx-auto w-full max-w-6xl border-t border-border pt-4">
          <p className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">Here now · {state.room.length}</p>
          <OrcaStrip people={state.room} />
        </footer>
      )}
    </div>
  );
}

function useQr(link: string, size: number): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(link, { margin: 1, width: size, errorCorrectionLevel: 'M' })
      .then((url) => { if (live) setSrc(url); })
      .catch(() => setSrc(null));
    return () => { live = false; };
  }, [link, size]);
  return src;
}

function Idle({ link }: { link: string }) {
  const qr = useQr(link, 520);
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {qr && <img src={qr} alt={`QR code for ${link}`} className="h-[min(52vh,26rem)] w-auto rounded-2xl bg-white p-3" />}
      <p className="text-4xl font-bold tracking-tight">{link.replace(/^https:\/\//, '')}</p>
      <p className="text-2xl text-muted-foreground">Scan or open the link, sign in to the LMS. Waiting for a question</p>
    </div>
  );
}

function SmallQr({ link }: { link: string }) {
  const qr = useQr(link, 160);
  return qr ? <img src={qr} alt="" className="h-20 w-20 rounded-lg bg-white p-1" /> : null;
}

function Answered({ activity }: { activity: ActivityView }) {
  return (
    <div className="mt-6 space-y-4">
      <p className="inline-flex items-center gap-3 text-3xl text-muted-foreground">
        <Users className="h-8 w-8" aria-hidden />
        <span><b className="text-foreground">{activity.answered}</b>{activity.offered ? ` of ${Math.max(activity.offered, activity.answered)}` : ''} answered</span>
      </p>
      {/* Who has answered, never what: each orca pops in as its answer arrives. */}
      {activity.answered_by && activity.answered_by.length > 0 && (
        <OrcaStack people={activity.answered_by} size={64} max={24} pop className="flex-wrap gap-y-2" />
      )}
    </div>
  );
}

function RightRow({ people, size = 48 }: { people: { user_id: number; name: string | null }[]; size?: number }) {
  if (!people.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">Got it right</span>
      <OrcaStack people={people} size={size} max={16} pop />
    </div>
  );
}

function Stage({ activity }: { activity: ActivityView }) {
  const shown = activity.revealed;
  const heading = activity.kind === 'popcheck' ? 'Homework pop-check' : activity.kind === 'mistake' ? 'Mistake of the day' : activity.prompt;
  return (
    <div className="space-y-6">
      <div>
        {(activity.kind === 'poll' || activity.kind === 'cloud') && (
          <p className="text-xl font-semibold uppercase tracking-wide text-muted-foreground">{activityLabel(activity.kind)}</p>
        )}
        {heading && <h1 className="mt-2 text-5xl font-bold leading-tight">{heading}</h1>}
      </div>
      {activity.kind === 'poll' && (
        <OptionRows options={activity.options ?? []} large counts={shown ? activity.results?.counts ?? null : null}
          voters={shown && activity.answers ? votersByOption(activity.answers, (activity.options ?? []).length) : null} />
      )}
      {activity.kind === 'mistake' && activity.question && (
        <div className="space-y-4">
          <QuestionBody question={activity.question} large />
          <OptionRows options={activity.question.options ?? []} large rich
            counts={shown ? activity.results?.counts ?? null : null}
            correct={shown ? correctIndices(activity.results?.correct) : undefined} />
          {shown && <RightRow people={rightAnswerers(activity.answers)} />}
        </div>
      )}
      {activity.kind === 'cloud' && shown && <CloudView groups={activity.results?.groups ?? []} large />}
      {activity.kind === 'popcheck' && (
        <div className="grid gap-4 sm:grid-cols-3">
          {(activity.items ?? []).map((item, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-xl text-muted-foreground">Question {i + 1}</p>
              {shown && item.answered ? (
                <p className="mt-2 text-6xl font-bold tabular-nums">{Math.round(((item.right ?? 0) / item.answered) * 100)}%</p>
              ) : null}
              {shown && <p className="mt-1 text-lg text-muted-foreground">right</p>}
              {shown && activity.answers && (
                <OrcaStack people={popcheckRight(activity.answers, i)} size={36} max={7} pop className="mt-3 justify-center" />
              )}
            </div>
          ))}
        </div>
      )}
      {!shown && <Answered activity={activity} />}
    </div>
  );
}
