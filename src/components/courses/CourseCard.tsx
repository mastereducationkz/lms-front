/**
 * The course card on the student dashboard and the courses page. The cover is programme art
 * (owner, 2026-10-07): the programme's gradient, the Master sunburst and the programme's name
 * set large as a wordmark — or a real banner-shaped upload, shown as it is. The course title sits
 * under the cover, with progress, «N из M уроков» and the next lesson.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MasterMark } from '@/components/mascot/art/MasterMark';
import { checkpointLabel, lessonsLabel, type CheckpointSummary } from '@/lib/completion';
import { isBannerShaped, programLabel, programOf, progressSummary, type ProgramKey } from '@/lib/courseProgram';

interface ProgramTheme {
  gradient: string;
  bar: string;
}

const THEMES: Record<ProgramKey, ProgramTheme> = {
  sat: { gradient: 'from-[#1E3A8A] via-[#1D4ED8] to-[#3B82F6]', bar: 'bg-brand-solid' },
  ielts: { gradient: 'from-[#7F1D1D] via-[#B91C1C] to-[#E11D48]', bar: 'bg-red-600' },
  nuet: { gradient: 'from-[#064E3B] via-[#047857] to-[#10B981]', bar: 'bg-emerald-600' },
  english: { gradient: 'from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6]', bar: 'bg-violet-600' },
  other: { gradient: 'from-[#1E293B] via-[#334155] to-[#475569]', bar: 'bg-slate-600' },
};

/**
 * The wordmark's size in container widths, per word length, so «SAT» and «English» fill about
 * the same share of the cover; capped so a wide card never pushes the letters past its height.
 */
function wordmarkStyle(label: string): CSSProperties {
  const share = label.length <= 3 ? 27 : label.length <= 5 ? 20 : 15.5;
  return { fontSize: `min(${share}cqw, 6rem)` };
}

/** 'banner' once a banner-shaped upload has loaded; 'generated' for none, a logo or an error. */
function useCoverMode(url: string | null | undefined): 'banner' | 'generated' {
  const [mode, setMode] = useState<'banner' | 'generated'>('generated');
  useEffect(() => {
    setMode('generated');
    if (!url) return undefined;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) setMode(isBannerShaped(img.naturalWidth, img.naturalHeight) ? 'banner' : 'generated');
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return mode;
}

function CourseCover({ title, coverUrl, onClick }: { title: string; coverUrl?: string | null; onClick?: () => void }) {
  const program = programOf(title);
  const theme = THEMES[program];
  const mode = useCoverMode(coverUrl);
  const wordmark = program === 'other' ? null : programLabel(title);
  return (
    <div
      className={`@container relative h-40 overflow-hidden bg-gradient-to-br ${theme.gradient} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {mode === 'banner' && coverUrl ? (
        <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <>
          {/* Dark: a veil of the page colour turns the bright programme gradient into a
              tinted dark surface (same hue, no glare); uploaded banners are left alone. */}
          <div aria-hidden className="absolute inset-0 hidden bg-background/55 dark:block" />
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_100%,rgba(255,255,255,0.18),transparent_60%)] dark:opacity-50" />
          <svg aria-hidden viewBox="0 0 100 100" className="absolute -right-9 -top-14 h-48 w-48 transition-transform duration-700 ease-out group-hover:rotate-[10deg] motion-reduce:transition-none motion-reduce:group-hover:rotate-0">
            <MasterMark x={50} y={50} size={96} color="#FFFFFF" opacity={0.14} />
          </svg>
          {wordmark && (
            <span
              aria-hidden
              className="absolute bottom-3 left-5 select-none whitespace-nowrap font-extrabold leading-[0.8] tracking-[-0.045em] text-white/95 [text-shadow:0_2px_12px_rgba(0,0,0,0.12)] dark:text-white/85"
              style={wordmarkStyle(wordmark)}
            >
              {wordmark}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export interface CourseCardProps {
  title: string;
  /** Absolute URL of the uploaded cover, if any. */
  coverUrl?: string | null;
  /** Students only: the course-completion percentage and its counts. */
  progress?: number | null;
  lessonsDone?: number | null;
  lessonsTotal?: number | null;
  checkpoints?: CheckpointSummary | null;
  nextLesson?: { id: number; title: string } | null;
  /** Staff catalogue: a description and chips (Your groups, Draft). */
  description?: string | null;
  badges?: ReactNode;
  actionLabel: string;
  actionIcon?: ReactNode;
  /** A trailing arrow after the label («Continue learning»), nudged on hover. */
  actionArrow?: boolean;
  actionVariant?: 'default' | 'outline';
  onOpen: () => void;
  className?: string;
}

export default function CourseCard({
  title, coverUrl, progress, lessonsDone, lessonsTotal, checkpoints, nextLesson, description, badges,
  actionLabel, actionIcon, actionArrow = false, actionVariant = 'default', onOpen, className = '',
}: CourseCardProps) {
  const theme = THEMES[programOf(title)];
  const hasProgress = progress !== undefined && progress !== null;
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  const cp = checkpointLabel(checkpoints);
  const lessons = lessonsLabel(lessonsDone, lessonsTotal);
  return (
    <Card className={`group flex flex-col overflow-hidden rounded-2xl shadow-sm transition-shadow hover:shadow-lg ${className}`}>
      <CourseCover title={title} coverUrl={coverUrl} onClick={onOpen} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground" title={title}>{title}</h3>
          {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
        </div>
        {hasProgress && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{pct}%</span>
              {lessons && ` · ${lessons}`}
            </p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Course progress"
              aria-valuetext={progressSummary(pct, lessons)}
            >
              <div className={`h-full rounded-full ${theme.bar} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
            </div>
            {cp && <p className="text-xs text-muted-foreground">{cp}</p>}
          </div>
        )}
        {hasProgress && nextLesson && pct < 100 && (
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            <span className="shrink-0">Next:</span>
            <span className="truncate font-medium text-foreground" title={nextLesson.title}>{nextLesson.title}</span>
          </p>
        )}
        {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}
        <Button onClick={onOpen} className="group/action mt-auto w-full" variant={actionVariant}>
          {actionIcon}
          {actionLabel}
          {actionArrow && (
            <ArrowRight
              aria-hidden
              strokeWidth={2.25}
              className="ml-1.5 h-4 w-4 shrink-0 transition-transform duration-200 ease-out group-hover/action:translate-x-0.5 group-focus-visible/action:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/action:translate-x-0 motion-reduce:group-focus-visible/action:translate-x-0"
            />
          )}
        </Button>
      </div>
    </Card>
  );
}
