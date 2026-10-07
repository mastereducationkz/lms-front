// Every place src turns a string into DOM must go through sanitizeHtml (src/lib/safeHtml.ts).
// This scans the source, so a new dangerouslySetInnerHTML or innerHTML assignment without it
// fails CI instead of shipping a stored-XSS hole.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

// innerHTML writes that never see stored content. Each needs a reason.
const INNER_HTML_ALLOWED: Array<{ file: string; line: string; why: string }> = [
  {
    file: 'components/announcements/telegramText.ts',
    line: 'el.innerHTML = withoutTags;',
    why: 'a <textarea> parses innerHTML as plain text (RCDATA): used only to decode entities',
  },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/** `file:line` for every match of `pattern` whose following code fails `isSafe`. */
function violations(pattern: RegExp, isSafe: (after: string, line: string, file: string) => boolean): string[] {
  const found: string[] = [];
  for (const path of sourceFiles(SRC)) {
    const text = readFileSync(path, 'utf8');
    const file = relative(SRC, path);
    for (const match of text.matchAll(pattern)) {
      const at = match.index ?? 0;
      const after = text.slice(at + match[0].length, at + match[0].length + 2000).replace(/\s+/g, '');
      const line = text.split('\n')[lineOf(text, at) - 1].trim();
      if (!isSafe(after, line, file)) found.push(`${file}:${lineOf(text, at)}  ${line}`);
    }
  }
  return found;
}

describe('HTML sinks', () => {
  it('every dangerouslySetInnerHTML passes its string through sanitizeHtml', () => {
    expect(violations(/dangerouslySetInnerHTML\s*=/g, (after) => after.startsWith('{{__html:sanitizeHtml('))).toEqual([]);
  });

  it('every innerHTML assignment is sanitised, a fixed literal, or listed with a reason', () => {
    const bad = violations(/\.innerHTML\s*=(?!=)/g, (after, line, file) =>
      after.startsWith('sanitizeHtml(')
      || /^(['"])[^'"]*\1;?/.test(after)
      || /^`[^`$]*`/.test(after)
      || INNER_HTML_ALLOWED.some((ok) => ok.file === file && ok.line === line),
    );
    expect(bad).toEqual([]);
  });

  it('no other string-to-DOM APIs are used', () => {
    expect(violations(/\.outerHTML\s*=(?!=)|insertAdjacentHTML\s*\(|document\.write(ln)?\s*\(|createContextualFragment\s*\(|\bsrcDoc\s*=/g, () => false)).toEqual([]);
  });

  it('finds the sinks it is meant to guard (the scan itself works)', () => {
    expect(violations(/dangerouslySetInnerHTML\s*=/g, () => false).length).toBeGreaterThan(50);
  });
});
