/**
 * The small floating toolbar for one highlight: four colours (three highlighters and an
 * underline, like Bluebook), a note, and — for an existing highlight — remove. The note editor
 * opens in place. Placed above the text with a mouse; below it on touch, where the OS menu sits
 * above, and lower still where a Look Up chip already waits under the selection.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, flip, offset, shift, useFloating, type Placement } from '@floating-ui/react-dom';
import { StickyNote, Trash2, Underline } from 'lucide-react';
import { EDGE } from '../../lib/guide/geometry';
import { isSelectionChrome } from '../lesson/lookup/useSelectionSettle';
import { ANNOTATION_COLORS, type AnnotationColor } from '../../lib/annotations/paint';
import { t } from '../../lib/i18n';
import '@/lib/i18n/catalogs/lessonPlayer';

export const MAX_NOTE_CHARS = 500;

const SWATCH: Record<AnnotationColor, string> = {
  yellow: 'bg-amber-300',
  pink: 'bg-pink-300',
  blue: 'bg-sky-300',
  underline: 'bg-background',
};
const LABEL = {
  yellow: 'lessonPlayer.annotate.yellow',
  pink: 'lessonPlayer.annotate.pink',
  blue: 'lessonPlayer.annotate.blue',
  underline: 'lessonPlayer.annotate.underline',
} as const;

export interface ToolbarProps {
  getRect: () => DOMRect | null;
  mode: 'create' | 'edit';
  color?: AnnotationColor;
  note?: string | null;
  startInNote?: boolean;
  touch: boolean;
  lookupBelow?: boolean;
  /** Look Up's card is open under the selection: stay above it, whatever the pointer. */
  lookupOpen?: boolean;
  onColor: (color: AnnotationColor) => void;
  onNote: (note: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export const AnnotationToolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(function AnnotationToolbar(
  { getRect, mode, color, note, startInNote, touch, lookupBelow, lookupOpen, onColor, onNote, onDelete, onClose },
  forwardedRef,
) {
  const [editing, setEditing] = useState(Boolean(startInNote));
  const [draft, setDraft] = useState(note ?? '');
  const own = useRef<HTMLDivElement | null>(null);

  const reference = useMemo(() => ({
    getBoundingClientRect: () => getRect() ?? new DOMRect(-9999, -9999, 0, 0),
  }), [getRect]);
  // Touch: under the selection (the OS menu is above), below Look Up's chip where there is one.
  // Once Look Up's card is open there, above it instead. Where Look Up shares the selection the
  // toolbar never flips down onto its card.
  const placement: Placement = touch && !lookupOpen ? 'bottom' : 'top';
  const { refs, floatingStyles } = useFloating({
    strategy: 'fixed',
    placement,
    elements: { reference },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(placement === 'bottom' && lookupBelow ? 56 : 10),
      ...(lookupBelow ? [] : [flip({ padding: EDGE })]),
      shift({ padding: EDGE }),
    ],
  });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      // Look Up works on the same selection: using its chip or card isn't «elsewhere».
      if (!own.current?.contains(event.target as Node) && !isSelectionChrome(event.target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const setNode = (node: HTMLDivElement | null) => {
    own.current = node;
    refs.setFloating(node);
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  // Keep the selection: a mouse press on a toolbar button must not collapse it first.
  const keepSelection = (event: React.MouseEvent) => event.preventDefault();

  return createPortal(
    <div
      ref={setNode}
      style={floatingStyles}
      data-annotation-toolbar="true"
      data-selection-chrome=""
      data-placement={placement}
      role={editing ? 'dialog' : 'toolbar'}
      aria-label={t('lessonPlayer.annotate.toolbar')}
      className="z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
    >
      {editing ? (
        <form
          className="flex w-[min(20rem,calc(100vw-16px))] flex-col gap-2 p-2"
          onSubmit={(event) => { event.preventDefault(); onNote(draft.trim()); }}
        >
          <textarea
            autoFocus
            value={draft}
            maxLength={MAX_NOTE_CHARS}
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('lessonPlayer.annotate.notePlaceholder')}
            aria-label={t('lessonPlayer.annotate.note')}
            className="w-full resize-none rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{draft.length}/{MAX_NOTE_CHARS}</span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
                {t('lessonPlayer.annotate.cancel')}
              </button>
              <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {t('lessonPlayer.annotate.save')}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-1 p-1.5">
          {ANNOTATION_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={keepSelection}
              onClick={() => onColor(c)}
              aria-label={t(LABEL[c])}
              aria-pressed={mode === 'edit' ? color === c : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-black/10 dark:ring-white/15 ${SWATCH[c]} ${
                mode === 'edit' && color === c ? 'outline outline-2 outline-offset-1 outline-primary' : ''
              }`}
            >
              {c === 'underline' && <Underline className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />}
            </button>
          ))}
          <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
          <button
            type="button"
            onMouseDown={keepSelection}
            onClick={() => setEditing(true)}
            aria-label={t(note ? 'lessonPlayer.annotate.editNote' : 'lessonPlayer.annotate.note')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <StickyNote className="h-4 w-4" aria-hidden />
          </button>
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t('lessonPlayer.annotate.delete')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
});
