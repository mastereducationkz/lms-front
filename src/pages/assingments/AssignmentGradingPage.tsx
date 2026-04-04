import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { toast } from '../../components/Toast';
import { ArrowLeft, Download, FileText, Clock, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import type { Assignment, Submission, AssignmentExtension } from '../../types/index';
import MultiTaskSubmission from '../../components/assignments/MultiTaskSubmission';

export default function AssignmentGradingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [extensions, setExtensions] = useState<AssignmentExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [gradingScore, setGradingScore] = useState<number | string>(''); // Allow empty string for better UX
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Extension management
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [extensionStudentId, setExtensionStudentId] = useState<number | null>(null);
  const [extensionDeadline, setExtensionDeadline] = useState<string>('');
  const [extensionReason, setExtensionReason] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const assignmentData = await apiClient.getAssignment(id!);
      setAssignment(assignmentData);
      const submissionsData = await apiClient.getAssignmentSubmissions(id!);
      setSubmissions(submissionsData);
      const extensionsData = await apiClient.getAssignmentExtensions(id!);
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
    setSelectedSubmission(submission);
    // Use nullish coalescing to strictly check for null/undefined, preserving 0 as a valid score
    // If score is null/undefined, set to '' (empty) so input is empty
    setGradingScore(submission.score ?? '');
    setGradingFeedback(submission.feedback || '');
    setIsGradingModalOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={() => navigate('/homework')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Grade Submissions</h1>
          <p className="text-muted-foreground">{assignment?.title}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Submissions ({submissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No submissions yet.
            </div>
          ) : (
            submissions.map((submission) => {
              const studentExtension = extensions.find(ext => ext.student_id === parseInt(submission.user_id));
              
              return (
              <div key={submission.id} className="border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-lg">{submission.user_name || `User ${submission.user_id}`}</div>
                    <div className="text-sm text-gray-600 flex items-center mt-1">
                      <Clock className="w-3 h-3 mr-1" />
                      Submitted: {new Date(submission.submitted_at).toLocaleString()}
                    </div>
                    {studentExtension && (
                      <div className="text-sm text-green-600 flex items-center mt-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        Extended Deadline: {new Date(studentExtension.extended_deadline).toLocaleDateString()}
                        {studentExtension.reason && ` - ${studentExtension.reason}`}
                      </div>
                    )}
                    {submission.is_late && (
                      <div className="text-sm text-amber-600 flex items-center mt-1 font-medium">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Late Submission
                        {assignment?.late_penalty_enabled && (
                          <span className="ml-1 text-xs text-amber-500">
                            (Penalty Applied: {assignment.late_penalty_multiplier}x)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    {submission.is_graded ? (
                      <Badge variant={(submission.score || 0) >= (submission.max_score * 0.6) ? "default" : "destructive"}>
                        Score: {submission.score || 0}/{submission.max_score}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending Grading</Badge>
                    )}
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => openExtensionModal(submission)}
                    >
                      {studentExtension ? 'Edit Extension' : 'Grant Extension'}
                    </Button>
                    <Button onClick={() => openGradingModal(submission)}>
                      {submission.is_graded ? 'Update Grade' : 'Grade'}
                    </Button>
                  </div>
                </div>
              </div>
            );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={isGradingModalOpen} onOpenChange={setIsGradingModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              Review the student's work and provide a score and feedback.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 my-4">
            {/* Submission Content View */}
            <div className="rounded-lg border border-border bg-slate-50 p-6 text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
              <h3 className="mb-4 flex items-center font-semibold text-slate-900 dark:text-zinc-100">
                <FileText className="mr-2 h-4 w-4" />
                Student's Work
              </h3>
              
              {assignment?.assignment_type === 'multi_task' && selectedSubmission ? (
                <MultiTaskSubmission 
                  assignment={assignment} 
                  initialAnswers={selectedSubmission.answers} 
                  readOnly={true}
                  onSubmit={() => {}}
                  studentId={String(selectedSubmission.user_id)}
                />
              ) : (
                <div className="space-y-4">
                  {selectedSubmission?.file_url && (
                    <div className="flex items-center rounded border border-border bg-white p-3 dark:bg-zinc-950">
                      <FileText className="mr-3 h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-zinc-100">{selectedSubmission.submitted_file_name || 'Attached File'}</div>
                      </div>
                      <a 
                        href={selectedSubmission.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm font-medium flex items-center"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </a>
                    </div>
                  )}
                  
                  {selectedSubmission?.answers?.text && (
                    <div className="whitespace-pre-wrap rounded border border-border bg-white p-4 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
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
            <div className="grid grid-cols-1 gap-6 rounded-lg border border-border bg-card p-4 text-card-foreground md:grid-cols-2">
              {assignment?.late_penalty_enabled && selectedSubmission?.is_late && (
                <div className="md:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 flex items-start">
                   <AlertCircle className="w-5 h-5 mr-2 text-amber-600 flex-shrink-0" />
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGradingModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGradeSubmission} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Grade'}
            </Button>
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
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span className="text-sm text-yellow-800">This student already has an extension</span>
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
