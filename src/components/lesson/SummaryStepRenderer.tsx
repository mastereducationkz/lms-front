import { useState, useEffect } from 'react';
import { Progress } from '../ui/progress';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import apiClient from '../../services/api';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/lessonPlayer';
import type { LessonQuizSummary } from '../../types';

interface SummaryStepRendererProps {
  lessonId: string;
  onLoad?: () => void;
}

const SummaryStepRenderer = ({ lessonId, onLoad }: SummaryStepRendererProps) => {
  const t = useT();
  const [summaryData, setSummaryData] = useState<LessonQuizSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getLessonQuizSummary(lessonId);
        setSummaryData(data);
        if (onLoad) {
          onLoad();
        }
      } catch (err) {
        console.error('Failed to load quiz summary:', err);
        setError(t('lessonPlayer.summary.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [lessonId, onLoad]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !summaryData) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground">{error || t('lessonPlayer.summary.empty')}</p>
      </div>
    );
  }

  const { quizzes, overall_stats } = summaryData;

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 70)
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-900 dark:hover:bg-emerald-900/40">{t('lessonPlayer.summary.great')}</Badge>;
    if (percentage >= 50)
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-900 dark:hover:bg-amber-900/40">{t('lessonPlayer.summary.good')}</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200 dark:border-red-900 dark:hover:bg-red-900/40">{t('lessonPlayer.summary.needsWork')}</Badge>;
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 70) return '[&>div]:bg-emerald-500';
    if (percentage >= 50) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-red-500';
  };

  const getFeedbackMessage = () => {
    const pct = overall_stats.average_percentage;
    const hasAttempts = quizzes.some(q => q.last_attempt);
    if (!hasAttempts) return null;

    if (pct >= 70)
      return t('lessonPlayer.summary.feedbackGreat', { percent: pct.toFixed(0) });
    if (pct >= 50)
      return t('lessonPlayer.summary.feedbackGood', { percent: pct.toFixed(0) });
    return t('lessonPlayer.summary.feedbackLow', { percent: pct.toFixed(0) });
  };

  const feedback = getFeedbackMessage();

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('lessonPlayer.summary.title')}</h2>
        <p className="text-muted-foreground mt-1">
          {t('lessonPlayer.summary.subtitle')}
        </p>
      </div>

      {/* Overall Performance */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{t('lessonPlayer.summary.overall')}</h3>
            {getStatusBadge(overall_stats.average_percentage)}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {overall_stats.average_percentage.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t('lessonPlayer.summary.average')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {overall_stats.total_correct}/{overall_stats.total_questions}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t('lessonPlayer.result.correct')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {quizzes.filter(q => q.last_attempt).length}/{quizzes.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t('lessonPlayer.summary.completed')}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('lessonPlayer.summary.progress')}</span>
              <span>{overall_stats.average_percentage.toFixed(0)}%</span>
            </div>
            <Progress
              value={overall_stats.average_percentage}
              className={`h-2.5 ${getProgressColor(overall_stats.average_percentage)}`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiz Results Table */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-foreground">{t('lessonPlayer.summary.results')}</h3>
          </div>

          {quizzes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">{t('lessonPlayer.summary.noQuizzes')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{t('lessonPlayer.summary.colQuiz')}</TableHead>
                  <TableHead className="text-center w-24">{t('lessonPlayer.summary.colScore')}</TableHead>
                  <TableHead className="text-center w-24">%</TableHead>
                  <TableHead className="text-right w-32 hidden sm:table-cell">{t('lessonPlayer.result.colDate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizzes
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((quiz, index) => {
                    const attempt = quiz.last_attempt;
                    return (
                      <TableRow key={quiz.step_id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-foreground">
                            {quiz.quiz_title || t('lessonPlayer.summary.quizNumber', { number: index + 1 })}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {attempt ? (
                            <span className="font-medium">
                              {attempt.score}/{attempt.total}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {attempt ? (
                            getStatusBadge(attempt.percentage)
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {t('lessonPlayer.summary.notAttempted')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {attempt ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDate(attempt.completed_at)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      {feedback && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground leading-relaxed">{feedback}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SummaryStepRenderer;
