import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyLessonRequests } from '../services/api';
import type { LessonRequest } from '../types';
import { Loader2 } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  substitution: 'Substitution',
  reschedule: 'Reschedule',
  cancel: 'Cancellation',
};

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: 'Awaiting approval', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  pending_teacher: { label: 'Awaiting teacher', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
  approved: { label: 'Approved', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  rejected: { label: 'Rejected', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-muted-foreground' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function RequestDetail({ req }: { req: LessonRequest }) {
  if (req.request_type === 'reschedule' && req.new_datetime) {
    return (
      <span>
        Moved to <span className="text-foreground font-medium">{formatDateTime(req.new_datetime)}</span>
      </span>
    );
  }
  if (req.request_type === 'substitution') {
    const name = req.confirmed_teacher_name || req.substitute_teacher_name
      || req.substitute_teacher_names?.[0];
    return name
      ? <span>Covered by <span className="text-foreground font-medium">{name}</span></span>
      : <span>No substitute selected</span>;
  }
  if (req.reason) return <span>{req.reason}</span>;
  return <span>—</span>;
}

function RequestRow({ req }: { req: LessonRequest }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {TYPE_LABELS[req.request_type] ?? req.request_type}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="truncate font-medium">{req.group_name}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatDateTime(req.original_datetime)}
        </div>
        <div className="text-sm text-muted-foreground">
          <RequestDetail req={req} />
        </div>
      </div>
      <div className="shrink-0 pt-1">
        <StatusPill status={req.status} />
      </div>
    </div>
  );
}

function Section({ title, requests }: { title: string; requests: LessonRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">{requests.length}</span>
      </div>
      <div className="divide-y rounded-lg border bg-card">
        {requests.map((req) => (
          <RequestRow key={req.id} req={req} />
        ))}
      </div>
    </section>
  );
}

export default function MyLessonRequests() {
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setRequests(await getMyLessonRequests());
      } catch (error) {
        console.error('Failed to load requests:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = requests.filter((r) => r.status === 'pending' || r.status === 'pending_teacher');
  const resolved = requests.filter((r) => r.status === 'approved' || r.status === 'rejected');

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-8 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
        <p className="mt-1 text-muted-foreground">
          Substitution, reschedule and cancellation requests you've sent to your head teacher.
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-16 text-center">
          <p className="font-medium">No requests yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Open a lesson in your <Link to="/calendar" className="text-foreground underline underline-offset-4">calendar</Link> to
            request a substitute, reschedule, or cancellation.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Awaiting approval" requests={active} />
          <Section title="Resolved" requests={resolved} />
        </div>
      )}
    </div>
  );
}
