import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Timer } from 'lucide-react';
import { cn } from '../../lib/utils';
import { renderTextWithLatex } from '../../utils/latex';
import { sanitizeHtml } from '../../lib/safeHtml';
import { LETTERS, cloudSize, formatSeconds, percents } from '../../lib/liveLesson/logic';
import type { ActivityView, CloudGroup, LiveOption, Person, PublicQuestion } from '../../lib/liveLesson/types';
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/chatLive';
import { OrcaStack } from './orcas';

const KIND_KEYS: Record<ActivityView['kind'], MessageKey> = {
  poll: 'chatLive.live.kind.poll',
  cloud: 'chatLive.live.kind.cloud',
  popcheck: 'chatLive.live.kind.popcheck',
  mistake: 'chatLive.live.kind.mistake',
};

/** How an activity reads in one line («Poll», «Word cloud»…) — logic.activityLabel in the user's language. */
export function activityKindKey(kind: ActivityView['kind']): MessageKey {
  return KIND_KEYS[kind];
}

const GAP = '{{gap}}';
const BLANK = '▁▁▁▁';

/** Course text with formulas (quiz content is authored by staff, as in the quiz itself). */
export function RichText({ text, className }: { text: string; className?: string }) {
  return <div className={cn('live-rich break-words [&_p]:my-1', className)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(text)) }} />;
}

