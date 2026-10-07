/**
 * Staff view of a student's achievements (owner, 2026-10-04) on the curator's student page:
 * unlocked badges, streak and the Stars of the Week they've received, in the viewer's language.
 * Hides itself when the achievements service doesn't answer.
 */
import { useEffect, useState } from 'react';
import { Flame, Star, Trophy } from 'lucide-react';
import { recentlyUnlocked } from '@/lib/achievements';
import type { MessageKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import { getStudentAchievements, type StudentAchievements } from '@/services/api/achievementsUi';
import { tierStyle } from './tierStyle';

const AWARDER: Record<string, MessageKey> = {
  curator: 'achievements.student.awarder.curator',
  teacher: 'achievements.student.awarder.teacher',
  admin: 'achievements.student.awarder.admin',
};

export default function StudentAchievementsSection({ studentId }: { studentId: number }) {
  const t = useT();
  const [data, setData] = useState<StudentAchievements | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    getStudentAchievements(studentId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [studentId]);

  if (!data || data.achievements.length === 0) return null;
  const unlocked = recentlyUnlocked(data.achievements, data.achievements.length);
  const stars = data.star_awards ?? [];

  return (
    <div className="p-5 bg-card border border-border rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> {t('achievements.title')}
          <span className="font-normal text-muted-foreground">
            {t('achievements.student.unlockedOf', { unlocked: unlocked.length, total: data.achievements.length })}
          </span>
        </h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
          {t('achievements.student.streak', { count: data.streak.current, longest: data.streak.longest })}
        </span>
      </div>
      {unlocked.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('achievements.student.none')}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {unlocked.map((a) => (
            <li
              key={a.key}
              title={a.description || a.how_to || ''}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${tierStyle(a.tier).badge}`}
            >
              {a.title}
              {a.count > 1 ? ` ×${a.count}` : ''}
            </li>
          ))}
        </ul>
      )}
      {stars.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {stars.slice(0, 5).map((s, i) => (
            <li key={`${s.created_at}-${i}`} className="flex items-start gap-2 text-sm text-foreground">
              <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" aria-hidden />
              <span>
                {t('achievements.student.starLine', {
                  role: AWARDER[s.awarded_by_role] ? t(AWARDER[s.awarded_by_role]) : s.awarded_by_role,
                  name: s.awarded_by_name,
                  reason: s.reason,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
