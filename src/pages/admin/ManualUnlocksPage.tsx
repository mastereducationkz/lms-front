import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import apiClient from '../../services/api'
import type { LessonProgressItem } from '../../services/api/progress'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { toast } from '../../components/Toast'
import Loader from '../../components/Loader'
import {
  Search,
  Lock,
  Unlock,
  ChevronDown,
  Layout,
  User as UserIcon,
  Users,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  X,
  History,
} from 'lucide-react'
import type { Course, CourseModule, User, Group, ManualLessonUnlock, Lesson } from '../../types'
import type { MessageKey } from '../../lib/i18n'
import { useT } from '../../lib/i18n/react'
import '@/lib/i18n/catalogs/adminPages'

type TargetType = 'user' | 'group'
type UnitFilter = 'all' | 'incomplete' | 'complete' | 'unlocked'

interface SelectedTarget {
  id: number
  type: TargetType
  name: string
  courseId?: number
}

const resolveCourseIdForGroup = (group: Group | undefined, courses: Course[]): string => {
  if (!group) return ''

  const linkedIds = (group.course_ids?.length ? group.course_ids : group.course_id ? [group.course_id] : [])
    .map((id: number) => Number(id))
    .filter((id: number) => Number.isFinite(id))

  if (linkedIds.length === 0) return ''

  const availableIds = new Set(courses.map((course) => Number(course.id)))
  const matchedId = linkedIds.find((id: number) => availableIds.has(id))
  return String(matchedId ?? linkedIds[0])
}


const unitFilterOptions: { value: UnitFilter; label: MessageKey }[] = [
  { value: 'all', label: 'common.all' },
  { value: 'incomplete', label: 'adminPages.manualUnlocks.filter.incomplete' },
  { value: 'complete', label: 'adminPages.manualUnlocks.filter.complete' },
  { value: 'unlocked', label: 'adminPages.manualUnlocks.filter.unlocked' },
]

const RECENT_TARGETS_KEY = 'manual-unlocks-recent-v1'
const STUDENT_PAGE_SIZE = 50

type RecentTarget = SelectedTarget & { email?: string }

