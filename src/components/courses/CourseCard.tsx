/**
 * The course card on the student dashboard and the courses page (owner, 2026-10-04): a clean
 * programme cover (gradient, chip, title, a faint Master emblem) — or a real banner-shaped
 * upload — with progress, «N из M уроков» and the next lesson in the body, off the image.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Brain, Globe2, GraduationCap, Languages } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MasterMark } from '@/components/mascot/art/MasterMark';
import { checkpointLabel, lessonsLabel, type CheckpointSummary } from '@/lib/completion';
import { isBannerShaped, programLabel, programOf, progressSummary, type ProgramKey } from '@/lib/courseProgram';

interface ProgramTheme {
  gradient: string;
  bar: string;
  icon: LucideIcon;
}

const THEMES: Record<ProgramKey, ProgramTheme> = {
  sat: { gradient: 'from-[#1E3A8A] via-[#1D4ED8] to-[#3B82F6]', bar: 'bg-brand-solid', icon: GraduationCap },
  ielts: { gradient: 'from-[#7F1D1D] via-[#B91C1C] to-[#E11D48]', bar: 'bg-red-600', icon: Globe2 },
  nuet: { gradient: 'from-[#064E3B] via-[#047857] to-[#10B981]', bar: 'bg-emerald-600', icon: Brain },
  english: { gradient: 'from-[#4C1D95] via-[#6D28D9] to-[#8B5CF6]', bar: 'bg-violet-600', icon: Languages },
  other: { gradient: 'from-[#1E293B] via-[#334155] to-[#475569]', bar: 'bg-slate-600', icon: BookOpen },
};

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
  const theme = THEMES[programOf(title)];
  const Icon = theme.icon;
  const mode = useCoverMode(coverUrl);
  return (
    <div
      className={`relative h-40 overflow-hidden bg-gradient-to-br ${theme.gradient} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {mode === 'banner' && coverUrl ? (
        <>
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        </>
      ) : (
        <>
          {/* Dark: a veil of the page colour turns the bright programme gradient into a
              tinted dark surface (same hue, no glare); uploaded banners are left alone. */}
          <div aria-hidden className="absolute inset-0 hidden bg-background/55 dark:block" />
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.20),transparent_55%)] dark:opacity-50" />
          <svg aria-hidden viewBox="0 0 100 100" className="absolute right-4 top-1/2 h-32 w-32 -translate-y-1/2 transition-transform duration-500 group-hover:rotate-[8deg]">
            <MasterMark x={50} y={50} size={96} color="#FFFFFF" opacity={0.13} />
          </svg>
        </>
      )}
      <span className="absolute left-5 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white ring-1 ring-white/25 backdrop-blur-sm">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {programLabel(title)}
      </span>
      <h3 className="absolute bottom-4 left-5 right-5 line-clamp-2 text-xl font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]">
        {title}
      </h3>
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
  actionVariant?: 'default' | 'outline';
  onOpen: () => void;
  className?: string;
}

export default function CourseCard({
  title, coverUrl, progress, lessonsDone, lessonsTotal, checkpoints, nextLesson, description, badges,
  actionLabel, actionIcon, actionVariant = 'default', onOpen, className = '',
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
        {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
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
        <Button onClick={onOpen} className="mt-auto w-full" variant={actionVariant}>
          {actionIcon}
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
