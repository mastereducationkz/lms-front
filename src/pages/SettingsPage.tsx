import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { 
  Play, 
  RotateCcw, 
  CheckCircle, 
  Users, 
  BookOpen, 
  Loader2, 
  AlertCircle,
  Search,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { replayTourFor } from '../lib/guide/state';
import { replayLabel } from '../components/guide/tours';
import { requestTourReplay } from '../components/guide/tourStore';
import apiClient from '../services/api';
import { changePassword } from '../services/api/auth';
import { toast } from '../components/Toast';
import { useT } from '../lib/i18n/react';

interface CourseItem {
  id: number;
  title: string;
}

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Lesson {
  lesson_id: number;
  lesson_title: string;
  module_title: string;
  total_steps: number;
  completed_steps: number;
  completion_percentage: number;
}

interface ProgressSummary {
  user: { id: number; name: string; email: string };
  course: { id: number; title: string };
  overall: {
    total_steps: number;
    completed_steps: number;
    completion_percentage: number;
  };
  lessons: Lesson[];
}

export default function SettingsPage() {
  const { user } = useAuth();
  const t = useT();
  
  // Admin Progress Management State
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [selectedLessons, setSelectedLessons] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Search state
  const [userSearch, setUserSearch] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [showLessons, setShowLessons] = useState(true);

  // Change-password form
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew.length < 6) { toast(t('settings.password.tooShort'), 'error'); return; }
    if (pwNew !== pwConfirm) { toast(t('settings.password.mismatch'), 'error'); return; }
    setPwSaving(true);
    try {
      await changePassword(pwCurrent, pwNew);
      toast(t('settings.password.changed'), 'success');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (err: any) {
      toast(err.message || t('settings.password.failed'), 'error');
    } finally {
      setPwSaving(false);
    }
  };

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const search = userSearch.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    );
  }, [users, userSearch]);

  // Get selected user object
  const selectedUser = useMemo(() => 
    users.find(u => u.id === selectedUserId) || null
  , [users, selectedUserId]);

  // Load courses and users for admin
  useEffect(() => {
    if (user?.role === 'admin') {
      loadCoursesAndUsers();
    }
  }, [user]);

  // Load progress when user and course selected
  useEffect(() => {
    if (selectedUserId && selectedCourseId) {
      loadProgressSummary();
    } else {
      setProgressSummary(null);
      setSelectedLessons([]);
    }
  }, [selectedUserId, selectedCourseId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-search-dropdown')) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCoursesAndUsers = async () => {
    try {
      const [coursesData, usersData] = await Promise.all([
        apiClient.getCourses(),
        apiClient.getUsers({ role: 'student', limit: 10000 })
      ]);
      // Map courses to have number ids
      setCourses(coursesData.map(c => ({ id: Number(c.id), title: c.title })));
      // Map users to have number ids
      setUsers((usersData.users || []).map(u => ({ 
        id: Number(u.id), 
        name: u.name || '', 
        email: u.email, 
        role: u.role 
      })));
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadProgressSummary = async () => {
    if (!selectedUserId || !selectedCourseId) return;
    
    setIsLoadingProgress(true);
    try {
      const data = await apiClient.getUserProgressSummary(selectedUserId, selectedCourseId);
      setProgressSummary(data);
      setSelectedLessons([]);
    } catch (error) {
      console.error('Failed to load progress:', error);
      setProgressSummary(null);
    } finally {
      setIsLoadingProgress(false);
    }
  };

  const handleCompleteSteps = async () => {
    if (!selectedUserId || !selectedCourseId) return;
    
    setIsLoading(true);
    setActionResult(null);
    
    try {
      const data = {
        user_id: selectedUserId,
        course_id: selectedCourseId,
        lesson_ids: selectedLessons.length > 0 ? selectedLessons : undefined
      };
      
      const result = await apiClient.completeStepsForUser(data);
      setActionResult({
        type: 'success',
        message: t('settings.progress.completeResult', {
          newly: result.statistics.newly_completed,
          updated: result.statistics.updated,
          already: result.statistics.already_completed,
        })
      });
      
      // Reload progress
      await loadProgressSummary();
    } catch (error: any) {
      setActionResult({
        type: 'error',
        message: error.message || t('settings.progress.completeFailed')
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetProgress = async () => {
    if (!selectedUserId || !selectedCourseId) return;
    
    if (!confirm(t('settings.progress.resetConfirm'))) {
      return;
    }
    
    setIsLoading(true);
    setActionResult(null);
    
    try {
      const data = {
        user_id: selectedUserId,
        course_id: selectedCourseId,
        lesson_ids: selectedLessons.length > 0 ? selectedLessons : undefined
      };
      
      const result = await apiClient.resetStepsForUser(data);
      setActionResult({
        type: 'success',
        message: t('settings.progress.resetResult', { count: result.deleted_records })
      });
      
      // Reload progress
      await loadProgressSummary();
    } catch (error: any) {
      setActionResult({
        type: 'error',
        message: error.message || t('settings.progress.resetFailed')
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLessonSelection = (lessonId: number) => {
    setSelectedLessons(prev => 
      prev.includes(lessonId) 
        ? prev.filter(id => id !== lessonId)
        : [...prev, lessonId]
    );
  };

  const selectAllLessons = () => {
    if (progressSummary) {
      setSelectedLessons(progressSummary.lessons.map(l => l.lesson_id));
    }
  };

  const deselectAllLessons = () => {
    setSelectedLessons([]);
  };

  const selectUserFromDropdown = (userId: number) => {
    setSelectedUserId(userId);
    setIsUserDropdownOpen(false);
    setUserSearch('');
  };

  const clearUserSelection = () => {
    setSelectedUserId(null);
    setUserSearch('');
    setProgressSummary(null);
  };

  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The same «Replay tour» as the menu under the name; roles without a tour see no card.
  const replayKind = replayTourFor(user?.role);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      
      {/* Admin Progress Management Section */}
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-subtle rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-brand" />
              </div>
              <div>
                <CardTitle>{t('settings.progress.title')}</CardTitle>
                <CardDescription>{t('settings.progress.description')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selection Row */}
            <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-4">
              {/* User Search & Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {t('settings.progress.student')}
                </Label>
                
                <div className="relative user-search-dropdown">
                  {selectedUser ? (
                    <div className="flex items-center justify-between px-3 py-2 border rounded-md bg-brand-surface border-brand-border">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{selectedUser.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearUserSelection}
                        className="ml-2 h-8 w-8 p-0 hover:bg-brand-subtle"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                        <Input
                          placeholder={t('settings.progress.searchPlaceholder')}
                          value={userSearch}
                          onChange={(e) => {
                            setUserSearch(e.target.value);
                            setIsUserDropdownOpen(true);
                          }}
                          onFocus={() => setIsUserDropdownOpen(true)}
                          className="pl-9"
                        />
                      </div>
                      
                      {isUserDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-card border dark:border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredUsers.length === 0 ? (
                            <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                              {userSearch ? t('settings.progress.noStudents') : t('settings.progress.typeToSearch')}
                            </div>
                          ) : (
                            filteredUsers.slice(0, 50).map(u => (
                              <div
                                key={u.id}
                                onClick={() => selectUserFromDropdown(u.id)}
                                className="px-3 py-2 cursor-pointer hover:bg-muted border-b dark:border-border last:border-b-0"
                              >
                                <p className="font-medium text-sm">{u.name}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            ))
                          )}
                          {filteredUsers.length > 50 && (
                            <div className="px-3 py-2 text-center text-gray-400 dark:text-muted-foreground text-xs">
                              {t('settings.progress.shownOf', { shown: 50, total: filteredUsers.length })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {/* Course Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {t('settings.progress.course')}
                </Label>
                <Select
                  value={selectedCourseId?.toString() || ''}
                  onValueChange={(value) => setSelectedCourseId(value ? Number(value) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('settings.progress.coursePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Progress Summary */}
            {isLoadingProgress && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-brand" />
                <span className="ml-2 text-muted-foreground">{t('settings.progress.loading')}</span>
              </div>
            )}
            
            {progressSummary && !isLoadingProgress && (
              <div className="space-y-4">
                {/* Overall Progress Card */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 dark:bg-none dark:bg-brand-surface dark:border-brand-border">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{progressSummary.user.name}</p>
                        <p className="text-sm text-muted-foreground">{progressSummary.course.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-brand">
                          {progressSummary.overall.completion_percentage.toFixed(0)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('settings.progress.steps', { done: progressSummary.overall.completed_steps, total: progressSummary.overall.total_steps })}
                        </p>
                      </div>
                    </div>
                    <Progress value={progressSummary.overall.completion_percentage} className="h-2" />
                  </CardContent>
                </Card>
                
                {/* Lessons Selection */}
                <div>
                  <div 
                    className="flex items-center justify-between cursor-pointer py-2"
                    onClick={() => setShowLessons(!showLessons)}
                  >
                    <Label className="cursor-pointer">
                      {t('settings.progress.chooseLessons')}
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {selectedLessons.length > 0 ? t('settings.progress.selectedCount', { count: selectedLessons.length }) : t('settings.progress.allLessons')}
                      </span>
                      {showLessons ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {showLessons && (
                    <>
                      <div className="flex gap-2 mb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={selectAllLessons}
                          className="text-xs"
                        >
                          {t('settings.progress.selectAll')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={deselectAllLessons}
                          className="text-xs"
                        >
                          {t('settings.progress.clearSelection')}
                        </Button>
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto border dark:border-border rounded-lg divide-y dark:divide-border">
                        {progressSummary.lessons.map(lesson => (
                          <div
                            key={lesson.lesson_id}
                            className={`flex items-center p-3 cursor-pointer hover:bg-muted transition-colors ${
                              selectedLessons.includes(lesson.lesson_id) ? 'bg-brand-surface' : ''
                            }`}
                            onClick={() => toggleLessonSelection(lesson.lesson_id)}
                          >
                            <Checkbox
                              checked={selectedLessons.includes(lesson.lesson_id)}
                              onCheckedChange={() => toggleLessonSelection(lesson.lesson_id)}
                              className="mr-3"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {lesson.lesson_title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {lesson.module_title}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 ml-2">
                              <div className="text-right">
                                <p className="text-xs font-medium">
                                  {lesson.completed_steps}/{lesson.total_steps}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-muted-foreground">
                                  {lesson.completion_percentage}%
                                </p>
                              </div>
                              {lesson.completion_percentage === 100 ? (
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                              ) : (
                                <div className="w-12">
                                  <Progress value={lesson.completion_percentage} className="h-1.5" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Action Result */}
                {actionResult && (
                  <div className={`p-4 rounded-lg flex items-start gap-3 ${
                    actionResult.type === 'success' 
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-border' 
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-border'
                  }`}>
                    {actionResult.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <p className={`text-sm ${
                      actionResult.type === 'success' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'
                    }`}>
                      {actionResult.message}
                    </p>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    onClick={handleCompleteSteps}
                    disabled={isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    {selectedLessons.length > 0 ? t('settings.progress.completeLessons', { count: selectedLessons.length }) : t('settings.progress.completeAll')}
                  </Button>
                  
                  <Button
                    onClick={handleResetProgress}
                    disabled={isLoading}
                    variant="outline"
                    className="flex-1 border-red-300 dark:border-input text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 dark:hover:border-red-500"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-2" />
                    )}
                    {t('settings.progress.reset')}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Hint when nothing selected */}
            {!selectedUserId && !selectedCourseId && !isLoadingProgress && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-muted-foreground" />
                <p className="text-sm">{t('settings.progress.pickBoth')}</p>
              </div>
            )}
            
            {selectedUserId && !selectedCourseId && !isLoadingProgress && (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-muted-foreground" />
                <p className="text-sm">{t('settings.progress.pickCourse')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Change Password Section (all roles) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.password.title')}</CardTitle>
          <CardDescription>{t('settings.password.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <Label htmlFor="pw-current" className="text-sm font-medium">{t('settings.password.current')}</Label>
              <Input id="pw-current" type="password" required value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="pw-new" className="text-sm font-medium">{t('settings.password.new')}</Label>
              <Input id="pw-new" type="password" required value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder={t('settings.password.newPlaceholder')} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="pw-confirm" className="text-sm font-medium">{t('settings.password.confirm')}</Label>
              <Input id="pw-confirm" type="password" required value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={pwSaving}>
              {pwSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('settings.password.saving')}</> : t('settings.password.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {replayKind && (
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.tour.title')}</CardTitle>
            <CardDescription>
              {t('settings.tour.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => requestTourReplay(navigate, pathname)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {replayLabel(replayKind)}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

