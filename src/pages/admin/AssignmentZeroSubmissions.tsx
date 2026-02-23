import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import apiClient from '../../services/api';
import { Search, Download, Eye, Filter, BookOpen, Headphones } from 'lucide-react';

interface AssignmentZeroSubmission {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone_number: string;
  parent_phone_number: string;
  telegram_id: string;
  college_board_email: string;
  college_board_password: string;
  birthday_date: string;
  city: string;
  school_type: string;
  group_name: string;
  sat_target_date: string;
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
  const [submissions, setSubmissions] = useState<AssignmentZeroSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<AssignmentZeroSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentZeroSubmission | null>(null);
  const [filterDraft, setFilterDraft] = useState<'all' | 'draft' | 'submitted'>('submitted');

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [searchQuery, submissions, filterDraft]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAllAssignmentZeroSubmissions();
      setSubmissions(response);
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
        new Date(s.updated_at).toLocaleString(),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `assignment_zero_submissions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Assignment Zero Submissions</h1>
        <p className="text-gray-600 dark:text-gray-400">View and analyze student self-assessment questionnaires</p>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by name, email, group, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterDraft === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterDraft('all')}
                size="sm"
              >
                <Filter className="w-4 h-4 mr-2" />
                All ({submissions.length})
              </Button>
              <Button
                variant={filterDraft === 'submitted' ? 'default' : 'outline'}
                onClick={() => setFilterDraft('submitted')}
                size="sm"
              >
                Submitted ({submissions.filter((s) => !s.is_draft).length})
              </Button>
              <Button
                variant={filterDraft === 'draft' ? 'default' : 'outline'}
                onClick={() => setFilterDraft('draft')}
                size="sm"
              >
                Drafts ({submissions.filter((s) => s.is_draft).length})
              </Button>
            </div>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submissions List */}
      <div className="grid gap-4">
        {filteredSubmissions.map((submission) => (
          <Card key={submission.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{submission.full_name}</h3>
                    <Badge variant={submission.is_draft ? 'secondary' : 'default'}>
                      {submission.is_draft ? 'Draft' : 'Submitted'}
                    </Badge>
                    {hasSATData(submission) && (
                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium">Email:</span> {submission.email}
                    </div>
                    <div>
                      <span className="font-medium">Group:</span> {submission.group_name}
                    </div>
                    <div>
                      <span className="font-medium">City:</span> {submission.city}
                    </div>
                    <div>
                      <span className="font-medium">School:</span> {submission.school_type}
                    </div>
                    {submission.sat_target_date && (
                      <div>
                        <span className="font-medium">SAT Target:</span> {submission.sat_target_date}
                      </div>
                    )}
                    {submission.ielts_target_date && (
                      <div>
                        <span className="font-medium">IELTS Target:</span> {submission.ielts_target_date}
                      </div>
                    )}
                    {submission.bluebook_practice_test_5_score && (
                      <div>
                        <span className="font-medium">Bluebook:</span> {submission.bluebook_practice_test_5_score}
                      </div>
                    )}
                    {submission.ielts_target_score && (
                      <div>
                        <span className="font-medium">Target Score:</span> {submission.ielts_target_score}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Submitted:</span>{' '}
                      {new Date(submission.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedSubmission(submission)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSubmissions.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500 dark:text-gray-400">
            <p>No submissions found matching your criteria.</p>
          </CardContent>
        </Card>
      )}

      {/* Detailed View Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <Card className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader className="sticky top-0 bg-white dark:bg-card z-10 border-b dark:border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Assignment Zero - {selectedSubmission.full_name}</CardTitle>
                  {hasSATData(selectedSubmission) && (
                    <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
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
                <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Personal Information */}
                <div className="bg-gray-50 dark:bg-secondary rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Full Name</span>
                      <p className="font-medium">{selectedSubmission.full_name}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Email</span>
                      <p className="font-medium">{selectedSubmission.email}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Phone</span>
                      <p className="font-medium">{selectedSubmission.phone_number}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Parent Phone</span>
                      <p className="font-medium">{selectedSubmission.parent_phone_number}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Telegram</span>
                      <p className="font-medium">{selectedSubmission.telegram_id}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Birthday</span>
                      <p className="font-medium">{selectedSubmission.birthday_date}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">City</span>
                      <p className="font-medium">{selectedSubmission.city}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">School Type</span>
                      <p className="font-medium">{selectedSubmission.school_type}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Group</span>
                      <p className="font-medium">{selectedSubmission.group_name}</p>
                    </div>
                  </div>
                </div>

                {/* Account Information */}
                <div className="bg-gray-50 dark:bg-secondary rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    Account Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">College Board Email</span>
                      <p className="font-medium">{selectedSubmission.college_board_email || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">College Board Password</span>
                      <p className="font-medium font-mono bg-gray-100 dark:bg-card dark:border dark:border-border px-2 py-1 rounded">{selectedSubmission.college_board_password || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* SAT Section */}
                {hasSATData(selectedSubmission) && (
                  <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-200 dark:border-blue-800">
                      <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        SAT Assessment
                        {calculateSATAverageScore(selectedSubmission) && (
                          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ml-auto">
                            Average: {calculateSATAverageScore(selectedSubmission)}/5
                          </Badge>
                        )}
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* SAT Test Information */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">Test Information</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div className="space-y-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Target Date</span>
                            <p className="font-medium">{selectedSubmission.sat_target_date || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Passed Before</span>
                            <p className="font-medium">{selectedSubmission.has_passed_sat_before ? 'Yes' : 'No'}</p>
                          </div>
                          {selectedSubmission.previous_sat_score && (
                            <div className="space-y-1">
                              <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Previous Score</span>
                              <p className="font-medium">{selectedSubmission.previous_sat_score}</p>
                            </div>
                          )}
                          <div className="space-y-1 col-span-2">
                            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Recent Practice Test</span>
                            <p className="font-medium">{selectedSubmission.recent_practice_test_score || 'N/A'}</p>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Bluebook Practice Test 5</span>
                            <p className="font-medium">{selectedSubmission.bluebook_practice_test_5_score || 'N/A'}</p>
                          </div>
                          {selectedSubmission.screenshot_url && (
                            <div className="space-y-1">
                              <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Screenshot</span>
                              <a
                                href={(import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000') + selectedSubmission.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-medium"
                              >
                                View Screenshot
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Grammar Assessment */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">Grammar Assessment (1-5)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Punctuation</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_punctuation || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Noun Clauses</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_noun_clauses || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Relative Clauses</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_relative_clauses || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Verb Forms</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_verb_forms || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Comparisons</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_comparisons || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Transitions</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_transitions || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Synthesis</span>
                            <p className="font-bold text-lg">{selectedSubmission.grammar_synthesis || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Reading Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">Reading Skills (1-5)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Word in Context</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_word_in_context || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Text Structure</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_text_structure || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Cross-Text</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_cross_text || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Central Ideas</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_central_ideas || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Inferences</span>
                            <p className="font-bold text-lg">{selectedSubmission.reading_inferences || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Passage Types */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">Passage Types (1-5)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Literary</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_literary || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Social Science</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_social_science || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Humanities</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_humanities || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Science</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_science || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Poetry</span>
                            <p className="font-bold text-lg">{selectedSubmission.passages_poetry || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Math Topics */}
                      {selectedSubmission.math_topics && selectedSubmission.math_topics.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">
                            Math Topics to Work On ({selectedSubmission.math_topics.length} selected)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedSubmission.math_topics.map((topic) => (
                              <Badge key={topic} variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
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
                        IELTS Assessment
                        {calculateIELTSAverageScore(selectedSubmission) && (
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ml-auto">
                            Average: {calculateIELTSAverageScore(selectedSubmission)}/5
                          </Badge>
                        )}
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* IELTS Test Information */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">Test Information</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="space-y-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Target Date</span>
                            <p className="font-medium">{selectedSubmission.ielts_target_date || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Target Score</span>
                            <p className="font-medium">{selectedSubmission.ielts_target_score || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Passed Before</span>
                            <p className="font-medium">{selectedSubmission.has_passed_ielts_before ? 'Yes' : 'No'}</p>
                          </div>
                          {selectedSubmission.previous_ielts_score && (
                            <div className="space-y-1">
                              <span className="text-gray-500 dark:text-gray-400 text-xs uppercase">Previous Score</span>
                              <p className="font-medium">{selectedSubmission.previous_ielts_score}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Listening Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">Listening Skills (1-5)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Main Idea</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_listening_main_idea || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Details</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_listening_details || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Opinion</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_listening_opinion || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Accents</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_listening_accents || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Reading Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">Reading Skills (1-5)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Skimming</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_skimming || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Scanning</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_scanning || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Vocabulary</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_vocabulary || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Inference</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_inference || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Matching</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_reading_matching || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Writing Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">Writing Skills (1-5)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Task 1 - Graphs</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_task1_graphs || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Task 1 - Process</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_task1_process || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Task 2 - Structure</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_task2_structure || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Task 2 - Arguments</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_task2_arguments || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Grammar</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_grammar || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Vocabulary</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_writing_vocabulary || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Speaking Skills */}
                      <div>
                        <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">Speaking Skills (1-5)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Fluency</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_fluency || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Vocabulary</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_vocabulary || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Grammar</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_grammar || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Pronunciation</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_pronunciation || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Part 2 (Long Turn)</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_part2 || '-'}</p>
                          </div>
                          <div className="bg-white dark:bg-card p-2 rounded border dark:border-border">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Part 3 (Discussion)</span>
                            <p className="font-bold text-lg">{selectedSubmission.ielts_speaking_part3 || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* IELTS Weak Topics */}
                      {selectedSubmission.ielts_weak_topics && selectedSubmission.ielts_weak_topics.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 text-green-700 dark:text-green-400">
                            Topics to Work On ({selectedSubmission.ielts_weak_topics.length} selected)
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
                      Additional Comments
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedSubmission.additional_comments}</p>
                  </div>
                )}

                {/* Submission Info */}
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-4 border-t dark:border-border">
                  Submitted: {new Date(selectedSubmission.updated_at).toLocaleString()} | 
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
