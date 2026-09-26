import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { toast } from '../../components/Toast';
import { ArrowLeft, FileText, Clock, Calendar, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import type { Assignment, Submission, AssignmentExtension } from '../../types/index';
import MultiTaskSubmission from '../../components/assignments/MultiTaskSubmission';
import { SubmissionFileDownloadLink } from '../../components/assignments/SubmissionFileDownloadLink';
import { AudioPlayer } from '../../components/AudioPlayer';
import { safeUploadUrl } from '../../lib/mediaUrl';

const AUDIO_FILE_EXTENSIONS = ['webm', 'ogg', 'mp4', 'm4a', 'mp3', 'mpeg', 'wav', 'x-m4a', 'aac'];

function isAudioSubmission(assignment: Assignment | null, submission: Submission | null | undefined): boolean {
  if (!submission?.file_url) return false;
  if (assignment?.assignment_type === 'audio') return true;
  const ext = submission.file_url.split('.').pop()?.toLowerCase().split('?')[0] || '';
  return AUDIO_FILE_EXTENSIONS.includes(ext);
}

// Recordings inside multi-task answers that MultiTaskSubmission itself won't play back —
// the sub-task was removed from (or changed type in) the assignment after the student
// submitted, so without this the grader has no way to hear them.
function unplayedTaskRecordings(assignment: Assignment | null, submission: Submission | null | undefined): string[] {
  const taskAnswers = submission?.answers?.tasks || {};
  if (typeof taskAnswers !== 'object') return [];
  const audioTaskIds = new Set(
    (assignment?.content?.tasks || [])
      .filter((task: any) => task?.task_type === 'audio_task')
      .map((task: any) => task.id)
  );
  return Object.entries(taskAnswers)
    .filter(([taskId, answer]: [string, any]) => answer?.audio_url && !audioTaskIds.has(taskId))
    .map(([, answer]: [string, any]) => answer.audio_url as string);
}

export default function AssignmentGradingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [extensions, setExtensions] = useState<AssignmentExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [isViewingPreviousAttempt, setIsViewingPreviousAttempt] = useState(false);
  const [expandedPreviousAttempts, setExpandedPreviousAttempts] = useState<Record<string, boolean>>({});
  const [gradingScore, setGradingScore] = useState<number | string>(''); // Allow empty string for better UX
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Extension management
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [extensionStudentId, setExtensionStudentId] = useState<number | null>(null);
  const [extensionDeadline, setExtensionDeadline] = useState<string>('');
  const [extensionReason, setExtensionReason] = useState<string>('');
  const [isResubmissionModalOpen, setIsResubmissionModalOpen] = useState(false);
  const [resubmissionSubmission, setResubmissionSubmission] = useState<Submission | null>(null);
  const [resubmissionMode, setResubmissionMode] = useState<'one_extra' | 'until_expiry'>('one_extra');
  const [resubmissionExpiry, setResubmissionExpiry] = useState('');

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      // These three requests are independent — fetch them in parallel instead of a serial
      // waterfall so total latency is the slowest one, not the sum of all three.
      const [assignmentData, submissionsData, extensionsData] = await Promise.all([
        apiClient.getAssignment(id!),
        apiClient.getAssignmentSubmissions(id!),
        apiClient.getAssignmentExtensions(id!),
      ]);
      setAssignment(assignmentData);
      setSubmissions(submissionsData);
      setExtensions(extensionsData);
    } catch (error) {
      toast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openExtensionModal = (submission: Submission) => {
    setExtensionStudentId(submission.user_id);
    
    // Check if student already has an extension
    const existing = extensions.find(ext => ext.student_id === submission.user_id);
    if (existing) {
      const deadlineDate = new Date(existing.extended_deadline);
      setExtensionDeadline(deadlineDate.toISOString().slice(0, 16));
      setExtensionReason(existing.reason || '');
    } else if (assignment?.due_date) {
      // Default to 7 days from original deadline
      const defaultDeadline = new Date(assignment.due_date);
      defaultDeadline.setDate(defaultDeadline.getDate() + 7);
      setExtensionDeadline(defaultDeadline.toISOString().slice(0, 16));
      setExtensionReason('');
    }
    setIsExtensionModalOpen(true);
  };

  const handleGrantExtension = async () => {
    if (!id || !extensionStudentId || !extensionDeadline) return;

    try {
      setIsSubmitting(true);
      await apiClient.grantExtension(id, extensionStudentId, extensionDeadline, extensionReason);
      toast('Extension granted successfully', 'success');
      setIsExtensionModalOpen(false);
      loadData(); // Reload to get updated extensions
    } catch (error) {
      toast('Failed to grant extension', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeExtension = async (studentId: number) => {
    if (!id) return;
    
    if (!confirm('Are you sure you want to revoke this extension?')) return;

    try {
      await apiClient.revokeExtension(id, studentId);
      toast('Extension revoked successfully', 'success');
      loadData(); // Reload to get updated extensions
    } catch (error) {
      toast('Failed to revoke extension', 'error');
    }
  };

  const openResubmissionModal = (submission: Submission) => {
    setResubmissionSubmission(submission);
    setResubmissionMode('one_extra');
    setResubmissionExpiry('');
    setIsResubmissionModalOpen(true);
  };

  const handleAllowResubmission = async () => {
    if (!resubmissionSubmission) return;
    if (resubmissionMode === 'until_expiry' && !resubmissionExpiry) {
      toast('Choose an expiry for repeated replacements', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      await apiClient.allowResubmission(resubmissionSubmission.id, {
        mode: resubmissionMode,
        ...(resubmissionMode === 'until_expiry' ? { expires_at: new Date(resubmissionExpiry).toISOString() } : {}),
      });
      toast(resubmissionMode === 'one_extra' ? 'One extra attempt allowed' : 'Repeated replacements allowed until the selected expiry', 'success');
      setIsResubmissionModalOpen(false);
    } catch (error) {
      toast('Failed to allow another attempt', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleGradeSubmission = async () => {
    if (!selectedSubmission || !id) return;
    
    // Validation: Score must be present
    if (gradingScore === '' || gradingScore === null || gradingScore === undefined) {
      toast('Please enter a grade score', 'error');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await apiClient.gradeSubmission(id, selectedSubmission.id.toString(), Number(gradingScore), gradingFeedback);
      toast('Submission graded successfully', 'success');
      setIsGradingModalOpen(false);
      await loadData();
    } catch (error) {
      toast('Failed to grade submission', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openGradingModal = (submission: Submission) => {
    if (!submission.is_current) {
      toast('Only the latest attempt can be graded.', 'error');
      return;
    }
    setSelectedSubmission(submission);
    setIsViewingPreviousAttempt(false);
    // Use nullish coalescing to strictly check for null/undefined, preserving 0 as a valid score
    // If score is null/undefined, set to '' (empty) so input is empty
    setGradingScore(submission.score ?? '');
    setGradingFeedback(submission.feedback || '');
    setIsGradingModalOpen(true);
  };

  const openAttemptPreview = (submission: Submission) => {
    setSelectedSubmission(submission);
    setIsViewingPreviousAttempt(true);
    setIsGradingModalOpen(true);
  };

  // One homework row per student, with their current attempt first and the older
  // attempts retained beneath it as reference-only history.
  const submissionGroups = Object.values(
    submissions.reduce<Record<string, Submission[]>>((groups, submission) => {
      const key = String(submission.user_id);
      (groups[key] ||= []).push(submission);
      return groups;
    }, {})
  ).map((studentSubmissions) => studentSubmissions.sort(
    (a, b) => (b.attempt_number || 1) - (a.attempt_number || 1)
  ));

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  // Computed once so the audio-submission branch below can both test it and render it
  // without calling safeUploadUrl twice.
  const gradingAudioUrl = isAudioSubmission(assignment, selectedSubmission)
    ? safeUploadUrl(selectedSubmission?.file_url)
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={() => navigate('/homework')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Grade Submissions</h1>
          <p className="text-muted-foreground">{assignment?.title}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission History ({submissionGroups.length} students)</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No submissions yet.
            </div>
          ) : (
            submissionGroups.map((studentSubmissions) => {
              const currentSubmission = studentSubmissions.find(submission => submission.is_current) || studentSubmissions[0];
              const studentExtension = extensions.find(ext => ext.student_id === parseInt(currentSubmission.user_id));
              const studentKey = String(currentSubmission.user_id);
              const previousAttempts = studentSubmissions.filter(submission => !submission.is_current);
              const visibleAttempts = expandedPreviousAttempts[studentKey]
                ? studentSubmissions
                : [currentSubmission];
              
              return (
              <div key={currentSubmission.user_id} className="border dark:border-border rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-lg text-foreground">{currentSubmission.user_name || `User ${currentSubmission.user_id}`}</div>
                    <div className="text-sm text-muted-foreground">{studentSubmissions.length} attempt{studentSubmissions.length === 1 ? '' : 's'}</div>
                    {studentExtension && <div className="text-sm text-green-600 dark:text-green-400 flex items-center mt-1"><Calendar className="w-3 h-3 mr-1" />Extended Deadline: {new Date(studentExtension.extended_deadline).toLocaleDateString()}{studentExtension.reason && ` - ${studentExtension.reason}`}</div>}
                  </div>
                </div>
                {visibleAttempts.map((submission) => (
                  <div key={submission.id} className="rounded-md border border-border p-3 flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2"><Badge variant={submission.is_current ? 'default' : 'secondary'}>Attempt {submission.attempt_number || 1}{submission.is_current ? ' · Current' : ' · Previous'}</Badge>{submission.is_graded ? <Badge variant={(submission.score || 0) >= (submission.max_score * 0.6) ? 'default' : 'destructive'}>{submission.is_grade_superseded ? 'Superseded score' : 'Score'}: {submission.score || 0}/{submission.max_score}</Badge> : <Badge variant="secondary">Pending Grading</Badge>}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center mt-2"><Clock className="w-3 h-3 mr-1" />Submitted: {new Date(submission.submitted_at).toLocaleString()}</div>
                      {submission.is_late && <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center mt-1 font-medium"><AlertCircle className="w-3 h-3 mr-1" />Late Submission</div>}
                    </div>
                    {submission.is_current ? <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => openExtensionModal(submission)}>{studentExtension ? 'Edit Extension' : 'Grant Extension'}</Button>{submission.is_graded && <Button variant="outline" size="sm" onClick={() => openResubmissionModal(submission)}><RotateCcw className="w-4 h-4 mr-1" />Allow another attempt</Button>}<Button onClick={() => openGradingModal(submission)}>{submission.is_graded ? 'Update Grade' : 'Grade'}</Button></div> : <Button variant="outline" onClick={() => openAttemptPreview(submission)}>View attempt</Button>}
                  </div>
                ))}
                {previousAttempts.length > 0 && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setExpandedPreviousAttempts((current) => ({
                      ...current,
                      [studentKey]: !current[studentKey],
                    }))}
                  >
                    {expandedPreviousAttempts[studentKey]
                      ? 'Hide previous attempts'
                      : `Show previous attempts (${previousAttempts.length})`}
                  </Button>
                )}
              </div>
            );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={isGradingModalOpen} onOpenChange={setIsGradingModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isViewingPreviousAttempt ? 'Previous Attempt' : 'Grade Submission'}</DialogTitle>
            <DialogDescription>
              {isViewingPreviousAttempt
                ? 'This earlier attempt is preserved for reference and cannot be graded.'
                : 'Review the student\'s work and provide a score and feedback.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 my-4">
            {/* Submission Content View */}
            <div className="rounded-lg border border-border bg-slate-50 dark:bg-secondary p-6 text-slate-900 dark:text-slate-100">
              <h3 className="mb-4 flex items-center font-semibold text-slate-900 dark:text-slate-100">
                <FileText className="mr-2 h-4 w-4" />
                Student's Work
              </h3>
              
              {assignment?.assignment_type === 'multi_task' && selectedSubmission ? (
                <div className="space-y-4">
                  <MultiTaskSubmission
                    assignment={assignment}
                    initialAnswers={selectedSubmission.answers}
                    readOnly={true}
                    onSubmit={() => {}}
                    studentId={String(selectedSubmission.user_id)}
                  />
                  {unplayedTaskRecordings(assignment, selectedSubmission).map((url, index) => {
                    const safeUrl = safeUploadUrl(url);
                    return (
                      <div key={index} className="space-y-2">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Recording from a removed task:
                        </div>
                        {safeUrl ? (
                          <AudioPlayer src={safeUrl} />
                        ) : (
                          <div className="text-sm italic text-muted-foreground">Recording unavailable.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : gradingAudioUrl ? (
                <div className="space-y-4">
                  <AudioPlayer src={gradingAudioUrl} />
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedSubmission?.file_url && (
                    <div className="flex items-center rounded border border-border bg-white p-3 dark:bg-card">
                      <FileText className="mr-3 h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{selectedSubmission.submitted_file_name || 'Attached File'}</div>
                      </div>
                      <SubmissionFileDownloadLink
                        fileUrl={selectedSubmission.file_url}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium flex items-center"
                      />
                    </div>
                  )}
                  
                  {selectedSubmission?.answers?.text && (
                    <div className="whitespace-pre-wrap rounded border border-border bg-white p-4 text-slate-900 dark:bg-card dark:text-slate-100">
                      {selectedSubmission.answers.text}
                    </div>
                  )}
                  
                  {!selectedSubmission?.file_url && !selectedSubmission?.answers?.text && (
                    <div className="italic text-muted-foreground">No content to display.</div>
                  )}
                </div>
              )}
            </div>

            {/* Grading Controls */}
            {!isViewingPreviousAttempt && <div className="grid grid-cols-1 gap-6 rounded-lg border border-border bg-card p-4 text-card-foreground md:grid-cols-2">
              {assignment?.late_penalty_enabled && selectedSubmission?.is_late && (
                <div className="md:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-200 flex items-start">
                   <AlertCircle className="w-5 h-5 mr-2 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                   <div>
                     <p className="font-semibold">Late Submission Penalty</p>
                     <p> This submission was late. A penalty multiplier of <strong>{assignment.late_penalty_multiplier}x</strong> is enabled for this assignment.</p>
                     <p className="mt-1 text-xs">If auto-graded, the penalty was already applied. For manual grading, please consider this penalty.</p>
                   </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="score">Score (Max: {assignment?.max_score})</Label>
                <Input
                  id="score"
                  type="number"
                  min="0"
                  max={assignment?.max_score || 100}
                  value={gradingScore}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setGradingScore('');
                    } else {
                      setGradingScore(Math.min(parseInt(val) || 0, assignment?.max_score || 100));
                    }
                  }}
                  placeholder="Enter score"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="feedback">Feedback</Label>
                <Textarea
                  id="feedback"
                  value={gradingFeedback}
                  onChange={(e) => setGradingFeedback(e.target.value)}
                  placeholder="Provide feedback to the student..."
                  className="min-h-[100px]"
                />
              </div>
            </div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGradingModalOpen(false)}>
              {isViewingPreviousAttempt ? 'Close' : 'Cancel'}
            </Button>
            {!isViewingPreviousAttempt && <Button onClick={handleGradeSubmission} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Grade'}
            </Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResubmissionModalOpen} onOpenChange={setIsResubmissionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allow another attempt</DialogTitle>
            <DialogDescription>
              The current grade will remain visible in history but will be superseded when the student submits a replacement. Its grade points will be reversed until the new attempt is graded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="flex gap-3 rounded-lg border border-border p-3 cursor-pointer">
              <input type="radio" checked={resubmissionMode === 'one_extra'} onChange={() => setResubmissionMode('one_extra')} />
              <span><span className="font-medium block">One extra attempt</span><span className="text-sm text-muted-foreground">Default. It works even after the deadline or attempt limit, then closes automatically.</span></span>
            </label>
            <label className="flex gap-3 rounded-lg border border-border p-3 cursor-pointer">
              <input type="radio" checked={resubmissionMode === 'until_expiry'} onChange={() => setResubmissionMode('until_expiry')} />
              <span><span className="font-medium block">Allow replacements until a chosen time</span><span className="text-sm text-muted-foreground">Overrides the normal attempt limit only through the expiry you set.</span></span>
            </label>
            {resubmissionMode === 'until_expiry' && <div className="space-y-2"><Label htmlFor="resubmission-expiry">Replacement window ends</Label><Input id="resubmission-expiry" type="datetime-local" value={resubmissionExpiry} onChange={(event) => setResubmissionExpiry(event.target.value)} min={new Date().toISOString().slice(0, 16)} /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResubmissionModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAllowResubmission} disabled={isSubmitting}>{isSubmitting ? 'Allowing...' : 'Allow attempt'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extension Management Modal */}
      <Dialog open={isExtensionModalOpen} onOpenChange={setIsExtensionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Deadline Extension</DialogTitle>
            <DialogDescription>
              Set a new deadline for this student to submit their work.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extension-deadline">Extended Deadline</Label>
              <Input
                id="extension-deadline"
                type="datetime-local"
                value={extensionDeadline}
                onChange={(e) => setExtensionDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extension-reason">Reason (Optional)</Label>
              <Textarea
                id="extension-reason"
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                placeholder="Reason for the extension..."
                className="min-h-[80px]"
              />
            </div>
            {extensionStudentId && extensions.find(ext => ext.student_id === extensionStudentId) && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/40 dark:border dark:border-yellow-800 rounded-lg">
                <span className="text-sm text-yellow-800 dark:text-yellow-200">This student already has an extension</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    handleRevokeExtension(extensionStudentId);
                    setIsExtensionModalOpen(false);
                  }}
                >
                  Revoke
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtensionModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGrantExtension} disabled={isSubmitting || !extensionDeadline}>
              {isSubmitting ? 'Saving...' : 'Grant Extension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
