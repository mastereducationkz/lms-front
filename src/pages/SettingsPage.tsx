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
import { storage } from '../utils/storage';
import apiClient from '../services/api';

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
        message: `✅ ${result.statistics.newly_completed} шагов завершено, ${result.statistics.updated} обновлено, ${result.statistics.already_completed} уже были завершены`
      });
      
      // Reload progress
      await loadProgressSummary();
    } catch (error: any) {
      setActionResult({
        type: 'error',
        message: error.message || 'Ошибка при завершении шагов'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetProgress = async () => {
    if (!selectedUserId || !selectedCourseId) return;
    
    if (!confirm('Вы уверены, что хотите сбросить прогресс? Это действие нельзя отменить.')) {
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
        message: `✅ Удалено ${result.deleted_records} записей прогресса`
      });
      
      // Reload progress
      await loadProgressSummary();
    } catch (error: any) {
      setActionResult({
        type: 'error',
        message: error.message || 'Ошибка при сбросе прогресса'
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

  const handleRestartTour = () => {
    if (!user) return;
    const tourName = `${user.role}-onboarding`;
    storage.setItem('pending_tour', tourName);
    window.location.href = '/dashboard';
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Настройки</h1>
      
      {/* Admin Progress Management Section */}
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Управление прогрессом студентов</CardTitle>
                <CardDescription>Завершить или сбросить шаги за студента</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Selection Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User Search & Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  Студент
                </Label>
                
                <div className="relative user-search-dropdown">
                  {selectedUser ? (
                    <div className="flex items-center justify-between px-3 py-2 border rounded-md bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-gray-700">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{selectedUser.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{selectedUser.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearUserSelection}
                        className="ml-2 h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <Input
                          placeholder="Поиск по имени или email..."
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
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-card border dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredUsers.length === 0 ? (
                            <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                              {userSearch ? 'Студенты не найдены' : 'Введите имя или email'}
                            </div>
                          ) : (
                            filteredUsers.slice(0, 50).map(u => (
                              <div
                                key={u.id}
                                onClick={() => selectUserFromDropdown(u.id)}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b dark:border-gray-700 last:border-b-0"
                              >
                                <p className="font-medium text-sm">{u.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                              </div>
                            ))
                          )}
                          {filteredUsers.length > 50 && (
                            <div className="px-3 py-2 text-center text-gray-400 dark:text-gray-500 text-xs">
                              Показано 50 из {filteredUsers.length}. Уточните поиск.
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
                  Курс
                </Label>
                <Select
                  value={selectedCourseId?.toString() || ''}
                  onValueChange={(value) => setSelectedCourseId(value ? Number(value) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите курс..." />
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
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="ml-2 text-gray-600 dark:text-gray-300">Загрузка прогресса...</span>
              </div>
            )}
            
            {progressSummary && !isLoadingProgress && (
              <div className="space-y-4">
                {/* Overall Progress Card */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-gray-700">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{progressSummary.user.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{progressSummary.course.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {progressSummary.overall.completion_percentage.toFixed(0)}%
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {progressSummary.overall.completed_steps} / {progressSummary.overall.total_steps} шагов
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
                      Выберите уроки (или оставьте пустым для всех)
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedLessons.length > 0 ? `Выбрано: ${selectedLessons.length}` : 'Все уроки'}
                      </span>
                      {showLessons ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
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
                          Выбрать все
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={deselectAllLessons}
                          className="text-xs"
                        >
                          Снять выбор
                        </Button>
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                        {progressSummary.lessons.map(lesson => (
                          <div
                            key={lesson.lesson_id}
                            className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                              selectedLessons.includes(lesson.lesson_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                            onClick={() => toggleLessonSelection(lesson.lesson_id)}
                          >
                            <Checkbox
                              checked={selectedLessons.includes(lesson.lesson_id)}
                              onCheckedChange={() => toggleLessonSelection(lesson.lesson_id)}
                              className="mr-3"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {lesson.lesson_title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {lesson.module_title}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 ml-2">
                              <div className="text-right">
                                <p className="text-xs font-medium">
                                  {lesson.completed_steps}/{lesson.total_steps}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
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
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-gray-700' 
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-gray-700'
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
                    Завершить {selectedLessons.length > 0 ? `(${selectedLessons.length} уроков)` : 'все шаги'}
                  </Button>
                  
                  <Button
                    onClick={handleResetProgress}
                    disabled={isLoading}
                    variant="outline"
                    className="flex-1 border-red-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 dark:hover:border-red-500"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RotateCcw className="w-4 h-4 mr-2" />
                    )}
                    Сбросить прогресс
                  </Button>
                </div>
              </div>
            )}
            
            {/* Hint when nothing selected */}
            {!selectedUserId && !selectedCourseId && !isLoadingProgress && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-400" />
                <p className="text-sm">Выберите студента и курс, чтобы управлять прогрессом</p>
              </div>
            )}
            
            {selectedUserId && !selectedCourseId && !isLoadingProgress && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-400" />
                <p className="text-sm">Выберите курс для просмотра прогресса</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Onboarding Section */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding & Tour</CardTitle>
          <CardDescription>
            Restart the platform tour or reset the complete onboarding experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleRestartTour}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Restart Tour
          </Button>
          
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The tour will guide you through the main features of your {user?.role || 'user'} dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

