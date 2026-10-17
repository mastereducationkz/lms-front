import { describe, expect, it } from 'vitest';
import type { MeetReviewOptions } from '../services/api/meetAttendance';
import type { RegisterLock, StudentRegister } from '../services/api/meetRegister';
import {
  cellIsOpen, cellLock, changeReady, evidenceLine, handedBack, heldBack, lengthIndex, lessonLock, lessonMinutes,
  lockIndex, lockedTitle, markLabel, mergeLocks, pickMark, reasonFlag, reasonPresets, toChange,
} from './registerLock';

const reg = (over: Partial<StudentRegister> = {}): StudentRegister => ({
  state: 'written', mode: 'live', status: 'present', skip_reason: null, verdict: 'present',
  minutes: 52, required: 45, late_minutes: 0, override: null, ...over,
});
const lock = (over: Partial<RegisterLock> = {}): RegisterLock => ({
  state: 'decided', override_closes_at: '2026-10-24T16:30:00Z', may_override: true, ...over,
});

describe('cellLock', () => {
  it('locks every cell of a lesson Meet has not decided yet', () => {
    expect(cellLock(lock({ state: 'pending' }), undefined)).toBe('pending');
    expect(cellLock(lock({ state: 'pending' }), reg({ state: 'held' }))).toBe('pending');
  });

  it('locks only the students Meet decided once it has: written, kept, or a person’s answer to it', () => {
    for (const state of ['written', 'kept', 'override'] as const) {
      expect(cellLock(lock(), reg({ state }))).toBe('meet');
    }
    for (const state of ['held', 'skipped', 'would_write', 'reverted'] as const) {
      expect(cellLock(lock(), reg({ state }))).toBe('open');
    }
    expect(cellLock(lock(), undefined)).toBe('open');
  });

  it('locks nothing without a lock, on an older server, or when the lesson is not Meet’s', () => {
    expect(cellLock(undefined, reg())).toBe('open');
    expect(cellLock(null, reg())).toBe('open');
    expect(cellLock(lock({ state: 'none' }), reg())).toBe('open');
    expect(cellIsOpen(lock({ state: 'none' }), reg())).toBe(true);
    expect(cellIsOpen(lock(), reg())).toBe(false);
  });
});

describe('handedBack', () => {
  it('flags the students Meet gave back on a lesson it decided', () => {
    expect(handedBack(lock(), reg({ state: 'held', skip_reason: 'held_back', verdict: null }))).toBe(true);
    for (const skip_reason of ['held_back', 'lesson_not_proven', 'nobody_joined', 'partial']) {
      expect(handedBack(lock(), reg({ state: 'skipped', skip_reason }))).toBe(true);
    }
  });

  it('leaves alone the students Meet skips on purpose, the decided ones, and lessons that are not decided', () => {
    for (const skip_reason of ['excused', 'cancelled', 'removed', 'frozen', 'no_access', 'person_changed_it']) {
      expect(handedBack(lock(), reg({ state: 'skipped', skip_reason }))).toBe(false);
    }
    expect(handedBack(lock(), reg())).toBe(false);
    expect(handedBack(lock(), undefined)).toBe(false);
    expect(handedBack(lock({ state: 'pending' }), reg({ state: 'held' }))).toBe(false);
    expect(handedBack(undefined, reg({ state: 'held' }))).toBe(false);
  });
});

describe('heldBack', () => {
  it('is an unconfirmed account in the room: «Кто это?» can settle it', () => {
    expect(heldBack(reg({ state: 'held' }))).toBe(true);
    expect(heldBack(reg({ state: 'skipped', skip_reason: 'held_back' }))).toBe(true);
    expect(heldBack(reg({ state: 'skipped', skip_reason: 'nobody_joined' }))).toBe(false);
    expect(heldBack(reg())).toBe(false);
    expect(heldBack(undefined)).toBe(false);
  });
});

