import { useT } from '../../lib/i18n/react';
import { examSectionParts, type ExamSectionInput } from '../../lib/examSection';
import '@/lib/i18n/catalogs/attendance';

/** One Math / Verbal cell: correct / total first, the NUET score out of 120 smaller underneath. */
export default function ExamSectionCell(props: ExamSectionInput) {
  const t = useT();
  const { primary, secondary } = examSectionParts(props);
  if (primary === null) return <span className="text-foreground dark:text-foreground">{t('attendance.exam.notTaken')}</span>;
  return (
    <span className="flex flex-col items-center leading-tight text-foreground dark:text-foreground">
      <span data-line>{primary}</span>
      {secondary && <span data-line className="text-[10px] font-normal tabular-nums text-muted-foreground">{secondary}</span>}
    </span>
  );
}
