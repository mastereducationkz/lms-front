import { describe, expect, it } from 'vitest';
import {
  canSkipFetch, materialIconKind, materialsVisibility, pickerListState, safeLinkHref, viewerContentKind,
} from './classMaterialsView';
import type { MaterialItem } from '../services/api/classMaterials';

type ItemShape = Pick<MaterialItem, 'kind' | 'file'>;

function fileItem(ext: string, kind: 'file' | 'image' | 'audio' = 'file'): ItemShape {
  return {
    kind: 'file',
    file: { id: 1, ext, mime_type: 'application/octet-stream', kind, size_bytes: 100, original_name: `a.${ext}` },
  };
}

const linkItem: ItemShape = { kind: 'link', file: null };

describe('materialIconKind', () => {
  it('is link for a link item', () => {
    expect(materialIconKind(linkItem)).toBe('link');
  });

  it('is presentation for ppt/pptx specifically', () => {
    expect(materialIconKind(fileItem('ppt'))).toBe('presentation');
    expect(materialIconKind(fileItem('pptx'))).toBe('presentation');
  });

  it('is file for other Office formats', () => {
    expect(materialIconKind(fileItem('docx'))).toBe('file');
    expect(materialIconKind(fileItem('xlsx'))).toBe('file');
  });

  it('is file for pdf', () => {
    expect(materialIconKind(fileItem('pdf'))).toBe('file');
  });

  it('follows the file kind for image and audio, regardless of ext', () => {
    expect(materialIconKind(fileItem('png', 'image'))).toBe('image');
    expect(materialIconKind(fileItem('heic', 'image'))).toBe('image');
    expect(materialIconKind(fileItem('mp3', 'audio'))).toBe('audio');
  });

  it('falls back to file when there is no file payload', () => {
    expect(materialIconKind({ kind: 'file', file: null })).toBe('file');
  });
});

describe('viewerContentKind', () => {
  it('is link for a link item, with no file lookup', () => {
    expect(viewerContentKind(linkItem)).toBe('link');
  });

  it('is pdf for a pdf file', () => {
    expect(viewerContentKind(fileItem('pdf'))).toBe('pdf');
  });

  it('is download for Office and HEIC/HEIF, which are kind "file"', () => {
    expect(viewerContentKind(fileItem('pptx'))).toBe('download');
    expect(viewerContentKind(fileItem('docx'))).toBe('download');
    expect(viewerContentKind(fileItem('heic'))).toBe('download');
    expect(viewerContentKind(fileItem('heif'))).toBe('download');
  });

  it('follows the file kind for image and audio', () => {
    expect(viewerContentKind(fileItem('png', 'image'))).toBe('image');
    expect(viewerContentKind(fileItem('m4a', 'audio'))).toBe('audio');
  });

  it('falls back to download when there is no file payload', () => {
    expect(viewerContentKind({ kind: 'file', file: null })).toBe('download');
  });
});

describe('materialsVisibility', () => {
  it('hides for a parent, without even looking at an error', () => {
    expect(materialsVisibility({ isParent: true })).toBe('hidden');
  });

  it('hides on a 404 — this lesson is not the viewer\'s to see', () => {
    const err = { response: { status: 404 } };
    expect(materialsVisibility({ isParent: false, error: err })).toBe('hidden');
  });

  it('shows an error for a 500 — not the same as "you cannot see this"', () => {
    const err = { response: { status: 500 } };
    expect(materialsVisibility({ isParent: false, error: err })).toBe('error');
  });

  it('shows an error for a network failure with no response at all', () => {
    const err = new Error('Network Error');
    expect(materialsVisibility({ isParent: false, error: err })).toBe('error');
  });

  it('shows an error when there is no error object to inspect', () => {
    expect(materialsVisibility({ isParent: false })).toBe('error');
  });
});

describe('canSkipFetch', () => {
  const lesson7 = { lesson: { id: 7 } };

  it('skips on the first attempt when initialData matches the lesson', () => {
    expect(canSkipFetch(lesson7, 7, 0)).toBe(true);
  });

  it('does not skip when initialData belongs to a different lesson', () => {
    expect(canSkipFetch(lesson7, 8, 0)).toBe(false);
  });

  it('does not skip on a retry, even for the same lesson', () => {
    expect(canSkipFetch(lesson7, 7, 1)).toBe(false);
  });

  it('does not skip when there is no initialData at all', () => {
    expect(canSkipFetch(undefined, 7, 0)).toBe(false);
  });
});

describe('safeLinkHref', () => {
  it('passes an http(s) link through', () => {
    expect(safeLinkHref({ kind: 'link', url: 'https://docs.google.com/d/1' })).toBe('https://docs.google.com/d/1');
    expect(safeLinkHref({ kind: 'link', url: 'http://example.com/a?b=1' })).toBe('http://example.com/a?b=1');
  });

  it('refuses any other scheme, so it never becomes a clickable href', () => {
    expect(safeLinkHref({ kind: 'link', url: 'javascript:alert(1)' })).toBeNull();
    expect(safeLinkHref({ kind: 'link', url: 'data:text/html,hi' })).toBeNull();
    expect(safeLinkHref({ kind: 'link', url: 'not a url' })).toBeNull();
  });

  it('is null for a missing url or a file item', () => {
    expect(safeLinkHref({ kind: 'link', url: null })).toBeNull();
    expect(safeLinkHref({ kind: 'file', url: 'https://example.com' })).toBeNull();
  });
});

describe('pickerListState', () => {
  it('shows rows whenever there are some, even mid-load or after a failed next page', () => {
    expect(pickerListState({ loading: true, failed: false, count: 2 })).toBe('ready');
    expect(pickerListState({ loading: false, failed: true, count: 2 })).toBe('ready');
  });

  it('is a spinner while loading with nothing on screen, including a retry', () => {
    expect(pickerListState({ loading: true, failed: false, count: 0 })).toBe('loading');
    expect(pickerListState({ loading: true, failed: true, count: 0 })).toBe('loading');
  });

  it('tells a failed load apart from an empty result', () => {
    expect(pickerListState({ loading: false, failed: true, count: 0 })).toBe('failed');
    expect(pickerListState({ loading: false, failed: false, count: 0 })).toBe('empty');
  });
});
