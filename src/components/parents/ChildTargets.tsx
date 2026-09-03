import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { band, getStudentTargets, score, type TargetsPayload } from '../../services/api/targets';

/**
 * Parent dashboard: a read-only line per exam track for one child — target vs current level.
 * Renders nothing when the feature is off, the child has no track, or on error.
 */
export function ChildTargets({ studentId }: { studentId: number }) {
  const [data, setData] = useState<TargetsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStudentTargets(studentId)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!data || data.tracks.length === 0) return null;
  const ielts = data.progress.ielts;
  const sat = data.progress.sat;
  const lines: string[] = [];
  if (data.tracks.includes('ielts')) {
    const target = data.targets.ielts?.targets.overall;
    const parts = ielts
      ? ` (L ${band(ielts.modules.listening.now)} R ${band(ielts.modules.reading.now)} W ${band(ielts.modules.writing.now)} S ${band(ielts.modules.speaking.now)})`
      : '';
    lines.push(`IELTS: цель ${band(target)} · сейчас ${band(ielts?.overall_now)}${parts}`);
  }
  if (data.tracks.includes('sat')) {
    const target = data.targets.sat?.targets.total;
    lines.push(`SAT: цель ${score(target)} · сейчас ${score(sat?.current?.total)}`);
  }
  if (data.tracks.includes('nuet')) {
    lines.push(`NUET: цель ${score(data.targets.nuet?.targets.total)}`);
  }
  return (
    <div className="mt-3 rounded-lg border border-gray-100 dark:border-border p-3 text-sm">
      <p className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        <Target className="w-3.5 h-3.5" aria-hidden="true" /> Цели
      </p>
      {lines.map((line) => (
        <p key={line} className="text-gray-800 dark:text-foreground">{line}</p>
      ))}
    </div>
  );
}

export default ChildTargets;
