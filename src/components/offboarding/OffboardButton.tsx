import { UserMinus } from 'lucide-react';
import { Button } from '../ui/button';
import { useOffboardLauncher } from './useOffboardLauncher';
import type { OffboardingRecord } from '../../services/api/offboarding';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

interface OffboardButtonProps {
  /** The LMS user to offboard. */
  userId: number;
  name: string;
  role: string;
  onChanged?: (record: OffboardingRecord) => void;
  className?: string;
}

/**
 * «Offboard» on a staff member's page (head teacher's teacher view, head curator's curator view).
 * Renders nothing while offboarding is switched off or the viewer may not offboard this role.
 */
export default function OffboardButton({ userId, name, role, onChanged, className }: OffboardButtonProps) {
  const t = useT();
  const launcher = useOffboardLauncher(onChanged);
  const person = { id: userId, name, role };

  if (!launcher.canOffboard(person)) return null;

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => launcher.open(person)}>
        <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('offboarding.action.offboard')}
      </Button>
      {launcher.dialog}
    </>
  );
}
