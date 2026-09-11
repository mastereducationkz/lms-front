import { describe, expect, it } from 'vitest';
import {
  answeredShare,
  averageTeacherShare,
  blockShade,
  blockTime,
  clockAt,
  clockTicks,
  lessonBarHeight,
  lessonBars,
  lessonBarSize,
  lessonPeakSeconds,
  minuteShade,
  formatDuration,
  groupTalkCsv,
  highlightParts,
  percent,
  publicTalkRecord,
  searchTranscript,
  silentCount,
  sortGroupStudents,
  spanBar,
  spokeNote,
  stamp,
  lessonMarkLabel,
  linesInBlock,
  marksSummary,
  perLesson,
  questionsLine,
  sortTeachers,
  spokeInText,
  talkAxis,
  talkGrid,
  talkSecondsIndex,
  talkSummaryLine,
  teacherFigure,
  teachersCsv,
  teacherTalkCsv,
} from './meetTalk';
import type { GroupTalk, StudentLessonMark, TalkPerson, TeacherTalkRow, TranscriptLine } from '../services/api/meetTalk';

// Lesson 19:00–20:00 Almaty = 14:00–15:00 UTC.
const START = '2026-09-10T14:00:00Z';

const line = (lesson_at: number, speaker_label: string, text: string): TranscriptLine => ({
  at: lesson_at + 30, lesson_at, end: lesson_at + 5, speaker_key: null, speaker_label, role: 'student', text,
});

describe('numbers in words', () => {
  it('says durations the way people do', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(59.6)).toBe('1 min');
    expect(formatDuration(12 * 60 + 20)).toBe('12 min');
    expect(formatDuration(3600 + 5 * 60)).toBe('1 h 05 min');
    expect(formatDuration(3599)).toBe('1 h 00 min');
    expect(formatDuration(720, 'ru')).toBe('12 мин');
    expect(formatDuration(null)).toBe('—');
  });

  it('stamps transcript lines from the lesson start', () => {
    expect(stamp(425)).toBe('7:05');
    expect(stamp(3729)).toBe('1:02:09');
    expect(stamp(-45)).toBe('-0:45');
  });

  it('writes shares as whole percents', () => {
    expect(percent(0.724)).toBe('72%');
    expect(percent(null)).toBe('—');
  });
});

describe('transcript search', () => {
  const lines = [
    line(10, 'Гульзада', 'Откройте Reading, вопрос 12. Всё понятно?'),
    line(20, 'Аяулым', 'Да, ещё раз можно?'),
    line(30, 'Шыңғыс', 'Ответ C, потому что evidence'),
  ];

  it('finds words whatever their case, and ё as е', () => {
    const hits = searchTranscript(lines, 'ЕЩЕ');
    expect(hits.map((h) => h.line.speaker_label)).toEqual(['Аяулым']);
    expect(hits[0].ranges).toEqual([[4, 7]]);
    expect(searchTranscript(lines, 'reading')[0].ranges).toEqual([[9, 16]]);
  });

  it('finds a speaker by name, and every line with an empty query', () => {
    expect(searchTranscript(lines, 'шыңғыс').map((h) => h.line.lesson_at)).toEqual([30]);
    expect(searchTranscript(lines, '  ')).toHaveLength(3);
  });

  it('cuts a line into plain and matched parts', () => {
    expect(highlightParts('abcabc', [[1, 2], [4, 5]])).toEqual([
      { text: 'a', hit: false }, { text: 'b', hit: true }, { text: 'ca', hit: false },
      { text: 'b', hit: true }, { text: 'c', hit: false },
    ]);
    expect(highlightParts('', [])).toEqual([{ text: '', hit: false }]);
  });
});

describe('the speaking timeline', () => {
  it('spans the lesson, stretched to early and late speech but not past 30 minutes', () => {
    const axis = talkAxis(START, 3600, [{ spans: [[-400, -100], [3500, 3900]] }]);
    expect(axis.from).toBe(-600);
    expect(axis.to).toBe(3900);
    expect(axis.ticks[0]).toEqual({ at: 0, label: '19:00' });
    expect(talkAxis(START, 3600, [{ spans: [[-5000, -4000]] }]).from).toBe(-1800);
  });

  it('draws a second of speech as a sliver, and nothing outside the axis', () => {
    const axis = talkAxis(START, 3600, []);
    expect(spanBar(axis, [1800, 1801])?.width).toBeCloseTo(0.3);
    expect(spanBar(axis, [0, 3600])).toEqual({ left: 0, width: 100 });
    expect(spanBar(axis, [5000, 5100])).toBeNull();
  });
});

