import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';
import { openPlatformPage, type PlatformTrack } from '../../lib/platformLinks';
import {
  formatAlmaty,
  getPlatformProgress,
  isPlatformTestMatrix,
  type PlatformModuleProgress,
  type PlatformTestMatrix,
  type PlatformTestProgress,
} from '../../services/api/platformTests';
import type { Assignment } from '../../types/index.ts';
import { activeLocale, t as tr, type Locale } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/homework';

/**
 * A "platform_test" assignment: the weekly test lives on the exam platform (IELTS), the LMS
 * shows one checkmark per part and opens each part through the signed handoff link.
 * Students see their own checklist; group staff see the whole group.
 */

// Exam section names stay as the platform and the official reports print them.
const MODULE_LABEL: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
  math: 'Math',
  verbal: 'Verbal',
  nuet: 'NUET',
};

const moduleLabel = (module: string) => MODULE_LABEL[module] ?? module;
// The LMS program decides the bare host (NUET lives on the SAT platform under its own host).
const trackOf = (platform: string, track?: string | null): PlatformTrack =>
  track === 'nuet' ? 'nuet' : track === 'sat' || platform === 'sat' ? 'sat' : 'ielts';

function StateBadge({ state, band }: { state: PlatformModuleProgress['state']; band: number | null }) {
  const t = useT();
  if (state === 'done') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {band != null ? (band > 9 ? t('homework.platform.doneEstimate', { score: band }) : t('homework.platform.doneBand', { band })) : t('homework.platform.done')}
      </Badge>
    );
  }
  if (state === 'in_progress') {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 gap-1">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {t('homework.status.inProgress')}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Circle className="h-3.5 w-3.5" aria-hidden="true" />
      {t('homework.status.notStarted')}
    </Badge>
  );
}

function deadlineLine(progress: Pick<PlatformTestProgress, 'date_from' | 'date_to' | 'modules'>, locale: Locale = activeLocale()): string {
  const parts: string[] = [];
  if (progress.date_to) parts.push(tr('homework.platform.due', { date: formatAlmaty(progress.date_to, true, locale) }, locale));
  const speaking = progress.modules.find((m) => m.module === 'speaking');
  if (speaking && progress.date_to) {
    parts.push(tr('homework.platform.speakingCloses', { date: formatAlmaty(progress.date_to, true, locale) }, locale));
  }
  return parts.join(' · ');
}

function ModuleRow({ module, track, canOpen }: { module: PlatformModuleProgress; track: PlatformTrack; canOpen: boolean }) {
  const t = useT();
  const hint = !module.available
    ? t('homework.platform.onlyInWindow')
    : module.state === 'done'
      ? t('homework.platform.stillOpen')
      : undefined;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="font-medium">{moduleLabel(module.module)}</p>
        <p className="text-xs text-muted-foreground truncate">
          {module.test_title ?? ''}
          {module.deadline_kind === 'closes' ? ` · ${t('homework.platform.closesAtDeadline')}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StateBadge state={module.state} band={module.band} />
        {canOpen && module.result_url && (
          <Button size="sm" variant="outline" onClick={() => void openPlatformPage(track, module.result_url ?? '/')}>
            {t('homework.platform.result')}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {canOpen && module.path && (
          <Button
            size="sm"
            variant={module.state === 'done' ? 'ghost' : 'default'}
            disabled={!module.available}
            title={hint}
            onClick={() => void openPlatformPage(track, module.path ?? '/')}
          >
            {module.state === 'in_progress' ? t('homework.platform.continue') : t('homework.platform.open')}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}

function StudentView({ progress }: { progress: PlatformTestProgress }) {
  const t = useT();
  const locale = useLocale();
  const track = trackOf(progress.platform, (progress as { track?: string }).track);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{progress.title}</CardTitle>
            <CardDescription>{deadlineLine(progress, locale)}</CardDescription>
          </div>
          <Badge variant={progress.status === 'submitted' ? 'default' : 'secondary'}>
            {progress.status === 'submitted' ? t('homework.platform.allPartsDone') : progress.status === 'in_progress' ? t('homework.status.inProgress') : t('homework.status.notStarted')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {progress.modules.map((m) => (
            <ModuleRow key={m.module} module={m} track={track} canOpen />
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {progress.modules.some((m) => m.module === 'speaking')
            ? t('homework.platform.hintIelts')
            : t('homework.platform.hintSat')}
        </p>
        {progress.set_path && (
        <Button variant="link" className="px-0" onClick={() => void openPlatformPage(track, progress.set_path ?? '/')}>
          {t('homework.platform.openWeeklySet')}
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StaffView({ matrix }: { matrix: PlatformTestMatrix }) {
  const t = useT();
  const locale = useLocale();
  const modules = matrix.students[0]?.modules.map((m) => m.module) ?? [];
  const mark = (m: PlatformModuleProgress) =>
    m.state === 'done' ? (
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" aria-label={t('homework.platform.done')} />
        {m.band != null ? m.band : null}
      </span>
    ) : m.state === 'in_progress' ? (
      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-label={t('homework.status.inProgress')} />
    ) : (
      <span aria-label={t('homework.status.notStarted')}>—</span>
    );
  const done = matrix.students.filter((s) => s.status === 'submitted').length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{matrix.assignment.title}</CardTitle>
        <CardDescription>
          {deadlineLine({ ...matrix.assignment, modules: [] }, locale)} · {t('homework.platform.studentsDone', { done, total: matrix.students.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{t('homework.platform.colStudent')}</th>
                {modules.map((m) => (
                  <th key={m} className="py-2 pr-4 font-medium">{moduleLabel(m)}</th>
                ))}
                <th className="py-2 font-medium">{t('homework.platform.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {matrix.students.map((s) => (
                <tr key={s.user_id} className="border-t border-border">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </td>
                  {s.modules.map((m) => (
                    <td key={m.module} className="py-2 pr-4 tabular-nums">{mark(m)}</td>
                  ))}
                  <td className="py-2">
                    {s.status === 'submitted' ? t('homework.platform.done') : s.status === 'in_progress' ? t('homework.status.inProgress') : t('homework.status.notStarted')}
                  </td>
                </tr>
              ))}
              {matrix.students.length === 0 && (
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={modules.length + 2}>{t('homework.platform.noStudents')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformTestPanel({ assignment }: { assignment: Assignment }) {
  const { user } = useAuth();
  const t = useT();
  const [data, setData] = useState<PlatformTestProgress | PlatformTestMatrix | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'off' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getPlatformProgress(assignment.id)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        setState(status === 503 ? 'off' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [assignment.id, user?.id]);

  const content = (assignment.content ?? {}) as { platform?: string; track?: string; set_path?: string };
  const track = trackOf(content.platform ?? 'ielts', content.track);

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t('homework.platform.loading')}
      </div>
    );
  }
  if (state === 'off' || state === 'error' || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{assignment.title}</CardTitle>
          <CardDescription>
            {state === 'off'
              ? t('homework.platform.notEnabled')
              : t('homework.platform.loadFailed')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void openPlatformPage(track, content.set_path ?? '/')}>
            {t('homework.platform.openOnPlatform')}
            <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    );
  }
  return isPlatformTestMatrix(data) ? <StaffView matrix={data} /> : <StudentView progress={data} />;
}
