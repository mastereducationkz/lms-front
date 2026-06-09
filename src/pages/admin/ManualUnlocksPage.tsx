import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import apiClient from '../../services/api'
import type { LessonProgressItem } from '../../services/api/progress'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { toast } from '../../components/Toast'
import Loader from '../../components/Loader'
import {
  Search,
  Lock,
  Unlock,
  ChevronRight,
  Layout,
  User as UserIcon,
  Users,
  CheckCircle2,
  Circle,
  RotateCcw,
  BookOpen,
} from 'lucide-react'
import type { Course, CourseModule, User, Group, ManualLessonUnlock } from '../../types'

type TargetType = 'user' | 'group'

interface SelectedTarget {
  id: number
  type: TargetType
  name: string
}

export default function ManualUnlocksPage() {
  useAuth()

  const [courses, setCourses] = useState<Course[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [allGroups, setAllGroups] = useState<Group[]>([])

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [targetUnlocks, setTargetUnlocks] = useState<ManualLessonUnlock[]>([])
  const [courseStructure, setCourseStructure] = useState<CourseModule[]>([])
  const [lessonProgress, setLessonProgress] = useState<Record<number, LessonProgressItem>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TargetType>('user')

  const [isLoading, setIsLoading] = useState(true)
  const [isStructureLoading, setIsStructureLoading] = useState(false)
  const [isProgressLoading, setIsProgressLoading] = useState(false)
  const [actionLessonId, setActionLessonId] = useState<number | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setIsLoading(true)
      const [coursesData, usersData, groupsData] = await Promise.all([
        apiClient.getCourses(),
        apiClient.getUsers({ limit: 1000 }),
        apiClient.getGroups(),
      ])

      setCourses(coursesData)
      setAllUsers((usersData.users || []).filter((u: User) => u.role === 'student'))
      setAllGroups(groupsData || [])
    } catch (error) {
      console.error('Failed to load initial data:', error)
      toast('Не удалось загрузить данные', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const loadTargetUnlocks = useCallback(async () => {
    if (!selectedTarget) return
    try {
      const params: { user_id?: number; group_id?: number } = {}
      if (selectedTarget.type === 'user') params.user_id = selectedTarget.id
      else params.group_id = selectedTarget.id

      const response = await apiClient.getManualUnlocks(params)
      setTargetUnlocks(Array.isArray(response) ? response : (response.unlocks || []))
    } catch (error) {
      console.error('Failed to load target unlocks:', error)
    }
  }, [selectedTarget])

  const loadLessonProgress = useCallback(async () => {
    if (!selectedTarget || !selectedCourseId) {
      setLessonProgress({})
      return
    }

    try {
      setIsProgressLoading(true)
      const params: { course_id: number; user_id?: number; group_id?: number } = {
        course_id: Number(selectedCourseId),
      }
      if (selectedTarget.type === 'user') params.user_id = selectedTarget.id
      else params.group_id = selectedTarget.id

      const data = await apiClient.getLessonProgressSummary(params)
      const map: Record<number, LessonProgressItem> = {}
      for (const lesson of data.lessons || []) {
        map[lesson.lesson_id] = lesson
      }
      setLessonProgress(map)
    } catch (error) {
      console.error('Failed to load lesson progress:', error)
      setLessonProgress({})
    } finally {
      setIsProgressLoading(false)
    }
  }, [selectedTarget, selectedCourseId])

  const loadCourseStructure = useCallback(async (courseId: string) => {
    try {
      setIsStructureLoading(true)
      const modulesData = await apiClient.getCourseModules(courseId)
      const fullStructure = await Promise.all(
        modulesData.map(async (m) => {
          if (m.lessons && m.lessons.length > 0) return m
          const lessons = await apiClient.getModuleLessons(courseId, m.id)
          return { ...m, lessons }
        })
      )
      setCourseStructure(fullStructure)
    } catch (error) {
      console.error('Failed to load course structure:', error)
    } finally {
      setIsStructureLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedTarget) loadTargetUnlocks()
    else setTargetUnlocks([])
  }, [selectedTarget, loadTargetUnlocks])

  useEffect(() => {
    if (selectedCourseId) loadCourseStructure(selectedCourseId)
    else setCourseStructure([])
  }, [selectedCourseId, loadCourseStructure])

  useEffect(() => {
    loadLessonProgress()
  }, [loadLessonProgress])

  const handleToggleUnlock = async (lessonId: number, currentlyUnlocked: boolean) => {
    if (!selectedTarget) {
      toast('Сначала выберите студента или группу', 'error')
      return
    }

    try {
      setActionLessonId(lessonId)
      const data: { lesson_id: number; user_id?: number; group_id?: number } = { lesson_id: lessonId }
      if (selectedTarget.type === 'user') data.user_id = selectedTarget.id
      else data.group_id = selectedTarget.id

      if (currentlyUnlocked) {
        await apiClient.manualLockLesson(data)
        toast('Доступ закрыт', 'success')
      } else {
        await apiClient.manualUnlockLesson(data)
        toast('Доступ открыт', 'success')
      }
      loadTargetUnlocks()
    } catch (error: any) {
      toast(error.message || error.response?.data?.detail || 'Ошибка', 'error')
    } finally {
      setActionLessonId(null)
    }
  }

  const handleCompleteLesson = async (lessonId: number) => {
    if (!selectedTarget || !selectedCourseId) return

    try {
      setActionLessonId(lessonId)
      const data: {
        course_id: number
        lesson_ids: number[]
        user_id?: number
        group_id?: number
      } = {
        course_id: Number(selectedCourseId),
        lesson_ids: [lessonId],
      }
      if (selectedTarget.type === 'user') data.user_id = selectedTarget.id
      else data.group_id = selectedTarget.id

      await apiClient.completeLessonsForTarget(data)
      toast(
        selectedTarget.type === 'group'
          ? 'Юнит отмечен пройденным для всех студентов группы'
          : 'Юнит отмечен пройденным',
        'success'
      )
      loadLessonProgress()
    } catch (error: any) {
      toast(error.message || 'Не удалось отметить юнит', 'error')
    } finally {
      setActionLessonId(null)
    }
  }

  const handleResetLesson = async (lessonId: number) => {
    if (!selectedTarget || !selectedCourseId) return

    try {
      setActionLessonId(lessonId)
      const data: {
        course_id: number
        lesson_ids: number[]
        user_id?: number
        group_id?: number
      } = {
        course_id: Number(selectedCourseId),
        lesson_ids: [lessonId],
      }
      if (selectedTarget.type === 'user') data.user_id = selectedTarget.id
      else data.group_id = selectedTarget.id

      await apiClient.resetLessonsForTarget(data)
      toast(
        selectedTarget.type === 'group'
          ? 'Прогресс сброшен для всех студентов группы'
          : 'Прогресс сброшен',
        'success'
      )
      loadLessonProgress()
    } catch (error: any) {
      toast(error.message || 'Не удалось сбросить прогресс', 'error')
    } finally {
      setActionLessonId(null)
    }
  }

  const unlockedLessonIds = useMemo(() => {
    return new Set(targetUnlocks.map((u) => Number(u.lesson_id)))
  }, [targetUnlocks])

  const completedCount = useMemo(() => {
    return Object.values(lessonProgress).filter((l) => l.is_complete).length
  }, [lessonProgress])

  const totalLessonCount = useMemo(() => {
    return courseStructure.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)
  }, [courseStructure])

  const filteredTargets = useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (activeTab === 'user') {
      return allUsers
        .filter(
          (u) =>
            (u.name || u.full_name || '').toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
        )
        .slice(0, 50)
    }
    return allGroups.filter((g) => g.name.toLowerCase().includes(q))
  }, [activeTab, searchQuery, allUsers, allGroups])

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-900 dark:text-foreground font-sans p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
              Управление доступом и прогрессом
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
              Открывайте юниты вручную или отмечайте их пройденными за студента или всю группу.
              Задания с типом «юнит курса» у студента будут считаться выполненными.
            </p>
          </div>
          {selectedTarget && selectedCourseId && totalLessonCount > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline" className="bg-white dark:bg-card">
                Пройдено: {completedCount}/{totalLessonCount}
              </Badge>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Поиск студентов или групп..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 border-gray-200 dark:border-border bg-white dark:bg-card"
                />
              </div>
              <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  setActiveTab(v as TargetType)
                  setSelectedTarget(null)
                }}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid grid-cols-2 w-full sm:w-[260px] bg-gray-100 dark:bg-secondary">
                  <TabsTrigger value="user" className="text-sm font-medium gap-1.5">
                    <UserIcon className="w-3.5 h-3.5" />
                    Студенты
                  </TabsTrigger>
                  <TabsTrigger value="group" className="text-sm font-medium gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Группы
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {filteredTargets.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <UserIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">Ничего не найдено</p>
                  </CardContent>
                </Card>
              ) : (
                filteredTargets.map((target) => {
                  const targetId = Number(target.id)
                  const isSelected =
                    selectedTarget?.id === targetId && selectedTarget?.type === activeTab
                  return (
                    <Card
                      key={target.id}
                      onClick={() =>
                        setSelectedTarget({
                          id: targetId,
                          type: activeTab,
                          name:
                            activeTab === 'user'
                              ? ((target as User).name || (target as User).full_name || '')
                              : (target as Group).name,
                        })
                      }
                      className={`cursor-pointer transition-all hover:border-blue-300 ${
                        isSelected
                          ? 'ring-2 ring-blue-500 border-transparent shadow-sm'
                          : 'border-gray-200 dark:border-border'
                      }`}
                    >
                      <CardContent className="p-3.5 flex items-center justify-between">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
                            {activeTab === 'user'
                              ? (target as User).name || (target as User).full_name
                              : (target as Group).name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {activeTab === 'user'
                              ? (target as User).email
                              : `${(target as Group).student_count || 0} студентов`}
                          </p>
                        </div>
                        <ChevronRight
                          className={`w-5 h-5 shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}
                        />
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-3 lg:sticky lg:top-6">
            <Card className="border-gray-200 dark:border-border shadow-sm overflow-hidden min-h-[480px]">
              <CardHeader className="bg-gray-50 dark:bg-secondary border-b p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground">
                      {selectedTarget ? selectedTarget.name : 'Выберите цель'}
                    </CardTitle>
                    {selectedTarget && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {selectedTarget.type === 'user' ? 'Студент' : 'Группа'} · юниты курса
                      </p>
                    )}
                  </div>
                  {selectedTarget && (
                    <Badge variant="secondary" className="shrink-0">
                      {selectedTarget.type === 'user' ? (
                        <UserIcon className="w-3 h-3 mr-1" />
                      ) : (
                        <Users className="w-3 h-3 mr-1" />
                      )}
                      {selectedTarget.type === 'user' ? 'Студент' : 'Группа'}
                    </Badge>
                  )}
                </div>
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="w-full bg-white dark:bg-card border-gray-200 dark:border-border text-sm">
                    <SelectValue placeholder="Выберите курс..." />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id.toString()}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>

              <CardContent className="p-0">
                {!selectedTarget ? (
                  <div className="py-24 flex flex-col items-center justify-center text-center px-8">
                    <UserIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                    <h5 className="font-bold text-gray-900 dark:text-foreground">
                      Выберите студента или группу
                    </h5>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Слева — список для поиска и выбора
                    </p>
                  </div>
                ) : !selectedCourseId ? (
                  <div className="py-24 flex flex-col items-center justify-center text-center px-8">
                    <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                    <h5 className="font-bold text-gray-900 dark:text-foreground">Выберите курс</h5>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      После выбора появятся юниты с действиями
                    </p>
                  </div>
                ) : isStructureLoading || isProgressLoading ? (
                  <div className="py-24 flex items-center justify-center">
                    <Loader size="lg" />
                  </div>
                ) : (
                  <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                    {courseStructure.map((module) => (
                      <div key={module.id}>
                        <div className="bg-gray-50/80 dark:bg-secondary px-4 py-2.5 border-y border-gray-100 dark:border-border flex items-center justify-between sticky top-0 z-10">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            {module.title}
                          </span>
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            {module.lessons?.length || 0} юнитов
                          </span>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-border">
                          {module.lessons?.map((lesson) => {
                            const lessonId = Number(lesson.id)
                            const unlocked = unlockedLessonIds.has(lessonId)
                            const progress = lessonProgress[lessonId]
                            const isComplete = progress?.is_complete ?? false
                            const isBusy = actionLessonId === lessonId

                            return (
                              <div
                                key={lesson.id}
                                className={`p-4 transition-colors ${
                                  isComplete
                                    ? 'bg-green-50/80 dark:bg-green-950/20 border-l-4 border-l-green-500'
                                    : 'hover:bg-gray-50/50 dark:hover:bg-secondary/50 border-l-4 border-l-transparent'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                                  <div className="space-y-1.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {isComplete ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                                      ) : (
                                        <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                                      )}
                                      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                                        Юнит {lesson.order_index}
                                      </span>
                                      {unlocked && (
                                        <Badge
                                          variant="outline"
                                          className="h-5 text-[10px] font-semibold border-amber-200 bg-amber-50 text-amber-700"
                                        >
                                          Открыт вручную
                                        </Badge>
                                      )}
                                      {isComplete && (
                                        <Badge
                                          variant="outline"
                                          className="h-5 text-[10px] font-semibold border-green-200 bg-green-100 text-green-700"
                                        >
                                          Пройден
                                        </Badge>
                                      )}
                                    </div>
                                    <div
                                      className={`text-sm font-semibold truncate ${
                                        isComplete
                                          ? 'text-green-800 dark:text-green-300'
                                          : 'text-gray-900 dark:text-foreground'
                                      }`}
                                    >
                                      {lesson.title}
                                    </div>
                                    {progress && selectedTarget.type === 'group' && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {progress.completed_students}/{progress.student_count} студентов
                                        прошли · {progress.completion_percentage}%
                                      </p>
                                    )}
                                    {progress && selectedTarget.type === 'user' && progress.total_steps > 0 && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Шаги: {progress.completed_steps}/{progress.total_steps} ·{' '}
                                        {progress.completion_percentage}%
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleToggleUnlock(lessonId, unlocked)}
                                      disabled={isBusy}
                                      className={`h-8 px-3 text-xs font-medium ${
                                        unlocked
                                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                                          : 'border-gray-300'
                                      }`}
                                      aria-label={unlocked ? 'Закрыть доступ' : 'Открыть доступ'}
                                    >
                                      {unlocked ? (
                                        <>
                                          <Unlock className="w-3.5 h-3.5 mr-1.5" />
                                          Закрыть
                                        </>
                                      ) : (
                                        <>
                                          <Lock className="w-3.5 h-3.5 mr-1.5" />
                                          Открыть
                                        </>
                                      )}
                                    </Button>

                                    {isComplete ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleResetLesson(lessonId)}
                                        disabled={isBusy}
                                        className="h-8 px-3 text-xs font-medium border-orange-200 text-orange-700 hover:bg-orange-50"
                                        aria-label="Сбросить прогресс юнита"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                        Сбросить
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => handleCompleteLesson(lessonId)}
                                        disabled={isBusy}
                                        className="h-8 px-3 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white"
                                        aria-label="Отметить юнит пройденным"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                        Пройти юнит
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    {courseStructure.length === 0 && (
                      <div className="py-16 flex flex-col items-center justify-center text-center px-8">
                        <Layout className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          В этом курсе пока нет юнитов
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
