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

/**
 * A "platform_test" assignment: the weekly test lives on the exam platform (IELTS), the LMS
 * shows one checkmark per part and opens each part through the signed handoff link.
 * Students see their own checklist; group staff see the whole group.
 */

const MODULE_LABEL: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

const moduleLabel = (module: string) => MODULE_LABEL[module] ?? module;
const trackOf = (platform: string): PlatformTrack => (platform === 'ielts' ? 'ielts' : 'sat');

function StateBadge({ state, band }: { state: PlatformModuleProgress['state']; band: number | null }) {
  if (state === 'done') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Done{band != null ? ` · Band ${band}` : ''}
      </Badge>
    );
  }
  if (state === 'in_progress') {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 gap-1">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        In progress
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Circle className="h-3.5 w-3.5" aria-hidden="true" />
      Not started
    </Badge>
  );
}

function deadlineLine(progress: Pick<PlatformTestProgress, 'date_from' | 'date_to' | 'modules'>): string {
  const parts: string[] = [];
  if (progress.date_to) parts.push(`Due ${formatAlmaty(progress.date_to)} (Almaty)`);
  const speaking = progress.modules.find((m) => m.module === 'speaking');
  if (speaking && progress.date_to) {
    parts.push(`Speaking closes ${formatAlmaty(progress.date_to)}`);
  }
  return parts.join(' · ');
}

function ModuleRow({ module, track, canOpen }: { module: PlatformModuleProgress; track: PlatformTrack; canOpen: boolean }) {
  const hint = !module.available
    ? 'Only available inside the test window'
    : module.state === 'done'
      ? 'You can still open the part on the platform'
      : undefined;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="font-medium">{moduleLabel(module.module)}</p>
        <p className="text-xs text-muted-foreground truncate">
          {module.test_title ?? ''}
          {module.deadline_kind === 'closes' ? ' · closes at the deadline' : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StateBadge state={module.state} band={module.band} />
        {canOpen && module.result_url && (
          <Button size="sm" variant="outline" onClick={() => void openPlatformPage(track, module.result_url ?? '/')}>
            Result
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
            {module.state === 'in_progress' ? 'Continue' : 'Open'}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}

function StudentView({ progress }: { progress: PlatformTestProgress }) {
  const track = trackOf(progress.platform);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{progress.title}</CardTitle>
            <CardDescription>{deadlineLine(progress)}</CardDescription>
          </div>
          <Badge variant={progress.status === 'submitted' ? 'default' : 'secondary'}>
            {progress.status === 'submitted' ? 'All parts done' : progress.status === 'in_progress' ? 'In progress' : 'Not started'}
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
          Checkmarks update automatically from the platform. Listening, Reading and Writing stay open after the
          deadline while the weekly set is active; Speaking is only available inside its window.
        </p>
        <Button variant="link" className="px-0" onClick={() => void openPlatformPage(track, progress.set_path)}>
          Open the weekly set on the platform
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

function StaffView({ matrix }: { matrix: PlatformTestMatrix }) {
  const modules = matrix.students[0]?.modules.map((m) => m.module) ?? [];
  const mark = (m: PlatformModuleProgress) =>
    m.state === 'done' ? `✓${m.band != null ? ` ${m.band}` : ''}` : m.state === 'in_progress' ? '◐' : '—';
  const done = matrix.students.filter((s) => s.status === 'submitted').length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{matrix.assignment.title}</CardTitle>
        <CardDescription>
          {deadlineLine({ ...matrix.assignment, modules: [] })} · {done}/{matrix.students.length} students done
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Student</th>
                {modules.map((m) => (
                  <th key={m} className="py-2 pr-4 font-medium">{moduleLabel(m)}</th>
                ))}
                <th className="py-2 font-medium">Status</th>
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
                    {s.status === 'submitted' ? 'Done' : s.status === 'in_progress' ? 'In progress' : 'Not started'}
                  </td>
                </tr>
              ))}
              {matrix.students.length === 0 && (
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={modules.length + 2}>No students in this group.</td>
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

  const content = (assignment.content ?? {}) as { platform?: string; set_path?: string };
  const track = trackOf(content.platform ?? 'ielts');

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading platform test…
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
              ? 'Platform tests are not switched on in the LMS yet — open the test on the platform directly.'
              : 'Could not load the platform progress. Open the test on the platform directly.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void openPlatformPage(track, content.set_path ?? '/')}>
            Open on the platform
            <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    );
  }
  return isPlatformTestMatrix(data) ? <StaffView matrix={data} /> : <StudentView progress={data} />;
}
