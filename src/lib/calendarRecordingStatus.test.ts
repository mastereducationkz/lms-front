import { describe, expect, it } from 'vitest';
import { liveRecordingIds, nextRecordingPoll, recordingMark, seesRecordingProgress } from './calendarRecordingStatus';
import type { Event } from '../types';
import type { RecordingProgress, RecordingStatusEntry } from '../services/api/recordings';

// Lesson 19:00–20:00 Almaty = 14:00–15:00 UTC; "now" is 21:25 Almaty.
const NOW = Date.parse('2026-09-15T16:25:00Z');

const lesson = (id: number, extra: Partial<Event> = {}): Event => ({
  id, title: `Lesson ${id}`, event_type: 'class',
  start_datetime: '2026-09-15T14:00:00Z', end_datetime: '2026-09-15T15:00:00Z',
  meeting_url: 'https://meet.google.com/abc-defg-hij', ...extra,
} as Event);

const progress = (extra: Partial<RecordingProgress> = {}): RecordingProgress => ({
  stage: 'processing', phase: 'uploading', phase_percent: 40, percent: 70, eta_seconds: null, position: null,
  queue_length: null, held_for_disk: false, attempts: 1, max_attempts: 3, error: null, lesson_ended_at: null,
  missing_after: null, claimed_at: null, updated_at: null, sync: null, ...extra,
});

const entry = (status: RecordingStatusEntry['status'], p: RecordingProgress | null = null): RecordingStatusEntry => ({
  status, progress: p, poster_url: null, duration_seconds: null,
});

describe('recording marks on the calendar (2026-09-15)', () => {
  it('shows «recorded» to everyone and the stages before it to staff only', () => {
    expect(recordingMark(lesson(1, { recording: { status: 'ready' } }), 'student')).toEqual({ kind: 'ready', label: 'Recorded' });
    expect(recordingMark(lesson(2, { recording: { status: 'pending' } }), 'student')).toBeNull();
    expect(recordingMark(lesson(2, { recording: { status: 'pending' } }), 'teacher'))
      .toEqual({ kind: 'processing', label: 'Recording is being prepared' });
    expect(recordingMark(lesson(3, { recording: { status: 'failed' } }), 'curator', null, 'ru'))
      .toEqual({ kind: 'failed', label: 'Запись не обработалась' });
    expect(recordingMark(lesson(4, { recording: { status: 'removed' } }), 'admin')?.kind).toBe('removed');
    expect(recordingMark(lesson(5), 'admin')).toBeNull();
    expect(recordingMark(lesson(6, { event_type: 'webinar', recording: { status: 'ready' } } as Partial<Event>), 'admin')).toBeNull();
    expect(seesRecordingProgress('head_teacher')).toBe(true);
    expect(seesRecordingProgress('student')).toBe(false);
  });

  it('prefers the live status, with its percent or place in line, while a day is open', () => {
    const waiting = lesson(7);
    expect(recordingMark(waiting, 'admin', entry('waiting', progress({ stage: 'waiting_for_google', phase: null }))))
      .toEqual({ kind: 'waiting', label: 'Waiting for Google Meet' });
    const pending = lesson(8, { recording: { status: 'pending' } });
    expect(recordingMark(pending, 'admin', entry('pending', progress()))?.label).toBe('Processing · 70%');
    expect(recordingMark(pending, 'admin', entry('pending', progress({ stage: 'queued', position: 3, queue_length: 32 })))?.label)
      .toBe('In line · #3');
    expect(recordingMark(pending, 'admin', entry('ready'))).toEqual({ kind: 'ready', label: 'Recorded' });
    // A student never reads a live status: the summary («pending») decides, and says nothing to them.
    expect(recordingMark(pending, 'student', entry('ready'))).toBeNull();
  });
});

describe('what an open day asks the server about', () => {
  it('only lessons whose recording may still be on its way, and only for staff', () => {
    const events = [
      lesson(1, { recording: { status: 'pending' } }),
      lesson(2),                                                     // ended 1 h 25 min ago, a room, no recording yet
      lesson(3, { meeting_url: undefined }),                         // no LMS room: no recording coming
      lesson(4, { recording: { status: 'ready' } }),
      lesson(5, { recording: { status: 'failed' } }),
      lesson(6, { end_datetime: '2026-09-15T08:00:00Z' }),           // ended 8 h ago: past the grace
      lesson(7, { start_datetime: '2026-09-15T16:00:00Z', end_datetime: '2026-09-15T17:00:00Z' }), // still on
    ];
    expect(liveRecordingIds(events, 'teacher', NOW)).toEqual([1, 2]);
    expect(liveRecordingIds(events, 'student', NOW)).toEqual([]);
    expect(liveRecordingIds(Array.from({ length: 60 }, (_, i) => lesson(i + 1, { recording: { status: 'pending' } })), 'admin', NOW))
      .toHaveLength(48);
  });

  it('asks again at the busiest lesson’s pace and stops when nothing is on its way', () => {
    expect(nextRecordingPoll([1, 2], { 1: entry('pending', progress()), 2: entry('waiting', progress({ stage: 'waiting_for_google' })) }))
      .toBe(5_000);
    expect(nextRecordingPoll([1, 2], { 1: entry('ready'), 2: entry('missing') })).toBeNull();
    expect(nextRecordingPoll([1], {})).toBeNull();
  });
});
