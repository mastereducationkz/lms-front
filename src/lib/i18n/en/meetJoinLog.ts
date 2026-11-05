import type { MessageTable } from '../types';

/** The per-student join log in a lesson's Meet record: when they came and went, and why the mark is what it is (2026-11-05). */
export const meetJoinLog = {
  'meetJoinLog.joined': 'Joined {time}',
  'meetJoinLog.left': 'left {time}',
  'meetJoinLog.rejoined': 'rejoined {time}',
  'meetJoinLog.stillIn': 'still in the room',
  'meetJoinLog.noJoin': 'Did not join the room',
  'meetJoinLog.noJoinHeld': 'No confirmed account of theirs joined',
  'meetJoinLog.minutes': '{minutes} of {held} min, needs {required}',
  'meetJoinLog.minutesOnly': '{minutes} min, needs {required}',

  'meetJoinLog.why.heldGuest': 'Meet is holding this back: an unconfirmed guest was in the room and may be this student.',
  'meetJoinLog.why.heldAccount': 'Meet is holding this back: an unconfirmed account was in the room and may be this student.',
  'meetJoinLog.why.meetMark': 'The mark ({mark}) is Meet’s, set from this record.',
  'meetJoinLog.why.agrees': 'The mark is the teacher’s, and Meet’s count agrees with it.',
  'meetJoinLog.why.changedBy': 'Meet decided, then {who} changed the mark to {mark}: {why}.',
  'meetJoinLog.why.changed': 'Meet decided, then the mark was changed to {mark}: {why}.',
  'meetJoinLog.why.shadow': 'The mark is the teacher’s: Meet is only watching for now.',
  'meetJoinLog.why.skipped': 'Meet left the mark alone: {reason}.',
  'meetJoinLog.why.reverted': 'Meet’s mark was undone.',
  'meetJoinLog.why.teacher': 'The mark is the teacher’s.',
  'meetJoinLog.why.unmarked': 'Not marked yet. By Meet’s count: {verdict}.',
  'meetJoinLog.why.noReason': 'no reason given',

  // ── guests matched from the group's memory ───────────────────────────────────────────────
  'meetJoinLog.auto': 'auto',
  'meetJoinLog.autoHint': 'Matched automatically: the group named this guest in an earlier lesson. Press × if it is not this person; it will not be matched again.',
} as const satisfies MessageTable;