describe('summaries', () => {
  it('reads a lesson in one line', () => {
    const talk = { teacher_share: 0.72, students_share: 0.28, silent_students: [{ user_id: 1, name: 'A' }, { user_id: 2, name: 'B' }] };
    expect(talkSummaryLine(talk)).toBe('Teacher 72% · students 28% · 2 didn’t speak');
    expect(talkSummaryLine({ ...talk, silent_students: [] }, 'ru')).toBe('Преподаватель 72% · ученики 28%');
  });

  it('counts the silent and averages the teacher over lessons with talk time only', () => {
    const talk = (teacher_share: number | null, silent: number[] = []) => ({
      talk: { teacher_share, students_share: null, speech_seconds: 0, teacher_seconds: 0, silent, seconds: {} },
    });
    expect(silentCount(talk(0.7, [4, 5]))).toBe(2);
    expect(silentCount({ talk: null })).toBe(0);
    expect(averageTeacherShare([talk(0.8), talk(0.6), { talk: null }, talk(null)])).toBeCloseTo(0.7);
    expect(averageTeacherShare([{ talk: null }])).toBeNull();
  });

  it('turns the watch page’s talk time into something the panel can draw', () => {
    const record = publicTalkRecord({
      state: 'ready', speech_seconds: 2900, silence_seconds: 500, teacher_share: 0.7, students_share: 0.3,
      people: [{ name: 'Гульзада', role: 'teacher', seconds: 2000, share: 0.7, in_room: true, spans: [[0, 60]] }],
      silent_students: ['Айым'], buckets: [],
    }, { title: 'L', start: START, end: '2026-09-10T15:00:00Z' });
    expect(record.lesson_seconds).toBe(3600);
    expect(record.people?.[0]).toMatchObject({ name: 'Гульзада', questions: null });
    expect(record.silent_students).toEqual([{ user_id: -1, name: 'Айым' }]);
    expect(record.transcript).toBeUndefined();
  });
});

describe('the group spreadsheet', () => {
  const data: GroupTalk = {
    group: { id: 1, name: 'August 19 SAT - Gulzada' },
    from: '2026-08-12T00:00:00Z', to: '2026-09-11T00:00:00Z',
    lessons: [{ event_id: 7, title: 'Lesson 7', start: START, teacher_name: 'Гульзада', teacher_share: 0.72,
      students_share: 0.28, speech_seconds: 3000, students_in_room: 9, silent: 2 }],
    students: [{ user_id: 3, name: 'Шыңғыс, "Шока"', lessons_in_room: 4, lessons_spoke: 3, silent_lessons: 1,
      total_seconds: 1500, avg_seconds: 375, share_of_student_talk: 0.41, questions: 5 }],
    teacher: { avg_share: 0.7, lessons: 4 },
    totals: { lessons: 4, speech_seconds: 12000, teacher_seconds: 8400, student_seconds: 3600 },
  };

  it('opens in Excel with Cyrillic intact and names quoted safely', () => {
    const csv = groupTalkCsv(data);
    expect(csv.startsWith('﻿"Group","August 19 SAT - Gulzada"')).toBe(true);
    expect(csv).toContain('"Шыңғыс, ""Шока""","4","4","3","1","25.0","6.3","41%","5","",""');
    expect(csv).toContain('"10/09/2026","19:00","Lesson 7","","Гульзада","72%","28%","50.0","","","","","","","9","2",""');
  });
});

describe('the group table', () => {
  const row = (name: string, total_seconds: number, questions: number | null) => ({
    user_id: 1, name, lessons_in_room: 4, lessons_spoke: 3, silent_lessons: 1, total_seconds, avg_seconds: 0,
    share_of_student_talk: 0, questions,
  });
  const rows = [row('Шыңғыс', 600, 2), row('Аяулым', 900, null), row('Елдана', 600, 5)];

  it('sorts by a number, ties by name', () => {
    expect(sortGroupStudents(rows, 'total_seconds', 'desc').map((r) => r.name)).toEqual(['Аяулым', 'Елдана', 'Шыңғыс']);
    expect(sortGroupStudents(rows, 'questions', 'desc').map((r) => r.name)).toEqual(['Елдана', 'Шыңғыс', 'Аяулым']);
  });

  it('sorts by name the Russian way', () => {
    expect(sortGroupStudents(rows, 'name', 'asc').map((r) => r.name)).toEqual(['Аяулым', 'Елдана', 'Шыңғыс']);
  });
});

