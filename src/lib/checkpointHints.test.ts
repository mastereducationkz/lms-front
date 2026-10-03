import { describe, expect, it } from 'vitest';
import type { StudentCheckpointItem } from '../services/api/checkpoints';
import { buildCheckpointHints, firstOpenCheckpoint, isOpen, lockKindFor } from './checkpointHints';

const item = (number: number, status: StudentCheckpointItem['status'], extra: Partial<StudentCheckpointItem> = {}): StudentCheckpointItem => ({
  id: number, status, opened_at: null, deadline: null, submitted_at: null, correct_answers: null,
  total_questions: 45, percentage: null, opened_by: null, reopen_count: 0, quiz_attempt_id: null,
  late: false, late_minutes: null, checkpoint_id: number, number, title: `Checkpoint ${number}`,
  group_id: 1, group_name: 'G', locked_reason: null, skipped: false,
  covers: [
    { lesson_id: number * 10 + 1, title: `Unit ${number}a`, kind: 'verbal', completed: true },
    { lesson_id: number * 10 + 2, title: `Unit ${number}b`, kind: 'math', completed: true },
  ],
  quiz: { course_id: 1, lesson_id: 900 + number },
  ...extra,
});

describe('checkpoint hints', () => {
  it.each([
    ['available', true], ['reopened', true], ['overdue', true], ['completed', false], ['locked', false],
  ] as const)('treats %s as open: %s', (status, open) => {
    expect(isOpen({ status })).toBe(open);
  });

  it('invites the student to the lowest-numbered open checkpoint', () => {
    expect(firstOpenCheckpoint([item(3, 'available'), item(1, 'completed'), item(2, 'overdue')])?.number).toBe(2);
    expect(firstOpenCheckpoint([item(1, 'completed'), item(2, 'locked', { skipped: true, quiz: null })])).toBeNull();
  });

  it('never explains a unit refusal with a checkpoint: checkpoints lock nothing', () => {
    // Checkpoint 1 is open and unsubmitted; checkpoint 2's units must still not read as held back.
    const hints = buildCheckpointHints([item(1, 'available'), item(2, 'locked', { quiz: null })]);
    expect(lockKindFor(hints, 21)).toBeNull();
    expect(lockKindFor(hints, 22)).toBeNull();
  });

  it('only a checkpoint quiz that is not open explains a refusal', () => {
    const hints = buildCheckpointHints([item(1, 'available'), item(2, 'completed')]);
    expect(lockKindFor(hints, 901)).toBeNull();
    expect(lockKindFor(hints, 902)).toEqual({ kind: 'checkpoint-shut', item: expect.objectContaining({ number: 2 }) });
  });
});
