import { useId, useState } from 'react';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { APP_TIMEZONE } from '../../lib/datetime';
import { canFixMark, canReviewFlag, flagText, isMismatch, reasonText } from '../../lib/meetAttendance';
import {
  restoreMeetFlag,
  reviewMeetFlag,
  type MeetFlag,
  type MeetFlagCode,
  type MeetRecord,
  type MeetReviewOptions,
} from '../../services/api/meetAttendance';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

export interface ReviewAnswer {
  reason_code: string | null;
  reason_text: string | null;
  fix_mark?: boolean;
}

/** What a flag needs to be answerable where it is shown. The callbacks resolve true once saved. */
export interface FlagReviewing {
  role: string | undefined;
  options: MeetReviewOptions | undefined;
  onReview: (userId: number, code: MeetFlagCode, answer: ReviewAnswer) => Promise<boolean>;
  onRestore: (userId: number, code: MeetFlagCode) => Promise<boolean>;
}

/**
 * The save and the undo for one lesson, with the toasts both places say the same way.
 * `onSaved` receives the lesson's record as it now reads.
 */
export function lessonReviewing(
  eventId: number,
  role: string | undefined,
  options: MeetReviewOptions | undefined,
  onSaved: (record: MeetRecord) => void,
): FlagReviewing {
  const onRestore = async (userId: number, code: MeetFlagCode) => {
    try {
      onSaved(await restoreMeetFlag(eventId, userId, code));
      toast.success('Back in Needs attention');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not put it back');
      return false;
    }
  };
  const onReview = async (userId: number, code: MeetFlagCode, answer: ReviewAnswer) => {
    try {
      onSaved(await reviewMeetFlag(eventId, { user_id: userId, code, ...answer }));
      if (answer.fix_mark) {
        toast.success('Mark corrected', { description: 'The journal now agrees with the room.' });
      } else {
        toast.success('Reviewed', {
          description: 'Out of Needs attention. «Show reviewed» brings it back.',
          action: { label: 'Undo', onClick: () => { void onRestore(userId, code); } },
        });
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the review');
      return false;
    }
  };
  return { role, options, onReview, onRestore };
}

// Optional flags offer "no reason" as a choice of its own; Radix radios want a non-empty value.
const NO_REASON = 'none';

const TONE = {
  mismatch: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
  timing: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900',
  reviewed: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700',
};

function when(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE });
}

function reviewedLine(flag: MeetFlag): string {
  const r = flag.review;
  if (!r) return '';
  return ['Reviewed', r.by ? `by ${r.by}` : null, when(r.at)].filter(Boolean).join(' · ');
}

/** The chip's face: what happened, and — once answered — a tick and the reason. */
function ChipFace({ flag, interactive }: { flag: MeetFlag; interactive?: boolean }) {
  const reason = reasonText(flag.review);
  return (
    <span
      className={cn(
        // Wraps rather than overflows: the lesson card's name column is only 7.5rem wide.
        'inline-flex max-w-full flex-wrap items-center gap-x-1 rounded px-1.5 py-px text-left text-[11px] font-medium leading-4 ring-1 ring-inset',
        flag.review ? TONE.reviewed : isMismatch(flag.code) ? TONE.mismatch : TONE.timing,
        interactive && 'cursor-pointer transition hover:brightness-95 dark:hover:brightness-125',
      )}
    >
      {flag.review && <Check className="h-3 w-3 flex-none" aria-label="Reviewed" />}
      <span className="min-w-0">{flagText(flag)}</span>
      {reason && <span className="min-w-0 max-w-full truncate font-normal">· {reason}</span>}
    </span>
  );
}

interface ChipProps {
  flag: MeetFlag;
  /** Whose flag; without it (or without `reviewing`) the chip only reads. */
  userId?: number;
  personName?: string;
  reviewing?: FlagReviewing;
  /** The same person was also late: a corrected absent mark becomes «Опоздал», not «Был». */
  lateToo?: boolean;
}

/** A flag as a chip. Where the viewer may answer it, the chip opens the review form. */
export function FlagChip({ flag, userId, personName, reviewing, lateToo = false }: ChipProps) {
  const option = reviewing?.options?.[flag.code];
  const title = flag.review ? `${reviewedLine(flag)}${reasonText(flag.review) ? `: ${reasonText(flag.review)}` : ''}` : undefined;
  if (!reviewing || userId == null || !option || !canReviewFlag(reviewing.role, flag.code)) {
    return <span title={title} className="inline-flex max-w-full"><ChipFace flag={flag} /></span>;
  }
  return (
    <ReviewPopover flag={flag} userId={userId} personName={personName} reviewing={reviewing} lateToo={lateToo} title={title} />
  );
}

