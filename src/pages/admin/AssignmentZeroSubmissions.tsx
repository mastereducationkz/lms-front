import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import apiClient from '../../services/api';
import { safeUploadUrl } from '../../lib/mediaUrl';
import { DATE, TIME, formatDate as formatAppDate, formatDateTime as formatAppDateTime } from '../../lib/i18n';
import { CollegeBoardPasswordReveal } from '../../components/CollegeBoardPasswordReveal';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/adminUsers';
import { Search, Download, Eye, Filter, BookOpen, Headphones, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface AssignmentZeroSubmission {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone_number: string;
  parent_phone_number: string;
  telegram_id: string;
  college_board_email: string;
  // No plaintext here (G9 a′): only whether one is stored, and whether this
  // viewer may reveal it. Reveal it via apiClient.revealCollegeBoardPassword(user_id).
  has_college_board_password?: boolean;
  can_reveal_college_board_password?: boolean;
  birthday_date: string;
  city: string;
  school_type: string;
  group_name: string;
  sat_target_date: string;
  sat_planned_test_date?: string | null;
  sat_result_score?: string | null;
  sat_result_test_date?: string | null;
  has_passed_sat_before: boolean;
  previous_sat_score: string | null;
  recent_practice_test_score: string;
  bluebook_practice_test_5_score: string;
  screenshot_url: string | null;
  // Grammar Assessment
  grammar_punctuation: number | null;
  grammar_noun_clauses: number | null;
  grammar_relative_clauses: number | null;
  grammar_verb_forms: number | null;
  grammar_comparisons: number | null;
  grammar_transitions: number | null;
  grammar_synthesis: number | null;
  // Reading Skills
  reading_word_in_context: number | null;
  reading_text_structure: number | null;
  reading_cross_text: number | null;
  reading_central_ideas: number | null;
  reading_inferences: number | null;
  // Passages
  passages_literary: number | null;
  passages_social_science: number | null;
  passages_humanities: number | null;
  passages_science: number | null;
  passages_poetry: number | null;
  // Math Topics
  math_topics: string[];
  // IELTS Fields
  ielts_target_date: string | null;
  ielts_planned_test_date?: string | null;
  ielts_last_date_prompted_at?: string | null;
  ielts_result_score?: string | null;
  ielts_result_test_date?: string | null;
  has_passed_ielts_before: boolean;
  previous_ielts_score: string | null;
  ielts_target_score: string | null;
  // IELTS Listening
  ielts_listening_main_idea: number | null;
  ielts_listening_details: number | null;
  ielts_listening_opinion: number | null;
  ielts_listening_accents: number | null;
  // IELTS Reading
  ielts_reading_skimming: number | null;
  ielts_reading_scanning: number | null;
  ielts_reading_vocabulary: number | null;
  ielts_reading_inference: number | null;
  ielts_reading_matching: number | null;
  // IELTS Writing
  ielts_writing_task1_graphs: number | null;
  ielts_writing_task1_process: number | null;
  ielts_writing_task2_structure: number | null;
  ielts_writing_task2_arguments: number | null;
  ielts_writing_grammar: number | null;
  ielts_writing_vocabulary: number | null;
  // IELTS Speaking
  ielts_speaking_fluency: number | null;
  ielts_speaking_vocabulary: number | null;
  ielts_speaking_grammar: number | null;
  ielts_speaking_pronunciation: number | null;
  ielts_speaking_part2: number | null;
  ielts_speaking_part3: number | null;
  // IELTS Weak Topics
  ielts_weak_topics: string[];
  additional_comments: string | null;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

const AssignmentZeroSubmissions = () => {
  const t = useT();
  const [submissions, setSubmissions] = useState<AssignmentZeroSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<AssignmentZeroSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentZeroSubmission | null>(null);
  const [filterDraft, setFilterDraft] = useState<'all' | 'draft' | 'submitted'>('submitted');
  const [filterTrack, setFilterTrack] = useState<'all' | 'sat' | 'ielts'>('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [searchQuery, submissions, filterDraft, filterTrack, filterGroup]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDraft, filterTrack, filterGroup]);

  const uniqueGroups = useMemo(() => {
    const groups = Array.from(new Set(submissions.map((s) => s.group_name).filter(Boolean)));
    return groups.sort((a, b) => a.localeCompare(b));
  }, [submissions]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const batchSize = 200;
      let skip = 0;
      let hasMore = true;
      let allRows: AssignmentZeroSubmission[] = [];

      while (hasMore) {
        const batch = await apiClient.getAllAssignmentZeroSubmissions({
          skip,
          limit: batchSize,
        });
        allRows = [...allRows, ...batch];
        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          skip += batchSize;
        }
      }

      setSubmissions(allRows);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSubmissions = () => {
    let filtered = submissions;

    // Filter by draft status
    if (filterDraft === 'draft') {
      filtered = filtered.filter((s) => s.is_draft);
    } else if (filterDraft === 'submitted') {
      filtered = filtered.filter((s) => !s.is_draft);
    }

    if (filterTrack === 'sat') {
      filtered = filtered.filter((s) => hasSATData(s));
    } else if (filterTrack === 'ielts') {
      filtered = filtered.filter((s) => hasIELTSData(s));
    }

    if (filterGroup !== 'all') {
      filtered = filtered.filter((s) => s.group_name === filterGroup);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.full_name.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.group_name.toLowerCase().includes(query) ||
          s.city.toLowerCase().includes(query)
      );
    }

    setFilteredSubmissions(filtered);
  };

  // Determine if submission has SAT data
  const hasSATData = (submission: AssignmentZeroSubmission) => {
    return submission.sat_target_date || 
           submission.grammar_punctuation !== null ||
           submission.reading_word_in_context !== null ||
           submission.math_topics?.length > 0;
  };

  // Determine if submission has IELTS data
  const hasIELTSData = (submission: AssignmentZeroSubmission) => {
    return submission.ielts_target_date ||
           submission.ielts_listening_main_idea !== null ||
           submission.ielts_reading_skimming !== null ||
           submission.ielts_weak_topics?.length > 0;
  };

  // Calculate SAT average score
  const calculateSATAverageScore = (submission: AssignmentZeroSubmission) => {
    const scores = [
      submission.grammar_punctuation,
      submission.grammar_noun_clauses,
      submission.grammar_relative_clauses,
      submission.grammar_verb_forms,
      submission.grammar_comparisons,
      submission.grammar_transitions,
      submission.grammar_synthesis,
      submission.reading_word_in_context,
      submission.reading_text_structure,
      submission.reading_cross_text,
      submission.reading_central_ideas,
      submission.reading_inferences,
      submission.passages_literary,
      submission.passages_social_science,
      submission.passages_humanities,
      submission.passages_science,
      submission.passages_poetry,
    ].filter((score) => score !== null) as number[];

    if (scores.length === 0) return null;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  // Calculate IELTS average score
  const calculateIELTSAverageScore = (submission: AssignmentZeroSubmission) => {
    const scores = [
      submission.ielts_listening_main_idea,
      submission.ielts_listening_details,
      submission.ielts_listening_opinion,
      submission.ielts_listening_accents,
      submission.ielts_reading_skimming,
      submission.ielts_reading_scanning,
      submission.ielts_reading_vocabulary,
      submission.ielts_reading_inference,
      submission.ielts_reading_matching,
      submission.ielts_writing_task1_graphs,
      submission.ielts_writing_task1_process,
      submission.ielts_writing_task2_structure,
      submission.ielts_writing_task2_arguments,
      submission.ielts_writing_grammar,
      submission.ielts_writing_vocabulary,
      submission.ielts_speaking_fluency,
      submission.ielts_speaking_vocabulary,
      submission.ielts_speaking_grammar,
      submission.ielts_speaking_pronunciation,
      submission.ielts_speaking_part2,
      submission.ielts_speaking_part3,
    ].filter((score) => score !== null) as number[];

    if (scores.length === 0) return null;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  const exportToCSV = () => {
    const headers = [
      'Full Name',
      'Email',
      'Phone',
      'Parent Phone',
      'Telegram',
      'College Board Email',
      'Birthday',
      'City',
      'School Type',
      'Group Name',
      'SAT Target Date',
      'Has Passed SAT',
      'Previous SAT Score',
      'Recent Practice Test',
      'Bluebook Test 5',
      'Grammar Avg',
      'Reading Avg',
      'Passages Avg',
      'Math Topics Count',
      'Status',
      'Submitted At',
    ];

    const rows = filteredSubmissions.map((s) => {
      const grammarScores = [
        s.grammar_punctuation,
        s.grammar_noun_clauses,
        s.grammar_relative_clauses,
        s.grammar_verb_forms,
        s.grammar_comparisons,
        s.grammar_transitions,
        s.grammar_synthesis,
      ].filter((x) => x !== null) as number[];
      const grammarAvg = grammarScores.length
        ? (grammarScores.reduce((a, b) => a + b, 0) / grammarScores.length).toFixed(1)
        : 'N/A';

      const readingScores = [
        s.reading_word_in_context,
        s.reading_text_structure,
        s.reading_cross_text,
        s.reading_central_ideas,
        s.reading_inferences,
      ].filter((x) => x !== null) as number[];
      const readingAvg = readingScores.length
        ? (readingScores.reduce((a, b) => a + b, 0) / readingScores.length).toFixed(1)
        : 'N/A';

      const passagesScores = [
        s.passages_literary,
        s.passages_social_science,
        s.passages_humanities,
        s.passages_science,
        s.passages_poetry,
      ].filter((x) => x !== null) as number[];
      const passagesAvg = passagesScores.length
        ? (passagesScores.reduce((a, b) => a + b, 0) / passagesScores.length).toFixed(1)
        : 'N/A';

      return [
        s.full_name,
        s.email,
        s.phone_number,
        s.parent_phone_number,
        s.telegram_id,
        s.college_board_email,
        s.birthday_date,
        s.city,
        s.school_type,
        s.group_name,
        s.sat_target_date,
        s.has_passed_sat_before ? 'Yes' : 'No',
        s.previous_sat_score || 'N/A',
        s.recent_practice_test_score,
        s.bluebook_practice_test_5_score,
        grammarAvg,
        readingAvg,
        passagesAvg,
        s.math_topics.length,
        s.is_draft ? 'Draft' : 'Submitted',
        formatAppDateTime(s.updated_at, { ...DATE, ...TIME }),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `assignment_zero_submissions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / pageSize));
  const paginatedSubmissions = filteredSubmissions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const formatDateTime = (value?: string | null) => {
    if (!value) return t('adminUsers.zero.na');
    return formatAppDateTime(value, { ...DATE, ...TIME });
  };

  const SAT_MONTH_TEMPLATE_DAY: Record<number, number> = {
    3: 14,
    5: 2,
    6: 6,
    8: 23,
    9: 13,
    10: 4,
    11: 8,
    12: 6,
  };

  const MONTH_NAME_TO_INDEX: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    sept: 9,
    october: 10,
    november: 11,
    december: 12,
  };

  const resolveLegacySatMonthDate = (rawValue: string) => {
    const normalized = rawValue.trim().toLowerCase().replace('.', '');
    const month = MONTH_NAME_TO_INDEX[normalized];
    if (!month) return null;

    const templateDay = SAT_MONTH_TEMPLATE_DAY[month] ?? 1;
    const today = new Date();
    const currentYear = today.getFullYear();
    const thisYearDate = new Date(currentYear, month - 1, templateDay);
    const nextYearDate = new Date(currentYear + 1, month - 1, templateDay);

    return thisYearDate >= today ? thisYearDate : nextYearDate;
  };

  const parseDateValue = (value?: string | null) => {
    if (!value) return null;
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDatePattern.test(value)) {
      const isoDate = new Date(`${value}T00:00:00`);
      return Number.isNaN(isoDate.getTime()) ? null : isoDate;
    }

    const legacySatDate = resolveLegacySatMonthDate(value);
    if (legacySatDate) return legacySatDate;

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  const getCollectionAskDate = (plannedDate?: string | null) => {
    const parsedDate = parseDateValue(plannedDate);
    if (!parsedDate) return null;
    const askDate = new Date(parsedDate);
    askDate.setDate(askDate.getDate() + 13);
    return askDate;
  };

  const formatDateOnly = (value?: string | null) => {
    const parsedDate = parseDateValue(value);
    return parsedDate ? formatAppDate(parsedDate) : t('adminUsers.zero.na');
  };

  const getNextIeltsPromptAt = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    date.setDate(date.getDate() + 14);
    return date.toISOString();
  };

  const getResultCollectionStatus = (
    askDate: Date | null,
    resultScore?: string | null,
    resultDate?: string | null
  ) => {
    if (resultScore || resultDate) {
      return t('adminUsers.zero.resultReceived');
    }
    if (!askDate) {
      return t('adminUsers.zero.noPlannedDate');
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const normalizedAskDate = new Date(askDate);
    normalizedAskDate.setHours(0, 0, 0, 0);
    if (now > normalizedAskDate) {
      return t('adminUsers.zero.overdue');
    }
    return t('adminUsers.zero.pending');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t('adminUsers.zero.title')}</h1>
        <p className="text-muted-foreground">{t('adminUsers.zero.subtitle')}</p>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col xl:flex-row gap-3">
              <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder={t('adminUsers.zero.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label={t('adminUsers.zero.clearSearch')}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
              <Button onClick={exportToCSV} variant="outline" className="shrink-0">
                <Download className="w-4 h-4 mr-2" />
                {t('adminUsers.zero.exportCsv')}
              </Button>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterDraft === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterDraft('all')}
                  size="sm"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {t('adminUsers.zero.filterAll', { count: submissions.length })}
                </Button>
                <Button
                  variant={filterDraft === 'submitted' ? 'default' : 'outline'}
                  onClick={() => setFilterDraft('submitted')}
                  size="sm"
                >
                  {t('adminUsers.zero.filterSubmitted', { count: submissions.filter((s) => !s.is_draft).length })}
                </Button>
                <Button
                  variant={filterDraft === 'draft' ? 'default' : 'outline'}
                  onClick={() => setFilterDraft('draft')}
                  size="sm"
                >
                  {t('adminUsers.zero.filterDrafts', { count: submissions.filter((s) => s.is_draft).length })}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 lg:ml-auto">
                <Button variant={filterTrack === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterTrack('all')}>
                  {t('adminUsers.zero.trackAll')}
                </Button>
                <Button variant={filterTrack === 'sat' ? 'default' : 'outline'} size="sm" onClick={() => setFilterTrack('sat')}>
                  SAT
                </Button>
                <Button variant={filterTrack === 'ielts' ? 'default' : 'outline'} size="sm" onClick={() => setFilterTrack('ielts')}>
                  IELTS
                </Button>
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">{t('adminUsers.zero.allGroups')}</option>
                  {uniqueGroups.map((groupName) => (
                    <option key={groupName} value={groupName}>
                      {groupName}
                    </option>
                  ))}
                </select>
                {(searchQuery || filterTrack !== 'all' || filterGroup !== 'all' || filterDraft !== 'submitted') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterTrack('all');
                      setFilterGroup('all');
                      setFilterDraft('submitted');
                    }}
                  >
                    {t('adminUsers.zero.reset')}
                  </Button>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {t('adminUsers.zero.found', { count: filteredSubmissions.length })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('adminUsers.zero.submissions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border dark:border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('adminUsers.zero.colStudent')}</TableHead>
                  <TableHead className="min-w-[9rem]">{t('adminUsers.zero.colGroup')}</TableHead>
                  <TableHead>{t('adminUsers.zero.colStatus')}</TableHead>
                  <TableHead>{t('adminUsers.zero.colTrack')}</TableHead>
                  <TableHead>{t('adminUsers.zero.colSatTarget')}</TableHead>
                  <TableHead>{t('adminUsers.zero.colIeltsTarget')}</TableHead>
                  <TableHead>{t('adminUsers.zero.colUpdated')}</TableHead>
                  <TableHead className="text-right">{t('adminUsers.zero.colAction')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubmissions.length > 0 ? (
                  paginatedSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="font-medium">{submission.full_name}</div>
                        <div className="text-xs text-muted-foreground">{submission.email}</div>
                      </TableCell>
                      <TableCell>{submission.group_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={submission.is_draft ? 'secondary' : 'default'}>
                          {submission.is_draft ? t('adminUsers.zero.draft') : t('adminUsers.zero.submitted')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {hasSATData(submission) && (
                            <Badge variant="outline" className="bg-brand-surface text-brand-subtle-foreground border-brand-border">
                              <BookOpen className="w-3 h-3 mr-1" />
                              SAT {calculateSATAverageScore(submission) ? `(${calculateSATAverageScore(submission)}/5)` : ''}
                            </Badge>
                          )}
                          {hasIELTSData(submission) && (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                              <Headphones className="w-3 h-3 mr-1" />
                              IELTS {calculateIELTSAverageScore(submission) ? `(${calculateIELTSAverageScore(submission)}/5)` : ''}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{submission.sat_target_date || '-'}</TableCell>
                      <TableCell>{submission.ielts_target_date || '-'}</TableCell>
                      <TableCell>{formatAppDate(submission.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedSubmission(submission)}>
                          <Eye className="w-4 h-4 mr-2" />
                          {t('adminUsers.zero.view')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {t('adminUsers.zero.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paging */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('adminUsers.zero.showing', {
                from: filteredSubmissions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1,
                to: Math.min(currentPage * pageSize, filteredSubmissions.length),
                total: filteredSubmissions.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {t('adminUsers.list.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('adminUsers.zero.page', { page: currentPage, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                {t('adminUsers.list.next')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed View Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader className="sticky top-0 bg-card dark:bg-card z-10 border-b dark:border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>{t('adminUsers.zero.detailTitle', { name: selectedSubmission.full_name })}</CardTitle>
                  {hasSATData(selectedSubmission) && (
                    <Badge className="bg-brand-subtle text-brand-subtle-foreground">
                      <BookOpen className="w-3 h-3 mr-1" />
                      SAT
                    </Badge>
                  )}
                  {hasIELTSData(selectedSubmission) && (
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      <Headphones className="w-3 h-3 mr-1" />
                      IELTS
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(null)} aria-label={t('common.close')}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Personal Information */}
                <div className="bg-muted dark:bg-secondary rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    {t('adminUsers.zero.personalInfo')}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.fullName')}</span>
                      <p className="font-medium">{selectedSubmission.full_name}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.email')}</span>
                      <p className="font-medium">{selectedSubmission.email}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.phone')}</span>
                      <p className="font-medium">{selectedSubmission.phone_number}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.parentPhone')}</span>
                      <p className="font-medium">{selectedSubmission.parent_phone_number}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">Telegram</span>
                      <p className="font-medium">{selectedSubmission.telegram_id}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.birthday')}</span>
                      <p className="font-medium">{selectedSubmission.birthday_date}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.city')}</span>
                      <p className="font-medium">{selectedSubmission.city}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.schoolType')}</span>
                      <p className="font-medium">{selectedSubmission.school_type}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.group')}</span>
                      <p className="font-medium">{selectedSubmission.group_name}</p>
                    </div>
                  </div>
                </div>

                {/* Account Information */}
                <div className="bg-muted dark:bg-secondary rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    {t('adminUsers.zero.accountInfo')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.collegeBoardEmail')}</span>
                      <p className="font-medium">{selectedSubmission.college_board_email || t('adminUsers.zero.na')}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.collegeBoardPassword')}</span>
                      <p className="font-medium">
                        {/* This grid pairs Email/Password as fixed sibling cells, so the
                            label stays even when the value is empty (stored but
                            unrevealable for this viewer) — unlike StudentProfilePage's
                            dynamic row list, dropping just this cell would look broken. */}
                        <CollegeBoardPasswordReveal
                          userId={selectedSubmission.user_id}
                          hasPassword={!!selectedSubmission.has_college_board_password}
                          canReveal={selectedSubmission.can_reveal_college_board_password}
                          // Only admins reach this page; treat a missing flag
                          // (older backend) as "yes, may reveal".
                          defaultCanReveal
                        />
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reminder Tracking */}
                <div className="bg-muted dark:bg-secondary rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">{t('adminUsers.zero.reminders')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.lastPrompted')}</span>
                      <p className="font-medium">{formatDateTime(selectedSubmission.ielts_last_date_prompted_at)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.nextPrompt')}</span>
                      <p className="font-medium">{formatDateTime(getNextIeltsPromptAt(selectedSubmission.ielts_last_date_prompted_at))}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.satAskResult')}</span>
                      <p className="font-medium">
                        {(() => {
                          const satPlannedDate = selectedSubmission.sat_planned_test_date || selectedSubmission.sat_target_date || null;
                          const satAskDate = getCollectionAskDate(satPlannedDate);
                          return satAskDate ? formatAppDate(satAskDate) : t('adminUsers.zero.na');
                        })()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const satPlannedDate = selectedSubmission.sat_planned_test_date || selectedSubmission.sat_target_date || null;
                          const satAskDate = getCollectionAskDate(satPlannedDate);
                          return getResultCollectionStatus(
                            satAskDate,
                            selectedSubmission.sat_result_score,
                            selectedSubmission.sat_result_test_date
                          );
                        })()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.ieltsAskResult')}</span>
                      <p className="font-medium">
                        {(() => {
                          const ieltsPlannedDate = selectedSubmission.ielts_planned_test_date || selectedSubmission.ielts_target_date;
                          const ieltsAskDate = getCollectionAskDate(ieltsPlannedDate);
                          return ieltsAskDate ? formatAppDate(ieltsAskDate) : t('adminUsers.zero.na');
                        })()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const ieltsPlannedDate = selectedSubmission.ielts_planned_test_date || selectedSubmission.ielts_target_date;
                          const ieltsAskDate = getCollectionAskDate(ieltsPlannedDate);
                          return getResultCollectionStatus(
                            ieltsAskDate,
                            selectedSubmission.ielts_result_score,
                            selectedSubmission.ielts_result_test_date
                          );
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SAT Section */}
                {hasSATData(selectedSubmission) && (
                  <div className="border-2 border-brand-border rounded-lg overflow-hidden">
                    <div className="bg-brand-surface px-4 py-3 border-b border-brand-border">
                      <h3 className="text-lg font-semibold text-brand flex items-center gap-2">
                        {t('adminUsers.zero.satAssessment')}
                        {calculateSATAverageScore(selectedSubmission) && (
                          <Badge className="bg-brand-subtle text-brand-subtle-foreground ml-auto">
                            {t('adminUsers.zero.average', { score: calculateSATAverageScore(selectedSubmission) ?? '' })}
                          </Badge>
                        )}
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* SAT Test Information */}
                      <div>
                        <h4 className="font-medium mb-2 text-brand">{t('adminUsers.zero.testInfo')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.targetDate')}</span>
                            <p className="font-medium">{selectedSubmission.sat_target_date || t('adminUsers.zero.na')}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.plannedDate')}</span>
                            <p className="font-medium">{selectedSubmission.sat_planned_test_date || selectedSubmission.sat_target_date || t('adminUsers.zero.na')}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.passedBefore')}</span>
                            <p className="font-medium">{selectedSubmission.has_passed_sat_before ? t('common.yes') : t('common.no')}</p>
                          </div>
                          {selectedSubmission.previous_sat_score && (
                            <div className="space-y-1">
                              <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.previousScore')}</span>
                              <p className="font-medium">{selectedSubmission.previous_sat_score}</p>
                            </div>
                          )}
                          <div className="space-y-1 col-span-2">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.recentPractice')}</span>
                            <p className="font-medium">{selectedSubmission.recent_practice_test_score || t('adminUsers.zero.na')}</p>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.bluebookTest5')}</span>
                            <p className="font-medium">{selectedSubmission.bluebook_practice_test_5_score || t('adminUsers.zero.na')}</p>
                          </div>
                          {selectedSubmission.screenshot_url && (() => {
                            const href = safeUploadUrl(selectedSubmission.screenshot_url);
                            return (
                              <div className="space-y-1">
                                <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.screenshot')}</span>
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand hover:underline font-medium"
                                  >
                                    {t('adminUsers.zero.viewScreenshot')}
                                  </a>
                                ) : (
                                  <p className="text-muted-foreground font-medium">{t('adminUsers.zero.screenshotUnavailable')}</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Grammar Assessment */}
                      <div>
                        <h4 className="font-medium mb-2 text-brand">{t('adminUsers.zero.grammarTitle')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.punctuation')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_punctuation || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.nounClauses')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_noun_clauses || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.relativeClauses')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_relative_clauses || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.verbForms')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_verb_forms || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.comparisons')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_comparisons || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.transitions')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_transitions || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.synthesis')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_synthesis || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Reading Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-brand">{t('adminUsers.zero.readingTitle')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.wordInContext')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_word_in_context || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.textStructure')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_text_structure || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.crossText')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_cross_text || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.centralIdeas')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_central_ideas || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.inferences')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_inferences || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Passage Types */}
                      <div>
                        <h4 className="font-medium mb-2 text-brand">{t('adminUsers.zero.passagesTitle')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.literary')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_literary || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.socialScience')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_social_science || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.humanities')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_humanities || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.science')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_science || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.poetry')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_poetry || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Math Topics */}
                      {selectedSubmission.math_topics && selectedSubmission.math_topics.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 text-brand">
                            {t('adminUsers.zero.mathTopics', { count: selectedSubmission.math_topics.length })}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedSubmission.math_topics.map((topic) => (
                              <Badge key={topic} variant="secondary" className="bg-brand-subtle text-brand-subtle-foreground">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* IELTS Section */}
                {hasIELTSData(selectedSubmission) && (
                  <div className="border-2 border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
                    <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3 border-b border-green-200 dark:border-green-800">
                      <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                        {t('adminUsers.zero.ieltsAssessment')}
                        {calculateIELTSAverageScore(selectedSubmission) && (
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ml-auto">
                            {t('adminUsers.zero.average', { score: calculateIELTSAverageScore(selectedSubmission) ?? '' })}
                          </Badge>
                        )}
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* IELTS Test Information */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">{t('adminUsers.zero.testInfo')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.targetDate')}</span>
                            <p className="font-medium">{selectedSubmission.ielts_target_date || t('adminUsers.zero.na')}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.plannedDate')}</span>
                            <p className="font-medium">{selectedSubmission.ielts_planned_test_date || selectedSubmission.ielts_target_date || t('adminUsers.zero.na')}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.targetScore')}</span>
                            <p className="font-medium">{selectedSubmission.ielts_target_score || t('adminUsers.zero.na')}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.passedBefore')}</span>
                            <p className="font-medium">{selectedSubmission.has_passed_ielts_before ? t('common.yes') : t('common.no')}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.lastPrompted')}</span>
                            <p className="font-medium">{formatDateTime(selectedSubmission.ielts_last_date_prompted_at)}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.nextPrompt')}</span>
                            <p className="font-medium">{formatDateTime(getNextIeltsPromptAt(selectedSubmission.ielts_last_date_prompted_at))}</p>
                          </div>
                          {selectedSubmission.previous_ielts_score && (
                            <div className="space-y-1">
                              <span className="text-muted-foreground text-xs uppercase">{t('adminUsers.zero.previousScore')}</span>
                              <p className="font-medium">{selectedSubmission.previous_ielts_score}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Listening Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">{t('adminUsers.zero.listeningTitle')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.mainIdea')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_listening_main_idea || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.details')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_listening_details || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.opinion')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_listening_opinion || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.accents')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_listening_accents || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Reading Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">{t('adminUsers.zero.readingTitle')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.skimming')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_skimming || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.scanning')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_scanning || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.vocabulary')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_vocabulary || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.inference')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_inference || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.matching')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_matching || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Writing Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">{t('adminUsers.zero.writingTitle')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.task1Graphs')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_task1_graphs || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.task1Process')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_task1_process || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.task2Structure')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_task2_structure || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.task2Arguments')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_task2_arguments || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.grammar')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_grammar || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.vocabulary')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_vocabulary || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Speaking Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">{t('adminUsers.zero.speakingTitle')}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.fluency')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_fluency || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.vocabulary')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_vocabulary || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.grammar')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_grammar || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.pronunciation')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_pronunciation || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.part2')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_part2 || '-'}</p>
                          </div>
                          <div className="bg-card dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-muted-foreground text-xs">{t('adminUsers.zero.part3')}</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_part3 || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* IELTS Weak Topics */}
                      {selectedSubmission.ielts_weak_topics && selectedSubmission.ielts_weak_topics.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">
                            {t('adminUsers.zero.ieltsTopics', { count: selectedSubmission.ielts_weak_topics.length })}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedSubmission.ielts_weak_topics.map((topic) => (
                              <Badge key={topic} variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Comments */}
                {selectedSubmission.additional_comments && (
                  <div className="rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      {t('adminUsers.zero.comments')}
                    </h3>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{selectedSubmission.additional_comments}</p>
                  </div>
                )}

                {/* Submission Info */}
                <div className="text-xs text-muted-foreground text-center pt-4 border-t dark:border-border">
                  {t('adminUsers.zero.submittedAt', { date: formatAppDateTime(selectedSubmission.updated_at, { ...DATE, ...TIME }) })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AssignmentZeroSubmissions;
