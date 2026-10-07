import { useCallback, useEffect, useState } from 'react';
import { Copy, Repeat2, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '../Toast';
import { DeliveryReportDialog } from './DeliveryReportDialog';
import { STATUS_LABELS, STATUS_STYLES, canRecall, errorMessage, formatDateTime } from './shared';
import { visibleText } from './telegramText';
import { copyAnnouncementHtml } from './announcementClipboard';
import {
  cancelAnnouncement,
  getAnnouncement,
  getAnnouncements,
  recallAnnouncement,
} from '../../services/api/announcements';
import type { Announcement, AnnouncementDetail } from '../../services/api/announcements';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

/** How often to refresh while a broadcast is still going out. */
const POLL_MS = 5000;

interface HistoryTabProps {
  onSendAgain: (announcement: AnnouncementDetail) => void;
}

export function HistoryTab({ onSendAgain }: HistoryTabProps) {
  const t = useT();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AnnouncementDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await getAnnouncements();
      setRows(response.announcements);
    } catch (error) {
      toast(errorMessage(error, t('announcements.history.loadFailed')), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      toast(errorMessage(error, t('announcements.history.loadOneFailed')), 'error');
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm(t('announcements.history.cancelConfirm'))) return;
    setBusy(true);
    try {
      await cancelAnnouncement(id);
      toast(t('announcements.history.canceled'), 'success');
      setSelected(null);
      load();
    } catch (error) {
      toast(errorMessage(error, t('announcements.history.cancelFailed')), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRecall = async (id: number) => {
    const confirmed = window.confirm(t('announcements.history.recallConfirm'));
    if (!confirmed) return;
    setBusy(true);
    try {
      const updated = await recallAnnouncement(id);
      setSelected(updated);
      const stuck = updated.targets.filter((target) => target.error?.startsWith('recall:')).length;
      toast(
        stuck > 0
          ? t('announcements.history.recalledPartly', { count: stuck })
          : t('announcements.history.recalled'),
        stuck > 0 ? 'info' : 'success',
      );
      load();
    } catch (error) {
      toast(errorMessage(error, t('announcements.history.recallFailed')), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendAgain = async (id: number) => {
    setBusy(true);
    try {
      onSendAgain(await getAnnouncement(id));
    } catch (error) {
      toast(errorMessage(error, t('announcements.history.loadRecipientsFailed')), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyMessage = async (body: string) => {
    try {
      await copyAnnouncementHtml(body);
      toast(t('announcements.history.copied'), 'success');
    } catch (error) {
      toast(errorMessage(error, t('announcements.history.copyFailed')), 'error');
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
                  <TableHead>{t('announcements.history.colMessage')}</TableHead>
                  <TableHead>{t('announcements.history.colStatus')}</TableHead>
                  <TableHead>{t('announcements.history.colDelivered')}</TableHead>
                  <TableHead>{t('announcements.history.colAuthor')}</TableHead>
                  <TableHead>{t('announcements.history.colWhen')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0
                  ? emptyRow(t('common.loading'))
                  : rows.length === 0
                    ? emptyRow(t('announcements.history.empty'))
                    : rows.map((row) => (
                        <TableRow key={row.id} className="cursor-pointer" onClick={() => openDetail(row.id)}>
                          <TableCell className="max-w-md">
                            {/* The stored body is Telegram HTML; a one-line summary
                                shows the words, not the tags. */}
                            <div className="truncate text-foreground">
                              {visibleText(row.body) || (
                                <span className="text-muted-foreground">{t('announcements.history.imagesOnly')}</span>
                              )}
                            </div>
                            {row.images.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {t('announcements.history.images', { count: row.images.length })}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_STYLES[row.status]} variant="secondary">
                              {t(STATUS_LABELS[row.status])}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={row.failed_count > 0 ? 'text-orange-600' : ''}>
                              {row.sent_count}/{row.total_count}
                            </span>
                            {row.failed_count > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                {t('announcements.history.failedCount', { count: row.failed_count })}
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
                              onClick={() => handleCopyMessage(row.body)}
                              disabled={busy || !row.body}
                              aria-label={t('announcements.history.copyAsHtml')}
                            >
                              <Copy className="mr-1 h-4 w-4" />
                              {t('announcements.history.copyMessage')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendAgain(row.id)}
                              disabled={busy}
                              aria-label={t('announcements.history.sendAgainLabel')}
                            >
                              <Repeat2 className="mr-1 h-4 w-4" />
                              {t('announcements.history.sendAgain')}
                            </Button>
                            {row.status === 'scheduled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(row.id)}
                                disabled={busy}
                                aria-label={t('announcements.history.cancelLabel')}
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
                                aria-label={t('announcements.history.recallLabel')}
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
