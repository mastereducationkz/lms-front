/**
 * The Look Up card: a dictionary entry for 1–3 words, «translate and explain» for a phrase or a
 * sentence, or a hint when the selection is too long. Fields fill in as they stream, in the order
 * they arrive (translation first), so nothing already on screen moves.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { BookmarkPlus, Check, CircleAlert, Hourglass, Loader2, RotateCcw, TextSelect, X } from 'lucide-react';
import { Skeleton } from '../../ui/skeleton';
import type { LookupLang } from '../../../services/api/lookup';
import { MAX_LOOKUP_CHARS } from './selection';
import type { LookupState } from './useLookupStream';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export interface LookupCardProps {
  kind: 'word' | 'phrase' | 'too_long';
  /** The selection, whitespace collapsed. */
  selection: string;
  state: LookupState;
  lang: LookupLang;
  labelId: string;
  save: SaveState;
  onLang: (lang: LookupLang) => void;
  onClose: () => void;
  onRetry: () => void;
  onSave: () => void;
}

// Buttons keep the reader's selection: a click inside the card must not collapse it.
const keepSelection = (event: React.MouseEvent) => event.preventDefault();

const LANGS: Array<{ value: LookupLang; label: string; name: string }> = [
  { value: 'ru', label: 'RU', name: 'Russian' },
  { value: 'kk', label: 'KZ', name: 'Kazakh' },
];

