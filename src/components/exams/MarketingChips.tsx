import { useT } from '../../lib/i18n/react';
import type { ExamResultRow } from '../../services/api/exams';
import '@/lib/i18n/catalogs/exams';

const chipBase = 'inline-block rounded px-1.5 py-0.5 text-[10px] leading-4 whitespace-nowrap';
const chipOk = `${chipBase} font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300`;
const chipMuted = `${chipBase} bg-muted text-muted-foreground`;

/**
 * Why a row may be used in marketing. The two grounds are shown separately because they
 * permit different things: a score is a fact with no consent attached, while a
 * testimonial IS the consent record - only it allows using the student's name or photo.
 * Renders nothing when the row is not eligible.
 */
export function MarketingChips({ row }: { row: ExamResultRow }) {
  const t = useT();
  if (!row.marketing_eligible) return null;
  const byScore = row.marketing_basis.includes('score');
  const byTestimonial = row.marketing_basis.includes('testimonial');
  // The qualifying sitting, spelled out: the verdict is judged on the student's current
  // attempt, which is not always the attempt this row displays - a status or date filter
  // can narrow the row to another one.
  const scoreTitle = row.marketing_score != null && row.marketing_test_date != null
    ? t('exams.marketing.scoreTitleWithAttempt', {
        threshold: row.marketing_threshold ?? '', score: Number(row.marketing_score), date: row.marketing_test_date,
      })
    : t('exams.marketing.scoreTitle', { threshold: row.marketing_threshold ?? '' });
  return (
    <span className="inline-flex items-center gap-1">
      {byScore && (
        <span className={chipOk}
              title={scoreTitle}>
          {t('exams.marketing.score')}
        </span>
      )}
      {byTestimonial && (
        <span className={chipOk}
              title={t('exams.marketing.testimonialTitle')}>
          {t('exams.marketing.testimonial')}
        </span>
      )}
      {byScore && !byTestimonial && (
        <span className={chipMuted}
              title={t('exams.marketing.noConsentTitle')}>
          {t('exams.marketing.noConsent')}
        </span>
      )}
    </span>
  );
}
