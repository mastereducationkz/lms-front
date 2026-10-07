  import { useEffect, useState } from 'react';
  import { useParams, useNavigate } from 'react-router-dom';
  import { useAuth } from '../../contexts/AuthContext';
  import apiClient from '../../services/api';
  import { toast } from '../../components/Toast';
  import { 
    Clock, 
    CheckCircle, 
    AlertCircle, 
    FileText, 
    Calendar,
    ArrowLeft,
    Award,
    Pencil,
    Download,
    History
  } from 'lucide-react';
  import { Button } from '../../components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
  import { Badge } from '../../components/ui/badge';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
  import { Input } from '../../components/ui/input';
  import { Textarea } from '../../components/ui/textarea';
  import { Label } from '../../components/ui/label';
  import MultiTaskSubmission from '../../components/assignments/MultiTaskSubmission';
  import { AudioPlayer, isAudioUrl } from '../../components/AudioPlayer';
  import { safeUploadUrl } from '../../lib/mediaUrl';
  import { formatDate, formatDateTime } from '../../lib/i18n';
  import { useT } from '../../lib/i18n/react';
  import '@/lib/i18n/catalogs/homeworkStaff';
  import type { AssignmentExtension } from '../../types/index';

  // A submission file reference is untrusted (student-supplied); this resolves it to a
  // safe URL on the API host, or null when it isn't one (hostile scheme, foreign host,
  // corrupted legacy row). Callers must not render a link/src/fetch target on null.
  const buildFileUrl = (relativeUrl: string | null | undefined): string | null => safeUploadUrl(relativeUrl);

  interface StudentProgress {
    id: number;
    name: string;
    email: string;
    status: 'not_submitted' | 'submitted' | 'graded' | 'overdue';
    submission_id: number | null;
    score: number | null;
    max_score: number;
    submitted_at: string | null;
    graded_at: string | null;
    is_overdue: boolean;
    is_hidden?: boolean;
    assignment_source: 'course' | 'group' | 'both' | 'unknown';
    source_display: string;
    is_late?: boolean;
  }

  interface AssignmentData {
    id: number;
    title: string;
    description: string | null;
    due_date: string | null;
    max_score: number;
    lesson_id: number | null;
    group_id: number | null;
    assignment_type?: string;
    content?: any;
    late_penalty_enabled?: boolean;
    late_penalty_multiplier?: number;
  }

  interface SummaryStats {
    total_students: number;
    not_submitted: number;
    submitted: number;
    graded: number;
    overdue: number;
  }

  interface SourceBreakdown {
    course?: number;
    group?: number;
    both?: number;
    unknown?: number;
  }

  interface AssignmentStudentProgress {
    assignment: AssignmentData;
    students: StudentProgress[];
    summary: SummaryStats;
    source_breakdown: SourceBreakdown;
  }

  export default function AssignmentStudentProgressPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const t = useT();
    const [data, setData] = useState<AssignmentStudentProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [filter, setFilter] = useState<'all' | 'not_submitted' | 'submitted' | 'graded' | 'overdue'>('all');
    const [gradingDialog, setGradingDialog] = useState<{ open: boolean; submissionId: number | null }>({
      open: false,
      submissionId: null
    });
    const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
    const [scoreInput, setScoreInput] = useState<string>('');
    const [feedbackInput, setFeedbackInput] = useState<string>('');
    const [loadingSubmission, setLoadingSubmission] = useState<boolean>(false);
    const [savingGrade, setSavingGrade] = useState<boolean>(false);

    // Extension management
    const [extensions, setExtensions] = useState<AssignmentExtension[]>([]);
    const [extensionDialog, setExtensionDialog] = useState<{ open: boolean; studentId: number | null; studentName: string }>({
      open: false,
      studentId: null,
      studentName: ''
    });
    const [extensionDeadline, setExtensionDeadline] = useState<string>('');
    const [extensionReason, setExtensionReason] = useState<string>('');
    const [savingExtension, setSavingExtension] = useState<boolean>(false);

    useEffect(() => {
      if (id) {
        loadAssignmentProgress();
      }
    }, [id]);

    const loadAssignmentProgress = async () => {
      try {
        console.log('Loading assignment progress for ID:', id);
        setLoading(true);
        setError('');
        // Fetch the (fatal) progress roster and the (non-fatal) extensions in parallel instead
        // of sequentially; extensions failing must not fail the whole page, so it's caught inline.
        const [progressData, extensionsData] = await Promise.all([
          apiClient.getAssignmentStudentProgress(id!),
          apiClient.getAssignmentExtensions(id!).catch((err) => {
            console.warn('Failed to load extensions:', err);
            return null;
          }),
        ]);
        setData(progressData);
        if (extensionsData) setExtensions(extensionsData);
      } catch (err: any) {
        console.error('Failed to load assignment progress:', err);
        setError(err.message || t('homeworkStaff.progress.loadError'));
      } finally {
        setLoading(false);
      }
    };

    const openExtensionDialog = (studentId: number, studentName: string) => {
      const existing = extensions.find(ext => ext.student_id === studentId);
      if (existing) {
        const deadlineDate = new Date(existing.extended_deadline);
        setExtensionDeadline(deadlineDate.toISOString().slice(0, 16));
        setExtensionReason(existing.reason || '');
      } else if (data?.assignment.due_date) {
        const defaultDeadline = new Date(data.assignment.due_date);
        defaultDeadline.setDate(defaultDeadline.getDate() + 7);
        setExtensionDeadline(defaultDeadline.toISOString().slice(0, 16));
        setExtensionReason('');
      }
      setExtensionDialog({ open: true, studentId, studentName });
    };

    const handleGrantExtension = async () => {
      if (!id || !extensionDialog.studentId || !extensionDeadline) return;

      try {
        setSavingExtension(true);
        await apiClient.grantExtension(id, extensionDialog.studentId, extensionDeadline, extensionReason);
        toast(t('homeworkStaff.extension.granted'), 'success');
        setExtensionDialog({ open: false, studentId: null, studentName: '' });
        loadAssignmentProgress(); // Reload to get updated extensions
      } catch (error) {
        toast(t('homeworkStaff.extension.grantFailed'), 'error');
      } finally {
        setSavingExtension(false);
      }
    };

    const handleRevokeExtension = async (studentId: number) => {
      if (!id) return;
      
      if (!confirm(t('homeworkStaff.extension.revokeConfirm'))) return;

      try {
        await apiClient.revokeExtension(id, studentId);
        toast(t('homeworkStaff.extension.revoked'), 'success');
        setExtensionDialog({ open: false, studentId: null, studentName: '' });
        loadAssignmentProgress(); // Reload
      } catch (error) {
        toast(t('homeworkStaff.extension.revokeFailed'), 'error');
      }
    };

    const openGradeDialog = async (submissionId: number) => {
      try {
        setLoadingSubmission(true);
        setGradingDialog({ open: true, submissionId });
        // Fetch just this one submission instead of the whole group's list (which re-ran the
        // submissions N+1 on every grade-dialog open).
        const sub = await apiClient.getSubmission(id!, String(submissionId));
        if (!sub?.is_current) {
          toast(t('homeworkStaff.grade.onlyLatest'), 'error');
          setGradingDialog({ open: false, submissionId: null });
          return;
        }

        setSelectedSubmission(sub);
        setScoreInput(sub?.score != null ? String(sub.score) : '');
        setFeedbackInput(sub?.feedback || '');
      } catch (e) {
        console.error('Failed to load submission:', e);
      } finally {
        setLoadingSubmission(false);
      }
    };

    const submitGrade = async () => {
      if (!gradingDialog.submissionId) return;
      try {
        setSavingGrade(true);
        const parsedScore = Number(scoreInput);
        await apiClient.gradeSubmission(id!, String(gradingDialog.submissionId), parsedScore, feedbackInput);
        await loadAssignmentProgress();
        setGradingDialog({ open: false, submissionId: null });
        setSelectedSubmission(null);
      } catch (e: any) {
        console.error('Failed to save grade:', e);
        alert(e?.message || t('homeworkStaff.grade.saveFailed'));
      } finally {
        setSavingGrade(false);
      }
    };


    const downloadFile = async (fileUrl: string, fileName: string) => {
      const fullUrl = buildFileUrl(fileUrl);
      if (!fullUrl) {
        alert(t('homeworkStaff.progress.fileCannotOpen'));
        return;
      }
      try {
        const response = await fetch(fullUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Failed to download file:', error);
        alert(t('homeworkStaff.progress.downloadFailed'));
      }
    };

    const filteredStudents = data?.students.filter(student => {
      if (filter === 'all') return true;
      return student.status === filter;
    }) || [];

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'graded':
          return (
            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('homeworkStaff.status.graded')}
            </Badge>
          );
        case 'submitted':
          return (
            <Badge variant="default" className="bg-brand-subtle text-brand-subtle-foreground hover:bg-brand-subtle">
              <Clock className="w-3 h-3 mr-1" />
              {t('homeworkStaff.status.submitted')}
            </Badge>
          );
        case 'overdue':
          return (
            <Badge variant="destructive">
              <AlertCircle className="w-3 h-3 mr-1" />
              {t('homeworkStaff.status.overdue')}
            </Badge>
          );
        default:
          return (
            <Badge variant="secondary">
              <FileText className="w-3 h-3 mr-1" />
              {t('homeworkStaff.status.notSubmitted')}
            </Badge>
          );
      }
    };

    const isOverdue = (dueDate: string) => {
      return new Date(dueDate) < new Date();
    };

    // Removed unused handlers since actions use Link buttons now

    if (loading) {
      return (
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-secondary rounded w-48 mb-6"></div>
            <div className="bg-card rounded-xl shadow p-6">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 dark:bg-secondary rounded"></div>
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
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/homework')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('homeworkStaff.progress.backToHomework')}
            </Button>
            <h1 className="text-3xl font-bold text-foreground">{t('homeworkStaff.progress.title')}</h1>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <h3 className="font-semibold text-red-800 dark:text-red-400">{t('homeworkStaff.progress.error')}</h3>
              </div>
              <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
              <Button onClick={loadAssignmentProgress} className="mt-3">
                {t('common.retry')}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!data) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/homework')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('homeworkStaff.progress.backToHomework')}
            </Button>
            <h1 className="text-3xl font-bold text-foreground">{t('homeworkStaff.progress.title')}</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">{t('homeworkStaff.progress.noData')}</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/homework')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('homeworkStaff.progress.backToHomework')}
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{data.assignment.title}</h1>
            </div>
          </div>
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <div className="text-right">
              <Badge className="mb-1" variant="secondary">{t('homeworkStaff.progress.new')}</Badge>
              <Button onClick={() => navigate(`/homework/${id}/grade`)}>
                <History className="w-4 h-4 mr-2" />
                {t('homeworkStaff.progress.submissionHistory')}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">{t('homeworkStaff.progress.reviewEveryAttempt')}</p>
            </div>
          )}
        </div>

        {/* Assignment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t('homeworkStaff.progress.details')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('homeworkStaff.progress.dueDate')}</p>
                <p className="font-medium">
                  {data.assignment.due_date ? (
                    <span className={`flex items-center ${isOverdue(data.assignment.due_date) ? 'text-red-600 dark:text-red-400' : ''}`}>
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(new Date(data.assignment.due_date))}
                      {isOverdue(data.assignment.due_date) && <AlertCircle className="w-4 h-4 ml-1" />}
                    </span>
                  ) : (
                    t('homeworkStaff.progress.noDeadline')
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('homeworkStaff.progress.maxScore')}</p>
                <p className="font-medium">{t('homeworkStaff.progress.points', { count: data.assignment.max_score })}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('homeworkStaff.progress.totalStudents')}</p>
                <p className="font-medium">{t('homeworkStaff.progress.students', { count: data.summary.total_students })}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{t('homeworkStaff.progress.latePenalty')}</p>
                <p className="font-medium">
                  {data.assignment.late_penalty_enabled 
                    ? t('homeworkStaff.progress.multiplier', { multiplier: data.assignment.late_penalty_multiplier ?? '' }) 
                    : t('homeworkStaff.progress.disabled')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-muted-foreground mr-2" />
                <div>
                  <div className="text-sm text-muted-foreground">{t('homeworkStaff.status.notSubmitted')}</div>
                  <div className="text-xl font-bold">{data.summary.not_submitted}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="w-6 h-6 text-brand mr-2" />
                <div>
                  <div className="text-sm text-muted-foreground">{t('homeworkStaff.status.submitted')}</div>
                  <div className="text-xl font-bold">{data.summary.submitted}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
                <div>
                  <div className="text-sm text-muted-foreground">{t('homeworkStaff.status.graded')}</div>
                  <div className="text-xl font-bold">{data.summary.graded}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mr-2" />
                <div>
                  <div className="text-sm text-muted-foreground">{t('homeworkStaff.status.overdue')}</div>
                  <div className="text-xl font-bold">{data.summary.overdue}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assignment Source Breakdown */}
        {Object.keys(data.source_breakdown).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {t('homeworkStaff.progress.distribution')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-4 gap-4">
                {data.source_breakdown.course && (
                  <div className="flex items-center justify-between p-3 bg-brand-surface rounded-lg">
                    <div>
                      <div className="text-sm text-brand">{t('homeworkStaff.progress.courseStudents')}</div>
                      <div className="text-lg font-bold text-brand-subtle-foreground">{data.source_breakdown.course}</div>
                    </div>
                    <div className="w-8 h-8 bg-brand-subtle rounded-full flex items-center justify-center">
                      <span className="text-brand text-sm font-medium">{t('homeworkStaff.progress.courseShort')}</span>
                    </div>
                  </div>
                )}
                
                {data.source_breakdown.group && (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                    <div>
                      <div className="text-sm text-green-600 dark:text-green-400">{t('homeworkStaff.progress.groupStudents')}</div>
                      <div className="text-lg font-bold text-green-800 dark:text-green-400">{data.source_breakdown.group}</div>
                    </div>
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <span className="text-green-600 dark:text-green-400 text-sm font-medium">{t('homeworkStaff.progress.groupShort')}</span>
                    </div>
                  </div>
                )}
                
                {data.source_breakdown.both && (
                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                    <div>
                      <div className="text-sm text-purple-600 dark:text-purple-400">{t('homeworkStaff.progress.courseAndGroup')}</div>
                      <div className="text-lg font-bold text-purple-800 dark:text-purple-400">{data.source_breakdown.both}</div>
                    </div>
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 dark:text-purple-400 text-sm font-medium">{t('homeworkStaff.progress.bothShort')}</span>
                    </div>
                  </div>
                )}
                
                {data.source_breakdown.unknown && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">{t('homeworkStaff.progress.unknownSource')}</div>
                      <div className="text-lg font-bold text-foreground">{data.source_breakdown.unknown}</div>
                    </div>
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <span className="text-muted-foreground text-sm font-medium">?</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student Progress Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('homeworkStaff.progress.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">{t('homeworkStaff.progress.tabAll', { count: data.summary.total_students })}</TabsTrigger>
                <TabsTrigger value="not_submitted">{t('homeworkStaff.progress.tabNotSubmitted', { count: data.summary.not_submitted })}</TabsTrigger>
                <TabsTrigger value="submitted">{t('homeworkStaff.progress.tabSubmitted', { count: data.summary.submitted })}</TabsTrigger>
                <TabsTrigger value="graded">{t('homeworkStaff.progress.tabGraded', { count: data.summary.graded })}</TabsTrigger>
                <TabsTrigger value="overdue">{t('homeworkStaff.progress.tabOverdue', { count: data.summary.overdue })}</TabsTrigger>
              </TabsList>
              
              <TabsContent value={filter} className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('homeworkStaff.progress.student')}</TableHead>
                      <TableHead>{t('homeworkStaff.progress.status')}</TableHead>
                      <TableHead>{t('homeworkStaff.grade.score')}</TableHead>
                      <TableHead>{t('homeworkStaff.progress.submitted')}</TableHead>
                      <TableHead>{t('homeworkStaff.progress.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t('homeworkStaff.progress.noStudents')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => {
                        const studentExtension = extensions.find(ext => ext.student_id === student.id);
                        return (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{student.name}</div>
                              <div className="text-sm text-muted-foreground">{student.email}</div>
                              {studentExtension && (
                                <div className="text-sm text-green-600 dark:text-green-400 flex items-center mt-1">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {t('homeworkStaff.progress.extended', { date: formatDate(new Date(studentExtension.extended_deadline)) })}
                                  {studentExtension.reason && ` - ${studentExtension.reason}`}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(student.status)}
                          </TableCell>
                          <TableCell>
                            {student.score !== null ? (
                              <div className="flex items-center gap-2">
                                <Award className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="font-medium">
                                  {student.score}/{student.max_score}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.submitted_at ? (
                              <div className="flex flex-col">
                                <div className="flex items-center">
                                  <Clock className="w-4 h-4 mr-1 text-muted-foreground" />
                                  {formatDate(new Date(student.submitted_at))}
                                </div>
                                {student.is_late && (
                                  <Badge variant="outline" className="mt-1 w-fit border-amber-500 dark:border-amber-600 text-amber-600 dark:text-amber-400 px-1 py-0 text-[10px]">
                                    {t('homeworkStaff.progress.late')}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 dark:text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {(user?.role === 'teacher' || user?.role === 'admin') && (
                            <TableCell>
                              <div className="flex space-x-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title={studentExtension ? t('homeworkStaff.extension.editTitle') : t('homeworkStaff.extension.grantTitle')}
                                  aria-label={studentExtension ? t('homeworkStaff.extension.editTitle') : t('homeworkStaff.extension.grantTitle')}
                                  onClick={() => openExtensionDialog(student.id, student.name)}
                                >
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {studentExtension ? t('common.edit') : t('homeworkStaff.extension.extend')}
                                </Button>
                                {student.submission_id && (
                                  <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    title={t('homeworkStaff.progress.gradeCurrent')}
                                    aria-label={t('homeworkStaff.progress.gradeCurrent')}
                                    onClick={() => openGradeDialog(student.submission_id!)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </>
                                  
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Grading Dialog */}
        <Dialog open={gradingDialog.open} onOpenChange={(open) => { if (!open) { setGradingDialog({ open, submissionId: null }); setSelectedSubmission(null);} }}>
          <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{t('homeworkStaff.grade.dialogTitle')}</DialogTitle>
              <DialogDescription>{t('homeworkStaff.grade.onlyLatest')}</DialogDescription>
            </DialogHeader>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => navigate(`/homework/${id}/grade`)}>
              <History className="w-4 h-4 mr-2" />
              {t('homeworkStaff.progress.showPrevious')}
            </Button>
            <div className="p-2 h-full overflow-y-auto">
              {loadingSubmission ? (
                <div className="text-sm text-muted-foreground">{t('homeworkStaff.progress.loadingSubmission')}</div>
              ) : selectedSubmission ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  {/* Left side - Student info and submission details */}
                  <div className="space-y-4 h-full overflow-auto">
                    {/* Multi-Task Submission View */}
                    {data?.assignment.assignment_type === 'multi_task' && (
                      <div className="mb-6">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('homeworkStaff.grade.studentWork')}</h3>
                        <div className="border rounded-lg p-4 bg-card dark:border-border">
                          <MultiTaskSubmission 
                            assignment={data.assignment}
                            initialAnswers={selectedSubmission.answers}
                            readOnly={true}
                            onSubmit={() => {}}
                            studentId={String(selectedSubmission.user_id)}
                          />
                        </div>
                      </div>
                    )}

                    {/* File Upload View (Legacy or mixed) */}
                    {(selectedSubmission.file_url || (selectedSubmission.answers?.files && selectedSubmission.answers.files.length > 0)) && (
                      <div className="space-y-4">
                        <div className="text-sm font-medium text-muted-foreground">{t('homeworkStaff.progress.submittedFiles')}</div>
                        
                        {/* Multiple Files List */}
                        {selectedSubmission.answers?.files && selectedSubmission.answers.files.length > 0 ? (
                            <div className="space-y-3">
                                {selectedSubmission.answers.files.map((file: any, index: number) => {
                                  const fileHref = buildFileUrl(file.file_url);
                                  return (
                                    <div key={index} className="bg-muted p-3 rounded border dark:border-border">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-medium">
                                                {file.file_name || file.submitted_file_name || t('homeworkStaff.progress.fileNumber', { number: index + 1 })}
                                            </div>
                                            {fileHref && (
                                              <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => downloadFile(file.file_url, file.file_name || file.submitted_file_name || 'submission_file')}
                                              >
                                                  <Download className="w-4 h-4 mr-2" />
                                                  {t('homeworkStaff.files.download')}
                                              </Button>
                                            )}
                                        </div>

                                        {/* Preview Logic for each file — nothing renders when the stored
                                            reference isn't a safe upload URL (fileHref is null); the file
                                            name above is the only thing shown for it. */}
                                        {!fileHref ? null : file.file_name?.toLowerCase().endsWith('.pdf') ? (
                                             <div className="mt-2 text-xs text-brand">
                                                <a href={fileHref} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                    {t('homeworkStaff.progress.openPdf')}
                                                </a>
                                             </div>
                                        ) : /\.(jpg|jpeg|png|gif|webp)$/i.test(file.file_name || '') ? (
                                            <div className="mt-2 border rounded overflow-hidden max-h-[200px]">
                                                <img
                                                    src={fileHref}
                                                    alt={file.file_name}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        ) : isAudioUrl(file.file_url || file.file_name || file.submitted_file_name) ? (
                                            <AudioPlayer src={fileHref} className="mt-2" />
                                        ) : (
                                            <div className="mt-2">
                                                <a
                                                    href={fileHref}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-brand hover:text-brand-subtle-foreground text-sm underline"
                                                >
                                                    {t('homeworkStaff.progress.openFile')}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                  );
                                })}
                            </div>
                        ) : selectedSubmission.file_url ? (() => {
                            /* Legacy Single File Fallback */
                            const legacyHref = buildFileUrl(selectedSubmission.file_url);
                            return (
            <div className="bg-muted p-3 rounded border dark:border-border">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm">
                    {selectedSubmission.submitted_file_name || t('homeworkStaff.progress.downloadFileFallback')}
                                    </div>
                                    {legacyHref && (
                                    <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadFile(selectedSubmission.file_url, selectedSubmission.submitted_file_name || 'submission_file')}
                                    >
                                    <Download className="w-4 h-4 mr-2" />
                                    {t('homeworkStaff.files.download')}
                                    </Button>
                                    )}
                                </div>

                                {/* Nothing below renders when legacyHref is null (the stored value isn't
                                    a safe upload URL) — the file name above is all that's shown. */}
                                {legacyHref && (
                                <>
                                {/* PDF Viewer */}
                                {selectedSubmission.submitted_file_name?.toLowerCase().endsWith('.pdf') && (
                                    <div className="mt-3">
                                    <div className="text-xs text-muted-foreground mb-2">{t('homeworkStaff.progress.pdfPreview')}</div>
                                    <div className="border rounded overflow-hidden h-[60vh]">
                                        <iframe
                                        src={`${legacyHref}#toolbar=0&navpanes=0&scrollbar=0`}
                                        width="100%"
                                        height="100%"
                                        style={{ border: 'none' }}
                                        title={t('homeworkStaff.progress.pdfPreviewTitle')}
                                        />
                                    </div>
                                    </div>
                                )}

                                {/* Audio player for audio submissions */}
                                {isAudioUrl(selectedSubmission.file_url || selectedSubmission.submitted_file_name) && (
                                    <AudioPlayer src={legacyHref} className="mt-2" />
                                )}

                                {/* For non-PDF, non-audio files, show a link */}
                                {!selectedSubmission.submitted_file_name?.toLowerCase().endsWith('.pdf') &&
                                 !isAudioUrl(selectedSubmission.file_url || selectedSubmission.submitted_file_name) && (
                                    <div className="mt-2">
                                    <a
                                        href={legacyHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-brand hover:text-brand-subtle-foreground text-sm underline"
                                    >
                                        {t('homeworkStaff.progress.openFile')}
                                    </a>
                                    </div>
                                )}
                                </>
                                )}
                            </div>
                            );
                        })() : null}
                      </div>
                    )}
                  </div>

                  {/* Right side - Grading form */}
                  <div className="space-y-4 h-full overflow-auto p-4">
                  <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">{t('homeworkStaff.progress.studentInfo')}</div>
                      <div className="bg-muted p-3 rounded border dark:border-border">
                        <div className="font-medium">{selectedSubmission.user_name || t('homeworkStaff.progress.studentFallback', { id: selectedSubmission.user_id })}</div>
                        {selectedSubmission.submitted_at && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {t('homeworkStaff.grade.submittedAt', { date: formatDateTime(new Date(selectedSubmission.submitted_at)) })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Auto-Check Results */}
                      {selectedSubmission.answers?.auto_check_result && (
                        <div className="p-4 bg-brand-surface rounded-lg border border-brand-border">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-brand-surface-foreground">{t('homeworkStaff.progress.autoCheck')}</span>
                            <Badge variant="outline" className={
                              selectedSubmission.answers.auto_check_result.correct_count === selectedSubmission.answers.auto_check_result.total_count
                                ? 'border-green-500 text-green-700 dark:text-green-400'
                                : 'border-amber-500 text-amber-700 dark:text-amber-400'
                            }>
                              {t('homeworkStaff.progress.correctCount', { correct: selectedSubmission.answers.auto_check_result.correct_count, total: selectedSubmission.answers.auto_check_result.total_count })}
                            </Badge>
                          </div>
                          
                          {/* Per-field breakdown */}
                          {data?.assignment.content?.answer_fields && (
                            <div className="space-y-2">
                              {data.assignment.content.answer_fields.map((field: any) => {
                                const isCorrect = selectedSubmission.answers.auto_check_result.details?.[field.id];
                                const studentAnswer = selectedSubmission.answers.field_answers?.[field.id] || t('homeworkStaff.progress.noAnswer');
                                return (
                                  <div 
                                    key={field.id} 
                                    className={`flex items-center justify-between p-2 rounded text-sm ${
                                      isCorrect 
                                        ? 'bg-green-100 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                                        : 'bg-red-100 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                    }`}
                                  >
                                    <div className="flex-1">
                                      <span className="font-medium">{field.label}:</span>
                                      <span className="ml-2 font-mono">{studentAnswer}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {!isCorrect && (
                                        <span className="text-xs text-muted-foreground">
                                          ({t('homeworkStaff.progress.correctLabel')} <span className="font-mono">{field.correct_answer}</span>)
                                        </span>
                                      )}
                                      {isCorrect 
                                        ? <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" /> 
                                        : <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                      }
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="text-sm text-muted-foreground">{t('homeworkStaff.grade.score')}</label>
                        <Input
                          type="number"
                          min={0}
                          max={data?.assignment.max_score || 100}
                          value={scoreInput}
                          onChange={(e) => setScoreInput(e.target.value)}
                          className="mt-1"
                        />
                        <div className="text-xs text-muted-foreground mt-1">{t('homeworkStaff.progress.maxScoreLine', { max: data?.assignment.max_score ?? '' })}</div>
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground">{t('homeworkStaff.grade.feedback')}</label>
                        <Textarea
                          rows={6}
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder={t('homeworkStaff.progress.feedbackPlaceholder')}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setGradingDialog({ open: false, submissionId: null })}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button 
                        onClick={submitGrade} 
                        disabled={savingGrade || !scoreInput}
                      >
                        {savingGrade ? t('homeworkStaff.grade.saving') : t('homeworkStaff.grade.save')}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{t('homeworkStaff.progress.selectSubmission')}</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Extension Dialog */}
        <Dialog open={extensionDialog.open} onOpenChange={(open) => setExtensionDialog({ ...extensionDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('homeworkStaff.extension.dialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('homeworkStaff.extension.dialogHintNamed', { name: extensionDialog.studentName })}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="extension-deadline">{t('homeworkStaff.extension.deadline')}</Label>
                <Input
                  id="extension-deadline"
                  type="datetime-local"
                  value={extensionDeadline}
                  onChange={(e) => setExtensionDeadline(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extension-reason">{t('homeworkStaff.extension.reason')}</Label>
                <Textarea
                  id="extension-reason"
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder={t('homeworkStaff.extension.reasonPlaceholder')}
                  className="min-h-[80px]"
                />
              </div>
              {extensionDialog.studentId && extensions.find(ext => ext.student_id === extensionDialog.studentId) && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <span className="text-sm text-yellow-800 dark:text-yellow-400">{t('homeworkStaff.extension.alreadyHas')}</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeExtension(extensionDialog.studentId!)}
                  >
                    {t('homeworkStaff.extension.revoke')}
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setExtensionDialog({ open: false, studentId: null, studentName: '' })}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleGrantExtension} disabled={savingExtension || !extensionDeadline}>
                {savingExtension ? t('homeworkStaff.grade.saving') : t('homeworkStaff.extension.grant')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