describe('indexes', () => {
  it('keeps the lock of each lesson that has one', () => {
    const index = lockIndex([{ event_id: 1, register_lock: lock() }, { event_id: 2 }, { event_id: 3, register_lock: null }]);
    expect([...index.keys()]).toEqual([1]);
  });

  it('takes each lesson’s lock from the weekly lessons, and from the Meet list only where they have none', () => {
    const weekly = lockIndex([{ event_id: 1, register_lock: lock({ state: 'pending' }) }, { event_id: 2, register_lock: lock({ state: 'pending' }) }]);
    const meet = lockIndex([{ event_id: 2, register_lock: lock() }, { event_id: 3, register_lock: lock({ state: 'none' }) }]);
    const merged = mergeLocks(weekly, meet);
    expect(merged.get(1)?.state).toBe('pending');
    expect(merged.get(2)?.state).toBe('pending');
    expect(merged.get(3)?.state).toBe('none');
  });

  it('measures a lesson in whole minutes and skips what it cannot', () => {
    expect(lessonMinutes('2026-10-16T13:00:00Z', '2026-10-16T14:00:00Z')).toBe(60);
    expect(lessonMinutes('2026-10-16T13:00:00', '2026-10-16T14:30:00')).toBe(90);
    expect(lessonMinutes(null, '2026-10-16T14:00:00Z')).toBeNull();
    expect(lessonMinutes('2026-10-16T14:00:00Z', '2026-10-16T13:00:00Z')).toBeNull();
    const lengths = lengthIndex([{ event_id: 1, start: '2026-10-16T13:00:00Z', end: '2026-10-16T14:00:00Z' }]);
    expect(lengths.get(1)).toBe(60);
  });

  it('reads the lesson page’s lock from the register block or beside it', () => {
    expect(lessonLock({ register: { register_lock: lock() } })?.state).toBe('decided');
    expect(lessonLock({ register: {}, register_lock: lock({ state: 'pending' }) })?.state).toBe('pending');
    expect(lessonLock({ register: null })).toBeNull();
  });
});

describe('what Meet’s mark says', () => {
  it('gives the evidence as minutes in the lesson against the minutes needed', () => {
    expect(evidenceLine(reg({ minutes: 38, required: 45, verdict: 'absent' }), 60, 'ru')).toBe('в уроке 38 из 60 мин, нужно 45');
    expect(evidenceLine(reg({ minutes: 38, required: 45, verdict: 'absent' }), null, 'en')).toBe('in the lesson 38 min, 45 needed');
  });

  it('adds how late a late student was', () => {
    expect(evidenceLine(reg({ verdict: 'late', late_minutes: 7 }), 60, 'ru')).toBe('в уроке 52 из 60 мин, нужно 45, опоздание 7 мин');
  });

  it('has nothing to say without minutes', () => {
    expect(evidenceLine(reg({ minutes: null }), 60, 'ru')).toBeNull();
    expect(evidenceLine(undefined, 60, 'ru')).toBeNull();
  });

  it('titles a locked cell the way the owner worded it', () => {
    expect(lockedTitle('attended', reg(), 60, true, 'ru')).toBe('Отметил Meet: Был · 52 из 60 мин — нажмите, чтобы исправить');
    expect(lockedTitle('attended', reg({ state: 'override' }), 60, true, 'ru')).toBe('Изменено после Meet: Был · 52 из 60 мин — нажмите, чтобы исправить');
    expect(lockedTitle('late', reg(), null, false, 'ru')).toBe('Отметил Meet: Опоздал · 52 мин — менять может только старший преподаватель');
  });

  it('reads any stored status as one of the three marks', () => {
    expect(pickMark('present')).toBe('attended');
    expect(pickMark('attended')).toBe('attended');
    expect(pickMark('late')).toBe('late');
    expect(pickMark('absent')).toBe('missed');
    expect(pickMark('missed')).toBe('missed');
    expect(pickMark('registered')).toBe('missed');
    expect(markLabel('absent', 'ru')).toBe('Не был');
  });
});

