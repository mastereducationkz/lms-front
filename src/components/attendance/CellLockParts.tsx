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

/** Before Meet decides, an advance excuse is all a person may write: a dot that opens the reason box. */
export function PendingExcuseDot({ onExcuse, className }: {
  onExcuse: (excused: boolean, note: string | null) => void;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={cn('absolute left-1 top-1 h-2.5 w-2.5 rounded-full border border-muted-foreground/60 bg-transparent', className)}
        title={t('attendance.excuse.markTitle')}
        aria-label={t('attendance.excuse.markAria')}
      />
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

/** A student Meet held back for an unconfirmed account: «Кто это?» names it (Meet decides again). */
export function HeldBackButton({ eventId, onByHand, onNamed }: {
  eventId: number;
  onByHand: () => void;
  onNamed: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="absolute bottom-0 right-0 rounded-tl bg-amber-500 px-1 text-[9px] font-bold leading-3 text-white hover:bg-amber-600"
      >
        {t('attendance.who.button')}
      </button>
      {open && <WhoIsThisPopover eventId={eventId} onClose={() => setOpen(false)} onByHand={onByHand} onNamed={onNamed} />}
    </>
  );
}
