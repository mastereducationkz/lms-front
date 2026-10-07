// The one gate between stored rich text and the DOM. Lesson steps, quiz questions, passages,
// explanations and announcement bodies are HTML written by staff (react-quill, pasted markup,
// imports from the SAT platform) and turned into more HTML by renderTextWithLatex (markdown +
// KaTeX), which deliberately keeps raw tags. Every dangerouslySetInnerHTML / innerHTML in src
// must pass its final string through sanitizeHtml — after markdown and LaTeX rendering, so
// nothing a renderer adds escapes the check. safeHtml.sinks.test.ts fails the build otherwise.
//
// What survives: normal formatting (paragraphs, headings, lists, tables, links, images), the
// classes react-quill writes (ql-*), KaTeX's HTML + MathML + SVG output, and sandboxed iframes
// from known video players and teaching tools (EMBEDS). What does not: <script>, <style>, <object>, <embed>, forms and inputs,
// every on* handler, and any URL that isn't http(s)/mailto (links) or https/data:image (images).
//
// Inline style stays, because KaTeX positions every glyph with it (height, vertical-align,
// margin, top, border widths) and react-quill writes colours and alignment with it. DOMPurify
// itself doesn't look inside CSS, so filterStyle drops the declarations that let content escape
// its box or load things: position other than static/relative, z-index, url(), expression(),
// image-set(), @import, CSS escapes and comments. Classes stay too (KaTeX and Quill need them),
// minus the app's own positioning utilities (fixed/absolute/sticky, z-*, inset-*) that would
// let content cover the page with a fake login form.
import DOMPurify, { type Config } from 'dompurify';
import { escapeLtInMath } from './mathText';

const HTML_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'mark', 'small', 'big',
  'sub', 'sup', 'span', 'div', 'font', 'center', 'abbr', 'cite', 'q', 'kbd', 'samp', 'var',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'code',
  'pre', 'hr', 'figure', 'figcaption', 'details', 'summary',
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'a', 'img', 'iframe',
];

// What KaTeX emits: its MathML twin (visually hidden, read by screen readers) and the SVG it
// draws stretchy glyphs with (square roots, arrows, braces).
const MATHML_TAGS = [
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mn', 'mo', 'ms', 'mtext', 'mspace', 'msup',
  'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mover', 'munder', 'munderover', 'mtable', 'mtr',
  'mtd', 'mlabeledtr', 'mstyle', 'mpadded', 'mphantom', 'menclose', 'mglyph',
];
const SVG_TAGS = ['svg', 'path', 'line'];

// data-* and aria-* are allowed on top of these (DOMPurify defaults): the quiz highlighter
// stores its state in data-highlight-*, react-quill's formula blot in data-value.
const ATTRS = [
  'class', 'style', 'title', 'id', 'dir', 'lang', 'role',
  'href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'loading',
  'colspan', 'rowspan', 'scope', 'align', 'valign', 'border', 'cellpadding', 'cellspacing',
  'span', 'start', 'reversed', 'type', 'value', 'color', 'face', 'size', 'spellcheck', 'open',
  'frameborder', 'allowfullscreen',
  // MathML (KaTeX)
  'xmlns', 'encoding', 'display', 'displaystyle', 'scriptlevel', 'mathvariant', 'mathcolor',
  'mathbackground', 'mathsize', 'stretchy', 'fence', 'separator', 'lspace', 'rspace', 'accent',
  'accentunder', 'largeop', 'movablelimits', 'symmetric', 'minsize', 'maxsize', 'linethickness',
  'columnalign', 'columnspacing', 'columnlines', 'rowalign', 'rowspacing', 'rowlines', 'depth',
  'voffset', 'notation', 'linebreak',
  // SVG (KaTeX). DOMPurify compares lower-cased names.
  'viewbox', 'preserveaspectratio', 'd', 'x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'fill',
];

// Links: http(s), mailto, or relative ("/courses/1", "#part-2"). DOMPurify strips whitespace
// and decodes entities before testing, so "JaVa&#83;cript:" and "java\tscript:" fail too.
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

