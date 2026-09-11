import { useMemo, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { talkSummaryLine, type TalkLocale } from '../../lib/meetTalk';
import { blockSeekTarget, lessonAt } from '../../lib/transcriptFollow';
import type { TalkRecord } from '../../services/api/meetTalk';
import { Headline, Insights, Notes, Section, SplitBar, talkText } from './TalkPanel';
import { TalkGrid, type TalkFocus } from './TalkGrid';
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
  /** `side`: fills the player's right-hand column. `stacked`: a card below the video (narrow screens). */
  layout: 'side' | 'stacked';
  className?: string;
}

/**
 * Talk time beside a playing recording: the teacher/students split at the top, then the
 * transcript following the video, or who spoke when. Picking a block of the grid plays the video
 * from it and shows what was said in it.
 */
export function TalkSidePanel({ talk, locale, playhead, onSeek, showErrors = false, layout, className }: Props) {
  const t = TEXT[locale];
  const pieces = talkText(locale);
  const readable = talk.transcript?.state === 'ready';
  const [tab, setTab] = useState<Tab>(readable ? 'transcript' : 'who');
  const [focus, setFocus] = useState<TalkFocus | null>(null);
  const side = layout === 'side';
  const offset = talk.transcript?.recording_offset_seconds ?? null;
  const lines = useMemo(() => talk.transcript?.lines ?? [], [talk.transcript]);

  const pick = (next: TalkFocus | null) => {
    setFocus(next);
    if (!next) return;
    if (readable) setTab('transcript');
    const target = blockSeekTarget(lines, next, offset);
    if (target != null) onSeek?.(target);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'transcript', label: t.transcript },
    { key: 'who', label: t.who },
  ];

  return (
    <section
      aria-label={t.title}
      className={cn('flex min-h-0 flex-col bg-background', side ? 'h-full' : 'rounded-xl border border-border bg-card', className)}
    >
      <div className={cn('flex flex-col gap-2 border-b border-border px-4 pb-3 pt-4', side && 'pr-12')}>
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SplitBar teacher={talk.teacher_share} students={talk.students_share} className="w-24 flex-none" />
          <span className="text-[13px] tabular-nums text-foreground">{talkSummaryLine(talk, locale)}</span>
        </div>
      </div>

      <div role="tablist" aria-label={t.title} className="flex gap-1 border-b border-border px-3">
        {tabs.map(({ key, label }) => (
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
            focus={focus}
            onClearFocus={() => setFocus(null)}
            playhead={playhead}
            fill={side}
            narrow={side}
            short={!side}
            hideTitle
          />
        </div>
      ) : (
        <div role="tabpanel" className={cn('flex flex-col gap-5 px-4 py-4', side && 'min-h-0 flex-1 overflow-y-auto')}>
          <Headline talk={talk} t={pieces} locale={locale} />
          <Section title={pieces.timeline}>
            <TalkGrid
              talk={talk}
              locale={locale}
              focus={focus}
              onPick={pick}
              plays={Boolean(onSeek)}
              playhead={lessonAt(playhead, offset)}
              dense={side}
            />
            <Notes talk={talk} t={pieces} />
          </Section>
          <Insights talk={talk} t={pieces} />
        </div>
      )}
    </section>
  );
}
