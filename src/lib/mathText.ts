// Maths written straight into lesson and quiz HTML ("if $0<x<c$, then …", "$f(3)<f(0)$") has a
// raw "<" that the HTML parser reads as the start of a tag: "<x<c$, then …" becomes a made-up
// element and the rest of the sentence disappears. escapeLtInMath turns such a "<" into &lt;
// before anything parses the string, but only inside a maths segment and only when it doesn't
// open a real tag, so markup around and inside the maths is left alone. decodeMathEntities undoes
// it (and the entities react-quill writes, "&lt;" for a typed "<") so KaTeX gets the real symbol.

/** Longer input is returned untouched (lesson HTML with inline images runs to megabytes). */
export const MATH_TEXT_MAX_LENGTH = 2_000_000;

// A well-formed tag (or comment) starting exactly at lastIndex. `[^<>]*` stops at the next "<",
// so two attempts never scan the same characters: the whole pass stays linear.
const TAG_AT = /<(?:\/?[A-Za-z][\w:-]*(?:\s[^<>]*)?\/?>|!--)/y;

type Closer = '$' | '$$' | '\\)' | '\\]';

/** `text` with every "<" inside $…$, $$…$$, \(…\) or \[…\] that doesn't open a tag written as &lt;. */
export function escapeLtInMath(text: string): string {
  if (text.length > MATH_TEXT_MAX_LENGTH || !text.includes('<')) return text;
  if (!text.includes('$') && !text.includes('\\(') && !text.includes('\\[')) return text;

  // Next unescaped occurrence of each closer at or after `from`. Positions only move forward, so
  // each closer's search never revisits text it already passed, and -1 is final.
  const nextAt = new Map<Closer, number>();
  const findCloser = (closer: Closer, from: number): number => {
    const known = nextAt.get(closer);
    if (known === -1 || (known !== undefined && known >= from)) return known as number;
    let at = text.indexOf(closer, from);
    while (at > 0 && closer.startsWith('$') && text[at - 1] === '\\') at = text.indexOf(closer, at + 1);
    nextAt.set(closer, at);
    return at;
  };

  // Same forward-only cache for the next "<", so a long run of maths without one is never rescanned.
  let nextLt = -2;
  const findLt = (from: number): number => {
    if (nextLt === -1 || nextLt >= from) return nextLt;
    nextLt = text.indexOf('<', from);
    return nextLt;
  };

  let out = '';
  let copied = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    let closer: Closer;
    let open: number;
    if (ch === '\\') {
      const next = text[i + 1];
      if (next === '(') closer = '\\)';
      else if (next === '[') closer = '\\]';
      else { i += 2; continue; } // an escaped character such as \$ is plain text
      open = 2;
    } else if (ch === '$') {
      [closer, open] = text[i + 1] === '$' ? ['$$', 2] : ['$', 1];
    } else {
      i += 1;
      continue;
    }

    const end = findCloser(closer, i + open);
    if (end < 0) { i += open; continue; }
    for (let j = findLt(i + open); j >= 0 && j < end; j = findLt(j + 1)) {
      TAG_AT.lastIndex = j;
      if (TAG_AT.test(text)) continue;
      out += `${text.slice(copied, j)}&lt;`;
      copied = j + 1;
    }
    i = end + closer.length;
  }
  return copied === 0 ? text : out + text.slice(copied);
}

/** The maths source as KaTeX should read it: entities from the editor or escapeLtInMath decoded. */
export function decodeMathEntities(latex: string): string {
  return latex
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
