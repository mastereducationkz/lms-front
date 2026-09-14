import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Download, RefreshCw, Search, Video } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import ConfirmDialog from '../../components/ConfirmDialog';
import DirectoryCard from '../../components/recordingsAdmin/DirectoryCard';
import TeacherRolloutRow from '../../components/recordingsAdmin/TeacherRolloutRow';
import { toast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  accountState,
  draftIntent,
  duplicateAddresses,
  normaliseAddress,
  teacherInstructions,
  type AccountState,
  type Draft,
  type Intent,
} from '../../lib/workspaceRollout';
import {
  connectRecordingTeacher,
  downloadWorkspaceImport,
  getRecordingTeachers,
  getWorkspaceDirectory,
  skipRecordingTeacher,
  type RecordingTeacher,
  type WorkspaceDirectory,
} from '../../services/api/recordingsAdmin';

/**
 * Admin → Recordings Rollout: connecting teachers to their @mastereducation.kz accounts.
 *
 * Connecting stores the Workspace address on the user; the scheduler then gives their lessons
 * Meet rooms, records them and invites linked Telegram chats. Google accounts are created in the
 * Admin Console from the import this page downloads, and the uploaded Workspace users list is
 * how the page knows which accounts exist — Google's upload overwrites an existing account, so
 * an existing address is only ever connected, never imported.
 */

type Filter = 'pending' | 'connected' | 'skipped' | 'all';
const DEFAULT_ORG_UNIT = '/Teachers';

