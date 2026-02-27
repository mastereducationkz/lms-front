import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/api';
import { ClipboardList, Calendar, AlertCircle, Eye, Edit, Archive, ArchiveRestore, Copy, ArrowLeft, Search, Users, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Group } from '../../types';

interface AssignmentStats {
  total_students: number;
  submitted: number;
  graded: number;
  not_submitted: number;
  overdue: number;
}

const PAGE_SIZE = 25;

// Helper to format UTC datetime string to Kazakhstan time
const formatToKZTime = (dateStr: string | undefined) => {
  if (!dateStr) return '-';
  // Ensure UTC is properly interpreted by adding Z if not present
  const utcDateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  return new Date(utcDateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false, 
    timeZone: 'Asia/Almaty' 
  });
};

interface AssignmentWithStatus {
  id: number;
  title: string;
  description?: string;
  group_id?: number;
  group_name?: string;
  lesson_number?: number;
  due_date?: string;
  event_start_datetime?: string;
  created_at: string;
  file_url?: string;
  allowed_file_types?: string[];
  max_score?: number;
  is_hidden?: boolean;
  status?: 'not_submitted' | 'submitted' | 'graded' | 'overdue';
  score?: number;
  submitted_at?: string;
  graded_at?: string;
  has_file_submission?: boolean;
  extended_deadline?: string;
  extension_reason?: string;
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentWithStatus[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // Tab/Filter persistence
  const filter = (searchParams.get('tab') as 'all' | 'pending' | 'submitted' | 'graded' | 'overdue') || 'all';
  const selectedGroupId = searchParams.get('group_id') || 'all';
  const [includeHidden, setIncludeHidden] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [page, setPage] = useState(1);
  const [assignmentStats, setAssignmentStats] = useState<Map<number, AssignmentStats>>(new Map());
  const [statsLoading, setStatsLoading] = useState(false);

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const setFilter = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  const setGroupId = (id: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (id === 'all') {
      newParams.delete('group_id');
    } else {
      newParams.set('group_id', id);
    }
    setSearchParams(newParams);
    setPage(1);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedGroupId, filter]);