function LangToggle({ lang, onLang }: { lang: LookupLang; onLang: (lang: LookupLang) => void }) {
  return (
    <div role="group" aria-label="Translation language" className="inline-flex shrink-0 rounded-md border border-border bg-muted p-0.5">
      {LANGS.map((option) => {
        const active = option.value === lang;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={`Translate into ${option.name}`}
            title={`Translate into ${option.name}`}
            onMouseDown={keepSelection}
            onClick={() => !active && onLang(option.value)}
            className={`h-6 min-w-[2.25rem] rounded-[5px] px-2 text-[11px] font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? 'bg-brand-surface text-brand-subtle-foreground ring-1 ring-inset ring-brand-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={keepSelection}
      onClick={onClick}
      className="-mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

/** The example sentence with the headword picked out. */
function Example({ text, headword }: { text: string; headword: string }) {
  const word = headword.trim();
  if (!word) return <>{text}</>;
  const parts = text.split(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*)`, 'i'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <span key={i} className="font-medium not-italic text-foreground">{part}</span> : part,
      )}
    </>
  );
}

function RateLimited({ message, retryAfter, onRetry }: { message: string; retryAfter?: number; onRetry: () => void }) {
  // A per-minute limit counts down to its retry; a daily one has nothing to wait for today.
  const daily = (retryAfter ?? 0) > 120;
  const [left, setLeft] = useState(daily ? 0 : retryAfter ?? 0);
  useEffect(() => {
    if (daily || left <= 0) return;
    const timer = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [daily, left]);
  return (
    <Notice icon={<Hourglass className="h-4 w-4" aria-hidden />} message={message}>
      {!daily && (
        <RetryButton onRetry={onRetry} disabled={left > 0}>
          {left > 0 ? `Try again in ${left} s` : 'Try again'}
        </RetryButton>
      )}
    </Notice>
  );
}

function Notice({ icon, message, children }: { icon: ReactNode; message: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-4 pb-4 pt-1">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground">{message}</p>
        {children && <div className="mt-2.5">{children}</div>}
      </div>
    </div>
  );
}

function RetryButton({ onRetry, disabled, children }: { onRetry: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={keepSelection}
      onClick={onRetry}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      {children}
    </button>
  );
}

const fade = 'animate-in fade-in-0 duration-200 motion-reduce:animate-none';

/** A placeholder line, a step darker than bg-muted so it reads on the popover in both themes. */
const Bar = ({ className }: { className: string }) => <Skeleton className={`bg-foreground/[0.08] ${className}`} />;

export function LookupCard(props: LookupCardProps) {
  const { kind, selection, state, lang, labelId, save, onLang, onClose, onRetry, onSave } = props;

  if (kind === 'too_long') {
    return (
      <div className="flex items-start gap-2.5 px-4 py-3.5">
        <TextSelect className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <p id={labelId} className="text-sm font-semibold text-foreground">Select up to a sentence or two</p>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Look Up explains words, phrases and sentences up to {MAX_LOOKUP_CHARS} characters. This selection has {selection.length}.
          </p>
        </div>
        <IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
      </div>
    );
  }

  const { fields, finished, glosses, status, error } = state;
  const busy = status === 'loading' || status === 'streaming';
  const done = status === 'done';
  const headword = fields.headword || selection;
  const announcement = [
    finished.translation && fields.translation && `Translation: ${fields.translation}.`,
    finished.definition && fields.definition && `Definition: ${fields.definition}.`,
  ].filter(Boolean).join(' ');

  const header = (
    <div className="flex items-start gap-2 px-4 pb-1.5 pt-3">
      <div className="min-w-0 flex-1 pt-0.5">
        {kind === 'word' ? (
          <p id={labelId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="break-words text-base font-semibold leading-tight tracking-tight text-foreground">{headword}</span>
            {fields.pos ? (
              <span className={`text-xs italic text-muted-foreground ${fade}`}>{fields.pos}</span>
            ) : busy ? (
              <Bar className="h-3 w-14 translate-y-0.5" />
            ) : null}
          </p>
        ) : (
          <p id={labelId} className="text-sm font-semibold leading-tight text-foreground">Translation</p>
        )}
      </div>
      <LangToggle lang={lang} onLang={onLang} />
      <IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
    </div>
  );

  let body: ReactNode;
  if (status === 'error' && error) {
    body = error.code === 'rate_limited'
      ? <RateLimited key={state.id} message={error.message} retryAfter={error.retryAfter} onRetry={onRetry} />
      : (
        <Notice icon={<CircleAlert className="h-4 w-4" aria-hidden />} message={error.message}>
          <RetryButton onRetry={onRetry}>Try again</RetryButton>
        </Notice>
      );
  } else if (kind === 'word') {
    body = (
      <div className="space-y-2 px-4 pb-3.5" aria-busy={busy}>
        {fields.translation ? (
          <p className={`text-[17px] font-medium leading-snug text-foreground ${fade}`} lang={lang === 'kk' ? 'kk' : 'ru'}>
            {fields.translation}
          </p>
        ) : busy ? <Bar className="h-5 w-3/5" /> : null}
        {fields.definition ? (
          <p className={`text-sm leading-relaxed text-foreground/85 ${fade}`}>{fields.definition}</p>
        ) : busy ? (
          <div className="space-y-1.5 pt-0.5"><Bar className="h-3.5 w-full" /><Bar className="h-3.5 w-4/5" /></div>
        ) : null}
        {fields.example ? (
          <p className={`text-[13px] italic leading-relaxed text-muted-foreground ${fade}`}>
            <Example text={fields.example} headword={headword} />
          </p>
        ) : busy && finished.definition ? <Bar className="h-3 w-2/3" /> : null}
      </div>
    );
  } else {
    body = (
      <div className="space-y-3 px-4 pb-3.5" aria-busy={busy}>
        {fields.translation ? (
          <p className={`text-[15px] leading-relaxed text-foreground ${fade}`} lang={lang === 'kk' ? 'kk' : 'ru'}>
            {fields.translation}
          </p>
        ) : (
          <div className="space-y-1.5 pt-0.5"><Bar className="h-4 w-full" /><Bar className="h-4 w-11/12" /><Bar className="h-4 w-2/3" /></div>
        )}
        {(glosses.length > 0 || (busy && finished.translation)) && (
          <div className="border-t border-border pt-2.5">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Words to know</p>
            <ul className="space-y-2">
              {glosses.map((gloss) => (
                <li key={gloss.term} className={`text-sm leading-snug ${fade}`}>
                  <span className="font-medium text-foreground">{gloss.term}</span>
                  {gloss.meaning && <span className="text-foreground"> — {gloss.meaning}</span>}
                  {gloss.note && <span className="block text-[13px] text-muted-foreground">{gloss.note}</span>}
                </li>
              ))}
              {busy && <li><Bar className="h-3.5 w-3/4" /></li>}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      {done && (
        <div className="flex items-center border-t border-border px-4 py-2.5">
          {save === 'saved' ? (
            <p className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {kind === 'word' ? 'Saved to your flashcards' : 'Phrase card saved'}
            </p>
          ) : (
            <button
              type="button"
              onMouseDown={keepSelection}
              onClick={onSave}
              disabled={save === 'saving'}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 -ml-2 text-xs font-medium text-brand transition-colors hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {save === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />}
              {kind === 'word' ? 'Save to flashcards' : 'Save as a phrase card'}
            </button>
          )}
          {save === 'failed' && <span className="ml-2 text-xs text-destructive dark:text-red-400">Couldn't save. Try again.</span>}
        </div>
      )}
      <div aria-live="polite" className="sr-only">{announcement}</div>
    </>
  );
}
