import { useEffect, useMemo, useState } from 'react'
import apiClient from '../services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'

type ExamType = 'sat' | 'ielts'
type RowStatus = 'pending' | 'overdue' | 'completed'

type UpcomingRow = {
  user_id: number
  full_name: string
  group_name: string
  exam_type: ExamType
  planned_test_date: string | null
  ask_result_on: string | null
  status: RowStatus
  sat_result_score?: string | null
  sat_result_test_date?: string | null
  ielts_result_score?: string | null
  ielts_result_test_date?: string | null
}

const statusBadge: Record<RowStatus, string> = {
  pending: 'border-border text-muted-foreground',
  overdue: 'border-red-200 text-red-700 bg-red-50',
  completed: 'border-green-200 text-green-700 bg-green-50',
}

const statusLabel: Record<RowStatus, string> = {
  pending: 'ожидает',
  overdue: 'просрочено',
  completed: 'завершено',
}

const examLabel: Record<ExamType, string> = {
  sat: 'SAT',
  ielts: 'IELTS',
}

const formatDate = (iso: string | null) => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function CuratorExamResultsPage() {
  const [rows, setRows] = useState<UpcomingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | RowStatus>('all')

  const [editing, setEditing] = useState<UpcomingRow | null>(null)
  const [mode, setMode] = useState<'result' | 'reschedule'>('result')
  const [resultScore, setResultScore] = useState('')
  const [resultDate, setResultDate] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiClient.getCuratorUpcomingExamResults({ days })
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (!q) return true
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.group_name.toLowerCase().includes(q) ||
        String(r.user_id).includes(q)
      )
    })
  }, [rows, query, status])

  const openResult = (row: UpcomingRow) => {
    setEditing(row)
    setMode('result')
    setResultScore('')
    setResultDate(row.planned_test_date || '')
  }

  const openReschedule = (row: UpcomingRow) => {
    setEditing(row)
    setMode('reschedule')
    setPlannedDate(row.planned_test_date || '')
  }

  const close = () => {
    setEditing(null)
    setSaving(false)
  }

  const handleSave = async () => {
    if (!editing) return
    if (saving) return
    setSaving(true)
    try {
      if (mode === 'result') {
        if (!resultScore.trim() || !resultDate) return
        await apiClient.curatorUpdateExamResult({
          user_id: editing.user_id,
          exam_type: editing.exam_type,
          result_score: resultScore.trim(),
          result_test_date: resultDate,
        })
      } else {
        if (!plannedDate) return
        await apiClient.curatorUpdatePlannedExamDate({
          user_id: editing.user_id,
          exam_type: editing.exam_type,
          planned_test_date: plannedDate,
        })
      }
      await load()
      close()
    } finally {
      setSaving(false)
    }
  }

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (isOpen) return
    close()
  }

  const isDialogOpen = Boolean(editing)
  const dialogTitle = mode === 'result' ? 'Добавить результат' : 'Перенести дату'

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Результаты экзаменов</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ближайшие и просроченные задачи по сбору результатов ваших учеников
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          Обновить
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Фильтры</CardTitle>
          <CardDescription className="text-sm">
            Строк: <span className="font-semibold tabular-nums text-foreground">{filtered.length}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground">Дней</span>
              <Input
                value={String(days)}
                onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value || 7))))}
                className="w-20"
                inputMode="numeric"
              />
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск: ученик / группа / ID"
              className="md:max-w-md"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={status === 'all' ? 'default' : 'outline'} onClick={() => setStatus('all')}>Все</Button>
              <Button size="sm" variant={status === 'pending' ? 'default' : 'outline'} onClick={() => setStatus('pending')}>Ожидает</Button>
              <Button size="sm" variant={status === 'overdue' ? 'default' : 'outline'} onClick={() => setStatus('overdue')}>Просрочено</Button>
              <Button size="sm" variant={status === 'completed' ? 'default' : 'outline'} onClick={() => setStatus('completed')}>Завершено</Button>
            </div>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ученик</TableHead>
                  <TableHead>Группа</TableHead>
                  <TableHead>Экзамен</TableHead>
                  <TableHead>План</TableHead>
                  <TableHead>Спросить</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Загрузка…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Нет строк
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={`${r.user_id}-${r.exam_type}`}>
                      <TableCell>
                        <div className="font-medium text-foreground">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">ID: {r.user_id}</div>
                      </TableCell>
                      <TableCell>{r.group_name || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase">{examLabel[r.exam_type]}</Badge></TableCell>
                      <TableCell>{formatDate(r.planned_test_date)}</TableCell>
                      <TableCell>{formatDate(r.ask_result_on)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge[r.status]}>{statusLabel[r.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openReschedule(r)}>
                            Перенести
                          </Button>
                          <Button size="sm" onClick={() => openResult(r)}>
                            Добавить
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:rounded-md">
          <DialogHeader>
            <DialogTitle className="text-base">{dialogTitle}</DialogTitle>
            <DialogDescription className="text-sm">
              {editing ? (
                <span className="text-muted-foreground">
                  {editing.full_name} · {examLabel[editing.exam_type]} · {editing.group_name || '—'}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {editing && mode === 'result' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Балл</p>
                <Input
                  value={resultScore}
                  onChange={(e) => setResultScore(e.target.value)}
                  placeholder="Напр. 1450 / 7.0"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Дата экзамена</p>
                <Input
                  value={resultDate}
                  onChange={(e) => setResultDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  inputMode="numeric"
                />
              </div>
            </div>
          ) : editing ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Новая плановая дата</p>
              <Input
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                При переносе результат будет очищен
              </p>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={close} disabled={saving}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !editing ||
                (mode === 'result' ? !resultScore.trim() || !resultDate : !plannedDate)
              }
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

