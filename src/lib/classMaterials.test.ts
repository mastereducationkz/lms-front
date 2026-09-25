import { describe, expect, it } from 'vitest';

import { MAX_UPLOAD_BYTES } from './uploadFailure';
import {
  bellPollDelayMs, COPY, copyResultToast, type CopyKey, errorMessage, fileExt, formatSize,
  homeworkLinkLabel, isGoogleShareLink, isOfficeExt, lessonHeading, materialsBadgeVariant,
  openedCount, pendingAfterClass, plural, preCheckFile, relativeTime, suggestTopic, t,
  topicInputValue, uploadErrorReason, validateLinkUrl,
} from './classMaterials';

describe('preCheckFile', () => {
  it('refuses a video with its own reason, before checking anything else', () => {
    expect(preCheckFile({ name: 'a.mp4', size: 1 })).toBe('video_not_allowed');
  });

  it('refuses an extension outside the allow-list', () => {
    expect(preCheckFile({ name: 'a.exe', size: 10 })).toBe('unsupported_type');
  });

  it('refuses an empty file', () => {
    expect(preCheckFile({ name: 'a.pdf', size: 0 })).toBe('empty_file');
  });

  it('refuses anything over the 50 MB cap', () => {
    expect(preCheckFile({ name: 'a.pdf', size: 50 * 1024 * 1024 + 1 })).toBe('too_large');
  });

  it('accepts an allowed extension, case-insensitively, within the size cap', () => {
    expect(preCheckFile({ name: 'A.PDF', size: 10 })).toBeNull();
  });

  it('accepts exactly the size cap', () => {
    expect(preCheckFile({ name: 'a.pdf', size: MAX_UPLOAD_BYTES })).toBeNull();
  });
});

describe('validateLinkUrl', () => {
  it('rejects a javascript: URL', () => {
    expect(validateLinkUrl('javascript:alert(1)')).toBe('bad_url');
  });

  it('rejects a non-http(s) scheme', () => {
    expect(validateLinkUrl('ftp://x')).toBe('bad_url');
  });

  it('rejects a scheme with no host', () => {
    expect(validateLinkUrl('http://')).toBe('bad_url');
  });

  it('accepts an https URL with a host', () => {
    expect(validateLinkUrl('https://docs.google.com/x')).toBeNull();
  });

  it('rejects a URL over 2000 characters', () => {
    const long = `https://example.com/${'a'.repeat(2001 - 'https://example.com/'.length)}`;
    expect(long.length).toBe(2001);
    expect(validateLinkUrl(long)).toBe('bad_url');
  });
});

describe('isGoogleShareLink', () => {
  it('accepts docs.google.com', () => {
    expect(isGoogleShareLink('https://docs.google.com/document/d/abc/edit')).toBe(true);
  });

  it('accepts drive.google.com', () => {
    expect(isGoogleShareLink('https://drive.google.com/file/d/abc/view')).toBe(true);
  });

  it('rejects bare google.com', () => {
    expect(isGoogleShareLink('https://google.com')).toBe(false);
  });

  it('rejects a host-confusion attempt with docs.google.com only in the path', () => {
    expect(isGoogleShareLink('https://evil.com/?docs.google.com')).toBe(false);
  });
});

describe('isOfficeExt', () => {
  it('recognises office document extensions', () => {
    expect(isOfficeExt('pptx')).toBe(true);
    expect(isOfficeExt('docx')).toBe(true);
    expect(isOfficeExt('xlsx')).toBe(true);
  });

  it('rejects non-office extensions', () => {
    expect(isOfficeExt('pdf')).toBe(false);
    expect(isOfficeExt('png')).toBe(false);
  });
});

describe('fileExt', () => {
  it('lower-cases the extension', () => {
    expect(fileExt('Reading.PDF')).toBe('pdf');
  });

  it('returns an empty string when there is no extension', () => {
    expect(fileExt('README')).toBe('');
  });
});

describe('suggestTopic', () => {
  it('strips extensions and trailing (N), dedupes, and takes the first two', () => {
    expect(suggestTopic(['Reading Practice 4.pdf', 'Vocabulary list (1).docx', 'x.png']))
      .toBe('Reading Practice 4 · Vocabulary list');
  });

  it('skips screenshot- and scan-like names entirely', () => {
    expect(suggestTopic(['IMG_1234.jpg', 'Снимок экрана 2026.png', 'Scan 3.pdf'])).toBe('');
  });

  it('collapses duplicate titles', () => {
    expect(suggestTopic(['Homework.pdf', 'Homework.pdf', 'Homework (2).pdf'])).toBe('Homework');
  });

  it('cuts a long result to 120 characters, ending with an ellipsis', () => {
    const long = 'A'.repeat(200);
    const result = suggestTopic([long]);
    expect(result.length).toBe(120);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns an empty string when nothing survives', () => {
    expect(suggestTopic(['whatsapp image 2026-09-01.jpg', 'photo_123.png', ''])).toBe('');
  });
});

