import { describe, expect, it } from 'vitest';
import { downloadableHtml, markdownToTelegramHtml } from './markdownToHtml';

describe('markdownToTelegramHtml', () => {
  it('converts the formatting people commonly paste into the composer', () => {
    expect(markdownToTelegramHtml('📢 **SAT 2026**\n\nЕсли `важно`, [откройте инструкцию](https://example.com).')).toBe(
      '📢 <b>SAT 2026</b>\n\nЕсли <code>важно</code>, <a href="https://example.com">откройте инструкцию</a>.',
    );
  });

  it('keeps plain text safe and supports quotes, strike and italic text', () => {
    expect(markdownToTelegramHtml('> **Важно**\n~~старое~~ и _новое_ <script>alert(1)</script>')).toBe(
      '<blockquote><b>Важно</b></blockquote>\n<s>старое</s> и <i>новое</i> &lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });
});

it('wraps converted Telegram HTML in a downloadable document', () => {
  expect(downloadableHtml('<b>Hello</b>')).toContain('<body><b>Hello</b></body>');
});
