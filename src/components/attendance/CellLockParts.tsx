import { useState } from 'react';
import { cn } from '../../lib/utils';
import { ExcusePopover } from './ExcusePopover';
import { WhoIsThisPopover } from './WhoIsThisPopover';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/attendance';

/**
 * The two small controls an unmarked journal cell can carry under the register lock (2026-10-17). Each
 * keeps its own open/closed state and anchors its popover on the cell that holds it, so the page's grid
 * stays one render of cells.
 */

/**
 * Before Meet decides, an advance excuse is all a person may write. In the journal's cell it is a dot
 * that opens the reason box; given a `label` (the lesson page) it is a text button, and `className`
 * then places it.
 */
export function PendingExcuseDot({ onExcuse, label, className }: {
  onExcuse: (excused: boolean, note: string | null) => void;
  label?: string;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={cn(label ? '' : 'absolute left-1 top-1 h-2.5 w-2.5 rounded-full border border-muted-foreground/60 bg-transparent', className)}
        title={t('attendance.excuse.markTitle')}
        aria-label={label ? undefined : t('attendance.excuse.markAria')}
      >
        {label}
      </button>
      {open && (
        <ExcusePopover
          excused={false}
          note={null}
          onSave={(note) => { onExcuse(true, note); setOpen(false); }}
          onClear={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * A student Meet held back for an unconfirmed account: «Кто это?» names it (Meet decides again).
 * Sits in the corner of a journal cell unless `className` places it elsewhere.
 */
export function HeldBackButton({ eventId, onByHand, onNamed, className }: {
  eventId: number;
  onByHand: () => void;
  onNamed: () => void;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={className ?? 'absolute bottom-0 right-0 rounded-tl bg-amber-500 px-1 text-[9px] font-bold leading-3 text-white hover:bg-amber-600'}
      >
        {t('attendance.who.button')}
      </button>
      {open && <WhoIsThisPopover eventId={eventId} onClose={() => setOpen(false)} onByHand={onByHand} onNamed={onNamed} />}
    </>
  );
}
