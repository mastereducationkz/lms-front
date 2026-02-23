import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { toast } from '../../components/Toast';
import Loader from '../../components/Loader';
import { 
  Search, 
  Lock, 
  Unlock, 
  ChevronRight,
  Layout,
  User as UserIcon
} from 'lucide-react';
import type { Course, CourseModule, User, Group, ManualLessonUnlock } from '../../types';

type TargetType = 'user' | 'group';

interface SelectedTarget {
  id: number;
  type: TargetType;
  name: string;
}

export default function ManualUnlocksPage() {
  const navigate = useNavigate();
  useAuth();
  
  // Data State
  const [courses, setCourses] = useState<Course[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  
  // UI State
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [targetUnlocks, setTargetUnlocks] = useState<ManualLessonUnlock[]>([]);
  const [courseStructure, setCourseStructure] = useState<CourseModule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TargetType>('user');
  
  // Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [coursesData, usersData, groupsData] = await Promise.all([
        apiClient.getCourses(),
        apiClient.getUsers({ limit: 1000 }), 
        apiClient.getGroups()
      ]);
      
      setCourses(coursesData);
      setAllUsers((usersData.users || []).filter((u: User) => u.role === 'student'));
      setAllGroups(groupsData || []);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast('Failed to load data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTarget) {
      loadTargetUnlocks();
    } else {
      setTargetUnlocks([]);
    }
  }, [selectedTarget]);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseStructure(selectedCourseId);
    } else {
      setCourseStructure([]);
    }
  }, [selectedCourseId]);

  const loadTargetUnlocks = async () => {
    if (!selectedTarget) return;
    try {
      const params: any = {};
      if (selectedTarget.type === 'user') params.user_id = selectedTarget.id;
      else params.group_id = selectedTarget.id;
      
      const response = await apiClient.getManualUnlocks(params);
      setTargetUnlocks(Array.isArray(response) ? response : (response.unlocks || []));
    } catch (error) {
      console.error('Failed to load target unlocks:', error);
    }
  };

  const loadCourseStructure = async (courseId: string) => {
    try {
      setIsStructureLoading(true);
      const modulesData = await apiClient.getCourseModules(courseId);
      const fullStructure = await Promise.all(
        modulesData.map(async (m) => {
          if (m.lessons && m.lessons.length > 0) return m;
          const lessons = await apiClient.getModuleLessons(courseId, m.id);
          return { ...m, lessons };
        })
      );
      setCourseStructure(fullStructure);
    } catch (error) {
      console.error('Failed to load course structure:', error);
    } finally {
      setIsStructureLoading(false);
    }
  };

  const handleToggleUnlock = async (lessonId: number, currentlyUnlocked: boolean) => {
    if (!selectedTarget) {
      toast('Please select a student or group first', 'error');
      return;
    }

    try {
      setIsActionLoading(true);
      const data: any = { lesson_id: lessonId };
      if (selectedTarget.type === 'user') data.user_id = selectedTarget.id;
      else data.group_id = selectedTarget.id;

      if (currentlyUnlocked) {
        await apiClient.manualLockLesson(data);
        toast('Access revoked successfully', 'success');
      } else {
        await apiClient.manualUnlockLesson(data);
        toast('Access granted successfully', 'success');
      }
      loadTargetUnlocks();
    } catch (error: any) {
      toast(error.response?.data?.detail || 'Action failed', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const unlockedLessonIds = useMemo(() => {
    return new Set(targetUnlocks.map(u => Number(u.lesson_id)));
  }, [targetUnlocks]);

  const filteredTargets = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (activeTab === 'user') {
      return allUsers.filter(u => 
        (u.name || u.full_name || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      ).slice(0, 50);
    } else {
      return allGroups.filter(g => g.name.toLowerCase().includes(q));
    }
  }, [activeTab, searchQuery, allUsers, allGroups]);

  if (isLoading) {
    return <div className="h-[80vh] flex items-center justify-center"><Loader size="lg" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-900 dark:text-foreground font-sans p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Manual Unlocks</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage student and group access overrides for course lessons</p>
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Column: Explorer */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Search students or groups..." 
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 border-gray-200 dark:border-border bg-white dark:bg-card"
                />
              </div>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TargetType)} className="w-full sm:w-auto">
                <TabsList className="grid grid-cols-2 w-full sm:w-[240px] bg-gray-100 dark:bg-secondary">
                  <TabsTrigger value="user" className="text-sm font-medium">
                    Students
                  </TabsTrigger>
                  <TabsTrigger value="group" className="text-sm font-medium">
                    Groups
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-3">
              {filteredTargets.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <UserIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">No results found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredTargets.map((target: any) => {
                  const isSelected = selectedTarget?.id === (target.id || Number(target.id)) && selectedTarget?.type === activeTab;
                  return (
                    <Card 
                      key={target.id}
                      onClick={() => setSelectedTarget({ 
                        id: Number(target.id), 
                        type: activeTab, 
                        name: activeTab === 'user' ? (target.name || target.full_name || '') : target.name 
                      })}
                      className={`cursor-pointer transition-all hover:border-blue-300 ${isSelected ? 'ring-2 ring-blue-500 border-transparent shadow-sm' : 'border-gray-200 dark:border-border'}`}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-foreground truncate">
                            {activeTab === 'user' ? (target.name || target.full_name) : target.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {activeTab === 'user' ? target.email : `${target.student_count || 0} Students`}
                          </p>
                        </div>
                        <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Details (Sticky) */}
          <div className="lg:sticky lg:top-6">
            <Card className="border-gray-200 dark:border-border shadow-sm overflow-hidden min-h-[400px]">
              <CardHeader className="bg-gray-50 dark:bg-secondary border-b p-4">
                <div className="flex flex-col gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground">
                      {selectedTarget ? selectedTarget.name : 'Target Details'}
                    </CardTitle>
                    {selectedTarget && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Manage overrides for this {selectedTarget.type}</p>
                    )}
                  </div>
                  <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                    <SelectTrigger className="w-full bg-white dark:bg-card border-gray-200 dark:border-border text-sm">
                      <SelectValue placeholder="Select a course..." />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id.toString()}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedTarget ? (
                  <div className="py-24 flex flex-col items-center justify-center text-center px-8">
                    <UserIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                    <h5 className="font-bold text-gray-900 dark:text-foreground">No Target Selected</h5>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Pick a student or group from the list.</p>
                  </div>
                ) : !selectedCourseId ? (
                  <div className="py-24 flex flex-col items-center justify-center text-center px-8">
                    <Layout className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                    <h5 className="font-bold text-gray-900 dark:text-foreground">No Course Selected</h5>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Choose a course to view lessons.</p>
                  </div>
                ) : isStructureLoading ? (
                  <div className="py-24 flex items-center justify-center">
                    <Loader size="lg" />
                  </div>
                ) : (
                  <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                    {courseStructure.map((module) => (
                      <div key={module.id}>
                        <div className="bg-gray-50/80 dark:bg-secondary px-4 py-2 border-y border-gray-100 dark:border-border flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">{module.title}</span>
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{module.lessons?.length || 0} Units</span>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-border">
                          {module.lessons?.map((lesson) => {
                            const unlocked = unlockedLessonIds.has(Number(lesson.id));
                            return (
                              <div key={lesson.id} className="p-4 flex items-center justify-between hover:bg-gray-50/30 dark:hover:bg-secondary">
                                <div className="space-y-1 min-w-0 flex-1 mr-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Unit {lesson.order_index}</span>
                                    {unlocked && (
                                      <Badge variant="outline" className="h-4 text-[10px] font-bold border-green-200 bg-green-50 text-green-700">Active Unlock</Badge>
                                    )}
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">{lesson.title}</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant={unlocked ? 'outline' : 'default'}
                                  onClick={() => handleToggleUnlock(Number(lesson.id), unlocked)}
                                  disabled={isActionLoading}
                                  className={`h-8 px-4 text-xs font-bold uppercase transition-all ${
                                    unlocked 
                                      ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' 
                                      : 'bg-gray-900 text-white hover:bg-black'
                                  }`}
                                >
                                  {unlocked ? (
                                    <><Unlock className="w-3.5 h-3.5 mr-2" /> Revoke</>
                                  ) : (
                                    <><Lock className="w-3.5 h-3.5 mr-2" /> Unlock</>
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
