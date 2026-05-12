import React, { useState, useEffect, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { toast } from '../components/Toast';
import api from '../services/api';
import {
  GroupCard,
  ViewDialog,
  HomeworkFilters,
} from '../components/curator-homeworks';
import type {
  GroupData,
  AssignmentData,
  StudentProgress,
  StatusFilter,
  SubmissionDetails,
} from '../components/curator-homeworks';

const CuratorHomeworksPage: React.FC = () => {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCompletedGroups, setShowCompletedGroups] = useState(false);

  // View dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<StudentProgress | null>(null);
  const [viewAssignment, setViewAssignment] = useState<AssignmentData | null>(null);

  // Submission details state
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetails | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  useEffect(() => {
    fetchHomeworks();
  }, []);

  const fetchHomeworks = async () => {
    try {
      setLoading(true);
      const response = await api.getCuratorHomeworkByGroup();
      const groupsData = response?.groups || [];
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      if (Array.isArray(groupsData) && groupsData.length > 0) {
        setExpandedGroups(new Set([groupsData[0].group_id]));
      }
    } catch (error) {
      console.error('Error fetching homeworks:', error);
      toast('Не удалось загрузить домашние задания', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionDetails = async (assignmentId: number, submissionId: number) => {
    try {
      setLoadingSubmission(true);
      const details = await api.getSubmission(
        assignmentId.toString(),
        submissionId.toString()
      );
      setSubmissionDetails(details);
    } catch (error) {
      console.error('Error fetching submission details:', error);
      toast('Не удалось загрузить детали работы', 'error');
      setSubmissionDetails(null);
    } finally {
      setLoadingSubmission(false);
    }
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleAssignment = (key: string) => {
    setExpandedAssignments((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleViewStudent = (student: StudentProgress, assignment: AssignmentData) => {
    setViewStudent(student);
    setViewAssignment(assignment);
    setViewDialogOpen(true);
    setSubmissionDetails(null);

    // Fetch submission details if available
    if (student.submission_id) {
      fetchSubmissionDetails(assignment.id, student.submission_id);
    }
  };

  const handleCloseViewDialog = (open: boolean) => {
    setViewDialogOpen(open);
    if (!open) {
      setSubmissionDetails(null);
    }
  };

  const visibleGroups = useMemo(() => {
    if (showCompletedGroups) {
      return groups;
    }
    return groups.filter((group) => !group.is_over);
  }, [groups, showCompletedGroups]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <FileText className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg">Нет домашних заданий</p>
        <p className="text-sm">
          {groups.length > 0
            ? 'Включите показ завершенных групп в фильтрах'
            : 'Задания ваших групп появятся здесь'}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Домашние задания</h1>
      </div>

      <HomeworkFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        showCompletedGroups={showCompletedGroups}
        onShowCompletedGroupsChange={setShowCompletedGroups}
      />

      <div className="space-y-4">
        {visibleGroups.map((group) => (
          <GroupCard
            key={group.group_id}
            group={group}
            isExpanded={expandedGroups.has(group.group_id)}
            onToggle={() => toggleGroup(group.group_id)}
            expandedAssignments={expandedAssignments}
            onToggleAssignment={toggleAssignment}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            onViewStudent={handleViewStudent}
          />
        ))}
      </div>

      <ViewDialog
        open={viewDialogOpen}
        onOpenChange={handleCloseViewDialog}
        student={viewStudent}
        assignment={viewAssignment}
        submissionDetails={submissionDetails}
        isLoading={loadingSubmission}
      />
    </div>
  );
};

export default CuratorHomeworksPage;
