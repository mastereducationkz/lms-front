import { describe, expect, it } from 'vitest';
import { backendBase, mediaUrl, safeLinkUrl, safeUploadUrl } from './mediaUrl';

const API = 'https://lmsapi.mastereducation.kz';

describe('mediaUrl', () => {
  it('puts a stored upload path on the API host', () => {
    expect(mediaUrl('/uploads/questions/map.png', API)).toBe(`${API}/uploads/questions/map.png`);
  });

  it('adds the slash a path without one is missing', () => {
    expect(mediaUrl('uploads/questions/doc.pdf', API)).toBe(`${API}/uploads/questions/doc.pdf`);
  });

  it('leaves full URLs alone', () => {
    for (const url of [
      'https://cdn.example.com/a.png',
      'http://example.com/a.png',
      'HTTPS://EXAMPLE.COM/A.PNG',
      '//cdn.example.com/a.png',
      'data:image/png;base64,iVBORw0KGgo=',
      'blob:https://lms.mastereducation.kz/6c1f',
    ]) {
      expect(mediaUrl(url, API)).toBe(url);
    }
  });

  it('trims stray whitespace', () => {
    expect(mediaUrl('  /uploads/a.png\n', API)).toBe(`${API}/uploads/a.png`);
  });

  it('is null when there is nothing to load', () => {
    for (const value of [undefined, null, '', '   ', 42, {}]) {
      expect(mediaUrl(value, API)).toBeNull();
    }
  });
});

describe('backendBase', () => {
  it('drops a trailing slash so paths never double it', () => {
    expect(backendBase('https://lmsapi.mastereducation.kz/', 'https:')).toBe(API);
  });

  it('upgrades an http API host on an https page, where http media would be blocked', () => {
    expect(backendBase('http://lmsapi.mastereducation.kz', 'https:')).toBe(API);
  });

  it('keeps http on an http page (local development)', () => {
    expect(backendBase('http://localhost:8000', 'http:')).toBe('http://localhost:8000');
    expect(backendBase('http://localhost:8000', undefined)).toBe('http://localhost:8000');
  });
});

// Hostile values a student's submission, draft or chat attachment can legitimately
// contain, since the backend accepts any string today (a separate PR adds write-side
// validation) and legacy rows already have whatever a client once sent.
const HOSTILE_VALUES = [
  'javascript:alert(1)',
  'JAVASCRIPT:alert(1)',
  'java\tscript:alert(1)',
  '%6aavascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'blob:https://lms.mastereducation.kz/6c1f',
  'vbscript:msgbox(1)',
  '//evil.tld/x',
  '@evil.tld/x',
  '\\\\evil.tld',
  'https://evil.tld/a.png',
  '  \x00\x01javascript:alert(1)',
];

describe('safeUploadUrl', () => {
  it('rejects every hostile value', () => {
    for (const value of HOSTILE_VALUES) {
      expect(safeUploadUrl(value, API)).toBeNull();
    }
  });

  it('rejects non-strings and empty values without throwing', () => {
    for (const value of [undefined, null, '', '   ', 42, {}, []]) {
      expect(safeUploadUrl(value, API)).toBeNull();
    }
  });

  it('resolves a relative upload path onto the backend host', () => {
    expect(safeUploadUrl('/uploads/submissions/a.pdf', API)).toBe(`${API}/uploads/submissions/a.pdf`);
  });

  it('adds the slash a bare upload path is missing', () => {
    expect(safeUploadUrl('uploads/submissions/a.pdf', API)).toBe(`${API}/uploads/submissions/a.pdf`);
  });

  it('never produces a double slash, whatever the input has', () => {
    expect(safeUploadUrl('/uploads/a.pdf', API)).toBe(`${API}/uploads/a.pdf`);
    expect(safeUploadUrl('uploads/a.pdf', API)).toBe(`${API}/uploads/a.pdf`);
  });

  it('accepts a legacy absolute URL already on the backend host', () => {
    expect(safeUploadUrl(`${API}/uploads/submissions/old.pdf`, API)).toBe(`${API}/uploads/submissions/old.pdf`);
  });

  it('accepts a same-host URL regardless of case', () => {
    expect(safeUploadUrl(`HTTPS://${new URL(API).host.toUpperCase()}/uploads/a.pdf`, API)).toBe(
      `HTTPS://${new URL(API).host.toUpperCase()}/uploads/a.pdf`,
    );
  });

  it('rejects an absolute URL on a foreign host', () => {
    expect(safeUploadUrl('https://evil.tld/uploads/a.pdf', API)).toBeNull();
  });

  it('rejects the historical userinfo bug reproduced as one concatenated string', () => {
    // The bug this helper replaces: string-concatenating BACKEND_URL + "@evil.tld/x"
    // produces a URL where the backend host becomes userinfo and evil.tld the real host.
    expect(safeUploadUrl(`${API}@evil.tld/x`, API)).toBeNull();
  });

  it('trims stray whitespace around an otherwise valid path', () => {
    expect(safeUploadUrl('  /uploads/a.pdf\n', API)).toBe(`${API}/uploads/a.pdf`);
  });
});

describe('safeLinkUrl', () => {
  it('rejects every hostile value', () => {
    for (const value of HOSTILE_VALUES.filter((v) => v !== 'https://evil.tld/a.png')) {
      expect(safeLinkUrl(value, API)).toBeNull();
    }
  });

  it('rejects non-strings and empty values without throwing', () => {
    for (const value of [undefined, null, '', '   ', 42, {}, []]) {
      expect(safeLinkUrl(value, API)).toBeNull();
    }
  });

  it('allows an absolute http(s) URL on any host — a teacher resource can point anywhere', () => {
    expect(safeLinkUrl('https://evil.tld/a.png', API)).toBe('https://evil.tld/a.png');
    expect(safeLinkUrl('https://en.wikipedia.org/wiki/Photosynthesis', API)).toBe(
      'https://en.wikipedia.org/wiki/Photosynthesis',
    );
  });

  it('still resolves an upload path the same way as safeUploadUrl', () => {
    expect(safeLinkUrl('/uploads/answer_keys/key.pdf', API)).toBe(`${API}/uploads/answer_keys/key.pdf`);
    expect(safeLinkUrl('uploads/answer_keys/key.pdf', API)).toBe(`${API}/uploads/answer_keys/key.pdf`);
  });
});
