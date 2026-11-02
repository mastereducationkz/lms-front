/**
 * Where a settled text selection may open the quiz highlighter: inside one highlightable
 * question block, start and end both. Touch and keyboard selections reach the quiz through
 * `useSelectionSettle` (selectionchange), because a long-press selection on a phone never
 * sends the mouseup the highlighter used to wait for.
 */
export const HIGHLIGHTABLE_ATTR = 'data-highlightable-question';

const elementOf = (node: Node | null): Element | null =>
  !node ? null : node instanceof Element ? node : node.parentElement;

/** The question id whose block holds the whole range, or null. */
export function highlightQuestionOf(range: Range): string | null {
  const start = elementOf(range.startContainer)?.closest(`[${HIGHLIGHTABLE_ATTR}]`);
  const end = elementOf(range.endContainer)?.closest(`[${HIGHLIGHTABLE_ATTR}]`);
  if (!start || start !== end) return null;
  if (elementOf(range.commonAncestorContainer)?.closest('[data-highlight-palette="true"]')) return null;
  return start.getAttribute(HIGHLIGHTABLE_ATTR) || null;
}

/** The selection's offset from the top of its question block, for placing the palette. */
export function paletteOffsetY(range: Range, questionId: string): number {
  const rect = range.getBoundingClientRect();
  const block = document.querySelector(`[${HIGHLIGHTABLE_ATTR}="${CSS.escape(questionId)}"]`);
  const top = block?.getBoundingClientRect().top;
  return top === undefined ? Math.max(8, rect.top) : Math.max(8, rect.top - top);
}
