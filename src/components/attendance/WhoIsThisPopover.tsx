import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { WhoIsThis } from '../meetAttendance/WhoIsThis';
import { useMeetRecord } from '../meetAttendance/MeetRecordView';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/attendance';

/**
 * «Кто это?» for a held-back cell (owner, 2026-10-17): Meet waits because an account in the room may be
 * this student, so the teacher names it — the same list and the same `PUT /meet-attendance/participants/{id}`
 * as the lesson's Meet card — and Meet decides again. Marking by hand stays as the way out.
 */
export function WhoIsThisPopover({ eventId, onClose, onByHand, onNamed }: {
  eventId: number;
  onClose: () => void;
  /** «Отметить вручную»: the caller marks the cell itself. */
  onByHand?: () => void;
  /** Called once when the popover closes after at least one account was named, so the caller can reload. */
  onNamed?: () => void;
}) {
  const t = useT();
  const { record, loading, failed, busyId, confirm, confirmMany } = useMeetRecord(eventId, true);
  const unknown = record?.unknown ?? [];
  const first = useRef<number | null>(null);
  // How many unconfirmed accounts there were when it opened: fewer now means someone was named.
  useEffect(() => { if (record && first.current === null) first.current = unknown.length; }, [record, unknown.length]);

  const close = () => {
    if (first.current !== null && unknown.length < first.current) onNamed?.();
    onClose();
  };

  return (
    <Popover open onOpenChange={(next) => { if (!next) close(); }}>
      <PopoverAnchor asChild>
        <span className="absolute inset-0 pointer-events-none" />
      </PopoverAnchor>
      <PopoverContent
        className="w-80 max-h-[min(70vh,var(--radix-popover-content-available-height))] overflow-y-auto p-3"
        align="start"
        collisionPadding={8}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-xs text-muted-foreground">{t('attendance.who.hint')}</p>
        {loading && <Loader2 className="mx-auto my-3 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
        {failed && <p className="text-xs text-rose-600">{t('attendance.who.loadFailed')}</p>}
        {record && unknown.length === 0 && <p className="text-xs text-foreground">{t('attendance.who.done')}</p>}
        {record && (
          <WhoIsThis accounts={unknown} candidates={record.candidates ?? []} busyId={busyId}
            onConfirm={confirm} onConfirmMany={confirmMany} />
        )}
        <div className="mt-3 flex justify-end gap-2">
          {onByHand && (
            <button type="button" onClick={() => { onByHand(); close(); }}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {t('attendance.who.byHand')}
            </button>
          )}
          <button type="button" onClick={close}
            className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
            {t('common.close')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default WhoIsThisPopover;
