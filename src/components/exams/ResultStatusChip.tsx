import { useT } from '../../lib/i18n/react';
import { STATUS_TONE, isUnconfirmed, type ResultStatusValue } from './resultStatus';
import '@/lib/i18n/catalogs/exams';

export interface ChipResult {
  status: ResultStatusValue;
  has_proof: boolean;
  verified_by_name?: string | null;
  recorded_by_name?: string | null;
}

const chip = 'inline-block rounded px-1.5 py-0.5 text-[10px] leading-4 font-medium whitespace-nowrap';

/** Status of one result (внесён / проверен / отклонён) plus the «без подтверждения» flag. */
export function ResultStatusChip({ result }: { result: ChipResult }) {
  const t = useT();
  const who = result.status === 'verified' ? result.verified_by_name : result.recorded_by_name;
  const title = who
    ? t(result.status === 'verified' ? 'exams.status.verifiedBy' : 'exams.status.recordedBy', { name: who })
    : undefined;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`${chip} ${STATUS_TONE[result.status]}`} title={title} data-testid="result-status">
        {t(`exams.resultStatus.${result.status}`)}
      </span>
      {isUnconfirmed(result) && (
        <span className={`${chip} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300`}
              title={t('exams.status.unconfirmedTitle')} data-testid="result-unconfirmed">
          {t('exams.status.unconfirmed')}
        </span>
      )}
    </span>
  );
}
