/**
 * Look Up in lesson text (owner's rules, 2026-10-07): select a word or a sentence and the card
 * opens by itself once the selection has settled. On touch screens, where selecting opens the OS
 * menu, a small «Look up» chip waits for a tap instead. The card follows the selection while the
 * lesson scrolls, flips and shifts to stay on screen, closes on Escape, a click elsewhere or the
 * close button, and aborts its request whenever it closes or the selection changes.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, flip, hide, offset, shift, size, useFloating } from '@floating-ui/react-dom';
import { Search } from 'lucide-react';
import { viewportClamp } from '../guide/useAnchoredCard';
import { EDGE } from '../../lib/guide/geometry';
import { useSettings } from '../../contexts/SettingsContext';
import { quickCreateFlashcard } from '../../services/api';
import type { LookupLang, LookupMode } from '../../services/api/lookup';
import { LookupCard, type SaveState } from './lookup/LookupCard';
import { useLookupLang } from './lookup/lookupLang';
import { cleanSelection, selectionKind } from './lookup/selection';
import { useLookupStream } from './lookup/useLookupStream';
import { useSelectionSettle, type SettledSelection } from './lookup/useSelectionSettle';

interface Target extends SettledSelection {
  kind: 'word' | 'phrase' | 'too_long';
  cleaned: string;
  /** False while the touch chip waits for a tap. */
  armed: boolean;
}

interface TextLookupPopoverProps {
  containerRef: React.RefObject<HTMLElement>;
  /** Off for quiz questions and checkpoints (lookupAllowed in ./lookup/selection). */
  enabled?: boolean;
}

const sameRange = (a: Range, b: Range) =>
  a.compareBoundaryPoints(Range.START_TO_START, b) === 0 && a.compareBoundaryPoints(Range.END_TO_END, b) === 0;

export const TextLookupPopover: React.FC<TextLookupPopoverProps> = ({ containerRef, enabled = true }) => {
  const { isLookUpEnabled } = useSettings();
  const active = enabled && isLookUpEnabled;
  const [lang, setLang] = useLookupLang();
  const { state, start, reset } = useLookupStream();
  const [target, setTarget] = useState<Target | null>(null);
  const [save, setSave] = useState<SaveState>('idle');
  const floatingEl = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const targetRef = useRef<Target | null>(null);
  targetRef.current = target;
  const labelId = useId();

  const reference = useMemo(
    () =>
      target && {
        getBoundingClientRect: () => target.range.getBoundingClientRect(),
        getClientRects: () => target.range.getClientRects(),
        contextElement: containerRef.current ?? undefined,
      },
    [target, containerRef],
  );

  const { refs, floatingStyles, middlewareData } = useFloating({
    strategy: 'fixed',
    placement: 'bottom',
    elements: { reference },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(10),
      flip({ padding: EDGE }),
      shift({ padding: EDGE }),
      size({
        padding: EDGE,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.max(160, Math.floor(availableHeight))}px`;
        },
      }),
      hide({ strategy: 'referenceHidden' }),
      // The tour's last word: whatever the rest decided, the card ends up fully on screen.
      viewportClamp(),
    ],
  });

  const run = useCallback(
    (next: Target, language: LookupLang) => {
      setSave('idle');
      start({ text: next.cleaned, context: next.context, lang: language, mode: next.kind as LookupMode });
    },
    [start],
  );

  const close = useCallback(() => {
    reset();
    setTarget(null);
    if (returnFocus.current && floatingEl.current?.contains(document.activeElement)) {
      returnFocus.current.focus({ preventScroll: true });
    }
    returnFocus.current = null;
  }, [reset]);

  const onSettle = useCallback(
    (selection: SettledSelection | null) => {
      const current = targetRef.current;
      if (!selection) {
        if (current && !current.armed) close(); // the chip goes with its selection
        return;
      }
      const kind = selectionKind(selection.text);
      if (kind === 'empty') return;
      if (current && current.text === selection.text && sameRange(current.range, selection.range)) return;
      const next: Target = { ...selection, kind, cleaned: cleanSelection(selection.text), armed: !selection.touch || kind === 'too_long' };
      setTarget(next);
      if (kind === 'too_long' || !next.armed) {
        reset();
        return;
      }
      run(next, lang);
    },
    [close, reset, run, lang],
  );

  useSelectionSettle(containerRef, [floatingEl], active, onSettle);

  // A click anywhere but the card closes it; Escape too; Tab steps into it without having
  // taken focus (or the selection) when it opened.
  useEffect(() => {
    if (!target) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!floatingEl.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const card = floatingEl.current;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'Tab' && !event.shiftKey && card && !card.contains(document.activeElement)) {
        const first = card.querySelector<HTMLElement>('button:not([disabled])');
        if (first) {
          event.preventDefault();
          returnFocus.current = document.activeElement as HTMLElement | null;
          first.focus();
        }
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [target, close]);

  useEffect(() => {
    if (!active && targetRef.current) close();
  }, [active, close]);

  const chooseLang = (next: LookupLang) => {
    setLang(next);
    if (target?.armed && target.kind !== 'too_long') run(target, next);
  };

  const onSave = async () => {
    const result = state.result;
    if (!target || !result) return;
    setSave('saving');
    try {
      if (result.mode === 'word') {
        await quickCreateFlashcard({
          kind: 'word', word: result.headword || target.cleaned, translation: result.translation ?? '',
          definition: result.definition ?? undefined, context: target.context, lang: state.lang,
        });
      } else {
        await quickCreateFlashcard({
          kind: 'phrase', word: target.cleaned, translation: result.translation, glosses: result.glosses, lang: state.lang,
        });
      }
      setSave('saved');
    } catch {
      setSave('failed');
    }
  };

  if (!active || !target) return null;

  const hidden = Boolean(middlewareData.hide?.referenceHidden);
  return createPortal(
    <div
      ref={(node) => {
        floatingEl.current = node;
        refs.setFloating(node);
      }}
      style={{ ...floatingStyles, visibility: hidden ? 'hidden' : undefined }}
      className="z-50 flex"
    >
      {target.armed ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={labelId}
          data-lookup-card={target.kind}
          className="flex max-h-[inherit] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
        >
          <LookupCard
            kind={target.kind}
            selection={target.cleaned}
            state={state}
            lang={lang}
            labelId={labelId}
            save={save}
            onLang={chooseLang}
            onClose={close}
            onRetry={() => run(target, lang)}
            onSave={onSave}
          />
        </div>
      ) : (
        <button
          type="button"
          data-lookup-chip
          onClick={() => {
            const armed = { ...target, armed: true };
            setTarget(armed);
            run(armed, lang);
          }}
          className="relative inline-flex h-10 items-center gap-2 rounded-full border border-border bg-popover px-4 text-sm font-medium text-popover-foreground shadow-lg after:absolute after:-inset-1.5 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
        >
          <Search className="h-4 w-4 text-brand" aria-hidden />
          Look up
        </button>
      )}
    </div>,
    document.body,
  );
};

export default TextLookupPopover;
