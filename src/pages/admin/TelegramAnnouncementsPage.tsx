import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Megaphone, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/Toast';
import { ComposeTab } from '../../components/announcements/ComposeTab';
import { GroupsTab } from '../../components/announcements/GroupsTab';
import { HistoryTab } from '../../components/announcements/HistoryTab';
import { LessonInvitationsTab } from '../../components/announcements/LessonInvitationsTab';
import { errorMessage } from '../../components/announcements/shared';
import { recipientSelectionFromAnnouncement } from '../../components/announcements/resend';
import { getGroups, getRecipientSummary } from '../../services/api/announcements';
import type { AnnouncementDetail, RecipientSummary, TelegramGroup } from '../../services/api/announcements';
import type { RecipientSelection } from '../../components/announcements/resend';

/**
 * Admin → Telegram Announcements.
 *
 * A thin shell: the header, the tab bar, and the group list the tabs share. The
 * tabs themselves live in src/components/announcements/. Nothing here decides
 * what gets sent — that is ComposeTab's job — and nothing here talks to
 * Telegram: every call goes through lms-backend's role-gated proxy to the
 * Support platform, which owns the bot.
 */

type Tab = 'compose' | 'history' | 'groups' | 'invitations';

const TABS: { key: Tab; label: string }[] = [
  { key: 'compose', label: 'Compose' },
  { key: 'history', label: 'History' },
  { key: 'groups', label: 'Groups' },
  { key: 'invitations', label: 'Lesson invitations' },
];

export default function TelegramAnnouncementsPage() {
  const [tab, setTab] = useState<Tab>('compose');

  // Shared across tabs: the composer needs the approved groups as targets, and
  // the Groups tab manages the same list.
  const [groups, setGroups] = useState<TelegramGroup[]>([]);
  const [summary, setSummary] = useState<RecipientSummary | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [recipientSelection, setRecipientSelection] = useState<RecipientSelection | undefined>();
  // A copied selection must initialise a fresh composer rather than overwrite
  // an announcement the staff member is already writing.
  const [composeVersion, setComposeVersion] = useState(0);

  const loadGroups = useCallback(async () => {
    try {
      const [groupRows, counts] = await Promise.all([getGroups(), getRecipientSummary()]);
      setGroups(groupRows);
      setSummary(counts);
    } catch (error) {
      toast(errorMessage(error, 'Failed to load Telegram groups'), 'error');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Only approved groups the bot is still in can receive anything.
  const approvedGroups = useMemo(
    () => groups.filter((group) => group.status === 'approved' && group.is_active),
    [groups],
  );
  const pendingCount = useMemo(
    () => groups.filter((group) => group.status === 'pending').length,
    [groups],
  );

  const startAgain = (announcement: AnnouncementDetail) => {
    setRecipientSelection(recipientSelectionFromAnnouncement(announcement, approvedGroups));
    setComposeVersion((version) => version + 1);
    setTab('compose');
  };

  return (
    <div className="mx-auto max-w-[90rem] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Megaphone className="h-6 w-6" />
            Telegram Announcements
          </h1>
          <p className="text-sm text-muted-foreground">
            Broadcast to the groups the support bot belongs to, and to students who linked their
            Telegram account.
          </p>
        </div>
        <Button variant="outline" onClick={loadGroups} disabled={loadingGroups}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loadingGroups ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {pendingCount > 0 && tab !== 'groups' && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {pendingCount} group{pendingCount > 1 ? 's are' : ' is'} waiting for approval and cannot
            receive announcements yet.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setTab('groups')}>
            Review
          </Button>
        </div>
      )}

      <div className="flex gap-2 border-b border-border" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            onClick={() => setTab(entry.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === entry.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {entry.label}
            {entry.key === 'groups' && pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'compose' && (
        <ComposeTab
          key={composeVersion}
          approvedGroups={approvedGroups}
          summary={summary}
          recipientSelection={recipientSelection}
          onSent={() => {
            setRecipientSelection(undefined);
            setComposeVersion((version) => version + 1);
            setTab('history');
          }}
        />
      )}
      {tab === 'history' && <HistoryTab onSendAgain={startAgain} />}
      {tab === 'groups' && <GroupsTab groups={groups} loading={loadingGroups} onChanged={loadGroups} />}
      {tab === 'invitations' && <LessonInvitationsTab />}
    </div>
  );
}