function ReviewPopover({ flag, userId, personName, reviewing, lateToo, title }: Required<Omit<ChipProps, 'personName'>> & {
  personName?: string;
  title?: string;
}) {
  const option = reviewing.options?.[flag.code];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const formId = useId();

  if (!option) return null;
  const required = option.required;
  const chosen = reason === '' || reason === NO_REASON ? null : reason;
  const isOther = chosen === 'other';
  const valid = (!required || chosen !== null) && (!isOther || text.trim() !== '');
  const fixable = canFixMark(reviewing.role, flag.code);
  const fixLabel = flag.code === 'marked_present_not_joined' ? '«Не был»' : lateToo ? '«Опоздал»' : '«Был»';
  const showForm = !flag.review || editing;

  const reset = () => {
    setEditing(false);
    setReason(flag.review?.reason_code ?? (option?.required ? '' : NO_REASON));
    setText(flag.review?.text ?? '');
  };

  const run = async (work: () => Promise<boolean>) => {
    setBusy(true);
    const done = await work();
    setBusy(false);
    if (done) setOpen(false);
  };

  const save = () => run(() => reviewing.onReview(userId, flag.code, {
    reason_code: chosen,
    reason_text: text.trim() || null,
  }));

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title ?? 'Review this'}
          aria-label={`${flagText(flag)}${personName ? `, ${personName}` : ''}: ${flag.review ? 'reviewed, open' : 'review'}`}
          // The review list's rows open a lesson on click and on Enter: the chip keeps its own.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="inline-flex max-w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChipFace flag={flag} interactive />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 space-y-3 p-3"
        // Rendered in a portal, but React still bubbles its events to the row that owns the chip.
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div>
          {personName && <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{personName}</div>}
          <div className="text-sm font-semibold text-foreground">{flagText(flag)}</div>
        </div>

        {flag.review && !editing && (
          <>
            <div className="rounded-md bg-muted/60 px-3 py-2">
              <div className="text-[13px] font-medium text-foreground">{reasonText(flag.review) ?? 'Reviewed, no reason given'}</div>
              <div className="text-xs text-muted-foreground">{reviewedLine(flag)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>Change reason</Button>
              <Button size="sm" variant="ghost" disabled={busy}
                onClick={() => run(() => reviewing.onRestore(userId, flag.code))}>
                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                Back to Needs attention
              </Button>
            </div>
          </>
        )}

        {showForm && (
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void save(); }}
          >
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
                Reason {required ? '(required)' : '(optional)'}
              </legend>
              <RadioGroup value={reason} onValueChange={setReason} className="gap-1.5">
                {!required && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={NO_REASON} id={`${formId}-none`} />
                    <Label htmlFor={`${formId}-none`} className="text-[13px] font-normal text-muted-foreground">No reason</Label>
                  </div>
                )}
                {option.reasons.map((r) => (
                  <div key={r.key} className="flex items-center gap-2">
                    <RadioGroupItem value={r.key} id={`${formId}-${r.key}`} />
                    <Label htmlFor={`${formId}-${r.key}`} className="text-[13px] font-normal">{r.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
            <Textarea
              id={`${formId}-text`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={isOther ? 'What happened? (required)' : 'Comment (optional)'}
              aria-label={isOther ? 'What happened' : 'Comment'}
              className="min-h-[52px] text-[13px]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={!valid || busy}>
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {flag.review ? 'Save reason' : 'Mark reviewed'}
              </Button>
              {editing && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={reset}>Cancel</Button>}
            </div>
          </form>
        )}

        {fixable && (
          <div className="space-y-1.5 border-t border-border pt-3">
            <Button type="button" size="sm" variant="outline" className="w-full" disabled={busy}
              onClick={() => run(() => reviewing.onReview(userId, flag.code, { reason_code: null, reason_text: null, fix_mark: true }))}>
              Mark {fixLabel} instead
            </Button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Corrects the journal mark, the same as changing it there. The flag then goes away.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
