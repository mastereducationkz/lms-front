import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Hand, Radio, Users } from 'lucide-react';
import { playChime } from '../../lib/liveLesson/chime';
import { activityLabel, correctIndices } from '../../lib/liveLesson/logic';
import type { ActivityView, LiveState } from '../../lib/liveLesson/types';
import { CloudView, Countdown, OptionRows, QuestionBody } from './parts';

/**
 * The full-screen presenter view the teacher screen-shares (owner, 2026-09-29). It never shows who
 * answered what, only the picked student's name. Idle: a big QR and the link. While answers
 * come in: the question and how many answered. After «Show»: the totals.
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
        <div className="mx-auto mt-6 inline-flex items-center gap-4 rounded-3xl bg-amber-100 px-8 py-5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          <Hand className="h-10 w-10" aria-hidden />
          <span className="text-4xl font-bold">{state.pick.name}</span>
        </div>
      )}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-8">
        {idle ? <Idle link={state.link} /> : <Stage activity={activity!} />}
      </main>
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
    <p className="mt-6 inline-flex items-center gap-3 text-3xl text-muted-foreground">
      <Users className="h-8 w-8" aria-hidden />
      <span><b className="text-foreground">{activity.answered}</b>{activity.offered ? ` of ${Math.max(activity.offered, activity.answered)}` : ''} answered</span>
    </p>
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
        <OptionRows options={activity.options ?? []} large counts={shown ? activity.results?.counts ?? null : null} />
      )}
      {activity.kind === 'mistake' && activity.question && (
        <div className="space-y-4">
          <QuestionBody question={activity.question} large />
          <OptionRows options={activity.question.options ?? []} large rich
            counts={shown ? activity.results?.counts ?? null : null}
            correct={shown ? correctIndices(activity.results?.correct) : undefined} />
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
            </div>
          ))}
        </div>
      )}
      {!shown && <Answered activity={activity} />}
    </div>
  );
}
