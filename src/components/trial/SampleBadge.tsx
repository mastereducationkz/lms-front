import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

const SampleBadge: React.FC = () => {
  const t = useT();
  return (
    <span className="inline-flex items-center rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide ml-2">
      {t('studentHome.trial.sampleData')}
    </span>
  );
};

export default SampleBadge;
