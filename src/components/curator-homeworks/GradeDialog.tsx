import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { FileText, Download, Loader2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { StudentProgress, AssignmentData, SubmissionDetails } from './types';

interface GradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentProgress | null;
  assignment: AssignmentData | null;
  submissionDetails: SubmissionDetails | null;
  isLoadingSubmission: boolean;
  gradeValue: string;
  setGradeValue: (value: string) => void;
  feedbackValue: string;
  setFeedbackValue: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const GradeDialog: React.FC<GradeDialogProps> = ({
  open,
  onOpenChange,
  student,
  assignment,
  submissionDetails,
  isLoadingSubmission,
  gradeValue,
  setGradeValue,
  feedbackValue,
  setFeedbackValue,
  onSubmit,
  isLoading,
}) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  const renderSubmissionContent = () => {
    if (isLoadingSubmission) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading submission...</span>
        </div>
      );
    }

    if (!submissionDetails) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No submission content available
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* File attachment */}
        {submissionDetails.file_url && (
          <div className="flex items-center p-3 bg-white dark:bg-card rounded-lg border dark:border-border">
            <FileText className="w-5 h-5 text-blue-600 mr-3" />
            <div className="flex-1">
              <div className="font-medium">
                {submissionDetails.submitted_file_name || 'Attached File'}
              </div>
            </div>
            <a
              href={
                submissionDetails.file_url.startsWith('http')
                  ? submissionDetails.file_url
                  : `${backendUrl}${submissionDetails.file_url}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm font-medium flex items-center"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </a>
          </div>
        )}

        {/* Text answer */}
        {submissionDetails.answers?.text && (
          <div className="bg-white dark:bg-card p-4 rounded-lg border dark:border-border whitespace-pre-wrap">
            {submissionDetails.answers.text}
          </div>
        )}

        {/* Multi-task answers */}
        {submissionDetails.answers?.tasks && submissionDetails.answers.tasks.length > 0 && (
          <div className="space-y-3">
            {submissionDetails.answers.tasks.map((task: any, idx: number) => (
              <div key={idx} className="bg-white dark:bg-card p-4 rounded-lg border dark:border-border">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Task {idx + 1}
                </div>
                <div className="whitespace-pre-wrap">{task.answer || 'No answer provided'}</div>
              </div>
            ))}
          </div>
        )}

        {/* No content fallback */}
        {!submissionDetails.file_url &&
          !submissionDetails.answers?.text &&
          !submissionDetails.answers?.tasks && (
            <div className="text-center py-4 text-muted-foreground">
              No submission content available
            </div>
          )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grade Submission — {student?.student_name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 py-4">
          {/* Left side - Submission Content (3/5 width) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Student Info Header */}
            <div className="grid grid-cols-2 gap-3 bg-muted/50 p-3 rounded-lg text-sm">
              <div>
                <span className="text-muted-foreground">Student:</span>
                <p className="font-medium">{student?.student_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Submitted:</span>
                <p className="font-medium">{formatDate(student?.submitted_at || null)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Assignment:</span>
                <p className="font-medium">{assignment?.title}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className="mt-1">
                  {student && assignment && (
                    <StatusBadge
                      status={student.status}
                      score={student.score}
                      maxScore={assignment.max_score}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Submission Content */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
              <h3 className="font-semibold mb-3 flex items-center text-sm">
                <FileText className="w-4 h-4 mr-2" />
                Student's Work
              </h3>
              {renderSubmissionContent()}
            </div>
          </div>

          {/* Right side - Grading Controls (2/5 width) */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-card p-4 border border-border rounded-lg sticky top-4 space-y-4">
              <h3 className="font-semibold">Grading</h3>

              <div className="space-y-2">
                <Label htmlFor="gradeScore">
                  Score (Max: {assignment?.max_score || 100})
                </Label>
                <Input
                  id="gradeScore"
                  type="number"
                  min="0"
                  max={assignment?.max_score || 100}
                  value={gradeValue}
                  onChange={(e) => setGradeValue(e.target.value)}
                  placeholder="Enter score"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gradeFeedback">Feedback (optional)</Label>
                <Textarea
                  id="gradeFeedback"
                  value={feedbackValue}
                  onChange={(e) => setFeedbackValue(e.target.value)}
                  placeholder="Provide feedback to the student..."
                  className="min-h-[150px]"
                  rows={6}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Grade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
