import React from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { StudentsTable } from './StudentsTable';
import type { AssignmentData, StudentProgress, StatusFilter } from './types';
import { formatDate as formatDay } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/curatorHomeworks';

interface AssignmentCardProps {
  assignment: AssignmentData;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery: string;
  statusFilter: StatusFilter;
  onViewStudent: (student: StudentProgress, assignment: AssignmentData) => void;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '';
  return formatDay(dateString, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const AssignmentCard: React.FC<AssignmentCardProps> = ({
  assignment,
  isExpanded,
  onToggle,
  searchQuery,
  statusFilter,
  onViewStudent,
}) => {
  const t = useT();
  const { summary } = assignment;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <FileText className="w-4 h-4 text-brand" />
          <div className="text-left">
            <div className="font-medium">{assignment.title}</div>
            <div className="text-sm text-muted-foreground">{assignment.course_title}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {assignment.due_date && (
            <span className="text-sm text-muted-foreground">
              {t('curatorHomeworks.assignment.due', { date: formatDate(assignment.due_date) })}
            </span>
          )}
          <Badge variant="outline">
            {t('curatorHomeworks.count.graded', { graded: summary.graded, submitted: summary.submitted })}
          </Badge>
          {summary.not_submitted > 0 && (
            <Badge variant="secondary">
              {t('curatorHomeworks.count.notSubmitted', { count: summary.not_submitted })}
            </Badge>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="bg-muted/20 p-4">
          <StudentsTable
            students={assignment.students}
            assignment={assignment}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            onViewStudent={(student) => onViewStudent(student, assignment)}
          />
        </div>
      )}
    </div>
  );
};
