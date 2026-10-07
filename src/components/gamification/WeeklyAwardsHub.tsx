import { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Trophy, Loader2, TrendingUp, Award } from 'lucide-react';
import { RankMedal } from './RankMedal';
import { toast } from '../Toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherDesk';

interface GroupStudent {
  user_id: number;
  user_name: string;
  points: number;
}

interface WeeklyAwardsHubProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WeeklyAwardsHub({ isOpen, onClose }: WeeklyAwardsHubProps) {
  const t = useT();
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupStudents, setGroupStudents] = useState<GroupStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allowance, setAllowance] = useState<{ limit: number; given: number; remaining: number }>({ limit: 50, given: 0, remaining: 50 });
  const [pointsDistribution, setPointsDistribution] = useState<{ [userId: number]: number }>({});
  const [isSaving, setIsSaving] = useState(false);

  const MIN_POINTS_PER_STUDENT = 10;

  useEffect(() => {
    if (isOpen) {
      loadGroups();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupLeaderboard(parseInt(selectedGroupId));
      loadAllowance(parseInt(selectedGroupId));
    }
  }, [selectedGroupId]);

  const loadAllowance = async (groupId?: number) => {
    try {
      if (!groupId) return;
      
      const data = await apiClient.getBonusAllowance(groupId);
      setAllowance(data);
    } catch (error) {
      console.error('Failed to load allowance:', error);
    }
  };

  const loadGroups = async () => {
    try {
      setIsLoading(true);
      const teacherGroups = await apiClient.getTeacherGroups();
      setGroups(teacherGroups || []);
      
      if (teacherGroups && teacherGroups.length > 0) {
        setSelectedGroupId(teacherGroups[0].id.toString());
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      toast(t('teacherDesk.awards.groupsFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupLeaderboard = async (groupId: number) => {
    try {
      setIsLoading(true);
      
      const allGroups = await apiClient.getTeacherGroups();
      const selectedGroup = allGroups.find((g: any) => g.id === groupId);
      
      if (!selectedGroup || !selectedGroup.students) {
        setGroupStudents([]);
        setIsLoading(false);
        return;
      }
      
      const response = await apiClient.getGamificationLeaderboard({
        period: 'weekly',
        group_id: groupId
      });
      
      const weeklyPoints: { [userId: number]: number } = {};
      (response.entries || []).forEach((entry: any) => {
        weeklyPoints[entry.user_id] = entry.points;
      });
      
      const allStudentsWithPoints = selectedGroup.students.map((student: any) => ({
        user_id: student.id,
        user_name: student.name || student.full_name,
        points: weeklyPoints[student.id] || 0
      }));
      
      allStudentsWithPoints.sort((a, b) => b.points - a.points);
      
      setGroupStudents(allStudentsWithPoints);
      setPointsDistribution({});
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      toast(t('teacherDesk.awards.leaderboardFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePointsChange = (userId: number, value: string) => {
    const points = parseInt(value) || 0;
    setPointsDistribution(prev => ({
      ...prev,
      [userId]: points
    }));
  };

  const getTotalDistributedInBatch = () => {
    return Object.values(pointsDistribution).reduce((sum, points) => sum + points, 0);
  };

  const getRemainingAllowance = () => {
    return allowance.remaining - getTotalDistributedInBatch();
  };

  const canDistribute = () => {
    const totalBatch = getTotalDistributedInBatch();
    if (totalBatch === 0) return false;
    
    if (totalBatch > allowance.remaining) return false;
    
    for (const points of Object.values(pointsDistribution)) {
      if (points > 0 && points < MIN_POINTS_PER_STUDENT) {
        return false;
      }
    }
    
    return true;
  };

  const handleDistribute = async () => {
    if (!canDistribute()) return;

    try {
      setIsSaving(true);
      const groupId = parseInt(selectedGroupId);
      
      for (const [userIdStr, points] of Object.entries(pointsDistribution)) {
        if (points > 0) {
          const userId = parseInt(userIdStr);
          
          await apiClient.giveTeacherBonus({
            student_id: userId,
            amount: points,
            reason: `Weekly performance award`,
            group_id: groupId
          });
        }
      }
      
      toast(t('teacherDesk.awards.distributed'), 'success');
      loadAllowance(groupId);
      onClose();
      
      setPointsDistribution({});
      if (selectedGroupId) {
        loadGroupLeaderboard(parseInt(selectedGroupId));
      }
    } catch (error: any) {
      console.error('Failed to distribute points:', error);
      toast(error.response?.data?.detail || t('teacherDesk.awards.distributeFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const remainingInBatch = getRemainingAllowance();
  const totalBatch = getTotalDistributedInBatch();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Trophy className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-foreground">{t('teacherDesk.awards.title')}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {t('teacherDesk.awards.description', { count: allowance.limit, given: allowance.given })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          <div>
            <label className="text-sm font-medium text-foreground  mb-2 block">{t('teacherDesk.awards.selectGroup')}</label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder={t('teacherDesk.awards.chooseGroup')} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={`rounded-lg p-4 border ${allowance.remaining === 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50' : 'bg-muted/60 border-border'}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">{t('teacherDesk.awards.available')}</p>
                <p className={`text-2xl font-bold ${allowance.remaining === 0 ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
                  {t('teacherDesk.awards.points', { count: allowance.remaining })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('teacherDesk.awards.selectedRemaining')}</p>
                <p className={`text-2xl font-bold ${remainingInBatch < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                  {totalBatch} / {remainingInBatch}
                </p>
              </div>
            </div>
            {allowance.remaining === 0 ? (
               <p className="text-sm text-red-700 dark:text-red-400 mt-2 font-medium">{t('teacherDesk.awards.limitReached')}</p>
            ) : remainingInBatch < 0 && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{t('teacherDesk.awards.overLimit')}</p>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : groupStudents.length === 0 ? (
            <div className="text-center py-12 bg-muted/60 rounded-lg">
              <TrendingUp className="w-12 h-12 text-gray-300 dark:text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">{t('teacherDesk.noStudentsInGroup')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/60 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground  uppercase">{t('teacherDesk.col.rank')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground  uppercase">{t('teacherDesk.col.student')}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground  uppercase">{t('teacherDesk.col.weeklyPoints')}</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground  uppercase">{t('teacherDesk.awards.awardPoints')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {groupStudents.map((student, index) => {
                    const studentPoints = pointsDistribution[student.user_id] || 0;
                    const hasError = studentPoints > 0 && studentPoints < MIN_POINTS_PER_STUDENT;
                    
                    return (
                      <tr key={student.user_id} className={`hover:bg-muted/60 ${hasError ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted dark:bg-secondary border border-border">
                            {index < 3 && student.points > 0 ? (
                              <RankMedal rank={index + 1} />
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-sm font-medium text-foreground">{student.user_name}</p>
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-sm text-muted-foreground">{student.points}</p>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max={allowance.remaining}
                              step="10"
                              disabled={allowance.remaining === 0}
                              value={studentPoints || ''}
                              onChange={(e) => handlePointsChange(student.user_id, e.target.value)}
                              placeholder="0"
                              className={`w-20 text-center text-sm ${hasError ? 'border-red-400' : ''}`}
                            />
                          </div>
                          {hasError && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 text-center">{t('teacherDesk.awards.min', { min: MIN_POINTS_PER_STUDENT })}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleDistribute}
            disabled={!canDistribute() || isSaving}
            className="bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground"
          >
            {isSaving ? t('teacherDesk.awards.distributing') : t('teacherDesk.awards.distribute')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
