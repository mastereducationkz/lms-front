import type { studentHome as en } from '../en/studentHome';
import type { RuTable } from '../types';
import { achievementCopy } from './studentHome/achievementCopy';
import { assignmentZero } from './studentHome/assignmentZero';
import { dashboard } from './studentHome/dashboard';
import { extras } from './studentHome/extras';
import { kasatik } from './studentHome/kasatik';
import { wardrobe } from './studentHome/wardrobe';

export const studentHome: RuTable<typeof en> = {
  ...dashboard,
  ...assignmentZero,
  ...kasatik,
  ...achievementCopy,
  ...wardrobe,
  ...extras,
};
