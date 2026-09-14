import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  RefreshCw,
  Search,
  Unlink,
  Video,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { toast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { errorMessage } from '../../components/announcements/shared';
import {
  connectRecordingTeacher,
  downloadWorkspaceImportCsv,
  getRecordingTeachers,
} from '../../services/api/recordingsAdmin';
import type { RecordingTeacher } from '../../services/api/recordingsAdmin';

/**
 * Admin → Lesson recordings rollout.
 *
 * Connecting stores the teacher's @mastereducation.kz Workspace account on their user
 * record; the scheduler then gives their upcoming lessons Meet rooms, records them, and
 * invites linked Telegram chats. Google accounts themselves are made in the Admin Console —
 * the CSV button exports the import file. The order matters: auto-recording only starts
 * once an organisation member joins, so the account must exist (and be signed into) before
 * the lesson, not after.
 */

type Filter = 'all' | 'pending' | 'connected';

export default function RecordingsTeachersPage() {
  const { user } = useAuth();
  const canWrite = user?.role === 'admin';

  const [teachers, setTeachers] = useState<RecordingTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [orgUnit, setOrgUnit] = useState('/');
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await getRecordingTeachers();
      setTeachers(rows);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (!(row.id in next)) {
            next[row.id] = row.workspace_email ?? row.suggested_workspace_email ?? '';
          }
        }
        return next;
      });
    } catch (error) {
      toast(errorMessage(error, 'Failed to load teachers'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = useMemo(() => teachers.filter((t) => !t.workspace_email), [teachers]);
  const connected = useMemo(() => teachers.filter((t) => t.workspace_email), [teachers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers
      .filter((t) =>
        filter === 'all' ? true : filter === 'pending' ? !t.workspace_email : !!t.workspace_email,
      )
      .filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          (t.workspace_email ?? '').includes(q),
      );
  }, [teachers, filter, search]);

  const connect = async (teacher: RecordingTeacher) => {
    const email = (drafts[teacher.id] ?? '').trim();
    if (!email) {
      toast('Enter the Workspace email first', 'error');
      return;
    }
    setBusyId(teacher.id);
    try {
      await connectRecordingTeacher(teacher.id, email);
      toast(`Connected ${teacher.name} — Meet rooms appear on the next scheduler tick`, 'success');
      await load();
    } catch (error) {
      toast(errorMessage(error, 'Failed to connect teacher'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (teacher: RecordingTeacher) => {
    if (!window.confirm(
      `Disconnect ${teacher.name}? Existing Meet links stay on their lessons, ` +
      'but no new rooms, invitations or recordings will be made.',
    )) {
      return;
    }
    setBusyId(teacher.id);
    try {
      await connectRecordingTeacher(teacher.id, null);
      toast(`Disconnected ${teacher.name}`, 'success');
      await load();
    } catch (error) {
      toast(errorMessage(error, 'Failed to disconnect teacher'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadWorkspaceImportCsv(orgUnit.trim() || '/');
    } catch (error) {
      toast(errorMessage(error, 'Failed to download the import CSV'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[90rem] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Video className="h-6 w-6" />
            Lesson recordings
          </h1>
          <p className="text-sm text-muted-foreground">
            Connect teachers to their @mastereducation.kz accounts so lessons get Meet rooms,
            recordings and Telegram invitations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Input
                value={orgUnit}
                onChange={(e) => setOrgUnit(e.target.value)}
                placeholder="Org unit path"
                title="Google Workspace org unit for the imported accounts"
                className="w-36"
              />
              <Button variant="outline" onClick={exportCsv} disabled={exporting || pending.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Google Admin CSV ({pending.length})
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Order matters — recording only starts once an organisation member joins the room.{' '}
          <strong>1)</strong> Download the CSV and bulk-create the accounts in Google Admin
          (right org unit, Meet recording on, license assigned). <strong>2)</strong> Each teacher
          signs in once to accept the terms. <strong>3)</strong> Connect them here — Meet rooms
          appear within ~5 minutes for the next 3 days of lessons; the rest roll forward
          automatically.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-border p-1">
          {(
            [
              ['all', `All (${teachers.length})`],
              ['pending', `Pending (${pending.length})`],
              ['connected', `Connected (${connected.length})`],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="w-64 pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[26rem]">Workspace email</TableHead>
              <TableHead className="text-center">Lessons (30d)</TableHead>
              <TableHead className="text-center">Rooms</TableHead>
              <TableHead>Groups</TableHead>
              {canWrite && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={canWrite ? 7 : 6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={canWrite ? 7 : 6} className="py-10 text-center text-muted-foreground">
                  No teachers match.
                </TableCell>
              </TableRow>
            )}
            {visible.map((teacher) => {
              const isBusy = busyId === teacher.id;
              return (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{teacher.name}</div>
                    <div className="text-xs text-muted-foreground">{teacher.email}</div>
                  </TableCell>
                  <TableCell>
                    {teacher.workspace_email ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {teacher.workspace_email ? (
                      <span className="text-sm text-foreground">{teacher.workspace_email}</span>
                    ) : canWrite ? (
                      <Input
                        value={drafts[teacher.id] ?? ''}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [teacher.id]: e.target.value }))
                        }
                        placeholder="name@mastereducation.kz"
                        className="h-8 font-mono text-xs"
                        disabled={isBusy}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{teacher.upcoming_lessons}</TableCell>
                  <TableCell className="text-center">{teacher.rooms_ready}</TableCell>
                  <TableCell>
                    {teacher.groups.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex max-w-md flex-wrap gap-1" title={teacher.groups.map((g) => g.name).join('\n')}>
                        {teacher.groups.map((g) => (
                          <span
                            key={g.id}
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ${
                              g.telegram_linked
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {g.name}
                            {!g.telegram_linked && ' · no chat'}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      {teacher.workspace_email ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnect(teacher)}
                          disabled={isBusy}
                        >
                          <Unlink className="mr-1 h-4 w-4" />
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => connect(teacher)}
                          disabled={isBusy}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Connect
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
