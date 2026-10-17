import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { OWED_PREVIEW, owedByKind, owedLink, previewOwed, registersOwed, scoresOwed } from '../../lib/attendanceOwed';
import { stampKz } from '../../lib/classLessonPage';
import { useLocale, useT } from '../../lib/i18n/react';
import type { AttendanceOwed } from '../../services/api/attendanceOwed';
import '@/lib/i18n/catalogs/teacherDesk';

/**
 * «Без баллов за активность» on the teacher dashboard (owner, 2026-10-17). Meet takes the register, so what
 * a teacher owes is the activity score of the students who came — the headline — and, only when there is
 * any, the lessons Meet could not mark (one line, «Отметить вручную»). Every lesson opens its page.
 */
export function AttendanceOwedCard({ owed }: { owed: AttendanceOwed }) {
  const t = useT();
  const locale = useLocale();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { scores, register } = owedByKind(owed);
  const unscored = scoresOwed(owed);
  const handedBack = registersOwed(owed);
  if (unscored === 0 && handedBack === 0) return null;
  const shown = previewOwed(scores, expanded);

  return (
    <Card className="shadow-sm border border-border">
      {unscored > 0 && (
        <>
          <CardHeader className="px-6 py-4 border-b border-border bg-card rounded-t-xl">
            <div className="flex flex-col @lg:flex-row @lg:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">{t('teacherDesk.dashboard.owedScoresTitle')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('teacherDesk.dashboard.owedScoresHint')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-rose-600 dark:text-rose-400">
                  {t('teacherDesk.dashboard.owedLessons')}: {unscored}
                </span>
                {scores[0] && (
                  <Button onClick={() => navigate(owedLink(scores[0]))} size="sm" variant="outline" className="text-xs h-7">
                    {t('teacherDesk.dashboard.owedScoresAction')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/80 dark:bg-secondary/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.group')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.dashboard.oldest')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.dashboard.owedLessons')}</th>
                    <th className="text-right px-6 py-3 font-semibold">{t('teacherDesk.dashboard.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) => (
                    <tr
                      key={item.event_id}
                      onClick={() => navigate(owedLink(item))}
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-muted dark:hover:bg-secondary/40 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-foreground">{item.group_name}</td>
                      <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                        <Link to={owedLink(item)} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline" title={t('teacherDesk.dashboard.openLesson')}>
                          {stampKz(item.start, locale)}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-rose-600 dark:text-rose-400 font-semibold">
                        {t('teacherDesk.dashboard.owedMissing', { count: item.missing })}
                      </td>
                      <td className="px-6 py-3 text-right text-rose-600 dark:text-rose-400 font-medium">{t('teacherDesk.dashboard.owedScoresAction')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {scores.length > OWED_PREVIEW && (
              <button type="button" onClick={() => setExpanded((open) => !open)}
                className="w-full border-t border-border px-6 py-2 text-center text-xs font-semibold text-brand hover:bg-muted/60">
                {expanded ? t('teacherDesk.dashboard.owedShowLess') : t('teacherDesk.dashboard.owedShowAll', { count: scores.length })}
              </button>
            )}
          </CardContent>
        </>
      )}
      {handedBack > 0 && (
        <div className={`flex flex-wrap items-center justify-between gap-2 px-6 py-3 ${unscored > 0 ? 'border-t border-border' : ''}`}>
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {t('teacherDesk.dashboard.owedRegister', { count: handedBack })}
          </span>
          {register[0] && (
            <Button onClick={() => navigate(owedLink(register[0]))} size="sm" variant="outline" className="text-xs h-7">
              {t('teacherDesk.dashboard.owedRegisterAction')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default AttendanceOwedCard;
