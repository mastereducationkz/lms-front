import { describe, expect, it } from 'vitest';
import { achievementField } from './achievements';
import { hasMessage, t } from './i18n';
import { leagueStudio } from './i18n/en/studentHome/leagueStudio';
import { coachNote, goalViews, kickoffLine, phaseCopy } from './leagueSeason';
import { achievementTheme, asLeagueTheme, studioGroupLook, studioKeyOf, themedKey, themedT } from './leagueTheme';
import { proudLine } from '../components/share/shareCopy';
import type { MyLeague } from '../services/api/masterLeague';

describe('the season theme', () => {
  it('reads the server strictly: only «studio» is studio, anything else (missing too) is football', () => {
    expect(asLeagueTheme('studio')).toBe('studio');
    for (const v of ['football', undefined, null, '', 'Studio', 'disco', 1]) expect(asLeagueTheme(v)).toBe('football');
  });

  it('finds each key’s studio variant where the spec puts it', () => {
    expect(studioKeyOf('studentHome.league.phase.season.title')).toBe('studentHome.league.studio.phase.season.title');
    expect(studioKeyOf('studentHome.leagueInvite.fact.final')).toBe('studentHome.leagueInvite.studio.fact.final');
    expect(studioKeyOf('studentHome.achievement.ml_signed.title')).toBe('studentHome.achievement.ml_signed.studio.title');
    expect(studioKeyOf('sharedUi.shareCard.proud.ml_signed')).toBe('sharedUi.shareCard.proud.studio.ml_signed');
    expect(studioKeyOf('settings.title')).toBeNull();
  });

  it('keeps football on the key itself, and falls back to it where studio has no words of its own', () => {
    expect(themedKey('studentHome.league.coach', 'football')).toBe('studentHome.league.coach');
    expect(themedKey('studentHome.league.coach', undefined)).toBe('studentHome.league.coach');
    expect(themedKey('studentHome.league.coach', 'studio')).toBe('studentHome.league.studio.coach');
    // «Season goals» is the same in both seasons: no studio key, the shared one is read
    expect(hasMessage('studentHome.league.studio.goals.open')).toBe(false);
    expect(themedKey('studentHome.league.goals.open', 'studio')).toBe('studentHome.league.goals.open');
    expect(themedT('studentHome.league.coach', undefined, 'ru', 'studio')).toBe('Слово продюсера');
    expect(themedT('studentHome.league.coach', undefined, 'ru', 'football')).toBe('Слово тренера');
  });

  it('writes every studio key in both languages, and only for keys that exist in football', () => {
    for (const key of Object.keys(leagueStudio)) {
      expect(hasMessage(key), key).toBe(true);
      if (key.startsWith('studentHome.wardrobe.')) continue; // new part names, no football twin
      const football = key.replace('.studio.', '.');
      expect(hasMessage(football), football).toBe(true);
      const ru = t(key as never, { count: 2, n: 1, total: 2, group: 'g', date: 'd', when: 'w', time: 't' }, 'ru');
      expect(ru.replace(/Master League|College Board|Bluebook/g, ''), key).not.toMatch(/[A-Za-z]{4,}/); // really Russian
    }
  });

  it('never names an artist, a lyric or a cover (owner rule)', () => {
    const all = Object.values(leagueStudio).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))).join(' ').toLowerCase();
    for (const banned of ['cole', 'kendrick', 'lamar', 'j.', 'cover', 'lyric']) expect(all).not.toContain(banned);
  });

  it('tells a studio group by the tail of its name', () => {
    expect(studioGroupLook('Off-Season')).toBe('offSeason');
    expect(studioGroupLook('Section.80')).toBe('section80');
    expect(studioGroupLook('section 80')).toBe('section80');
    expect(studioGroupLook('Dreamville')).toBe('studio');
    expect(studioGroupLook(null)).toBe('studio');
  });
});

