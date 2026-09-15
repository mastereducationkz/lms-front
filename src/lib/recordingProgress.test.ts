import { describe, expect, it } from 'vitest';
import {
  attemptsText,
  badgeText,
  etaText,
  fastestPoll,
  liveEventIds,
  mergeRecordingStatus,
  missingAfterText,
  overallPercent,
  phaseLine,
  pollInterval,
  progressFor,
  queueText,
  recordingSteps,
  stageSentence,
  stageTitle,
  stageTone,
  updatedAgo,
  workerLine,
} from './recordingProgress';
import type { RecordingProgress } from '../services/api/recordings';
import type { MeetSync } from '../services/api/meetAttendance';

// Lesson 19:00–20:00 Almaty = 14:00–15:00 UTC.
const NOW = Date.parse('2026-09-15T16:25:00Z');

const progress = (extra: Partial<RecordingProgress> = {}): RecordingProgress => ({
  stage: 'processing', phase: null, phase_percent: null, percent: null, eta_seconds: null, position: null,
  queue_length: null, held_for_disk: false, attempts: 1, max_attempts: 3, error: null,
  lesson_ended_at: '2026-09-15T15:00:00Z', missing_after: null, claimed_at: '2026-09-15T16:45:00Z',
  updated_at: null, sync: null, ...extra,
});

const sync = (extra: Partial<MeetSync> = {}): MeetSync => ({
  running: false, step: null, progress: null, started_at: '2026-09-15T16:15:00Z', finished_at: '2026-09-15T16:21:00Z',
  attendance_at: null, next_at: '2026-09-15T16:26:00Z', slow: false, ...extra,
});

describe('what a recording on its way says (2026-09-15)', () => {
  it('names each stage in both languages', () => {
    expect(stageTitle(progress({ stage: 'waiting_for_google' }))).toBe('Waiting for Google Meet');
    expect(stageTitle(progress({ stage: 'waiting_for_google' }), 'ru')).toBe('Ждём Google Meet');
    expect(stageTitle(progress({ stage: 'queued', held_for_disk: true }))).toBe('On hold');
    expect(stageSentence(progress({ stage: 'queued', held_for_disk: true }), 'ru'))
      .toBe('Записи на паузе: сервер освобождает место на диске. Всё продолжится само.');
    expect(stageSentence(progress({ stage: 'lesson_running' })))
      .toBe('The recording appears after the lesson, once Google Meet has finished it.');
  });

  it('labels cards briefly, with the percent or place in line when there is one', () => {
    expect(badgeText(progress({ percent: 41.6 }))).toBe('Processing · 42%');
    expect(badgeText(progress())).toBe('Processing');
    expect(badgeText(progress({ stage: 'queued', position: 3, queue_length: 32 }))).toBe('In line · #3');
    expect(badgeText(progress({ stage: 'queued', position: 3, queue_length: 32 }), 'ru')).toBe('В очереди · №3');
    expect(badgeText(progress({ stage: 'retrying', attempts: 1 }))).toBe('Retrying 2/3');
    expect(badgeText(progress({ stage: 'failed', attempts: 3 }), 'ru')).toBe('Не обработалась');
  });

  it('says how far the step under way is, and a time only when one was measured', () => {
    expect(phaseLine(progress({ phase: 'downloading', phase_percent: 64, eta_seconds: 95 })))
      .toBe('Downloading from Google Drive · 64% · about 2 min left');
    expect(phaseLine(progress({ phase: 'packaging' }), 'ru')).toBe('Готовим к просмотру');
    expect(etaText(null)).toBeNull();
    expect(etaText(30, 'ru')).toBe('осталось меньше минуты');
    expect(overallPercent(progress({ percent: 120 }))).toBe(100);
    expect(overallPercent(progress({ stage: 'queued', percent: 50 }))).toBeNull();
  });

  it('says the place in line and the attempt', () => {
    expect(queueText(progress({ stage: 'queued', position: 3, queue_length: 32 }))).toBe('3rd in line · 32 waiting');
    expect(queueText(progress({ stage: 'queued', position: 12, queue_length: 32 }))).toBe('12th in line · 32 waiting');
    expect(queueText(progress({ stage: 'queued', position: 1, queue_length: 4 }), 'ru')).toBe('1-я в очереди · всего 4');
    expect(queueText(progress({ stage: 'processing', position: 1, queue_length: 4 }))).toBeNull();
    expect(attemptsText(progress({ stage: 'retrying', attempts: 1 }))).toBe('Retrying · attempt 2 of 3');
    expect(attemptsText(progress({ stage: 'processing', attempts: 1 }))).toBeNull();
    expect(attemptsText(progress({ stage: 'processing', attempts: 2 }), 'ru')).toBe('Попытка 2 из 3');
  });

  it('warns staff when a lesson waiting on Google would be flagged', () => {
    expect(missingAfterText(progress({ stage: 'waiting_for_google', missing_after: '2026-09-15T21:00:00Z' })))
      .toBe('If nothing arrives by 02:00, the lesson is flagged as having no recording.');
    expect(missingAfterText(progress({ stage: 'queued', missing_after: '2026-09-15T21:00:00Z' }))).toBeNull();
  });

  it('colours by what the viewer should feel', () => {
    expect(stageTone(progress())).toBe('progress');
    expect(stageTone(progress({ stage: 'queued', held_for_disk: true }))).toBe('warning');
    expect(stageTone(progress({ stage: 'retrying' }))).toBe('warning');
    expect(stageTone(progress({ stage: 'failed' }))).toBe('danger');
  });
});

