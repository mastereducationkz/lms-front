/** Convert the small Markdown dialect staff commonly paste into Telegram HTML. */

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function safeHref(value: string): string | null {
  return /^(https?:\/\/|tg:\/\/)/i.test(value) ? value : null;
}

/** Convert rich clipboard HTML (used by browser editors and some Telegram clients). */
export function richHtmlToTelegramHtml(source: string): string {
  if (!source.trim() || typeof DOMParser === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(`<div>${source}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  if (!root) return '';

  const render = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (tag === 'br') return '\n';

    const content = Array.from(element.childNodes).map(render).join('');
    const style = element.getAttribute('style') ?? '';
    const bold = ['b', 'strong'].includes(tag) || /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
    const italic = ['i', 'em'].includes(tag) || /font-style\s*:\s*italic/i.test(style);
    const underline = ['u', 'ins'].includes(tag) || /text-decoration[^;]*underline/i.test(style);
    const strike = ['s', 'del', 'strike'].includes(tag) || /text-decoration[^;]*line-through/i.test(style);

    if (tag === 'a') {
      const href = safeHref(element.getAttribute('href') ?? '');
      return href ? `<a href="${escapeAttribute(href)}">${content}</a>` : content;
    }
    if (tag === 'blockquote') return `<blockquote>${content}</blockquote>`;
    if (tag === 'code' || tag === 'pre') return `<code>${content}</code>`;
    if (bold) return `<b>${content}</b>`;
    if (italic) return `<i>${content}</i>`;
    if (underline) return `<u>${content}</u>`;
    if (strike) return `<s>${content}</s>`;

    const block = ['address', 'article', 'dd', 'div', 'dl', 'dt', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'section'].includes(tag);
    return block ? `\n${content}\n` : content;
  };

  return render(root).replace(/\n{3,}/g, '\n\n').trim();
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
