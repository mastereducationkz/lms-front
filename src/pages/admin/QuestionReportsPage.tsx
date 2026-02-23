import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Edit3, 
  ChevronRight,
  Filter,
  RefreshCw,
  X,
  ExternalLink,
  Save,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import api from '../../services/api';
import { renderTextWithLatex } from '../../utils/latex';

interface QuestionReport {
  id: number;
  question_id: string | number;
  user_id: number;
  user_name: string;
  user_email: string;
  step_id: number;
  step_info: {
    id: number;
    title: string;
    content_type: string;
    step_number?: number;
  } | null;
  course_info: {
    id: number;
    title: string;
    lesson_id: number;
    lesson_title: string;
    module_title: string;
  } | null;
  message: string;
  suggested_answer: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: number | null;
  resolver_name: string | null;
  question_data: any | null;
}

interface ReportDetail {
  report: {
    id: number;
    question_id: string | number;
    message: string;
    suggested_answer: string | null;
    status: string;
    created_at: string;
    resolved_at: string | null;
  };
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
  resolver: {
    id: number;
    name: string;
  } | null;
  course_info: {
    course_id: number;
    course_title: string;
    module_id: number;
    module_title: string;
    lesson_id: number;
    lesson_title: string;
  } | null;
  step: {
    id: number;
    title: string;
    content_type: string;
    original_image_url: string | null;
    step_number?: number;
  } | null;
  quiz_settings: any;
  question_data: any | null;
  question_index: number;
  total_questions: number;
}

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' },
  reviewed: { label: 'Reviewed', icon: Eye, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30' },
  resolved: { label: 'Resolved', icon: CheckCircle, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' },
  dismissed: { label: 'Dismissed', icon: XCircle, color: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700' },
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default function QuestionReportsPage() {
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Edit form state
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editCorrectAnswer, setEditCorrectAnswer] = useState<any>('');
  const [editOptions, setEditOptions] = useState<any[]>([]);
  const [editExplanation, setEditExplanation] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await api.getQuestionErrorReports(statusFilter || undefined);
      setReports(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Handle initial load and URL parameter for direct report access
  useEffect(() => {
    const reportIdParam = searchParams.get('report');
    console.log('QuestionReportsPage: URL param report =', reportIdParam);
    
    const loadData = async () => {
      // Always fetch reports first
      console.log('QuestionReportsPage: Fetching reports...');
      await fetchReports();
      
      // Then open specific report if ID is provided
      if (reportIdParam) {
        const reportId = parseInt(reportIdParam, 10);
        console.log('QuestionReportsPage: Opening report ID', reportId);
        if (!isNaN(reportId)) {
          await openReportDetail(reportId);
        }
      }
    };
    
    loadData();
  }, [searchParams.get('report')]);

  useEffect(() => {
    // Refetch when filter changes
    fetchReports();
  }, [statusFilter]);

  const openReportDetail = async (reportId: number) => {
    setDetailLoading(true);
    try {
      const detail = await api.getQuestionErrorReportDetail(reportId);
      setSelectedReport(detail);
    } catch (error) {
      console.error('Failed to fetch report detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (reportId: number, newStatus: string) => {
    try {
      await api.updateQuestionErrorReportStatus(reportId, newStatus);
      fetchReports();
      if (selectedReport?.report.id === reportId) {
        setSelectedReport(prev => prev ? {
          ...prev,
          report: { ...prev.report, status: newStatus }
        } : null);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const openEditModal = () => {
    if (!selectedReport?.question_data) return;
    
    const q = selectedReport.question_data;
    setEditQuestionText(q.question_text || '');
    setEditCorrectAnswer(q.correct_answer || '');
    setEditOptions(q.options || []);
    setEditExplanation(q.explanation || '');
    setShowEditModal(true);
  };

  const saveQuestion = async () => {
    if (!selectedReport?.step?.id || !selectedReport?.question_data?.id) return;
    
    setSaving(true);
    try {
      await api.updateQuestion(
        selectedReport.step.id,
        selectedReport.question_data.id,
        {
          question_text: editQuestionText,
          correct_answer: editCorrectAnswer,
          options: editOptions,
          explanation: editExplanation,
        }
      );
      
      // Update status to resolved
      await updateStatus(selectedReport.report.id, 'resolved');
      
      setShowEditModal(false);
      // Refresh detail
      openReportDetail(selectedReport.report.id);
    } catch (error) {
      console.error('Failed to save question:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderQuestionPreview = (question: any, stepImageUrl?: string | null) => {
    if (!question) return <p className="text-gray-500">Question data not available</p>;

    return (
      <div className="space-y-4">
        {/* Step Image (SAT passage image) */}
        {stepImageUrl && (
          <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-secondary dark:border-border">
            <div className="p-2 bg-gray-100 border-b flex items-center gap-2 dark:bg-secondary dark:border-border">
              <ImageIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Passage Image</span>
            </div>
            <img 
              src={`${BACKEND_URL}${stepImageUrl}`} 
              alt="Passage" 
              className="w-full max-h-96 object-contain"
            />
          </div>
        )}

        {/* Question Image */}
        {question.image_url && (
          <div className="border rounded-lg overflow-hidden dark:border-border">
            <img 
              src={`${BACKEND_URL}${question.image_url}`} 
              alt="Question" 
              className="w-full max-h-64 object-contain"
            />
          </div>
        )}

        {/* Passage Text */}
        {question.passage && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h5 className="font-medium text-blue-800 mb-2">Passage</h5>
            <div className="text-sm text-blue-900 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: question.passage }}
            />
          </div>
        )}

        {/* Question Text */}
        <div className="p-4 bg-white border rounded-lg">
          <h5 className="font-medium text-gray-700 mb-2">Question</h5>
          <div 
            className="text-gray-900"
            dangerouslySetInnerHTML={{ __html: renderTextWithLatex(question.question_text || 'No question text') }}
          />
        </div>

        {/* Question Type */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Type:</span>
          <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
            {question.question_type || 'Unknown'}
          </span>
        </div>

        {/* Options */}
        {question.options && question.options.length > 0 && (
          <div className="space-y-2">
            <h5 className="font-medium text-gray-700">Options</h5>
            <div className="space-y-1">
              {question.options.map((opt: any, idx: number) => {
                const optText = typeof opt === 'string' ? opt : opt.text;
                const isCorrect = question.correct_answer === optText || 
                  question.correct_answer === idx ||
                  (Array.isArray(question.correct_answer) && question.correct_answer.includes(optText));
                
                return (
                  <div 
                    key={idx}
                    className={`p-2 rounded border ${
                      isCorrect 
                        ? 'bg-green-50 border-green-300 text-green-800' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                    <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex(optText) }} />
                    {isCorrect && <CheckCircle className="w-4 h-4 inline ml-2 text-green-600" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Correct Answer */}
        {question.correct_answer && !question.options?.length && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <h5 className="font-medium text-green-800 mb-1">Correct Answer</h5>
            <div className="text-green-900">
              {typeof question.correct_answer === 'object' 
                ? JSON.stringify(question.correct_answer) 
                : String(question.correct_answer)}
            </div>
          </div>
        )}

        {/* Explanation */}
        {question.explanation && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <h5 className="font-medium text-purple-800 mb-1">Explanation</h5>
            <div 
              className="text-purple-900 text-sm"
              dangerouslySetInnerHTML={{ __html: renderTextWithLatex(question.explanation) }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Question Error Reports</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Review and manage student-reported question errors</p>
        </div>
        <Button onClick={fetchReports} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = reports.filter(r => r.status === status).length;
          const Icon = config.icon;
          return (
            <Card 
              key={status} 
              className={`cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm dark:border-border dark:bg-card dark:text-foreground"
        >
          <option value="">All Reports</option>
          {Object.entries(statusConfig).map(([status, config]) => (
            <option key={status} value={status}>{config.label}</option>
          ))}
        </select>
        {statusFilter && (
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('')}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Reports List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Reports List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">No reports found</p>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => {
              const statusInfo = statusConfig[report.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = statusInfo.icon;
              
              return (
                <Card 
                  key={report.id}
                  className={`cursor-pointer hover:shadow-md transition-all ${
                    selectedReport?.report.id === report.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => openReportDetail(report.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3 inline mr-1" />
                          {statusInfo.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">#{report.id}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    
                    <p className="text-sm text-gray-900 dark:text-foreground line-clamp-2 mb-2">{report.message}</p>
                    
                    {report.suggested_answer && (
                      <p className="text-xs text-orange-600 mb-2">
                        💡 Suggested: {report.suggested_answer.substring(0, 50)}...
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{report.user_name}</span>
                      <span>{formatDate(report.created_at)}</span>
                    </div>
                    
                    {report.course_info && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        📚 {report.course_info.title} → {report.course_info.lesson_title}
                        {report.step_info?.step_number && ` (Step ${report.step_info.step_number})`}
                      </div>
                    )}
                    
                    {/* Action Links in List Item */}
                    {report.course_info && report.step_info?.step_number && (
                      <div className="flex gap-2 mt-2 pt-2 border-t dark:border-border">
                        <a 
                          href={`/teacher/course/${report.course_info.id}/lesson/${report.course_info.lesson_id}/edit?step=${report.step_info.step_number}&questionId=${report.question_id}`}
                          target="_blank"
                          rel="noopener noreferrer" 
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Edit3 className="w-3 h-3" /> Edit Step
                        </a>
                        <a 
                          href={`/course/${report.course_info.id}/lesson/${report.course_info.lesson_id}?step=${report.step_info.step_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" /> View Question
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Right: Report Detail */}
        <div className="lg:sticky lg:top-24 h-fit">
          {detailLoading ? (
            <Card>
              <CardContent className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </CardContent>
            </Card>
          ) : selectedReport ? (
            <Card className="overflow-hidden">
              <CardHeader className="sticky top-0 z-10 bg-gray-50 border-b dark:bg-secondary dark:border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Report Details</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setSelectedReport(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Status Actions */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <Button
                      key={status}
                      variant={selectedReport.report.status === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateStatus(selectedReport.report.id, status)}
                      className="gap-1"
                    >
                      <config.icon className="w-4 h-4" />
                      {config.label}
                    </Button>
                  ))}
                </div>

                {/* Report Info */}
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Reported Issue
                  </h4>
                  <p className="text-yellow-900">{selectedReport.report.message}</p>
                  
                  {selectedReport.report.suggested_answer && (
                    <div className="mt-3 p-2 bg-orange-100 rounded">
                      <p className="text-sm font-medium text-orange-800">Suggested Answer:</p>
                      <p className="text-orange-900">{selectedReport.report.suggested_answer}</p>
                    </div>
                  )}
                </div>

                {/* Reporter Info */}
                {selectedReport.user && (
                  <div className="text-sm">
                    <span className="text-gray-500">Reported by:</span>
                    <span className="ml-2 font-medium">{selectedReport.user.name}</span>
                    <span className="text-gray-400 ml-1">({selectedReport.user.email})</span>
                  </div>
                )}

                {/* Course Info */}
                {selectedReport.course_info && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <p className="font-medium text-blue-800">Location</p>
                    <p className="text-blue-900">
                      {selectedReport.course_info.course_title} → {selectedReport.course_info.module_title} → {selectedReport.course_info.lesson_title}
                    </p>
                    <p className="text-blue-600 mt-1">
                      Question {selectedReport.question_index + 1} of {selectedReport.total_questions}
                      {selectedReport.step?.step_number && ` (Step ${selectedReport.step.step_number})`}
                    </p>
                    
                    <div className="flex gap-3 mt-3">
                      {selectedReport.step?.step_number && (
                        <>
                          <a 
                            href={`/course/${selectedReport.course_info.course_id}/lesson/${selectedReport.course_info.lesson_id}?step=${selectedReport.step.step_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-green-600 hover:underline bg-white px-2 py-1 rounded border border-green-200"
                          >
                            <ExternalLink className="w-3 h-3" /> View Question
                          </a>
                          <a 
                            href={`/teacher/course/${selectedReport.course_info.course_id}/lesson/${selectedReport.course_info.lesson_id}/edit?step=${selectedReport.step.step_number}&questionId=${selectedReport.report.question_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline bg-white px-2 py-1 rounded border border-blue-200"
                          >
                            <Edit3 className="w-3 h-3" /> Edit Step
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Question Preview */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-700">Question Preview</h4>
                    {selectedReport.question_data && (
                      <Button 
                        size="sm" 
                        onClick={openEditModal}
                        className="gap-1"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Question
                      </Button>
                    )}
                  </div>
                  {renderQuestionPreview(
                    selectedReport.question_data, 
                    selectedReport.step?.original_image_url
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Eye className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Select a report to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Question Modal */}
      {showEditModal && selectedReport?.question_data && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998] bg-black/50"
            onClick={() => setShowEditModal(false)}
          />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white dark:bg-card rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="sticky top-0 bg-white dark:bg-card border-b dark:border-border p-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit Question</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowEditModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Question Text
                  </label>
                  <textarea
                    value={editQuestionText}
                    onChange={(e) => setEditQuestionText(e.target.value)}
                    className="w-full h-24 p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-secondary dark:border-border dark:text-foreground"
                  />
                </div>

                {/* Options (if applicable) */}
                {editOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Options
                    </label>
                    <div className="space-y-2">
                      {editOptions.map((opt, idx) => {
                        const optText = typeof opt === 'string' ? opt : opt.text;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="font-medium w-6">{String.fromCharCode(65 + idx)}.</span>
                            <input
                              type="text"
                              value={optText}
                              onChange={(e) => {
                                const newOptions = [...editOptions];
                                if (typeof newOptions[idx] === 'string') {
                                  newOptions[idx] = e.target.value;
                                } else {
                                  newOptions[idx] = { ...newOptions[idx], text: e.target.value };
                                }
                                setEditOptions(newOptions);
                              }}
                              className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-secondary dark:border-border dark:text-foreground"
                            />
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={editCorrectAnswer === optText || editCorrectAnswer === idx}
                              onChange={() => setEditCorrectAnswer(optText)}
                              className="w-4 h-4"
                              title="Set as correct answer"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select the radio button to mark as correct answer</p>
                  </div>
                )}

                {/* Correct Answer (for non-choice questions) */}
                {editOptions.length === 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Correct Answer
                    </label>
                    <input
                      type="text"
                      value={typeof editCorrectAnswer === 'string' ? editCorrectAnswer : JSON.stringify(editCorrectAnswer)}
                      onChange={(e) => setEditCorrectAnswer(e.target.value)}
                      className="w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-secondary dark:border-border dark:text-foreground"
                    />
                  </div>
                )}

                {/* Explanation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Explanation
                  </label>
                  <textarea
                    value={editExplanation}
                    onChange={(e) => setEditExplanation(e.target.value)}
                    placeholder="Add an explanation for why this is the correct answer..."
                    className="w-full h-20 p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-secondary dark:border-border dark:text-foreground"
                  />
                </div>

                {/* Student's Suggestion */}
                {selectedReport.report.suggested_answer && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-900/20 dark:border-orange-800">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">Student's Suggested Answer:</p>
                    <p className="text-orange-900 dark:text-orange-200">{selectedReport.report.suggested_answer}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-orange-600"
                      onClick={() => setEditCorrectAnswer(selectedReport.report.suggested_answer || '')}
                    >
                      Use this as correct answer
                    </Button>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-card border-t dark:border-border p-4 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button onClick={saveQuestion} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save & Resolve'}
                </Button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
