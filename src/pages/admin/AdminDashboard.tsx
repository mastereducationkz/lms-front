import { useCallback, useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
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

const chartMargin = { top: 8, right: 8, left: -8, bottom: 0 }

const tickDay = (v: string) => {
  try {
    return format(parseISO(v), 'd MMM')
  } catch {
    return v
  }
}

/** Shared look: tighter radius, clean spacing */
const statCardClass =
  'rounded-md border border-border bg-card p-5 shadow-sm'

const chartCardClass = 'rounded-md border border-border bg-card shadow-sm overflow-hidden'

export default function AdminDashboard() {
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
        setError('Failed to load dashboard')
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
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader size="lg" animation="spin" color="#2563eb" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center text-muted-foreground">
        <p>{error || 'No data'}</p>
        <Button variant="outline" className="mt-4" onClick={load}>
          Retry
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
  const teacherActivity7dPct = stats.total_teachers > 0
    ? Math.round((teacherActive7d / stats.total_teachers) * 100)
    : 0
  const teacherActivity30dPct = stats.total_teachers > 0
    ? Math.round((teacherActive30d / stats.total_teachers) * 100)
    : 0
  const teacherGrading7dPct = stats.total_teachers > 0
    ? Math.round((teacherGrading7d / stats.total_teachers) * 100)
    : 0
  const pendingOpsTotal = s(stats.pending_homework_to_grade) + s(stats.pending_lesson_requests)

  const platformKpis = [
    {
      label: 'Total users',
      value: stats.total_users,
      hint: `${stats.total_students} students`,
    },
    {
      label: 'Teachers',
      value: stats.total_teachers,
      hint: `${stats.total_curators} curators`,
    },
    {
      label: 'Courses',
      value: stats.total_courses,
      hint: `${stats.total_active_enrollments} active enrollments`,
    },
    {
      label: 'New users (7d)',
      value: s(stats.recent_registrations),
      hint: 'Last 7 days',
    },
  ]

  const queueWidgets = [
    {
      label: 'To grade',
      sub: 'Homework pending',
      value: s(stats.pending_homework_to_grade),
      path: '/homework',
      ariaLabel: 'Open homework: submissions awaiting grading',
    },
    {
      label: 'Events',
      sub: 'Next 7 days',
      value: s(stats.events_in_next_7_days),
      path: '/admin/events',
      ariaLabel: 'Open events: scheduled in the next 7 days',
    },
  ]

  const teacherEfficiencyData = [
    {
      label: 'Active in last 7 days',
      percent: teacherActivity7dPct,
      details: `${teacherActive7d}/${stats.total_teachers} teachers`,
    },
    {
      label: 'Active in last 30 days',
      percent: teacherActivity30dPct,
      details: `${teacherActive30d}/${stats.total_teachers} teachers`,
    },
    {
      label: 'Checked homework in 7 days',
      percent: teacherGrading7dPct,
      details: `${teacherGrading7d} teachers · ${homeworkGraded7d} checks`,
    },
  ]

  const operationsLoadData = [
    { name: 'To grade', value: s(stats.pending_homework_to_grade) },
    { name: 'Lesson requests', value: s(stats.pending_lesson_requests) },
  ]
  const queueMax = Math.max(...queueWidgets.map((w) => w.value), 1)

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8 space-y-6">
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
            <CardTitle className="text-base font-medium">Teacher efficiency</CardTitle>
            <CardDescription className="text-sm">
              7d activity: <span className="font-semibold text-foreground tabular-nums">{teacherActivity7dPct}%</span>
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
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => `${value}%`}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="percent" fill="hsl(var(--primary) / 0.55)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={chartCardClass}>
          <CardHeader className="px-5 pt-5 pb-2 space-y-1">
            <CardTitle className="text-base font-medium">Operational load</CardTitle>
            <CardDescription className="text-sm">
              Pending now: <span className="font-semibold text-foreground tabular-nums">{pendingOpsTotal}</span>
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
            <CardTitle className="text-base font-medium">Homework checks</CardTitle>
            <CardDescription className="text-sm">
              Avg checks/active teacher: <span className="font-semibold text-foreground tabular-nums">{avgTeacherGrading7d.toFixed(1)}</span>
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
            <CardTitle className="text-base font-medium">New registrations</CardTitle>
            <CardDescription className="text-sm">Accounts created per day · last 14 days</CardDescription>
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
            <CardTitle className="text-base font-medium">Homework submissions</CardTitle>
            <CardDescription className="text-sm">Submissions received per day · last 14 days</CardDescription>
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