/** A quiz question as a student sees it: passage (folded when long), text, image. */
export function QuestionBody({ question, gapText, large }: { question: PublicQuestion; gapText?: string | null; large?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const fill = (s: string) => s.split(GAP).join(gapText ? `**${gapText}**` : BLANK);
  const passage = question.passage ? fill(question.passage) : null;
  const long = Boolean(passage && passage.length > 320 && !large);
  return (
    <div className={cn('space-y-2', large ? 'text-2xl leading-snug' : 'text-[15px]')}>
      {passage && (
        <div className={cn('rounded-lg border border-border bg-muted/40 p-3 text-foreground', large ? 'text-xl' : 'text-sm')}>
          <div className={cn(long && !open && 'line-clamp-4')}><RichText text={passage} /></div>
          {long && (
            <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
              {open ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />}
              {open ? t('chatLive.live.showLess') : t('chatLive.live.showWholeText')}
            </button>
          )}
        </div>
      )}
      {question.text && <RichText text={fill(question.text)} className="font-medium text-foreground" />}
      {question.media_url && (
        <img src={question.media_url} alt="" className="max-h-64 w-auto max-w-full rounded-lg border border-border object-contain" />
      )}
    </div>
  );
}

interface OptionRowsProps {
  options: (LiveOption | string)[];
  selected?: number[];
  onPick?: (index: number) => void;
  disabled?: boolean;
  /** After «Show»: the right options. */
  correct?: number[];
  /** Totals, drawn as bars behind each option. */
  counts?: number[] | null;
  large?: boolean;
  rich?: boolean;
  /** A named reveal: the orcas of who picked each option. */
  voters?: Person[][] | null;
}

/** Answer options, tappable while open; after «Show», bars with percentages and the right one. */
export function OptionRows({ options, selected = [], onPick, disabled, correct, counts, large, rich, voters }: OptionRowsProps) {
  const shares = counts ? percents(counts) : null;
  return (
    <div className="grid gap-2">
      {options.map((raw, i) => {
        const option = typeof raw === 'string' ? { text: raw, image_url: null } : raw;
        // An A/B/C/D preset is its own letter: the badge says it, the text would only repeat it.
        const label = option.text.trim() === (LETTERS[i] ?? '') ? '' : option.text;
        const mine = selected.includes(i);
        const right = correct?.includes(i);
        const content = (
          <>
            {shares && (
              <span aria-hidden className={cn('absolute inset-y-0 left-0 rounded-[inherit] transition-all duration-500',
                right ? 'bg-emerald-500/25' : 'bg-primary/15')} style={{ width: `${shares[i]}%` }} />
            )}
            <span className={cn('relative flex flex-none items-center justify-center rounded-full font-bold',
              large ? 'h-10 w-10 text-lg' : 'h-7 w-7 text-xs',
              right ? 'bg-emerald-600 text-white' : mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
              {right ? <Check className={large ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden /> : LETTERS[i] ?? i + 1}
            </span>
            <span className="relative min-w-0 flex-1 text-left">
              {rich ? <RichText text={label} /> : <span className="break-words">{label}</span>}
              {option.image_url && <img src={option.image_url} alt="" className="mt-1 max-h-28 rounded border border-border" />}
            </span>
            {voters?.[i]?.length ? (
              <OrcaStack people={voters[i]} size={large ? 40 : 22} max={large ? 8 : 5} pop className="relative flex-none" />
            ) : null}
            {shares && (
              <span className={cn('relative flex-none tabular-nums font-semibold', large ? 'text-2xl' : 'text-sm')}>
                {shares[i]}%{counts && !large ? <span className="ml-1 text-xs font-normal text-muted-foreground">({counts[i]})</span> : null}
              </span>
            )}
          </>
        );
        const cls = cn('relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 text-foreground',
          large ? 'min-h-[4rem] py-3 text-2xl' : 'min-h-[3rem] py-2 text-[15px]',
          mine ? 'border-primary ring-2 ring-primary/40' : 'border-border',
          right && 'border-emerald-500');
        return onPick ? (
          <button key={i} type="button" disabled={disabled} onClick={() => onPick(i)} aria-pressed={mine}
            className={cn(cls, 'bg-card transition hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-card')}>
            {content}
          </button>
        ) : (
          <div key={i} className={cn(cls, 'bg-card')}>{content}</div>
        );
      })}
    </div>
  );
}

/** The visible word cloud: bigger for more students, wrapping on a phone. */
export function CloudView({ groups, large }: { groups: CloudGroup[]; large?: boolean }) {
  const t = useT();
  if (!groups.length) return <p className="text-sm text-muted-foreground">{t('chatLive.live.noAnswersYet')}</p>;
  const max = Math.max(...groups.map((g) => g.count));
  const palette = ['text-primary', 'text-emerald-600 dark:text-emerald-400', 'text-amber-600 dark:text-amber-400',
    'text-sky-600 dark:text-sky-400', 'text-rose-600 dark:text-rose-400'];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2">
      {groups.map((g, i) => (
        <span key={g.text} className={cn('font-semibold leading-tight', palette[i % palette.length])}
          style={{ fontSize: `${cloudSize(g.count, max) * (large ? 1.8 : 1)}rem` }} title={`${g.count}`}>
          {g.text}
        </span>
      ))}
    </div>
  );
}

/** A countdown that calls `onEnd` once when it reaches zero while running. */
export function Countdown({ seconds, paused, large, onEnd }: { seconds: number | null; paused?: boolean; large?: boolean; onEnd?: () => void }) {
  const t = useT();
  const ended = useRef(false);
  useEffect(() => {
    if (seconds == null || seconds > 0) { ended.current = false; return; }
    if (!paused && !ended.current) {
      ended.current = true;
      onEnd?.();
    }
  }, [seconds, paused, onEnd]);
  if (seconds == null) return null;
  const up = seconds <= 0;
  return (
    <span role="timer" aria-live={up ? 'assertive' : 'off'}
      className={cn('inline-flex items-center gap-1.5 rounded-full font-bold tabular-nums',
        large ? 'px-5 py-2 text-5xl' : 'px-2.5 py-0.5 text-sm',
        up ? 'bg-rose-600 text-white' : seconds <= 10 ? 'bg-amber-500 text-white' : 'bg-muted text-foreground')}>
      <Timer className={large ? 'h-9 w-9' : 'h-3.5 w-3.5'} aria-hidden />
      {up ? t('chatLive.live.timesUp') : formatSeconds(seconds)}
      {paused && !up && <span className={cn('font-medium', large ? 'text-2xl' : 'text-[11px]')}>{t('chatLive.live.paused')}</span>}
    </span>
  );
}
