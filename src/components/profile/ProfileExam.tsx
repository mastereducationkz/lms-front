/**
 * Profile: the student's exam date(s) — the same planned date the dashboard counts down to and
 * curators follow up on — editable wherever the backend says so (can_edit). Shows nothing for a
 * student without an exam track.
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import apiClient from '@/services/api';
import type { ExamCountdown, ExamInfo, ExamKind } from '@/services/api/assignment-zero';
import { Button } from '@/components/ui/button';
import ExamDateDialog, { EXAM_LABEL } from '@/components/exams/ExamDateDialog';
import { formatDate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/profile';

function ExamRow({ kind, info, onEdit }: { kind: ExamKind; info: ExamInfo | undefined; onEdit: () => void }) {
  const t = useT();
  const date = info?.target_date ?? null;
  // days_left comes from the server, counted on the school's calendar.
  const days = date ? info?.days_left ?? null : null;
  const when = days === null ? null : days > 0 ? t('profile.exam.in', { count: days }) : days === 0 ? t('profile.exam.today') : t('profile.exam.passed');
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-xs font-bold tracking-wide text-brand-subtle-foreground">
        {EXAM_LABEL[kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">
          {date ? formatDate(date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : t('profile.exam.notSet')}
        </p>
        {when && <p className="text-sm text-muted-foreground">{when}</p>}
        {info?.source === 'nearest_official' && info.can_edit && (
          <p className="mt-0.5 text-xs text-muted-foreground">{t('profile.exam.nearestOfficial')}</p>
        )}
      </div>
      {info?.can_edit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          {date && info.source === 'planned' ? t('profile.exam.change') : t('profile.exam.set')}
        </Button>
      )}
    </div>
  );
}

export default function ProfileExam() {
  const t = useT();
  const [data, setData] = useState<ExamCountdown | null>(null);
  const [editing, setEditing] = useState<ExamKind | null>(null);

  const load = useCallback(() => {
    apiClient.getExamCountdown().then(setData).catch(() => setData(null));
  }, []);
  useEffect(load, [load]);

  if (!data || !data.applicable || data.available_exams.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm @lg:p-6" aria-labelledby="profile-exam-title">
      <h2 id="profile-exam-title" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarDays className="h-4 w-4" aria-hidden />
        {t('profile.exam.title')}
      </h2>
      <div className="mt-4 space-y-4">
        {data.available_exams.map((kind) => (
          <ExamRow key={kind} kind={kind} info={data.exams[kind]} onEdit={() => setEditing(kind)} />
        ))}
      </div>
      {editing && (
        <ExamDateDialog
          open
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          kind={editing}
          current={data.exams[editing]?.target_date}
          officialDates={data.sat_official_dates ?? []}
          onSaved={load}
        />
      )}
    </section>
  );
}
