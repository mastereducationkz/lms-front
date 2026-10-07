import { useCallback, useEffect, useMemo, useState } from 'react'
import apiClient from '../../services/api'
import { parseAsUTC } from '../../lib/datetime'
import { DATE, TIME, activeLocale, formatDateTime, t as tr, type Locale, type MessageKey } from '../../lib/i18n'
import { useLocale, useT } from '../../lib/i18n/react'
import '@/lib/i18n/catalogs/adminUsers'
import { toast } from '../../components/Toast'
import Loader from '../../components/Loader'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table'
import { Badge } from '../../components/ui/badge'
import { Checkbox } from '../../components/ui/checkbox'
import { Card, CardContent } from '../../components/ui/card'
import {
  Timer,
  Plus,
  Pencil,
  Mail,
  Ban,
  CheckCircle2,
  ChevronDown,
  Copy,
  Check,
  Trash2,
} from 'lucide-react'
import type { Course, CourseModule, TrialAccess, TrialCreateRequest, TrialUpdateRequest } from '../../types'

type StatusFilter = 'all' | TrialAccess['status']

const STATUS_TABS: { value: StatusFilter; label: MessageKey }[] = [
  { value: 'all', label: 'adminUsers.trial.tab.all' },
  { value: 'active', label: 'adminUsers.trial.tab.active' },
  { value: 'expired', label: 'adminUsers.trial.tab.expired' },
  { value: 'revoked', label: 'adminUsers.trial.tab.revoked' },
  { value: 'converted', label: 'adminUsers.trial.tab.converted' },
]

const STATUS_LABELS: Record<TrialAccess['status'], MessageKey> = {
  active: 'adminUsers.trial.status.active',
  expired: 'adminUsers.trial.status.expired',
  revoked: 'adminUsers.trial.status.revoked',
  converted: 'adminUsers.trial.status.converted',
}

const STATUS_BADGE_CLASSES: Record<TrialAccess['status'], string> = {
  active: 'border-transparent bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/40',
  expired: 'border-transparent bg-muted text-muted-foreground hover:bg-border',
  revoked: 'border-transparent bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/40',
  converted: 'border-transparent bg-brand-subtle text-brand-subtle-foreground hover:bg-brand-subtle',
}

/** Formats a Date as "YYYY-MM-DDTHH:mm" in the *browser's local* timezone for a datetime-local input. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultDeadline(): string {
  return toLocalInputValue(new Date(Date.now() + 24 * 3600 * 1000))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** expiresAt is a naive-UTC backend string; parse with parseAsUTC, never `new Date(string)`. */
function formatCountdown(expiresAt: string, now: number, locale: Locale = activeLocale()): string {
  const diffMs = parseAsUTC(expiresAt).getTime() - now
  if (diffMs <= 0) return tr('adminUsers.trial.countdownExpired', undefined, locale)
  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return tr('adminUsers.trial.countdown', { hours, minutes }, locale)
}

/** One course + its unlocked lessons within a (possibly multi-course) grant. `key` is a stable local id. */
interface CourseSelection {
  key: string
  courseId: string
  lessonIds: Set<number>
}

interface TrialFormState {
  email: string
  name: string
  note: string
  selections: CourseSelection[] // create: 1+ course blocks; edit: exactly one (course locked)
  deadline: string
}

// Local-only unique key for React lists (not sent to the server).
let _selKey = 0
const makeSelection = (courseId = '', lessonIds: number[] = []): CourseSelection => ({
  key: `sel-${_selKey++}`,
  courseId,
  lessonIds: new Set(lessonIds),
})

const emptyForm = (): TrialFormState => ({
  email: '',
  name: '',
  note: '',
  selections: [makeSelection()],
  deadline: defaultDeadline(),
})

/**
 * One course block in the grant form: a course picker plus its lesson tree. Loads its own
 * modules lazily whenever its course changes, so multiple blocks each fetch independently.
 */
