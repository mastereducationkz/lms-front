import { Check, Copy, Undo2, Unlink, UserX } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { TableCell, TableRow } from '../ui/table';
import type { AccountState, Draft, Intent } from '../../lib/workspaceRollout';
import type { RecordingTeacher } from '../../services/api/recordingsAdmin';

interface Props {
  teacher: RecordingTeacher;
  draft: Draft;
  state: AccountState;
  /** Only for pending teachers: what Connect / the import would do. */
  intent: Intent | null;
  canWrite: boolean;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: (field: keyof Draft, value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSkip: () => void;
  onCopyInstructions: () => void;
}

const CHIP = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium';
const TONES = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function AccountChip({ state }: { state: AccountState }) {
  const [tone, label] = ((): [keyof typeof TONES, string] => {
    switch (state.kind) {
      case 'exists':
        if (state.signedIn === false) return ['amber', 'Account exists · never signed in'];
        return ['green', state.signedIn ? 'Account exists · signed in' : 'Account exists'];
      case 'new':
        return ['sky', 'New account → import'];
      case 'suspended':
        return ['red', 'Suspended in Workspace'];
      case 'taken':
        return ['red', `Connected to ${state.by}`];
      default:
        return ['gray', 'Not checked — no users list'];
    }
  })();
  return <span className={`${CHIP} ${TONES[tone]}`}>{label}</span>;
}

export default function TeacherRolloutRow({
  teacher, draft, state, intent, canWrite, selected, busy,
  onToggle, onEdit, onConnect, onDisconnect, onSkip, onCopyInstructions,
}: Props) {
  const connected = !!teacher.workspace_email;
  const editable = canWrite && !connected && !teacher.skipped;
  const official = teacher.official_full_name && teacher.official_full_name !== teacher.name
    ? teacher.official_full_name : null;
  const blockedReason = intent?.kind === 'blocked' && state.kind !== 'unknown' ? intent.reason : null;
  const showSimilar = !connected && state.kind === 'new' && teacher.similar_accounts.length > 0;

  return (
    <TableRow className={teacher.skipped ? 'opacity-60' : undefined}>
      {canWrite && (
        <TableCell className="w-8">
          {editable && <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${teacher.name}`} />}
        </TableCell>
      )}
      <TableCell className="min-w-[12rem]">
        <div className="font-medium text-foreground">{teacher.name}</div>
        {official && <div className="text-xs text-muted-foreground">{official}</div>}
        <div className="text-xs text-muted-foreground">{teacher.email}</div>
        {teacher.skipped && <span className={`${CHIP} ${TONES.gray} mt-1`}>Skipped</span>}
      </TableCell>
      <TableCell className="min-w-[14rem]">
        {editable ? (
          <div className="flex gap-1">
            <Input value={draft.firstName} onChange={(e) => onEdit('firstName', e.target.value)}
              placeholder="First name" className="h-8 text-xs" disabled={busy} aria-label="First name" />
            <Input value={draft.lastName} onChange={(e) => onEdit('lastName', e.target.value)}
              placeholder="Last name" className="h-8 text-xs" disabled={busy} aria-label="Last name" />
          </div>
        ) : (
          <span className="text-sm text-foreground">{`${draft.firstName} ${draft.lastName}`.trim() || '—'}</span>
        )}
      </TableCell>
      <TableCell className="min-w-[18rem] space-y-1">
        {editable ? (
          <Input value={draft.email} onChange={(e) => onEdit('email', e.target.value)}
            placeholder="name@mastereducation.kz" className="h-8 font-mono text-xs" disabled={busy}
            aria-label="Workspace email" />
        ) : (
          <div className="font-mono text-xs text-foreground">{teacher.workspace_email ?? (draft.email || '—')}</div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {connected && teacher.account.status === 'missing' ? (
            <span className={`${CHIP} ${TONES.amber}`}>Not in the uploaded users list</span>
          ) : (
            <AccountChip state={state} />
          )}
        </div>
        {showSimilar && (
          <div className="text-[11px] text-amber-700 dark:text-amber-400">
            Existing account with this first name: {teacher.similar_accounts.join(', ')} — same person?
          </div>
        )}
        {blockedReason && <div className="text-[11px] text-red-600 dark:text-red-400">{blockedReason}</div>}
      </TableCell>
      <TableCell className="text-center">{teacher.upcoming_lessons}</TableCell>
      <TableCell className="text-center">{teacher.rooms_ready}</TableCell>
      <TableCell>
        {teacher.groups.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex max-w-xs flex-wrap gap-1" title={teacher.groups.map((g) => g.name).join('\n')}>
            {teacher.groups.map((g) => (
              <span key={g.id} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ${
                g.telegram_linked ? TONES.gray : TONES.amber}`}>
                {g.name}
                {!g.telegram_linked && ' · no chat'}
              </span>
            ))}
          </div>
        )}
      </TableCell>
      {canWrite && (
        <TableCell className="text-right">
          <div className="flex flex-wrap justify-end gap-1">
            {connected && (
              <Button variant="ghost" size="sm" onClick={onDisconnect} disabled={busy}>
                <Unlink className="mr-1 h-4 w-4" />Disconnect
              </Button>
            )}
            {editable && (
              <Button size="sm" onClick={onConnect} disabled={busy || intent?.kind !== 'connect'}
                title={intent?.kind === 'import' ? 'Create the account with the Google import first' : undefined}>
                <Check className="mr-1 h-4 w-4" />Connect
              </Button>
            )}
            {(connected || state.kind === 'exists' || state.kind === 'new') && !teacher.skipped && (
              <Button variant="ghost" size="sm" onClick={onCopyInstructions} title="Copy instructions for the teacher">
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {!connected && (
              <Button variant="ghost" size="sm" onClick={onSkip} disabled={busy}
                title={teacher.skipped ? 'Include in the rollout again' : 'Leave out of the rollout'}>
                {teacher.skipped ? <Undo2 className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
