/**
 * What a selection is, decided the way the server decides it (lms-backend
 * src/content/lookup/text.py), so the card's shape is right before the first byte arrives.
 */
import type { LookupMode } from '../../../services/api/lookup';

/** The longest selection Look Up answers, after trimming and collapsing whitespace. */
export const MAX_LOOKUP_CHARS = 400;
/** Up to this many words is a dictionary card; more is «translate and explain». */
export const WORD_MODE_MAX_WORDS = 3;
/** The most context sent with a lookup (the server cuts it again). */
export const MAX_CONTEXT_CHARS = 300;
/** How long a selection must stay still before it is looked up. */
export const SETTLE_MS = 300;

export type SelectionKind = LookupMode | 'too_long' | 'empty';

const EDGE = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

export const cleanSelection = (text: string): string => text.replace(/\s+/g, ' ').trim();

export function selectionKind(text: string): SelectionKind {
  const cleaned = cleanSelection(text);
  if (cleaned.length > MAX_LOOKUP_CHARS) return 'too_long';
  const core = cleaned.replace(EDGE, '');
  if (!core) return 'empty';
  return core.split(' ').length <= WORD_MODE_MAX_WORDS ? 'word' : 'phrase';
}

const SENTENCE_END = /[.!?;…](?=\s)/g;

/** The sentence around `selected` in its paragraph, at most MAX_CONTEXT_CHARS. */
export function contextAround(selected: string, blockText: string): string | undefined {
  const text = cleanSelection(blockText);
  const needle = cleanSelection(selected);
  if (!text || !needle) return undefined;
  const at = text.indexOf(needle);
  if (at < 0) return text.slice(0, MAX_CONTEXT_CHARS);
  let start = 0;
  let end = text.length;
  for (const match of text.matchAll(SENTENCE_END)) {
    const stop = (match.index ?? 0) + match[0].length;
    if (stop <= at) start = stop;
    else if ((match.index ?? 0) >= at + needle.length) {
      end = stop;
      break;
    }
  }
  const sentence = text.slice(start, end).trim();
  if (sentence.length <= MAX_CONTEXT_CHARS) return sentence;
  const inSentence = sentence.indexOf(needle);
  const lo = Math.max(0, Math.min(inSentence - Math.floor((MAX_CONTEXT_CHARS - needle.length) / 2), sentence.length - MAX_CONTEXT_CHARS));
  return sentence.slice(lo, lo + MAX_CONTEXT_CHARS).trim();
}

const BLOCK = 'p, li, td, th, dd, dt, blockquote, figcaption, h1, h2, h3, h4, h5, h6, pre';

/** The paragraph-ish block the selection starts in: where its sentence is. */
export function blockTextOf(range: Range): string {
  const start = range.startContainer;
  const element = start.nodeType === Node.ELEMENT_NODE ? (start as Element) : start.parentElement;
  return (element?.closest(BLOCK) ?? element)?.textContent ?? '';
}

/** Selections Look Up ignores: form fields and editable text are for typing, not reading. */
export function isEditable(node: Node | null): boolean {
  const element = node && (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement);
  return !!element?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

/** Steps Look Up may run on. Quiz questions and checkpoints would hand out answers (owner, 2026-10-07). */
export function lookupAllowed(stepType: string | undefined, lessonKind: string | undefined | null): boolean {
  if (lessonKind === 'checkpoint') return false;
  return stepType === 'text' || stepType === 'video_text';
}
