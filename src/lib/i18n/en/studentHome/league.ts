import type { MessageTable } from '../../types';

/**
 * Master League (owner, 2026-10-13): the ten league achievements' own words (six for playing the
 * season, four for the mock climb and the official result), the eleven kit parts, the season banner
 * (every phase, plus coach's notes) and the welcome scene. A season is a month of matchdays
 * (lessons), the squad is the group, the exam is The Final. The server mirrors the achievement
 * English (lms-backend src/achievements/catalog.py); Russian is looked up by key.
 */
export const league = {
  // ── achievements ──
  'studentHome.achievement.ml_signed.title': 'Signed to the League',
  'studentHome.achievement.ml_signed.description': 'You made the Master League squad, the strongest of the season. The kit is yours.',
  'studentHome.achievement.ml_signed.howTo': 'Be picked for a Master League squad.',
  'studentHome.achievement.ml_first_whistle.title': 'First Whistle',
  'studentHome.achievement.ml_first_whistle.description': 'You played your first Master League matchday.',
  'studentHome.achievement.ml_first_whistle.howTo': 'Attend your first Master League lesson.',
  'studentHome.achievement.ml_hat_trick.title': 'Hat-trick',
  'studentHome.achievement.ml_hat_trick.description': 'Three Master League lessons in a row. You’re on a roll.',
  'studentHome.achievement.ml_hat_trick.howTo': 'Attend 3 Master League lessons in a row.',
  'studentHome.achievement.ml_full_squad.title': 'Full Squad',
  'studentHome.achievement.ml_full_squad.description': 'Everyone showed up, and so did you: a matchday with the whole team on the pitch.',
  'studentHome.achievement.ml_full_squad.howTo': 'Be there when the whole squad attends the same lesson.',
  'studentHome.achievement.ml_ever_present.title': 'Ever-Present',
  'studentHome.achievement.ml_ever_present.description': 'At least 90% of the season. Every matchday counted.',
  'studentHome.achievement.ml_ever_present.howTo': 'Attend at least 90% of your Master League lessons. Awarded when the season’s last lesson ends.',
  'studentHome.achievement.ml_no_loose_ends.title': 'No Loose Ends',
  'studentHome.achievement.ml_no_loose_ends.description': 'Every Master League homework in on time. Nothing left hanging.',
  'studentHome.achievement.ml_no_loose_ends.howTo': 'Hand in every Master League homework before its deadline (at least 3). Awarded when the season ends.',
  // phase 2: the climb and The Final itself
  'studentHome.achievement.ml_mock_climb.title': 'The Climb',
  'studentHome.achievement.ml_mock_climb.description': 'A full mock, 50+ points above your starting score. The summit is in sight.',
  'studentHome.achievement.ml_mock_climb.howTo': 'Score at least 50 points above your starting score on a full Bluebook mock during the season.',
  'studentHome.achievement.ml_breakthrough.title': 'Breakthrough',
  'studentHome.achievement.ml_breakthrough.description': '100+ points above your starting score on The Final. You didn’t just play, you broke through.',
  'studentHome.achievement.ml_breakthrough.howTo': 'Score at least 100 points above your starting score on the official exam. Awarded when your official score report is verified.',
  'studentHome.achievement.ml_1500.title': '1500 Club',
  'studentHome.achievement.ml_1500.description': '1500 or higher on The Final. Welcome to a very small club.',
  'studentHome.achievement.ml_1500.howTo': 'Score 1500 or higher on the official exam. Awarded when your official score report is verified.',
  'studentHome.achievement.ml_perfect.title': 'Perfect',
  'studentHome.achievement.ml_perfect.description': 'A perfect 1600 on The Final. Full marks, full stop.',
  'studentHome.achievement.ml_perfect.howTo': 'Score a perfect 1600 on the official exam. Awarded when your official score report is verified.',

  // ── the kit (wardrobe names) ──
  'studentHome.wardrobe.hat.leagueJersey': 'League Jersey',
  'studentHome.wardrobe.hat.hatTrickTopper': 'Hat-trick Topper',
  'studentHome.wardrobe.prop.silverWhistle': 'Silver Whistle',
  'studentHome.wardrobe.prop.squadPennant': 'Squad Pennant',
  'studentHome.wardrobe.prop.goldClipboard': 'Gold Clipboard',
  'studentHome.wardrobe.background.stadiumLights': 'Stadium Lights',
  'studentHome.wardrobe.frame.leagueCrest': 'League Crest frame',
  'studentHome.wardrobe.hat.goldenLaurel': 'Golden Laurel',
  'studentHome.wardrobe.prop.summitFlag': 'Summit Flag',
  'studentHome.wardrobe.background.breakthroughDawn': 'Breakthrough Dawn',
  'studentHome.wardrobe.frame.club1500': '1500 Club frame',

  // ── the achievements page ──
  'studentHome.achievements.category.masterLeague': 'Master League',
  'studentHome.league.section.title': 'Master League',
  'studentHome.league.section.subtitle': 'Earned on the pitch and in The Final. The kit grows with every matchday.',

  // ── the season banner ──
  'studentHome.league.region': 'Your Master League season',
  'studentHome.league.eyebrow': 'Master League · {group}',
  'studentHome.league.kitAlt': 'Kasatik in the Master League kit',
  'studentHome.league.phase.warmup.title': 'Welcome to the League',
  'studentHome.league.phase.warmup.sub': 'Matchday 1 is coming. Your kit is ready.',
  'studentHome.league.phase.season.title': 'Matchday {n} of {total}',
  'studentHome.league.phase.finalWeek.title': 'Final week',
  'studentHome.league.phase.finalWeek.sub': {
    one: 'The Final is {count} day away. Make every matchday count.',
    other: 'The Final is {count} days away. Make every matchday count.',
  },
  'studentHome.league.phase.eve.title': 'Tomorrow is The Final',
  'studentHome.league.phase.eve.sub': 'Sleep. Eat. Trust your preparation.',
  'studentHome.league.phase.examDay.title': 'It’s Final day',
  'studentHome.league.phase.examDay.sub': 'You know this. Go and take it.',
  'studentHome.league.phase.after.title': 'Final whistle',
  'studentHome.league.phase.after.sub': {
    one: 'Send your official score report to your curator within {count} day. It completes your season.',
    other: 'Send your official score report to your curator within {count} days. It completes your season.',
  },
  // before the scores are out: when they come, then how long the report may take (the 14 days start on the release day)
  'studentHome.league.phase.after.subWaiting': {
    one: 'College Board publishes the scores on {date}. Then send your official score report to your curator within {count} day.',
    other: 'College Board publishes the scores on {date}. Then send your official score report to your curator within {count} days.',
  },
  'studentHome.league.phase.after.subToday': 'Send your official score report to your curator today. It completes your season.',
  'studentHome.league.daysToFinal': { one: '{count} day to The Final', other: '{count} days to The Final' },
  'studentHome.league.nextKickoff': 'Next kick-off {when}',
  'studentHome.league.kickoffIn': 'Kick-off in {time}',
  'studentHome.league.lastMatchday': 'Last matchday played',
  'studentHome.league.unit.d': 'd',
  'studentHome.league.unit.h': 'h',
  'studentHome.league.unit.min': 'min',
  'studentHome.league.stat.attendance': 'Attendance',
  'studentHome.league.stat.homework': 'Homework on time',
  'studentHome.league.stat.squad': { one: '{count} player in your squad', other: '{count} players in your squad' },
  'studentHome.league.stat.none': '—',
  'studentHome.league.track': 'Your matchdays',
  'studentHome.league.pip.attended': 'Matchday {n}: attended',
  'studentHome.league.pip.missed': 'Matchday {n}: missed',
  'studentHome.league.pip.unmarked': 'Matchday {n}: not marked yet',
  'studentHome.league.pip.today': 'Matchday {n}: today',
  'studentHome.league.pip.upcoming': 'Matchday {n}: upcoming',
  'studentHome.league.pip.final': 'The Final',
  'studentHome.league.pip.finalOn': 'The Final · {date}',
  'studentHome.league.goals.all': 'All achievements',
  'studentHome.league.goals.open': 'Season goals',
  'studentHome.league.goals.close': 'Hide goals',
  'studentHome.league.goals.title': 'Season goals',
  'studentHome.league.goal.done': 'Done',
  'studentHome.league.goal.open': 'Not yet',
  'studentHome.league.coach': 'Coach’s note',

  // coach's notes, three per phase; one is picked per day
  'studentHome.league.note.warmup.1': 'Every squad starts at zero matchdays. Yours starts with a kit.',
  'studentHome.league.note.warmup.2': 'Seats in this league are earned. Yours is already signed.',
  'studentHome.league.note.warmup.3': 'Week one sets the rhythm. Be there for the first whistle.',
  'studentHome.league.note.season.1': 'Every lesson you attend is a point your score will thank you for.',
  'studentHome.league.note.season.2': 'Champions aren’t built on big days. They’re built on matchdays like this one.',
  'studentHome.league.note.season.3': 'Small habits, big Final. Keep showing up.',
  'studentHome.league.note.finalWeek.1': 'No new tricks now. Sharpen what already works.',
  'studentHome.league.note.finalWeek.2': 'The home straight. The squad is stronger than it was a month ago, and so are you.',
  'studentHome.league.note.finalWeek.3': 'Review your mistakes, rest your head, keep the rhythm.',
  'studentHome.league.note.eve.1': 'The work is done. Tonight your only job is sleep.',
  'studentHome.league.note.eve.2': 'Get your documents and pencils ready, then close the books.',
  'studentHome.league.note.eve.3': 'You trained for this. Tomorrow is just the last matchday.',
  'studentHome.league.note.examDay.1': 'Deep breath. You’ve played harder matchdays than this.',
  'studentHome.league.note.examDay.2': 'Read each question the way a coach reads the pitch: calmly.',
  'studentHome.league.note.examDay.3': 'The whole squad is with you today.',
  'studentHome.league.note.after.1': 'Final whistle. You took on The Final, and that already counts for something.',
  'studentHome.league.note.after.2': 'Your score report is the last stamp on your season ticket.',
  'studentHome.league.note.after.3': 'The league remembers. Send your result and close the season in style.',

  // ── the welcome scene ──
  'studentHome.league.welcome.eyebrow': 'Signed to the League',
  'studentHome.league.welcome.title': 'Welcome to the Master League',
  'studentHome.league.welcome.line': {
    one: '{count} matchday. One goal. Your kit is ready.',
    other: '{count} matchdays. One goal. Your kit is ready.',
  },
  'studentHome.league.welcome.lineNoCount': 'One squad. One goal. Your kit is ready.',
  'studentHome.league.welcome.squad': '{group} · The Final on {date}',
  'studentHome.league.welcome.squadNoDate': '{group}',
  'studentHome.league.welcome.alsoUnlocked': 'Also unlocked',
  'studentHome.league.welcome.wear': 'Put on the kit',
  'studentHome.league.welcome.go': 'Let’s go',
  'studentHome.league.welcome.wearing': 'The League kit is on!',

  // ── the rarest unlocks (1500 Club, Perfect): a golden moment in the celebration ──
  'studentHome.league.milestone.eyebrow': 'Master League · One of the rarest',

  // ── connect Telegram, from the banner (quiet, never a popup) ──
  'studentHome.league.telegram.region': 'Telegram',
  'studentHome.league.telegram.offer':
    'Personal progress notes and reminders about lessons and homework, right in Telegram, if that suits you better.',
  'studentHome.league.telegram.connect': 'Connect Telegram',
  'studentHome.league.telegram.later': 'Not now',
  'studentHome.league.telegram.waiting': 'Open Telegram and tap Start. We’ll wait.',
  'studentHome.league.telegram.open': 'Open Telegram',
  'studentHome.league.telegram.timedOut': 'We didn’t catch it. You can try again.',
  'studentHome.league.telegram.failed': 'That didn’t work. Please try again in a moment.',
  'studentHome.league.telegram.thanks': 'Done, Telegram is connected. Thank you 💛',

  // ── your result: may the group chat congratulate you ──
  'studentHome.league.consent.region': 'Your result and the group chat',
  'studentHome.league.consent.title': 'Your result is recorded: {total}',
  'studentHome.league.consent.question':
    'Shall we congratulate you in the Master League group chat? We would post only your first name and your score, and only if you agree.',
  'studentHome.league.consent.yes': 'Yes, congratulate me',
  'studentHome.league.consent.no': 'No, thanks',
  'studentHome.league.consent.hint': 'If you don’t answer, nothing is posted.',
  'studentHome.league.consent.yesDone': 'Agreed: we’ll congratulate you in the group chat soon.',
  'studentHome.league.consent.takeBack': 'Changed your mind? Don’t post',
  'studentHome.league.consent.noDone': 'All right, nothing will be posted in the group chat.',
  'studentHome.league.consent.changeYes': 'Congratulate me after all',
  'studentHome.league.consent.posted': 'The congratulation is already in the group chat 💛',
  'studentHome.league.consent.failed': 'Couldn’t save your answer. Please try again.',
} as const satisfies MessageTable;