function CourseSelectionBlock({
  selection,
  courses,
  disabledCourseIds,
  lockCourse,
  canRemove,
  onChangeCourse,
  onToggleLesson,
  onToggleModule,
  onRemove,
}: {
  selection: CourseSelection
  courses: Course[]
  disabledCourseIds: Set<string>
  lockCourse: boolean
  canRemove: boolean
  onChangeCourse: (courseId: string) => void
  onToggleLesson: (lessonId: number) => void
  onToggleModule: (lessonIds: number[], checked: boolean) => void
  onRemove: () => void
}) {
  const t = useT()
  const [modules, setModules] = useState<CourseModule[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let cancelled = false
    if (!selection.courseId) {
      setModules([])
      return
    }
    setLoading(true)
    apiClient
      .getCourseModules(selection.courseId, true)
      .then((data) => {
        if (cancelled) return
        setModules(data)
        const exp: Record<number, boolean> = {}
        data.forEach((m) => {
          exp[Number(m.id)] = true
        })
        setExpanded(exp)
      })
      .catch(() => {
        if (!cancelled) toast(t('adminUsers.trial.unitsLoadFailed'), 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selection.courseId])

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">{t('adminUsers.trial.course')}</Label>
          <Select value={selection.courseId} onValueChange={onChangeCourse} disabled={lockCourse}>
            <SelectTrigger>
              <SelectValue placeholder={t('adminUsers.trial.selectCourse')} />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()} disabled={disabledCourseIds.has(c.id.toString())}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
            title={t('adminUsers.trial.removeCourse')}
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t('adminUsers.trial.lessonsSelected', { count: selection.lessonIds.size })}</Label>
        <div className="border rounded-lg max-h-56 overflow-y-auto">
          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader size="sm" />
            </div>
          ) : !selection.courseId ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('adminUsers.trial.selectCourseFirst')}</p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('adminUsers.trial.noUnits')}</p>
          ) : (
            modules.map((module) => {
              const moduleId = Number(module.id)
              const lessons = module.lessons || []
              const allChecked = lessons.length > 0 && lessons.every((l) => selection.lessonIds.has(Number(l.id)))
              const isOpen = expanded[moduleId] ?? true
              return (
                <div key={module.id} className="border-b last:border-b-0">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(checked) =>
                        onToggleModule(lessons.map((l) => Number(l.id)), checked === true)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [moduleId]: !isOpen }))}
                      className="flex-1 flex items-center justify-between text-left"
                    >
                      <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
                        {module.title}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`}
                      />
                    </button>
                  </div>
                  {isOpen &&
                    lessons.map((lesson) => (
                      <label
                        key={lesson.id}
                        className="flex items-center gap-2 px-3 py-1.5 pl-8 text-sm hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selection.lessonIds.has(Number(lesson.id))}
                          onCheckedChange={() => onToggleLesson(Number(lesson.id))}
                        />
                        {lesson.title}
                      </label>
                    ))}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function TrialAccessPage() {
  const t = useT()
  const locale = useLocale()
  const [trials, setTrials] = useState<TrialAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [now, setNow] = useState(() => Date.now())

  const [courses, setCourses] = useState<Course[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TrialAccess | null>(null)
  const [form, setForm] = useState<TrialFormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [createResult, setCreateResult] = useState<{ password: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  const [busyTrialId, setBusyTrialId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.getTrials()
      setTrials(res.trials)
    } catch (error: any) {
      toast(error.message || t('adminUsers.trial.loadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    apiClient
      .getCourses()
      .then((data) => setCourses(data as Course[]))
      .catch(() => toast(t('adminUsers.trial.coursesLoadFailed'), 'error'))
  }, [])

  // Keep the "in Xh Ym" countdown live.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(id)
  }, [])

  const openCreateDialog = () => {
    setEditing(null)
    setForm(emptyForm())
    setCreateResult(null)
    setDialogOpen(true)
  }

  const openEditDialog = (trial: TrialAccess) => {
    setEditing(trial)
    setForm({
      email: trial.user_email,
      name: trial.user_name,
      note: trial.prospect_note || '',
      selections: [makeSelection(String(trial.course_id), trial.lesson_ids)],
      deadline: toLocalInputValue(parseAsUTC(trial.expires_at)),
    })
    setCreateResult(null)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditing(null)
    setCreateResult(null)
  }

  // --- per-course-block form mutations -----------------------------------------
  const addSelection = () => {
    setForm((f) => ({ ...f, selections: [...f.selections, makeSelection()] }))
  }

  const removeSelection = (key: string) => {
    setForm((f) => ({ ...f, selections: f.selections.filter((s) => s.key !== key) }))
  }

  const changeSelectionCourse = (key: string, courseId: string) => {
    setForm((f) => ({
      ...f,
      // Switching a block's course clears that block's lessons (they belonged to the old course).
      selections: f.selections.map((s) => (s.key === key ? { ...s, courseId, lessonIds: new Set<number>() } : s)),
    }))
  }

  const toggleLessonIn = (key: string, lessonId: number) => {
    setForm((f) => ({
      ...f,
      selections: f.selections.map((s) => {
        if (s.key !== key) return s
        const next = new Set(s.lessonIds)
        if (next.has(lessonId)) next.delete(lessonId)
        else next.add(lessonId)
        return { ...s, lessonIds: next }
      }),
    }))
  }

  const toggleModuleIn = (key: string, lessonIds: number[], checked: boolean) => {
    setForm((f) => ({
      ...f,
      selections: f.selections.map((s) => {
        if (s.key !== key) return s
        const next = new Set(s.lessonIds)
        for (const id of lessonIds) {
          if (checked) next.add(id)
          else next.delete(id)
        }
        return { ...s, lessonIds: next }
      }),
    }))
  }

  const validate = (): string | null => {
    if (!editing) {
      if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) return t('adminUsers.trial.validate.email')
      if (!form.name.trim()) return t('adminUsers.trial.validate.name')
    }
    if (form.selections.length === 0) return t('adminUsers.trial.validate.course')
    const chosen = form.selections.map((s) => s.courseId).filter(Boolean)
    if (chosen.length !== form.selections.length) return t('adminUsers.trial.validate.courseEachBlock')
    if (new Set(chosen).size !== chosen.length) return t('adminUsers.trial.validate.courseOnce')
    for (const s of form.selections) {
      if (s.lessonIds.size === 0) {
        const title = courses.find((c) => c.id.toString() === s.courseId)?.title
        return title
          ? t('adminUsers.trial.validate.lessonFor', { course: title })
          : t('adminUsers.trial.validate.lessonEach')
      }
    }
    if (!form.deadline) return t('adminUsers.trial.validate.deadline')
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      toast(validationError, 'error')
      return
    }

    setSubmitting(true)
    try {
      // datetime-local values are interpreted by `new Date()` in the browser's local
      // timezone; .toISOString() converts to UTC with a trailing Z, which is what the
      // naive-UTC backend expects.
      const expiresAt = new Date(form.deadline).toISOString()
      if (editing) {
        const payload: TrialUpdateRequest = {
          expires_at: expiresAt,
          lesson_ids: Array.from(form.selections[0].lessonIds),
          prospect_note: form.note.trim() || undefined,
        }
        await apiClient.updateTrial(editing.id, payload)
        toast(t('adminUsers.trial.updated'), 'success')
        closeDialog()
        load()
      } else {
        const payload: TrialCreateRequest = {
          email: form.email.trim(),
          name: form.name.trim(),
          courses: form.selections.map((s) => ({
            course_id: Number(s.courseId),
            lesson_ids: Array.from(s.lessonIds),
          })),
          expires_at: expiresAt,
          prospect_note: form.note.trim() || undefined,
        }
        const res = await apiClient.createTrial(payload)
        setCreateResult({ password: res.generated_password })
        toast(t('adminUsers.trial.granted', { count: payload.courses.length }), 'success')
        load()
      }
    } catch (error: any) {
      toast(error.message || t('adminUsers.trial.saveFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (trial: TrialAccess) => {
    if (!window.confirm(t('adminUsers.trial.revokeConfirm', { name: trial.user_name }))) return
    setBusyTrialId(trial.id)
    try {
      await apiClient.revokeTrial(trial.id)
      toast(t('adminUsers.trial.revoked'), 'success')
      load()
    } catch (error: any) {
      toast(error.message || t('adminUsers.trial.revokeFailed'), 'error')
    } finally {
      setBusyTrialId(null)
    }
  }

  const handleResend = async (trial: TrialAccess) => {
    setBusyTrialId(trial.id)
    try {
      const res = await apiClient.resendTrialInvite(trial.id)
      toast(res.sent ? t('adminUsers.trial.inviteResent') : t('adminUsers.trial.noEmailSent'), res.sent ? 'success' : 'info')
      load()
    } catch (error: any) {
      toast(error.message || t('adminUsers.trial.resendFailed'), 'error')
    } finally {
      setBusyTrialId(null)
    }
  }

  const handleConvert = async (trial: TrialAccess) => {
    if (!window.confirm(t('adminUsers.trial.convertConfirm', { name: trial.user_name }))) return
    setBusyTrialId(trial.id)
    try {
      await apiClient.convertTrial(trial.id)
      toast(t('adminUsers.trial.converted'), 'success')
      load()
    } catch (error: any) {
      toast(error.message || t('adminUsers.trial.convertFailed'), 'error')
    } finally {
      setBusyTrialId(null)
    }
  }

  const handleCopyPassword = async () => {
    if (!createResult?.password) return
    try {
      await navigator.clipboard.writeText(createResult.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(t('adminUsers.trial.copyFailed'), 'error')
    }
  }

  const visible = useMemo(
    () => (statusFilter === 'all' ? trials : trials.filter((t) => t.status === statusFilter)),
    [trials, statusFilter]
  )

  // A prospect with a multi-course grant has one row per course. Group those rows under a
  // single prospect so it reads as "one student, N courses" instead of looking like duplicate
  // students. Preserves the backend order (first appearance of each prospect wins).
  const groups = useMemo(() => {
    const byUser = new Map<number, TrialAccess[]>()
    for (const t of visible) {
      const arr = byUser.get(t.user_id)
      if (arr) arr.push(t)
      else byUser.set(t.user_id, [t])
    }
    return Array.from(byUser.values())
  }, [visible])

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader size="lg" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Timer className="w-5 h-5" />
            {t('adminUsers.trial.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('adminUsers.trial.subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('adminUsers.trial.grant')}
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === tab.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-border'
            }`}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <div className="py-16 text-center">
              <Timer className="w-10 h-10 text-border mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">{t('adminUsers.trial.empty')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('adminUsers.trial.emptyHint')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminUsers.trial.colProspect')}</TableHead>
                  <TableHead>{t('adminUsers.trial.course')}</TableHead>
                  <TableHead>{t('adminUsers.trial.colLessons')}</TableHead>
                  <TableHead>{t('adminUsers.trial.deadline')}</TableHead>
                  <TableHead>{t('adminUsers.trial.colStatus')}</TableHead>
                  <TableHead>{t('adminUsers.trial.colGrantedBy')}</TableHead>
                  <TableHead>{t('adminUsers.trial.note')}</TableHead>
                  <TableHead className="text-right">{t('adminUsers.trial.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.flatMap((group, groupIndex) =>
                  group.map((trial, rowIndex) => {
                  const isBusy = busyTrialId === trial.id
                  const isTerminal = trial.status === 'revoked' || trial.status === 'converted'
                  const isFirstOfGroup = rowIndex === 0
                  return (
                    <TableRow
                      key={trial.id}
                      className={isFirstOfGroup && groupIndex > 0 ? 'border-t-2 border-t-gray-200' : ''}
                    >
                      <TableCell>
                        {isFirstOfGroup && (
                          <>
                            <p className="font-medium text-foreground">{trial.user_name}</p>
                            <p className="text-xs text-muted-foreground">{trial.user_email}</p>
                            {group.length > 1 && (
                              <p className="text-xs text-muted-foreground mt-0.5">{t('adminUsers.trial.coursesCount', { count: group.length })}</p>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell>{trial.course_title}</TableCell>
                      <TableCell>{trial.lesson_ids.length}</TableCell>
                      <TableCell>
                        <p className="whitespace-nowrap">{formatDateTime(trial.expires_at, { ...DATE, ...TIME })}</p>
                        {trial.status === 'active' && (
                          <p className="text-xs text-muted-foreground">{formatCountdown(trial.expires_at, now, locale)}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE_CLASSES[trial.status]} variant="outline">
                          {t(STATUS_LABELS[trial.status])}
                        </Badge>
                      </TableCell>
                      <TableCell>{trial.granted_by_name || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={trial.prospect_note}>
                        {trial.prospect_note || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={isBusy || isTerminal}
                            title={t('common.edit')}
                            onClick={() => openEditDialog(trial)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={isBusy}
                            title={t('adminUsers.trial.resend')}
                            onClick={() => handleResend(trial)}
                          >
                            <Mail className="w-3 h-3" />
                          </Button>
                          {!isTerminal && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-brand-border text-brand hover:bg-brand-surface"
                              disabled={isBusy}
                              title={t('adminUsers.trial.convert')}
                              onClick={() => handleConvert(trial)}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                            </Button>
                          )}
                          {!isTerminal && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-950/40"
                              disabled={isBusy}
                              title={t('adminUsers.trial.revoke')}
                              onClick={() => handleRevoke(trial)}
                            >
                              <Ban className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('adminUsers.trial.editTitle') : t('adminUsers.trial.grantTitle')}</DialogTitle>
            <DialogDescription>
              {editing
                ? t('adminUsers.trial.editDescription')
                : t('adminUsers.trial.grantDescription')}
            </DialogDescription>
          </DialogHeader>

          {createResult ? (
            <div className="space-y-4">
              {createResult.password ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('adminUsers.trial.newAccount')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={createResult.password} className="font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={handleCopyPassword} title={t('adminUsers.trial.copyPassword')}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('adminUsers.trial.existingAccount')}
                </p>
              )}
              <DialogFooter>
                <Button onClick={closeDialog}>{t('adminUsers.trial.done')}</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t('adminUsers.trial.email')}</Label>
                  <Input
                    value={form.email}
                    disabled={!!editing}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="prospect@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('adminUsers.trial.name')}</Label>
                  <Input
                    value={form.name}
                    disabled={!!editing}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('adminUsers.trial.namePlaceholder')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{t('adminUsers.trial.note')}</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder={t('adminUsers.trial.notePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{editing ? t('adminUsers.trial.courseAndLessons') : t('adminUsers.trial.coursesAndLessons')}</Label>
                  {!editing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={addSelection}
                      disabled={form.selections.length >= courses.length}
                    >
                      <Plus className="w-3 h-3" />
                      {t('adminUsers.trial.addCourse')}
                    </Button>
                  )}
                </div>
                {form.selections.map((sel) => (
                  <CourseSelectionBlock
                    key={sel.key}
                    selection={sel}
                    courses={courses}
                    disabledCourseIds={
                      new Set(
                        form.selections.filter((s) => s.key !== sel.key && s.courseId).map((s) => s.courseId)
                      )
                    }
                    lockCourse={!!editing}
                    canRemove={!editing && form.selections.length > 1}
                    onChangeCourse={(courseId) => changeSelectionCourse(sel.key, courseId)}
                    onToggleLesson={(lessonId) => toggleLessonIn(sel.key, lessonId)}
                    onToggleModule={(lessonIds, checked) => toggleModuleIn(sel.key, lessonIds, checked)}
                    onRemove={() => removeSelection(sel.key)}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <Label>{t('adminUsers.trial.deadline')}</Label>
                <Input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  {t('common.cancel')}
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? t('adminUsers.trial.saving') : editing ? t('adminUsers.trial.saveChanges') : t('adminUsers.trial.grantAccess')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
