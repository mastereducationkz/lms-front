import type { MessageTable } from '../types';
import { achievementCopy } from './studentHome/achievementCopy';
import { assignmentZero } from './studentHome/assignmentZero';
import { dashboard } from './studentHome/dashboard';
import { extras } from './studentHome/extras';
import { kasatik } from './studentHome/kasatik';
import { league } from './studentHome/league';
import { leagueInvitation } from './studentHome/leagueInvitation';
import { wardrobe } from './studentHome/wardrobe';

/**
 * Signed-in student screens: the dashboard, Assignment Zero, daily questions, the leaderboard,
 * achievements, the Kasatik wardrobe, sharing, streaks, stars and trial access. One file per area
 * under ./studentHome so each stays readable; every key starts with 'studentHome.'.
 */
export const studentHome = {
  ...dashboard,
  ...assignmentZero,
  ...kasatik,
  ...achievementCopy,
  ...league,
  ...leagueInvitation,
  ...wardrobe,
  ...extras,
} as const satisfies MessageTable;
