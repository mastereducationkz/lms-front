import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Crown, Dumbbell, Flame, Star } from 'lucide-react';
import apiClient from '../services/api';
import UserAvatar from '@/components/mascot/UserAvatar';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  user_name: string;
  avatar_url: string | null;
  mascot?: string | null;
  steps_completed: number;
  time_spent_minutes: number;
  is_current_user: boolean;
}

interface LeaderboardData {
  group_id: number | null;
  group_name: string | null;
  leaderboard: LeaderboardEntry[];
  current_user_rank: number;
  current_user_entry: LeaderboardEntry | null;
  current_user_title: string;
  total_participants: number;
  period: string;
  steps_to_next_rank: number;
}

type SelfRankSummary = {
  rank: number;
  points: number;
  pointsToNext: number;
};

export default function StudentLeaderboard() {
  const t = useT();
  const [entries, setEntries] = useState<any[]>([]);
  const [selfRankSummary, setSelfRankSummary] = useState<SelfRankSummary | null>(null);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<'all' | 'group'>('group');
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndGroups();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadLeaderboard();
    }
  }, [currentUser, scope, selectedGroupId]);

  const loadUserAndGroups = async () => {
    try {
      const [user, groups] = await Promise.all([
        apiClient.getCurrentUser(),
        apiClient.getMyGroups()
      ]);
      setCurrentUser(user);
      setMyGroups(groups);
      
      // Default to first group if available
      if (groups.length > 0) {
        setSelectedGroupId(groups[0].id);
      } else {
        // If no groups, force scope to 'all'
        setScope('all');
      }
    } catch (err) {
      console.error('Failed to load user info:', err);
      // Without this the card is stuck on the skeleton forever: currentUser
      // never gets set, so loadLeaderboard never runs and isLoading stays true.
      setError(t('studentHome.leaderboard.loadFailed'));
      setIsLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params: any = { period: 'monthly' };
      
      // Apply group filter if in group scope
      if (scope === 'group' && selectedGroupId) {
        params.group_id = selectedGroupId;
      }
      
      const response = await apiClient.getGamificationLeaderboard(params);
      setEntries(response.entries || []);
      setTotalParticipants(response.total_participants || 0);
      if (response.self_only) {
        if (typeof response.my_rank === 'number') {
          setSelfRankSummary({
            rank: response.my_rank,
            points: response.my_points ?? 0,
            pointsToNext: Math.max(0, response.points_to_next_rank ?? 0),
          });
        } else {
          setSelfRankSummary(null);
        }
      } else {
        setSelfRankSummary(null);
      }
      
    } catch (err: any) {
      setError(err?.message || t('studentHome.leaderboard.loadFailed'));
      console.error('Leaderboard error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getUserRankInfo = () => {
    if (selfRankSummary) {
      return {
        rank: selfRankSummary.rank,
        points: selfRankSummary.points,
        pointsToNext: selfRankSummary.pointsToNext,
        isTop10: selfRankSummary.rank <= 10,
      };
    }
    if (!currentUser || entries.length === 0) return null;

    const index = entries.findIndex(e => e.user_id === currentUser.id);
    if (index === -1) return null;

    const entry = entries[index];
    const prevEntry = index > 0 ? entries[index - 1] : null;
    const pointsToNext = prevEntry ? prevEntry.points - entry.points : 0;

    return {
      rank: entry.rank,
      points: entry.points,
      pointsToNext,
      isTop10: entry.rank <= 10,
    };
  };

  const myRankInfo = getUserRankInfo();

  if (isLoading && !currentUser && !error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {t('studentHome.leaderboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            {t('studentHome.leaderboard.title')}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-secondary p-0.5 rounded-lg">
              <button
                onClick={() => setScope('group')}
                disabled={myGroups.length === 0}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  scope === 'group' 
                    ? 'bg-white dark:bg-brand-surface text-gray-900 dark:text-brand-subtle-foreground shadow-sm dark:shadow-[inset_0_0_0_1px_hsl(var(--brand-border))]' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                } ${myGroups.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {t('studentHome.leaderboard.myGroup')}
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  scope === 'all' 
                    ? 'bg-white dark:bg-brand-surface text-gray-900 dark:text-brand-subtle-foreground shadow-sm dark:shadow-[inset_0_0_0_1px_hsl(var(--brand-border))]' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t('studentHome.leaderboard.allStudents')}
              </button>
            </div>
          </div>
        </div>
        
        {/* Only show group selector if in group mode and has multiple groups */}
        {scope === 'group' && myGroups.length > 1 && (
          <div className="flex gap-2">
            <select
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(Number(e.target.value))}
              className="w-full text-sm p-2 border border-gray-200 dark:border-border rounded-lg bg-gray-50 dark:bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-gray-700 dark:text-gray-300"
            >
              {myGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {error ? (
          <div className="text-center py-4 text-red-500 dark:text-red-400 text-sm">
            {error}
            <Button variant="link" size="sm" onClick={() => (currentUser ? loadLeaderboard() : loadUserAndGroups())} className="text-blue-500 dark:text-blue-400">{t('studentHome.leaderboard.retry')}</Button>
          </div>
        ) : (
          <>
            {/* Current User Stats */}
            {myRankInfo ? (
          <div className="mb-4">
            <div className="flex items-end justify-between px-2 mb-2">
              <div className="flex items-center gap-3">
              <UserAvatar
                userId={currentUser?.id}
                name={currentUser?.name}
                avatarUrl={currentUser?.avatar_url}
                mascot={currentUser?.mascot}
                isStudent={currentUser?.role === 'student'}
                size={48}
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{t('studentHome.leaderboard.yourRank')}</span>
                <div className="flex items-center gap-2 ">
                  <span className="text-2xl font-bold text-gray-900 dark:text-foreground tracking-tight">#{myRankInfo.rank}</span>
                  {myRankInfo.rank === 1 ? (
                    <span className="inline-flex items-center gap-1 text-[16px] font-bold text-yellow-700 dark:text-yellow-400 px-2 rounded-full"><Crown className="h-4 w-4" aria-hidden="true" />{t('studentHome.leaderboard.title1')}</span>
                  ) : myRankInfo.rank <= 3 ? (
                    <span className="inline-flex items-center gap-1 text-[16px] font-bold text-orange-700 dark:text-orange-400 px-2 rounded-full"><Flame className="h-4 w-4" aria-hidden="true" />{t('studentHome.leaderboard.titleTop3')}</span>
                  ) : myRankInfo.rank <= 10 ? (
                    <span className="inline-flex items-center gap-1 text-[16px] font-bold text-purple-600 dark:text-purple-400 px-2 rounded-full"><Star className="h-4 w-4" aria-hidden="true" />{t('studentHome.leaderboard.titleTop10')}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-secondary px-2 py-0.5 rounded-full"><Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />{t('studentHome.leaderboard.titleRest')}</span>
                  )}
                </div>
              </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{t('studentHome.leaderboard.rank')}</span>
                <span className="text-xl font-semibold text-gray-900 dark:text-foreground">
                  {myRankInfo.rank} <span className="text-muted-foreground font-normal">/ {totalParticipants}</span>
                </span>
              </div>
            </div>
            
            {myRankInfo.pointsToNext > 0 ? (
              <div className="bg-gray-50 dark:bg-secondary rounded-lg p-3 mt-3">
                <div className="flex justify-between text-xs font-medium mb-2">
                  <span className="text-gray-500 dark:text-gray-400">{t('studentHome.leaderboard.nextLevel')}</span>
                  <span className="text-blue-600 dark:text-blue-400">{t('studentHome.leaderboard.pointsNeeded', { count: myRankInfo.pointsToNext })}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 dark:bg-blue-400 rounded-full w-2/3"></div>
                </div>
              </div>
            ) : myRankInfo.rank === 1 && (
               <div className="mt-2 text-center">
                 <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/20 py-2 rounded-lg"><Crown className="h-4 w-4" aria-hidden="true" />{t('studentHome.leaderboard.unstoppable')}</p>
               </div>
            )}
          </div>
        ) : (
          <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm mb-2">
            {t('studentHome.leaderboard.noPoints')}
          </div>
        )}

          </>
        )}
      </CardContent>
    </Card>
  );
}
