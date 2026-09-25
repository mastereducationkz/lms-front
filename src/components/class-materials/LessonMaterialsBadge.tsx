import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { materialsBadgeVariant } from '../../lib/classMaterials';
import ClassMaterialsSection from './ClassMaterialsSection';

interface Props {
  eventId: number | null | undefined;
  count: number;
  role?: string | null;
  /** The attendance grid's own `t(ru, en)` role rule (Russian for curator/admin/head_teacher,
   *  English for teacher) — not `materialsLocale`, which follows a different rule. Any label
   *  this button shows stays consistent with the rest of the page it lives on. */
  t: (ru: string, en: string) => string;
  /** Fired after the dialog reports a write, so the caller can refetch the grid's counts. */
  onChanged?: () => void;
}

/**
 * The attendance-grid 📎 badge next to a lesson's topic-edit pencil (Task 15): the material
 * count once there is one, or — for a role that can plausibly manage the lesson
 * (teacher/head_teacher/admin) — a faint "+" invitation to add the first one. A curator or
 * head_curator sees nothing here until the count is above zero.
 *
 * Clicking either state opens the same `ClassMaterialsSection` the lesson pop-up uses, in a
 * small dialog. The dialog's own `can_manage` check — not this button's role guess — is what
 * actually gates adding, so a role-eligible viewer who isn't this particular lesson's manager
 * still just gets a read-only view, exactly like anywhere else `ClassMaterialsSection` renders.
 */
export default function LessonMaterialsBadge({ eventId, count, role, t, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const variant = materialsBadgeVariant(eventId, count, role);
  if (!variant || !eventId) return null;

  const label = t('Материалы урока', 'Lesson materials');

  return (
    <>
      <button
        type="button"
        className={
          variant === 'count'
            ? 'absolute top-1 left-1 z-10 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
            : 'absolute top-1 left-1 z-10 flex items-center gap-0.5 rounded px-1 py-0.5 text-gray-400 opacity-100 transition-opacity hover:text-blue-500 md:opacity-0 md:group-hover/lesson:opacity-100 dark:text-gray-600'
        }
        title={label}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Paperclip className="h-3.5 w-3.5" />
        {variant === 'count' ? <span>{count}</span> : <span className="text-[9px] font-bold">+</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {/* `ClassMaterialsSection` renders its own visible «Материалы урока» heading below;
              this title only supplies the dialog's accessible name, so the two don't stack. */}
          <DialogHeader className="sr-only">
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <ClassMaterialsSection eventId={eventId} variant="dialog" onChanged={onChanged} />
        </DialogContent>
      </Dialog>
    </>
  );
}
