import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/sharedUi';

export default function EmptyState({ title, subtitle }: { title?: string; subtitle?: string }) {
  const t = useT();
  return (
    <div className="text-center py-16 text-gray-600">
      <div className="text-2xl font-semibold mb-1">{title ?? t('sharedUi.emptyState.title')}</div>
      <div className="text-sm">{subtitle ?? t('sharedUi.emptyState.subtitle')}</div>
    </div>
  );
}


