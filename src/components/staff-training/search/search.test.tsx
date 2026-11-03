// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderHighlight } from './highlight';
import { citationLink, clipLink, momentLink, safeUrl, taskLink, wantsAutoAnswer } from './links';

describe('the snippet a search result shows', () => {
  it('turns <mark> into highlights and every other character into plain text', () => {
    const html = renderToStaticMarkup(<p>{renderHighlight('Students with <mark>no activity</mark> in the LMS &lt;b&gt;x&lt;/b&gt; 2 &lt; 3 &amp; 4')}</p>);
    expect(html).toBe('<p>Students with <mark class="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">no activity</mark> in the LMS &lt;b&gt;x&lt;/b&gt; 2 &lt; 3 &amp; 4</p>');
  });

  it('never makes markup out of the text, even if the server forgot to escape it', () => {
    const html = renderToStaticMarkup(<p>{renderHighlight('<img src=x onerror=alert(1)> <mark>hit</mark>')}</p>);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('handles several hits and text without any', () => {
    expect(renderToStaticMarkup(<p>{renderHighlight('<mark>a</mark> b <mark>c</mark>')}</p>).match(/<mark/g)).toHaveLength(2);
    expect(renderToStaticMarkup(<p>{renderHighlight('plain')}</p>)).toBe('<p>plain</p>');
    expect(renderHighlight('')).toEqual([]);
  });
});

describe('where a search result takes you', () => {
  it('opens a clip at the exact second of the moment', () => {
    expect(clipLink(7, 42_000)).toBe('/training/clips/7?t=42');
    expect(clipLink(7, 42_900)).toBe('/training/clips/7?t=42');
    expect(clipLink(7, null)).toBe('/training/clips/7');
    expect(clipLink(7, 0)).toBe('/training/clips/7');
  });

  it('links a moment of a clip or a task inside the app, and a handbook never', () => {
    const moment = { chunk_id: 1, start_ms: 61_000, label: '1:01', text: { ru: '', en: '' }, highlight: { ru: '', en: '' } };
    expect(momentLink({ kind: 'clip', clip_id: 7, title: { ru: 'a', en: 'a' }, role_tracks: [] }, moment)).toBe('/training/clips/7?t=61');
    expect(momentLink({ kind: 'task', task_id: 3, title: { ru: 'a', en: 'a' }, role_tracks: [] }, moment)).toBe(taskLink(3));
    expect(momentLink({ kind: 'handbook', key: 'k', title: { ru: 'a', en: 'a' }, url: null }, moment)).toBeNull();
  });

  it('only follows http(s) addresses and paths of this site', () => {
    expect(safeUrl('https://docs.example.test/h.html#card-2')).toBe('https://docs.example.test/h.html#card-2');
    expect(safeUrl('/handbooks/x.html#card-2')).toBe('/handbooks/x.html#card-2');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.test/x', '', null, undefined]) expect(safeUrl(bad)).toBeNull();
  });

  it('turns a citation into the moment it cites', () => {
    const base = { chunk_id: 9, label: '0:42', clip_id: null, kind: 'clip' as const, start_ms: 42_000, task_id: null };
    expect(citationLink({ ...base, clip_id: 7 })).toEqual({ to: '/training/clips/7?t=42', href: null });
    expect(citationLink({ ...base, kind: 'task', task_id: 3 })).toEqual({ to: '/training/tasks/3', href: null });
    expect(citationLink({ ...base, kind: 'handbook', url: 'https://h.test/x#card-1' })).toEqual({ to: null, href: 'https://h.test/x#card-1' });
    expect(citationLink({ ...base, kind: 'handbook', url: 'javascript:1' })).toEqual({ to: null, href: null });
  });

  it('answers a question of three words or more by itself and gives a button to shorter ones', () => {
    expect(wantsAutoAnswer('ученик пропал')).toBe(false);
    expect(wantsAutoAnswer('как отметить опоздание')).toBe(true);
    expect(wantsAutoAnswer('  how to freeze   a student ')).toBe(true);
    expect(wantsAutoAnswer('   ')).toBe(false);
  });
});
