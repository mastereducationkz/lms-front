import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { apiErrorCode, moderateRemoveClassMaterialItem } from '../../services/api/classMaterials';
import { errorMessage, t, type Locale } from '../../lib/classMaterials';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: number;
  locale: Locale;
  onRemoved: () => void;
}

/** D17/§8.4: a moderator's removal always carries a reason — it is what the uploader's bell shows. */
export default function RemoveReasonDialog({ open, onOpenChange, itemId, locale, onRemoved }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = (next: boolean) => {
    if (!next) {
      setReason('');
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t('reason_required', locale));
      return;
    }
    setSubmitting(true);
    try {
      await moderateRemoveClassMaterialItem(itemId, trimmed);
      setReason('');
      setError(null);
      onRemoved();
    } catch (err) {
      toast.error(errorMessage(apiErrorCode(err), locale));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('moderate', locale)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="class-material-remove-reason">{t('reason', locale)}</Label>
          <Textarea
            id="class-material-remove-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            rows={3}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={submitting}>
            {t('cancel', locale)}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void submit()} disabled={submitting}>
            {t('moderate', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
