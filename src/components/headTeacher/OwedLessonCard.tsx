import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { owedLessonPath } from '../../lib/activityGaps';
import type { OwedLesson } from '../../services/api/head-teacher';

interface OwedLessonCardProps {
  lessons: OwedLesson[] | undefined;
  title: string;
  hint: string;
}

/**
 * A teacher's owed lessons on the head's teacher page: each row opens the lesson's own page, where
 * the register and the activity scores are. Renders nothing when the list is empty or absent
 * (an older server) — an empty red card would read as a problem that is not there.
 */
export default function OwedLessonCard({ lessons, title, hint }: OwedLessonCardProps) {
  const tr = useT();
  if (!lessons?.length) return null;
  return (
    <Card className="border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/15">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <CardTitle className="text-base text-red-900 dark:text-red-300">{title}</CardTitle>
        </div>
        <CardDescription className="text-red-700 dark:text-red-300">{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {lessons.map((item) => (
            <Link
              key={`${item.kind ?? ''}-${item.event_id}`}
              to={owedLessonPath(item)}
              className="flex items-center justify-between bg-card rounded-md px-3 py-2 border border-red-100 hover:bg-muted/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.title || `#${item.event_id}`}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.group_name, item.start ? formatDate(item.start) : null].filter(Boolean).join(' • ')}
                </p>
              </div>
              {typeof item.missing === 'number' && item.missing > 0 && (
                <Badge variant="secondary" className="bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30">
                  {tr('common.students', { count: item.missing })}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
