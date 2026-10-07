/**
 * Reports a text selection once it has settled: SETTLE_MS after the last change, and with a mouse
 * only after the button is released (a pause mid-drag is not a choice). Works the same for
 * mouse, keyboard and touch selections because it listens to `selectionchange`, not mouseup.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { SETTLE_MS, blockTextOf, contextAround, isEditable } from './selection';

export interface SettledSelection {
  text: string;
  context?: string;
  range: Range;
  /** Made with a finger: the OS menu is up, so the card waits for a tap on the chip. */
  touch: boolean;
}

const coarsePointer = () => {
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
};

export function useSelectionSettle(
  container: RefObject<HTMLElement>,
  ignore: Array<RefObject<HTMLElement | null>>,
  enabled: boolean,
  onSettle: (selection: SettledSelection | null) => void,
) {
  const callback = useRef(onSettle);
  callback.current = onSettle;
  const ignored = useRef(ignore);
  ignored.current = ignore;

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let pointerDown = false;
    let pointerType: string | null = null;

    const inIgnored = (node: Node | null) => !!node && ignored.current.some((ref) => ref.current?.contains(node));

    const check = () => {
      timer = undefined;
      const root = container.current;
      const selection = window.getSelection();
      if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
        callback.current(null);
        return;
      }
      const { anchorNode, focusNode } = selection;
      if (!anchorNode || !root.contains(anchorNode) || inIgnored(anchorNode) || isEditable(anchorNode)) return;
      // A triple-clicked paragraph ends at the start of whatever follows it, often outside the
      // lesson text: keep the part inside.
      const range = selection.getRangeAt(0).cloneRange();
      const clipped = !root.contains(range.startContainer) || !root.contains(range.endContainer);
      if (!root.contains(range.startContainer)) range.setStart(root, 0);
      if (!root.contains(range.endContainer)) range.setEnd(root, root.childNodes.length);
      if (focusNode && root.contains(focusNode) && isEditable(focusNode)) return;
      const text = clipped ? range.toString() : selection.toString();
      if (!text.trim()) return;
      callback.current({
        text,
        context: contextAround(text, blockTextOf(range)),
        range,
        touch: pointerType ? pointerType === 'touch' : coarsePointer(),
      });
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, SETTLE_MS);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (inIgnored(event.target as Node)) return;
      pointerDown = true;
      pointerType = event.pointerType || null;
      window.clearTimeout(timer);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      pointerType = event.pointerType || pointerType;
      schedule();
    };
    const onSelectionChange = () => {
      // A mouse drag is still choosing; its release schedules the check.
      if (pointerDown && pointerType === 'mouse') return;
      schedule();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.startsWith('Arrow') || event.key === 'Shift' || event.key === 'Home' || event.key === 'End') {
        pointerType = 'keyboard';
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [container, enabled]);
}
