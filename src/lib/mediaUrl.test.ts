import { describe, expect, it } from 'vitest';
import { backendBase, mediaUrl } from './mediaUrl';

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