describe('plural', () => {
  const RU: [string, string, string] = ['материал', 'материала', 'материалов'];
  const EN: [string, string] = ['material', 'materials'];

  it('picks the Russian form by the standard 1/2-4/5+ rule', () => {
    expect(plural(1, 'ru', RU, EN)).toBe('1 материал');
    expect(plural(2, 'ru', RU, EN)).toBe('2 материала');
    expect(plural(5, 'ru', RU, EN)).toBe('5 материалов');
    expect(plural(11, 'ru', RU, EN)).toBe('11 материалов');
    expect(plural(21, 'ru', RU, EN)).toBe('21 материал');
  });

  it('uses the English singular only for exactly 1', () => {
    expect(plural(1, 'en', RU, EN)).toBe('1 material');
    expect(plural(2, 'en', RU, EN)).toBe('2 materials');
  });
});

describe('t / COPY', () => {
  it('has a non-empty ru and en string for every key', () => {
    (Object.keys(COPY) as CopyKey[]).forEach((key) => {
      expect(t(key, 'ru').trim().length).toBeGreaterThan(0);
      expect(t(key, 'en').trim().length).toBeGreaterThan(0);
    });
  });
});

describe('errorMessage', () => {
  it('resolves a known error code from COPY', () => {
    expect(errorMessage('too_large', 'ru')).toBe('Файл больше 50 МБ');
  });

  it('falls back to somethingWrong for an unknown code', () => {
    expect(errorMessage('not_a_real_code', 'ru')).toBe(t('somethingWrong', 'ru'));
    expect(errorMessage(undefined, 'en')).toBe(t('somethingWrong', 'en'));
  });
});

describe('lessonHeading', () => {
  it('formats dd.mm, weekday, groups and topic in Russian', () => {
    expect(lessonHeading(
      { start_datetime: '2026-09-12T12:00:00', group_names: ['SAT-3'], topic: null },
      'ru',
    )).toBe('12.09, Сб · SAT-3');
  });

  it('appends the topic when set', () => {
    expect(lessonHeading(
      { start_datetime: '2026-09-12T12:00:00', group_names: ['SAT-3'], topic: 'Reading' },
      'ru',
    )).toBe('12.09, Сб · SAT-3 · Reading');
  });

  it('uses the English weekday abbreviation', () => {
    expect(lessonHeading(
      { start_datetime: '2026-09-12T12:00:00', group_names: ['SAT-3'], topic: null },
      'en',
    )).toBe('12.09, Sat · SAT-3');
  });
});

describe('formatSize', () => {
  it('formats megabytes with one decimal', () => {
    expect(formatSize(1_258_291, 'en')).toBe('1.2 MB');
  });

  it('formats kilobytes as a whole number', () => {
    expect(formatSize(870_400, 'en')).toBe('850 KB');
  });

  it('uses a comma decimal separator and Cyrillic units in Russian', () => {
    expect(formatSize(1_258_291, 'ru')).toBe('1,2 МБ');
    expect(formatSize(870_400, 'ru')).toBe('850 КБ');
  });
});

describe('pendingAfterClass', () => {
  it('says «Ещё 1 материал откроется после урока» for one', () => {
    expect(pendingAfterClass(1, 'ru')).toBe('Ещё 1 материал откроется после урока');
  });

  it('says «Ещё 3 материала откроются после урока» for three', () => {
    expect(pendingAfterClass(3, 'ru')).toBe('Ещё 3 материала откроются после урока');
  });

  it('reads in English', () => {
    expect(pendingAfterClass(2, 'en')).toBe('2 more will open after class');
  });
});

