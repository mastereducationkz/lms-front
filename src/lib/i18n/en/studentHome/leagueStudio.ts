import type { MessageTable } from '../../types';

/**
 * Master League season 2, «Studio» (owner, 2026-11-02, docs/master-league/SEASON-STUDIO.md): the
 * same season told as an album drop. A lesson is a track, the exam is Release Day, the coach is the
 * producer, the squad is the lineup, the kit is the studio look. Only the words that change are
 * written here; every other key falls back to the shared one (src/lib/leagueTheme.ts). Mood only:
 * no artist names, no lyrics, no album covers. The server mirrors the achievement English
 * (lms-backend src/achievements/catalog.py).
 */
export const leagueStudio = {
  // ── achievements, season 2 ──
  'studentHome.achievement.ml_signed.studio.title': 'Signed',
  'studentHome.achievement.ml_signed.studio.description': 'You’re on the Master League lineup, the strongest of the season. The studio look is yours.',
  'studentHome.achievement.ml_signed.studio.howTo': 'Be picked for the Master League lineup.',
  'studentHome.achievement.ml_first_whistle.studio.title': 'First Take',
  'studentHome.achievement.ml_first_whistle.studio.description': 'Your first Master League session. The tape is rolling.',
  'studentHome.achievement.ml_first_whistle.studio.howTo': 'Attend your first Master League lesson.',
  'studentHome.achievement.ml_hat_trick.studio.title': 'Three-Peat',
  'studentHome.achievement.ml_hat_trick.studio.description': 'Three Master League lessons in a row. You’re in the groove.',
  'studentHome.achievement.ml_hat_trick.studio.howTo': 'Attend 3 Master League lessons in a row.',
  'studentHome.achievement.ml_full_squad.studio.title': 'Full Lineup',
  'studentHome.achievement.ml_full_squad.studio.description': 'Everyone showed up, and so did you: a session with the whole lineup in the studio.',
  'studentHome.achievement.ml_full_squad.studio.howTo': 'Be there when the whole group attends the same lesson.',
  'studentHome.achievement.ml_ever_present.studio.title': 'Every Session',
  'studentHome.achievement.ml_ever_present.studio.description': 'At least 90% of the season. Every track counted.',
  'studentHome.achievement.ml_ever_present.studio.howTo': 'Attend at least 90% of your Master League lessons. Awarded when the season’s last lesson ends.',
  'studentHome.achievement.ml_no_loose_ends.studio.title': 'Final Mix',
  'studentHome.achievement.ml_no_loose_ends.studio.description': 'Every Master League homework in on time. A clean mix, nothing left on the floor.',
  'studentHome.achievement.ml_no_loose_ends.studio.howTo': 'Hand in every Master League homework before its deadline (at least 3). Awarded when the season ends.',
  'studentHome.achievement.ml_mock_climb.studio.title': 'Climbing the Charts',
  'studentHome.achievement.ml_mock_climb.studio.description': 'A full mock, 50+ points above your starting score. You’re moving up.',
  'studentHome.achievement.ml_breakthrough.studio.title': 'Breakout Single',
  'studentHome.achievement.ml_breakthrough.studio.description': '100+ points above your starting score on Release Day. The one people remember.',
  'studentHome.achievement.ml_1500.studio.title': 'Platinum',
  'studentHome.achievement.ml_1500.studio.description': '1500 or higher on Release Day. Very few records go platinum.',
  'studentHome.achievement.ml_perfect.studio.title': 'Diamond',
  'studentHome.achievement.ml_perfect.studio.description': 'A perfect 1600 on Release Day. Nothing left to add.',

  // ── the studio look (wardrobe names, appended parts) ──
  'studentHome.wardrobe.hat.studioHeadphones': 'Studio Headphones',
  'studentHome.wardrobe.hat.vinylSnapback': 'Vinyl Snapback',
  'studentHome.wardrobe.hat.diamondHeadphones': 'Diamond Headphones',
  'studentHome.wardrobe.prop.vintageMic': 'Vintage Mic',
  'studentHome.wardrobe.prop.mixingFader': 'Mixing Fader',
  'studentHome.wardrobe.prop.masterTape': 'Master Tape',
  'studentHome.wardrobe.prop.chartArrow': 'Chart Arrow',
  'studentHome.wardrobe.background.studioBooth': 'Studio Booth',
  'studentHome.wardrobe.background.stageSpotlight': 'Stage Spotlight',
  'studentHome.wardrobe.frame.goldRecord': 'Gold Record frame',
  'studentHome.wardrobe.frame.platinumRecord': 'Platinum Record frame',

  // ── the achievements page ──
  'studentHome.league.studio.section.subtitle': 'Earned in the studio and on Release Day. Your studio look grows with every track.',

  // ── the season banner ──
  'studentHome.league.studio.kitAlt': 'Kasatik in the Master League studio look',
  'studentHome.league.studio.phase.warmup.title': 'Welcome to the studio',
  'studentHome.league.studio.phase.warmup.sub': 'Track 1 is coming. Your headphones are ready.',
  'studentHome.league.studio.phase.season.title': 'Track {n} of {total}',
  'studentHome.league.studio.phase.finalWeek.title': 'Final mix week',
  'studentHome.league.studio.phase.finalWeek.sub': {
    one: 'Release Day is {count} day away. Make every track count.',
    other: 'Release Day is {count} days away. Make every track count.',
  },
  'studentHome.league.studio.phase.eve.title': 'Tomorrow is Release Day',
  'studentHome.league.studio.phase.eve.sub': 'Sleep. Eat. Trust the work you put in.',
  'studentHome.league.studio.phase.examDay.title': 'It’s Release Day',
  'studentHome.league.studio.phase.examDay.sub': 'You’ve rehearsed this. Go and make it count.',
  'studentHome.league.studio.phase.after.title': 'The record is out',
  'studentHome.league.studio.daysToFinal': { one: '{count} day to Release Day', other: '{count} days to Release Day' },
  'studentHome.league.studio.nextKickoff': 'Next session {when}',
  'studentHome.league.studio.kickoffIn': 'Session in {time}',
  'studentHome.league.studio.lastMatchday': 'Last track recorded',
  'studentHome.league.studio.stat.squad': { one: '{count} artist in your lineup', other: '{count} artists in your lineup' },
  'studentHome.league.studio.track': 'Your tracklist',
  'studentHome.league.studio.pip.attended': 'Track {n}: attended',
  'studentHome.league.studio.pip.missed': 'Track {n}: missed',
  'studentHome.league.studio.pip.unmarked': 'Track {n}: not marked yet',
  'studentHome.league.studio.pip.today': 'Track {n}: today',
  'studentHome.league.studio.pip.upcoming': 'Track {n}: upcoming',
  'studentHome.league.studio.pip.final': 'Release Day',
  'studentHome.league.studio.pip.finalOn': 'Release Day · {date}',
  'studentHome.league.studio.coach': 'Producer’s note',

  // the producer's notes, three per phase; one is picked per day
  'studentHome.league.studio.note.warmup.1': 'Every album starts with an empty tracklist. Yours starts now.',
  'studentHome.league.studio.note.warmup.2': 'Spots on this lineup are earned. Yours is signed.',
  'studentHome.league.studio.note.warmup.3': 'Week one sets the tempo. Be there for the first take.',
  'studentHome.league.studio.note.season.1': 'Every session you show up for is a point your score will thank you for.',
  'studentHome.league.studio.note.season.2': 'Great records aren’t made in one night. They’re made in sessions like this one.',
  'studentHome.league.studio.note.season.3': 'Small habits, big release. Keep showing up.',
  'studentHome.league.studio.note.finalWeek.1': 'No new sounds now. Polish what already works.',
  'studentHome.league.studio.note.finalWeek.2': 'Final mix. The lineup is sharper than it was a month ago, and so are you.',
  'studentHome.league.studio.note.finalWeek.3': 'Go over your mistakes, rest your ears, keep the tempo.',
  'studentHome.league.studio.note.eve.1': 'The tracks are recorded. Tonight your only job is sleep.',
  'studentHome.league.studio.note.eve.2': 'Get your documents and pencils ready, then close the books.',
  'studentHome.league.studio.note.eve.3': 'You rehearsed for this. Tomorrow is one more take.',
  'studentHome.league.studio.note.examDay.1': 'Deep breath. You’ve nailed harder takes than this.',
  'studentHome.league.studio.note.examDay.2': 'One question at a time, at a steady tempo.',
  'studentHome.league.studio.note.examDay.3': 'The whole lineup is with you today.',
  'studentHome.league.studio.note.after.1': 'The record is out. You showed up on Release Day, and that already counts.',
  'studentHome.league.studio.note.after.2': 'Your score report is the last line in the album credits.',
  'studentHome.league.studio.note.after.3': 'Send your result and close the season on a high note.',

  // ── the welcome scene ──
  'studentHome.league.studio.welcome.eyebrow': 'Signed',
  'studentHome.league.studio.welcome.title': 'Welcome to the Master League studio',
  'studentHome.league.studio.welcome.line': {
    one: '{count} track. One goal. Your studio look is ready.',
    other: '{count} tracks. One goal. Your studio look is ready.',
  },
  'studentHome.league.studio.welcome.lineNoCount': 'One lineup. One goal. Your studio look is ready.',
  'studentHome.league.studio.welcome.squad': '{group} · Release Day on {date}',
  'studentHome.league.studio.welcome.wear': 'Put on the studio look',
  'studentHome.league.studio.welcome.wearing': 'The studio look is on!',

  // ── the rarest unlocks (Platinum, Diamond) ──
  'studentHome.league.studio.milestone.eyebrow': 'Master League · A rare record',

  // ── the invitation ──
  'studentHome.leagueInvite.studio.kitAlt': 'Kasatik in the Master League studio look',
  'studentHome.leagueInvite.studio.hero.sub': 'A spot on the strongest SAT lineup of the season is waiting for you.',
  'studentHome.leagueInvite.studio.what.two': 'A second lineup next to your home group, which stays exactly as it is. Free of charge.',
  'studentHome.leagueInvite.studio.fact.final': 'Release Day',
  'studentHome.leagueInvite.studio.slots.title': 'Choose your lineup',
  'studentHome.leagueInvite.studio.slots.titleOne': 'Your lineup',
  'studentHome.leagueInvite.studio.slots.empty': 'The groups for this invitation are not listed yet. Ask your curator.',
  'studentHome.leagueInvite.studio.teaser.sub': 'Six goals to earn over the season, and a studio look that grows with every track.',
  'studentHome.leagueInvite.studio.requested.wrong': 'Tapped the wrong group? Tell your curator right away.',
  'studentHome.leagueInvite.studio.enrolled.title': 'You’re on the lineup',
} as const satisfies MessageTable;