const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function RecordingsTeachersPage() {
  const { user } = useAuth();
  const canWrite = user?.role === 'admin';

  const [teachers, setTeachers] = useState<RecordingTeacher[]>([]);
  const [directory, setDirectory] = useState<WorkspaceDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [orgUnit, setOrgUnit] = useState(DEFAULT_ORG_UNIT);
  const [edits, setEdits] = useState<Record<number, Partial<Draft>>>({});
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<RecordingTeacher | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, dir] = await Promise.all([getRecordingTeachers(), getWorkspaceDirectory()]);
      setTeachers(rows);
      setDirectory(dir);
    } catch (error) {
      toast(message(error, 'Failed to load the rollout'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const directoryMap = useMemo(
    () => (directory?.uploaded_at ? new Map(directory.accounts.map((a) => [a.email, a])) : null),
    [directory],
  );
  const connectedTo = useMemo(
    () => new Map(teachers.filter((t) => t.workspace_email).map((t) => [t.workspace_email as string, t.name])),
    [teachers],
  );

  const draftOf = useCallback((t: RecordingTeacher): Draft => ({
    email: edits[t.id]?.email ?? t.workspace_email ?? t.suggested_workspace_email ?? '',
    firstName: edits[t.id]?.firstName ?? t.first_name,
    lastName: edits[t.id]?.lastName ?? t.last_name,
  }), [edits]);

  const pending = useMemo(() => teachers.filter((t) => !t.workspace_email && !t.skipped), [teachers]);

  // Per row: what the users list says, and what the buttons would do.
  const evaluation = useMemo(() => {
    const duplicates = duplicateAddresses(pending.map((t) => ({ id: t.id, email: draftOf(t).email })));
    const byId = new Map<number, { state: AccountState; intent: Intent | null }>();
    for (const t of teachers) {
      const draft = draftOf(t);
      if (t.workspace_email) {
        byId.set(t.id, { state: accountState(t.workspace_email, directoryMap, new Map()), intent: null });
        continue;
      }
      const state = accountState(draft.email, directoryMap, connectedTo);
      const intent: Intent = duplicates.has(t.id)
        ? { kind: 'blocked', reason: 'The same address is chosen for another teacher' }
        : draftIntent(draft, state);
      byId.set(t.id, { state, intent });
    }
    return byId;
  }, [teachers, pending, draftOf, directoryMap, connectedTo]);

  const chosen = pending.filter((t) => !deselected.has(t.id));
  const toImport = chosen.filter((t) => evaluation.get(t.id)?.intent?.kind === 'import');
  const toConnect = chosen.filter((t) => evaluation.get(t.id)?.intent?.kind === 'connect');

  const counts = {
    pending: pending.length,
    connected: teachers.filter((t) => t.workspace_email).length,
    skipped: teachers.filter((t) => t.skipped).length,
    all: teachers.length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers
      .filter((t) => filter === 'all'
        || (filter === 'pending' && !t.workspace_email && !t.skipped)
        || (filter === 'connected' && !!t.workspace_email)
        || (filter === 'skipped' && t.skipped))
      .filter((t) => !q || [t.name, t.official_full_name ?? '', t.email, draftOf(t).email, t.first_name, t.last_name]
        .some((value) => value.toLowerCase().includes(q)));
  }, [teachers, filter, search, draftOf]);

  const edit = (id: number, field: keyof Draft, value: string) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const toggle = (id: number) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisiblePending = visible.filter((t) => !t.workspace_email && !t.skipped);
  const allChosen = allVisiblePending.length > 0 && allVisiblePending.every((t) => !deselected.has(t.id));
  const toggleAll = () =>
    setDeselected((prev) => {
      const next = new Set(prev);
      for (const t of allVisiblePending) {
        if (allChosen) next.add(t.id);
        else next.delete(t.id);
      }
      return next;
    });

  const exportImport = async () => {
    setBusy('import');
    try {
      await downloadWorkspaceImport(orgUnit.trim() || DEFAULT_ORG_UNIT, toImport.map((t) => {
        const draft = draftOf(t);
        return {
          user_id: t.id,
          workspace_email: normaliseAddress(draft.email),
          first_name: draft.firstName.trim(),
          last_name: draft.lastName.trim(),
        };
      }));
      toast(`Import for ${toImport.length} new accounts downloaded. Upload it in Google Admin, then upload a fresh users list here.`, 'success');
    } catch (error) {
      toast(message(error, 'Failed to build the Google import'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const connectMany = async (rows: RecordingTeacher[]) => {
    setBusy('connect');
    let connected = 0;
    const failures: string[] = [];
    for (const t of rows) {
      try {
        await connectRecordingTeacher(t.id, normaliseAddress(draftOf(t).email));
        connected += 1;
      } catch (error) {
        failures.push(`${t.name}: ${message(error, 'failed')}`);
      }
    }
    if (connected) {
      toast(`Connected ${connected} teacher${connected === 1 ? '' : 's'} — Meet rooms appear within ~5 minutes for the next 3 days of lessons`, 'success');
    }
    if (failures.length) toast(failures.join('\n'), 'error');
    setBusy(null);
    await load();
  };

  const disconnect = async (teacher: RecordingTeacher) => {
    setDisconnecting(null);
    setBusy(`row:${teacher.id}`);
    try {
      await connectRecordingTeacher(teacher.id, null);
      toast(`Disconnected ${teacher.name}`, 'success');
      await load();
    } catch (error) {
      toast(message(error, 'Failed to disconnect'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const skip = async (teacher: RecordingTeacher) => {
    setBusy(`row:${teacher.id}`);
    try {
      await skipRecordingTeacher(teacher.id, !teacher.skipped);
      await load();
    } catch (error) {
      toast(message(error, 'Failed to update the teacher'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const copyInstructions = async (teacher: RecordingTeacher) => {
    const draft = draftOf(teacher);
    try {
      await navigator.clipboard.writeText(teacherInstructions(draft.firstName, normaliseAddress(draft.email)));
      toast('Instructions copied — fill in the temporary password from the import file before sending', 'success');
    } catch {
      toast('Could not copy to the clipboard', 'error');
    }
  };

  const columns = canWrite ? 8 : 6;

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Video className="h-6 w-6" />
            Recordings rollout
          </h1>
          <p className="text-sm text-muted-foreground">
            Connect teachers to their @mastereducation.kz accounts so lessons get Meet rooms, recordings and Telegram invitations.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <ol className="list-decimal space-y-1 rounded-md border border-sky-200 bg-sky-50 py-3 pl-8 pr-4 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
        <li>In Google Admin, download the users list (Directory → Users → Download users → CSV) and upload it below.</li>
        <li>Check each teacher's English name and address. Untick or skip anyone who should not get an account.</li>
        <li>Download the import for the <strong>new</strong> accounts and upload it in Google Admin → Users → Bulk update users. It never contains an existing address, so no account is overwritten.</li>
        <li>Send each teacher their address, the temporary password from the file and the copied instructions — they must sign in once before their next lesson.</li>
        <li>Upload a fresh users list, then Connect. Meet rooms appear within ~5 minutes for the next 3 days of lessons.</li>
      </ol>

      <DirectoryCard directory={directory} canWrite={canWrite} onUploaded={load} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-md border border-border p-1">
            {(['pending', 'connected', 'skipped', 'all'] as Filter[]).map((key) => (
              <button key={key} type="button" onClick={() => setFilter(key)}
                className={`rounded px-3 py-1 text-sm font-medium capitalize transition-colors ${
                  filter === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {key} ({counts[key]})
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="w-64 pl-9" />
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)} title="Org unit for the new accounts" className="w-32" />
            <Button variant="outline" onClick={exportImport} disabled={busy !== null || toImport.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Google import ({toImport.length} new)
            </Button>
            <Button onClick={() => connectMany(toConnect)} disabled={busy !== null || toConnect.length === 0}>
              <Check className="mr-2 h-4 w-4" />
              Connect ({toConnect.length} existing)
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {canWrite && (
                <TableHead className="w-8">
                  <Checkbox checked={allChosen} onCheckedChange={toggleAll} aria-label="Select all pending" disabled={allVisiblePending.length === 0} />
                </TableHead>
              )}
              <TableHead>Teacher</TableHead>
              <TableHead>English name</TableHead>
              <TableHead>Workspace account</TableHead>
              <TableHead className="text-center">Lessons (30d)</TableHead>
              <TableHead className="text-center">Rooms</TableHead>
              <TableHead>Groups</TableHead>
              {canWrite && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(loading && teachers.length === 0) || visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns} className="py-10 text-center text-muted-foreground">
                  {loading ? 'Loading…' : 'No teachers match.'}
                </TableCell>
              </TableRow>
            ) : visible.map((t) => {
              const row = evaluation.get(t.id);
              return (
                <TeacherRolloutRow
                  key={t.id}
                  teacher={t}
                  draft={draftOf(t)}
                  state={row?.state ?? { kind: 'unknown' }}
                  intent={row?.intent ?? null}
                  canWrite={canWrite}
                  selected={!deselected.has(t.id)}
                  busy={busy !== null}
                  onToggle={() => toggle(t.id)}
                  onEdit={(field, value) => edit(t.id, field, value)}
                  onConnect={() => connectMany([t])}
                  onDisconnect={() => setDisconnecting(t)}
                  onSkip={() => skip(t)}
                  onCopyInstructions={() => copyInstructions(t)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={disconnecting !== null}
        title={`Disconnect ${disconnecting?.name ?? ''}?`}
        description="Existing Meet links stay on their lessons, but no new rooms, invitations or recordings will be made for this teacher."
        confirmText="Disconnect"
        onConfirm={() => disconnecting && disconnect(disconnecting)}
        onCancel={() => setDisconnecting(null)}
      />
    </div>
  );
}
