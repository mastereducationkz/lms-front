import React from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Badge } from '../ui/badge';
import { AssignmentCard } from './AssignmentCard';
import type { GroupData, AssignmentData, StudentProgress, StatusFilter } from './types';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/curatorHomeworks';

interface GroupCardProps {
  group: GroupData;
  isExpanded: boolean;
  onToggle: () => void;
  expandedAssignments: Set<string>;
  onToggleAssignment: (key: string) => void;
  searchQuery: string;
  statusFilter: StatusFilter;
  onViewStudent: (student: StudentProgress, assignment: AssignmentData) => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  group,
  isExpanded,
  onToggle,
  expandedAssignments,
  onToggleAssignment,
  searchQuery,
  statusFilter,
  onViewStudent,
}) => {
  const t = useT();
  const totalPending = group.assignments.reduce(
    (sum, a) => sum + (a.summary.submitted - a.summary.graded),
    0
  );

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
          <Users className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg">{group.group_name}</span>
          {group.is_over && (
            <Badge variant="outline">{t('curatorHomeworks.group.finished')}</Badge>
          )}
          <Badge variant="secondary">{t('curatorHomeworks.group.assignments', { count: group.assignments.length })}</Badge>
          {totalPending > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {t('curatorHomeworks.count.inReview', { count: totalPending })}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {t('curatorHomeworks.group.students', { count: group.students_count })}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t">
          {group.assignments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('curatorHomeworks.group.noAssignments')}
            </div>
          ) : (
            <div className="divide-y">
              {group.assignments.map((assignment) => {
                const key = `${group.group_id}-${assignment.id}`;
                return (
                  <AssignmentCard
                    key={key}
                    assignment={assignment}
                    isExpanded={expandedAssignments.has(key)}
                    onToggle={() => onToggleAssignment(key)}
                    searchQuery={searchQuery}
                    statusFilter={statusFilter}
                    onViewStudent={onViewStudent}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
