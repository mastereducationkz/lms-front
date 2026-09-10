import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { SearchableSelect } from '../ui/searchable-select';
import { clock } from '../../lib/meetAttendance';
import type { MeetCandidate, MeetIdentity, MeetUnknownAccount } from '../../services/api/meetAttendance';

interface Props {
  accounts: MeetUnknownAccount[];
  candidates: MeetCandidate[];
  busyId: number | null;
  onConfirm: (participantId: number, identity: MeetIdentity) => void;
}

const KIND: Record<MeetUnknownAccount['kind'], string> = {
  signed_in: 'Google account',
  guest: 'Guest (not signed in)',
  phone: 'Phone',
};

function AccountRow({ account, candidates, busy, onConfirm }: {
  account: MeetUnknownAccount;
  candidates: MeetCandidate[];
  busy: boolean;
  onConfirm: Props['onConfirm'];
}) {
  const [choice, setChoice] = useState<string | null>(account.suggestion ? String(account.suggestion.user_id) : null);
  useEffect(() => {
    setChoice(account.suggestion ? String(account.suggestion.user_id) : null);
  }, [account.participant_id, account.suggestion]);

  const options = candidates.map((c) => ({
    value: String(c.user_id),
    label: c.name,
    hint: c.role === 'teacher' ? 'teacher' : undefined,
  }));
  const suggested = account.suggestion && choice === String(account.suggestion.user_id);

  return (
    <li className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="flex min-w-0 items-start gap-2">
        <HelpCircle className="mt-0.5 h-4 w-4 flex-none text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground" title={account.display_name ?? undefined}>
            {account.display_name || 'No name shown'}
          </div>
          <div className="text-xs text-muted-foreground">
            {KIND[account.kind]} · {clock(account.first_join)}–{clock(account.last_leave)} · {account.minutes_in_lesson} min in the lesson
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
        <SearchableSelect
          options={options}
          value={choice}
          onChange={setChoice}
          placeholder="Who is this?"
          searchPlaceholder="Search this lesson's people…"
          emptyText="No one matches"
          disabled={busy}
          className="h-8 w-52 text-xs"
        />
        <button
          type="button"
          disabled={!choice || busy}
          onClick={() => choice && onConfirm(account.participant_id, { user_id: Number(choice) })}
          className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirm(account.participant_id, { not_a_student: true })}
          className="h-8 rounded-md px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          Not a student
        </button>
        {suggested && <span className="text-[11px] text-amber-700 dark:text-amber-300">Suggested from the name</span>}
      </div>
      <p className="mt-1.5 pl-6 text-[11px] text-muted-foreground">
        {account.kind === 'signed_in'
          ? 'Confirmed once, this account is recognised in every lesson.'
          : 'A guest can only be matched for this lesson.'}
      </p>
    </li>
  );
}

/** The accounts nobody has named yet, each with a suggestion and one-click confirm. */
export function WhoIsThis({ accounts, candidates, busyId, onConfirm }: Props) {
  if (accounts.length === 0) return null;
  return (
    <section aria-label="Accounts to confirm">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Who is this? · {accounts.length}
      </h4>
      <ul className="flex flex-col gap-2">
        {accounts.map((a) => (
          <AccountRow
            key={a.participant_id}
            account={a}
            candidates={candidates}
            busy={busyId !== null}
            onConfirm={onConfirm}
          />
        ))}
      </ul>
    </section>
  );
}
