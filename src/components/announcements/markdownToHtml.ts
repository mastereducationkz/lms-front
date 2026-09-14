/** Convert the small Markdown dialect staff commonly paste into Telegram HTML. */

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

/** Inline formatting supported by Telegram's HTML parse mode. */
export function markdownInlineToHtml(value: string): string {
  const tokens: string[] = [];
  const token = (html: string) => {
    const marker = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return marker;
  };

  let text = value;
  text = text.replace(/`([^`\n]+)`/g, (_, content: string) => token(`<code>${escapeHtml(content)}</code>`));
  text = text.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|tg:\/\/[^\s)]+)\)/g,
    (_, label: string, href: string) => token(`<a href="${escapeAttribute(href)}">${markdownInlineToHtml(label)}</a>`),
  );
  text = text.replace(/\*\*([^*\n]+)\*\*/g, (_, content: string) => token(`<b>${markdownInlineToHtml(content)}</b>`));
  text = text.replace(/__([^_\n]+)__/g, (_, content: string) => token(`<b>${markdownInlineToHtml(content)}</b>`));
  text = text.replace(/~~([^~\n]+)~~/g, (_, content: string) => token(`<s>${markdownInlineToHtml(content)}</s>`));
  text = text.replace(/\*([^*\n]+)\*/g, (_, content: string) => token(`<i>${markdownInlineToHtml(content)}</i>`));
  text = text.replace(/_([^_\n]+)_/g, (_, content: string) => token(`<i>${markdownInlineToHtml(content)}</i>`));

  return escapeHtml(text).replace(/\u0000(\d+)\u0000/g, (_, index: string) => tokens[Number(index)]);
}

/**
 * Convert pasted Markdown-like text to the HTML wire format already used by
 * the announcements API. Unknown Markdown is intentionally kept as text.
 */
export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown.trim()) return '';

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let quoteLines: string[] = [];

  const flushQuote = () => {
    if (quoteLines.length) {
      output.push(`<blockquote>${quoteLines.join('\n')}</blockquote>`);
      quoteLines = [];
    }
  };

  for (const line of lines) {
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      quoteLines.push(markdownInlineToHtml(quote[1]));
      continue;
    }
    flushQuote();
    output.push(markdownInlineToHtml(line));
  }
  flushQuote();
  return output.join('\n');
}

export function downloadableHtml(body: string): string {
  return `<!doctype html>\n<html lang="ru">\n<head><meta charset="utf-8"><title>Announcement</title></head>\n<body>${body.replace(/\n/g, '<br>')}</body>\n</html>\n`;
}
