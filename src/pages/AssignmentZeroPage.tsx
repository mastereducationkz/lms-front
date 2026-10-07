import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import apiClient from '../services/api';
import { getSatOfficialDates } from '../services/api/exams';
import { toast } from '../components/Toast.tsx';
import { isCollegeBoardPasswordRequired } from '../lib/assignmentZeroCollegeBoard';
import { formatDate, type Locale, type MessageKey } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';
import {
  Upload,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Send,
  Cloud,
  CloudOff,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { Textarea } from '../components/ui/textarea.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.tsx';
import { Checkbox } from '../components/ui/checkbox.tsx';

// Form data interface with all fields
interface FormData {
  full_name: string;
  phone_number: string;
  parent_phone_number: string;
  telegram_id: string;
  email: string;
  college_board_email: string;
  college_board_password: string;
  birthday_date: string;
  city: string;
  school_type: string;
  group_name: string;
  sat_target_date: string;
  has_passed_sat_before: boolean;
  previous_sat_score: string; // Will be computed from structured fields
  // Structured previous SAT fields
  previous_sat_month: string;
  previous_sat_year: string;
  previous_sat_verbal: string;
  previous_sat_math: string;
  recent_practice_test_score: string;
  bluebook_practice_test_5_score: string; // Will be computed from structured fields
  // Structured Bluebook Practice Test 5 fields
  bluebook_verbal: string;
  bluebook_math: string;
  screenshot_url: string;
  // Grammar Assessment (1-5 scale)
  grammar_punctuation: number | null;
  grammar_noun_clauses: number | null;
  grammar_relative_clauses: number | null;
  grammar_verb_forms: number | null;
  grammar_comparisons: number | null;
  grammar_transitions: number | null;
  grammar_synthesis: number | null;
  // Reading Skills Assessment (1-5 scale)
  reading_word_in_context: number | null;
  reading_text_structure: number | null;
  reading_cross_text: number | null;
  reading_central_ideas: number | null;
  reading_inferences: number | null;
  // SAT Passage Types (1-5 scale)
  passages_literary: number | null;
  passages_social_science: number | null;
  passages_humanities: number | null;
  passages_science: number | null;
  passages_poetry: number | null;
  // Math Topics
  math_topics: string[];
  
  // =============================================================================
  // IELTS Specific Fields
  // =============================================================================
  ielts_target_date: string;
  has_passed_ielts_before: boolean;
  previous_ielts_score: string;
  // Structured previous IELTS fields
  previous_ielts_listening: string;
  previous_ielts_reading: string;
  previous_ielts_writing: string;
  previous_ielts_speaking: string;
  previous_ielts_overall: string;
  ielts_target_score: string;
  // IELTS Listening Assessment (1-5 scale)
  ielts_listening_main_idea: number | null;
  ielts_listening_details: number | null;
  ielts_listening_opinion: number | null;
  ielts_listening_accents: number | null;
  // IELTS Reading Assessment (1-5 scale)
  ielts_reading_skimming: number | null;
  ielts_reading_scanning: number | null;
  ielts_reading_vocabulary: number | null;
  ielts_reading_inference: number | null;
  ielts_reading_matching: number | null;
  // IELTS Writing Assessment (1-5 scale)
  ielts_writing_task1_graphs: number | null;
  ielts_writing_task1_process: number | null;
  ielts_writing_task2_structure: number | null;
  ielts_writing_task2_arguments: number | null;
  ielts_writing_grammar: number | null;
  ielts_writing_vocabulary: number | null;
  // IELTS Speaking Assessment (1-5 scale)
  ielts_speaking_fluency: number | null;
  ielts_speaking_vocabulary: number | null;
  ielts_speaking_grammar: number | null;
  ielts_speaking_pronunciation: number | null;
  ielts_speaking_part2: number | null;
  ielts_speaking_part3: number | null;
  // IELTS Weak Topics
  ielts_weak_topics: string[];
  
  // Additional comments
  additional_comments: string;
}

const SCHOOL_TYPES: { value: string; label: MessageKey }[] = [
  { value: 'NIS', label: 'studentHome.assignmentZero.school.nis' },
  { value: 'RFMS', label: 'studentHome.assignmentZero.school.rfms' },
  { value: 'BIL', label: 'studentHome.assignmentZero.school.bil' },
  { value: 'Private', label: 'studentHome.assignmentZero.school.private' },
  { value: 'Public', label: 'studentHome.assignmentZero.school.public' },
];

// SAT official dates are fetched from GET /exams/sat-dates (see satTargetDates below).
//
// They used to be generated here from a hard-coded {month, day} table projected onto
// the current year. That table held the 2025-26 days, so every 2026-27 option was
// wrong by 1-8 days (Aug 23 instead of Aug 22, March 14 instead of March 6, ...) while
// the backend had the correct list all along. Do not reintroduce a local date table.

const SAT_MONTHS = [
  { value: 'January' },
  { value: 'February' },
  { value: 'March' },
  { value: 'April' },
  { value: 'May' },
  { value: 'June' },
  { value: 'July' },
  { value: 'August' },
  { value: 'September' },
  { value: 'October' },
  { value: 'November' },
  { value: 'December' },
];

/** "January" / «Январь»: month `index` (0 = January) in the reader's language. */
const monthName = (index: number, locale: Locale): string => {
  const name = formatDate(new Date(2026, index, 15), { month: 'long' }, locale);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const PHONE_PLACEHOLDER = '+7 (XXX) XXX-XX-XX';

const SAT_YEARS = [
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' },
  { value: '2020', label: '2020' },
];

const GRAMMAR_QUESTIONS: { key: string; label: MessageKey }[] = [
  { key: 'grammar_punctuation', label: 'studentHome.assignmentZero.q.grammarPunctuation' },
  { key: 'grammar_noun_clauses', label: 'studentHome.assignmentZero.q.grammarNounClauses' },
  { key: 'grammar_relative_clauses', label: 'studentHome.assignmentZero.q.grammarRelativeClauses' },
  { key: 'grammar_verb_forms', label: 'studentHome.assignmentZero.q.grammarVerbForms' },
  { key: 'grammar_comparisons', label: 'studentHome.assignmentZero.q.grammarComparisons' },
  { key: 'grammar_transitions', label: 'studentHome.assignmentZero.q.grammarTransitions' },
  { key: 'grammar_synthesis', label: 'studentHome.assignmentZero.q.grammarSynthesis' },
];

const READING_QUESTIONS: { key: string; label: MessageKey }[] = [
  { key: 'reading_word_in_context', label: 'studentHome.assignmentZero.q.readingWordInContext' },
  { key: 'reading_text_structure', label: 'studentHome.assignmentZero.q.readingTextStructure' },
  { key: 'reading_cross_text', label: 'studentHome.assignmentZero.q.readingCrossText' },
  { key: 'reading_central_ideas', label: 'studentHome.assignmentZero.q.readingCentralIdeas' },
  { key: 'reading_inferences', label: 'studentHome.assignmentZero.q.readingInferences' },
];

const PASSAGES_QUESTIONS: { key: string; label: MessageKey }[] = [
  { key: 'passages_literary', label: 'studentHome.assignmentZero.q.passagesLiterary' },
  { key: 'passages_social_science', label: 'studentHome.assignmentZero.q.passagesSocialScience' },
  { key: 'passages_humanities', label: 'studentHome.assignmentZero.q.passagesHumanities' },
  { key: 'passages_science', label: 'studentHome.assignmentZero.q.passagesScience' },
  { key: 'passages_poetry', label: 'studentHome.assignmentZero.q.passagesPoetry' },
];

// `value` is what the submission stores (the English name); `label` is what the student reads.
const MATH_TOPICS: { value: string; label: MessageKey }[] = [
  { value: 'Problem-solving and Data Analysis', label: 'studentHome.assignmentZero.math.problemSolving' },
  { value: 'Linear equations', label: 'studentHome.assignmentZero.math.linearEquations' },
  { value: 'Linear inequalities', label: 'studentHome.assignmentZero.math.linearInequalities' },
  { value: 'Linear functions', label: 'studentHome.assignmentZero.math.linearFunctions' },
  { value: 'System of linear equations', label: 'studentHome.assignmentZero.math.linearSystems' },
  { value: 'Quadratic equations', label: 'studentHome.assignmentZero.math.quadraticEquations' },
  { value: 'Quadratic functions', label: 'studentHome.assignmentZero.math.quadraticFunctions' },
  { value: 'Polynomial functions', label: 'studentHome.assignmentZero.math.polynomialFunctions' },
  { value: 'Radical, rational, and exponential functions', label: 'studentHome.assignmentZero.math.radicalFunctions' },
  { value: 'Equivalent expressions', label: 'studentHome.assignmentZero.math.equivalentExpressions' },
  { value: 'Percentages', label: 'studentHome.assignmentZero.math.percentages' },
  { value: 'Ratios, rates, proportional relationships', label: 'studentHome.assignmentZero.math.ratios' },
  { value: 'Geometry and Trigonometry', label: 'studentHome.assignmentZero.math.geometry' },
  { value: 'Lines, angles, and triangles', label: 'studentHome.assignmentZero.math.linesAngles' },
  { value: 'Right triangles', label: 'studentHome.assignmentZero.math.rightTriangles' },
  { value: 'Circles and sectors', label: 'studentHome.assignmentZero.math.circles' },
  { value: 'Area, volume, and 3D shapes', label: 'studentHome.assignmentZero.math.areaVolume' },
];

// =============================================================================
// IELTS SPECIFIC CONSTANTS
// =============================================================================

const IELTS_TARGET_DATES = [
  { value: 'January' },
  { value: 'February' },
  { value: 'March' },
  { value: 'April' },
  { value: 'May' },
  { value: 'June' },
  { value: 'July' },
  { value: 'August' },
  { value: 'September' },
  { value: 'October' },
  { value: 'November' },
  { value: 'December' },
];

const IELTS_TARGET_SCORES = [
  { value: '5.0', label: '5.0' },
  { value: '5.5', label: '5.5' },
  { value: '6.0', label: '6.0' },
  { value: '6.5', label: '6.5' },
  { value: '7.0', label: '7.0' },
  { value: '7.5', label: '7.5' },
  { value: '8.0', label: '8.0' },
  { value: '8.5', label: '8.5' },
  { value: '9.0', label: '9.0' },
];

const IELTS_LISTENING_QUESTIONS: { key: string; label: MessageKey }[] = [
  { key: 'ielts_listening_main_idea', label: 'studentHome.assignmentZero.q.ieltsListeningMainIdea' },
  { key: 'ielts_listening_details', label: 'studentHome.assignmentZero.q.ieltsListeningDetails' },
  { key: 'ielts_listening_opinion', label: 'studentHome.assignmentZero.q.ieltsListeningOpinion' },
  { key: 'ielts_listening_accents', label: 'studentHome.assignmentZero.q.ieltsListeningAccents' },
];

const IELTS_READING_QUESTIONS: { key: string; label: MessageKey }[] = [
  { key: 'ielts_reading_skimming', label: 'studentHome.assignmentZero.q.ieltsReadingSkimming' },
  { key: 'ielts_reading_scanning', label: 'studentHome.assignmentZero.q.ieltsReadingScanning' },
  { key: 'ielts_reading_vocabulary', label: 'studentHome.assignmentZero.q.ieltsReadingVocabulary' },
  { key: 'ielts_reading_inference', label: 'studentHome.assignmentZero.q.ieltsReadingInference' },
  { key: 'ielts_reading_matching', label: 'studentHome.assignmentZero.q.ieltsReadingMatching' },
];

const IELTS_WRITING_QUESTIONS: { key: string; label: MessageKey }[] = [
  { key: 'ielts_writing_task1_graphs', label: 'studentHome.assignmentZero.q.ieltsWritingTask1Graphs' },
  { key: 'ielts_writing_task1_process', label: 'studentHome.assignmentZero.q.ieltsWritingTask1Process' },
  { key: 'ielts_writing_task2_structure', label: 'studentHome.assignmentZero.q.ieltsWritingTask2Structure' },
  { key: 'ielts_writing_task2_arguments', label: 'studentHome.assignmentZero.q.ieltsWritingTask2Arguments' },
  { key: 'ielts_writing_grammar', label: 'studentHome.assignmentZero.q.ieltsWritingGrammar' },
  { key: 'ielts_writing_vocabulary', label: 'studentHome.assignmentZero.q.ieltsWritingVocabulary' },
];

const IELTS_SPEAKING_QUESTIONS: { key: string; label: MessageKey }[] = [
  { key: 'ielts_speaking_fluency', label: 'studentHome.assignmentZero.q.ieltsSpeakingFluency' },
  { key: 'ielts_speaking_vocabulary', label: 'studentHome.assignmentZero.q.ieltsSpeakingVocabulary' },
  { key: 'ielts_speaking_grammar', label: 'studentHome.assignmentZero.q.ieltsSpeakingGrammar' },
  { key: 'ielts_speaking_pronunciation', label: 'studentHome.assignmentZero.q.ieltsSpeakingPronunciation' },
  { key: 'ielts_speaking_part2', label: 'studentHome.assignmentZero.q.ieltsSpeakingPart2' },
  { key: 'ielts_speaking_part3', label: 'studentHome.assignmentZero.q.ieltsSpeakingPart3' },
];

const IELTS_WEAK_TOPICS: { value: string; label: MessageKey }[] = [
  { value: 'Listening - Multiple choice questions', label: 'studentHome.assignmentZero.ieltsTopic.listeningMultipleChoice' },
  { value: 'Listening - Sentence completion', label: 'studentHome.assignmentZero.ieltsTopic.listeningSentence' },
  { value: 'Listening - Note/form completion', label: 'studentHome.assignmentZero.ieltsTopic.listeningNoteForm' },
  { value: 'Listening - Map/diagram labeling', label: 'studentHome.assignmentZero.ieltsTopic.listeningMap' },
  { value: 'Reading - True/False/Not Given', label: 'studentHome.assignmentZero.ieltsTopic.readingTrueFalse' },
  { value: 'Reading - Yes/No/Not Given', label: 'studentHome.assignmentZero.ieltsTopic.readingYesNo' },
  { value: 'Reading - Matching headings', label: 'studentHome.assignmentZero.ieltsTopic.readingHeadings' },
  { value: 'Reading - Summary completion', label: 'studentHome.assignmentZero.ieltsTopic.readingSummary' },
  { value: 'Reading - Multiple choice', label: 'studentHome.assignmentZero.ieltsTopic.readingMultipleChoice' },
  { value: 'Writing Task 1 - Line graphs', label: 'studentHome.assignmentZero.ieltsTopic.task1Line' },
  { value: 'Writing Task 1 - Bar charts', label: 'studentHome.assignmentZero.ieltsTopic.task1Bar' },
  { value: 'Writing Task 1 - Pie charts', label: 'studentHome.assignmentZero.ieltsTopic.task1Pie' },
  { value: 'Writing Task 1 - Tables', label: 'studentHome.assignmentZero.ieltsTopic.task1Tables' },
  { value: 'Writing Task 1 - Process diagrams', label: 'studentHome.assignmentZero.ieltsTopic.task1Process' },
  { value: 'Writing Task 1 - Maps', label: 'studentHome.assignmentZero.ieltsTopic.task1Maps' },
  { value: 'Writing Task 2 - Opinion essays', label: 'studentHome.assignmentZero.ieltsTopic.task2Opinion' },
  { value: 'Writing Task 2 - Discussion essays', label: 'studentHome.assignmentZero.ieltsTopic.task2Discussion' },
  { value: 'Writing Task 2 - Problem/solution essays', label: 'studentHome.assignmentZero.ieltsTopic.task2Problem' },
  { value: 'Writing Task 2 - Advantage/disadvantage essays', label: 'studentHome.assignmentZero.ieltsTopic.task2Advantages' },
  { value: 'Speaking Part 1 - Personal topics', label: 'studentHome.assignmentZero.ieltsTopic.speakingPart1' },
  { value: 'Speaking Part 2 - Cue cards', label: 'studentHome.assignmentZero.ieltsTopic.speakingPart2' },
  { value: 'Speaking Part 3 - Abstract discussions', label: 'studentHome.assignmentZero.ieltsTopic.speakingPart3' },
];

type CourseProgramType = 'sat' | 'ielts' | 'nuet' | 'general_english';

type UserGroupInfo = {
  id: number;
  name: string;
  program_type?: string;
  is_special?: boolean;
};

const resolveGroupProgramType = (group: UserGroupInfo): CourseProgramType => {
  const stored = (group.program_type || '').toLowerCase();
  if (stored === 'sat' || stored === 'ielts' || stored === 'nuet') return stored;
  const name = group.name || '';
  if (/\bielts\b/i.test(name)) return 'ielts';
  if (/\bnuet\b/i.test(name)) return 'nuet';
  if (/\bsat\b/i.test(name)) return 'sat';
  return 'general_english';
};

const LIKERT_SCALE = [
  { value: 1, label: "1 - Don't know" },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5 - Mastered' },
];

// Likert Scale Component
function LikertScale({
  label,
  value,
  onChange,
  error,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  error?: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const t = useT();
  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted">
      <Label className="text-sm font-medium block">{label}</Label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground w-24 text-left">{leftLabel ?? t('studentHome.assignmentZero.likert.disagree')}</span>
        <div className="flex gap-2 flex-1 justify-center">
          {LIKERT_SCALE.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`w-10 h-10 text-sm rounded-lg border transition-all font-medium ${
                value === option.value
                  ? 'bg-brand-solid text-brand-solid-foreground border-brand'
                  : 'bg-card text-gray-700 dark:text-foreground border-gray-300 dark:border-border hover:border-blue-400 dark:hover:border-brand hover:bg-brand-surface'
              }`}
            >
              {option.value}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground w-24 text-right">{rightLabel ?? t('studentHome.assignmentZero.likert.agree')}</span>
      </div>
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}

// Saving indicator component
function SavingIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  const t = useT();
  if (status === 'idle') return null;

  const label =
    status === 'saving'
      ? t('studentHome.assignmentZero.save.saving')
      : status === 'saved'
        ? t('studentHome.assignmentZero.save.saved')
        : t('studentHome.assignmentZero.save.failed')

  return (
    <div
      className="fixed bottom-4 right-4 z-50 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm sm:bottom-auto sm:top-4"
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  )
}

/** Avoid string concatenation bugs if step ever comes from API as a string (e.g. "8" + 1 → "81"). */
const toAssignmentZeroStep = (raw: unknown): number => {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.floor(n))
}

const normalizeStringArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string')
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string')
      }
    } catch {
      /* ignore */
    }
  }
  return []
}

