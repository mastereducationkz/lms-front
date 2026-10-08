import { SearchableSelect } from '../ui/searchable-select';
import { STATUS_TONE, STEP_TONE, TONE_CLASS } from '../../lib/offboarding';
import type { OffboardingStatus, Person, StepStatus } from '../../services/api/offboarding';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

const pill = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

export function StatusBadge({ status }: { status: OffboardingStatus }) {
  const t = useT();
  return <span className={`${pill} ${TONE_CLASS[STATUS_TONE[status] ?? 'neutral']}`}>{t(`offboarding.status.${status}`)}</span>;
}

export function StepBadge({ status }: { status: StepStatus }) {
  const t = useT();
  return <span className={`${pill} ${TONE_CLASS[STEP_TONE[status] ?? 'neutral']}`}>{t(`offboarding.stepStatus.${status}`)}</span>;
}

interface PersonSelectProps {
  people: Person[];
  value: number | null;
  onChange: (id: number) => void;
  suggestedId?: number | null;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Pick one person by name; the programme default carries a «Suggested» hint. */
export function PersonSelect({ people, value, onChange, suggestedId, placeholder, ariaLabel, disabled, className }: PersonSelectProps) {
  const t = useT();
  return (
    <SearchableSelect
      options={people.map((p) => ({
        value: String(p.id),
        label: p.name,
        hint: p.id === suggestedId ? t('offboarding.handover.suggested') : undefined,
      }))}
      value={value == null ? null : String(value)}
      onChange={(v) => onChange(Number(v))}
      placeholder={placeholder ?? t('offboarding.handover.chooseOwner')}
      searchPlaceholder={t('offboarding.handover.searchPerson')}
      emptyText={t('offboarding.handover.noPeople')}
      ariaLabel={ariaLabel}
      disabled={disabled}
      className={className}
    />
  );
}
