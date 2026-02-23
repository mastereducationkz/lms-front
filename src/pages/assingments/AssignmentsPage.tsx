import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/api';
import { ClipboardList, Calendar, AlertCircle, ChevronDown, ChevronRight, Eye, Edit, Archive, ArchiveRestore, Copy } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Group } from '../../types';

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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
  };

  useEffect(() => {
    loadData();
  }, []);

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

  // Filter assignments by status, hidden, and group
  const filteredAssignments = assignments.filter(assignment => {
    // First filter by hidden status (for teachers/admins)
    if (!includeHidden && assignment.is_hidden) {
      return false;
    }
    
    // Filter by group if selected
    if (selectedGroupId !== 'all' && assignment.group_id?.toString() !== selectedGroupId) {
      return false;
    }
    
    // For students: hide graded assignments that are past deadline ONLY in "all" view
    if (user?.role === 'student' && filter === 'all') {
      const effectiveDeadline = assignment.extended_deadline || assignment.due_date;
      const isPastDeadline = effectiveDeadline && new Date(effectiveDeadline) < new Date();
      if (assignment.status === 'graded' && isPastDeadline) {
        return false;
      }
    }
    
    // Then filter by status
    switch (filter) {
      case 'pending':
        return assignment.status === 'not_submitted';
      case 'submitted':
        return assignment.status === 'submitted';
      case 'graded':
        return assignment.status === 'graded';
      case 'overdue':
        return assignment.status === 'overdue';
      default:
        return true;
    }
  });

  // Group assignments by group_name
  const groupedAssignments = filteredAssignments.reduce((acc, curr) => {
    const groupName = curr.group_name || groups.find(g => g.id === curr.group_id)?.name || `Group #${curr.group_id || 'Unknown'}`;
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(curr);
    return acc;
  }, {} as Record<string, AssignmentWithStatus[]>);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };



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
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="bg-white dark:bg-card rounded-xl shadow p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
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

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
          Homework
        </h1>
        {user?.role === 'teacher' || user?.role === 'admin' ? (
          <Button
            onClick={() => navigate('/homework/new')}
            variant="default"
            size="sm"
          >
            Create Homework
          </Button>
        ) : null}
      </div>

      {/* Filter Tabs & Group Filter */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-white dark:bg-card rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700 inline-flex">
          {[
            { key: 'all', label: 'All', count: assignments.length },
            { key: 'pending', label: 'Pending', count: assignments.filter(a => a.status === 'not_submitted').length },
            { key: 'submitted', label: 'Submitted', count: assignments.filter(a => a.status === 'submitted').length },
            { key: 'graded', label: 'Graded', count: assignments.filter(a => a.status === 'graded').length },
            { key: 'overdue', label: 'Overdue', count: assignments.filter(a => a.status === 'overdue').length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        
        {(user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'curator') && groups.length > 0 && (
          <div className="w-[200px]">
            <Select value={selectedGroupId} onValueChange={setGroupId}>
              <SelectTrigger className="bg-white dark:bg-card">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <div className="flex items-center gap-2 ml-auto">
            <Checkbox
              id="show-hidden"
              checked={includeHidden}
              onCheckedChange={(checked) => setIncludeHidden(checked === true)}
            />
            <label
              htmlFor="show-hidden"
              className="text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none"
            >
              Show archived
            </label>
          </div>
        )}
      </div>

      {/* Assignments List */}
      <div className="space-y-6">
        {filteredAssignments.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {filter === 'all' ? 'No homework yet' : `No ${filter} homework`}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {filter === 'all' 
                ? 'Homework will appear here when they are created by your teachers.'
                : `You don't have any ${filter} homework at the moment.`
              }
            </p>
          </div>
        ) : (
          Object.entries(groupedAssignments).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, groupAssignments]) => {
            const isExpanded = expandedGroups[groupName] !== false; // Default to expanded
            return (
              <div key={groupName} className="bg-white dark:bg-card rounded-lg border border-slate-200 dark:border-gray-700 overflow-hidden shadow-none">
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center justify-between px-6 py-3 bg-slate-50/50 dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 hover:bg-slate-100/50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{groupName}</h3>
                    <span className="text-[11px] font-medium text-slate-400 dark:text-gray-500">({groupAssignments.length})</span>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 dark:text-gray-500" /> : <ChevronRight className="w-4 h-4 text-slate-400 dark:text-gray-500" />}
                </button>

                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white dark:bg-card text-slate-500 dark:text-gray-400 border-b border-slate-100 dark:border-gray-700">
                        <tr>
                          <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Homework</th>
                          <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Due Date</th>
                          <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Status</th>
                          <th className="text-left px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Grade</th>
                          <th className="text-right px-6 py-3 font-semibold uppercase tracking-wider text-[10px]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                        {groupAssignments.map(assignment => (
                          <tr key={assignment.id} className="border-t hover:bg-gray-50/50 dark:hover:bg-gray-800">
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
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                              {assignment.extended_deadline ? (
                                <div className="flex items-center text-green-600 dark:text-green-400">
                                  <Calendar className="w-4 h-4 mr-1 text-green-400" />
                                  <span className="font-medium">
                                    {formatToKZTime(assignment.extended_deadline)}
                                  </span>
                                  <span className="ml-1 text-[9px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1 rounded border border-green-100 dark:border-green-800 font-bold uppercase tracking-tight">Ext</span>
                                </div>
                              ) : assignment.due_date ? (
                                <div className={`flex items-center ${isOverdue(assignment.due_date) && assignment.status === 'not_submitted' ? 'text-red-600 dark:text-red-400' : ''}`}>
                                  <Calendar className={`w-4 h-4 mr-1 ${isOverdue(assignment.due_date) && assignment.status === 'not_submitted' ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`} />
                                  <span className="font-medium">
                                    {formatToKZTime(assignment.due_date)}
                                  </span>
                                </div>
                              ) : assignment.event_start_datetime ? (
                                <div className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  <span className="font-medium ">
                                    {formatToKZTime(assignment.event_start_datetime)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {getStatusBadge(assignment)}
                            </td>
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
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {(user?.role === 'teacher' || user?.role === 'admin') ? (
                                  <>
                                    <Button
                                      onClick={() => navigate(`/homework/${assignment.id}/progress`)}
                                      variant="ghost"
                                      size="icon"
                                      title="View Progress"
                                      className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      onClick={() => navigate(`/homework/new?copyFrom=${assignment.id}`)}
                                      variant="ghost"
                                      size="icon"
                                      title="Copy Assignment"
                                      className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      onClick={() => navigate(`/homework/${assignment.id}/edit`)}
                                      variant="ghost"
                                      size="icon"
                                      title="Edit Assignment"
                                      className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                                    >
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