describe('reasons for changing Meet’s mark', () => {
  const options: MeetReviewOptions = {
    marked_absent_was_in_room: { required: true, reasons: [{ key: 'not_participating', label: 'Был, но не участвовал' }, { key: 'other', label: 'Другое' }] },
    marked_present_not_joined: { required: true, reasons: [{ key: 'excused', label: 'Отпросился' }, { key: 'other', label: 'Другое' }] },
    marked_present_too_short: { required: true, reasons: [{ key: 'connection', label: 'Проблемы со связью' }, { key: 'other', label: 'Другое' }] },
    late: { required: false, reasons: [{ key: 'warned', label: 'Предупредил заранее' }, { key: 'other', label: 'Другое' }] },
  };

  it('picks the flag the change raises against Meet’s verdict', () => {
    expect(reasonFlag(reg(), 'missed')).toBe('marked_absent_was_in_room');
    expect(reasonFlag(reg({ verdict: 'absent', minutes: 0 }), 'attended')).toBe('marked_present_not_joined');
    expect(reasonFlag(reg({ verdict: 'absent', minutes: 20 }), 'late')).toBe('marked_present_too_short');
    expect(reasonFlag(reg(), 'late')).toBe('late');
    expect(reasonFlag(reg({ verdict: 'absent', status: 'absent' }), 'missed')).toBe('late');
  });

  it('offers that flag’s presets, always ending in «Другое»', () => {
    expect(reasonPresets(options, reg(), 'late', 'ru').map((p) => p.key)).toEqual(['warned', 'other']);
    expect(reasonPresets(options, reg(), 'missed', 'ru').map((p) => p.key)).toEqual(['not_participating', 'other']);
    expect(reasonPresets({}, reg(), 'missed', 'ru')).toEqual([{ key: 'other', label: 'Другое' }]);
    expect(reasonPresets(undefined, reg(), 'late', 'en')).toEqual([{ key: 'other', label: 'Other' }]);
    const presets = reasonPresets({ late: { required: false, reasons: [{ key: 'warned', label: 'x' }] } }, reg(), 'late', 'en');
    expect(presets[presets.length - 1].key).toBe('other');
  });
});

describe('changeReady', () => {
  const current = { status: 'attended', excused: false };
  const draft = { status: 'late' as const, excused: false, note: '', reason: { code: 'warned', text: null } };

  it('needs a different mark and a complete reason — also for present ↔ late', () => {
    expect(changeReady(current, draft)).toBe(true);
    expect(changeReady(current, { ...draft, status: 'attended' })).toBe(false);
    expect(changeReady(current, { ...draft, reason: undefined })).toBe(false);
    expect(changeReady(current, { ...draft, reason: { code: '', text: null } })).toBe(false);
  });

  it('wants words for «Другое»', () => {
    expect(changeReady(current, { ...draft, reason: { code: 'other', text: '  ' } })).toBe(false);
    expect(changeReady(current, { ...draft, reason: { code: 'other', text: 'связь' } })).toBe(true);
  });

  it('counts an excuse as a change, and wants its note', () => {
    const absent = { status: 'absent', excused: false };
    const excuse = { status: 'missed' as const, excused: true, note: '', reason: { code: 'valid', text: null } };
    expect(changeReady(absent, excuse)).toBe(false);
    expect(changeReady(absent, { ...excuse, note: 'болел' })).toBe(true);
    expect(changeReady({ status: 'absent', excused: true }, { ...excuse, note: 'болел' })).toBe(false);
    expect(changeReady({ status: 'absent', excused: true }, { ...excuse, excused: false })).toBe(true);
  });

  it('sends an excuse only on an absence, with its note trimmed', () => {
    expect(toChange({ ...draft, status: 'missed', excused: true, note: '  болел ' })).toEqual({
      status: 'missed', excused: true, note: 'болел', reason: { code: 'warned', text: null },
    });
    expect(toChange({ ...draft, status: 'late', excused: true, note: 'x' })).toMatchObject({ excused: false, note: null });
  });
});