export default function AssignmentZeroPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  // G9 a′: the server only tells us whether a College Board password is already
  // stored, never the plaintext. When true, the "account" step's password field
  // is optional and starts blank — leaving it blank on save/submit keeps the
  // stored value (server-side rule, not enforced here).
  const [hasCollegeBoardPassword, setHasCollegeBoardPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string>('');
  
  // User groups state
  const [userGroups, setUserGroups] = useState<UserGroupInfo[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  // Determine which questionnaire sections to show from group program_type (not name heuristics alone)
  const showSAT = useMemo(() => {
    if (!groupsLoaded) return false;
    if (userGroups.length === 0) return true;
    return userGroups.some(g => resolveGroupProgramType(g) === 'sat');
  }, [userGroups, groupsLoaded]);

  const showIELTS = useMemo(() => {
    if (!groupsLoaded) return false;
    return userGroups.some(g => resolveGroupProgramType(g) === 'ielts');
  }, [userGroups, groupsLoaded]);
  
  // Dynamic steps based on user groups
  const DYNAMIC_STEPS = useMemo(() => {
    const baseSteps = [
      { id: 'personal', title: t('studentHome.assignmentZero.step.personal'), type: 'common' },
      { id: 'account', title: t('studentHome.assignmentZero.step.account'), type: 'common' },
      { id: 'education', title: t('studentHome.assignmentZero.step.education'), type: 'common' },
    ];
    
    const satSteps = [
      { id: 'sat_results', title: t('studentHome.assignmentZero.step.satResults'), type: 'sat' },
      { id: 'sat_grammar', title: t('studentHome.assignmentZero.step.grammar'), type: 'sat' },
      { id: 'sat_reading', title: t('studentHome.assignmentZero.section.reading'), type: 'sat' },
      { id: 'sat_passages', title: t('studentHome.assignmentZero.step.passages'), type: 'sat' },
      { id: 'sat_math', title: t('studentHome.assignmentZero.step.mathTopics'), type: 'sat' },
    ];
    
    const ieltsSteps = [
      { id: 'ielts_listening', title: t('studentHome.assignmentZero.section.listening'), type: 'ielts' },
      { id: 'ielts_reading', title: t('studentHome.assignmentZero.step.ieltsReading'), type: 'ielts' },
      { id: 'ielts_writing', title: t('studentHome.assignmentZero.section.writing'), type: 'ielts' },
      { id: 'ielts_speaking', title: t('studentHome.assignmentZero.section.speaking'), type: 'ielts' },
      { id: 'ielts_topics', title: t('studentHome.assignmentZero.step.ieltsTopics'), type: 'ielts' },
    ];
    
    const endSteps = [
      { id: 'comments', title: t('studentHome.assignmentZero.step.comments'), type: 'common' },
    ];
    
    let steps = [...baseSteps];
    if (showSAT) steps = [...steps, ...satSteps];
    if (showIELTS) steps = [...steps, ...ieltsSteps];
    steps = [...steps, ...endSteps];
    
    return steps;
  }, [showSAT, showIELTS, t]);
  
  const totalSteps = DYNAMIC_STEPS.length;
  const displayStep =
    totalSteps >= 1
      ? Math.min(Math.max(toAssignmentZeroStep(currentStep), 1), totalSteps)
      : 1;
  const currentStepId = DYNAMIC_STEPS[displayStep - 1]?.id || '';

  const [formData, setFormData] = useState<FormData>({
    full_name: user?.full_name || user?.name || '',
    phone_number: '',
    parent_phone_number: '',
    telegram_id: '',
    email: user?.email || '',
    college_board_email: '',
    college_board_password: '',
    birthday_date: '',
    city: '',
    school_type: '',
    group_name: '',
    sat_target_date: '',
    has_passed_sat_before: false,
    previous_sat_score: '',
    previous_sat_month: '',
    previous_sat_year: '',
    previous_sat_verbal: '',
    previous_sat_math: '',
    recent_practice_test_score: '',
    bluebook_practice_test_5_score: '',
    bluebook_verbal: '',
    bluebook_math: '',
    screenshot_url: '',
    // Grammar Assessment
    grammar_punctuation: null,
    grammar_noun_clauses: null,
    grammar_relative_clauses: null,
    grammar_verb_forms: null,
    grammar_comparisons: null,
    grammar_transitions: null,
    grammar_synthesis: null,
    // Reading Skills
    reading_word_in_context: null,
    reading_text_structure: null,
    reading_cross_text: null,
    reading_central_ideas: null,
    reading_inferences: null,
    // Passages
    passages_literary: null,
    passages_social_science: null,
    passages_humanities: null,
    passages_science: null,
    passages_poetry: null,
    // Math Topics
    math_topics: [],
    // IELTS fields
    ielts_target_date: '',
    has_passed_ielts_before: false,
    previous_ielts_score: '',
    previous_ielts_listening: '',
    previous_ielts_reading: '',
    previous_ielts_writing: '',
    previous_ielts_speaking: '',
    previous_ielts_overall: '',
    ielts_target_score: '',
    // IELTS Listening
    ielts_listening_main_idea: null,
    ielts_listening_details: null,
    ielts_listening_opinion: null,
    ielts_listening_accents: null,
    // IELTS Reading
    ielts_reading_skimming: null,
    ielts_reading_scanning: null,
    ielts_reading_vocabulary: null,
    ielts_reading_inference: null,
    ielts_reading_matching: null,
    // IELTS Writing
    ielts_writing_task1_graphs: null,
    ielts_writing_task1_process: null,
    ielts_writing_task2_structure: null,
    ielts_writing_task2_arguments: null,
    ielts_writing_grammar: null,
    ielts_writing_vocabulary: null,
    // IELTS Speaking
    ielts_speaking_fluency: null,
    ielts_speaking_vocabulary: null,
    ielts_speaking_grammar: null,
    ielts_speaking_pronunciation: null,
    ielts_speaking_part2: null,
    ielts_speaking_part3: null,
    // IELTS Weak Topics
    ielts_weak_topics: [],
    // Comments
    additional_comments: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Official SAT dates, from the backend registry - never a local table.
  // Only upcoming CONFIRMED administrations are offered as a target; College Board's
  // provisional "Anticipated" 2027-28 dates are excluded so a student is never asked
  // to plan around a date that may still move.
  const [satTargetDates, setSatTargetDates] = useState<{ value: string; label: string; testDate: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { dates } = await getSatOfficialDates({ includeAnticipated: false, includePast: false });
        if (cancelled) return;
        // `value` stays the human label because that is what `sat_target_date` has
        // always stored, and the backend parses it back to a real date. Changing the
        // stored form would break existing rows. The reader sees `test_date` in their language.
        setSatTargetDates(dates.map((d) => ({ value: d.label, label: d.label, testDate: d.test_date })));
      } catch {
        if (!cancelled) setSatTargetDates([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (totalSteps < 1) return;
    const next = Math.min(Math.max(toAssignmentZeroStep(currentStep), 1), totalSteps);
    if (next !== currentStep) {
      setCurrentStep(next);
    }
  }, [currentStep, totalSteps]);

  // Check status and load draft on mount
  useEffect(() => {
    checkStatusAndLoadDraft();
  }, [user?.special_group_only_student]);

  // Helper function to compute previous_sat_score from structured fields
  const computePreviousSatScore = () => {
    if (formData.has_passed_sat_before && formData.previous_sat_month && formData.previous_sat_year) {
      const parts = [`${formData.previous_sat_month} ${formData.previous_sat_year}`];
      const scores = [];
      if (formData.previous_sat_math) scores.push(`Math ${formData.previous_sat_math}`);
      if (formData.previous_sat_verbal) scores.push(`Verbal ${formData.previous_sat_verbal}`);
      if (scores.length > 0) {
        return `${parts[0]} - ${scores.join(', ')}`;
      }
      return parts[0];
    }
    return '';
  };

  // Helper function to compute bluebook_practice_test_5_score from structured fields
  const computeBluebookScore = () => {
    const scores = [];
    if (formData.bluebook_math) scores.push(`Math ${formData.bluebook_math}`);
    if (formData.bluebook_verbal) scores.push(`Verbal ${formData.bluebook_verbal}`);
    return scores.join(', ');
  };

  // Helper function to compute previous_ielts_score from structured fields
  const computePreviousIeltsScore = () => {
    if (formData.has_passed_ielts_before && formData.previous_ielts_overall) {
      let result = `Overall ${formData.previous_ielts_overall}`;
      const parts = [];
      if (formData.previous_ielts_listening) parts.push(`L:${formData.previous_ielts_listening}`);
      if (formData.previous_ielts_reading) parts.push(`R:${formData.previous_ielts_reading}`);
      if (formData.previous_ielts_writing) parts.push(`W:${formData.previous_ielts_writing}`);
      if (formData.previous_ielts_speaking) parts.push(`S:${formData.previous_ielts_speaking}`);
      if (parts.length > 0) {
        result += ` - ${parts.join(' ')}`;
      }
      return result;
    }
    return '';
  };

  // Auto-save effect with debounce
  const saveProgress = useCallback(async () => {
    const currentData = JSON.stringify(formData);
    if (currentData === lastSavedDataRef.current) return;

    setSaveStatus('saving');
    try {
      // Compute previous_sat_score from structured fields
      const computedPreviousSatScore = computePreviousSatScore();
      // Compute bluebook_practice_test_5_score from structured fields
      const computedBluebookScore = computeBluebookScore();
      // Compute previous_ielts_score from structured fields
      const computedPreviousIeltsScore = computePreviousIeltsScore();
      
      // Convert null values to undefined for API compatibility
      const dataToSave = {
        ...formData,
        previous_sat_score: computedPreviousSatScore || formData.previous_sat_score,
        bluebook_practice_test_5_score: computedBluebookScore || formData.bluebook_practice_test_5_score,
        previous_ielts_score: computedPreviousIeltsScore || formData.previous_ielts_score,
        last_saved_step: Math.min(
          Math.max(toAssignmentZeroStep(currentStep), 1),
          Math.max(1, totalSteps),
        ),
        // SAT fields
        grammar_punctuation: formData.grammar_punctuation ?? undefined,
        grammar_noun_clauses: formData.grammar_noun_clauses ?? undefined,
        grammar_relative_clauses: formData.grammar_relative_clauses ?? undefined,
        grammar_verb_forms: formData.grammar_verb_forms ?? undefined,
        grammar_comparisons: formData.grammar_comparisons ?? undefined,
        grammar_transitions: formData.grammar_transitions ?? undefined,
        grammar_synthesis: formData.grammar_synthesis ?? undefined,
        reading_word_in_context: formData.reading_word_in_context ?? undefined,
        reading_text_structure: formData.reading_text_structure ?? undefined,
        reading_cross_text: formData.reading_cross_text ?? undefined,
        reading_central_ideas: formData.reading_central_ideas ?? undefined,
        reading_inferences: formData.reading_inferences ?? undefined,
        passages_literary: formData.passages_literary ?? undefined,
        passages_social_science: formData.passages_social_science ?? undefined,
        passages_humanities: formData.passages_humanities ?? undefined,
        passages_science: formData.passages_science ?? undefined,
        passages_poetry: formData.passages_poetry ?? undefined,
        // IELTS fields
        ielts_listening_main_idea: formData.ielts_listening_main_idea ?? undefined,
        ielts_listening_details: formData.ielts_listening_details ?? undefined,
        ielts_listening_opinion: formData.ielts_listening_opinion ?? undefined,
        ielts_listening_accents: formData.ielts_listening_accents ?? undefined,
        ielts_reading_skimming: formData.ielts_reading_skimming ?? undefined,
        ielts_reading_scanning: formData.ielts_reading_scanning ?? undefined,
        ielts_reading_vocabulary: formData.ielts_reading_vocabulary ?? undefined,
        ielts_reading_inference: formData.ielts_reading_inference ?? undefined,
        ielts_reading_matching: formData.ielts_reading_matching ?? undefined,
        ielts_writing_task1_graphs: formData.ielts_writing_task1_graphs ?? undefined,
        ielts_writing_task1_process: formData.ielts_writing_task1_process ?? undefined,
        ielts_writing_task2_structure: formData.ielts_writing_task2_structure ?? undefined,
        ielts_writing_task2_arguments: formData.ielts_writing_task2_arguments ?? undefined,
        ielts_writing_grammar: formData.ielts_writing_grammar ?? undefined,
        ielts_writing_vocabulary: formData.ielts_writing_vocabulary ?? undefined,
        ielts_speaking_fluency: formData.ielts_speaking_fluency ?? undefined,
        ielts_speaking_vocabulary: formData.ielts_speaking_vocabulary ?? undefined,
        ielts_speaking_grammar: formData.ielts_speaking_grammar ?? undefined,
        ielts_speaking_pronunciation: formData.ielts_speaking_pronunciation ?? undefined,
        ielts_speaking_part2: formData.ielts_speaking_part2 ?? undefined,
        ielts_speaking_part3: formData.ielts_speaking_part3 ?? undefined,
      };
      await apiClient.saveAssignmentZeroProgress(dataToSave);
      lastSavedDataRef.current = currentData;
      setSaveStatus('saved');
      
      // Hide "saved" indicator after 2 seconds
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    } catch (error) {
      console.error('Failed to save progress:', error);
      setSaveStatus('error');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  }, [formData, currentStep, totalSteps]);

  // Debounced auto-save
  useEffect(() => {
    if (loading || alreadyCompleted) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProgress();
    }, 1500); // 1.5 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, saveProgress, loading, alreadyCompleted]);

  const checkStatusAndLoadDraft = async () => {
    try {
      if (user?.special_group_only_student) {
        navigate('/dashboard', { replace: true });
        return;
      }

      const status = await apiClient.getAssignmentZeroStatus();

      if (status.special_group_exempt) {
        navigate('/dashboard', { replace: true });
        return;
      }

      // Set user groups from status
      if (status.user_groups) {
        setUserGroups(status.user_groups);
      }
      setGroupsLoaded(true);
      
      if (status.completed) {
        setAlreadyCompleted(true);
        setLoading(false);
        return;
      }

      // Try to load existing draft
      if (status.has_draft) {
        try {
          const submission = await apiClient.getMyAssignmentZeroSubmission();
          // Parse previous_sat_score into structured fields if it exists
          let prevMonth = '';
          let prevYear = '';
          let prevVerbal = '';
          let prevMath = '';
          if (submission.previous_sat_score) {
            // Try to parse "October 2024 - Math 650, Verbal 550" format
            const match = submission.previous_sat_score.match(/(\w+)\s+(\d{4})\s*-?\s*(?:Math\s*(\d+))?,?\s*(?:Verbal\s*(\d+))?/i);
            if (match) {
              prevMonth = match[1] || '';
              prevYear = match[2] || '';
              prevMath = match[3] || '';
              prevVerbal = match[4] || '';
            }
          }
          // Parse bluebook_practice_test_5_score into structured fields if it exists
          let bluebookVerbal = '';
          let bluebookMath = '';
          if (submission.bluebook_practice_test_5_score) {
            // Try to parse "Math 500, Verbal 560" format
            const mathMatch = submission.bluebook_practice_test_5_score.match(/Math\s*(\d+)/i);
            const verbalMatch = submission.bluebook_practice_test_5_score.match(/Verbal\s*(\d+)/i);
            if (mathMatch) bluebookMath = mathMatch[1] || '';
            if (verbalMatch) bluebookVerbal = verbalMatch[1] || '';
          }
          // Parse previous_ielts_score into structured fields if it exists
          let prevIeltsListening = '';
          let prevIeltsReading = '';
          let prevIeltsWriting = '';
          let prevIeltsSpeaking = '';
          let prevIeltsOverall = '';
          if (submission.previous_ielts_score) {
            // Try to parse "Overall 6.5 - L:7 R:6.5 W:6 S:6.5" format
            const overallMatch = submission.previous_ielts_score.match(/Overall\s*([\d.]+)/i);
            const listeningMatch = submission.previous_ielts_score.match(/L:\s*([\d.]+)/i);
            const readingMatch = submission.previous_ielts_score.match(/R:\s*([\d.]+)/i);
            const writingMatch = submission.previous_ielts_score.match(/W:\s*([\d.]+)/i);
            const speakingMatch = submission.previous_ielts_score.match(/S:\s*([\d.]+)/i);
            if (overallMatch) prevIeltsOverall = overallMatch[1] || '';
            if (listeningMatch) prevIeltsListening = listeningMatch[1] || '';
            if (readingMatch) prevIeltsReading = readingMatch[1] || '';
            if (writingMatch) prevIeltsWriting = writingMatch[1] || '';
            if (speakingMatch) prevIeltsSpeaking = speakingMatch[1] || '';
          }
          setFormData({
            full_name: submission.full_name || '',
            phone_number: submission.phone_number || '',
            parent_phone_number: submission.parent_phone_number || '',
            telegram_id: submission.telegram_id || '',
            email: submission.email || '',
            college_board_email: submission.college_board_email || '',
            // Never prefilled: the server no longer sends the plaintext (G9 a′).
            // Leaving it blank on save/submit keeps whatever is already stored.
            college_board_password: '',
            birthday_date: submission.birthday_date || '',
            city: submission.city || '',
            school_type: submission.school_type || '',
            group_name: submission.group_name || '',
            sat_target_date: submission.sat_target_date || '',
            has_passed_sat_before: submission.has_passed_sat_before || false,
            previous_sat_score: submission.previous_sat_score || '',
            previous_sat_month: prevMonth,
            previous_sat_year: prevYear,
            previous_sat_verbal: prevVerbal,
            previous_sat_math: prevMath,
            recent_practice_test_score: submission.recent_practice_test_score || '',
            bluebook_practice_test_5_score: submission.bluebook_practice_test_5_score || '',
            bluebook_verbal: bluebookVerbal,
            bluebook_math: bluebookMath,
            screenshot_url: submission.screenshot_url || '',
            grammar_punctuation: submission.grammar_punctuation,
            grammar_noun_clauses: submission.grammar_noun_clauses,
            grammar_relative_clauses: submission.grammar_relative_clauses,
            grammar_verb_forms: submission.grammar_verb_forms,
            grammar_comparisons: submission.grammar_comparisons,
            grammar_transitions: submission.grammar_transitions,
            grammar_synthesis: submission.grammar_synthesis,
            reading_word_in_context: submission.reading_word_in_context,
            reading_text_structure: submission.reading_text_structure,
            reading_cross_text: submission.reading_cross_text,
            reading_central_ideas: submission.reading_central_ideas,
            reading_inferences: submission.reading_inferences,
            passages_literary: submission.passages_literary,
            passages_social_science: submission.passages_social_science,
            passages_humanities: submission.passages_humanities,
            passages_science: submission.passages_science,
            passages_poetry: submission.passages_poetry,
            math_topics: normalizeStringArray(submission.math_topics),
            // IELTS fields
            ielts_target_date: submission.ielts_target_date || '',
            has_passed_ielts_before: submission.has_passed_ielts_before || false,
            previous_ielts_score: submission.previous_ielts_score || '',
            previous_ielts_listening: prevIeltsListening,
            previous_ielts_reading: prevIeltsReading,
            previous_ielts_writing: prevIeltsWriting,
            previous_ielts_speaking: prevIeltsSpeaking,
            previous_ielts_overall: prevIeltsOverall,
            ielts_target_score: submission.ielts_target_score || '',
            ielts_listening_main_idea: submission.ielts_listening_main_idea,
            ielts_listening_details: submission.ielts_listening_details,
            ielts_listening_opinion: submission.ielts_listening_opinion,
            ielts_listening_accents: submission.ielts_listening_accents,
            ielts_reading_skimming: submission.ielts_reading_skimming,
            ielts_reading_scanning: submission.ielts_reading_scanning,
            ielts_reading_vocabulary: submission.ielts_reading_vocabulary,
            ielts_reading_inference: submission.ielts_reading_inference,
            ielts_reading_matching: submission.ielts_reading_matching,
            ielts_writing_task1_graphs: submission.ielts_writing_task1_graphs,
            ielts_writing_task1_process: submission.ielts_writing_task1_process,
            ielts_writing_task2_structure: submission.ielts_writing_task2_structure,
            ielts_writing_task2_arguments: submission.ielts_writing_task2_arguments,
            ielts_writing_grammar: submission.ielts_writing_grammar,
            ielts_writing_vocabulary: submission.ielts_writing_vocabulary,
            ielts_speaking_fluency: submission.ielts_speaking_fluency,
            ielts_speaking_vocabulary: submission.ielts_speaking_vocabulary,
            ielts_speaking_grammar: submission.ielts_speaking_grammar,
            ielts_speaking_pronunciation: submission.ielts_speaking_pronunciation,
            ielts_speaking_part2: submission.ielts_speaking_part2,
            ielts_speaking_part3: submission.ielts_speaking_part3,
            ielts_weak_topics: normalizeStringArray(submission.ielts_weak_topics),
            additional_comments:
              typeof submission.additional_comments === 'string'
                ? submission.additional_comments
                : '',
          });
          setHasCollegeBoardPassword(!!submission.has_college_board_password);
          lastSavedDataRef.current = JSON.stringify(submission);
          if (status.last_saved_step != null && status.last_saved_step !== '') {
            setCurrentStep(toAssignmentZeroStep(status.last_saved_step));
          }
        } catch (error) {
          console.error('Failed to load draft:', error);
        }
      }
    } catch (error) {
      console.error('Failed to check status:', error);
      setGroupsLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean | number | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleMathTopicToggle = (topic: string) => {
    setFormData((prev) => {
      const list = Array.isArray(prev.math_topics)
        ? prev.math_topics
        : normalizeStringArray(prev.math_topics);
      return {
        ...prev,
        math_topics: list.includes(topic)
          ? list.filter((t) => t !== topic)
          : [...list, topic],
      };
    });
  };

  const handleIeltsWeakTopicToggle = (topic: string) => {
    setFormData((prev) => {
      const list = Array.isArray(prev.ielts_weak_topics)
        ? prev.ielts_weak_topics
        : normalizeStringArray(prev.ielts_weak_topics);
      return {
        ...prev,
        ielts_weak_topics: list.includes(topic)
          ? list.filter((t) => t !== topic)
          : [...list, topic],
      };
    });
  };

  const compressImageIfNeeded = async (file: File): Promise<File> => {
    if (file.type === 'image/gif') return file;
    if (!file.type.startsWith('image/')) return file;

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size <= maxSizeBytes) return file;

    const imageUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to decode image'));
        image.src = imageUrl;
      });

      const maxDimension = 1920;
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = outputType === 'image/jpeg' ? 0.82 : undefined;

      const compressedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), outputType, quality);
      });

      if (!compressedBlob || compressedBlob.size >= file.size) return file;

      const compressedName = file.name.replace(/\.[^.]+$/, outputType === 'image/png' ? '.png' : '.jpg');
      return new File([compressedBlob], compressedName, { type: outputType });
    } catch {
      return file;
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (Safari/iOS often report empty file.type; rely on extension in that case)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const ext = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
    const extOk = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    const typeOk =
      allowedTypes.includes(file.type) ||
      ((file.type === '' || file.type === 'application/octet-stream') && extOk);
    if (!typeOk) {
      toast(t('studentHome.assignmentZero.toast.imageType'), 'error');
      e.target.value = '';
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast(t('studentHome.assignmentZero.toast.fileTooBig'), 'error');
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    try {
      const fileToUpload = await compressImageIfNeeded(file);
      const result = await apiClient.uploadAssignmentZeroScreenshot(fileToUpload);
      handleInputChange('screenshot_url', result.url);
      toast(t('studentHome.assignmentZero.toast.screenshotUploaded'), 'success');
    } catch (error) {
      console.error('Upload failed:', error);
      const msg = error instanceof Error ? error.message : t('studentHome.assignmentZero.toast.uploadFailed');
      toast(msg, 'error');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    const stepId = DYNAMIC_STEPS[step - 1]?.id;
    const required = t('studentHome.assignmentZero.required');

    // Validate based on step ID instead of step number
    if (stepId === 'personal') {
      if (!formData.full_name.trim()) newErrors.full_name = required;
      if (!formData.phone_number.trim()) newErrors.phone_number = required;
      if (!formData.parent_phone_number.trim()) newErrors.parent_phone_number = required;
      if (!formData.telegram_id.trim()) newErrors.telegram_id = required;
      if (!formData.email.trim()) newErrors.email = required;
    } else if (stepId === 'account') {
      if (showSAT && !formData.college_board_email.trim()) newErrors.college_board_email = required;
      if (isCollegeBoardPasswordRequired(showSAT, hasCollegeBoardPassword) && !formData.college_board_password.trim()) {
        newErrors.college_board_password = required;
      }
      if (!formData.birthday_date) newErrors.birthday_date = required;
      if (!formData.city.trim()) newErrors.city = required;
    } else if (stepId === 'education') {
      if (!formData.school_type) newErrors.school_type = required;
      if (!formData.group_name.trim()) newErrors.group_name = required;
      // SAT target date only required if user is in SAT group
      if (showSAT && !formData.sat_target_date) newErrors.sat_target_date = required;
      // IELTS target date only required if user is in IELTS group
      if (showIELTS && !formData.ielts_target_date) newErrors.ielts_target_date = required;
    }
 else if (stepId === 'sat_results') {
      if (!formData.recent_practice_test_score.trim()) newErrors.recent_practice_test_score = required;
      if (!formData.bluebook_verbal.trim()) newErrors.bluebook_verbal = required;
      if (!formData.bluebook_math.trim()) newErrors.bluebook_math = required;
      if (!formData.screenshot_url) newErrors.screenshot_url = required;
    }
    // All other steps (assessments) are optional, no required validation

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(displayStep)) return;
    setCurrentStep((prev) => {
      const step = Math.min(Math.max(toAssignmentZeroStep(prev), 1), totalSteps);
      return Math.min(step + 1, totalSteps);
    });
  };

  const handleBack = () => {
    setCurrentStep((prev) => {
      const step = Math.min(Math.max(toAssignmentZeroStep(prev), 1), totalSteps);
      return Math.max(step - 1, 1);
    });
  };

  const handleSubmit = async () => {
    // Validate all required steps based on step IDs
    const requiredStepIds = ['personal', 'account', 'education'];
    if (showSAT) requiredStepIds.push('sat_results');
    
    for (let i = 0; i < DYNAMIC_STEPS.length; i++) {
      const stepId = DYNAMIC_STEPS[i].id;
      if (requiredStepIds.includes(stepId)) {
        if (!validateStep(i + 1)) {
          setCurrentStep(i + 1);
          toast(t('studentHome.assignmentZero.toast.completeRequired'), 'error');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Compute previous_sat_score from structured fields
      const computedPreviousSatScore = computePreviousSatScore();
      // Compute bluebook_practice_test_5_score from structured fields
      const computedBluebookScore = computeBluebookScore();
      // Compute previous_ielts_score from structured fields  
      const computedPreviousIeltsScore = computePreviousIeltsScore();
      
      await apiClient.submitAssignmentZero({
        ...formData,
        previous_sat_score: computedPreviousSatScore || formData.previous_sat_score || undefined,
        bluebook_practice_test_5_score: computedBluebookScore || formData.bluebook_practice_test_5_score,
        previous_ielts_score: computedPreviousIeltsScore || formData.previous_ielts_score || undefined,
        // SAT fields
        grammar_punctuation: formData.grammar_punctuation ?? undefined,
        grammar_noun_clauses: formData.grammar_noun_clauses ?? undefined,
        grammar_relative_clauses: formData.grammar_relative_clauses ?? undefined,
        grammar_verb_forms: formData.grammar_verb_forms ?? undefined,
        grammar_comparisons: formData.grammar_comparisons ?? undefined,
        grammar_transitions: formData.grammar_transitions ?? undefined,
        grammar_synthesis: formData.grammar_synthesis ?? undefined,
        reading_word_in_context: formData.reading_word_in_context ?? undefined,
        reading_text_structure: formData.reading_text_structure ?? undefined,
        reading_cross_text: formData.reading_cross_text ?? undefined,
        reading_central_ideas: formData.reading_central_ideas ?? undefined,
        reading_inferences: formData.reading_inferences ?? undefined,
        passages_literary: formData.passages_literary ?? undefined,
        passages_social_science: formData.passages_social_science ?? undefined,
        passages_humanities: formData.passages_humanities ?? undefined,
        passages_science: formData.passages_science ?? undefined,
        passages_poetry: formData.passages_poetry ?? undefined,
        math_topics: formData.math_topics.length > 0 ? formData.math_topics : undefined,
        // IELTS fields
        ielts_listening_main_idea: formData.ielts_listening_main_idea ?? undefined,
        ielts_listening_details: formData.ielts_listening_details ?? undefined,
        ielts_listening_opinion: formData.ielts_listening_opinion ?? undefined,
        ielts_listening_accents: formData.ielts_listening_accents ?? undefined,
        ielts_reading_skimming: formData.ielts_reading_skimming ?? undefined,
        ielts_reading_scanning: formData.ielts_reading_scanning ?? undefined,
        ielts_reading_vocabulary: formData.ielts_reading_vocabulary ?? undefined,
        ielts_reading_inference: formData.ielts_reading_inference ?? undefined,
        ielts_reading_matching: formData.ielts_reading_matching ?? undefined,
        ielts_writing_task1_graphs: formData.ielts_writing_task1_graphs ?? undefined,
        ielts_writing_task1_process: formData.ielts_writing_task1_process ?? undefined,
        ielts_writing_task2_structure: formData.ielts_writing_task2_structure ?? undefined,
        ielts_writing_task2_arguments: formData.ielts_writing_task2_arguments ?? undefined,
        ielts_writing_grammar: formData.ielts_writing_grammar ?? undefined,
        ielts_writing_vocabulary: formData.ielts_writing_vocabulary ?? undefined,
        ielts_speaking_fluency: formData.ielts_speaking_fluency ?? undefined,
        ielts_speaking_vocabulary: formData.ielts_speaking_vocabulary ?? undefined,
        ielts_speaking_grammar: formData.ielts_speaking_grammar ?? undefined,
        ielts_speaking_pronunciation: formData.ielts_speaking_pronunciation ?? undefined,
        ielts_speaking_part2: formData.ielts_speaking_part2 ?? undefined,
        ielts_speaking_part3: formData.ielts_speaking_part3 ?? undefined,
        ielts_weak_topics: formData.ielts_weak_topics.length > 0 ? formData.ielts_weak_topics : undefined,
        additional_comments: formData.additional_comments || undefined,
      });

      // Refresh user data to get updated assignment_zero_completed status
      await refreshUser();

      toast(t('studentHome.assignmentZero.toast.submitted'), 'success');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Submit failed:', error);
      toast(error.message || t('studentHome.assignmentZero.toast.submitFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-background dark:to-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-background dark:to-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">{t('studentHome.assignmentZero.done.title')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('studentHome.assignmentZero.done.body')}
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              {t('studentHome.assignmentZero.done.goToDashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/40 dark:from-background dark:to-background py-8 px-4">
      <SavingIndicator status={saveStatus} />
      
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 rounded-2xl border border-slate-200/70 dark:border-border bg-white/80 dark:bg-card/80 backdrop-blur p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">{t('studentHome.assignmentZero.title')}</h1>
              <p className="text-base text-muted-foreground">{t('studentHome.assignmentZero.subtitle')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('studentHome.assignmentZero.beHonest')}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => logout()}
              className="text-muted-foreground hover:text-red-600 hover:border-red-200 dark:hover:text-red-400 dark:hover:border-red-900 transition-colors"
            >
              {t('studentHome.assignmentZero.logout')}
            </Button>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
            <span>{t('studentHome.assignmentZero.stepOf', { step: displayStep, total: totalSteps })}</span>
            <span>{t('studentHome.assignmentZero.percentDone', { percent: Math.round((displayStep / Math.max(1, totalSteps)) * 100) })}</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-200 dark:bg-secondary rounded-full">
            <div
              className="h-full bg-brand-solid rounded-full transition-all duration-300"
              style={{ width: `${(displayStep / Math.max(1, totalSteps)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Pills */}
        <div className="mb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {DYNAMIC_STEPS.map((step, index) => {
              const stepNumber = index + 1;
              return (
                <button
                  key={step.id}
                  onClick={() => stepNumber <= displayStep && setCurrentStep(stepNumber)}
                  disabled={stepNumber > displayStep}
                  className={`flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all ${
                    stepNumber === displayStep
                      ? 'bg-brand-solid text-brand-solid-foreground border-brand dark:bg-brand-surface dark:text-brand-subtle-foreground dark:border-brand-border'
                      : stepNumber < displayStep
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/40'
                      : 'bg-card text-muted-foreground border-border cursor-not-allowed'
                  }`}
                  title={step.title}
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 text-[11px] font-semibold">
                    {stepNumber < displayStep ? <Check className="h-3 w-3" strokeWidth={3} aria-label={t('studentHome.assignmentZero.stepDone')} /> : stepNumber}
                  </span>
                  <span className="whitespace-nowrap">{step.title}</span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {t('studentHome.assignmentZero.stepOfTitled', { step: displayStep, total: totalSteps, title: DYNAMIC_STEPS[displayStep - 1]?.title ?? '' })}
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-sm rounded-2xl border border-slate-200/80 dark:border-border">
          <CardHeader>
            <CardTitle>{DYNAMIC_STEPS[displayStep - 1]?.title}</CardTitle>
            <CardDescription>
              {currentStepId === 'personal' && t('studentHome.assignmentZero.about.personal')}
              {currentStepId === 'account' && (showSAT ? t('studentHome.assignmentZero.about.accountSat') : t('studentHome.assignmentZero.about.account'))}
              {currentStepId === 'education' && (showSAT || showIELTS ? t('studentHome.assignmentZero.about.educationGoals') : t('studentHome.assignmentZero.about.education'))}
              {currentStepId === 'sat_results' && t('studentHome.assignmentZero.about.satResults')}
              {currentStepId === 'sat_grammar' && t('studentHome.assignmentZero.about.grammar')}
              {currentStepId === 'sat_reading' && t('studentHome.assignmentZero.about.reading')}
              {currentStepId === 'sat_passages' && t('studentHome.assignmentZero.about.passages')}
              {currentStepId === 'sat_math' && t('studentHome.assignmentZero.about.math')}
              {currentStepId === 'ielts_listening' && t('studentHome.assignmentZero.about.ieltsListening')}
              {currentStepId === 'ielts_reading' && t('studentHome.assignmentZero.about.ieltsReading')}
              {currentStepId === 'ielts_writing' && t('studentHome.assignmentZero.about.ieltsWriting')}
              {currentStepId === 'ielts_speaking' && t('studentHome.assignmentZero.about.ieltsSpeaking')}
              {currentStepId === 'ielts_topics' && t('studentHome.assignmentZero.about.ieltsTopics')}
              {currentStepId === 'comments' && t('studentHome.assignmentZero.about.comments')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step: Personal Information */}
            {currentStepId === 'personal' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name">{t('studentHome.assignmentZero.field.fullName')} *</Label>
                  <Input
                    id="full_name"
                    placeholder={t('studentHome.assignmentZero.field.fullNamePlaceholder')}
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className={errors.full_name ? 'border-red-500' : ''}
                  />
                  {errors.full_name && <p className="text-sm text-red-500 dark:text-red-400">{errors.full_name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">{t('studentHome.assignmentZero.field.phone')} *</Label>
                  <Input
                    id="phone_number"
                    placeholder={PHONE_PLACEHOLDER}
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    className={errors.phone_number ? 'border-red-500' : ''}
                  />
                  {errors.phone_number && <p className="text-sm text-red-500 dark:text-red-400">{errors.phone_number}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent_phone_number">{t('studentHome.assignmentZero.field.parentPhone')} *</Label>
                  <Input
                    id="parent_phone_number"
                    placeholder={PHONE_PLACEHOLDER}
                    value={formData.parent_phone_number}
                    onChange={(e) => handleInputChange('parent_phone_number', e.target.value)}
                    className={errors.parent_phone_number ? 'border-red-500' : ''}
                  />
                  {errors.parent_phone_number && (
                    <p className="text-sm text-red-500 dark:text-red-400">{errors.parent_phone_number}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram_id">{t('studentHome.assignmentZero.field.telegram')} *</Label>
                  <Input
                    id="telegram_id"
                    placeholder={t('studentHome.assignmentZero.field.telegramPlaceholder')}
                    value={formData.telegram_id}
                    onChange={(e) => handleInputChange('telegram_id', e.target.value)}
                    className={errors.telegram_id ? 'border-red-500' : ''}
                  />
                  {errors.telegram_id && <p className="text-sm text-red-500 dark:text-red-400">{errors.telegram_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('studentHome.assignmentZero.field.email')} *</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('studentHome.assignmentZero.field.emailHint')}
                  </p>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('studentHome.assignmentZero.field.emailPlaceholder')}
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-sm text-red-500 dark:text-red-400">{errors.email}</p>}
                </div>
              </>
            )}

            {/* Step: Account Information */}
            {currentStepId === 'account' && (
              <>
                {showSAT && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="college_board_email">{t('studentHome.assignmentZero.field.cbEmail')} *</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('studentHome.assignmentZero.field.cbEmailHint')}
                      </p>
                      <Input
                        id="college_board_email"
                        type="email"
                        placeholder={t('studentHome.assignmentZero.field.cbEmailPlaceholder')}
                        value={formData.college_board_email}
                        onChange={(e) => handleInputChange('college_board_email', e.target.value)}
                        className={errors.college_board_email ? 'border-red-500' : ''}
                      />
                      {errors.college_board_email && (
                        <p className="text-sm text-red-500 dark:text-red-400">{errors.college_board_email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="college_board_password">
                        {t('studentHome.assignmentZero.field.cbPassword')}{hasCollegeBoardPassword ? '' : ' *'}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('studentHome.assignmentZero.field.cbPasswordHint')}
                      </p>
                      {hasCollegeBoardPassword && (
                        <p className="text-xs text-brand">
                          {t('studentHome.assignmentZero.field.cbPasswordSaved')}
                        </p>
                      )}
                      <Input
                        id="college_board_password"
                        type="password"
                        placeholder={hasCollegeBoardPassword ? t('studentHome.assignmentZero.field.cbPasswordKeep') : t('studentHome.assignmentZero.field.cbPasswordPlaceholder')}
                        value={formData.college_board_password}
                        onChange={(e) => handleInputChange('college_board_password', e.target.value)}
                        className={errors.college_board_password ? 'border-red-500' : ''}
                      />
                      {errors.college_board_password && (
                        <p className="text-sm text-red-500 dark:text-red-400">{errors.college_board_password}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="birthday_date">{t('studentHome.assignmentZero.field.birthday')} *</Label>
                  <Input
                    id="birthday_date"
                    type="date"
                    value={formData.birthday_date}
                    onChange={(e) => handleInputChange('birthday_date', e.target.value)}
                    className={errors.birthday_date ? 'border-red-500' : ''}
                  />
                  {errors.birthday_date && <p className="text-sm text-red-500 dark:text-red-400">{errors.birthday_date}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">{t('studentHome.assignmentZero.field.city')} *</Label>
                  <Input
                    id="city"
                    placeholder={t('studentHome.assignmentZero.field.cityPlaceholder')}
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={errors.city ? 'border-red-500' : ''}
                  />
                  {errors.city && <p className="text-sm text-red-500 dark:text-red-400">{errors.city}</p>}
                </div>
              </>
            )}

            {/* Step: Education & Goals */}
            {currentStepId === 'education' && (
              <>
                <div className="space-y-2">
                  <Label>{t('studentHome.assignmentZero.school.question')} *</Label>
                  <Select
                    value={formData.school_type}
                    onValueChange={(value) => handleInputChange('school_type', value)}
                  >
                    <SelectTrigger className={errors.school_type ? 'border-red-500' : ''}>
                      <SelectValue placeholder={t('studentHome.assignmentZero.school.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHOOL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {t(type.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.school_type && <p className="text-sm text-red-500 dark:text-red-400">{errors.school_type}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group_name">{t('studentHome.assignmentZero.group.name')} *</Label>
                  <Input
                    id="group_name"
                    placeholder={t('studentHome.assignmentZero.group.placeholder')}
                    value={formData.group_name}
                    onChange={(e) => handleInputChange('group_name', e.target.value)}
                    className={errors.group_name ? 'border-red-500' : ''}
                  />
                  {errors.group_name && <p className="text-sm text-red-500 dark:text-red-400">{errors.group_name}</p>}
                </div>

                {/* SAT-specific questions - only show if user is in SAT group */}
                {showSAT && (
                  <>
                    <div className="space-y-2">
                      <Label>{t('studentHome.assignmentZero.sat.when')} *</Label>
                      <Select
                        value={formData.sat_target_date}
                        onValueChange={(value) => handleInputChange('sat_target_date', value)}
                      >
                        <SelectTrigger className={errors.sat_target_date ? 'border-red-500' : ''}>
                          <SelectValue placeholder={t('studentHome.assignmentZero.selectTargetDate')} />
                        </SelectTrigger>
                        <SelectContent>
                          {satTargetDates.map((date) => (
                            <SelectItem key={date.value} value={date.value}>
                              {formatDate(date.testDate, { day: 'numeric', month: 'long', year: 'numeric' }, locale) || date.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.sat_target_date && <p className="text-sm text-red-500 dark:text-red-400">{errors.sat_target_date}</p>}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has_passed_sat"
                        checked={formData.has_passed_sat_before}
                        onCheckedChange={(checked) =>
                          handleInputChange('has_passed_sat_before', checked === true)
                        }
                      />
                      <Label htmlFor="has_passed_sat" className="cursor-pointer">
                        {t('studentHome.assignmentZero.sat.passedBefore')}
                      </Label>
                    </div>

                    {formData.has_passed_sat_before && (
                      <div className="space-y-4 p-4 bg-muted rounded-lg border dark:border-border">
                        <Label className="font-medium">{t('studentHome.assignmentZero.sat.previousScore')}</Label>
                        
                        {/* Month and Year Selection */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="previous_sat_month">{t('studentHome.assignmentZero.month')} *</Label>
                            <Select
                              value={formData.previous_sat_month}
                              onValueChange={(value) => handleInputChange('previous_sat_month', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('studentHome.assignmentZero.selectMonth')} />
                              </SelectTrigger>
                              <SelectContent>
                                {SAT_MONTHS.map((month, index) => (
                                  <SelectItem key={month.value} value={month.value}>
                                    {monthName(index, locale)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previous_sat_year">{t('studentHome.assignmentZero.year')} *</Label>
                            <Select
                              value={formData.previous_sat_year}
                              onValueChange={(value) => handleInputChange('previous_sat_year', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('studentHome.assignmentZero.selectYear')} />
                              </SelectTrigger>
                              <SelectContent>
                                {SAT_YEARS.map((year) => (
                                  <SelectItem key={year.value} value={year.value}>
                                    {year.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Verbal and Math Scores */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="previous_sat_verbal">{t('studentHome.assignmentZero.verbalScore')} *</Label>
                            <Input
                              id="previous_sat_verbal"
                              type="number"
                              min="200"
                              max="800"
                              placeholder="200-800"
                              value={formData.previous_sat_verbal}
                              onChange={(e) => handleInputChange('previous_sat_verbal', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previous_sat_math">{t('studentHome.assignmentZero.mathScore')} *</Label>
                            <Input
                              id="previous_sat_math"
                              type="number"
                              min="200"
                              max="800"
                              placeholder="200-800"
                              value={formData.previous_sat_math}
                              onChange={(e) => handleInputChange('previous_sat_math', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Show total score if both are entered */}
                        {formData.previous_sat_verbal && formData.previous_sat_math && (
                          <div className="text-sm text-muted-foreground bg-card p-2 rounded border dark:border-border">
                            {t('studentHome.assignmentZero.totalScore')} <span className="font-semibold">{Number(formData.previous_sat_verbal) + Number(formData.previous_sat_math)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* IELTS-specific questions in education step - only show if user is in IELTS group */}
                {showIELTS && (
                  <>
                    <div className="space-y-2">
                      <Label>{t('studentHome.assignmentZero.ielts.when')} *</Label>
                      <Select
                        value={formData.ielts_target_date}
                        onValueChange={(value) => handleInputChange('ielts_target_date', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('studentHome.assignmentZero.selectTargetDate')} />
                        </SelectTrigger>
                        <SelectContent>
                          {IELTS_TARGET_DATES.map((date, index) => (
                            <SelectItem key={date.value} value={date.value}>
                              {monthName(index, locale)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('studentHome.assignmentZero.ielts.target')}</Label>
                      <Select
                        value={formData.ielts_target_score}
                        onValueChange={(value) => handleInputChange('ielts_target_score', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('studentHome.assignmentZero.ielts.selectTarget')} />
                        </SelectTrigger>
                        <SelectContent>
                          {IELTS_TARGET_SCORES.map((score) => (
                            <SelectItem key={score.value} value={score.value}>
                              {score.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has_passed_ielts"
                        checked={formData.has_passed_ielts_before}
                        onCheckedChange={(checked) =>
                          handleInputChange('has_passed_ielts_before', checked === true)
                        }
                      />
                      <Label htmlFor="has_passed_ielts" className="cursor-pointer">
                        {t('studentHome.assignmentZero.ielts.passedBefore')}
                      </Label>
                    </div>

                    {formData.has_passed_ielts_before && (
                      <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <Label className="font-medium">{t('studentHome.assignmentZero.ielts.previousScores')}</Label>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="previous_ielts_listening">{t('studentHome.assignmentZero.section.listening')}</Label>
                            <Input
                              id="previous_ielts_listening"
                              type="number"
                              step="0.5"
                              min="0"
                              max="9"
                              placeholder="0-9"
                              value={formData.previous_ielts_listening}
                              onChange={(e) => handleInputChange('previous_ielts_listening', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previous_ielts_reading">{t('studentHome.assignmentZero.section.reading')}</Label>
                            <Input
                              id="previous_ielts_reading"
                              type="number"
                              step="0.5"
                              min="0"
                              max="9"
                              placeholder="0-9"
                              value={formData.previous_ielts_reading}
                              onChange={(e) => handleInputChange('previous_ielts_reading', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previous_ielts_writing">{t('studentHome.assignmentZero.section.writing')}</Label>
                            <Input
                              id="previous_ielts_writing"
                              type="number"
                              step="0.5"
                              min="0"
                              max="9"
                              placeholder="0-9"
                              value={formData.previous_ielts_writing}
                              onChange={(e) => handleInputChange('previous_ielts_writing', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previous_ielts_speaking">{t('studentHome.assignmentZero.section.speaking')}</Label>
                            <Input
                              id="previous_ielts_speaking"
                              type="number"
                              step="0.5"
                              min="0"
                              max="9"
                              placeholder="0-9"
                              value={formData.previous_ielts_speaking}
                              onChange={(e) => handleInputChange('previous_ielts_speaking', e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="previous_ielts_overall">{t('studentHome.assignmentZero.ielts.overall')}</Label>
                          <Input
                            id="previous_ielts_overall"
                            type="number"
                            step="0.5"
                            min="0"
                            max="9"
                            placeholder="0-9"
                            value={formData.previous_ielts_overall}
                            onChange={(e) => handleInputChange('previous_ielts_overall', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Step: SAT Results */}
            {currentStepId === 'sat_results' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="recent_practice_test_score">
                    {t('studentHome.assignmentZero.results.recent')} *
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('studentHome.assignmentZero.results.recentExample')}
                  </p>
                  <Textarea
                    id="recent_practice_test_score"
                    placeholder={t('studentHome.assignmentZero.results.recentPlaceholder')}
                    value={formData.recent_practice_test_score}
                    onChange={(e) => handleInputChange('recent_practice_test_score', e.target.value)}
                    className={errors.recent_practice_test_score ? 'border-red-500' : ''}
                  />
                  {errors.recent_practice_test_score && (
                    <p className="text-sm text-red-500 dark:text-red-400">{errors.recent_practice_test_score}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    {t('studentHome.assignmentZero.results.bluebook')} *
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="bluebook_verbal" className="text-sm text-muted-foreground">{t('studentHome.assignmentZero.verbalScore')}</Label>
                      <Input
                        id="bluebook_verbal"
                        type="number"
                        placeholder="200-800"
                        min="200"
                        max="800"
                        step="10"
                        value={formData.bluebook_verbal}
                        onChange={(e) => handleInputChange('bluebook_verbal', e.target.value)}
                        className={errors.bluebook_verbal ? 'border-red-500' : ''}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bluebook_math" className="text-sm text-muted-foreground">{t('studentHome.assignmentZero.mathScore')}</Label>
                      <Input
                        id="bluebook_math"
                        type="number"
                        placeholder="200-800"
                        min="200"
                        max="800"
                        step="10"
                        value={formData.bluebook_math}
                        onChange={(e) => handleInputChange('bluebook_math', e.target.value)}
                        className={errors.bluebook_math ? 'border-red-500' : ''}
                      />
                    </div>
                  </div>
                  {(errors.bluebook_verbal || errors.bluebook_math) && (
                    <p className="text-sm text-red-500 dark:text-red-400">{t('studentHome.assignmentZero.results.bothRequired')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('studentHome.assignmentZero.results.screenshot')} *</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('studentHome.assignmentZero.results.screenshotLimits')}
                  </p>

                  {formData.screenshot_url ? (
                    <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">{t('studentHome.assignmentZero.results.uploaded')}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleInputChange('screenshot_url', '')}
                      >
                        {t('studentHome.assignmentZero.results.uploadDifferent')}
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        errors.screenshot_url
                          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-300 dark:border-border hover:border-blue-400 dark:hover:border-brand'
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="screenshot-upload"
                        disabled={uploadingFile}
                      />
                      <label
                        htmlFor="screenshot-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {uploadingFile ? (
                          <>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                            <span className="text-muted-foreground">{t('studentHome.assignmentZero.results.uploading')}</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400 dark:text-muted-foreground" />
                            <span className="text-muted-foreground">{t('studentHome.assignmentZero.results.clickToUpload')}</span>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                  {errors.screenshot_url && (
                    <p className="text-sm text-red-500 dark:text-red-400">{errors.screenshot_url}</p>
                  )}
                </div>
              </>
            )}

            {/* Step: Grammar Assessment */}
            {currentStepId === 'sat_grammar' && (
              <>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium mb-1">{t('studentHome.assignmentZero.important')}</p>
                    <p>
                      {t('studentHome.assignmentZero.honestNote')}
                    </p>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('studentHome.assignmentZero.heading.grammar')}</h3>
                <div className="space-y-4">
                  {GRAMMAR_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={t(question.label)}
                      value={formData[question.key as keyof FormData] as number | null}
                      onChange={(value) => handleInputChange(question.key as keyof FormData, value)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Step: Reading Skills Assessment */}
            {currentStepId === 'sat_reading' && (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('studentHome.assignmentZero.heading.reading')}</h3>
                <div className="space-y-4">
                  {READING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={t(question.label)}
                      value={formData[question.key as keyof FormData] as number | null}
                      onChange={(value) => handleInputChange(question.key as keyof FormData, value)}
                    />
                  ))}
                </div>
              </>
            )}
            {/* Step: SAT Passage Types */}
            {currentStepId === 'sat_passages' && (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('studentHome.assignmentZero.heading.passages')}</h3>
                <div className="space-y-4">
                  {PASSAGES_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={t(question.label)}
                      value={formData[question.key as keyof FormData] as number | null}
                      onChange={(value) => handleInputChange(question.key as keyof FormData, value)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Step: Math Topics */}
            {currentStepId === 'sat_math' && (
              <>
                <div className="bg-brand-surface border border-brand-border rounded-lg p-4 mb-4">
                  <p className="text-sm text-brand-subtle-foreground">
                    <strong>{t('studentHome.assignmentZero.instructions')}</strong> {t('studentHome.assignmentZero.mathInstructions')}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {MATH_TOPICS.map(({ value: topic, label }) => (
                    <div key={topic} className="flex items-center space-x-3">
                      <Checkbox
                        id={`math-${topic}`}
                        checked={formData.math_topics.includes(topic)}
                        onCheckedChange={() => handleMathTopicToggle(topic)}
                      />
                      <Label htmlFor={`math-${topic}`} className="cursor-pointer text-sm">
                        {t(label)}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  {t('studentHome.assignmentZero.selectedTopics', { count: formData.math_topics.length })}
                </p>
              </>
            )}

            {/* IELTS Listening Assessment */}
            {currentStepId === 'ielts_listening' && (
              <>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium mb-1">{t('studentHome.assignmentZero.important')}</p>
                    <p>
                      {t('studentHome.assignmentZero.honestNote')}
                    </p>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-4">{t('studentHome.assignmentZero.heading.ieltsListening')}</h3>
                <div className="space-y-4">
                  {IELTS_LISTENING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={t(question.label)}
                      value={formData[question.key as keyof FormData] as number | null}
                      onChange={(value) => handleInputChange(question.key as keyof FormData, value)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* IELTS Reading Assessment */}
            {currentStepId === 'ielts_reading' && (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('studentHome.assignmentZero.heading.ieltsReading')}</h3>
                <div className="space-y-4">
                  {IELTS_READING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={t(question.label)}
                      value={formData[question.key as keyof FormData] as number | null}
                      onChange={(value) => handleInputChange(question.key as keyof FormData, value)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* IELTS Writing Assessment */}
            {currentStepId === 'ielts_writing' && (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('studentHome.assignmentZero.heading.ieltsWriting')}</h3>
                <div className="space-y-4">
                  {IELTS_WRITING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={t(question.label)}
                      value={formData[question.key as keyof FormData] as number | null}
                      onChange={(value) => handleInputChange(question.key as keyof FormData, value)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* IELTS Speaking Assessment */}
            {currentStepId === 'ielts_speaking' && (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('studentHome.assignmentZero.heading.ieltsSpeaking')}</h3>
                <div className="space-y-4">
                  {IELTS_SPEAKING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={t(question.label)}
                      value={formData[question.key as keyof FormData] as number | null}
                      onChange={(value) => handleInputChange(question.key as keyof FormData, value)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* IELTS Weak Topics */}
            {currentStepId === 'ielts_topics' && (
              <>
                <div className="bg-brand-surface border border-brand-border rounded-lg p-4 mb-4">
                  <p className="text-sm text-brand-subtle-foreground">
                    <strong>{t('studentHome.assignmentZero.instructions')}</strong> {t('studentHome.assignmentZero.ieltsInstructions')}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {IELTS_WEAK_TOPICS.map(({ value: topic, label }) => (
                    <div key={topic} className="flex items-center space-x-3">
                      <Checkbox
                        id={`ielts-${topic}`}
                        checked={formData.ielts_weak_topics.includes(topic)}
                        onCheckedChange={() => handleIeltsWeakTopicToggle(topic)}
                      />
                      <Label htmlFor={`ielts-${topic}`} className="text-sm font-normal cursor-pointer">
                        {t(label)}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  {t('studentHome.assignmentZero.selectedTopics', { count: formData.ielts_weak_topics.length })}
                </p>
              </>
            )}

            {/* Step: Additional Comments */}
            {currentStepId === 'comments' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="additional_comments">{t('studentHome.assignmentZero.comments.label')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('studentHome.assignmentZero.comments.hint')}
                  </p>
                  <Textarea
                    id="additional_comments"
                    placeholder={t('studentHome.assignmentZero.comments.placeholder')}
                    value={formData.additional_comments}
                    onChange={(e) => handleInputChange('additional_comments', e.target.value)}
                    rows={6}
                  />
                </div>

                {/* Important Notice */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium mb-1">{t('studentHome.assignmentZero.important')}</p>
                    <p>
                      {t('studentHome.assignmentZero.honestNote')}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4 border-t dark:border-border">
              {displayStep > 1 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('common.back')}
                </Button>
              ) : (
                <div />
              )}

              {displayStep < totalSteps ? (
                <Button type="button" onClick={handleNext}>
                  {t('studentHome.assignmentZero.next')} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t('studentHome.assignmentZero.submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {t('studentHome.assignmentZero.submit')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
