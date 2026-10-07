/**
 * A student's own orca wearing one reward part — for unlock celebrations and achievement cards.
 * Starts from their saved look (or automatic one) and swaps in just that part.
 */
import Orca from './Orca';
import { CATEGORY_OF_TAG, resolveMascot, type LayerTag } from './config';
import { t } from '../../lib/i18n';
import '@/lib/i18n/catalogs/sharedUi';

interface RewardPreviewProps {
  userId: number | string;
  mascot?: string | null;
  layer: LayerTag;
  index: number;
  size?: number;
  className?: string;
  title?: string;
}

export default function RewardPreview({ userId, mascot, layer, index, size = 120, className, title }: RewardPreviewProps) {
  const config = { ...resolveMascot(mascot, userId), [CATEGORY_OF_TAG[layer]]: index };
  return <Orca config={config} size={size} className={className} title={title ?? t('sharedUi.mascot.rewardPreview')} />;
}
