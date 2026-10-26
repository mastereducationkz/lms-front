import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { MeetMarkForm } from './MeetMarkForm';
import type { MarkChange } from '../../lib/registerLock';
import type { ComponentProps } from 'react';

type FormProps = ComponentProps<typeof MeetMarkForm>;

/**
 * The journal's per-cell way to correct a mark Meet decided: Meet's evidence, the new mark and a reason
 * (`MeetMarkForm`), anchored on the cell like `ExcusePopover`. Mounted by the cell when it is clicked.
 */
export function MeetMarkPopover({ onApply, onClose, ...form }: Omit<FormProps, 'onCancel' | 'onApply'> & {
  onApply: (change: MarkChange) => void;
  onClose: () => void;
}) {
  return (
    <Popover open onOpenChange={(next) => { if (!next) onClose(); }}>
      <PopoverAnchor asChild>
        <span className="absolute inset-0 pointer-events-none" />
      </PopoverAnchor>
      <PopoverContent
        className="w-72 p-3 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto"
        align="start"
        collisionPadding={8}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        // Rendered in a portal, but React still bubbles its events to the cell that opened it.
        onKeyDown={(e) => e.stopPropagation()}
      >
        <MeetMarkForm {...form} onApply={(change) => { onApply(change); onClose(); }} onCancel={onClose} />
      </PopoverContent>
    </Popover>
  );
}

export default MeetMarkPopover;
