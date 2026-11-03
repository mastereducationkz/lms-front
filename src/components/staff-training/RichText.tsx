import { Fragment, type ReactNode } from 'react';

/**
 * The task text's Markdown subset (CONTRACTS §3.1): paragraphs, bullet and numbered lists, **bold**, and «ёлочки»
 * which are plain text. Built as React nodes, never as HTML, so nothing a script can run ever comes from the text.
 */
export type Block = { type: 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] };

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const bullet = BULLET.exec(line);
    const number = NUMBER.exec(line);
    const list = bullet ? 'ul' : number ? 'ol' : null;
    if (list) {
      flush();
      const last = blocks[blocks.length - 1];
      const text = (bullet ?? number)![1];
      if (last && last.type === list) last.items.push(text);
      else blocks.push({ type: list, items: [text] });
    } else if (!line.trim()) {
      flush();
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>);
}

export default function RichText({ source, className }: { source: string; className?: string }) {
  return (
    <div className={className}>
      {parseBlocks(source).map((block, i) => {
        if (block.type === 'p') return <p key={i} className="mt-3 first:mt-0">{inline(block.text)}</p>;
        const List = block.type;
        return (
          <List key={i} className={`mt-3 space-y-1.5 pl-5 first:mt-0 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
            {block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
          </List>
        );
      })}
    </div>
  );
}
