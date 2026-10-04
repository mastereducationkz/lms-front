/**
 * Staff view of a student's achievements (owner, 2026-10-04) on the curator's student page:
 * unlocked badges, streak and the Stars of the Week they've received. Russian, like the page.
 * Hides itself when the achievements service doesn't answer.
 */
import { useEffect, useState } from 'react';
import { Flame, Star, Trophy } from 'lucide-react';
import { recentlyUnlocked } from '@/lib/achievements';
import { getStudentAchievements, type StudentAchievements } from '@/services/api/achievementsUi';
import { tierStyle } from './tierStyle';

const ROLE_RU: Record<string, string> = { curator: 'куратор', teacher: 'учитель', admin: 'администратор' };

export default function StudentAchievementsSection({ studentId }: { studentId: number }) {
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
    <div className="p-5 bg-white border border-gray-200 rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> Достижения
          <span className="font-normal text-gray-400">
            открыто {unlocked.length} из {data.achievements.length}
          </span>
        </h2>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
          Стрик {data.streak.current} дн. · рекорд {data.streak.longest}
        </span>
      </div>
      {unlocked.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">Пока ни одного — первое откроется после первого урока или домашки.</p>
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
            <li key={`${s.created_at}-${i}`} className="flex items-start gap-2 text-sm text-gray-700">
              <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" aria-hidden />
              <span>
                Звезда недели — {ROLE_RU[s.awarded_by_role] ?? s.awarded_by_role} {s.awarded_by_name}: «{s.reason}»
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