describe('the attendance journal', () => {
  it('knows who spoke how long, and who was in the room without a word', () => {
    const index = talkSecondsIndex([
      { event_id: 5, talk: { teacher_share: 0.7, students_share: 0.3, speech_seconds: 0, teacher_seconds: 0, silent: [9], seconds: { 7: 420 } } },
      { event_id: 6, talk: null },
    ]);
    expect(index.get('5:7')).toBe(420);
    expect(index.get('5:9')).toBe(0);
    expect(index.has('6:7')).toBe(false);
  });

  it('says it in the journal’s language', () => {
    expect(spokeNote(420, 'en')).toBe('Spoke 7 min in Meet');
    expect(spokeNote(420, 'ru')).toBe('Говорил 7 мин в Meet');
    expect(spokeNote(0, 'ru')).toBe('В Meet не говорил');
    expect(spokeNote(undefined, 'en')).toBeNull();
  });
});


describe('who spoke when, in five-minute blocks', () => {
  const person = (key: string, role: TalkPerson['role'], spans: [number, number][]): TalkPerson => ({
    key, user_id: 1, name: key, role, spans, turns: spans.length, longest_turn_seconds: 0, in_room: true,
    questions: null, share: 0, seconds: spans.reduce((s, [a, b]) => s + b - a, 0),
  });

  it('adds up each person per block, on the Almaty clock', () => {
    const grid = talkGrid({
      start: START, lesson_seconds: 3600,
      people: [
        person('teacher', 'teacher', [[0, 250], [290, 320]]),
        person('aya', 'student', [[310, 340]]),
        person('silent', 'student', []),
        person('phone', 'unknown', [[3590, 3620]]),
      ],
    });
    expect(grid.binSeconds).toBe(300);
    expect(grid.columns).toHaveLength(13);
    expect(grid.columns[0]).toEqual({ from: 0, to: 300, label: '19:00' });
    expect(grid.columns[12].label).toBe('20:00');
    expect(grid.rows.map((r) => r.person.key)).toEqual(['teacher', 'aya', 'phone']);
    expect(grid.rows[0].cells.slice(0, 2)).toEqual([260, 20]);
    expect(grid.teacher[1]).toBe(20);
    expect(grid.students[1]).toBe(30);
    expect(grid.students[11] + grid.students[12]).toBe(30);
  });

  it('keeps a teacher who never spoke, and starts early when someone spoke early', () => {
    const grid = talkGrid({ start: START, lesson_seconds: 3600,
      people: [person('teacher', 'teacher', []), person('aya', 'student', [[-400, -380]])] });
    expect(grid.rows[0].cells.every((c) => c === 0)).toBe(true);
    expect(grid.columns[0].label).toBe('18:50');
  });

  it('shades by how long someone spoke, and says it in m:ss', () => {
    expect([0, 5, 20, 60, 100, 200].map((s) => blockShade(s))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(blockShade(60, 600)).toBe(2);
    expect([0, 45, 190].map(blockTime)).toEqual(['', '0:45', '3:10']);
  });

  it('finds what was said in a block', () => {
    const lines = [line(290, 'A', 'before'), line(400, 'A', 'in'), line(420, 'B', 'other'), line(700, 'A', 'after')]
      .map((l, i) => ({ ...l, end: l.at + 20, speaker_key: ['a', 'a', 'b', 'a'][i] }));
    expect(linesInBlock(lines, { key: 'a', from: 300, to: 600 }).map((l) => l.text)).toEqual(['before', 'in']);
    expect(linesInBlock(lines, { key: null, from: 300, to: 600 })).toHaveLength(3);
  });
});


describe('transcript times', () => {
  it('reads on the Almaty clock, to the second, like the blocks above it', () => {
    expect(clockAt(START, 596)).toBe('19:09:56');
    expect(clockAt(START, -45)).toBe('18:59:15');
  });
});


describe('questions, said plainly', () => {
  it('gives the share answered and the line the cards use', () => {
    expect(answeredShare({ teacher_questions: 43, answered: 21 })).toBeCloseTo(0.488, 3);
    expect(answeredShare({ teacher_questions: 0, answered: 0 })).toBeNull();
    expect(answeredShare(null)).toBeNull();
    expect(questionsLine({ teacher_questions: 43, answered: 21 })).toBe('43 asked · 49% answered');
    expect(questionsLine({ teacher_questions: 43, answered: 21 }, 'ru')).toBe('43 вопр. · 49% с ответом');
    expect(questionsLine(null)).toBe('—');
    expect(perLesson(43, 10)).toBe(4.3);
    expect(perLesson(null, 10)).toBeNull();
    expect(perLesson(5, 0)).toBeNull();
  });
});

describe('a student’s lessons, one dot each', () => {
  const marks: StudentLessonMark[] = [
    { event_id: 1, start: '2026-09-08T14:00:00Z', state: 'spoke', seconds: 720 },
    { event_id: 2, start: '2026-09-09T14:00:00Z', state: 'silent', seconds: 0 },
    { event_id: 3, start: '2026-09-10T14:00:00Z', state: 'absent', seconds: 0 },
    { event_id: 4, start: '2026-09-11T15:00:00Z', state: 'present', seconds: 0 },
  ];

  it('says what each dot means, on the Almaty clock', () => {
    expect(lessonMarkLabel(marks[0])).toMatch(/^Tue 8 Sept? 19:00 · spoke 12 min$/);
    expect(lessonMarkLabel(marks[1])).toMatch(/19:00 · silent — in the room, never spoke$/);
    expect(lessonMarkLabel(marks[2])).toMatch(/19:00 · not in the room$/);
    expect(lessonMarkLabel(marks[3], 'ru')).toContain('заходил ненадолго, не говорил');
  });

  it('sums the row up in words', () => {
    expect(spokeInText(marks)).toBe('spoke in 1 of 4');
    expect(spokeInText(marks, 'ru')).toBe('говорил на 1 из 4');
    expect(marksSummary(marks)).toBe('In the room for 3 of 4 · spoke in 1 · silent in 1 · absent from 1');
  });
});

describe('every teacher side by side', () => {
  const tally = { lessons: 10, groups: 2, students_share: 0.3, teacher_seconds: 20000, student_seconds: 8000,
    speech_seconds: 28000, longest_stretch_seconds: 480, students_in_room_per_lesson: 9.5 };
  const teacher = (name: string, teacher_share: number | null, questions: TeacherTalkRow['questions'], silent = 1): TeacherTalkRow => ({
    ...tally, teacher_id: name.length, name, teacher_share, questions, silent_per_lesson: silent,
  });
  const rows = [
    teacher('Gulzada', 0.7, { teacher_questions: 430, answered: 210, student_questions: 350, lessons_with_transcript: 10 }),
    teacher('Aisha', 0.85, null, 3),
    teacher('Bakhyt', 0.6, { teacher_questions: 100, answered: 90, student_questions: 20, lessons_with_transcript: 5 }),
  ];

  it('works out the per-lesson figures from the counts', () => {
    expect(teacherFigure(rows[0], 'questions_per_lesson')).toBe(43);
    expect(teacherFigure(rows[0], 'student_questions_per_lesson')).toBe(35);
    expect(teacherFigure(rows[2], 'answered_share')).toBeCloseTo(0.9, 5);
    expect(teacherFigure(rows[1], 'answered_share')).toBeNull();
  });

  it('sorts by any figure, a missing one last either way', () => {
    expect(sortTeachers(rows, 'teacher_share', 'desc').map((r) => r.name)).toEqual(['Aisha', 'Gulzada', 'Bakhyt']);
    expect(sortTeachers(rows, 'answered_share', 'desc').map((r) => r.name)).toEqual(['Bakhyt', 'Gulzada', 'Aisha']);
    expect(sortTeachers(rows, 'answered_share', 'asc').map((r) => r.name)).toEqual(['Gulzada', 'Bakhyt', 'Aisha']);
    expect(sortTeachers(rows, 'name', 'asc').map((r) => r.name)).toEqual(['Aisha', 'Bakhyt', 'Gulzada']);
  });

  it('writes the comparison and one teacher’s detail as spreadsheets', () => {
    const all = teachersCsv({ from: '2026-08-12T00:00:00Z', to: '2026-09-11T00:00:00Z', teachers: rows });
    expect(all).toContain('"Gulzada","10","2","70%","30%","333.3","133.3","8.0","430","49%","43","350","35","1","9.5"');
    expect(all).toContain('"Aisha","10","2","85%","30%","333.3","133.3","8.0","","","","","","3","9.5"');
    const one = teacherTalkCsv({
      from: '2026-08-12T00:00:00Z', to: '2026-09-11T00:00:00Z', teacher: rows[0],
      groups: [{ ...tally, group_id: 1, name: 'July 23 SAT', teacher_share: 0.7, questions: null, silent_per_lesson: 1 }],
      lessons: [{ event_id: 7, title: 'Lesson 7', start: START, groups: [{ id: 1, name: 'July 23 SAT' }],
        teacher_name: 'Gulzada', teacher_share: 0.5, students_share: 0.5, speech_seconds: 2400, longest_stretch_seconds: 240,
        students_in_room: 10, silent: 2, teacher_questions: 43, answered: 21, student_questions: 35,
        median_wait_seconds: 5.3, source: 'voices' }],
    });
    expect(one).toContain('"All groups","10","2","70%"');
    expect(one).toContain('"July 23 SAT","10","2","70%"');
    expect(one).toContain('"10/09/2026","19:00","Lesson 7","July 23 SAT","Gulzada","50%","50%","40.0","4.0","43","21","49%","35","5.3","10","2","yes"');
  });
});


describe('the recording side panel, minute by minute', () => {
  const person = (key: string, role: TalkPerson['role'], spans: [number, number][]): TalkPerson => ({
    key, user_id: 1, name: key, role, spans, turns: spans.length, longest_turn_seconds: 0, in_room: true,
    questions: null, share: 0, seconds: spans.reduce((s, [a, b]) => s + b - a, 0),
  });

  it('cuts the lesson into minutes when asked', () => {
    const grid = talkGrid({ start: START, lesson_seconds: 3600, people: [person('t', 'teacher', [[30, 100]])] }, 60);
    expect(grid.binSeconds).toBe(60);
    expect(grid.columns).toHaveLength(60);
    expect(grid.rows[0].cells.slice(0, 2)).toEqual([30, 40]);
    expect(grid.columns[1].label).toBe('19:01');
  });

  it('shades a minute by how much of it someone spoke', () => {
    expect([0, 4, 15, 45].map((s) => minuteShade(s))).toEqual([0, 1, 2, 3]);
  });

  it('labels the quarter hours of the Almaty clock, placed in lesson seconds', () => {
    expect(clockTicks(START, 0, 3600)).toEqual([
      { at: 0, label: '19:00' }, { at: 900, label: '19:15' }, { at: 1800, label: '19:30' },
      { at: 2700, label: '19:45' }, { at: 3600, label: '20:00' },
    ]);
    expect(clockTicks(START, -120, 400)).toEqual([{ at: 0, label: '19:00' }]);
    expect(clockTicks(START, 10, 10)).toEqual([]);
  });

  it('carries the watch page\'s offset and length into the panel\'s record', () => {
    const record = publicTalkRecord({
      state: 'ready', speech_seconds: 1, silence_seconds: 1, teacher_share: 1, students_share: 0, people: [],
      silent_students: [], buckets: [], recording_offset_seconds: 129.5, lesson_seconds: 3000,
    }, { title: 'L', start: START, end: '2026-09-10T15:00:00Z' });
    expect(record.recording_offset_seconds).toBe(129.5);
    expect(record.lesson_seconds).toBe(3000);
  });
});

describe('a student\'s lessons as a sparkline', () => {
  const mark = (i: number, state: StudentLessonMark['state'], seconds = 0): StudentLessonMark => ({
    event_id: i, start: START, state, seconds,
  });

  it('draws the newest 48 lessons and counts the rest', () => {
    const marks = Array.from({ length: 60 }, (_, i) => mark(i, 'spoke', 60));
    const { shown, earlier } = lessonBars(marks);
    expect(shown).toHaveLength(48);
    expect(earlier).toBe(12);
    expect(shown[0].event_id).toBe(12);
    expect(lessonBars(marks.slice(0, 36))).toEqual({ shown: marks.slice(0, 36), earlier: 0 });
  });

  it('scales bars to the group\'s peak, keeps a few words visible, and gives silence a stub', () => {
    expect(lessonPeakSeconds([{ lessons: [mark(1, 'spoke', 720)] }, { lessons: [mark(2, 'spoke', 30)] }, {}])).toBe(720);
    expect(lessonPeakSeconds([])).toBe(60);
    expect(lessonBarHeight(mark(1, 'spoke', 720), 720)).toBe(1);
    expect(lessonBarHeight(mark(1, 'spoke', 360), 720)).toBe(0.5);
    expect(lessonBarHeight(mark(1, 'spoke', 5), 720)).toBe(0.22);
    expect(lessonBarHeight(mark(1, 'silent'), 720)).toBe(0.16);
    expect(lessonBarHeight(mark(1, 'absent'), 720)).toBe(0);
    expect(lessonBarHeight(mark(1, 'present'), 720)).toBe(0);
  });

  it('fits 36 lessons, and 48, on one line', () => {
    const fits = (n: number) => {
      const { width, gap } = lessonBarSize(n);
      return n * width + (n - 1) * gap;
    };
    expect(lessonBarSize(4)).toEqual({ width: 10, gap: 2 });
    expect(lessonBarSize(36).width).toBeGreaterThanOrEqual(3);
    expect(fits(36)).toBeLessThanOrEqual(200);
    expect(fits(48)).toBeLessThanOrEqual(200);
  });
});
