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

type TargetType = 'user' | 'group'
type UnitFilter = 'all' | 'incomplete' | 'complete' | 'unlocked'

interface SelectedTarget {
  id: number
  type: TargetType
  name: string
}


const unitFilterOptions: { value: UnitFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'complete', label: 'Completed' },
  { value: 'unlocked', label: 'Unlocked' },
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
      const isTeacher = user?.role === 'teacher'
      const [coursesData, groupsData] = await Promise.all([
        apiClient.getCourses(),
        isTeacher ? apiClient.getTeacherGroups() : apiClient.getGroups(),
      ])

      setCourses(coursesData)
      setAllGroups(groupsData || [])
    } catch (error) {
      console.error('Failed to load initial data:', error)
      toast('Failed to load data', 'error')
    } finally {
      setIsLoading(false)
    }
  }

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

  const handleSelectTarget = (target: RecentTarget) => {
    setSelectedTarget(target)
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
      toast('Please select a student or group first', 'error')
      return
    }

    try {
      setActionLessonId(lessonId)
      const data: { lesson_id: number; user_id?: number; group_id?: number } = { lesson_id: lessonId }
      if (selectedTarget.type === 'user') data.user_id = selectedTarget.id
      else data.group_id = selectedTarget.id

      if (currentlyUnlocked) {
        await apiClient.manualLockLesson(data)
        toast('Access revoked', 'success')
      } else {
        await apiClient.manualUnlockLesson(data)
        toast('Access granted', 'success')
      }
      loadTargetUnlocks()
    } catch (error: any) {
      toast(error.message || error.response?.data?.detail || 'Action failed', 'error')
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
          ? 'Unit marked complete for all students in the group'
          : 'Unit marked complete',
        'success'
      )
      loadLessonProgress()
    } catch (error: any) {
      toast(error.message || 'Failed to mark unit complete', 'error')
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
          ? 'Progress reset for all students in the group'
          : 'Progress reset',
        'success'
      )
      loadLessonProgress()
    } catch (error: any) {
      toast(error.message || 'Failed to reset progress', 'error')
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

    return {
      total,
      completed,
      unlocked,
      remaining: total - completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }, [courseStructure, lessonProgress, unlockedLessonIds])

  const filteredGroups = useMemo(() => {
    const q = groupSearchQuery.toLowerCase()
    return allGroups.filter((g) => g.name.toLowerCase().includes(q))
  }, [groupSearchQuery, allGroups])

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Manual Unlocks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Unlock units or mark them complete for a student or group</p>
        </div>
        {selectedTarget && selectedCourseId && stats.total > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{stats.completed}/{stats.total} completed</span>
            <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 tabular-nums w-10">{stats.percent}%</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── Left panel: selector ── */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3">
          {/* Tabs */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => { setActiveTab('user'); setSelectedTarget(null); setSearchQuery(''); setGroupSearchQuery('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                activeTab === 'user'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Students
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('group'); setSelectedTarget(null); setSearchQuery(''); setGroupSearchQuery('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                activeTab === 'group'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Groups
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            {activeTab === 'user' ? (
              <>
                <Select value={studentGroupFilter} onValueChange={setStudentGroupFilter}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All groups" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    {allGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    ref={studentSearchRef}
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  placeholder="Search groups..."
                  value={groupSearchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            )}
          </div>

          {/* List */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {activeTab === 'user' ? (
                <>
                  {!canSearchStudents && recentTargets.filter((t) => t.type === 'user').length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
                        <History className="w-3 h-3 text-gray-400" />
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Recent</span>
                      </div>
                      {recentTargets.filter((t) => t.type === 'user').map((t) => (
                        <PersonRow
                          key={`r-${t.id}`}
                          name={t.name}
                          sub={t.email || 'Student'}
                          selected={selectedTarget?.id === t.id && selectedTarget?.type === 'user'}
                          onClick={() => handleSelectTarget(t)}
                        />
                      ))}
                      <div className="border-t border-gray-100" />
                    </>
                  )}
                  {!canSearchStudents ? (
                    <div className="py-12 text-center px-4">
                      <UserIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-900">Find a student</p>
                      <p className="text-xs text-gray-400 mt-1">Select a group or type to search</p>
                    </div>
                  ) : studentsLoading && students.length === 0 ? (
                    <div className="py-12 flex justify-center">
                      <Loader size="md" />
                    </div>
                  ) : students.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-gray-400">No students found</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs text-gray-400">{students.length} of {studentsTotal} students</span>
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
                          className="w-full py-2.5 text-xs text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100 font-medium"
                        >
                          {studentsLoading ? 'Loading...' : `Load more (${studentsTotal - students.length} left)`}
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : filteredGroups.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No groups found</p>
                </div>
              ) : (
                filteredGroups.map((g) => (
                  <PersonRow
                    key={g.id}
                    name={g.name}
                    sub={`${g.student_count || 0} students`}
                    selected={selectedTarget?.id === Number(g.id) && selectedTarget?.type === 'group'}
                    onClick={() => handleSelectTarget({ id: Number(g.id), type: 'group', name: g.name })}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel: units ── */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            {/* Panel header */}
            <div className="border-b border-gray-200 px-4 py-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {selectedTarget ? selectedTarget.name : 'No target selected'}
                    </p>
                    {selectedTarget && (
                      <p className="text-xs text-gray-400">
                        {selectedTarget.type === 'user' ? 'Student' : 'Group'}
                        {selectedTarget && selectedCourseId && stats.total > 0 && (
                          <> · {stats.completed} done · {stats.unlocked} unlocked</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {selectedTarget && (
                  <button
                    type="button"
                    onClick={handleClearTarget}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
                    title="Change"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="h-8 text-sm sm:max-w-xs">
                    <SelectValue placeholder="Select a course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedTarget && selectedCourseId && (
                  <>
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        placeholder="Search units..."
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
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {opt.label}
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
                <UserIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900">Select a student or group</p>
                <p className="text-xs text-gray-400 mt-1">Choose from the list on the left</p>
              </div>
            ) : !selectedCourseId ? (
              <div className="py-20 text-center px-8">
                <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900">Select a course</p>
                <p className="text-xs text-gray-400 mt-1">Pick a course to see its units</p>
              </div>
            ) : isStructureLoading || isProgressLoading ? (
              <div className="py-20 flex justify-center">
                <Loader size="lg" />
              </div>
            ) : filteredModules.length === 0 ? (
              <div className="py-20 text-center px-8">
                <Layout className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900">No units match</p>
                <p className="text-xs text-gray-400 mt-1">Try clearing the filter</p>
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
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                          />
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide truncate">
                            {module.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400 tabular-nums">{ms.done}/{ms.total}</span>
                          <div className="w-14 h-1 bg-gray-200 rounded-full overflow-hidden">
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
                                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                                  isComplete ? 'bg-green-50/50' : 'hover:bg-gray-50/50'
                                }`}
                              >
                                {/* Status dot */}
                                <div className={`w-2 h-2 rounded-full shrink-0 ${isComplete ? 'bg-green-500' : 'bg-gray-200'}`} />

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-400">Unit {lesson.order_index}</span>
                                    {unlocked && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                        Unlocked
                                      </span>
                                    )}
                                    {isComplete && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                        Completed
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-sm font-medium mt-0.5 truncate ${isComplete ? 'text-green-800' : 'text-gray-900'}`}>
                                    {lesson.title}
                                  </p>
                                  {progress && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-400">
                                        {selectedTarget.type === 'group'
                                          ? `${progress.completed_students}/${progress.student_count} students`
                                          : `${progress.completed_steps}/${progress.total_steps} steps`
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
                                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                                        : 'text-gray-600'
                                    }`}
                                  >
                                    {unlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                    <span className="ml-1 hidden sm:inline">{unlocked ? 'Revoke' : 'Unlock'}</span>
                                  </Button>

                                  {isComplete ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleResetLesson(lessonId)}
                                      disabled={isBusy}
                                      className="h-7 px-2 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span className="ml-1 hidden sm:inline">Reset</span>
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCompleteLesson(lessonId)}
                                      disabled={isBusy}
                                      className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span className="ml-1">Complete</span>
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
    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-b-0 transition-colors ${
      selected ? 'bg-blue-50' : 'hover:bg-gray-50'
    }`}
  >
    <div className="flex-1 min-w-0 overflow-hidden">
      <p className={`text-sm font-medium truncate ${selected ? 'text-blue-700' : 'text-gray-900'}`}>{name}</p>
      <p className="text-xs text-gray-400 truncate">{sub}</p>
    </div>
    {selected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
  </button>
)
