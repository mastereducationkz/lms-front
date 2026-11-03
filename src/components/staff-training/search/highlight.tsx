import type { ReactNode } from 'react';

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&' };
const unescapeText = (s: string) => s.replace(/&(?:lt|gt|amp);/g, (m) => ENTITIES[m]);

/**
 * The server sends a snippet as escaped text with `<mark>…</mark>` around the hits, and nothing else is markup. Rendering
 * it as React nodes (never as innerHTML) keeps it safe even if the server's escaping were ever wrong.
 */
export function renderHighlight(html: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /<mark>([\s\S]*?)<\/mark>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match.index > last) out.push(unescapeText(html.slice(last, match.index)));
    out.push(<mark key={match.index} className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">{unescapeText(match[1])}</mark>);
    last = match.index + match[0].length;
  }
  if (last < html.length) out.push(unescapeText(html.slice(last)));
  return out;
}
