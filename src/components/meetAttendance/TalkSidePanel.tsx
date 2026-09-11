import { useMemo, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { talkSummaryLine, type TalkLocale } from '../../lib/meetTalk';
import { blockSeekTarget, lessonAt, recordingAt } from '../../lib/transcriptFollow';
import type { TalkRecord } from '../../services/api/meetTalk';
import { Headline, Insights, Notes, Section, SplitBar, talkText } from './TalkPanel';
import { TalkStrips } from './TalkStrips';
import { TalkTranscript } from './TalkTranscript';

const TEXT = {
  en: { title: 'Talk time', transcript: 'Transcript', who: 'Who spoke' },
  ru: { title: 'Время речи', transcript: 'Расшифровка', who: 'Кто говорил' },
} as const;

type Tab = 'transcript' | 'who';

interface Props {
  talk: TalkRecord;
  locale: TalkLocale;
  /** The video's time in recording seconds; null before it has any. */
  playhead: number | null;
  /** Plays the video from a moment of the recording. */
  onSeek?: (recordingSeconds: number) => void;
  showErrors?: boolean;
  /** `side`: fills a right-hand column. `stacked`: a card below the video (narrow screens). */
  layout: 'side' | 'stacked';
  /**
   * `staff`: the transcript following the video, and who spoke. `public` (the CRM watch page): who
   * spoke only — no transcript, no interaction figures; students' words stay inside the LMS.
   */
  variant?: 'staff' | 'public';
  className?: string;
}

/**
 * Talk time beside a playing recording: the teacher/students split at the top, then the
 * transcript following the video, or who spoke when — minute by minute, under full names, with the
 * video's position running through it. Clicking a minute plays the video from it.
 */
export function TalkSidePanel({ talk, locale, playhead, onSeek, showErrors = false, layout, variant = 'staff', className }: Props) {
  const t = TEXT[locale];
  const pieces = talkText(locale);
  const staff = variant === 'staff';
  const readable = staff && talk.transcript?.state === 'ready';
  const [tab, setTab] = useState<Tab>(readable ? 'transcript' : 'who');
  const side = layout === 'side';
  // The lesson's place in the recording: the talk record's own, else the transcript's.
  const offset = talk.recording_offset_seconds ?? talk.transcript?.recording_offset_seconds ?? null;
  const lines = useMemo(() => talk.transcript?.lines ?? [], [talk.transcript]);

  // A minute picked in the strips plays from the first thing that person said in it, else from its start.
  const seekMinute = onSeek && offset != null
    ? (lessonSeconds: number, key: string | null) => {
      const target = readable
        ? blockSeekTarget(lines, { key, from: lessonSeconds, to: lessonSeconds + 60 }, offset)
        : recordingAt(lessonSeconds, offset);
      if (target != null) onSeek(target);
    }
    : undefined;

  const who = (
    <div role={staff ? 'tabpanel' : undefined} className={cn('flex flex-col gap-5 px-4 py-4', side && 'min-h-0 flex-1 overflow-y-auto')}>
      <Headline talk={talk} t={pieces} locale={locale} columns={2} />
      <Section title={pieces.timeline}>
        <TalkStrips talk={talk} locale={locale} playhead={lessonAt(playhead, offset)} onSeek={seekMinute} />
        <Notes talk={talk} t={pieces} />
      </Section>
      {staff && <Insights talk={talk} t={pieces} columns={2} />}
    </div>
  );

  return (
    <section
      aria-label={t.title}
      className={cn('flex min-h-0 flex-col bg-background', side ? 'h-full' : 'rounded-xl border border-border bg-card', className)}
    >
      <div className={cn('flex flex-col gap-2 border-b border-border px-4 pb-3 pt-4', side && staff && 'pr-12')}>
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SplitBar teacher={talk.teacher_share} students={talk.students_share} className="w-24 flex-none" />
          <span className="text-[13px] tabular-nums text-foreground">{talkSummaryLine(talk, locale)}</span>
        </div>
      </div>

      {staff ? (
        <>
          <div role="tablist" aria-label={t.title} className="flex gap-1 border-b border-border px-3">
            {([['transcript', t.transcript], ['who', t.who]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn('-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'transcript' ? (
            <div role="tabpanel" className={cn('flex min-h-0 flex-col px-4 py-3', side && 'flex-1')}>
              <TalkTranscript
                transcript={talk.transcript}
                start={talk.start}
                locale={locale}
                onSeek={onSeek}
                showErrors={showErrors}
                playhead={playhead}
                fill={side}
                narrow={side}
                short={!side}
                hideTitle
              />
            </div>
          ) : who}
        </>
      ) : who}
    </section>
  );
}
