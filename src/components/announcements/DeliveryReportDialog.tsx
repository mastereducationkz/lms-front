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
import { formatDateTime } from './shared';
import { renderStoredBodyHtml } from './telegramText';
import type { AnnouncementDetail, AnnouncementTarget } from '../../services/api/announcements';

interface DeliveryReportDialogProps {
  announcement: AnnouncementDetail | null;
  onClose: () => void;
}

function TargetStatus({ target }: { target: AnnouncementTarget }) {
  if (target.status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <Check className="h-3.5 w-3.5" />
        sent
        {target.pinned && <Pin className="h-3 w-3" aria-label="pinned" />}
      </span>
    );
  }
  if (target.status === 'failed') return <span className="text-rose-600">failed</span>;
  return <span className="text-muted-foreground">{target.status}</span>;
}

/**
 * One row per recipient, with Telegram's own reason for each failure. That
 * reason — "bot was kicked from the supergroup chat" — is the whole point of
 * this screen: it tells staff exactly what to fix.
 */
export function DeliveryReportDialog({ announcement, onClose }: DeliveryReportDialogProps) {
  return (
    <Dialog open={announcement !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        {announcement && (
          <>
            <DialogHeader>
              <DialogTitle>Delivery report</DialogTitle>
              <DialogDescription>
                {announcement.sent_count} of {announcement.total_count} delivered
                {announcement.failed_count > 0 && ` · ${announcement.failed_count} failed`}
              </DialogDescription>
            </DialogHeader>
            {/* Rendered, not shown as source: the stored body is Telegram HTML,
                and staff should see the message the way recipients saw it. */}
            <div className="rounded-md bg-muted p-3 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:font-mono">
              {announcement.body ? (
                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderStoredBodyHtml(announcement.body)) }} />
              ) : (
                <span className="text-muted-foreground">(images only)</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcement.targets.map((target) => (
                    <TableRow key={target.id}>
                      <TableCell className="text-foreground">{target.label}</TableCell>
                      <TableCell className="text-muted-foreground">{target.kind}</TableCell>
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