describe('a step that has only just begun (owner’s screenshot, 2026-09-15)', () => {
  it('reads «starting», not «0%» under a bar already half full', () => {
    const justUploading = progress({ phase: 'uploading', phase_percent: 0, percent: 50 });
    expect(phaseLine(justUploading)).toBe('Uploading · starting');
    expect(phaseLine(justUploading, 'ru')).toBe('Загружаем · начинаем');
    expect(phaseLine(progress({ phase: 'uploading', phase_percent: 12, percent: 56 }))).toBe('Uploading · 12%');
    const active = recordingSteps(justUploading).find((step) => step.status === 'active');
    expect(active?.key).toBe('uploading');
    expect(active?.detail).toBe('starting');
  });
});

describe('the steps to a watchable recording', () => {
  const statuses = (p: RecordingProgress) => recordingSteps(p).map((s) => s.status);

  it('walks from the lesson to ready', () => {
    expect(statuses(progress({ stage: 'lesson_running' })))
      .toEqual(['active', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
    expect(statuses(progress({ stage: 'waiting_for_google' })))
      .toEqual(['done', 'active', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
    expect(statuses(progress({ stage: 'processing', phase: 'preview' })))
      .toEqual(['done', 'done', 'done', 'done', 'done', 'active', 'todo', 'todo']);
    expect(statuses(progress({ stage: 'ready' }))).toEqual(Array(8).fill('done'));
    expect(statuses(progress({ stage: 'failed', attempts: 3 })))
      .toEqual(['done', 'done', 'todo', 'todo', 'todo', 'todo', 'todo', 'failed']);
  });

  it('puts the numbers on the step under way', () => {
    const steps = recordingSteps(progress({ phase: 'downloading', phase_percent: 64, eta_seconds: 95 }));
    expect(steps[0].detail).toBe('Ended 20:00');
    expect(steps[1].detail).toBe('Received 21:45');
    expect(steps[3]).toMatchObject({ key: 'downloading', status: 'active', percent: 64, detail: '64% · about 2 min left' });
    const queued = recordingSteps(progress({ stage: 'queued', position: 2, queue_length: 5 }), 'ru');
    expect(queued[2]).toMatchObject({ label: 'Очередь', status: 'active', detail: '2-я в очереди · всего 5' });
    expect(recordingSteps(progress({ stage: 'failed', attempts: 3 })).slice(-1)[0].detail).toBe('Attempt 3 of 3');
  });
});

describe('an older server, polling and the worker', () => {
  it('reads a bare status honestly', () => {
    expect(progressFor('pending')?.stage).toBe('processing');
    expect(progressFor('waiting')?.stage).toBe('waiting_for_google');
    expect(progressFor('missing')).toBeNull();
    const sent = progress({ stage: 'queued' });
    expect(progressFor('pending', sent)).toBe(sent);
  });

  it('looks again often while a percent moves, rarely while waiting, never when done', () => {
    expect(pollInterval(progress())).toBe(5_000);
    expect(pollInterval(progress({ stage: 'queued' }))).toBe(20_000);
    expect(pollInterval(progress({ stage: 'waiting_for_google' }))).toBe(20_000);
    expect(pollInterval(progress({ stage: 'ready' }))).toBeNull();
    expect(pollInterval(progress({ stage: 'failed' }))).toBeNull();
    expect(pollInterval(null)).toBeNull();
  });

  it('says how fresh the report is', () => {
    expect(updatedAgo('2026-09-15T16:24:48Z', NOW)).toBe('updated 12 s ago');
    expect(updatedAgo('2026-09-15T16:22:00Z', NOW, 'ru')).toBe('обновлено 3 мин назад');
    expect(updatedAgo('2026-09-15T16:24:59Z', NOW)).toBe('updated just now');
  });

  it('says what the worker is doing, or when it looks next', () => {
    expect(workerLine(sync({ running: true, step: 'ingested', next_at: null }), NOW))
      .toEqual({ tone: 'active', text: 'Checking now · preparing recordings' });
    expect(workerLine(sync(), NOW, 'ru'))
      .toEqual({ tone: 'idle', text: 'Последняя проверка в 21:21 · следующая в 21:26' });
    expect(workerLine(sync({ running: true, slow: true, started_at: '2026-09-15T15:40:00Z' }), NOW)?.tone).toBe('slow');
    expect(workerLine(null, NOW)).toBeNull();
  });
});

describe('library cards kept live', () => {
  const item = (id: number, status: string, extra: Partial<RecordingProgress> | null = null) => ({
    event_id: id, status, poster_url: null as string | null, duration_seconds: null as number | null,
    progress: extra ? progress(extra) : undefined,
  });

  it('asks only about cards still on their way, at the busiest card’s pace', () => {
    const items = [item(1, 'ready'), item(2, 'pending', { stage: 'queued' }), item(3, 'failed'), item(4, 'pending', { stage: 'processing' })];
    expect(liveEventIds(items)).toEqual([2, 4]);
    expect(fastestPoll(items)).toBe(5_000);
    expect(fastestPoll([item(1, 'ready'), item(3, 'failed')])).toBeNull();
    expect(liveEventIds(Array.from({ length: 60 }, (_, i) => item(i, 'pending')))).toHaveLength(48);
  });

  it('takes the news in place and never turns a card into a lesson without a recording', () => {
    const card = { ...item(7, 'pending', { stage: 'processing' }), title: 'Lesson 7' };
    const ready = mergeRecordingStatus(card, { status: 'ready', progress: null, poster_url: '/p.jpg', duration_seconds: 3590 });
    expect(ready).toMatchObject({ title: 'Lesson 7', status: 'ready', poster_url: '/p.jpg', duration_seconds: 3590, progress: null });
    expect(mergeRecordingStatus(card, { status: 'waiting', progress: null, poster_url: null, duration_seconds: null }).status).toBe('pending');
  });
});
