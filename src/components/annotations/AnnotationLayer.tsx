/**
 * Highlights and notes on any text a student reads (owner, 2026-11-02, Tier 1): quiz passages and
 * questions, homework text, lesson text. Mark a text block with `annotationBlock(scope, key)` and
 * render one <AnnotationLayer scope=…> for it; the layer
 *   - paints the viewer's highlights (CSS Custom Highlight API, or drawn rectangles where the
 *     browser lacks it), re-finding each one if the text moved (src/lib/annotations/anchor.ts);
 *   - opens the toolbar on a settled selection inside one block (mouse, keyboard or touch) and on
 *     a tap on an existing highlight; a note shows as a small badge at the highlight's end;
 *   - moves the old device-only quiz highlights to the server once;
 *   - counts use as `<surface>.highlight` (students only), the Tier 0 metric.
 * Nothing is inserted into the text itself.
 */
import React, { useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StickyNote } from 'lucide-react';
import { MAX_QUOTE_CHARS, anchorForQuote, anchorFromRange, blockText, rangeFromOffsets, resolveAnchor, type Anchor } from '../../lib/annotations/anchor';

/** The server takes at most this many items per import. */
const MAX_IMPORT_ITEMS = 200;
import { clearLayer, paintLayer, supportsHighlightApi, type AnnotationColor, type PaintEntry } from '../../lib/annotations/paint';
import { importAnnotations, type AnnotationSurface } from '../../services/api/annotations';
import { reportUsage } from '../../services/api/usage';
import { reportError } from '../../lib/sentry';
import { useSelectionSettle, type SettledSelection } from '../lesson/lookup/useSelectionSettle';
import AuthContext from '../../contexts/AuthContext';
import { AnnotationToolbar } from './AnnotationToolbar';
import { useAnnotations } from './useAnnotations';
import { t } from '../../lib/i18n';
import '@/lib/i18n/catalogs/lessonPlayer';

export { annotationBlock } from '../../lib/annotations/block';

/** An old quiz highlight from localStorage: whitespace-collapsed text, any of a question's blocks. */
export interface LegacyHighlight {
  blockKeys: string[];
  quote: string;
  color: AnnotationColor;
}

interface Props {
  surface: AnnotationSurface;
  targetId: number | null | undefined;
  scope: string;
  attempt?: 'current' | 'latest';
  readOnly?: boolean;
  /** A Look Up chip waits under touch selections in these blocks (all, or those it names). */
  lookupBelow?: boolean | ((blockKey: string) => boolean);
  legacy?: { read: () => LegacyHighlight[]; keep: (left: LegacyHighlight[]) => void };
}

type Toolbar =
  | { mode: 'create'; blockKey: string; anchor: Anchor; touch: boolean }
  | { mode: 'edit'; id: number; touch: boolean; startInNote?: boolean };

interface Box { x: number; y: number; w: number; h: number }
interface OverlayItem { id: number; color: AnnotationColor; note: string | null; rects: Box[] }

const FALLBACK_FILL: Record<AnnotationColor, string> = {
  yellow: 'bg-amber-300/45 dark:bg-amber-500/35',
  pink: 'bg-pink-300/45 dark:bg-pink-500/35',
  blue: 'bg-sky-300/45 dark:bg-sky-500/35',
  underline: 'bg-red-600 dark:bg-red-400',
};

