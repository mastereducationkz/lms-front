import { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CheckCircle, Trash2 } from 'lucide-react';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherDesk';

export default function GradingQueue() {
  const t = useT();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);

  useEffect(() => {
    loadAttempts();
  }, []);

  const loadAttempts = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getUngradedQuizAttempts();
      setAttempts(data);
    } catch (error) {
      console.error('Failed to load grading queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeClick = (attempt: any) => {
    setSelectedAttempt(attempt);
    setGradeScore(0); // Default to 0
    setGradeFeedback('');
    setIsGradeModalOpen(true);
  };

  const handleSubmitGrade = async () => {
    if (!selectedAttempt) return;

    try {
      await apiClient.gradeQuizAttempt(selectedAttempt.id, {
        score_percentage: gradeScore,
        correct_answers: selectedAttempt.long_text_answers?.length || 1,
        feedback: gradeFeedback
      });
      setIsGradeModalOpen(false);
      loadAttempts(); // Reload list
    } catch (error) {
      console.error('Failed to submit grade:', error);
      alert(t('teacherDesk.queue.submitFailed'));
    }
  };

  const handleDeleteAttempt = async (attemptId: number) => {
    if (!confirm(t('teacherDesk.queue.deleteConfirm'))) return;
    
    try {
      await apiClient.deleteQuizAttempt(attemptId);
      loadAttempts();
    } catch (error) {
      console.error('Failed to delete attempt:', error);
      alert(t('teacherDesk.queue.deleteFailed'));
    }
  };
  
  const renderLongTextAnswers = (longTextAnswers: any[]) => {
      if (!longTextAnswers || longTextAnswers.length === 0) {
          return <p className="text-gray-500">{t('teacherDesk.queue.noLongText')}</p>;
      }
      
      return (
          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              {longTextAnswers.map((item: any, idx: number) => (
                  <div key={idx} className="border rounded-lg overflow-hidden">
                      {/* Question */}
                      <div className="p-4 bg-gray-100 border-b">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{t('teacherDesk.grading.questionNumber', { number: idx + 1 })}</p>
                          <p className="text-gray-900 font-medium">{item.question_text}</p>
                      </div>
                      {/* Student Answer */}
                      <div className="p-4 bg-white">
                          <p className="text-xs font-semibold text-blue-600 uppercase mb-1">{t('teacherDesk.queue.studentAnswer')}</p>
                          <div className="text-gray-800 whitespace-pre-wrap bg-blue-50 p-3 rounded border border-blue-100">
                            {item.student_answer || <span className="text-gray-400 italic">{t('teacherDesk.grading.noAnswer')}</span>}
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  if (loading) return <div>{t('teacherDesk.queue.loading')}</div>;

  if (attempts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <p>{t('teacherDesk.queue.empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('teacherDesk.queue.title', { count: attempts.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('teacherDesk.col.student')}</TableHead>
                <TableHead>{t('teacherDesk.queue.quiz')}</TableHead>
                <TableHead>{t('teacherDesk.col.submitted')}</TableHead>
                <TableHead>{t('teacherDesk.col.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell>
                    <div className="font-medium">{attempt.user_name}</div>
                    <div className="text-xs text-gray-500">{attempt.user_email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{attempt.quiz_title}</div>
                    <div className="text-xs text-gray-500">{attempt.course_title} - {attempt.lesson_title}</div>
                  </TableCell>
                  <TableCell>
                    {formatDate(new Date(attempt.created_at))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleGradeClick(attempt)}>
                        {t('teacherDesk.grading.grade')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => handleDeleteAttempt(attempt.id)}
                        title={t('teacherDesk.queue.allowResubmission')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isGradeModalOpen} onOpenChange={setIsGradeModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('teacherDesk.grading.gradeSubmission')}</DialogTitle>
          </DialogHeader>
          
          {selectedAttempt && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">{t('teacherDesk.grading.studentLabel')}</span> {selectedAttempt.user_name}
                </div>
                <div>
                  <span className="font-semibold">{t('teacherDesk.grading.quizLabel')}</span> {selectedAttempt.quiz_title}
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">{t('teacherDesk.queue.longTextQuestions')}</h3>
                {renderLongTextAnswers(selectedAttempt.long_text_answers)}
              </div>

              <div className="grid gap-4 border-t pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="score">{t('teacherDesk.grading.scoreRange')}</Label>
                  <Input
                    id="score"
                    type="number"
                    min="0"
                    max="100"
                    value={gradeScore}
                    onChange={(e) => setGradeScore(Number(e.target.value))}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="feedback">{t('teacherDesk.grading.feedback')}</Label>
                  <Textarea
                    id="feedback"
                    placeholder={t('teacherDesk.grading.feedbackPlaceholder')}
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGradeModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmitGrade}>{t('teacherDesk.grading.submitGrade')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
