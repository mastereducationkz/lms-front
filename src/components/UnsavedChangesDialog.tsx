import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/lessonPlayer';

interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export function UnsavedChangesDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description
}: UnsavedChangesDialogProps) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <DialogTitle className="text-xl font-semibold">{title ?? t('lessonPlayer.unsaved.title')}</DialogTitle>
          </div>
          <DialogDescription className="pt-4 text-base text-gray-700 dark:text-foreground">
            {description ?? t('lessonPlayer.unsaved.body')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            {t('lessonPlayer.unsaved.back')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            className="flex-1"
          >
            {t('lessonPlayer.unsaved.discard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UnsavedChangesDialog;
