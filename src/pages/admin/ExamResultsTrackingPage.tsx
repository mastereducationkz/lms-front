import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import apiClient from '../../services/api'

type ExamType = 'sat' | 'ielts'
type TrackingStatus = 'pending' | 'overdue' | 'completed'

interface AssignmentZeroSubmission {
  user_id: number
  full_name: string
  group_name: string
  sat_target_date: string
  sat_planned_test_date?: string | null
  sat_result_score?: string | null
  sat_result_test_date?: string | null
  ielts_target_date?: string | null
  ielts_planned_test_date?: string | null
  ielts_result_score?: string | null
  ielts_result_test_date?: string | null
}

interface TrackingRow {
  key: string
  userId: number
  fullName: string
  groupName: string
  examType: ExamType
  plannedDate: Date
  askDate: Date
  resultScore: string | null
  resultTestDate: string | null
  status: TrackingStatus
}

const SAT_MONTH_TEMPLATE_DAY: Record<number, number> = {
  8: 23,
  9: 13,
  10: 4,
  11: 8,
  12: 6,
  3: 14,
  5: 2,
  6: 6,
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  sept: 9,
  october: 10,
  november: 11,
  december: 12,
}

const formatDate = (value: Date) =>
  value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const parseDateOnly = (value?: string | null): Date | null => {
  if (!value) return null
  const short = `${value}`.slice(0, 10)
  const [year, month, day] = short.split('-').map(Number)
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const resolveLegacySatMonthDate = (target?: string | null): Date | null => {
  if (!target) return null
  const parsedExact = parseDateOnly(target)
  if (parsedExact) return parsedExact

  const monthIndex = MONTH_NAME_TO_INDEX[target.trim().toLowerCase()]
  if (!monthIndex) return null
  const day = SAT_MONTH_TEMPLATE_DAY[monthIndex]
  if (!day) return null

  const now = new Date()
  const currentYear = now.getFullYear()
  const candidateCurrentYear = new Date(currentYear, monthIndex - 1, day)
  if (candidateCurrentYear >= now) return candidateCurrentYear
  return new Date(currentYear + 1, monthIndex - 1, day)
}

const buildTrackingRows = (submissions: AssignmentZeroSubmission[]): TrackingRow[] => {
  const now = new Date()
  const rows: TrackingRow[] = []

  submissions.forEach((submission) => {
    const satPlanned = parseDateOnly(submission.sat_planned_test_date) || resolveLegacySatMonthDate(submission.sat_target_date)
    if (satPlanned) {
      const satAskDate = new Date(satPlanned)
      satAskDate.setDate(satAskDate.getDate() + 13)
      const satCompleted = Boolean(submission.sat_result_score && submission.sat_result_test_date)
      rows.push({
        key: `${submission.user_id}-sat`,
        userId: submission.user_id,
        fullName: submission.full_name,
        groupName: submission.group_name,
        examType: 'sat',
        plannedDate: satPlanned,
        askDate: satAskDate,
        resultScore: submission.sat_result_score || null,
        resultTestDate: submission.sat_result_test_date || null,
        status: satCompleted ? 'completed' : (now > satAskDate ? 'overdue' : 'pending'),
      })
    }

    const ieltsPlanned = parseDateOnly(submission.ielts_planned_test_date) || parseDateOnly(submission.ielts_target_date)
    if (ieltsPlanned) {
      const ieltsAskDate = new Date(ieltsPlanned)
      ieltsAskDate.setDate(ieltsAskDate.getDate() + 13)
      const ieltsCompleted = Boolean(submission.ielts_result_score && submission.ielts_result_test_date)
      rows.push({
        key: `${submission.user_id}-ielts`,
        userId: submission.user_id,
        fullName: submission.full_name,
        groupName: submission.group_name,
        examType: 'ielts',
        plannedDate: ieltsPlanned,
        askDate: ieltsAskDate,
        resultScore: submission.ielts_result_score || null,
        resultTestDate: submission.ielts_result_test_date || null,
        status: ieltsCompleted ? 'completed' : (now > ieltsAskDate ? 'overdue' : 'pending'),
      })
    }
  })

  return rows.sort((a, b) => a.askDate.getTime() - b.askDate.getTime())
}

const statusBadgeClass: Record<TrackingStatus, string> = {
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
}

const ExamResultsTrackingPage = () => {
  const [submissions, setSubmissions] = useState<AssignmentZeroSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TrackingStatus>('all')
  const [trackFilter, setTrackFilter] = useState<'all' | ExamType>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const batchSize = 200
        let skip = 0
        let hasMore = true
        let allRows: AssignmentZeroSubmission[] = []

        while (hasMore) {
          const batch = await apiClient.getAllAssignmentZeroSubmissions({ skip, limit: batchSize })
          allRows = [...allRows, ...batch]
          if (batch.length < batchSize) hasMore = false
          else skip += batchSize
        }

        setSubmissions(allRows)
      } catch (error) {
        console.error('Failed to fetch result tracking data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const rows = useMemo(() => buildTrackingRows(submissions), [submissions])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (trackFilter !== 'all' && row.examType !== trackFilter) return false
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        row.fullName.toLowerCase().includes(query) ||
        row.groupName.toLowerCase().includes(query) ||
        String(row.userId).includes(query)
      )
    })
  }, [rows, statusFilter, trackFilter, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, trackFilter, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="space-y-4">
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student / group / ID"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>All</Button>
              <Button size="sm" variant={statusFilter === 'pending' ? 'default' : 'outline'} onClick={() => setStatusFilter('pending')}>Pending</Button>
              <Button size="sm" variant={statusFilter === 'overdue' ? 'default' : 'outline'} onClick={() => setStatusFilter('overdue')}>Overdue</Button>
              <Button size="sm" variant={statusFilter === 'completed' ? 'default' : 'outline'} onClick={() => setStatusFilter('completed')}>Completed</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={trackFilter === 'all' ? 'default' : 'outline'} onClick={() => setTrackFilter('all')}>All</Button>
              <Button size="sm" variant={trackFilter === 'sat' ? 'default' : 'outline'} onClick={() => setTrackFilter('sat')}>SAT</Button>
              <Button size="sm" variant={trackFilter === 'ielts' ? 'default' : 'outline'} onClick={() => setTrackFilter('ielts')}>IELTS</Button>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Track</TableHead>
                      <TableHead>Planned Date</TableHead>
                      <TableHead>Ask Result On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>
                          <div className="font-medium text-foreground">{row.fullName}</div>
                          <div className="text-xs text-muted-foreground">ID: {row.userId}</div>
                        </TableCell>
                        <TableCell>{row.groupName || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">{row.examType}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(row.plannedDate)}</TableCell>
                        <TableCell>{formatDate(row.askDate)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass[row.status]}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.resultScore && row.resultTestDate
                            ? `${row.resultScore} (${`${row.resultTestDate}`.slice(0, 10)})`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {!pageRows.length && (
                <div className="py-10 text-center text-sm text-muted-foreground">No data for selected filters</div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ExamResultsTrackingPage