describe('achievement words follow the server’s season', () => {
  const signed = (title: string) => ({ key: 'ml_signed', title, description: 'x', how_to: 'y' });

  it('reads a studio title as a studio achievement, and everything else as football', () => {
    expect(achievementTheme(signed('Signed'))).toBe('studio');
    expect(achievementTheme(signed('Signed to the League'))).toBe('football');
    expect(achievementTheme({ key: 'streak_7', title: 'Signed' })).toBe('football');
  });

  it('gives the Russian of the student’s season', () => {
    expect(achievementField(signed('Signed'), 'title', 'ru')).toBe('Контракт подписан');
    expect(achievementField(signed('Signed to the League'), 'title', 'ru')).toBe('В Лиге');
    expect(achievementField(signed('Signed'), 'title', 'en')).toBe('Signed'); // English is the server's
    // a studio achievement with no studio how-to of its own reads the shared one
    expect(achievementField({ key: 'ml_1500', title: 'Platinum', how_to: 'x' }, 'how_to', 'ru'))
      .toBe(t('studentHome.achievement.ml_1500.howTo', undefined, 'ru'));
    expect(achievementField({ key: 'ml_1500', title: 'Platinum' }, 'title', 'ru')).toBe('Платина');
  });

  it('shares the proud line in the season’s words', () => {
    expect(proudLine('ml_first_whistle', 'en', 'studio')).toBe('Recorded my first Master League session.');
    expect(proudLine('ml_first_whistle', 'en')).toBe('Played my first Master League matchday.');
    expect(proudLine('ml_hat_trick', 'en', 'studio')).toBe('Three Master League lessons in a row.'); // shared
  });
});

describe('the season rules in studio words', () => {
  const NOW = Date.UTC(2026, 10, 20, 6, 0, 0);
  const base = {
    group: { id: 402, name: 'Master League Section.80' },
    exam_date: '2026-12-05',
    days_to_exam: 15,
    phase: 'season',
    score_release: '2026-12-18',
    result_due: '2027-01-01',
    lessons: { total: 11, played: 3, items: [{ id: 4, number: 4, starts_at: '2026-11-20T13:00:00Z', state: 'today' }] },
    next_lesson: { id: 4, number: 4, starts_at: '2026-11-20T13:00:00Z', title: 'Lesson 4' },
    attendance: { attended: 3, marked: 3, percent: 100 },
    homework: { on_time: 2, due: 2 },
    squad_size: 9,
    achievements: [],
  } as unknown as MyLeague;

  it('counts tracks to Release Day, and football stays on matchdays', () => {
    expect(phaseCopy({ ...base, theme: 'studio' }, NOW, 'en').title).toBe('Track 4 of 11');
    expect(phaseCopy({ ...base, theme: 'studio' }, NOW, 'en').sub).toContain('15 days to Release Day');
    expect(phaseCopy({ ...base, theme: 'studio' }, NOW, 'ru').title).toBe('Трек 4 из 11');
    expect(phaseCopy({ ...base, theme: 'football' }, NOW, 'en').title).toBe('Matchday 4 of 11');
    expect(phaseCopy(base, NOW, 'en').title).toBe('Matchday 4 of 11');
  });

  it('names the after phase, the session and the producer', () => {
    expect(phaseCopy({ ...base, theme: 'studio', phase: 'after' }, NOW, 'en').title).toBe('The record is out');
    expect(phaseCopy({ ...base, theme: 'studio', phase: 'after' }, NOW, 'ru').title).toBe('Альбом вышел');
    expect(kickoffLine({ next_lesson: base.next_lesson, theme: 'studio' }, NOW, 'en')).toMatch(/^Session in /);
    expect(kickoffLine({ next_lesson: null, theme: 'studio' }, NOW, 'en')).toBe('Last track recorded');
    const note = coachNote('season', NOW, 7, 'en', 15, 'studio');
    expect([1, 2, 3].map((n) => t(`studentHome.league.studio.note.season.${n}` as never, undefined, 'en'))).toContain(note);
  });

  it('never tells a studio student the football news nights', () => {
    const kaneNight = Date.parse('2026-10-28T10:00:00+05:00');
    expect(coachNote('season', kaneNight, 7, 'en', 10)).toContain('Kane');
    expect(coachNote('season', kaneNight, 7, 'en', 10, 'studio')).not.toContain('Kane');
  });

  it('lists the goals by their studio names', () => {
    expect(goalViews([], 'en', 'studio').map((g) => g.title).slice(0, 3)).toEqual(['Signed', 'First Take', 'Three-Peat']);
    expect(goalViews([], 'en').map((g) => g.title)[0]).toBe('Signed to the League');
  });
});
