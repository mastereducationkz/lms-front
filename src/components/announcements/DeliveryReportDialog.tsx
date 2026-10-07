import { Check, Pin } from 'lucide-react';
import { sanitizeHtml } from '../../lib/safeHtml';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DELIVERY_STATUS_LABELS, formatDateTime } from './shared';
import { renderStoredBodyHtml } from './telegramText';
import type { AnnouncementDetail, AnnouncementTarget } from '../../services/api/announcements';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

interface DeliveryReportDialogProps {
  announcement: AnnouncementDetail | null;
  onClose: () => void;
}

function TargetStatus({ target }: { target: AnnouncementTarget }) {
  const t = useT();
  if (target.status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <Check className="h-3.5 w-3.5" />
        {t('announcements.delivery.sent')}
        {target.pinned && <Pin className="h-3 w-3" aria-label={t('announcements.delivery.pinned')} />}
      </span>
    );
  }
  if (target.status === 'failed') return <span className="text-rose-600">{t('announcements.delivery.failed')}</span>;
  const label = DELIVERY_STATUS_LABELS[target.status];
  return <span className="text-muted-foreground">{label ? t(label) : target.status}</span>;
}

/**
 * One row per recipient, with Telegram's own reason for each failure. That
 * reason — "bot was kicked from the supergroup chat" — is the whole point of
 * this screen: it tells staff exactly what to fix.
 */
export function DeliveryReportDialog({ announcement, onClose }: DeliveryReportDialogProps) {
  const t = useT();
  return (
    <Dialog open={announcement !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        {announcement && (
          <>
            <DialogHeader>
              <DialogTitle>{t('announcements.report.title')}</DialogTitle>
              <DialogDescription>
                {t('announcements.report.delivered', { sent: announcement.sent_count, total: announcement.total_count })}
                {announcement.failed_count > 0 && ` · ${t('announcements.report.failed', { count: announcement.failed_count })}`}
              </DialogDescription>
            </DialogHeader>
            {/* Rendered, not shown as source: the stored body is Telegram HTML,
                and staff should see the message the way recipients saw it. */}
            <div className="rounded-md bg-muted p-3 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:font-mono">
              {announcement.body ? (
                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderStoredBodyHtml(announcement.body)) }} />
              ) : (
                <span className="text-muted-foreground">{t('announcements.history.imagesOnly')}</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('announcements.report.colRecipient')}</TableHead>
                    <TableHead>{t('announcements.report.colType')}</TableHead>
                    <TableHead>{t('announcements.report.colStatus')}</TableHead>
                    <TableHead>{t('announcements.report.colDetail')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcement.targets.map((target) => (
                    <TableRow key={target.id}>
                      <TableCell className="text-foreground">{target.label}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {target.kind === 'group' ? t('announcements.delivery.kindGroup') : target.kind === 'chat' ? t('announcements.delivery.kindChat') : target.kind}
                      </TableCell>
                      <TableCell>
                        <TargetStatus target={target} />
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {target.error || formatDateTime(target.sent_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
