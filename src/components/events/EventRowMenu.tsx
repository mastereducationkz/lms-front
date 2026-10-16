import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { lessonPath } from '../../lib/lessonLinks';
import type { Event } from '../../types';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/adminPages';

interface Props {
  event: Event;
  /** A generated entry (an assignment deadline drawn on the calendar) has no row to delete. */
  virtual: boolean;
  onViewDetails: (event: Event) => void;
  onDelete: (id: number) => void;
}

/**
 * The «⋯» menu of a row in Manage events. «View Details» opens the calendar's own card in place;
 * «Participants» is the register of a class lesson, so only a lesson has it: an office hour is linked to
 * a course, not to groups, and has no list of its own. (Both used to point at pages that never existed
 * and landed on the dashboard.)
 */
export default function EventRowMenu({ event, virtual, onViewDetails, onDelete }: Props) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onViewDetails(event)}>
          {t('adminPages.events.list.viewDetails')}
        </DropdownMenuItem>
        {event.event_type === 'class' && !virtual && (
          <DropdownMenuItem onClick={() => navigate(lessonPath(event.id, 'register'))}>
            {t('adminPages.events.participants')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-red-600 dark:text-red-400"
          onClick={() => onDelete(event.id)}
          disabled={virtual}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t('common.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