const escapeAttr = (value: string) => {
  const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS;
  return css?.escape ? css.escape(value) : value.replace(/["\\]/g, '\\$&');
};

let paintErrorReported = false;
const reportPaintError = (error: unknown) => {
  if (paintErrorReported) return;
  paintErrorReported = true;
  reportError(error, { where: 'annotations.paint' });
};

const coarsePointer = () => {
  try { return window.matchMedia('(hover: none) and (pointer: coarse)').matches; } catch { return false; }
};

export function AnnotationLayer({ surface, targetId, scope, attempt = 'current', readOnly, lookupBelow, legacy }: Props) {
  const enabled = Boolean(targetId);
  const { items, loaded, create, update, remove, reload } = useAnnotations(surface, targetId, attempt, enabled);
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [overlay, setOverlay] = useState<OverlayItem[]>([]);
  const [openNote, setOpenNote] = useState<number | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const layerId = useId();
  const apiPaint = useRef(supportsHighlightApi()).current;
  const painted = useRef(new Map<number, { range: Range; blockKey: string }>());
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLElement>(typeof document !== 'undefined' ? document.body : null);
  const isStudent = useContext(AuthContext)?.user?.role === 'student';

  const count = useCallback((action: string) => {
    if (isStudent) reportUsage(`${surface}.highlight`, action);
  }, [isStudent, surface]);

  const blocks = useCallback(() => {
    const map = new Map<string, HTMLElement>();
    document.querySelectorAll<HTMLElement>(`[data-annotation-scope="${escapeAttr(scope)}"][data-annotation-block]`)
      .forEach((el) => { if (!map.has(el.dataset.annotationBlock!)) map.set(el.dataset.annotationBlock!, el); });
    return map;
  }, [scope]);

  const blockOf = useCallback((node: Node | null): HTMLElement | null => {
    const el = node instanceof Element ? node : node?.parentElement;
    const block = el?.closest<HTMLElement>('[data-annotation-block]');
    return block && block.dataset.annotationScope === scope ? block : null;
  }, [scope]);

  // ── painting ────────────────────────────────────────────────────────────────────────────────
  const measure = useCallback(() => {
    const next: OverlayItem[] = [];
    for (const [id, { range }] of painted.current) {
      const a = items.find((x) => x.id === id);
      if (!a || (apiPaint && !a.note)) continue;
      const rects = Array.from(range.getClientRects())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }));
      if (rects.length) next.push({ id, color: a.color, note: a.note, rects: apiPaint ? rects.slice(-1) : rects });
    }
    setOverlay((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [items, apiPaint]);

  const paint = useCallback(() => {
    const found = blocks();
    const entries: PaintEntry[] = [];
    const map = new Map<number, { range: Range; blockKey: string }>();
    const texts = new Map<string, string>();
    for (const a of items) {
      const el = found.get(a.block_key);
      if (!el) continue;
      if (!texts.has(a.block_key)) texts.set(a.block_key, blockText(el));
      const pos = resolveAnchor(texts.get(a.block_key)!, { start: a.start_offset, end: a.end_offset, quote: a.quote, prefix: a.prefix, suffix: a.suffix });
      const range = pos && rangeFromOffsets(el, pos.start, pos.end);
      if (!range) continue; // an orphan: kept on the server, not painted
      entries.push({ range, color: a.color });
      map.set(a.id, { range, blockKey: a.block_key });
    }
    painted.current = map;
    if (lookupBelow) setLookupOpen(Boolean(document.querySelector('[data-lookup-card]')));
    if (apiPaint) paintLayer(layerId, entries);
    measure();
  }, [blocks, items, apiPaint, layerId, measure, lookupBelow]);

  const paintRef = useRef(paint);
  paintRef.current = paint;
  const measureRef = useRef(measure);
  measureRef.current = measure;

  // Every render of the page around us can replace the text nodes: paint again after each. A
  // failure here only costs the highlights, never the page (an error boundary would blank it).
  const safePaint = useCallback(() => {
    try { paintRef.current(); } catch (error) { reportPaintError(error); }
  }, []);
  useLayoutEffect(() => { safePaint(); });

  useEffect(() => {
    let frame = 0;
    let measureFrame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => safePaint()); };
    const remeasure = () => { cancelAnimationFrame(measureFrame); measureFrame = requestAnimationFrame(() => { try { measureRef.current(); } catch (error) { reportPaintError(error); } }); };
    const observer = new MutationObserver((records) => {
      // Our own overlay and toolbar live in <body> too; their changes are not the page's.
      if (records.every((r) => (r.target as Element).closest?.('[data-annotation-overlay], [data-annotation-toolbar]'))) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measureFrame);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
    };
  }, [safePaint]);

  useEffect(() => () => clearLayer(layerId), [layerId]);

  // ── usage: exposure once per target ─────────────────────────────────────────────────────────
  const exposed = useRef(new Set<string>());
  useEffect(() => {
    if (!targetId || !loaded) return;
    const key = `${surface}:${targetId}`;
    if (exposed.current.has(key) || blocks().size === 0) return;
    exposed.current.add(key);
    count('exposed');
    if (!apiPaint) count('fallback');
  });

  // ── moving the old device-only highlights to the server ──────────────────────────────────────
  const imported = useRef(false);
  useEffect(() => {
    if (!legacy || imported.current || !loaded || readOnly || attempt !== 'current' || !targetId) return;
    const old = legacy.read();
    if (!old.length) { imported.current = true; return; }
    const found = blocks();
    if (found.size === 0) return; // the questions aren't on screen yet
    imported.current = true;
    const moved: Parameters<typeof importAnnotations>[2] = [];
    const left: LegacyHighlight[] = [];
    for (const h of old) {
      let anchor: Anchor | null = null;
      let key = '';
      for (const k of h.blockKeys) {
        const el = found.get(k);
        anchor = el ? anchorForQuote(el, h.quote) : null;
        if (anchor) { key = k; break; }
      }
      // The server refuses the whole batch for one bad item: leave out what it would refuse
      // (an old highlight longer than a quote may be) — those are simply dropped.
      if (anchor && anchor.quote.length <= MAX_QUOTE_CHARS) moved.push({ block_key: key, color: h.color, start_offset: anchor.start, end_offset: anchor.end, quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix });
      else if (!anchor && h.blockKeys.some((k) => !found.has(k))) left.push(h); // its question isn't rendered now
    }
    if (!moved.length) { legacy.keep(left); return; }
    importAnnotations(surface, targetId, moved.slice(0, MAX_IMPORT_ITEMS))
      .then(() => { legacy.keep(left); reload(); })
      // One try per visit: this effect runs after every render, so retrying here would resend a
      // refused batch on each one. The old highlights stay on the device for the next visit.
      .catch((error) => reportError(error, { where: 'annotations.import', surface }));
  });

  // ── opening the toolbar ─────────────────────────────────────────────────────────────────────
  const onSettle = (selection: SettledSelection | null) => {
    if (!selection) return;
    const block = blockOf(selection.range.startContainer);
    if (!block || block !== blockOf(selection.range.endContainer)) return;
    const anchor = anchorFromRange(block, selection.range);
    if (!anchor || anchor.quote.trim().length < 2) return;
    const same = toolbar?.mode === 'create' && toolbar.blockKey === block.dataset.annotationBlock
      && toolbar.anchor.start === anchor.start && toolbar.anchor.end === anchor.end;
    if (!same) count('offered');
    setOpenNote(null);
    setToolbar({ mode: 'create', blockKey: block.dataset.annotationBlock!, anchor, touch: selection.touch });
  };
  useSelectionSettle(body, [toolbarRef], enabled && !readOnly, onSettle);

  const hitTest = useCallback((x: number, y: number): number | null => {
    let best: { id: number; size: number } | null = null;
    for (const [id, { range }] of painted.current) {
      const inside = Array.from(range.getClientRects()).some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
      const size = range.toString().length;
      if (inside && (!best || size < best.size)) best = { id, size };
    }
    return best?.id ?? null;
  }, []);

  useEffect(() => {
    if (readOnly || !enabled) return;
    const onClick = (event: MouseEvent) => {
      if (!blockOf(event.target as Node)) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const id = hitTest(event.clientX, event.clientY);
      if (id === null) return;
      setOpenNote(null);
      setToolbar({ mode: 'edit', id, touch: coarsePointer() });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [readOnly, enabled, blockOf, hitTest]);

  const close = useCallback(() => setToolbar(null), []);

  const toolbarRect = useCallback((): DOMRect | null => {
    if (!toolbar) return null;
    if (toolbar.mode === 'edit') return painted.current.get(toolbar.id)?.range.getBoundingClientRect() ?? null;
    const el = blocks().get(toolbar.blockKey);
    return el ? rangeFromOffsets(el, toolbar.anchor.start, toolbar.anchor.end)?.getBoundingClientRect() ?? null : null;
  }, [toolbar, blocks]);

  const createWith = (color: AnnotationColor, note?: string) => {
    if (toolbar?.mode !== 'create') return;
    const { anchor, blockKey } = toolbar;
    create({ block_key: blockKey, color, start_offset: anchor.start, end_offset: anchor.end, quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix, note: note || null });
    count('add');
    if (note) count('note');
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  };

  const editing = toolbar?.mode === 'edit' ? items.find((a) => a.id === toolbar.id) : undefined;
  const editingGone = toolbar?.mode === 'edit' && !editing;
  useEffect(() => { if (editingGone) setToolbar(null); }, [editingGone]);

  return (
    <>
      {toolbar && (toolbar.mode === 'create' || editing) && (
        <AnnotationToolbar
          key={toolbar.mode === 'edit' ? `e${toolbar.id}` : `c${toolbar.blockKey}:${toolbar.anchor.start}`}
          ref={toolbarRef}
          getRect={toolbarRect}
          mode={toolbar.mode}
          color={editing?.color}
          note={editing?.note}
          startInNote={toolbar.mode === 'edit' && toolbar.startInNote}
          touch={toolbar.touch}
          lookupBelow={toolbar.mode === 'create' && (typeof lookupBelow === 'function' ? lookupBelow(toolbar.blockKey) : Boolean(lookupBelow))}
          lookupOpen={Boolean(lookupBelow) && lookupOpen}
          onClose={close}
          onColor={(color) => {
            if (toolbar.mode === 'create') createWith(color);
            else { update(toolbar.id, { color }); setToolbar(null); }
          }}
          onNote={(note) => {
            if (toolbar.mode === 'create') { if (note) createWith('yellow', note); else close(); return; }
            update(toolbar.id, { note: note || null });
            count('note');
            setToolbar(null);
          }}
          onDelete={toolbar.mode === 'edit' ? () => { remove(toolbar.id); count('remove'); setToolbar(null); } : undefined}
        />
      )}
      {overlay.length > 0 && createPortal(
        <div data-annotation-overlay="true" className="pointer-events-none fixed inset-0 z-20" aria-hidden={apiPaint && overlay.every((o) => !o.note)}>
          {!apiPaint && overlay.flatMap((o) => o.rects.map((r, i) => (
            <div
              key={`${o.id}-${i}`}
              className={`fixed rounded-[2px] ${FALLBACK_FILL[o.color]}`}
              style={o.color === 'underline'
                ? { left: r.x, top: r.y + r.h - 2, width: r.w, height: 2 }
                : { left: r.x, top: r.y, width: r.w, height: r.h }}
            />
          )))}
          {overlay.filter((o) => o.note).map((o) => {
            const last = o.rects[o.rects.length - 1];
            return (
              <React.Fragment key={`n${o.id}`}>
                <button
                  type="button"
                  className="pointer-events-auto fixed flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background"
                  style={{ left: last.x + last.w - 6, top: last.y - 9 }}
                  aria-label={t('lessonPlayer.annotate.openNote', { text: o.note ?? '' })}
                  onClick={() => {
                    if (readOnly) setOpenNote((cur) => (cur === o.id ? null : o.id));
                    else setToolbar({ mode: 'edit', id: o.id, touch: coarsePointer(), startInNote: true });
                  }}
                >
                  <StickyNote className="h-2.5 w-2.5" aria-hidden />
                </button>
                {readOnly && openNote === o.id && (
                  <div
                    role="note"
                    className="pointer-events-auto fixed max-w-[min(18rem,calc(100vw-16px))] whitespace-pre-wrap rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg"
                    style={{ left: Math.max(8, Math.min(last.x, window.innerWidth - 296)), top: last.y + last.h + 6 }}
                  >
                    {o.note}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

export default AnnotationLayer;
