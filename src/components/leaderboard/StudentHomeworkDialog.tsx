import { useEffect, useMemo, useState } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import api from '../../services/api';
import { getCuratorStudentHomework } from '../../services/api/curator';
import type { StudentHomeworkItem } from '../../services/api/curator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { StatusBadge, ViewDialog } from '../curator-homeworks';
import type { StudentProgress, AssignmentData, SubmissionDetails } from '../curator-homeworks';
import { PROGRAM_LABELS } from '../../lib/groupPicker';
import type { CourseType } from '../../types';
import { cn } from '../../lib/utils';

// Canonical program order for the filter tabs.
const PROGRAM_ORDER: CourseType[] = ['sat', 'ielts', 'nuet', 'general_english'];

// Resolve an item's program from its group's program_type, falling back to
// keyword detection in the group name (mirrors groupPicker.getGroupProgramType).
const programOfItem = (item: StudentHomeworkItem): CourseType => {
  const stored = item.program_type as CourseType | undefined;
  if (stored === 'sat' || stored === 'ielts' || stored === 'nuet') return stored;
  const name = item.group_name || '';
  if (/\bielts\b/i.test(name)) return 'ielts';
  if (/\bnuet\b/i.test(name)) return 'nuet';
  if (/\bsat\b/i.test(name)) return 'sat';
  return stored || 'general_english';
};

interface StudentHomeworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number | null;
  studentName: string;
}

const formatDeadline = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Map an endpoint item -> the shapes the reused ViewDialog expects.
const toStudentProgress = (item: StudentHomeworkItem, studentName: string): StudentProgress => ({
  student_id: 0,
  student_name: studentName,
  student_email: '',
  status: item.status,
  submission_id: item.submission_id,
  score: item.score,
  max_score: item.max_score,
  submitted_at: item.submitted_at,
  graded_at: item.graded_at,
  feedback: item.feedback,
});

const toAssignmentData = (item: StudentHomeworkItem): AssignmentData => ({
  id: item.assignment_id,
  title: item.title,
  description: '',
  course_title: item.group_name,
  due_date: item.due_date,
  max_score: item.max_score,
  assignment_type: item.assignment_type,
  content: item.content || undefined,
  summary: {
    total_students: 0,
    submitted: 0,
    graded: 0,
    not_submitted: 0,
    overdue: 0,
    average_score: 0,
  },
  students: [],
});

export function StudentHomeworkDialog({ open, onOpenChange, studentId, studentName }: StudentHomeworkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StudentHomeworkItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeProgram, setActiveProgram] = useState<CourseType | 'all'>('all');

  // Detail (reused ViewDialog) state
  const [viewOpen, setViewOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeStudent, setActiveStudent] = useState<StudentProgress | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<AssignmentData | null>(null);
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetails | null>(null);

  useEffect(() => {
    if (!open || studentId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);
    setActiveProgram('all');
    getCuratorStudentHomework(studentId)
      .then((res) => {
        if (!cancelled) setItems(res.items || []);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить домашние задания');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  // Distinct programs (courses) the student has homework in, in canonical order.
  // Tabs only appear when the student studies >1 course at once (e.g. SAT + IELTS).
  const programs = useMemo(() => {
    const present = new Set(items.map(programOfItem));
    return PROGRAM_ORDER.filter((p) => present.has(p));
  }, [items]);
  const showProgramTabs = programs.length > 1;

  const visibleItems = useMemo(
    () => (activeProgram === 'all' ? items : items.filter((i) => programOfItem(i) === activeProgram)),
    [items, activeProgram],
  );

  // Show a group column only when the visible rows span >1 group.
  const showGroupColumn = useMemo(
    () => new Set(visibleItems.map((i) => i.group_id)).size > 1,
    [visibleItems],
  );

  const handleRowClick = async (item: StudentHomeworkItem) => {
    if (item.submission_id == null) return;
    setActiveStudent(toStudentProgress(item, studentName));
    setActiveAssignment(toAssignmentData(item));
    setSubmissionDetails(null);
    setViewOpen(true);
    setDetailLoading(true);
    try {
      const details = await api.getSubmission(item.assignment_id.toString(), item.submission_id.toString());
      setSubmissionDetails(details);
    } catch {
      setSubmissionDetails(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Все домашние задания — {studentName}
            </DialogTitle>
          </DialogHeader>

          {showProgramTabs && (
            <div className="flex items-center gap-1 px-5 pt-2 border-b border-gray-100 dark:border-border overflow-x-auto shrink-0">
              {(['all' as const, ...programs]).map((p) => {
                const active = activeProgram === p;
                const label = p === 'all' ? 'Все' : PROGRAM_LABELS[p];
                const count = p === 'all'
                  ? items.length
                  : items.filter((i) => programOfItem(i) === p).length;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setActiveProgram(p)}
                    className={cn(
                      'px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                      active
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
                    )}
                  >
                    {label} <span className="text-xs opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загрузка…
              </div>
            ) : error ? (
              <div className="text-center py-12 text-sm text-red-500">{error}</div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                У этого ученика пока нет домашних заданий.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-border">
                    <th className="font-medium pb-2 pr-2">Задание</th>
                    {showGroupColumn && <th className="font-medium pb-2 pr-2">Группа</th>}
                    <th className="font-medium pb-2 pr-2 whitespace-nowrap">Дедлайн</th>
                    <th className="font-medium pb-2 pl-2 text-right">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const clickable = item.submission_id != null;
                    return (
                      <tr
                        key={`${item.assignment_id}-${item.group_id}`}
                        onClick={() => handleRowClick(item)}
                        className={
                          'border-b border-gray-50 dark:border-border/50 ' +
                          (clickable
                            ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-muted/40 transition-colors'
                            : 'opacity-70')
                        }
                      >
                        <td className="py-2.5 pr-2 font-medium text-gray-900 dark:text-foreground">
                          {item.title}
                        </td>
                        {showGroupColumn && (
                          <td className="py-2.5 pr-2 text-gray-500 dark:text-muted-foreground truncate max-w-[160px]" title={item.group_name}>
                            {item.group_name}
                          </td>
                        )}
                        <td className="py-2.5 pr-2 text-gray-500 dark:text-muted-foreground whitespace-nowrap">
                          {formatDeadline(item.due_date)}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <StatusBadge status={item.status} score={item.score} maxScore={item.max_score} late={item.late} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ViewDialog
        open={viewOpen}
        onOpenChange={(o) => {
          setViewOpen(o);
          if (!o) setSubmissionDetails(null);
        }}
        student={activeStudent}
        assignment={activeAssignment}
        submissionDetails={submissionDetails}
        isLoading={detailLoading}
      />
    </>
  );
}
