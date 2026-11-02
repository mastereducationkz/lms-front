/**
 * Anchoring a highlight to text that can be re-rendered or edited (owner Q12, 2026-11-02).
 *
 * A highlight is stored as character offsets into its block's text plus the quoted text and a
 * little context around it (the W3C Web Annotation "position + quote" selectors). On every paint
 * the offsets are tried first; if the text moved (a teacher fixed a typo above it) the quote is
 * looked up again and the occurrence whose context matches best wins. A quote that no longer
 * exists is an orphan: kept on the server, not painted.
 *
 * The block's text is the concatenation of its text nodes, minus anything interactive (answer
 * dropdowns, buttons, inputs) whose label changes as the student answers and would shift every
 * offset after it.
 */
export interface Anchor {
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
}

export const CONTEXT_CHARS = 32;
export const MAX_QUOTE_CHARS = 2000;

const SKIP_SELECTOR =
  'button, select, input, textarea, [role="combobox"], [role="listbox"], [contenteditable="true"], [data-annotation-skip]';

/** The text nodes that make up a block's text, in document order. */
export function textNodesOf(root: Node): Text[] {
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const skip = node.parentElement?.closest(SKIP_SELECTOR);
      return skip && skip !== root && root.contains(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

export function blockText(root: Node): string {
  return textNodesOf(root).map((n) => n.data).join('');
}

/** The offset into the block's text of a DOM boundary point, or null when it isn't in the block. */
function offsetOf(root: Node, nodes: Text[], container: Node, offset: number): number | null {
  if (!root.contains(container)) return null;
  let total = 0;
  if (container.nodeType === Node.TEXT_NODE) {
    for (const n of nodes) {
      if (n === container) return total + Math.min(offset, n.data.length);
      total += n.data.length;
    }
    return null; // a skipped node (inside a dropdown or button)
  }
  // An element boundary: count the text before the offset-th child.
  const doc = root.ownerDocument ?? document;
  const probe = doc.createRange();
  probe.setStart(root, 0);
  probe.setEnd(container, offset);
  // An element boundary never splits a text node: count the nodes that end before it.
  for (const n of nodes) if (probe.comparePoint(n, n.data.length) === 0) total += n.data.length;
  return total;
}

/** The anchor of a selection inside a block, or null when it isn't one. */
export function anchorFromRange(root: Node, range: Range): Anchor | null {
  const nodes = textNodesOf(root);
  const start = offsetOf(root, nodes, range.startContainer, range.startOffset);
  const end = offsetOf(root, nodes, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  const text = nodes.map((n) => n.data).join('');
  let s = Math.min(start, end);
  let e = Math.max(start, end);
  // Trim the whitespace a double-click or a drag picks up at the edges.
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  if (e - s < 1 || e - s > MAX_QUOTE_CHARS) return null;
  return {
    start: s,
    end: e,
    quote: text.slice(s, e),
    prefix: text.slice(Math.max(0, s - CONTEXT_CHARS), s),
    suffix: text.slice(e, e + CONTEXT_CHARS),
  };
}

const commonSuffixLength = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
};
const commonPrefixLength = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/** Where an anchor sits in the block's current text, or null for an orphan. */
export function resolveAnchor(text: string, anchor: Anchor): { start: number; end: number } | null {
  const { start, end, quote } = anchor;
  if (!quote) return null;
  if (start >= 0 && end <= text.length && text.slice(start, end) === quote) return { start, end };
  let best: { start: number; score: number; distance: number } | null = null;
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
    const score =
      commonSuffixLength(text.slice(Math.max(0, i - CONTEXT_CHARS), i), anchor.prefix) +
      commonPrefixLength(text.slice(i + quote.length, i + quote.length + CONTEXT_CHARS), anchor.suffix);
    const distance = Math.abs(i - start);
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { start: i, score, distance };
    }
  }
  return best ? { start: best.start, end: best.start + quote.length } : null;
}

/** A DOM range over [start, end) of the block's text, or null when it no longer fits. */
export function rangeFromOffsets(root: Node, start: number, end: number): Range | null {
  const nodes = textNodesOf(root);
  const doc = root.ownerDocument ?? document;
  const range = doc.createRange();
  let total = 0;
  let startSet = false;
  for (const n of nodes) {
    const len = n.data.length;
    if (!startSet && start < total + len) {
      range.setStart(n, start - total);
      startSet = true;
    }
    if (startSet && end <= total + len) {
      range.setEnd(n, end - total);
      return range;
    }
    total += len;
  }
  return null;
}

/**
 * The first occurrence of `quote` in a block, as an anchor. Used once, to move the old
 * device-only highlights to the server: they stored whitespace-collapsed text, not positions.
 */
export function anchorForQuote(root: Node, quote: string): Anchor | null {
  const text = blockText(root);
  const needle = quote.replace(/\s+/g, ' ').trim();
  if (!needle) return null;
  // Collapse runs of whitespace, remembering where each kept character came from.
  let flat = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ws = /\s/.test(text[i]);
    if (ws && flat.endsWith(' ')) continue;
    flat += ws ? ' ' : text[i];
    origin.push(i);
  }
  const at = flat.indexOf(needle);
  if (at === -1) return null;
  const start = origin[at];
  const end = origin[at + needle.length - 1] + 1;
  return {
    start,
    end,
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_CHARS), start),
    suffix: text.slice(end, end + CONTEXT_CHARS),
  };
}
