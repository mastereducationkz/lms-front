import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.tsx';
import apiClient from '../../services/api';
import { toast } from '../../components/Toast.tsx';
import {
  FileText,
  Calendar,
  Clock,
  AlertCircle,
  Upload,
  Download,
  Award,
  ExternalLink,
  X
} from 'lucide-react';
import type { Assignment, AssignmentStatus, Submission } from '../../types/index.ts';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Textarea } from '../../components/ui/textarea.tsx';
import { Label } from '../../components/ui/label.tsx';
import MultiTaskSubmission from '../../components/assignments/MultiTaskSubmission.tsx';
import { compressImage } from '../../utils/imageCompression';

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [status, setStatus] = useState<AssignmentStatus | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [extension, setExtension] = useState<any>(null);
  
  // View mode: 'status' shows grading panel, 'details' shows actual submission
  const [viewMode, setViewMode] = useState<'status' | 'details'>('status');
  
  // State for legacy file upload and text submission
  const [text, setText] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [fieldAnswers, setFieldAnswers] = useState<Record<string, string>>({});


  const loadAssignment = async (assignmentId: string) => {
    try {
      const assignmentData = await apiClient.getAssignment(assignmentId);
      setAssignment(assignmentData);
      
      // Load extension if student
      if (user?.role === 'student') {
        const extensionData = await apiClient.getMyExtension(assignmentId);
        setExtension(extensionData);
      }
    } catch (err) {
      console.error('Failed to load assignment:', err);
      toast('Failed to load assignment', 'error');
      setError('Failed to load assignment.');
    }
  };

  const loadSubmission = async (assignmentId: string) => {
    try {
      const statusResult = await apiClient.getAssignmentStatusForStudent(assignmentId);
      setStatus(statusResult as AssignmentStatus);

      
      if (statusResult.submission_id) {
        try {
           console.log('Loading submission answers:', statusResult.answers);
           setSubmission({
             id: statusResult.submission_id,
             assignment_id: assignmentId,
             user_id: user?.id || '0',
             status: statusResult.status,
             score: statusResult.score || 0,
             submitted_at: statusResult.submitted_at || new Date().toISOString(),
             file_url: statusResult.file_url,
             submitted_file_name: statusResult.submitted_file_name,
             answers: statusResult.answers,
             is_graded: statusResult.status === 'graded',
             max_score: assignment?.max_score || 100,
             feedback: statusResult.feedback
           } as any);
           
           // Mark as seen if graded - this will update the sidebar badge
           if (statusResult.status === 'graded' && statusResult.submission_id) {
             apiClient.markSubmissionSeen(statusResult.submission_id);
           }
        } catch (e) {
          console.warn('Could not fetch full submission details', e);
        }
      } else {
        setSubmission(null);
      }
    } catch (err) {
      console.error('Failed to load submission status:', err);
    }
  };

  useEffect(() => {
    if (!id) return;
    loadAssignment(id);
    loadSubmission(id);
  }, [id]);


  const isOverdue = assignment?.due_date && new Date(assignment.due_date) < new Date();

  const getStatusBadgeVariant = () => {
    if (!status) return 'secondary';
    if (status.status === 'submitted') return 'default';
    if (status.status === 'graded') return 'outline';
    return 'secondary';
  };



  const handleSubmit = async () => {
    if (!id) return;
    
    // Validation
    if (assignment?.assignment_type === 'file_upload' && files.length === 0) return;
    if ((assignment?.assignment_type === 'free_text' || assignment?.assignment_type === 'essay') && !text) return;
    
    setSubmitting(true);
    try {
      const uploadedFiles = [];
      let fileUrl = null;
      let fileName = null;

      // Upload files if exist
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const fileToUpload = files[i];
            console.log(`🚀 Submitting file ${i+1}/${files.length}: ${fileToUpload.name}, Size: ${(fileToUpload.size / 1024 / 1024).toFixed(2)} MB`);
            const result = await apiClient.uploadSubmissionFile(id, fileToUpload);
            
            uploadedFiles.push({
                file_url: result.file_url,
                file_name: result.filename,
                file_size: fileToUpload.size
            });

            // Keep reference to at least one file for top-level columns (backward compatibility)
            // Using logic: use the updated file details from the LAST uploaded file
            fileUrl = result.file_url;
            fileName = result.filename;
        }
      }
      
      // Submit assignment
      await apiClient.submitAssignment(id, { 
        answers: { 
            text,
            files: uploadedFiles, // Store all files in answers JSON
            field_answers: fieldAnswers // Answer fields for auto-check
        },
        file_url: fileUrl, // Top-level legacy column
        submitted_file_name: fileName // Top-level legacy column
      });
      
      toast('Assignment submitted successfully!', 'success');
      
      // Reload submission to show updated status
      await loadSubmission(id);
    } catch (err) {
      console.error('Assignment submission error:', err);
      toast('Failed to submit assignment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsCompressing(true);
      const newFiles: File[] = [];
      
      try {
        for (let i = 0; i < e.target.files.length; i++) {
            const originalFile = e.target.files[i];
             // Check if it's an image
            if (originalFile.type.startsWith('image/')) {
                toast(`Compressing image ${i + 1}/${e.target.files.length}...`, 'info');
                const compressedFile = await compressImage(originalFile);
                newFiles.push(compressedFile);
            } else {
                newFiles.push(originalFile);
            }
        }
        
        setFiles(prev => [...prev, ...newFiles]);
      } finally {
        setIsCompressing(false);
        // Reset input value to allow selecting the same file again if needed
        e.target.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
        const updated = [...prev];
        updated.splice(index, 1);
        return updated;
    });
  };

  const handleMultiTaskSubmit = async (answers: any) => {
    if (!assignment) return;
    
    setSubmitting(true);
    setError('');

    try {
      await apiClient.submitAssignment(assignment.id, {
        answers: answers.tasks,
        file_url: null,
        submitted_file_name: null
      });
      
      toast('✅ Assignment submitted successfully!', 'success');
      
      // Reload submission to show updated status
      await loadSubmission(assignment.id.toString());
    } catch (err) {
      console.error('Failed to submit assignment:', err);
      toast('Failed to submit assignment', 'error');
      setError('Failed to submit assignment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    if (!assignment) return null;

    // If student has submitted, show status panel first
    if (submission && (submission.status === 'submitted' || submission.status === 'graded')) {
      if (viewMode === 'status') {
        // Calculate effective max score based on completed tasks
        // If student didn't complete bonus tasks, don't count them in max score
        let effectiveMaxScore = assignment.max_score;
        
        if (assignment.assignment_type === 'multi_task' && assignment.content?.tasks && submission.answers) {
          const tasks = assignment.content.tasks;
          let completedMaxScore = 0;
          
          tasks.forEach((task: any) => {
            const taskAnswer = submission.answers?.[task.id];
            const isTaskCompleted = taskAnswer?.completed || 
              (taskAnswer?.files?.length > 0) || 
              !!taskAnswer?.file_url || 
              !!taskAnswer?.text_response;
            
            if (task.is_optional) {
              // Only count bonus task points if completed
              if (isTaskCompleted) {
                completedMaxScore += task.points || 0;
              }
            } else {
              // Always count required task points
              completedMaxScore += task.points || 0;
            }
          });
          
          effectiveMaxScore = completedMaxScore;
        }
        
        return (
          <div className="space-y-6">
            {/* Grading Status Panel */}
            <Card className={submission.status === 'graded' ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/20' : 'border-border bg-secondary/50'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {submission.status === 'graded' ? (
                    <>
                      <Award className="w-5 h-5 text-green-600" />
                      <span className="text-green-800">Graded</span>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground">Submitted - Awaiting Grade</span>
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  Submitted on {new Date(submission.submitted_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Score Display */}
                <div className="flex items-center justify-between p-4 bg-white dark:bg-card rounded-lg border dark:border-border">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Your Score</div>
                    <div className="text-3xl font-bold">
                      {submission.status === 'graded' ? (
                        <span className={(submission.score || 0) >= (effectiveMaxScore * 0.6) ? 'text-green-600' : 'text-red-600'}>
                          {submission.score || 0}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                      <span className="text-lg text-gray-500 dark:text-gray-400 font-normal"> / {effectiveMaxScore}</span>
                    </div>
                  </div>
                  {submission.status === 'graded' && (
                    <div className="text-right">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Percentage</div>
                      <div className={`text-2xl font-bold ${(submission.score || 0) >= (effectiveMaxScore * 0.6) ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.round(((submission.score || 0) / effectiveMaxScore) * 100)}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Teacher Feedback */}
                <div className="p-4 bg-white dark:bg-card rounded-lg border dark:border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900 dark:text-foreground">Teacher Feedback</span>
                  </div>
                  {submission.feedback ? (
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{submission.feedback}</p>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">No feedback provided yet</p>
                  )}
                </div>

                {/* Action Button */}
                <Button 
                  onClick={() => setViewMode('details')} 
                  variant="outline" 
                  className="w-full"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View My Submission
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      }

      // viewMode === 'details' - Show actual submission
      // Prepare files list for display
      const submittedFiles = submission.answers?.files || (submission.file_url ? [{
          file_url: submission.file_url,
          submitted_file_name: submission.submitted_file_name
      }] : []);

      return (
        <div className="space-y-4">
          <Button 
            onClick={() => setViewMode('status')} 
            variant="ghost" 
            size="sm"
            className="mb-2"
          >
            ← Back to Results
          </Button>
          
          {assignment.assignment_type === 'multi_task' ? (
            <MultiTaskSubmission
              assignment={assignment}
              onSubmit={handleMultiTaskSubmit}
              initialAnswers={submission?.answers}
              readOnly={true}
              isSubmitting={submitting}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Your Submission</CardTitle>
              </CardHeader>
              <CardContent>
                {submittedFiles.length > 0 && (
                  <div className="space-y-3">
                     {submittedFiles.map((file: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                            <div className="flex items-center">
                            <FileText className="w-5 h-5 text-gray-500 mr-3" />
                            <span>{file.file_name || file.submitted_file_name || 'File'}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => window.open(file.file_url.startsWith('http') ? file.file_url : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + file.file_url, '_blank')}>
                                    <ExternalLink className="w-4 h-4 text-gray-500" />
                                </Button>
                                <a
                                href={file.file_url.startsWith('http') ? file.file_url : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground hover:underline flex items-center"
                                >
                                <Download className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                     ))}
                  </div>
                )}
                
                {/* Fallback for very old legacy or corrupted data if no files found but file_url exists */}
                {submittedFiles.length === 0 && submission.file_url && (
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-gray-500 mr-3" />
                      <span>{submission.submitted_file_name}</span>
                    </div>
                    <a
                      href={submission.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:underline"
                    >
                      Download
                    </a>
                  </div>
                )}

                {submission.answers?.text && (
                  <div className="p-4 bg-gray-50 rounded border whitespace-pre-wrap mt-4">
                    {submission.answers.text}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    // Not submitted yet - show submission form
    // Handle Multi-Task Assignments
    if (assignment.assignment_type === 'multi_task') {
      return (
        <MultiTaskSubmission
          assignment={assignment}
          onSubmit={handleMultiTaskSubmit}
          initialAnswers={submission?.answers}
          readOnly={false}
          isSubmitting={submitting}
        />
      );
    }

    // Handle File Upload Assignments (Legacy)
    if (assignment.assignment_type === 'file_upload') {
      return (
        <div className="space-y-6">
          <div className="prose dark:prose-invert max-w-none">
            <h3 className="text-lg font-medium mb-2">Instructions</h3>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {assignment.content?.question || assignment.description}
            </p>

            {assignment.content?.teacher_file_url && (
              <div className="mt-4 p-4 bg-secondary/50 dark:bg-secondary rounded-lg border border-border">
                <h4 className="text-sm font-medium text-foreground mb-2">Reference Material</h4>
                <a
                  href={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + assignment.content.teacher_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-foreground hover:underline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {assignment.content.teacher_file_name || 'Download File'}
                </a>
              </div>
            )}
          </div>

        {/* Removed the 'submitted' check block here since it is handled above in the first if-block of renderContent */}
        
            <Card>
              <CardHeader>
                <CardTitle>Your Submission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    accept={(() => {
                      const types = assignment.allowed_file_types || [];
                      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
                      const hasImages = types.some((t: string) => imageExts.includes(t.toLowerCase()));
                      const extensions = types.map((t: string) => `.${t}`).join(',');
                      return hasImages ? `image/*,${extensions}` : extensions;
                    })()}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center justify-center"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                    <span className="text-lg font-medium text-gray-900 mb-1">
                      {files.length > 0 ? 'Add more files' : 'Drop your files here or click to upload'}
                    </span>
                    <span className="text-sm text-gray-500">
                      Allowed types: {assignment.allowed_file_types?.join(', ') || 'All files'}
                    </span>
                    <span className="text-sm text-gray-500 mt-1">
                      Max size: {assignment.max_file_size_mb}MB
                    </span>
                  </label>
                </div>

                {files.length > 0 && (
                 <div className="space-y-2">
                    {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 dark:bg-secondary rounded border border-border">
                            <div className="flex items-center">
                            <FileText className="w-5 h-5 text-muted-foreground mr-3" />
                            <div>
                                <span className="font-medium text-foreground block">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                                </span>
                            </div>
                            </div>
                            <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="text-red-600 hover:text-red-800 h-8 w-8 p-0"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                  </div>
                )}

                {/* Answer Fields for Auto-Check */}
                {assignment.content?.answer_fields && assignment.content.answer_fields.length > 0 && (
                  <div className="pt-4 border-t space-y-4">
                    <div>
                      <Label className="text-sm font-semibold">Enter Your Answers</Label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Fill in your answers below. They will be auto-checked.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {assignment.content.answer_fields.map((field: any) => (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-sm">{field.label}</Label>
                          <input
                            type="text"
                            value={fieldAnswers[field.id] || ''}
                            onChange={(e) => setFieldAnswers(prev => ({
                              ...prev,
                              [field.id]: e.target.value
                            }))}
                            className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Enter your answer..."
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={files.length === 0 || submitting || isCompressing}
                  className="w-full"
                >
                  {isCompressing ? 'Compressing Images...' : (submitting ? 'Submitting...' : 'Submit Assignment')}
                </Button>
              </CardContent>
            </Card>
        </div>
      );
    }

    // Default for free_text, essay, etc.
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submit Your Work</CardTitle>
          <CardDescription>
            Type your answer below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="answer">Your Answer</Label>
              <Textarea
                id="answer"
                placeholder="Type your answer here..."
                className="min-h-[200px]"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !text}>
              {submitting ? 'Submitting...' : 'Submit Assignment'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };




  if (!assignment) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-gray-500 dark:text-gray-400 text-lg">Loading assignment...</div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header Card */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-800">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <CardTitle className="text-3xl font-bold text-gray-900">
                <div className="flex items-center justify-between w-full">
                  <span className="pr-3 truncate">{assignment.title}</span>
                  {submission && submission.status === 'graded' && (
                    <div className="flex items-center space-x-2 ">
                      <Award className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        Score: {submission.score}/{assignment.max_score}
                      </span>
                    </div>
                  )}
                </div>
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                {assignment.description}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end space-y-2">
              {status && (
                status.status.charAt(0) === 'not_started' ? (
                <Badge variant="outline" className="text-sm">
                  Not started
                </Badge>
                ) : (
                <Badge variant={getStatusBadgeVariant()} className="text-sm">
                  {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                </Badge>
                )
               
              )}
              {status?.late && (
                <Badge variant="destructive" className="text-sm">
                  Late Submission
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
            {assignment.due_date && (
              <div className={`flex items-center space-x-2 ${isOverdue && !extension ? 'text-red-600' : ''}`}>
                <Calendar className="w-4 h-4" />
                <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                {isOverdue && !extension && <AlertCircle className="w-4 h-4" />}
              </div>
            )}
            {extension && (
              <div className="flex items-center space-x-2 text-green-600">
                <Calendar className="w-4 h-4" />
                <span className="font-semibold">
                  Extended Deadline: {new Date(extension.extended_deadline).toLocaleDateString()} {new Date(extension.extended_deadline).toLocaleTimeString()}
                </span>
                {extension.reason && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">({extension.reason})</span>
                )}
              </div>
            )}
            {assignment.time_limit_minutes && (
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Time Limit: {assignment.time_limit_minutes} minutes</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <span>Created: {new Date(assignment.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Content & Submission */}
      {renderContent()}

      {/* Assignment File Card (Legacy - if not handled in renderContent) */}
      {assignment.file_url && assignment.assignment_type !== 'file_upload' && assignment.assignment_type !== 'multi_task' && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-secondary rounded-lg">
                  <Download className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-foreground">Assignment File</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Download the assignment file to get started</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href={apiClient.getFileUrl('assignments', assignment.file_url.split('/').pop() || '')}
                  download
                  target="_blank"
                  className="flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
