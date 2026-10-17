import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { owedLessonPath, type ActivityRow } from '../../lib/activityGaps';
import type { OwedLesson } from '../../services/api/head-teacher';
import '@/lib/i18n/catalogs/teacherInsights';

interface ActivityGapRowsProps {
  rows: ActivityRow[];
  openId: number | null;
  onToggle: (teacherId: number) => void;
}

/**
 * The Activity tab of «Teacher Oversight»: one row per teacher with the lessons they still owe
 * scores on, a line for the registers Meet could not mark, and — opened — each lesson with a
 * button to its own page. Rows only: the card owns the table and its header.
 */
export default function ActivityGapRows({ rows, openId, onToggle }: ActivityGapRowsProps) {
  const tr = useT();
  const navigate = useNavigate();

  const what = (item: OwedLesson) => {
    if (item.kind === 'register') return tr('teacherInsights.headDashboard.oversight.itemRegister');
    if (typeof item.missing === 'number' && item.missing > 0) {
      return tr('teacherInsights.headDashboard.oversight.itemScores', { count: item.missing });
    }
    return tr('teacherInsights.headDashboard.oversight.itemScoresUnknown');
  };

  return (
    <>
      {rows.map((row) => {
        const isOpen = openId === row.teacher_id;
        return (
          <React.Fragment key={row.teacher_id}>
            <tr
              className="cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => onToggle(row.teacher_id)}
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2 font-medium">
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <span className="truncate">{row.teacher_name}</span>
                </div>
                {row.register > 0 && (
                  <p className="pl-6 text-xs text-amber-700 dark:text-amber-300">
                    {tr('teacherInsights.headDashboard.oversight.meetCouldNotMark', { count: row.register })}
                  </p>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <span
                  className={`inline-flex items-center justify-center min-w-[1.75rem] px-2 py-0.5 rounded-full text-xs font-semibold ${
                    row.scores > 0
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  title={tr('teacherInsights.headDashboard.oversight.lessonsWithoutScores', { count: row.scores })}
                >
                  {row.scores}
                </span>
              </td>
              <td />
            </tr>
            {isOpen && row.items.map((item) => (
              <tr key={`${item.kind ?? ''}-${item.event_id}`} className="bg-muted/20">
                <td className="pl-10 pr-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title || `#${item.event_id}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {[item.group_name, item.start ? formatDate(item.start) : null].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                </td>
                <td className={`px-4 py-2 text-right text-xs ${item.kind === 'register' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
                  {what(item)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(owedLessonPath(item));
                    }}
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                  >
                    {tr('teacherInsights.headDashboard.oversight.openLesson')}
                  </Button>
                </td>
              </tr>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
}
