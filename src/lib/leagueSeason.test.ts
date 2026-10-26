import { describe, expect, it } from 'vitest';
import { hasMessage } from './i18n';
import {
  attendanceText, coachNote, currentMatchday, dayIndex, daysUntil, formatCountdown, goalViews, groupTail, homeworkText, kickoffLabel,
  kickoffLine, LEAGUE_GOAL_KEYS, LEAGUE_RESULT_GOAL_KEYS, needsTicker, phaseCopy, pipLabel,
} from './leagueSeason';
import type { LeaguePhase, MyLeague } from '../services/api/masterLeague';

// Tue 13 Oct 2026, 15:00 in Almaty (10:00 UTC). The next lesson is Wed 14 Oct, 18:00 Almaty.
const NOW = Date.UTC(2026, 9, 13, 10, 0, 0);
const HOUR = 3_600_000;
/** The countdown glues a number to its unit with a non-breaking space; the tests read it as a plain one. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

const league = (over: Partial<MyLeague> = {}): MyLeague => ({
  group: { id: 376, name: 'Master League Dreamville' },
  exam_date: '2026-11-07',
  days_to_exam: 25,
  phase: 'season',
  score_release: '2026-11-20',
  result_due: '2026-12-04',
  lessons: {
    total: 11,
    played: 1,
    items: [
      { id: 1, number: 1, starts_at: '2026-10-12T13:00:00Z', state: 'attended' },
      { id: 2, number: 2, starts_at: '2026-10-14T13:00:00Z', state: 'upcoming' },
    ],
  },
  next_lesson: { id: 2, number: 2, starts_at: '2026-10-14T13:00:00Z', title: 'Master League Dreamville: Lesson 2' },
  attendance: { attended: 1, marked: 1, percent: 100 },
  homework: { on_time: 0, due: 0 },
  squad_size: 8,
  achievements: [],
  ...over,
});

describe('names and the matchday', () => {
  it('takes the squad name off the group name', () => {
    expect(groupTail('Master League Dreamville')).toBe('Dreamville');
    expect(groupTail('master league: KOD')).toBe('KOD');
    expect(groupTail('Мастер Лига Финал')).toBe('Финал');
    expect(groupTail('Dreamville')).toBe('Dreamville');
    expect(groupTail('Master League')).toBe('Master League');
  });

  it('names the matchday that is on, else the next, else the last', () => {
    expect(currentMatchday(league())).toBe(2);
    const today = league().lessons.items.map((i) => (i.number === 2 ? { ...i, state: 'today' as const } : i));
    expect(currentMatchday(league({ lessons: { total: 11, played: 1, items: today } }))).toBe(2);
    expect(currentMatchday(league({ next_lesson: null }))).toBe(11);
  });

  it('reads a pip aloud with its state, and the day for one to come', () => {
    const [attended, upcoming] = league().lessons.items;
    expect(pipLabel(attended, 'en')).toBe('Matchday 1: attended');
    expect(pipLabel(upcoming, 'en')).toMatch(/^Matchday 2: upcoming · .*14 Oct, 18:00$/);
    expect(pipLabel(attended, 'ru')).toBe('Тур 1: посещён');
  });
});

describe('the countdown', () => {
  it('counts to the minute, never below one', () => {
    expect(plain(formatCountdown(2 * HOUR + 15 * 60_000, 'en'))).toBe('2 h 15 min');
    expect(plain(formatCountdown(3 * HOUR, 'en'))).toBe('3 h');
    expect(plain(formatCountdown(45 * 60_000, 'en'))).toBe('45 min');
    expect(plain(formatCountdown(5_000, 'en'))).toBe('1 min');
    expect(plain(formatCountdown(0, 'en'))).toBe('1 min');
    expect(plain(formatCountdown(2 * HOUR + 15 * 60_000, 'ru'))).toBe('2 ч 15 мин');
    expect(formatCountdown(2 * HOUR + 15 * 60_000, 'en')).toBe('2\u00a0h 15\u00a0min'); // never wraps inside a number and its unit
  });

  it('writes the kick-off on the school clock', () => {
    expect(kickoffLabel('2026-10-14T13:00:00Z', 'en')).toMatch(/14 Oct, 18:00$/);
    expect(kickoffLabel('2026-10-14T13:00:00Z', 'ru')).toMatch(/14 окт\., 18:00$/);
  });

  it('shows a live countdown inside the last 24 hours and the day beyond', () => {
    // 27 h away: the day and time
    expect(kickoffLine(league(), NOW, 'en')).toMatch(/^Next kick-off .*14 Oct, 18:00$/);
    // 2 h 15 min away
    const soon = Date.parse('2026-10-14T13:00:00Z') - (2 * HOUR + 15 * 60_000);
    expect(plain(kickoffLine(league(), soon, 'en'))).toBe('Kick-off in 2 h 15 min');
    expect(plain(kickoffLine(league(), soon, 'ru'))).toBe('Тур начнётся через 2 ч 15 мин');
  });

  it('says the lessons are over when none is left, and does not count down to one that has begun', () => {
    expect(kickoffLine(league({ next_lesson: null }), NOW, 'en')).toBe('Last matchday played');
    const begun = Date.parse('2026-10-14T13:30:00Z');
    expect(kickoffLine(league(), begun, 'en')).toMatch(/^Next kick-off /);
  });

  it('asks for a ticking clock only when a kick-off is a day away or closer', () => {
    expect(needsTicker(league(), NOW)).toBe(false); // 27 h
    expect(needsTicker(league(), Date.parse('2026-10-14T13:00:00Z') - 10 * HOUR)).toBe(true);
    expect(needsTicker(league({ next_lesson: null }), NOW)).toBe(false);
    expect(needsTicker(league(), Date.parse('2026-10-14T14:00:00Z'))).toBe(false); // already begun
  });

  it('counts calendar days on the Almaty date', () => {
    expect(daysUntil('2026-11-07', NOW)).toBe(25);
    expect(daysUntil('2026-10-13', NOW)).toBe(0);
    expect(daysUntil('2026-10-12', NOW)).toBe(-1);
    // 20:30 UTC on the 13th is already the 14th in Almaty
    expect(daysUntil('2026-10-14', Date.UTC(2026, 9, 13, 20, 30))).toBe(0);
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil('nope', NOW)).toBeNull();
  });
});

describe('the words of each phase', () => {
  it('is Matchday n of N with the days to The Final and the next kick-off in the season', () => {
    const copy = phaseCopy(league(), NOW, 'en');
    expect(copy.title).toBe('Matchday 2 of 11');
    expect(copy.sub).toMatch(/^25 days to The Final · Next kick-off /);
    expect(phaseCopy(league(), NOW, 'ru').title).toBe('Тур 2 из 11');
    expect(phaseCopy(league(), NOW, 'ru').sub).toMatch(/^До Финала 25 дней · Следующий тур: /);
    expect(copy.noteKey).toBe('season');
  });

  it('inflects the days in Russian and English', () => {
    expect(phaseCopy(league({ days_to_exam: 1 }), NOW, 'en').sub).toMatch(/^1 day to The Final/);
    expect(phaseCopy(league({ days_to_exam: 22 }), NOW, 'ru').sub).toMatch(/^До Финала 22 дня/);
    expect(phaseCopy(league({ days_to_exam: 21 }), NOW, 'ru').sub).toMatch(/^До Финала 21 день/);
  });

  it('drops the days part when the exam date is unknown', () => {
    expect(phaseCopy(league({ days_to_exam: null }), NOW, 'en').sub).toMatch(/^Next kick-off /);
  });

  it('greets the warm-up, counts the final week, and speaks plainly on the eve and the day', () => {
    expect(phaseCopy(league({ phase: 'warmup' }), NOW, 'en')).toMatchObject({ title: 'Welcome to the League', sub: 'Matchday 1 is coming. Your kit is ready.', noteKey: 'warmup' });
    expect(phaseCopy(league({ phase: 'final_week', days_to_exam: 5 }), NOW, 'en')).toMatchObject({
      title: 'Final week', sub: 'The Final is 5 days away. Make every matchday count.', noteKey: 'finalWeek',
    });
    expect(phaseCopy(league({ phase: 'final_week', days_to_exam: 5 }), NOW, 'ru').sub).toBe('До Финала 5 дней. Пусть каждый тур будет на счету.');
    expect(phaseCopy(league({ phase: 'eve' }), NOW, 'en')).toMatchObject({ title: 'Tomorrow is The Final', noteKey: 'eve' });
    expect(phaseCopy(league({ phase: 'exam_day' }), NOW, 'ru')).toMatchObject({ title: 'Сегодня Финал', noteKey: 'examDay' });
  });

  it('adds the next kick-off as its own line in the warm-up and the final week, where the sentence has no room for it', () => {
    expect(phaseCopy(league({ phase: 'warmup' }), NOW, 'en').kickoff).toMatch(/^Next kick-off .*14 Oct, 18:00$/);
    expect(phaseCopy(league({ phase: 'final_week', days_to_exam: 5 }), NOW, 'ru').kickoff).toMatch(/^Следующий тур: /);
    expect(phaseCopy(league({ phase: 'warmup', next_lesson: null }), NOW, 'en').kickoff).toBeNull();
    expect(phaseCopy(league(), NOW, 'en').kickoff).toBeNull(); // the season sentence already carries it
    for (const phase of ['eve', 'exam_day', 'after'] as const) expect(phaseCopy(league({ phase }), NOW, 'en').kickoff, phase).toBeNull();
  });

  it('asks for the score report once the scores are out, counting the days left to the due day, or today', () => {
    // NOW is Tue 13 Oct; the scores of an exam on 3 Oct came out on 16 Oct (not yet), so these pin the counting only.
    const after = (score_release: string | null, result_due: string | null) => league({ phase: 'after', score_release, result_due });
    expect(phaseCopy(after('2026-10-13', '2026-10-27'), NOW, 'en')).toMatchObject({
      title: 'Final whistle', sub: 'Send your official score report to your curator within 14 days. It completes your season.', noteKey: 'after',
    });
    expect(phaseCopy(after('2026-10-06', '2026-10-20'), NOW, 'en').sub).toMatch(/within 7 days\./);
    expect(phaseCopy(after('2026-09-30', '2026-10-14'), NOW, 'en').sub).toMatch(/within 1 day\./);
    expect(phaseCopy(after('2026-09-29', '2026-10-13'), NOW, 'en').sub).toBe('Send your official score report to your curator today. It completes your season.');
    expect(phaseCopy(after('2026-09-20', null), NOW, 'ru').sub).toBe('Отправьте куратору официальный отчёт о баллах сегодня. Он завершает ваш сезон.');
    expect(phaseCopy(after('2026-10-04', '2026-10-18'), NOW, 'ru').sub).toBe('Отправьте куратору официальный отчёт о баллах в течение 5 дней. Он завершает ваш сезон.');
  });

  it('says when the scores come out, and how long the report may take after that, until the release day', () => {
    const waiting = (score_release: string | null, result_due: string | null) => league({ phase: 'after', score_release, result_due });
    expect(phaseCopy(waiting('2026-10-16', '2026-10-30'), NOW, 'en')).toMatchObject({
      title: 'Final whistle',
      sub: 'College Board publishes the scores on 16 October. Then send your official score report to your curator within 14 days.',
      noteKey: 'after',
    });
    expect(phaseCopy(waiting('2026-10-16', '2026-10-30'), NOW, 'ru').sub).toBe(
      'Баллы College Board выйдут 16 октября. Потом пришлите отчёт куратору в течение 14 дней.',
    );
    // the June sitting is released 16 days out, but the window after the release is still 14 days
    expect(phaseCopy(waiting('2026-10-29', '2026-11-12'), NOW, 'en').sub).toMatch(/publishes the scores on 29 October\..*within 14 days\.$/);
  });

  it('switches to the report wording on the release day itself, with fourteen days left (the due day counts)', () => {
    const release = Date.UTC(2026, 9, 16, 12, 0, 0);   // Fri 16 Oct, 17:00 in Almaty
    const l = league({ phase: 'after', score_release: '2026-10-16', result_due: '2026-10-30' });
    expect(phaseCopy(l, release, 'en').sub).toBe('Send your official score report to your curator within 14 days. It completes your season.');
    const dueDay = Date.UTC(2026, 9, 30, 12, 0, 0);
    expect(phaseCopy(l, dueDay, 'en').sub).toMatch(/to your curator today\./);
    // the school's clock, not the viewer's: 23:00 on the 15th in Almaty still waits, 01:00 on the 16th is the release day
    expect(phaseCopy(l, Date.UTC(2026, 9, 15, 18, 0, 0), 'en').sub).toMatch(/publishes the scores on 16 October/);
    expect(phaseCopy(l, Date.UTC(2026, 9, 15, 20, 0, 0), 'en').sub).toMatch(/within 14 days\./);
  });

  it('falls back to counting to the due day when an older backend sends no release date', () => {
    const old = league({ phase: 'after', score_release: null, result_due: '2026-10-20' });
    expect(phaseCopy(old, NOW, 'en').sub).toBe('Send your official score report to your curator within 7 days. It completes your season.');
    expect(phaseCopy(league({ phase: 'after', score_release: null, result_due: null }), NOW, 'en').sub).toMatch(/today\./);
    // a release without a due day cannot say how long the report may take: no waiting line, no crash
    expect(phaseCopy(league({ phase: 'after', score_release: '2026-10-16', result_due: null }), NOW, 'en').sub).toMatch(/today\./);
  });

  it('has a coach’s note for every phase and every variant, in both languages', () => {
    for (const key of ['warmup', 'season', 'finalWeek', 'eve', 'examDay', 'after']) {
      for (const n of [1, 2, 3]) expect(hasMessage(`studentHome.league.note.${key}.${n}`), `${key}.${n}`).toBe(true);
    }
  });
});

describe('the coach’s note of the day', () => {
  it('is stable through a day and changes with the day and the student', () => {
    const morning = Date.UTC(2026, 9, 13, 2, 0); // 07:00 Almaty
    const evening = Date.UTC(2026, 9, 13, 17, 0); // 22:00 Almaty, same day
    expect(coachNote('season', morning, 7, 'en')).toBe(coachNote('season', evening, 7, 'en'));
    expect(dayIndex(morning, 7)).toBe(dayIndex(evening, 7));
    const notes = new Set([0, 1, 2].map((d) => coachNote('season', morning + d * 24 * HOUR, 7, 'en')));
    expect(notes.size).toBe(3); // three consecutive days walk through all three
  });

  it('takes a student id as a number or as the string the API sends', () => {
    expect(coachNote('season', NOW, '7', 'en')).toBe(coachNote('season', NOW, 7, 'en'));
    expect(dayIndex(NOW, 'abc')).toBe(dayIndex(NOW, 0));
  });

  it('follows the Almaty day, not the UTC one', () => {
    const lateUtc = Date.UTC(2026, 9, 13, 20, 0); // already the 14th in Almaty
    const nextMorning = Date.UTC(2026, 9, 14, 3, 0);
    expect(coachNote('eve', lateUtc, 3, 'en')).toBe(coachNote('eve', nextMorning, 3, 'en'));
  });

  it('speaks Russian when asked', () => {
    expect(coachNote('examDay', NOW, 1, 'ru')).toMatch(/[а-я]/i);
  });
});

describe('a news night the coach talks about (Kane, Ballon d\'Or, 2026-10-27)', () => {
  const tuesday = Date.UTC(2026, 9, 27, 0, 0); // 05:00 Almaty, the morning after the ceremony
  const lastMinute = Date.parse('2026-10-29T23:59:00+05:00');
  const over = Date.parse('2026-10-30T00:00:00+05:00');

  it('replaces the rotating note, counting down to the Final', () => {
    expect(coachNote('season', tuesday, 7, 'en', 11)).toBe(
      'Harry Kane has won the Ballon d\'Or, the first English winner since 2001, after years of steady work, week after week. Your Final is in 11 days: same habit, every matchday.',
    );
    expect(coachNote('finalWeek', lastMinute, 7, 'ru', 9)).toBe(
      'Гарри Кейн выиграл «Золотой мяч» — первый англичанин с 2001 года. Путь к нему — годы стабильной работы, неделя за неделей. До вашего Финала 9 дней: та же привычка, каждый тур.',
    );
    expect(coachNote('season', tuesday, 7, 'ru', 1)).toContain('До вашего Финала 1 день:');
    expect(coachNote('season', tuesday, 7, 'ru', 3)).toContain('До вашего Финала 3 дня:');
  });

  it('is the same for every student and every day of the window', () => {
    expect(coachNote('season', tuesday, 7, 'en', 11)).toBe(coachNote('season', tuesday + 24 * HOUR, 8, 'en', 11));
  });

  it('ends on its own at midnight Almaty on Thursday', () => {
    expect(coachNote('season', over, 7, 'en', 8)).not.toContain('Kane');
  });

  it('stays out of the eve, the exam day and after the Final, and when the days are unknown', () => {
    for (const key of ['eve', 'examDay', 'after']) expect(coachNote(key, tuesday, 7, 'en', 1)).not.toContain('Kane');
    expect(coachNote('season', tuesday, 7, 'en')).not.toContain('Kane');
    expect(coachNote('season', tuesday, 7, 'en', 0)).not.toContain('Kane');
  });
});

describe('the season goals', () => {
  it('lists the six in a fixed order, titled in the reader’s language, with what the server knows', () => {
    const views = goalViews([{ key: 'ml_hat_trick', unlocked: false, progress: { current: 2, target: 3 } }, { key: 'ml_signed', unlocked: true, progress: null }], 'en');
    expect(views.map((v) => v.key)).toEqual([...LEAGUE_GOAL_KEYS]);
    expect(views[0]).toMatchObject({ title: 'Signed to the League', unlocked: true });
    expect(views[2]).toMatchObject({ title: 'Hat-trick', unlocked: false, progress: { current: 2, target: 3 } });
    expect(views[5]).toMatchObject({ title: 'No Loose Ends', unlocked: false, progress: null });
    expect(goalViews([], 'ru').map((v) => v.title)).toEqual(['В Лиге', 'Первый свисток', 'Хет-трик', 'Все в сборе', 'Весь месяц', 'Без хвостов']);
  });

  it('lists the four result goals after the six, once the server lists them, locked or earned like the rest', () => {
    const sent = [
      { key: 'ml_mock_climb', unlocked: true, progress: null },
      { key: 'ml_breakthrough', unlocked: false, progress: { current: 40, target: 100 } },
      { key: 'ml_1500', unlocked: false, progress: null },
      { key: 'ml_perfect', unlocked: false, progress: null },
    ];
    const views = goalViews(sent, 'en');
    expect(views.map((v) => v.key)).toEqual([...LEAGUE_GOAL_KEYS, ...LEAGUE_RESULT_GOAL_KEYS]);
    expect(views).toHaveLength(10);
    expect(views.slice(6).map((v) => v.title)).toEqual(['The Climb', 'Breakthrough', '1500 Club', 'Perfect']);
    expect(views[6]).toMatchObject({ unlocked: true });
    expect(views[7]).toMatchObject({ unlocked: false, progress: { current: 40, target: 100 } });
    expect(goalViews(sent, 'ru').slice(6).map((v) => v.title)).toEqual(['Подъём', 'Рывок', 'Клуб 1500', 'Идеал']);
  });

  it('keeps to the six while the server (not yet updated) lists none of the four', () => {
    expect(goalViews([{ key: 'ml_signed', unlocked: true, progress: null }], 'en')).toHaveLength(6);
    expect(goalViews([{ key: 'ml_1500', unlocked: false, progress: null }], 'en').map((v) => v.key)).toEqual([...LEAGUE_GOAL_KEYS, 'ml_1500']);
  });

  it('shows the numbers, or a dash while nothing is marked or due', () => {
    expect(attendanceText({ attended: 9, marked: 10, percent: 90 }, 'en')).toBe('90%');
    expect(attendanceText({ attended: 0, marked: 0, percent: 0 }, 'en')).toBe('—');
    expect(homeworkText({ on_time: 3, due: 4 }, 'en')).toBe('3/4');
    expect(homeworkText({ on_time: 0, due: 0 }, 'en')).toBe('—');
  });
});

describe('phases are all spoken for', () => {
  it('has words for every phase the server can send except «over», which shows nothing', () => {
    const phases: LeaguePhase[] = ['warmup', 'season', 'final_week', 'eve', 'exam_day', 'after'];
    for (const phase of phases) {
      const copy = phaseCopy(league({ phase }), NOW, 'en');
      expect(copy.title, phase).toBeTruthy();
      expect(copy.sub, phase).toBeTruthy();
    }
  });
});
