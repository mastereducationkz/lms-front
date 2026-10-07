import { useState } from 'react';
import { VideoOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { removeRecording } from '../../services/api/recordings';
import { useT } from '../../lib/i18n/react';

interface Props {
  eventId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
}

/**
 * Two outcomes, chosen deliberately, because they are not interchangeable: hiding a video
 * leaves the lesson paid, while "not recorded" is the payroll state that stops it being paid.
 * The pay consequence is spelled out next to the option rather than left to be discovered.
 *
 * A reason is required — this is visible to staff, adjacent to money, and looks permanent to
 * everyone who hits it, so it must never be anonymous.
 */
export default function RemoveRecordingDialog({ eventId, open, onOpenChange, onRemoved }: Props) {
  const t = useT();
  const [notRecorded, setNotRecorded] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeRecording(eventId, reason.trim(), notRecorded);
      onRemoved();
      onOpenChange(false);
      setReason('');
      setNotRecorded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const option = (value: boolean, label: string, hint: string) => (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
        notRecorded === value ? 'border-primary bg-muted/50' : 'border-border hover:bg-muted/30'
      }`}
    >
      <input
        type="radio"
        name="removal-kind"
        className="mt-1 flex-none"
        checked={notRecorded === value}
        onChange={() => setNotRecorded(value)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <VideoOff className="h-4 w-4" aria-hidden />
            {t('recordings.remove.title')}
          </DialogTitle>
          <DialogDescription>{t('recordings.remove.intro')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {option(false, t('recordings.remove.hide'), t('recordings.remove.hideHint'))}
          {option(true, t('recordings.remove.notRecorded'), t('recordings.remove.notRecordedHint'))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="removal-reason" className="text-sm font-medium text-foreground">
            {t('recordings.remove.reason')}
          </label>
          <Textarea
            id="removal-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('recordings.remove.reasonPlaceholder')}
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? t('recordings.remove.working') : t('recordings.remove.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