const loadRecentTargets = (): RecentTarget[] => {
  try {
    const raw = localStorage.getItem(RECENT_TARGETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveRecentTarget = (target: RecentTarget) => {
  const list = loadRecentTargets().filter(
    (item) => !(item.id === target.id && item.type === target.type)
  )
  localStorage.setItem(
    RECENT_TARGETS_KEY,
    JSON.stringify([target, ...list].slice(0, 8))
  )
}

export default function ManualUnlocksPage() {
  const { user } = useAuth()
  const t = useT()

  const [courses, setCourses] = useState<Course[]>([])
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [studentsTotal, setStudentsTotal] = useState(0)
  const [studentsLoading, setStudentsLoading] = useState(false)

  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [targetUnlocks, setTargetUnlocks] = useState<ManualLessonUnlock[]>([])
  const [courseStructure, setCourseStructure] = useState<CourseModule[]>([])
  const [lessonProgress, setLessonProgress] = useState<Record<number, LessonProgressItem>>({})
  // The course number for the target (student, or the group's average) — from the backend,
  // the same value every other screen shows; never recomputed here.
  const [overall, setOverall] = useState<{ completion_percentage: number; lessons_done?: number; lessons_total?: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [studentGroupFilter, setStudentGroupFilter] = useState<string>('all')
  const [groupSearchQuery, setGroupSearchQuery] = useState('')
  const [unitSearch, setUnitSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all')
  const [activeTab, setActiveTab] = useState<TargetType>('user')
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({})
  const [recentTargets, setRecentTargets] = useState<RecentTarget[]>(loadRecentTargets)

  const [isLoading, setIsLoading] = useState(true)
  const [isStructureLoading, setIsStructureLoading] = useState(false)
  const [isProgressLoading, setIsProgressLoading] = useState(false)
  const [actionLessonId, setActionLessonId] = useState<number | null>(null)

  const studentSearchRef = useRef<HTMLInputElement>(null)
  const studentsRef = useRef<User[]>([])
  studentsRef.current = students

  useEffect(() => {
    loadInitialData()
  }, [user?.role])

  const loadInitialData = async () => {
    try {
      setIsLoading(true)
      const usesOwnGroupsOnly = user?.role === 'teacher'
      const isHeadTeacher = user?.role === 'head_teacher'

      const [coursesData, groupsData] = await Promise.all([
        isHeadTeacher ? apiClient.getHeadTeacherManagedCourses() : apiClient.getCourses(),
        usesOwnGroupsOnly ? apiClient.getTeacherGroups() : apiClient.getGroups(),
      ])

      setCourses(coursesData as Course[])
      setAllGroups(groupsData || [])
    } catch (error) {
      console.error('Failed to load initial data:', error)
      toast(t('adminPages.manualUnlocks.loadFailed'), 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedTarget || selectedTarget.type !== 'group' || courses.length === 0) return

    const group = allGroups.find((g) => Number(g.id) === selectedTarget.id)
    const courseId = resolveCourseIdForGroup(group, courses)
    if (!courseId) return

    if (courseId !== selectedCourseId) {
      setSelectedCourseId(courseId)
    }
  }, [selectedTarget, allGroups, courses, selectedCourseId])

  const fetchStudents = useCallback(
    async (reset: boolean) => {
      const q = searchQuery.trim()
      const groupId =
        studentGroupFilter !== 'all' ? Number(studentGroupFilter) : undefined

      if (!groupId && q.length < 2) {
        setStudents([])
        setStudentsTotal(0)
        return
      }

      setStudentsLoading(true)
      try {
        const skip = reset ? 0 : studentsRef.current.length
        const data = await apiClient.getUsers({
          role: 'student',
          search: q || undefined,
          group_id: groupId,
          limit: STUDENT_PAGE_SIZE,
          skip,
        })
        const batch = data.users || []
        setStudents(reset ? batch : [...studentsRef.current, ...batch])
        setStudentsTotal(data.total || 0)
      } catch (error) {
        console.error('Failed to load students:', error)
        if (reset) {
          setStudents([])
          setStudentsTotal(0)
        }
      } finally {
        setStudentsLoading(false)
      }
    },
    [searchQuery, studentGroupFilter]
  )

  useEffect(() => {
    if (activeTab !== 'user') return

    const timer = window.setTimeout(() => {
      fetchStudents(true)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchQuery, studentGroupFilter, activeTab, fetchStudents])

  const handleSelectTarget = (target: RecentTarget, linkedGroup?: Group) => {
    const nextTarget: SelectedTarget = { ...target }
    if (target.type === 'group') {
      const group = linkedGroup ?? allGroups.find((g) => Number(g.id) === target.id)
      const courseId = resolveCourseIdForGroup(group, courses)
      if (courseId) {
        nextTarget.courseId = Number(courseId)
        setSelectedCourseId(courseId)
      }
    }
    setSelectedTarget(nextTarget)
    saveRecentTarget(target)
    setRecentTargets(loadRecentTargets())
  }

  const handleClearTarget = () => {
    setSelectedTarget(null)
    setTimeout(() => studentSearchRef.current?.focus(), 0)
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
      setOverall(data.overall ?? null)
    } catch (error) {
      console.error('Failed to load lesson progress:', error)
      setLessonProgress({})
      setOverall(null)
      toast(t('adminPages.manualUnlocks.loadProgressFailed'), 'error')
    } finally {
      setIsProgressLoading(false)
    }
  }, [selectedTarget, selectedCourseId, t])

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
      const expanded: Record<number, boolean> = {}
      fullStructure.forEach((m) => {
        expanded[Number(m.id)] = true
      })
      setExpandedModules(expanded)
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
      toast(t('adminPages.manualUnlocks.selectTargetFirst'), 'error')
      return
    }

    try {
      setActionLessonId(lessonId)
      const data: { lesson_id: number; user_id?: number; group_id?: number } = { lesson_id: lessonId }
      if (selectedTarget.type === 'user') data.user_id = selectedTarget.id
      else data.group_id = selectedTarget.id

      if (currentlyUnlocked) {
        await apiClient.manualLockLesson(data)
        toast(t('adminPages.manualUnlocks.accessRevoked'), 'success')
      } else {
        await apiClient.manualUnlockLesson(data)
        toast(t('adminPages.manualUnlocks.accessGranted'), 'success')
      }
      loadTargetUnlocks()
    } catch (error: any) {
      toast(error.message || error.response?.data?.detail || t('adminPages.manualUnlocks.actionFailed'), 'error')
    } finally {
      setActionLessonId(null)
    }
  }

  const handleCompleteLesson = async (lessonId: number) => {
    if (!selectedTarget || !selectedCourseId) return

    try {
      setActionLessonId(lessonId)
      const data = {
        course_id: Number(selectedCourseId),
        lesson_ids: [lessonId],
        ...(selectedTarget.type === 'user'
          ? { user_id: selectedTarget.id }
          : { group_id: selectedTarget.id }),
      }

      await apiClient.completeLessonsForTarget(data)
      toast(
        selectedTarget.type === 'group'
          ? t('adminPages.manualUnlocks.completedForGroup')
          : t('adminPages.manualUnlocks.completedForStudent'),
        'success'
      )
      loadLessonProgress()
    } catch (error: any) {
      toast(error.message || t('adminPages.manualUnlocks.completeFailed'), 'error')
    } finally {
      setActionLessonId(null)
    }
  }

  const handleResetLesson = async (lessonId: number) => {
    if (!selectedTarget || !selectedCourseId) return

    try {
      setActionLessonId(lessonId)
      const data = {
        course_id: Number(selectedCourseId),
        lesson_ids: [lessonId],
        ...(selectedTarget.type === 'user'
          ? { user_id: selectedTarget.id }
          : { group_id: selectedTarget.id }),
      }

      await apiClient.resetLessonsForTarget(data)
      toast(
        selectedTarget.type === 'group'
          ? t('adminPages.manualUnlocks.resetForGroup')
          : t('adminPages.manualUnlocks.resetForStudent'),
        'success'
      )
      loadLessonProgress()
    } catch (error: any) {
      toast(error.message || t('adminPages.manualUnlocks.resetFailed'), 'error')
    } finally {
      setActionLessonId(null)
    }
  }

  const unlockedLessonIds = useMemo(() => {
    return new Set(targetUnlocks.map((u) => Number(u.lesson_id)))
  }, [targetUnlocks])

  const lessonMatchesFilter = useCallback(
    (lesson: Lesson) => {
      const lessonId = Number(lesson.id)
      const isComplete = lessonProgress[lessonId]?.is_complete ?? false
      const unlocked = unlockedLessonIds.has(lessonId)
      const q = unitSearch.trim().toLowerCase()

      if (q && !lesson.title.toLowerCase().includes(q)) return false

      if (unitFilter === 'incomplete') return !isComplete
      if (unitFilter === 'complete') return isComplete
      if (unitFilter === 'unlocked') return unlocked
      return true
    },
    [lessonProgress, unlockedLessonIds, unitFilter, unitSearch]
  )

  const filteredModules = useMemo(() => {
    return courseStructure
      .map((module) => ({
        ...module,
        lessons: (module.lessons || []).filter(lessonMatchesFilter),
      }))
      .filter((module) => (module.lessons?.length || 0) > 0)
  }, [courseStructure, lessonMatchesFilter])

  const stats = useMemo(() => {
    let completed = 0
    let unlocked = 0
    let total = 0

    for (const module of courseStructure) {
      for (const lesson of module.lessons || []) {
        total += 1
        const lessonId = Number(lesson.id)
        if (lessonProgress[lessonId]?.is_complete) completed += 1
        if (unlockedLessonIds.has(lessonId)) unlocked += 1
      }
    }

    // Counted lessons and the percentage come from the backend rule (checkpoint quizzes and
    // step-less lessons are listed but never counted).
    const countedTotal = overall?.lessons_total ?? total
    const countedDone = overall?.lessons_done ?? completed
    return {
      total: countedTotal,
      completed: countedDone,
      unlocked,
      remaining: countedTotal - countedDone,
      percent: overall?.completion_percentage ?? 0,
    }
  }, [courseStructure, lessonProgress, unlockedLessonIds, overall])

  const filteredGroups = useMemo(() => {
    const q = groupSearchQuery.toLowerCase()
    return allGroups.filter((g) => g.name.toLowerCase().includes(q))
  }, [groupSearchQuery, allGroups])

  const availableCourses = useMemo(() => {
    if (!selectedTarget || selectedTarget.type !== 'group') return courses

    const group = allGroups.find((g) => Number(g.id) === selectedTarget.id)
    const linkedIds = (group?.course_ids?.length ? group.course_ids : group?.course_id ? [group.course_id] : [])
      .map((id: number) => Number(id))

    if (linkedIds.length === 0) return courses

    return courses.filter((course) => linkedIds.includes(Number(course.id)))
  }, [courses, selectedTarget, allGroups])

  const canSearchStudents =
    studentGroupFilter !== 'all' || searchQuery.trim().length >= 2

  const hasMoreStudents = students.length < studentsTotal

  const toggleModule = (moduleId: number) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  const getModuleStats = (module: CourseModule) => {
    const lessons = module.lessons || []
    const done = lessons.filter((l) => lessonProgress[Number(l.id)]?.is_complete).length
    return { done, total: lessons.length }
  }

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader size="lg" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col @lg:flex-row @lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('adminPages.manualUnlocks.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('adminPages.manualUnlocks.subtitle')}</p>
        </div>
        {selectedTarget && selectedCourseId && stats.total > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('adminPages.manualUnlocks.completedOf', { done: stats.completed, total: stats.total })}</span>
            <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-foreground tabular-nums w-10">{stats.percent}%</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 @3xl:grid-cols-12 gap-4 items-start">
        {/* ── Left panel: selector ── */}
        <div className="@3xl:col-span-4 @6xl:col-span-3 flex flex-col gap-3">
          {/* Tabs */}
          <div className="flex border border-border rounded-lg overflow-hidden bg-card">
            <button
              type="button"
              onClick={() => { setActiveTab('user'); setSelectedTarget(null); setSearchQuery(''); setGroupSearchQuery('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                activeTab === 'user'
                  ? 'bg-gray-900 text-white dark:bg-brand-surface dark:text-brand-subtle-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              {t('adminPages.manualUnlocks.students')}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('group'); setSelectedTarget(null); setSearchQuery(''); setGroupSearchQuery('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors border-l border-border ${
                activeTab === 'group'
                  ? 'bg-gray-900 text-white dark:bg-brand-surface dark:text-brand-subtle-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              {t('adminPages.manualUnlocks.groups')}
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            {activeTab === 'user' ? (
              <>
                <Select value={studentGroupFilter} onValueChange={setStudentGroupFilter}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('adminPages.manualUnlocks.allGroups')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('adminPages.manualUnlocks.allGroups')}</SelectItem>
                    {allGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    ref={studentSearchRef}
                    placeholder={t('adminPages.manualUnlocks.searchStudents')}
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={t('adminPages.manualUnlocks.searchGroups')}
                  value={groupSearchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            )}
          </div>

          {/* List */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {activeTab === 'user' ? (
                <>
                  {!canSearchStudents && recentTargets.filter((r) => r.type === 'user').length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-muted border-b border-border flex items-center gap-1.5">
                        <History className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('adminPages.manualUnlocks.recent')}</span>
                      </div>
                      {recentTargets.filter((r) => r.type === 'user').map((r) => (
                        <PersonRow
                          key={`r-${r.id}`}
                          name={r.name}
                          sub={r.email || t('adminPages.manualUnlocks.student')}
                          selected={selectedTarget?.id === r.id && selectedTarget?.type === 'user'}
                          onClick={() => handleSelectTarget(r)}
                        />
                      ))}
                      <div className="border-t border-border" />
                    </>
                  )}
                  {!canSearchStudents ? (
                    <div className="py-12 text-center px-4">
                      <UserIcon className="w-8 h-8 text-gray-300 dark:text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">{t('adminPages.manualUnlocks.findStudent')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('adminPages.manualUnlocks.findStudentHint')}</p>
                    </div>
                  ) : studentsLoading && students.length === 0 ? (
                    <div className="py-12 flex justify-center">
                      <Loader size="md" />
                    </div>
                  ) : students.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">{t('adminPages.manualUnlocks.noStudents')}</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 bg-muted border-b border-border">
                        <span className="text-xs text-muted-foreground">{t('adminPages.manualUnlocks.shownOfTotal', { shown: students.length, count: studentsTotal })}</span>
                      </div>
                      {students.map((s) => {
                        const name = s.name || s.full_name || ''
                        return (
                          <PersonRow
                            key={s.id}
                            name={name}
                            sub={s.email}
                            selected={selectedTarget?.id === Number(s.id) && selectedTarget?.type === 'user'}
                            onClick={() => handleSelectTarget({ id: Number(s.id), type: 'user', name, email: s.email })}
                          />
                        )
                      })}
                      {hasMoreStudents && (
                        <button
                          type="button"
                          disabled={studentsLoading}
                          onClick={() => fetchStudents(false)}
                          className="w-full py-2.5 text-xs text-brand hover:bg-brand-subtle transition-colors border-t border-border font-medium"
                        >
                          {studentsLoading ? t('common.loading') : t('adminPages.manualUnlocks.loadMore', { count: studentsTotal - students.length })}
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : filteredGroups.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-8 h-8 text-gray-300 dark:text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('adminPages.manualUnlocks.noGroups')}</p>
                </div>
              ) : (
                filteredGroups.map((g) => (
                  <PersonRow
                    key={g.id}
                    name={g.name}
                    sub={t('common.students', { count: g.student_count || 0 })}
                    selected={selectedTarget?.id === Number(g.id) && selectedTarget?.type === 'group'}
                    onClick={() => handleSelectTarget({ id: Number(g.id), type: 'group', name: g.name }, g)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel: units ── */}
        <div className="@3xl:col-span-8 @6xl:col-span-9">
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            {/* Panel header */}
            <div className="border-b border-border px-4 py-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {selectedTarget ? selectedTarget.name : t('adminPages.manualUnlocks.noTarget')}
                    </p>
                    {selectedTarget && (
                      <p className="text-xs text-muted-foreground">
                        {selectedTarget.type === 'user' ? t('adminPages.manualUnlocks.student') : t('adminPages.manualUnlocks.group')}
                        {selectedTarget && selectedCourseId && stats.total > 0 && (
                          <> · {t('adminPages.manualUnlocks.targetStats', { done: stats.completed, unlocked: stats.unlocked })}</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {selectedTarget && (
                  <button
                    type="button"
                    onClick={handleClearTarget}
                    className="text-muted-foreground hover:text-muted-foreground p-1 rounded hover:bg-muted transition-colors shrink-0"
                    title={t('adminPages.manualUnlocks.change')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-col @lg:flex-row gap-2">
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="h-8 text-sm sm:max-w-xs">
                    <SelectValue placeholder={t('adminPages.manualUnlocks.selectCourse')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCourses.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedTarget && selectedCourseId && (
                  <>
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder={t('adminPages.manualUnlocks.searchUnits')}
                        value={unitSearch}
                        onChange={(e) => setUnitSearch(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                    <div className="flex gap-1">
                      {unitFilterOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setUnitFilter(opt.value)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            unitFilter === opt.value
                              ? 'bg-gray-900 text-white dark:bg-brand-surface dark:text-brand-subtle-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-gray-200 dark:hover:bg-secondary'
                          }`}
                        >
                          {t(opt.label)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Units content */}
            {!selectedTarget ? (
              <div className="py-20 text-center px-8">
                <UserIcon className="w-10 h-10 text-gray-200 dark:text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">{t('adminPages.manualUnlocks.emptyTarget')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('adminPages.manualUnlocks.emptyTargetHint')}</p>
              </div>
            ) : !selectedCourseId ? (
              <div className="py-20 text-center px-8">
                <BookOpen className="w-10 h-10 text-gray-200 dark:text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">{t('adminPages.manualUnlocks.emptyCourse')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('adminPages.manualUnlocks.emptyCourseHint')}</p>
              </div>
            ) : isStructureLoading || isProgressLoading ? (
              <div className="py-20 flex justify-center">
                <Loader size="lg" />
              </div>
            ) : filteredModules.length === 0 ? (
              <div className="py-20 text-center px-8">
                <Layout className="w-10 h-10 text-gray-200 dark:text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">{t('adminPages.manualUnlocks.noUnits')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('adminPages.manualUnlocks.noUnitsHint')}</p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {filteredModules.map((module) => {
                  const moduleId = Number(module.id)
                  const ms = getModuleStats(module)
                  const isOpen = expandedModules[moduleId] ?? true

                  return (
                    <div key={module.id}>
                      {/* Module header */}
                      <button
                        type="button"
                        onClick={() => toggleModule(moduleId)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted border-b border-border hover:bg-muted transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                          />
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wide truncate">
                            {module.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">{ms.done}/{ms.total}</span>
                          <div className="w-14 h-1 bg-gray-200 dark:bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: ms.total ? `${(ms.done / ms.total) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      </button>

                      {/* Module lessons */}
                      {isOpen && (
                        <div>
                          {module.lessons?.map((lesson) => {
                            const lessonId = Number(lesson.id)
                            const unlocked = unlockedLessonIds.has(lessonId)
                            const progress = lessonProgress[lessonId]
                            const isComplete = progress?.is_complete ?? false
                            const isBusy = actionLessonId === lessonId
                            const percent = progress?.completion_percentage ?? 0

                            return (
                              <div
                                key={lesson.id}
                                className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
                                  isComplete ? 'bg-green-50/50 dark:bg-green-500/15' : 'hover:bg-muted/50'
                                }`}
                              >
                                {/* Status dot */}
                                <div className={`w-2 h-2 rounded-full shrink-0 ${isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-secondary'}`} />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground">{t('adminPages.manualUnlocks.unit', { number: lesson.order_index })}</span>
                                    {unlocked && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded">
                                        {t('adminPages.manualUnlocks.unlocked')}
                                      </span>
                                    )}
                                    {isComplete && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded">
                                        {t('adminPages.manualUnlocks.completed')}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-sm font-medium mt-0.5 truncate ${isComplete ? 'text-green-800 dark:text-green-300' : 'text-foreground'}`}>
                                    {lesson.title}
                                  </p>
                                  {progress && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-brand-solid'}`}
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        {selectedTarget.type === 'group'
                                          ? t('adminPages.manualUnlocks.studentsDone', { done: progress.completed_students ?? 0, count: progress.student_count ?? 0 })
                                          : t('adminPages.manualUnlocks.stepsDone', { done: progress.completed_steps ?? 0, count: progress.total_steps })
                                        } · {percent}%
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleToggleUnlock(lessonId, unlocked)}
                                    disabled={isBusy}
                                    className={`h-7 px-2 text-xs ${
                                      unlocked
                                        ? 'border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {unlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                    <span className="ml-1 hidden @lg:inline">{unlocked ? t('adminPages.manualUnlocks.revoke') : t('adminPages.manualUnlocks.unlock')}</span>
                                  </Button>

                                  {isComplete ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleResetLesson(lessonId)}
                                      disabled={isBusy}
                                      className="h-7 px-2 text-xs border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/15"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span className="ml-1 hidden @lg:inline">{t('adminPages.manualUnlocks.reset')}</span>
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCompleteLesson(lessonId)}
                                      disabled={isBusy}
                                      className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span className="ml-1">{t('adminPages.manualUnlocks.complete')}</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const PersonRow = ({
  name,
  sub,
  selected,
  onClick,
}: {
  name: string
  sub: string
  selected: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 transition-colors ${
      selected ? 'bg-brand-surface' : 'hover:bg-muted'
    }`}
  >
    <div className="flex-1 min-w-0 overflow-hidden">
      <p className={`text-sm font-medium truncate ${selected ? 'text-brand' : 'text-foreground'}`}>{name}</p>
      <p className="text-xs text-muted-foreground truncate">{sub}</p>
    </div>
    {selected && <div className="w-1.5 h-1.5 rounded-full bg-brand-solid shrink-0" />}
  </button>
)
