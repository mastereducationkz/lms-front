import { Link } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { duplicateHref } from './duplicate';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

/**
 * «Duplicate» of an open webinar: opens the create form prefilled from this one. Nothing is saved until Create.
 * Shown to the roles that run open webinars (admin, head teacher, head curator).
 */
export default function DuplicateButton({ eventId }: { eventId: number }) {
  const { user } = useAuth();
  const t = useT();
  const href = duplicateHref(user?.role, eventId);
  if (!href) return null;
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={href} data-duplicate={eventId} onClick={(e) => e.stopPropagation()}>
        <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {t('openWebinars.admin.duplicate.button')}
      </Link>
    </Button>
  );
}
