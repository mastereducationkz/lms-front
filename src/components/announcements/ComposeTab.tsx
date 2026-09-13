import { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { toast } from '../Toast';
import { ConfirmSendDialog } from './ConfirmSendDialog';
import { MessageEditor } from './MessageEditor';
import { RecipientPicker } from './RecipientPicker';
import { SendOptions } from './SendOptions';
import { TestSendCard } from './TestSendCard';
import { errorMessage } from './shared';
import { MAX_IMAGES, TEXT_LIMIT, visibleLength, visibleText } from './telegramText';
import { createAnnouncement, testSendPreview } from '../../services/api/announcements';
import type { RecipientSummary, TelegramGroup } from '../../services/api/announcements';
import type { RecipientSelection } from './resend';

interface ComposeTabProps {
  approvedGroups: TelegramGroup[];
  summary: RecipientSummary | null;
  /** Recipient selection copied from a History entry; message content stays blank. */
  recipientSelection?: RecipientSelection;
  onSent: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Owns the composition and decides when it may go out. The cards it lays out
 * are presentational; everything that determines WHAT is sent and to WHOM —
 * validation, the payload, the recipient count — lives here, in one place.
 */
export function ComposeTab({ approvedGroups, summary, recipientSelection, onSent }: ComposeTabProps) {
  const [body, setBody] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<number>>(
    () => new Set(recipientSelection?.groupIds ?? []),
  );
  const [allStudents, setAllStudents] = useState(recipientSelection?.allStudents ?? false);
  const [pin, setPin] = useState(false);
  const [silent, setSilent] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [testing, setTesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Counted against the CURRENT approved list, not the raw selection. A group
  // removed between loading the page and pressing Refresh is dropped by the
  // server, and counting it here would make the confirm dialog promise a
  // recipient that never ships.
  const selectedApproved = useMemo(
    () => approvedGroups.filter((group) => selectedGroups.has(group.id)),
    [approvedGroups, selectedGroups],
  );
  const groupCount = selectedApproved.length;
  const studentCount = allStudents ? summary?.students_opted_in ?? 0 : 0;
  const recipientCount = groupCount + studentCount;
  const hasContent = visibleText(body).trim() !== '' || images.length > 0;

  const validate = (): string | null => {
    if (!hasContent) return 'Write a message or attach an image';
    if (visibleLength(body) > TEXT_LIMIT) return `Text is limited to ${TEXT_LIMIT} characters`;
    if (images.length > MAX_IMAGES) return `Telegram allows at most ${MAX_IMAGES} images`;
    if (recipientCount === 0) return 'Select at least one group, or all linked students';
    if (scheduledFor && new Date(scheduledFor).getTime() <= Date.now()) {
      return 'The scheduled time is in the past';
    }
    return null;
  };

  const buildPayload = () => ({
    body: body.trim(),
    target_group_ids: selectedApproved.map((group) => group.id),
    target_all_students: allStudents,
    pin,
    silent,
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
  });

  const handleTestSend = async (chatId: number) => {
    if (!hasContent) {
      toast('Write a message or attach an image first', 'error');
      return;
    }
    setTesting(true);
    try {
      const result = await testSendPreview({ ...buildPayload(), test_chat_id: chatId }, images);
      if (result.ok) toast('Test sent — check the group', 'success');
      else toast(result.error || 'Test send failed', 'error');
    } catch (error) {
      toast(errorMessage(error, 'Test send failed'), 'error');
    } finally {
      setTesting(false);
    }
  };

  const openConfirm = () => {
    const problem = validate();
    if (problem) {
      toast(problem, 'error');
      return;
    }
    setConfirmOpen(true);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await createAnnouncement(buildPayload(), images);
      toast(
        `${scheduledFor ? 'Scheduled for' : 'Sending to'} ${plural(recipientCount, 'recipient')}`,
        'success',
      );
      setConfirmOpen(false);
      // History takes over from here; this tab unmounts, so its state resets.
      onSent();
    } catch (error) {
      toast(errorMessage(error, 'Failed to send the announcement'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <MessageEditor
          body={body}
          onBodyChange={setBody}
          images={images}
          onImagesChange={setImages}
        />
        <RecipientPicker
          approvedGroups={approvedGroups}
          summary={summary}
          selectedGroups={selectedGroups}
          onSelectedGroupsChange={setSelectedGroups}
          allStudents={allStudents}
          onAllStudentsChange={setAllStudents}
          pin={pin}
        />
      </div>

      <div className="space-y-6">
        <SendOptions
          pin={pin}
          onPinChange={setPin}
          silent={silent}
          onSilentChange={setSilent}
          scheduledFor={scheduledFor}
          onScheduledForChange={setScheduledFor}
        />
        <TestSendCard testing={testing} onTestSend={handleTestSend} />
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="text-sm text-muted-foreground">
              Will reach <span className="font-semibold text-foreground">{recipientCount}</span>{' '}
              recipient{recipientCount === 1 ? '' : 's'}
              {groupCount > 0 && studentCount > 0 && (
                <> ({plural(groupCount, 'group')}, {plural(studentCount, 'student')})</>
              )}
            </div>
            <Button className="w-full" onClick={openConfirm} disabled={sending}>
              <Send className="mr-2 h-4 w-4" />
              {scheduledFor ? 'Schedule' : 'Send now'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmSendDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        scheduled={!!scheduledFor}
        groupCount={groupCount}
        studentCount={studentCount}
        sending={sending}
        onConfirm={handleSend}
      />
    </div>
  );
}
