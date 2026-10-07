import { useCallback, useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import apiClient from '../../services/api'
import type { AdminDashboard as AdminDashboardType, AdminDashboardCharts } from '../../types'
import Loader from '../../components/Loader'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import StudentSearchBox from '../../components/StudentSearchBox'
import { formatDate, formatNumber } from '../../lib/i18n'
import { useT } from '../../lib/i18n/react'
import '@/lib/i18n/catalogs/adminUsers'

const chartMargin = { top: 8, right: 8, left: -8, bottom: 0 }

const tickDay = (v: string) => {
  try {
    return formatDate(v, { day: 'numeric', month: 'short' })
  } catch {
    return v
  }
}

/** Shared look: tighter radius, clean spacing */
const statCardClass =
  'rounded-md border border-border bg-card p-5 shadow-sm'

const chartCardClass = 'rounded-md border border-border bg-card shadow-sm overflow-hidden'

export default function AdminDashboard() {
  const t = useT()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<AdminDashboardType | null>(null)
  const [charts, setCharts] = useState<AdminDashboardCharts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    const emptyCharts: AdminDashboardCharts = {
      registrations_last_14_days: [],
      homework_submissions_last_14_days: [],
    }
    try {
      const [dashRes, chartRes] = await Promise.allSettled([
        apiClient.getAdminDashboard(),
        apiClient.getAdminDashboardCharts(),
      ])
      if (dashRes.status === 'fulfilled') {
        setDashboard(dashRes.value)
      } else {
        console.error(dashRes.reason)
        setDashboard(null)
        setError(t('adminUsers.dashboard.loadFailed'))
      }
      if (chartRes.status === 'fulfilled') {
        setCharts(chartRes.value)
      } else {
        console.error(chartRes.reason)
        setCharts(emptyCharts)
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader size="lg" animation="spin" color="hsl(var(--brand))" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-muted-foreground">
        <p>{error || t('adminUsers.dashboard.noData')}</p>
        <Button variant="outline" className="mt-4" onClick={load}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const { stats } = dashboard
  const s = (n: number | undefined) => n ?? 0

  const chartPayload = charts ?? {
    registrations_last_14_days: [],
    homework_submissions_last_14_days: [],
  }

  const handleCardKeyDown = (path: string) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(path)
    }
  }

  const teacherActive7d = s(stats.teacher_active_last_7_days)
  const teacherActive30d = s(stats.teacher_active_last_30_days)
  const teacherGrading7d = s(stats.teachers_who_graded_last_7_days)
  const homeworkGraded7d = s(stats.homework_graded_last_7_days)
  const avgTeacherGrading7d = stats.avg_homework_graded_per_active_teacher_last_7_days ?? 0
  const pendingOpsTotal = s(stats.pending_homework_to_grade) + s(stats.pending_lesson_requests)

  const platformKpis = [
    {
      label: t('adminUsers.dashboard.totalUsers'),
      value: stats.total_users,
      hint: t('common.students', { count: stats.total_students }),
    },
    {
      label: t('adminUsers.dashboard.teachers'),
      value: stats.total_teachers,
      hint: t('adminUsers.dashboard.curatorsCount', { count: stats.total_curators }),
    },
    {
      label: t('adminUsers.dashboard.courses'),
      value: stats.total_courses,
      hint: t('adminUsers.dashboard.activeEnrollments', { count: stats.total_active_enrollments }),
    },
    {
      label: t('adminUsers.dashboard.newUsers7d'),
      value: s(stats.recent_registrations),
      hint: t('adminUsers.dashboard.last7Days'),
    },
  ]

  const queueWidgets = [
    {
      label: t('adminUsers.dashboard.toGrade'),
      sub: t('adminUsers.dashboard.homeworkPending'),
      value: s(stats.pending_homework_to_grade),
      path: '/homework',
      ariaLabel: t('adminUsers.dashboard.openHomework'),
    },
    {
      label: t('adminUsers.dashboard.events'),
      sub: t('adminUsers.dashboard.next7Days'),
      value: s(stats.events_in_next_7_days),
      path: '/admin/events',
      ariaLabel: t('adminUsers.dashboard.openEvents'),
    },
    {
      label: t('adminUsers.dashboard.lessonRequests'),
      sub: t('adminUsers.dashboard.pending'),
      value: s(stats.pending_lesson_requests),
      path: '/admin/lesson-requests',
      ariaLabel: t('adminUsers.dashboard.openLessonRequests'),
    },
  ]

  const teacherEfficiencyData = [
    { label: t('adminUsers.dashboard.total'), value: stats.total_teachers },
    { label: t('adminUsers.dashboard.active7d'), value: teacherActive7d },
    { label: t('adminUsers.dashboard.active30d'), value: teacherActive30d },
    { label: t('adminUsers.dashboard.grading7d'), value: teacherGrading7d },
  ]

  const operationsLoadData = [
    { name: t('adminUsers.dashboard.toGrade'), value: s(stats.pending_homework_to_grade) },
    { name: t('adminUsers.dashboard.lessonRequests'), value: s(stats.pending_lesson_requests) },
  ]
  const queueMax = Math.max(...queueWidgets.map((w) => w.value), 1)

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <StudentSearchBox className="max-w-md" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {platformKpis.map((k) => (
          <Card key={k.label} className={statCardClass}>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-snug">{k.label}</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{k.value}</p>
              <p className="text-xs text-muted-foreground/90 leading-snug">{k.hint}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className={chartCardClass}>
          <CardHeader className="px-5 pt-5 pb-2 space-y-1">
            <CardTitle className="text-base font-medium">{t('adminUsers.dashboard.teacherEfficiency')}</CardTitle>
            <CardDescription className="text-sm">
              {t('adminUsers.dashboard.active7dLabel')} <span className="font-semibold text-foreground tabular-nums">{teacherActive7d}</span> / {stats.total_teachers}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teacherEfficiencyData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={28}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => t('adminUsers.dashboard.teachersCount', { count: Number(value) })}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary) / 0.55)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={chartCardClass}>
          <CardHeader className="px-5 pt-5 pb-2 space-y-1">
            <CardTitle className="text-base font-medium">{t('adminUsers.dashboard.operationalLoad')}</CardTitle>
            <CardDescription className="text-sm">
              {t('adminUsers.dashboard.pendingNow')} <span className="font-semibold text-foreground tabular-nums">{pendingOpsTotal}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operationsLoadData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={28}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="hsl(217 91% 45% / 0.55)" radius={[4, 4, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={chartCardClass}>
          <CardHeader className="px-5 pt-5 pb-2 space-y-1">
            <CardTitle className="text-base font-medium">{t('adminUsers.dashboard.homeworkChecks')}</CardTitle>
            <CardDescription className="text-sm">
              {t('adminUsers.dashboard.avgChecks')} <span className="font-semibold text-foreground tabular-nums">{formatNumber(avgTeacherGrading7d, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPayload.homework_submissions_last_14_days} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={tickDay}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={28}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => tickDay(String(l))}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(217 91% 45%)"
                  fill="hsl(217 91% 45% / 0.12)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {queueWidgets.map((w) => (
          <Card
            key={w.label}
            role="button"
            tabIndex={0}
            aria-label={w.ariaLabel}
            className={`${statCardClass} cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
            onClick={() => navigate(w.path)}
            onKeyDown={handleCardKeyDown(w.path)}
          >
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-snug">{w.label}</p>
              <p className="text-xs text-muted-foreground/90 leading-snug">{w.sub}</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground pt-0.5">{w.value}</p>
              <div className="h-1.5 w-full rounded-sm bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary/70"
                  style={{ width: `${Math.round((w.value / queueMax) * 100)}%` }}
                  aria-label={`${w.label}: ${w.value}`}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className={chartCardClass}>
          <CardHeader className="px-5 pt-5 pb-2 space-y-1">
            <CardTitle className="text-base font-medium">{t('adminUsers.dashboard.newRegistrations')}</CardTitle>
            <CardDescription className="text-sm">{t('adminUsers.dashboard.newRegistrationsHint')}</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPayload.registrations_last_14_days} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={tickDay}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={28}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => tickDay(String(l))}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.12)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={chartCardClass}>
          <CardHeader className="px-5 pt-5 pb-2 space-y-1">
            <CardTitle className="text-base font-medium">{t('adminUsers.dashboard.homeworkSubmissions')}</CardTitle>
            <CardDescription className="text-sm">{t('adminUsers.dashboard.homeworkSubmissionsHint')}</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPayload.homework_submissions_last_14_days} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={tickDay}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={28}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => tickDay(String(l))}
                />
                <Bar dataKey="count" fill="hsl(var(--primary) / 0.35)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