// What a lesson may embed (react-quill's <iframe class="ql-video">, or embed code a teacher
// pasted): https only, on these hosts, at the paths their embed/share links use. Anything else
// loses the whole iframe. Add a row here if the content probe shows a legitimate host.
const ANY_PATH = /^\//;
const EMBEDS: Array<[hosts: string[], path: RegExp]> = [
  [['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'], ANY_PATH],
  [['player.vimeo.com'], ANY_PATH],
  [['drive.google.com'], ANY_PATH],
  // Slides, Forms, Docs, Sheets: only their embed / preview / published / form views, never the editor.
  [['docs.google.com'],
    /^\/(?:a\/[^/]+\/)?(?:presentation|forms|document|spreadsheets)\/d\/(?:e\/)?[\w-]+\/(?:embed|preview|pub|pubhtml|htmlview|viewform)\/?$/],
  [['www.desmos.com', 'desmos.com'], /^\/(?:calculator|geometry|scientific|matrix|fourfunction|3d|embed)(?:\/|$)/],
  [['www.geogebra.org', 'geogebra.org'],
    /^\/(?:material\/iframe|m|calculator|graphing|geometry|3d|classic|classroom)(?:\/|$)/],
  [['quizlet.com', 'www.quizlet.com'], /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?\d+\/[\w-]+\/embed\/?$/],
  [['wordwall.net', 'www.wordwall.net'], /^\/(?:[a-z]{2}\/)?embed\//],
  [['www.canva.com'], /^\/design\/[\w-]+\/(?:[\w-]+\/)?view\/?$/],
  [['view.genial.ly'], /^\/[\w-]+(?:\/|$)/],
];
// allow-forms so an embedded Google Form can be submitted; no allow-top-navigation, so nothing
// framed can navigate the LMS tab away.
const EMBED_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox';
const EMBED_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

const UNSAFE_CSS = /url\s*\(|expression\s*\(|image-set|@import|javascript:|behavior|-moz-binding|\\|\/\*/i;
const ESCAPING_CLASS = /^(?:[\w-]+:)*!?(?:fixed|absolute|sticky|-?z-.+|-?inset-.+)$/;

/** True for an https iframe src on one of the EMBEDS hosts, at one of that host's embed paths. */
export function isAllowedEmbed(src: string | null): boolean {
  if (!src) return false;
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return EMBEDS.some(([hosts, path]) => hosts.includes(host) && path.test(url.pathname));
  } catch {
    return false;
  }
}

/** The style attribute minus declarations that load resources or escape the content's box;
 *  unchanged (same string) when nothing had to go. */
export function filterStyle(style: string): string {
  const declarations = style.split(';');
  const kept = declarations.filter((decl) => {
    if (UNSAFE_CSS.test(decl)) return false;
    const colon = decl.indexOf(':');
    if (colon < 0) return !decl.trim();
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).trim().toLowerCase();
    if (prop === 'position') return /^(static|relative)(\s*!important)?$/.test(value);
    return prop !== 'z-index';
  });
  return kept.length === declarations.length ? style : kept.join(';').trim();
}

function filterClass(value: string): string {
  const classes = value.split(/\s+/).filter(Boolean);
  const kept = classes.filter((c) => !ESCAPING_CLASS.test(c));
  return kept.length === classes.length ? value : kept.join(' ');
}

function createPurifier() {
  if (typeof window === 'undefined') return null;
  const purifier = DOMPurify(window);
  if (!purifier.isSupported) return null;

  purifier.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe' && !isAllowedEmbed((node as Element).getAttribute('src'))) {
      (node as Element).remove();
    }
  });

  purifier.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style') data.attrValue = filterStyle(data.attrValue);
    else if (data.attrName === 'class') data.attrValue = filterClass(data.attrValue);
    if ((data.attrName === 'style' || data.attrName === 'class') && !data.attrValue) data.keepAttr = false;
  });

  purifier.addHook('afterSanitizeAttributes', (node) => {
    const el = node as Element;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'a') {
      const target = el.getAttribute('target');
      if (target && target !== '_blank' && target !== '_self') el.removeAttribute('target');
      if (el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
    } else if (tag === 'img') {
      const src = el.getAttribute('src') ?? '';
      // Browsers already auto-upgrade http images on an https page; doing it here keeps them.
      if (/^http:/i.test(src)) el.setAttribute('src', `https:${src.slice(5)}`);
      else if (/^data:/i.test(src) && !/^data:image\//i.test(src)) el.removeAttribute('src');
    } else if (tag === 'iframe') {
      el.setAttribute('sandbox', EMBED_SANDBOX);
      el.setAttribute('allow', EMBED_ALLOW);
      el.setAttribute('allowfullscreen', 'true');
      el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    }
  });

  return purifier;
}

const purifier = createPurifier();

const CONFIG: Config = {
  ALLOWED_TAGS: [...HTML_TAGS, ...MATHML_TAGS, ...SVG_TAGS],
  ALLOWED_ATTR: ATTRS,
  ALLOWED_URI_REGEXP,
};

// Quiz pages re-render the same option and passage strings on every answer; sanitising each
// distinct string once keeps that cheap. Insertion-ordered Map: drop the oldest past the cap.
const CACHE_LIMIT = 500;
const cache = new Map<string, string>();

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Stored or rendered HTML made safe for dangerouslySetInnerHTML / innerHTML. */
export function sanitizeHtml(html: unknown): string {
  // A "<" inside $…$ maths ("$0<x<c$") would open a fake tag and swallow the rest of the text.
  const input = escapeLtInMath(typeof html === 'string' ? html : String(html ?? ''));
  if (!input) return '';
  // No DOM to sanitise with (unit tests in a node environment): show it as text, never as HTML.
  if (!purifier) return escapeHtml(input);

  const hit = cache.get(input);
  if (hit !== undefined) return hit;
  const clean = purifier.sanitize(input, CONFIG);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(input, clean);
  return clean;
}
