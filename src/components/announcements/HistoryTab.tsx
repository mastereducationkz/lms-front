import { useCallback, useEffect, useState } from 'react';
import { Repeat2, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '../Toast';
import { DeliveryReportDialog } from './DeliveryReportDialog';
import { STATUS_LABELS, STATUS_STYLES, canRecall, errorMessage, formatDateTime } from './shared';
import { visibleText } from './telegramText';
import {
  cancelAnnouncement,
  getAnnouncement,
  getAnnouncements,
  recallAnnouncement,
} from '../../services/api/announcements';
import type { Announcement, AnnouncementDetail } from '../../services/api/announcements';

/** How often to refresh while a broadcast is still going out. */
const POLL_MS = 5000;

interface HistoryTabProps {
  onSendAgain: (announcement: AnnouncementDetail) => void;
}

export function HistoryTab({ onSendAgain }: HistoryTabProps) {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AnnouncementDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getAnnouncements();
      setRows(response.announcements);
    } catch (error) {
      toast(errorMessage(error, 'Failed to load announcements'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While anything is still in flight the rollup changes underneath us, so poll
  // rather than leave the sender staring at a stale "12/40 delivered".
  const inFlight = rows.some((row) => row.status === 'sending' || row.status === 'scheduled');
  useEffect(() => {
    if (!inFlight) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight, load]);

  const openDetail = async (id: number) => {
    try {
      setSelected(await getAnnouncement(id));
    } catch (error) {
      toast(errorMessage(error, 'Failed to load the announcement'), 'error');
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm('Cancel this scheduled announcement?')) return;
    setBusy(true);
    try {
      await cancelAnnouncement(id);
      toast('Announcement canceled', 'success');
      setSelected(null);
      load();
    } catch (error) {
      toast(errorMessage(error, 'Failed to cancel'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRecall = async (id: number) => {
    const confirmed = window.confirm(
      'Delete this announcement from every chat that still allows it? Messages older than about 48 hours cannot be removed.',
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const updated = await recallAnnouncement(id);
      setSelected(updated);
      const stuck = updated.targets.filter((t) => t.error?.startsWith('recall:')).length;
      toast(
        stuck > 0
          ? `Recalled, but ${stuck} chat${stuck > 1 ? 's' : ''} could not be cleared`
          : 'Announcement recalled',
        stuck > 0 ? 'info' : 'success',
      );
      load();
    } catch (error) {
      toast(errorMessage(error, 'Failed to recall'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendAgain = async (id: number) => {
    setBusy(true);
    try {
      onSendAgain(await getAnnouncement(id));
    } catch (error) {
      toast(errorMessage(error, 'Failed to load the announcement recipients'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const emptyRow = (text: string) => (
    <TableRow>
      <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0
                  ? emptyRow('Loading…')
                  : rows.length === 0
                    ? emptyRow('No announcements yet.')
                    : rows.map((row) => (
                        <TableRow key={row.id} className="cursor-pointer" onClick={() => openDetail(row.id)}>
                          <TableCell className="max-w-md">
                            {/* The stored body is Telegram HTML; a one-line summary
                                shows the words, not the tags. */}
                            <div className="truncate text-foreground">
                              {visibleText(row.body) || (
                                <span className="text-muted-foreground">(images only)</span>
                              )}
                            </div>
                            {row.images.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {row.images.length} image{row.images.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_STYLES[row.status]} variant="secondary">
                              {STATUS_LABELS[row.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={row.failed_count > 0 ? 'text-orange-600' : ''}>
                              {row.sent_count}/{row.total_count}
                            </span>
                            {row.failed_count > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({row.failed_count} failed)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.created_by_name || row.created_by_email}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateTime(row.scheduled_for || row.created_at)}
                          </TableCell>
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendAgain(row.id)}
                              disabled={busy}
                              aria-label="Send again to the same recipients"
                            >
                              <Repeat2 className="mr-1 h-4 w-4" />
                              Send again
                            </Button>
                            {row.status === 'scheduled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(row.id)}
                                disabled={busy}
                                aria-label="Cancel scheduled announcement"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canRecall(row) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRecall(row.id)}
                                disabled={busy}
                                aria-label="Recall announcement"
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DeliveryReportDialog announcement={selected} onClose={() => setSelected(null)} />
    </>
  );
}
