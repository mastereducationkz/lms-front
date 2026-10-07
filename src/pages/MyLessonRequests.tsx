import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyLessonRequests } from '../services/api';
import type { LessonRequest } from '../types';
import { formatDateTime, type MessageKey } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/chatLive';
import '@/lib/i18n/catalogs/lessonRequests';
import { Loader2 } from 'lucide-react';

const TYPE_LABELS: Record<string, MessageKey> = {
  substitution: 'lessonRequests.type.substitution',
  reschedule: 'lessonRequests.type.reschedule',
  cancel: 'lessonRequests.type.cancel',
};

const STATUS_META: Record<string, { label: MessageKey; dot: string; text: string }> = {
  pending: { label: 'chatLive.requests.status.pending', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  pending_teacher: { label: 'chatLive.requests.status.pendingTeacher', dot: 'bg-brand-solid', text: 'text-brand-subtle-foreground' },
  approved: { label: 'lessonRequests.status.approved', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  rejected: { label: 'lessonRequests.status.rejected', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
};

function StatusPill({ status }: { status: string }) {
  const t = useT();
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta?.text ?? 'text-muted-foreground'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta?.dot ?? 'bg-gray-400'}`} />
      {meta ? t(meta.label) : status}
    </span>
  );
}

function RequestDetail({ req }: { req: LessonRequest }) {
  const t = useT();
  if (req.request_type === 'reschedule' && req.new_datetime) {
    return (
      <span>
        {t('chatLive.requests.movedTo')} <span className="text-foreground font-medium">{formatDateTime(req.new_datetime)}</span>
      </span>
    );
  }
  if (req.request_type === 'substitution') {
    const name = req.confirmed_teacher_name || req.substitute_teacher_name
      || req.substitute_teacher_names?.[0];
    return name
      ? <span>{t('chatLive.requests.coveredBy')} <span className="text-foreground font-medium">{name}</span></span>
      : <span>{t('chatLive.requests.noSubstitute')}</span>;
  }
  // An approved cancel carries the head teacher's decision: the lesson simply disappeared,
  // or one lesson was appended to the end of the course — and, if so, when.
  if (req.request_type === 'cancel' && req.status === 'approved' && req.cancel_resolution) {
    const reason = req.reason ? <span> · {req.reason}</span> : null;
    if (req.cancel_resolution === 'add_replacement') {
      return (
        <span>
          {req.replacement_datetime ? (
            <>{t('chatLive.requests.cancelledReplacedOn')} <span className="text-foreground font-medium">{formatDateTime(req.replacement_datetime)}</span></>
          ) : t('chatLive.requests.cancelledReplaced')}
          {reason}
        </span>
      );
    }
    return <span>{t('chatLive.requests.cancelledOnly')}{reason}</span>;
  }
  if (req.reason) return <span>{req.reason}</span>;
  return <span>—</span>;
}

function RequestRow({ req }: { req: LessonRequest }) {
  const t = useT();
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {TYPE_LABELS[req.request_type] ? t(TYPE_LABELS[req.request_type]) : req.request_type}
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
  const t = useT();
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
        <h1 className="text-2xl font-semibold tracking-tight">{t('chatLive.requests.title')}</h1>
        <p className="mt-1 text-muted-foreground">
          {t('chatLive.requests.subtitle')}
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-16 text-center">
          <p className="font-medium">{t('chatLive.requests.empty')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {t('chatLive.requests.emptyBefore')}{' '}
            <Link to="/calendar" className="text-foreground underline underline-offset-4">{t('chatLive.requests.emptyLink')}</Link>
            {t('chatLive.requests.emptyAfter')}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section title={t('chatLive.requests.sectionPending')} requests={active} />
          <Section title={t('chatLive.requests.sectionResolved')} requests={resolved} />
        </div>
      )}
    </div>
  );
}
