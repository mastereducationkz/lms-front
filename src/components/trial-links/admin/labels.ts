import type { TFunction } from '../../../lib/i18n/translate';
import type { Grade, Interest, LeadState, SignupOutcome } from '../../../services/api/trialLinks';
import '@/lib/i18n/catalogs/trialLinks';

export const gradeLabel = (t: TFunction, g: Grade | string) =>
  g === 'graduated' ? t('trialLinks.form.grade.graduated') : g === 'other' ? t('trialLinks.form.grade.other') : g;

export const interestLabel = (t: TFunction, i: Interest | string) =>
  i === 'sat' || i === 'ielts' || i === 'nuet' || i === 'unsure' ? t(`trialLinks.form.interest.${i}`) : i;

export const outcomeLabel = (t: TFunction, o: SignupOutcome) => t(`trialLinks.admin.outcome.${o}`);

export const leadLabel = (t: TFunction, s: LeadState) => t(`trialLinks.admin.lead.${s}`);

export const OUTCOME_TONE: Record<SignupOutcome, string> = {
  created: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  existing_account: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  already_student: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  phone_registered: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
};

/** Share of `part` in `whole`, as a whole percent; 0 when there is nothing to divide by. */
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
