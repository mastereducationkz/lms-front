import type { TFunction } from '../../lib/i18n/translate';
import type { ProfileAnswers, ProfileRole } from '../../services/api/publicWebinars';
import '@/lib/i18n/catalogs/openWebinars';

/**
 * The registration form's extra questions (owner, 2026-10-28), switched on per webinar. Mirrors lms-backend
 * src/public_webinars/profile.py: only «who» and the grade are required; the server checks everything again.
 */
export const ROLES: ProfileRole[] = ['student', 'parent'];
/** `7` stands for «7th grade or younger». */
export const GRADES = ['7', '8', '9', '10', '11', '12', 'graduated'] as const;
const YEARS_AHEAD = 5;

/** This year and the next five, then «later» and «not decided yet». */
export function intakeYears(now: Date = new Date()): string[] {
  const year = now.getFullYear();
  return [...Array.from({ length: YEARS_AHEAD + 1 }, (_, i) => String(year + i)), 'later', 'undecided'];
}

/** What the inputs hold: everything as typed text until it is sent. */
export interface ProfileDraft {
  role: ProfileRole | '';
  grade: string;
  city: string;
  intakeYear: string;
  satScore: string;
  ieltsScore: string;
  otherPhone: string;
  childName: string;
}

export const emptyProfile = (): ProfileDraft => ({ role: '', grade: '', city: '', intakeYear: '', satScore: '', ieltsScore: '', otherPhone: '', childName: '' });

/** The first required answer that is missing, as the server's own refusal code; null when the form may be sent. */
export function missingProfile(draft: ProfileDraft): 'profile_role_required' | 'profile_grade_required' | null {
  if (!draft.role) return 'profile_role_required';
  if (!draft.grade) return 'profile_grade_required';
  return null;
}

/** The body's `answers`: only what was filled in; the child's name only for a parent. */
export function answersOf(draft: ProfileDraft): ProfileAnswers {
  const out: ProfileAnswers = { role: draft.role as ProfileRole, grade: draft.grade };
  const put = (key: keyof ProfileAnswers, value: string) => {
    const text = value.trim();
    if (text) (out as unknown as Record<string, string>)[key] = text;
  };
  put('city', draft.city);
  put('intake_year', draft.intakeYear);
  put('sat_score', draft.satScore);
  put('ielts_score', draft.ieltsScore);
  put('other_phone', draft.otherPhone);
  if (draft.role === 'parent') put('child_name', draft.childName);
  return out;
}

export function gradeLabel(grade: string, t: TFunction): string {
  if (grade === '7') return t('openWebinars.form.profile.grade.7');
  if (grade === 'graduated') return t('openWebinars.form.profile.grade.graduated');
  return t('openWebinars.form.profile.grade.n', { n: grade });
}

export function yearLabel(year: string, t: TFunction): string {
  if (year === 'later') return t('openWebinars.form.profile.year.later');
  if (year === 'undecided') return t('openWebinars.form.profile.year.undecided');
  return year;
}

/** One short line of the answers for the admin's registrations list, in the reader's language. */
export function answersSummary(answers: ProfileAnswers | null | undefined, t: TFunction): string[] {
  if (!answers) return [];
  const parent = answers.role === 'parent';
  const parts: string[] = [];
  if (answers.role) parts.push(t(`openWebinars.form.profile.role.${answers.role}` as 'openWebinars.form.profile.role.student'));
  if (answers.child_name) parts.push(t('openWebinars.admin.regs.profile.child', { value: answers.child_name }));
  if (answers.grade) parts.push(gradeLabel(String(answers.grade), t));
  if (answers.city) parts.push(String(answers.city));
  if (answers.intake_year) parts.push(t('openWebinars.admin.regs.profile.year', { value: yearLabel(String(answers.intake_year), t) }));
  if (answers.sat_score != null) parts.push(`SAT ${answers.sat_score}`);
  if (answers.ielts_score != null) parts.push(`IELTS ${answers.ielts_score}`);
  if (answers.other_phone) {
    parts.push(t(parent ? 'openWebinars.admin.regs.profile.otherPhoneOfStudent' : 'openWebinars.admin.regs.profile.otherPhoneOfParent', { value: String(answers.other_phone) }));
  }
  return parts;
}
