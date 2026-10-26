/**
 * Where a season may draw. The app places slots once — the top bar, the dashboard, every avatar,
 * the signed-in shell — and never knows which season fills them. Outside a season, on a quiet
 * screen, or for someone who switched decorations off, a slot renders nothing and loads nothing.
 */
import { lazy, Suspense } from 'react';
import { useSeason } from './SeasonProvider';

export type SlotProps =
  | { name: 'topbar' }
  | { name: 'greeting' }
  | { name: 'overlay' }
  | { name: 'avatar'; size: number; seed?: string | number | null };

const Halloween = lazy(() => import('./halloween/slots'));

export function SeasonSlot(props: SlotProps) {
  const { season, decorate } = useSeason();
  if (!decorate || season !== 'halloween') return null;
  return (
    <Suspense fallback={null}>
      <Halloween {...props} />
    </Suspense>
  );
}
