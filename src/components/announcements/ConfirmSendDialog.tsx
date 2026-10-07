import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

interface ConfirmSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduled: boolean;
  groupCount: number;
  studentCount: number;
  sending: boolean;
  onConfirm: () => void;
}

/**
 * The last gate before a broadcast. It names the exact recipient count — the
 * same number the server freezes when it accepts the announcement — and makes
 * the sender type a word rather than click, because a mis-click here reaches
 * every student group at once.
 */
export function ConfirmSendDialog({
  open,
  onOpenChange,
  scheduled,
  groupCount,
  studentCount,
  sending,
  onConfirm,
}: ConfirmSendDialogProps) {
  const t = useT();
  // The word to type follows the reader's language (SEND / ОТПРАВИТЬ).
  const confirmWord = t('announcements.confirm.word');
  const [typed, setTyped] = useState('');

  // Every opening starts empty, so a previous confirmation can't carry over.
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const total = groupCount + studentCount;
  const reach = [
    t('announcements.confirm.reach', { count: total }),
    groupCount > 0 ? t('announcements.count.groups', { count: groupCount }) : null,
    studentCount > 0 ? t('announcements.count.students', { count: studentCount }) : null,
  ].filter(Boolean).join(' — ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{scheduled ? t('announcements.confirm.titleSchedule') : t('announcements.confirm.titleSend')}</DialogTitle>
          <DialogDescription>
            {t('announcements.confirm.description', { reach, word: confirmWord })}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={confirmWord}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={sending || typed.trim() !== confirmWord}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scheduled ? t('announcements.confirm.schedule') : t('announcements.confirm.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