describe('openedCount', () => {
  it('reads in Russian', () => {
    expect(openedCount(3, 10, 'ru')).toBe('Открыли 3 из 10');
  });

  it('reads in English', () => {
    expect(openedCount(3, 10, 'en')).toBe('Opened by 3 of 10');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-09-20T12:00:00Z').getTime();

  it('says just now / только что under a minute', () => {
    expect(relativeTime('2026-09-20T11:59:30Z', now, 'en')).toBe('just now');
    expect(relativeTime('2026-09-20T11:59:30Z', now, 'ru')).toBe('только что');
  });

  it('picks the Russian plural form for minutes', () => {
    expect(relativeTime('2026-09-20T11:58:00Z', now, 'ru')).toBe('2 минуты назад');
    expect(relativeTime('2026-09-20T11:41:00Z', now, 'ru')).toBe('19 минут назад');
  });

  it('reads in English for minutes and hours', () => {
    expect(relativeTime('2026-09-20T11:58:00Z', now, 'en')).toBe('2 min ago');
    expect(relativeTime('2026-09-20T09:00:00Z', now, 'en')).toBe('3 h ago');
  });

  it('picks the Russian plural form for hours and days', () => {
    expect(relativeTime('2026-09-20T09:00:00Z', now, 'ru')).toBe('3 часа назад');
    expect(relativeTime('2026-09-18T12:00:00Z', now, 'ru')).toBe('2 дня назад');
  });

  it('falls back to a dd.mm date past a week', () => {
    expect(relativeTime('2026-09-01T12:00:00Z', now, 'en')).toBe('01.09');
    expect(relativeTime('2026-09-01T12:00:00Z', now, 'ru')).toBe('01.09');
  });
});

describe('materialsBadgeVariant', () => {
  it('shows the count once it is above zero, for any role', () => {
    expect(materialsBadgeVariant(101, 3, 'student')).toBe('count');
    expect(materialsBadgeVariant(101, 1, 'curator')).toBe('count');
  });

  it('offers a faint add invitation at zero for a manager-capable role', () => {
    expect(materialsBadgeVariant(101, 0, 'teacher')).toBe('add');
    expect(materialsBadgeVariant(101, 0, 'head_teacher')).toBe('add');
    expect(materialsBadgeVariant(101, 0, 'admin')).toBe('add');
  });

  it('hides the badge at zero for a curator or head_curator', () => {
    expect(materialsBadgeVariant(101, 0, 'curator')).toBeNull();
    expect(materialsBadgeVariant(101, 0, 'head_curator')).toBeNull();
  });

  it('hides the badge without an event_id, even with a count', () => {
    expect(materialsBadgeVariant(null, 5, 'teacher')).toBeNull();
    expect(materialsBadgeVariant(undefined, 5, 'admin')).toBeNull();
    expect(materialsBadgeVariant(0, 5, 'admin')).toBeNull();
  });
});

describe('topicInputValue', () => {
  it('suggests from the current titles until the teacher types', () => {
    expect(topicInputValue(null, null, [])).toBe('');
    // The same row, re-rendered after the first upload lands: the suggestion appears.
    expect(topicInputValue(null, null, ['Reading Practice 4.pdf'])).toBe('Reading Practice 4');
  });

  it('keeps whatever the teacher typed, even an empty string, as items keep changing', () => {
    expect(topicInputValue('My topic', null, ['Reading Practice 4.pdf'])).toBe('My topic');
    expect(topicInputValue('', null, ['Reading Practice 4.pdf'])).toBe('');
  });

  it('prefers a confirmed topic over a suggestion', () => {
    expect(topicInputValue(null, 'Past Simple', ['Reading Practice 4.pdf'])).toBe('Past Simple');
  });
});

describe('uploadErrorReason', () => {
  it('uses the copy for a class-materials error code', () => {
    expect(uploadErrorReason({ response: { status: 400 } }, 'corrupt_file')).toBe(t('corrupt_file', 'en'));
  });

  it('falls back to the shared upload reason, capitalised, when there is no code', () => {
    expect(uploadErrorReason({ isAxiosError: true, code: 'ERR_NETWORK' }, undefined))
      .toBe('The connection to the server was lost; check the internet connection and try again');
    expect(uploadErrorReason({ response: { status: 502 } }, undefined))
      .toBe('The server could not save it (error 502); try again in a minute');
    expect(uploadErrorReason({ response: { status: 413 } }, undefined)).toBe('The file is larger than 50 MB');
    expect(uploadErrorReason({ config: { uploadStalled: true } }, undefined)).toMatch(/^The upload stopped/);
  });
});

describe('homeworkLinkLabel', () => {
  it('names the homework', () => {
    expect(homeworkLinkLabel('Unit 3', 'ru')).toBe('Домашнее задание: Unit 3 →');
    expect(homeworkLinkLabel('  Unit 3 ', 'en')).toBe('Homework: Unit 3 →');
  });

  it('falls back to the untitled line for a blank title', () => {
    expect(homeworkLinkLabel('', 'ru')).toBe(t('homeworkLink', 'ru'));
    expect(homeworkLinkLabel(null, 'en')).toBe(t('homeworkLink', 'en'));
  });
});

describe('copyResultToast', () => {
  it('reports what was added', () => {
    expect(copyResultToast(3, 0, 'en')).toEqual({ kind: 'success', text: '+3' });
    expect(copyResultToast(2, 1, 'en')).toEqual({ kind: 'success', text: '+2' });
  });

  it('never says «+0»: all duplicates is the duplicate notice', () => {
    expect(copyResultToast(0, 2, 'ru')).toEqual({ kind: 'info', text: t('duplicate', 'ru') });
  });

  it('says nothing when the source had nothing to copy', () => {
    expect(copyResultToast(0, 0, 'en')).toBeNull();
  });
});

describe('bellPollDelayMs', () => {
  it('spreads polls over 120 s ± 15 s', () => {
    expect(bellPollDelayMs(0)).toBe(105_000);
    expect(bellPollDelayMs(0.5)).toBe(120_000);
    expect(bellPollDelayMs(0.999999)).toBeLessThanOrEqual(135_000);
    expect(bellPollDelayMs(0.999999)).toBeGreaterThan(134_900);
  });

  it('clamps an out-of-range random into the window', () => {
    expect(bellPollDelayMs(-1)).toBe(105_000);
    expect(bellPollDelayMs(2)).toBe(135_000);
  });
});
