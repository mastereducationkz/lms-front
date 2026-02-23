import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import apiClient from '../services/api';
import { toast } from '../components/Toast.tsx';
import {
  User,
  Mail,
  GraduationCap,
  Target,
  Upload,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Send,
  BookOpen,
  PenTool,
  FileText,
  Calculator,
  MessageSquare,
  Cloud,
  CloudOff,
  Loader2,
  Headphones,
  Mic,
  Edit3,
  LogOut,
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

const SCHOOL_TYPES = [
  { value: 'NIS', label: 'Nazarbayev Intellectual Schools' },
  { value: 'RFMS', label: 'National Physics and Mathematics Schools' },
  { value: 'BIL', label: 'Bilim Innovation Lyceums' },
  { value: 'Private', label: 'Private school (частная)' },
  { value: 'Public', label: 'Public school (общеобразовательная)' },
];

const SAT_TARGET_DATES = [
  { value: 'October', label: 'October' },
  { value: 'November', label: 'November' },
  { value: 'December', label: 'December' },
  { value: 'March', label: 'March' },
  { value: 'May', label: 'May' },
];

const SAT_MONTHS = [
  { value: 'January', label: 'January' },
  { value: 'February', label: 'February' },
  { value: 'March', label: 'March' },
  { value: 'April', label: 'April' },
  { value: 'May', label: 'May' },
  { value: 'June', label: 'June' },
  { value: 'July', label: 'July' },
  { value: 'August', label: 'August' },
  { value: 'September', label: 'September' },
  { value: 'October', label: 'October' },
  { value: 'November', label: 'November' },
  { value: 'December', label: 'December' },
];

const SAT_YEARS = [
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' },
  { value: '2020', label: '2020' },
];

const GRAMMAR_QUESTIONS = [
  { key: 'grammar_punctuation', label: 'I feel confident in the following topic: Essential and Non-Essential Clauses. I can easily identify dependent clauses and apply punctuation rules.' },
  { key: 'grammar_noun_clauses', label: 'I feel confident in the following topic: Colons and Dashes. I understand all of the conditions for the use of colons and dashes.' },
  { key: 'grammar_relative_clauses', label: 'I feel confident in the following topic: Modifiers. I understand the dependence between Subject and Fragment.' },
  { key: 'grammar_verb_forms', label: 'I feel confident in the following topic: Tenses. I understand the difference between the use of different tenses. I can easily distinguish Past Perfect, Past Simple, Present Perfect, Present Simple, Present Continuous, Future Simple Tenses.' },
  { key: 'grammar_comparisons', label: 'I feel confident in the following topic: Parallel Structure. I can apply rules of parallel structures to the lists of nouns, verbs, etc.' },
  { key: 'grammar_transitions', label: 'I feel confident in the following topic: Transitions. I mostly understand the meaning of the 2 sentences and can easily identify the most suitable transition.' },
  { key: 'grammar_synthesis', label: 'I feel confident in the following topic: FANBOYS, Conjunctions, Strong Transitions. I understand how to connect sentences, sentences and fragments via the mentioned above rules.' },
];

const READING_QUESTIONS = [
  { key: 'reading_word_in_context', label: 'I feel confident in the following topic: Vocabulary in Context. In most cases, I know or can guess the meaning of the words from the context.' },
  { key: 'reading_text_structure', label: 'I feel confident in the following topic: Main Idea Questions. It is easy for me to read the passage and identify the main idea/theme/topic.' },
  { key: 'reading_cross_text', label: 'I feel confident in the following topic: Sentence Function. It is easy for me to understand what is the role of certain sentence in the passage.' },
  { key: 'reading_central_ideas', label: 'I feel confident in the following topic: Rhetorical Synthesis. It is easy for me to answer questions that require combining information from multiple sources.' },
  { key: 'reading_inferences', label: 'I feel confident in the following topic: Detailed Evidence. I can easily identify the point of the author and find evidence that supports or opposes his/her view.' },
];

const PASSAGES_QUESTIONS = [
  { key: 'passages_literary', label: 'I feel confident in the following type of passages: Fiction Passages. I understand the tone and mood of the passage from the literary techniques.' },
  { key: 'passages_social_science', label: 'I feel confident in the following type of passages: Social Science Passages. I can understand scientific terms connected with society, memory, psychology, behavior, even if they are not familiar to me. I mostly understand the scientific ideas or hypothesis presented in the passage.' },
  { key: 'passages_humanities', label: 'I feel confident in the following type of passages: Historical Passages. I can understand political terms even if they are not familiar to me. I mostly understand the ideas of the authors. I can explain what author is advocating for. I understand the context of the issue.' },
  { key: 'passages_science', label: 'I feel confident in the following type of passages: Natural Science Passages. I can understand scientific terms even if they are not familiar to me. I mostly understand the scientific ideas or hypothesis presented in the passage.' },
  { key: 'passages_poetry', label: 'I feel confident in the following type of passages: Poems. I can understand the general ideas in the Poems.' },
];

const MATH_TOPICS = [
  'Problem-solving and Data Analysis',
  'Linear equations',
  'Linear inequalities',
  'Linear functions',
  'System of linear equations',
  'Quadratic equations',
  'Quadratic functions',
  'Polynomial functions',
  'Radical, rational, and exponential functions',
  'Equivalent expressions',
  'Percentages',
  'Ratios, rates, proportional relationships',
  'Geometry and Trigonometry',
  'Lines, angles, and triangles',
  'Right triangles',
  'Circles and sectors',
  'Area, volume, and 3D shapes',
];

// =============================================================================
// IELTS SPECIFIC CONSTANTS
// =============================================================================

const IELTS_TARGET_DATES = [
  { value: 'January', label: 'January' },
  { value: 'February', label: 'February' },
  { value: 'March', label: 'March' },
  { value: 'April', label: 'April' },
  { value: 'May', label: 'May' },
  { value: 'June', label: 'June' },
  { value: 'July', label: 'July' },
  { value: 'August', label: 'August' },
  { value: 'September', label: 'September' },
  { value: 'October', label: 'October' },
  { value: 'November', label: 'November' },
  { value: 'December', label: 'December' },
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

const IELTS_LISTENING_QUESTIONS = [
  { key: 'ielts_listening_main_idea', label: 'I feel confident in understanding main ideas and general themes in listening passages. I can easily identify the topic and purpose of conversations or monologues.' },
  { key: 'ielts_listening_details', label: 'I feel confident in catching specific details such as names, numbers, dates, and factual information while listening.' },
  { key: 'ielts_listening_opinion', label: 'I feel confident in understanding speakers\' opinions, attitudes, and feelings expressed in the audio.' },
  { key: 'ielts_listening_accents', label: 'I feel confident in understanding different English accents (British, American, Australian, etc.) without difficulty.' },
];

const IELTS_READING_QUESTIONS = [
  { key: 'ielts_reading_skimming', label: 'I feel confident in skimming texts to quickly identify main ideas, topic sentences, and overall structure.' },
  { key: 'ielts_reading_scanning', label: 'I feel confident in scanning texts to locate specific information such as names, dates, and facts.' },
  { key: 'ielts_reading_vocabulary', label: 'I feel confident in understanding academic vocabulary and can often guess meanings from context.' },
  { key: 'ielts_reading_inference', label: 'I feel confident in making inferences and understanding implied meanings that are not directly stated.' },
  { key: 'ielts_reading_matching', label: 'I feel confident in matching headings to paragraphs and matching information to correct sources.' },
];

const IELTS_WRITING_QUESTIONS = [
  { key: 'ielts_writing_task1_graphs', label: 'I feel confident in describing graphs, charts, and tables in Task 1. I can identify trends, compare data, and summarize key features.' },
  { key: 'ielts_writing_task1_process', label: 'I feel confident in describing processes, diagrams, and maps in Task 1. I can sequence steps and explain changes.' },
  { key: 'ielts_writing_task2_structure', label: 'I feel confident in structuring Task 2 essays with clear introduction, body paragraphs, and conclusion.' },
  { key: 'ielts_writing_task2_arguments', label: 'I feel confident in developing arguments with clear topic sentences, supporting examples, and explanations.' },
  { key: 'ielts_writing_grammar', label: 'I feel confident in using a range of grammatical structures accurately in my writing.' },
  { key: 'ielts_writing_vocabulary', label: 'I feel confident in using varied and appropriate vocabulary, including academic words and collocations.' },
];

const IELTS_SPEAKING_QUESTIONS = [
  { key: 'ielts_speaking_fluency', label: 'I feel confident in speaking fluently without long pauses or hesitations. I can maintain a natural flow of speech.' },
  { key: 'ielts_speaking_vocabulary', label: 'I feel confident in using a wide range of vocabulary to express ideas clearly and precisely.' },
  { key: 'ielts_speaking_grammar', label: 'I feel confident in using correct grammar while speaking, including complex sentence structures.' },
  { key: 'ielts_speaking_pronunciation', label: 'I feel confident in my pronunciation, including word stress, intonation, and clear articulation.' },
  { key: 'ielts_speaking_part2', label: 'I feel confident in Part 2 (Long Turn) - I can speak for 1-2 minutes on a topic with good organization and detail.' },
  { key: 'ielts_speaking_part3', label: 'I feel confident in Part 3 (Discussion) - I can discuss abstract topics and express complex ideas clearly.' },
];

const IELTS_WEAK_TOPICS = [
  'Listening - Multiple choice questions',
  'Listening - Sentence completion',
  'Listening - Note/form completion',
  'Listening - Map/diagram labeling',
  'Reading - True/False/Not Given',
  'Reading - Yes/No/Not Given',
  'Reading - Matching headings',
  'Reading - Summary completion',
  'Reading - Multiple choice',
  'Writing Task 1 - Line graphs',
  'Writing Task 1 - Bar charts',
  'Writing Task 1 - Pie charts',
  'Writing Task 1 - Tables',
  'Writing Task 1 - Process diagrams',
  'Writing Task 1 - Maps',
  'Writing Task 2 - Opinion essays',
  'Writing Task 2 - Discussion essays',
  'Writing Task 2 - Problem/solution essays',
  'Writing Task 2 - Advantage/disadvantage essays',
  'Speaking Part 1 - Personal topics',
  'Speaking Part 2 - Cue cards',
  'Speaking Part 3 - Abstract discussions',
];

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
  leftLabel = 'Strongly Disagree',
  rightLabel = 'Strongly Agree',
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  error?: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div className="space-y-3 p-4 border border-gray-200 dark:border-border rounded-lg bg-gray-50 dark:bg-secondary">
      <Label className="text-sm font-medium block">{label}</Label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-24 text-left">{leftLabel}</span>
        <div className="flex gap-2 flex-1 justify-center">
          {LIKERT_SCALE.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`w-10 h-10 text-sm rounded-lg border transition-all font-medium ${
                value === option.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-card text-gray-700 dark:text-gray-300 border-gray-300 dark:border-border hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              {option.value}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 w-24 text-right">{rightLabel}</span>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

// Saving indicator component
function SavingIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      
    </div>
  );
}

export default function AssignmentZeroPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string>('');
  
  // User groups state
  const [userGroups, setUserGroups] = useState<{ id: number; name: string }[]>([]);
  
  // Determine which questionnaire types to show based on user groups
  const showSAT = useMemo(() => {
    if (userGroups.length === 0) return true; // Default to SAT if no groups
    return userGroups.some(g => !g.name.toLowerCase().includes('ielts'));
  }, [userGroups]);
  
  const showIELTS = useMemo(() => {
    return userGroups.some(g => g.name.toLowerCase().includes('ielts'));
  }, [userGroups]);
  
  // Dynamic steps based on user groups
  const DYNAMIC_STEPS = useMemo(() => {
    const baseSteps = [
      { id: 'personal', title: 'Personal Info', icon: User, type: 'common' },
      { id: 'account', title: 'Account Info', icon: Mail, type: 'common' },
      { id: 'education', title: 'Education', icon: GraduationCap, type: 'common' },
    ];
    
    const satSteps = [
      { id: 'sat_results', title: 'SAT Results', icon: Target, type: 'sat' },
      { id: 'sat_grammar', title: 'Grammar', icon: PenTool, type: 'sat' },
      { id: 'sat_reading', title: 'Reading', icon: BookOpen, type: 'sat' },
      { id: 'sat_passages', title: 'Passages', icon: FileText, type: 'sat' },
      { id: 'sat_math', title: 'Math Topics', icon: Calculator, type: 'sat' },
    ];
    
    const ieltsSteps = [
      { id: 'ielts_listening', title: 'Listening', icon: Headphones, type: 'ielts' },
      { id: 'ielts_reading', title: 'IELTS Reading', icon: BookOpen, type: 'ielts' },
      { id: 'ielts_writing', title: 'Writing', icon: Edit3, type: 'ielts' },
      { id: 'ielts_speaking', title: 'Speaking', icon: Mic, type: 'ielts' },
      { id: 'ielts_topics', title: 'IELTS Topics', icon: FileText, type: 'ielts' },
    ];
    
    const endSteps = [
      { id: 'comments', title: 'Comments', icon: MessageSquare, type: 'common' },
    ];
    
    let steps = [...baseSteps];
    if (showSAT) steps = [...steps, ...satSteps];
    if (showIELTS) steps = [...steps, ...ieltsSteps];
    steps = [...steps, ...endSteps];
    
    return steps;
  }, [showSAT, showIELTS]);
  
  // Get current step ID for conditional rendering
  const currentStepId = DYNAMIC_STEPS[currentStep - 1]?.id || '';
  
  const totalSteps = DYNAMIC_STEPS.length;

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

  // Check status and load draft on mount
  useEffect(() => {
    checkStatusAndLoadDraft();
  }, []);

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
        last_saved_step: currentStep,
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
  }, [formData, currentStep]);

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
      const status = await apiClient.getAssignmentZeroStatus();
      
      // Set user groups from status
      if (status.user_groups) {
        setUserGroups(status.user_groups);
      }
      
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
            college_board_password: submission.college_board_password || '',
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
            math_topics: submission.math_topics || [],
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
            ielts_weak_topics: submission.ielts_weak_topics || [],
            additional_comments: submission.additional_comments || '',
          });
          lastSavedDataRef.current = JSON.stringify(submission);
          if (status.last_saved_step) {
            setCurrentStep(status.last_saved_step);
          }
        } catch (error) {
          console.error('Failed to load draft:', error);
        }
      }
    } catch (error) {
      console.error('Failed to check status:', error);
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
    setFormData((prev) => ({
      ...prev,
      math_topics: prev.math_topics.includes(topic)
        ? prev.math_topics.filter((t) => t !== topic)
        : [...prev.math_topics, topic],
    }));
  };

  const handleIeltsWeakTopicToggle = (topic: string) => {
    setFormData((prev) => ({
      ...prev,
      ielts_weak_topics: prev.ielts_weak_topics.includes(topic)
        ? prev.ielts_weak_topics.filter((t) => t !== topic)
        : [...prev.ielts_weak_topics, topic],
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast('Please upload an image file (JPEG, PNG, GIF, or WEBP)', 'error');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast('File size must be less than 10MB', 'error');
      return;
    }

    setUploadingFile(true);
    try {
      const result = await apiClient.uploadAssignmentZeroScreenshot(file);
      handleInputChange('screenshot_url', result.url);
      toast('Screenshot uploaded successfully', 'success');
    } catch (error) {
      console.error('Upload failed:', error);
      toast('Failed to upload screenshot', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    const stepId = DYNAMIC_STEPS[step - 1]?.id;

    // Validate based on step ID instead of step number
    if (stepId === 'personal') {
      if (!formData.full_name.trim()) newErrors.full_name = 'Required';
      if (!formData.phone_number.trim()) newErrors.phone_number = 'Required';
      if (!formData.parent_phone_number.trim()) newErrors.parent_phone_number = 'Required';
      if (!formData.telegram_id.trim()) newErrors.telegram_id = 'Required';
      if (!formData.email.trim()) newErrors.email = 'Required';
    } else if (stepId === 'account') {
      if (showSAT && !formData.college_board_email.trim()) newErrors.college_board_email = 'Required';
      if (showSAT && !formData.college_board_password.trim()) newErrors.college_board_password = 'Required';
      if (!formData.birthday_date) newErrors.birthday_date = 'Required';
      if (!formData.city.trim()) newErrors.city = 'Required';
    } else if (stepId === 'education') {
      if (!formData.school_type) newErrors.school_type = 'Required';
      if (!formData.group_name.trim()) newErrors.group_name = 'Required';
      // SAT target date only required if user is in SAT group
      if (showSAT && !formData.sat_target_date) newErrors.sat_target_date = 'Required';
      // IELTS target date only required if user is in IELTS group
      if (showIELTS && !formData.ielts_target_date) newErrors.ielts_target_date = 'Required';
    }
 else if (stepId === 'sat_results') {
      if (!formData.recent_practice_test_score.trim()) newErrors.recent_practice_test_score = 'Required';
      if (!formData.bluebook_verbal.trim()) newErrors.bluebook_verbal = 'Required';
      if (!formData.bluebook_math.trim()) newErrors.bluebook_math = 'Required';
      if (!formData.screenshot_url) newErrors.screenshot_url = 'Required';
    }
    // All other steps (assessments) are optional, no required validation

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
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
          toast('Please complete all required fields', 'error');
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

      toast('Assignment Zero submitted successfully!', 'success');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Submit failed:', error);
      toast(error.message || 'Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-background dark:to-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-background dark:to-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">Already Completed!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You have already submitted Assignment Zero. You can proceed to your dashboard.
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const CurrentStepIcon = DYNAMIC_STEPS[currentStep - 1]?.icon || User;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-background dark:to-background py-8 px-4">
      <SavingIndicator status={saveStatus} />
      
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="relative text-center mb-8">
          <div className="absolute right-0 top-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => logout()}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-2">Assignment Zero</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Self-Assessment Questionnaire</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Please be honest when answering questions. This helps us understand your current level.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2 overflow-x-auto pb-2">
            {DYNAMIC_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const stepNumber = index + 1;
              return (
                <button
                  key={step.id}
                  onClick={() => stepNumber <= currentStep && setCurrentStep(stepNumber)}
                  disabled={stepNumber > currentStep}
                  className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all ${
                    stepNumber === currentStep
                      ? 'bg-blue-600 text-white'
                      : stepNumber < currentStep
                      ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                      : 'bg-gray-200 dark:bg-secondary text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                  title={step.title}
                >
                  {stepNumber < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative h-2 bg-gray-200 dark:bg-secondary rounded-full">
            <div
              className="absolute h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
            Step {currentStep} of {totalSteps}: {DYNAMIC_STEPS[currentStep - 1]?.title}
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrentStepIcon className="w-5 h-5" />
              {DYNAMIC_STEPS[currentStep - 1]?.title}
            </CardTitle>
            <CardDescription>
              {currentStepId === 'personal' && 'Tell us about yourself'}
              {currentStepId === 'account' && (showSAT ? 'Your College Board and platform accounts' : 'Your platform account')}
              {currentStepId === 'education' && 'Your school and test goals'}
              {currentStepId === 'sat_results' && 'Your recent SAT test scores'}
              {currentStepId === 'sat_grammar' && 'Rate your grammar knowledge (1 = Don\'t know, 5 = Mastered)'}
              {currentStepId === 'sat_reading' && 'Rate your reading skills (1 = Don\'t know, 5 = Mastered)'}
              {currentStepId === 'sat_passages' && 'Rate your familiarity with SAT passage types (1 = Don\'t know, 5 = Mastered)'}
              {currentStepId === 'sat_math' && 'Select the math topics you need to work on'}
              {currentStepId === 'ielts_listening' && 'Rate your IELTS listening skills (1 = Don\'t know, 5 = Mastered)'}
              {currentStepId === 'ielts_reading' && 'Rate your IELTS reading skills (1 = Don\'t know, 5 = Mastered)'}
              {currentStepId === 'ielts_writing' && 'Rate your IELTS writing skills (1 = Don\'t know, 5 = Mastered)'}
              {currentStepId === 'ielts_speaking' && 'Rate your IELTS speaking skills (1 = Don\'t know, 5 = Mastered)'}
              {currentStepId === 'ielts_topics' && 'Select the IELTS topics you need to work on'}
              {currentStepId === 'comments' && 'Any additional comments or questions'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step: Personal Information */}
            {currentStepId === 'personal' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Name and Surname *</Label>
                  <Input
                    id="full_name"
                    placeholder="Enter your full name"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className={errors.full_name ? 'border-red-500' : ''}
                  />
                  {errors.full_name && <p className="text-sm text-red-500">{errors.full_name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone_number">Your Phone Number *</Label>
                  <Input
                    id="phone_number"
                    placeholder="+7 (XXX) XXX-XX-XX"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    className={errors.phone_number ? 'border-red-500' : ''}
                  />
                  {errors.phone_number && <p className="text-sm text-red-500">{errors.phone_number}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent_phone_number">Your Parent's Phone Number *</Label>
                  <Input
                    id="parent_phone_number"
                    placeholder="+7 (XXX) XXX-XX-XX"
                    value={formData.parent_phone_number}
                    onChange={(e) => handleInputChange('parent_phone_number', e.target.value)}
                    className={errors.parent_phone_number ? 'border-red-500' : ''}
                  />
                  {errors.parent_phone_number && (
                    <p className="text-sm text-red-500">{errors.parent_phone_number}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram_id">Your Telegram ID *</Label>
                  <Input
                    id="telegram_id"
                    placeholder="@your_telegram"
                    value={formData.telegram_id}
                    onChange={(e) => handleInputChange('telegram_id', e.target.value)}
                    className={errors.telegram_id ? 'border-red-500' : ''}
                  />
                  {errors.telegram_id && <p className="text-sm text-red-500">{errors.telegram_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This email will be used to give you access to the weekly practice tests.
                  </p>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                </div>
              </>
            )}

            {/* Step: Account Information */}
            {currentStepId === 'account' && (
              <>
                {showSAT && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="college_board_email">College Board Account Email *</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Please provide your email with which you have registered your College Board account.
                      </p>
                      <Input
                        id="college_board_email"
                        type="email"
                        placeholder="collegeboard@email.com"
                        value={formData.college_board_email}
                        onChange={(e) => handleInputChange('college_board_email', e.target.value)}
                        className={errors.college_board_email ? 'border-red-500' : ''}
                      />
                      {errors.college_board_email && (
                        <p className="text-sm text-red-500">{errors.college_board_email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="college_board_password">College Board Account Password *</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Your email and password will be used by your teacher to check if you have correctly
                        registered for SAT.
                      </p>
                      <Input
                        id="college_board_password"
                        type="password"
                        placeholder="Enter your password"
                        value={formData.college_board_password}
                        onChange={(e) => handleInputChange('college_board_password', e.target.value)}
                        className={errors.college_board_password ? 'border-red-500' : ''}
                      />
                      {errors.college_board_password && (
                        <p className="text-sm text-red-500">{errors.college_board_password}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="birthday_date">Birthday Date *</Label>
                  <Input
                    id="birthday_date"
                    type="date"
                    value={formData.birthday_date}
                    onChange={(e) => handleInputChange('birthday_date', e.target.value)}
                    className={errors.birthday_date ? 'border-red-500' : ''}
                  />
                  {errors.birthday_date && <p className="text-sm text-red-500">{errors.birthday_date}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="Enter your city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className={errors.city ? 'border-red-500' : ''}
                  />
                  {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
                </div>
              </>
            )}

            {/* Step: Education & Goals */}
            {currentStepId === 'education' && (
              <>
                <div className="space-y-2">
                  <Label>Which type of school do you study at? *</Label>
                  <Select
                    value={formData.school_type}
                    onValueChange={(value) => handleInputChange('school_type', value)}
                  >
                    <SelectTrigger className={errors.school_type ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select your school type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHOOL_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.school_type && <p className="text-sm text-red-500">{errors.school_type}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="group_name">Group Name *</Label>
                  <Input
                    id="group_name"
                    placeholder="Enter your group name"
                    value={formData.group_name}
                    onChange={(e) => handleInputChange('group_name', e.target.value)}
                    className={errors.group_name ? 'border-red-500' : ''}
                  />
                  {errors.group_name && <p className="text-sm text-red-500">{errors.group_name}</p>}
                </div>

                {/* SAT-specific questions - only show if user is in SAT group */}
                {showSAT && (
                  <>
                    <div className="space-y-2">
                      <Label>When are you planning to pass SAT? *</Label>
                      <Select
                        value={formData.sat_target_date}
                        onValueChange={(value) => handleInputChange('sat_target_date', value)}
                      >
                        <SelectTrigger className={errors.sat_target_date ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select target date" />
                        </SelectTrigger>
                        <SelectContent>
                          {SAT_TARGET_DATES.map((date) => (
                            <SelectItem key={date.value} value={date.value}>
                              {date.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.sat_target_date && <p className="text-sm text-red-500">{errors.sat_target_date}</p>}
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
                        Have you passed SAT before?
                      </Label>
                    </div>

                    {formData.has_passed_sat_before && (
                      <div className="space-y-4 p-4 bg-gray-50 dark:bg-secondary rounded-lg border dark:border-border">
                        <Label className="font-medium">What was your score and on which exam?</Label>
                        
                        {/* Month and Year Selection */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="previous_sat_month">Month *</Label>
                            <Select
                              value={formData.previous_sat_month}
                              onValueChange={(value) => handleInputChange('previous_sat_month', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select month" />
                              </SelectTrigger>
                              <SelectContent>
                                {SAT_MONTHS.map((month) => (
                                  <SelectItem key={month.value} value={month.value}>
                                    {month.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="previous_sat_year">Year *</Label>
                            <Select
                              value={formData.previous_sat_year}
                              onValueChange={(value) => handleInputChange('previous_sat_year', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select year" />
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
                            <Label htmlFor="previous_sat_verbal">Verbal Score *</Label>
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
                            <Label htmlFor="previous_sat_math">Math Score *</Label>
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
                          <div className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-card p-2 rounded border dark:border-border">
                            Total Score: <span className="font-semibold">{Number(formData.previous_sat_verbal) + Number(formData.previous_sat_math)}</span>
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
                      <Label>When are you planning to pass IELTS? *</Label>
                      <Select
                        value={formData.ielts_target_date}
                        onValueChange={(value) => handleInputChange('ielts_target_date', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select target date" />
                        </SelectTrigger>
                        <SelectContent>
                          {IELTS_TARGET_DATES.map((date) => (
                            <SelectItem key={date.value} value={date.value}>
                              {date.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>What is your target IELTS score?</Label>
                      <Select
                        value={formData.ielts_target_score}
                        onValueChange={(value) => handleInputChange('ielts_target_score', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select target score" />
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
                        Have you passed IELTS before?
                      </Label>
                    </div>

                    {formData.has_passed_ielts_before && (
                      <div className="space-y-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <Label className="font-medium">What were your previous IELTS scores?</Label>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="previous_ielts_listening">Listening</Label>
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
                            <Label htmlFor="previous_ielts_reading">Reading</Label>
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
                            <Label htmlFor="previous_ielts_writing">Writing</Label>
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
                            <Label htmlFor="previous_ielts_speaking">Speaking</Label>
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
                          <Label htmlFor="previous_ielts_overall">Overall Band Score</Label>
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
                    What was your score on recent practice tests? *
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    For example: "I passed Bluebook Practice Test 5 on October 23rd and got 1200 (Verbal
                    500, Math 700)"
                  </p>
                  <Textarea
                    id="recent_practice_test_score"
                    placeholder="Describe your recent practice test results"
                    value={formData.recent_practice_test_score}
                    onChange={(e) => handleInputChange('recent_practice_test_score', e.target.value)}
                    className={errors.recent_practice_test_score ? 'border-red-500' : ''}
                  />
                  {errors.recent_practice_test_score && (
                    <p className="text-sm text-red-500">{errors.recent_practice_test_score}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    Please submit the results of Bluebook Practice Test 5 *
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="bluebook_verbal" className="text-sm text-gray-600 dark:text-gray-400">Verbal Score</Label>
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
                      <Label htmlFor="bluebook_math" className="text-sm text-gray-600 dark:text-gray-400">Math Score</Label>
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
                    <p className="text-sm text-red-500">Both Verbal and Math scores are required</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Upload a screenshot with your results of Bluebook Practice Test 5 *</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Max 10 MB. Supported formats: JPEG, PNG, GIF, WEBP
                  </p>

                  {formData.screenshot_url ? (
                    <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Screenshot uploaded successfully!</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleInputChange('screenshot_url', '')}
                      >
                        Upload different file
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        errors.screenshot_url
                          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-300 dark:border-border hover:border-blue-400 dark:hover:border-blue-500'
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
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-400">Click to upload screenshot</span>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                  {errors.screenshot_url && (
                    <p className="text-sm text-red-500">{errors.screenshot_url}</p>
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
                    <p className="font-medium mb-1">Important</p>
                    <p>
                      Please be honest when answering questions. This questionnaire is designed to
                      identify your current strong and weak skills to help us personalize your
                      learning experience.
                    </p>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Grammar Assessment</h3>
                <div className="space-y-4">
                  {GRAMMAR_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={question.label}
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
                <h3 className="text-lg font-semibold mb-4">Assessment of Reading Skills</h3>
                <div className="space-y-4">
                  {READING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={question.label}
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
                <h3 className="text-lg font-semibold mb-4">Styles of the SAT Passages</h3>
                <div className="space-y-4">
                  {PASSAGES_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={question.label}
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
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Instructions:</strong> Select all the math topics that you feel you need
                    to work on or improve.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {MATH_TOPICS.map((topic) => (
                    <div key={topic} className="flex items-center space-x-3">
                      <Checkbox
                        id={`math-${topic}`}
                        checked={formData.math_topics.includes(topic)}
                        onCheckedChange={() => handleMathTopicToggle(topic)}
                      />
                      <Label htmlFor={`math-${topic}`} className="cursor-pointer text-sm">
                        {topic}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  Selected: {formData.math_topics.length} topic(s)
                </p>
              </>
            )}

            {/* IELTS Listening Assessment */}
            {currentStepId === 'ielts_listening' && (
              <>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium mb-1">Important</p>
                    <p>
                      Please be honest when answering questions. This questionnaire is designed to
                      identify your current strong and weak skills to help us personalize your
                      learning experience.
                    </p>
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-4">IELTS Listening Skills Assessment</h3>
                <div className="space-y-4">
                  {IELTS_LISTENING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={question.label}
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
                <h3 className="text-lg font-semibold mb-4">IELTS Reading Skills Assessment</h3>
                <div className="space-y-4">
                  {IELTS_READING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={question.label}
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
                <h3 className="text-lg font-semibold mb-4">IELTS Writing Skills Assessment</h3>
                <div className="space-y-4">
                  {IELTS_WRITING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={question.label}
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
                <h3 className="text-lg font-semibold mb-4">IELTS Speaking Skills Assessment</h3>
                <div className="space-y-4">
                  {IELTS_SPEAKING_QUESTIONS.map((question) => (
                    <LikertScale
                      key={question.key}
                      label={question.label}
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
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Instructions:</strong> Select all the IELTS topics and question types that you feel you need
                    to work on or improve.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {IELTS_WEAK_TOPICS.map((topic) => (
                    <div key={topic} className="flex items-center space-x-3">
                      <Checkbox
                        id={`ielts-${topic}`}
                        checked={formData.ielts_weak_topics.includes(topic)}
                        onCheckedChange={() => handleIeltsWeakTopicToggle(topic)}
                      />
                      <Label htmlFor={`ielts-${topic}`} className="text-sm font-normal cursor-pointer">
                        {topic}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  Selected: {formData.ielts_weak_topics.length} topic(s)
                </p>
              </>
            )}

            {/* Step: Additional Comments */}
            {currentStepId === 'comments' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="additional_comments">Additional Comments (Optional)</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Is there anything else you'd like us to know? Any specific questions, concerns, or
                    areas you'd like help with?
                  </p>
                  <Textarea
                    id="additional_comments"
                    placeholder="Enter any additional comments or questions here..."
                    value={formData.additional_comments}
                    onChange={(e) => handleInputChange('additional_comments', e.target.value)}
                    rows={6}
                  />
                </div>

                {/* Important Notice */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-medium mb-1">Important</p>
                    <p>
                      Please be honest when answering questions. This questionnaire is designed to
                      identify your current strong and weak skills to help us personalize your
                      learning experience.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4 border-t dark:border-border">
              {currentStep > 1 ? (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {currentStep < totalSteps ? (
                <Button type="button" onClick={handleNext}>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
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
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Assignment Zero
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