  // Load submission stats for the selected group when teacher enters group view
  useEffect(() => {
    if (!isTeacher || selectedGroupId === 'all') return;
    const groupAssignments = assignments.filter(a => {
      if (selectedGroupId === 'ungrouped') return a.group_id == null;
      return a.group_id?.toString() === selectedGroupId;
    });
    if (groupAssignments.length === 0) return;

    const unloaded = groupAssignments.filter(a => !assignmentStats.has(a.id));
    if (unloaded.length === 0) return;

    setStatsLoading(true);
    Promise.all(
      unloaded.map(a =>
        apiClient.getAssignmentStudentProgress(String(a.id))
          .then(data => ({ id: a.id, summary: data.summary as AssignmentStats }))
          .catch(() => null)
      )
    ).then(results => {
      setAssignmentStats(prev => {
        const next = new Map(prev);
        for (const r of results) {
          if (r) next.set(r.id, r.summary);
        }
        return next;
      });
      setStatsLoading(false);
    });
  }, [selectedGroupId, assignments, isTeacher]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadAssignments(),
      loadGroups()
    ]);
    setLoading(false);
  };

  const loadGroups = async () => {
    if (user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'curator') {
      try {
        const groupsData = await apiClient.getGroups();
        setGroups(groupsData);
      } catch (err) {
        console.warn('Failed to load groups:', err);
      }
    }
  };

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Loading assignments for user:', user?.id, 'role:', user?.role);

      // For teachers/admins, always load ALL assignments including hidden
      const params: any = {};
      if (user?.role === 'teacher' || user?.role === 'admin') {
        params.include_hidden = true;
      }
      const assignmentData = await apiClient.getAssignments(params);
      console.log('Raw assignment data:', assignmentData);
      
      // Get user's submissions to check status
      let userSubmissions: any[] = [];
      try {
        userSubmissions = await apiClient.getMySubmissions();
        console.log('User submissions:', userSubmissions);
      } catch (err) {
        console.warn('Could not load user submissions:', err);
      }
      
      // Get user's extensions if student (parallel)
      const extensionsMap = new Map();
      if (user?.role === 'student') {
        try {
          const results = await Promise.all(
            assignmentData.map((a: any) =>
              apiClient.getMyExtension(String(a.id)).then(ext => ({ id: a.id, ext })).catch(() => ({ id: a.id, ext: null }))
            )
          );
          for (const { id, ext } of results) {
            if (ext) extensionsMap.set(id, ext);
          }
        } catch (err) {
          console.warn('Could not load extensions:', err);
        }
      }
      
      // Enhance assignments with status information
      const assignmentsWithStatus = assignmentData.map((assignment: any) => {
        let status = 'not_submitted';
        let score = undefined;
        let submitted_at = undefined;
        let graded_at = undefined;
        let has_file_submission = false;

        // Find submission for this assignment
        const submission = userSubmissions.find((sub: any) => sub.assignment_id === assignment.id);
        
        // Check for extension
        const extension = extensionsMap.get(assignment.id);
        const effectiveDeadline = extension?.extended_deadline || assignment.due_date;
        
        if (submission) {
          if (submission.is_graded && submission.score !== null) {
            status = 'graded';
            score = submission.score;
            graded_at = submission.graded_at;
          } else {
            status = 'submitted';
          }
          submitted_at = submission.submitted_at;
          has_file_submission = !!submission.file_url;
        } else if (effectiveDeadline && new Date(effectiveDeadline) < new Date()) {
          status = 'overdue';
        }

        return {
          ...assignment,
          status,
          score,
          submitted_at,
          graded_at,
          has_file_submission,
          extended_deadline: extension?.extended_deadline,
          extension_reason: extension?.reason
        };
      });

      console.log('Assignments with status:', assignmentsWithStatus);
      setAssignments(assignmentsWithStatus);
    } catch (err) {
      console.error('Failed to load assignments:', err);
      setError('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  // Assignments filtered by hidden only (for building group overview)
  const assignmentsByHidden = assignments.filter(a => includeHidden || !a.is_hidden);

  // Build groups with metrics for overview mode (from assignments + known groups)
  const groupsWithAssignments = useMemo(() => {
    const byGroup = new Map<string | number, { id: string; name: string; assignments: AssignmentWithStatus[] }>();
    const getGroupKey = (a: AssignmentWithStatus) => a.group_id ?? 'ungrouped';
    const getGroupName = (a: AssignmentWithStatus) =>
      a.group_name || groups.find(g => g.id === a.group_id)?.name || `Group #${a.group_id || 'Unknown'}`;

    for (const a of assignmentsByHidden) {
      const key = getGroupKey(a);
      const name = key === 'ungrouped' ? 'Ungrouped' : getGroupName(a);
      const id = String(key);
      if (!byGroup.has(key)) {
        byGroup.set(key, { id, name, assignments: [] });
      }
      byGroup.get(key)!.assignments.push(a);
    }
    return Array.from(byGroup.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assignmentsByHidden, groups]);

  const getAssignmentSortTime = (assignment: AssignmentWithStatus) => {
    const timestamp = Date.parse(assignment.created_at || assignment.due_date || assignment.event_start_datetime || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  // Filtered assignments for group mode (by group + status)
  const filteredAssignments = assignments.filter(assignment => {
    if (!includeHidden && assignment.is_hidden) return false;
    if (selectedGroupId !== 'all') {
      if (selectedGroupId === 'ungrouped') {
        if (assignment.group_id != null) return false;
      } else if (assignment.group_id?.toString() !== selectedGroupId) {
        return false;
      }
    }
    if (user?.role === 'student' && filter === 'all') {
      const effectiveDeadline = assignment.extended_deadline || assignment.due_date;
      const isPastDeadline = effectiveDeadline && new Date(effectiveDeadline) < new Date();
      if (assignment.status === 'graded' && isPastDeadline) return false;
    }
    switch (filter) {
      case 'pending': return assignment.status === 'not_submitted';
      case 'submitted': return assignment.status === 'submitted';
      case 'graded': return assignment.status === 'graded';
      case 'overdue': return assignment.status === 'overdue';
      default: return true;
    }
  }).sort((a, b) => getAssignmentSortTime(b) - getAssignmentSortTime(a));

  // Pagination for group mode
  const totalPages = Math.ceil(filteredAssignments.length / PAGE_SIZE) || 1;
  const paginatedAssignments = filteredAssignments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const isOverviewMode = selectedGroupId === 'all';
  const selectedGroup = groupsWithAssignments.find(g => g.id === selectedGroupId);



  const getStatusBadge = (assignment: AssignmentWithStatus) => {
    const baseClasses = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider";
    
    switch (assignment.status) {
      case 'graded':
        return (
          <span className={`${baseClasses} bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800`}>
            Graded
          </span>
        );
      case 'submitted':
        return (
          <span className={`${baseClasses} bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800`}>
            Submitted
          </span>
        );
      case 'overdue':
        return (
          <span className={`${baseClasses} bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800`}>
            Overdue
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700`}>
            Not Submitted
          </span>
        );
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6"></div>
          <div className="bg-white dark:bg-card rounded-xl shadow p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Homework</h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <h3 className="font-semibold text-red-800 dark:text-red-400">Error</h3>
          </div>
          <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
          <Button 
            onClick={loadAssignments}
            variant="outline"
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const countSource = isOverviewMode ? assignmentsByHidden : (selectedGroup?.assignments ?? []);
  const excludeStudentGradedPast = (a: AssignmentWithStatus) => {
    if (user?.role !== 'student') return true;
    const effectiveDeadline = a.extended_deadline || a.due_date;
    const isPastDeadline = effectiveDeadline && new Date(effectiveDeadline) < new Date();
    return !(a.status === 'graded' && isPastDeadline);
  };
  const tabCounts = {
    all: countSource.filter(excludeStudentGradedPast).length,
    pending: countSource.filter(a => a.status === 'not_submitted').length,
    submitted: countSource.filter(a => a.status === 'submitted').length,
    graded: countSource.filter(a => a.status === 'graded').length,
    overdue: countSource.filter(a => a.status === 'overdue').length
  };

  const filteredGroupsForOverview = groupSearch.trim()
    ? groupsWithAssignments.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
    : groupsWithAssignments;

  const renderAssignmentRow = (assignment: AssignmentWithStatus) => {
    const stats = assignmentStats.get(assignment.id);
    const dueDateCell = (
      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
        {assignment.extended_deadline ? (
          <div className="flex items-center text-green-600 dark:text-green-400">
            <Calendar className="w-4 h-4 mr-1 text-green-400" />
            <span className="font-medium">{formatToKZTime(assignment.extended_deadline)}</span>
            <span className="ml-1 text-[9px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1 rounded border border-green-100 dark:border-green-800 font-bold uppercase tracking-tight">Ext</span>
          </div>
        ) : assignment.due_date ? (
          <div className={`flex items-center ${isOverdue(assignment.due_date) && assignment.status === 'not_submitted' ? 'text-red-600 dark:text-red-400' : ''}`}>
            <Calendar className={`w-4 h-4 mr-1 ${isOverdue(assignment.due_date) && assignment.status === 'not_submitted' ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`} />
            <span className="font-medium">{formatToKZTime(assignment.due_date)}</span>
          </div>
        ) : assignment.event_start_datetime ? (
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1 text-gray-400 dark:text-gray-500" />
            <span className="font-medium">{formatToKZTime(assignment.event_start_datetime)}</span>
          </div>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">-</span>
        )}
      </td>
    );

    return (
      <tr key={assignment.id} className="border-t hover:bg-gray-50/50 dark:hover:bg-secondary">
        <td className="px-6 py-4">
          <div>
            <div
              className="font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              onClick={() => navigate(`/homework/${assignment.id}`)}
            >
              {assignment.title}
            </div>
            {assignment.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                {assignment.description}
              </div>
            )}
          </div>
        </td>
        {dueDateCell}

        {isTeacher ? (
          <>
            {/* Lesson */}
            <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">
              {assignment.lesson_number != null
                ? <span className="font-medium text-slate-700 dark:text-slate-300">Lesson {assignment.lesson_number}</span>
                : <span className="text-gray-300 dark:text-gray-600">—</span>
              }
            </td>
            {/* Points */}
            <td className="px-6 py-4">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{assignment.max_score ?? 100} pts</span>
            </td>
            {/* Submission stats */}
            <td className="px-6 py-4">
              {statsLoading && !stats ? (
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : stats ? (
                <div className="space-y-1.5 min-w-[130px]">
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${stats.total_students > 0 ? Math.round(((stats.submitted + stats.graded) / stats.total_students) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                      {stats.submitted + stats.graded}/{stats.total_students}
                    </span>
                  </div>
                  <div className="flex gap-2 text-[11px]">
                    {stats.graded > 0 && (
                      <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                        {stats.graded} graded
                      </span>
                    )}
                    {stats.submitted > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                        {stats.submitted} to grade
                      </span>
                    )}
                    {stats.graded === 0 && stats.submitted === 0 && (
                      <span className="text-gray-400 dark:text-gray-500">No submissions</span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
              )}
            </td>
          </>
        ) : (
          <>
            <td className="px-6 py-4">{getStatusBadge(assignment)}</td>
            <td className="px-6 py-4">
              {assignment.status === 'graded' ? (
                <div className="flex flex-col">
                  <span className="text-green-600 dark:text-green-400 font-semibold">{assignment.score}/{assignment.max_score ?? 100}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {Math.round((assignment.score || 0) / (assignment.max_score || 100) * 100)}%
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">-</span>
              )}
            </td>
          </>
        )}

        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-1">
            {isTeacher ? (
              <>
                <Button onClick={() => navigate(`/homework/${assignment.id}/progress`)} variant="ghost" size="icon" title="View Progress" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button onClick={() => navigate(`/homework/new?copyFrom=${assignment.id}`)} variant="ghost" size="icon" title="Copy Assignment" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button onClick={() => navigate(`/homework/${assignment.id}/edit`)} variant="ghost" size="icon" title="Edit Assignment" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await apiClient.toggleAssignmentVisibility(String(assignment.id));
                      loadAssignments();
                    } catch (err) {
                      console.error('Failed to toggle visibility:', err);
                    }
                  }}
                  variant="ghost"
                  size="icon"
                  title={assignment.is_hidden ? "Restore" : "Archive"}
                  className={`h-8 w-8 ${assignment.is_hidden ? "text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-400" : "text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-400"}`}
                >
                  {assignment.is_hidden ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate(`/homework/${assignment.id}`)}
                variant="ghost"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold uppercase tracking-widest text-[10px]"
              >
                {assignment.status === 'graded' || assignment.status === 'submitted' ? 'View' : 'Submit'}
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
          Homework
        </h1>
        {user?.role === 'teacher' || user?.role === 'admin' ? (
          <Button onClick={() => navigate('/homework/new')} variant="default" size="sm">
            Create Homework
          </Button>
        ) : null}
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 -mx-8 px-8 flex flex-wrap items-center gap-4">
        <div className="bg-white dark:bg-card rounded-lg p-1 shadow-sm border border-gray-200 dark:border-border inline-flex">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'submitted', label: 'Submitted' },
            { key: 'graded', label: 'Graded' },
            { key: 'overdue', label: 'Overdue' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                filter === tab.key ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label} ({tabCounts[tab.key as keyof typeof tabCounts]})
            </button>
          ))}
        </div>

        {!isOverviewMode && selectedGroup && (
          <Button variant="outline" size="sm" onClick={() => setGroupId('all')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to groups
          </Button>
        )}

        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <div className="flex items-center gap-2 ml-auto">
            <Checkbox id="show-hidden" checked={includeHidden} onCheckedChange={(checked) => setIncludeHidden(checked === true)} />
            <label htmlFor="show-hidden" className="text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">Show archived</label>
          </div>
        )}
      </div>

      {/* Content: Overview or Group mode */}
      {isOverviewMode ? (
        <div className="space-y-6">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Search groups..."
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-card"
            />
          </div>

          {filteredGroupsForOverview.length === 0 ? (
            <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-border p-12 text-center">
              <ClipboardList className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No homework yet</h3>
              <p className="text-gray-600 dark:text-gray-300">Homework will appear here when they are created by your teachers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredGroupsForOverview.map((g) => {
                const total = g.assignments.length;
                const filtered = g.assignments.filter(a => {
                  switch (filter) {
                    case 'pending': return a.status === 'not_submitted';
                    case 'submitted': return a.status === 'submitted';
                    case 'graded': return a.status === 'graded';
                    case 'overdue': return a.status === 'overdue';
                    default: return true;
                  }
                });
                if (filter !== 'all' && filtered.length === 0) return null;

                // For teachers, show group-level stats from loaded assignmentStats
                const groupStats = isTeacher
                  ? g.assignments.reduce(
                      (acc, a) => {
                        const s = assignmentStats.get(a.id);
                        if (s) {
                          acc.totalStudents = Math.max(acc.totalStudents, s.total_students);
                          acc.submitted += s.submitted;
                          acc.graded += s.graded;
                          acc.toGrade += s.submitted;
                        }
                        return acc;
                      },
                      { totalStudents: 0, submitted: 0, graded: 0, toGrade: 0 }
                    )
                  : null;

                // Student-facing stats
                const pending = g.assignments.filter(a => a.status === 'not_submitted').length;
                const submitted = g.assignments.filter(a => a.status === 'submitted').length;
                const graded = g.assignments.filter(a => a.status === 'graded').length;

                return (
                  <button
                    key={g.id}
                    onClick={() => setGroupId(g.id)}
                    className="bg-white dark:bg-card rounded-lg border border-slate-200 dark:border-border p-4 text-left hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-slate-400 dark:text-gray-500 shrink-0" />
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">{g.name}</h3>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{total} assignment{total !== 1 ? 's' : ''}</div>
                    {isTeacher ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {groupStats && groupStats.toGrade > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            to grade
                          </span>
                        )}
                        {groupStats && groupStats.graded > 0 && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            graded
                          </span>
                        )}
                        {(!groupStats || (groupStats.toGrade === 0 && groupStats.graded === 0)) && (
                          <span className="text-gray-400 dark:text-gray-500">Click to view</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {pending > 0 && <span className="text-amber-600 dark:text-amber-400">{pending} pending</span>}
                        {submitted > 0 && <span className="text-blue-600 dark:text-blue-400">{submitted} submitted</span>}
                        {graded > 0 && <span className="text-green-600 dark:text-green-400">{graded} graded</span>}
                        {pending === 0 && submitted === 0 && graded === 0 && (
                          <span className="text-gray-400 dark:text-gray-500">All done</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredAssignments.length === 0 ? (
            <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-border p-12 text-center">
              <ClipboardList className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {filter === 'all' ? 'No homework in this group' : `No ${filter} homework in this group`}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {filter === 'all' ? 'Select another group or create new homework.' : `You don't have any ${filter} homework in this group.`}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-card rounded-lg border border-slate-200 dark:border-border overflow-hidden shadow-none">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white dark:bg-card text-slate-500 dark:text-gray-400 border-b border-slate-100 dark:border-border">
                      <tr>
                        <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Homework</th>
                        <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Due Date</th>
                        {isTeacher ? (
                          <>
                            <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Lesson</th>
                            <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Points</th>
                            <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Submissions</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Status</th>
                            <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Grade</th>
                          </>
                        )}
                        <th className="text-right px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-border">
                      {paginatedAssignments.map(assignment => renderAssignmentRow(assignment))}
                    </tbody>
                  </table>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredAssignments.length)} of {filteredAssignments.length}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}


