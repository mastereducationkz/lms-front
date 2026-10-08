import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Question } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import apiClient from '../../services/api';
import { renderTextWithLatex } from '../../utils/latex';
import { sanitizeHtml } from '../../lib/safeHtml';
import RichTextEditor from '../RichTextEditor';
import PDFPreview from '../PDFPreview';
import ThinkingLoader from '../ThinkingLoader';
import { Upload, FileText, Image, Plus, Trash2, ChevronUp, ChevronDown, CheckCircle, Music, Headphones, Lock, Check, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { FillInBlankRenderer } from './FillInBlankRenderer';
import { TextCompletionRenderer } from './TextCompletionRenderer';
import { parseGap } from '../../utils/gapParser';
import { useT } from '../../lib/i18n/react';
import { acceptedFormsPreview, flagsDisagreeWithKey, truncatedDecimalKeys, withFlagsFromKey } from '../../lib/quizKeyChecks';
import type { MessageKey } from '../../lib/i18n';
import {
  DEFAULT_QUIZ_PASSING_SCORE_OPTIONAL,
  DEFAULT_QUIZ_PASSING_SCORE_REQUIRED,
} from '../../utils/quizPassingScore';
import '@/lib/i18n/catalogs/adminTools';
import '@/lib/i18n/catalogs/courseAuthoring';

/** The question-type names in the question list. */
const QUESTION_TYPE_LABELS: Record<string, MessageKey> = {
  single_choice: 'courseAuthoring.quiz.qtype.single',
  multiple_choice: 'courseAuthoring.quiz.qtype.multiple',
  short_answer: 'courseAuthoring.quiz.qtype.short',
  fill_blank: 'courseAuthoring.quiz.qtype.fillBlank',
  text_completion: 'courseAuthoring.quiz.qtype.textCompletion',
  long_text: 'courseAuthoring.quiz.qtype.longText',
  media_question: 'courseAuthoring.quiz.qtype.media',
  media_open_question: 'courseAuthoring.quiz.qtype.mediaOpen',
  image_content: 'courseAuthoring.quiz.qtype.image',
  matching: 'courseAuthoring.quiz.qtype.matching',
};

const DIFFICULTY_LABELS: Record<string, MessageKey> = {
  easy: 'courseAuthoring.quiz.difficultyEasy',
  medium: 'courseAuthoring.quiz.difficultyMedium',
  hard: 'courseAuthoring.quiz.difficultyHard',
};

export interface QuizLessonEditorProps {
  quizTitle: string;
  setQuizTitle: (title: string) => void;
  quizQuestions: Question[];
  setQuizQuestions: (questions: Question[]) => void;
  quizTimeLimit?: number;
  setQuizTimeLimit: (limit: number | undefined) => void;
  quizDisplayMode?: 'one_by_one' | 'all_at_once';
  setQuizDisplayMode?: (mode: 'one_by_one' | 'all_at_once') => void;
  quizType: 'regular' | 'audio' | 'pdf' | 'text_based';
  setQuizType: (type: 'regular' | 'audio' | 'pdf' | 'text_based') => void;
  quizMediaUrl: string;
  setQuizMediaUrl: (url: string) => void;
  quizMediaType: 'audio' | 'pdf' | 'text' | '';
  setQuizMediaType: (type: 'audio' | 'pdf' | 'text' | '') => void;
  audioPlaybackMode?: 'strict' | 'flexible';
  setAudioPlaybackMode?: (mode: 'strict' | 'flexible') => void;
  audioMaxPlays?: number;
  setAudioMaxPlays?: (plays: number) => void;
  highlightedQuestionId?: string;
  quizPassingScorePercent?: number;
  setQuizPassingScorePercent?: (value: number | undefined) => void;
  isOptionalStep?: boolean;
}

export default function QuizLessonEditor({
  quizTitle,
  setQuizTitle,
  quizQuestions,
  setQuizQuestions,
  quizTimeLimit,
  setQuizTimeLimit,
  quizDisplayMode = 'one_by_one',
  setQuizDisplayMode,
  quizType,
  setQuizType,
  quizMediaUrl,
  setQuizMediaUrl,
  setQuizMediaType,
  audioPlaybackMode = 'flexible',
  setAudioPlaybackMode,
  highlightedQuestionId,
  quizPassingScorePercent,
  setQuizPassingScorePercent,
  isOptionalStep = false,
}: QuizLessonEditorProps) {
  const tr = useT();
  // Handle scrolling to highlighted question
  React.useEffect(() => {
    if (highlightedQuestionId && quizQuestions.length > 0) {
      // Small timeout to ensure DOM is ready and images/content are partially loaded
      const timer = setTimeout(() => {
        const element = document.getElementById(`question-${highlightedQuestionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a more prominent and persistent highlight
          element.classList.add('ring-4', 'ring-brand', 'ring-offset-2', 'shadow-2xl', 'scale-[1.01]', 'transition-all', 'duration-500');
          
          // Keep highlight for longer to ensure user sees it
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-brand', 'ring-offset-2', 'shadow-2xl', 'scale-[1.01]');
          }, 5000);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [highlightedQuestionId, quizQuestions.length > 0]); // Re-run when questions are loaded

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState<Question | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [showSatImageModal, setShowSatImageModal] = useState(false);
  const [analyzeMode, setAnalyzeMode] = useState<'sat' | 'nuet'>('sat');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  // AI analysis can run a minute: scan the document first, then switch to
  // "solving" while the model structures the questions.
  const [analyzeStage, setAnalyzeStage] = useState<'searching' | 'solving'>('searching');
  useEffect(() => {
    if (!isAnalyzingImage) {
      setAnalyzeStage('searching');
      return;
    }
    const t = window.setTimeout(() => setAnalyzeStage('solving'), 12_000);
    return () => window.clearTimeout(t);
  }, [isAnalyzingImage]);
  const [correctAnswersText, setCorrectAnswersText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadText, setBulkUploadText] = useState('');
  const [bulkUploadErrors, setBulkUploadErrors] = useState<string[]>([]);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const isImageMediaUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const getMediaFilename = (url: string) => url.split('/').pop() || tr('courseAuthoring.upload.uploadedFile');

  const openAddQuestion = () => {
    const ts = Date.now().toString();
    const base: Question = {
      id: ts,
      assignment_id: '',
      question_text: '',
      question_type: 'single_choice',
      options: [
        { id: ts + '_1', text: '', is_correct: false, letter: 'A' },
        { id: ts + '_2', text: '', is_correct: false, letter: 'B' },
        { id: ts + '_3', text: '', is_correct: false, letter: 'C' },
        { id: ts + '_4', text: '', is_correct: false, letter: 'D' },
      ],
      // default to first option for single choice
      correct_answer: 0,
      points: 1,
      order_index: quizQuestions.length,
      is_sat_question: true,
      content_text: ''
    };
    setDraftQuestion(base);
    setEditingQuestionIndex(null);
    setShowQuestionModal(true);
  };

  const openEditQuestion = (questionIndex: number) => {
    const question = quizQuestions[questionIndex];
    setDraftQuestion({ ...question });
    setEditingQuestionIndex(questionIndex);
    setShowQuestionModal(true);
  };

  const applyDraftUpdate = (patch: Partial<Question>) => {
    setDraftQuestion(prev => {
      if (!prev) return null;
      return { ...prev, ...patch };
    });
  };

  // Parse bulk upload text format - supports flexible number of options
  // Format 1 (Simple MCQ):
  // 1. Question text
  // A) Option 1
  // B) Option 2 +
  // C) Option 3
  //
  // Format 2 (Matching):
  // [MATCHING]
  // Left 1 = Right 1
  // Left 2 = Right 2
  // Left 3 = Right 3
  //
  const parseBulkQuestions = (text: string): { questions: Question[]; errors: string[] } => {
    const errors: string[] = [];
    const questions: Question[] = [];

    // Split by blank lines to separate questions
    const blocks = text.split(/\n\s*\n/).filter(b => b.trim());

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex].trim();
      if (!block) continue;

      try {
        // Check if this is a matching question
        const isMatching = block.toUpperCase().startsWith('[MATCHING]') || 
                          block.toUpperCase().startsWith('MATCHING:') ||
                          /^\d+\.\s*MATCHING/i.test(block);
        
        if (isMatching) {
          // Remove the MATCHING prefix and get lines
          let matchingContent = block;
          if (block.toUpperCase().startsWith('[MATCHING]')) {
            matchingContent = block.slice('[MATCHING]'.length);
          } else if (block.toUpperCase().startsWith('MATCHING:')) {
            matchingContent = block.slice('MATCHING:'.length);
          } else {
            // Remove number prefix like "1. MATCHING:"
            matchingContent = block.replace(/^\d+\.\s*MATCHING:?\s*/i, '');
          }
          
          const lines = matchingContent.split('\n').filter(l => l.trim());
          const pairs: { left: string; right: string }[] = [];
          let questionTitle = 'Match the items in the left column with the correct items in the right column.';
          
          for (const line of lines) {
            const match = line.match(/^(.+?)\s*=\s*(.+)$/);
            if (match) {
              pairs.push({ left: match[1].trim(), right: match[2].trim() });
            } else if (pairs.length === 0 && line.trim()) {
              // First non-pair line is the question title
              questionTitle = line.trim();
            }
          }
          
          for (const line of lines) {
            const match = line.match(/^(.+?)\s*=\s*(.+)$/);
            if (match) {
              pairs.push({ left: match[1].trim(), right: match[2].trim() });
            } else if (pairs.length === 0 && line.trim() && !line.includes('=')) {
              // First non-pair line could be the question title (update it)
              questionTitle = line.trim();
            }
          }
          
          if (pairs.length < 2) {
            errors.push(tr('courseAuthoring.quiz.bulk.matchingNeedsPairs', { n: blockIndex + 1 }));
            continue;
          }

          const question: Question = {
            id: `bulk_${Date.now()}_matching_${blockIndex}`,
            assignment_id: '',
            question_text: questionTitle,
            question_type: 'matching',
            matching_pairs: pairs,
            correct_answer: pairs.map((_, i) => i), // Correct order is original order
            points: pairs.length,
            order_index: questions.length,
          };
          questions.push(question);
          continue;
        }

        // Regular MCQ parsing
        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        
        // Find where options start (look for A), B), a), b), 1), 2), etc.)
        let questionTextLines: string[] = [];
        let optionLines: string[] = [];
        let foundOptions = false;
        
        for (const line of lines) {
          // Check if line starts with option marker
          if (/^[A-Za-z]\)|^\d+\)/.test(line)) {
            foundOptions = true;
          }
          
          if (foundOptions) {
            optionLines.push(line);
          } else {
            questionTextLines.push(line);
          }
        }

        // Remove question number from first line if present (e.g., "1. Question" or "1.1 Question")
        let questionText = questionTextLines.join(' ').trim();
        questionText = questionText.replace(/^\d+\.?\d*\s*\.?\s*/, '');

        if (!questionText) {
          errors.push(tr('courseAuthoring.quiz.bulk.noQuestionText', { n: blockIndex + 1 }));
          continue;
        }

        if (optionLines.length < 2) {
          errors.push(tr('courseAuthoring.quiz.bulk.needsOptions', { n: blockIndex + 1 }));
          continue;
        }

        // Parse options - flexible number
        const options: { id: string; text: string; is_correct: boolean; letter: string }[] = [];
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        let correctIndices: number[] = [];

        optionLines.forEach((line, index) => {
          // Remove option prefix (A), B), 1), 2), etc.)
          let text = line.replace(/^[A-Za-z0-9]\)\s*/, '').trim();
          
          // Check if this option is marked as correct with "+" or "*"
          const isCorrect = text.endsWith('+') || text.endsWith('*') || text.includes(' +') || text.includes(' *');
          if (isCorrect) {
            text = text.replace(/\s*[\+\*]\s*$/, '').trim();
            correctIndices.push(index);
          }

          options.push({
            id: `${Date.now()}_${letters[index] || index}_${Math.random()}`,
            text: text,
            is_correct: false,
            letter: letters[index] || String(index + 1)
          });
        });

        // If no correct answer marked, default to first option
        if (correctIndices.length === 0) {
          correctIndices = [0];
        }

        // Mark correct options
        correctIndices.forEach(idx => {
          if (options[idx]) options[idx].is_correct = true;
        });

        const questionType = correctIndices.length > 1 ? 'multiple_choice' : 'single_choice';

        const question: Question = {
          id: `bulk_${Date.now()}_${blockIndex}`,
          assignment_id: '',
          question_text: questionText,
          question_type: questionType,
          options: options,
          correct_answer: questionType === 'multiple_choice' ? correctIndices : correctIndices[0],
          points: 1,
          order_index: questions.length,
        };

        questions.push(question);
      } catch (error) {
        errors.push(tr('courseAuthoring.quiz.bulk.blockError', { n: blockIndex + 1, error: error instanceof Error ? error.message : tr('courseAuthoring.quiz.bulk.unknownError') }));
      }
    }

    return { questions, errors };
  };

  const handleBulkUpload = () => {
    setBulkUploadErrors([]);
    const { questions, errors } = parseBulkQuestions(bulkUploadText);

    if (errors.length > 0) {
      setBulkUploadErrors(errors);
      return;
    }

    if (questions.length === 0) {
      setBulkUploadErrors([tr('courseAuthoring.quiz.bulk.noneFound')]);
      return;
    }

    // Add all questions to the quiz
    setQuizQuestions([...quizQuestions, ...questions]);

    // Close modal and reset
    setShowBulkUploadModal(false);
    setBulkUploadText('');
    setBulkUploadErrors([]);
  };


  const validateQuestion = (question: Question): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // image_content type only requires media_url, not question text
    if (question.question_type === 'image_content') {
      if (!question.media_url) {
        errors.push(tr('courseAuthoring.quiz.validation.uploadImage'));
      }
      return { isValid: errors.length === 0, errors };
    }

    // Only validate if the question has been started (has some content)
    const hasStarted = question.question_text.trim() ||
      (question.options && question.options.some(opt => opt.text.trim())) ||
      (question.correct_answer && (typeof question.correct_answer === 'string' ? question.correct_answer.trim() : Array.isArray(question.correct_answer) ? question.correct_answer.length > 0 : true));

    if (!hasStarted) {
      return { isValid: true, errors: [] }; // Don't show errors for empty questions
    }

    if (!question.question_text.trim()) {
      errors.push(tr('courseAuthoring.quiz.validation.textRequired'));
    }
    if (question.question_type === 'fill_blank') {
      const answers = Array.isArray(question.correct_answer)
        ? question.correct_answer
        : (typeof question.correct_answer === 'string' && question.correct_answer.trim())
          ? [question.correct_answer.trim()]
          : [];
      if (answers.length === 0) {
        errors.push(tr('courseAuthoring.quiz.validation.addGap'));
      }
    } else if (question.question_type === 'short_answer' || question.question_type === 'media_open_question') {
      // Short answer and media_open_question need a correct answer
      if (!question.correct_answer || (typeof question.correct_answer === 'string' && !question.correct_answer.trim())) {
        errors.push(tr('courseAuthoring.quiz.validation.provideAnswer'));
      }
    } else if (question.question_type === 'text_completion') {
      // Text completion questions need passage with gaps and correct answers
      const text = (question.content_text || '').toString();
      const gaps = Array.from(text.matchAll(/\[\[(.*?)\]\]/g));
      if (gaps.length === 0) {
        errors.push(tr('courseAuthoring.quiz.validation.addGapsText'));
      }
      const answers = Array.isArray(question.correct_answer) ? question.correct_answer : [];
      if (answers.length !== gaps.length) {
        errors.push(tr('courseAuthoring.quiz.validation.answersMatchGaps'));
      }
      if (answers.some((answer: string) => !answer || !answer.trim())) {
        errors.push(tr('courseAuthoring.quiz.validation.allGapAnswers'));
      }
    } else if (question.question_type === 'long_text') {
      // Long text questions don't need options validation
      if (!question.correct_answer && question.correct_answer !== '') {
        // For long text, we just need some placeholder for correct_answer
        errors.push(tr('courseAuthoring.quiz.validation.provideSample'));
      }
    } else if (question.question_type === 'matching') {
      // Matching questions require pairs
      if (!question.matching_pairs || question.matching_pairs.length < 2) {
        errors.push(tr('courseAuthoring.quiz.validation.twoPairs'));
      }
      if (question.matching_pairs?.some(pair => !pair.left.trim() || !pair.right.trim())) {
        errors.push(tr('courseAuthoring.quiz.validation.pairsBothSides'));
      }
    } else if (question.question_type === 'single_choice' || question.question_type === 'media_question') {
      const hasOptionContent = question.options?.some(opt => opt.text.trim());
      if (hasOptionContent && (typeof question.correct_answer !== 'number' || question.correct_answer < 0)) {
        errors.push(tr('courseAuthoring.quiz.validation.selectCorrect'));
      }
      if (!question.options || question.options.length < 2) {
        errors.push(tr('courseAuthoring.quiz.validation.twoOptions'));
      }
      if (hasOptionContent && question.options?.some(opt => !opt.text.trim())) {
        errors.push(tr('courseAuthoring.quiz.validation.optionsText'));
      }
    } else if (question.question_type === 'multiple_choice') {
      const hasOptionContent = question.options?.some(opt => opt.text.trim());
      const ca = question.correct_answer;
      const hasValidCorrect =
        Array.isArray(ca) &&
        ca.length > 0 &&
        ca.every((i: unknown) => typeof i === 'number' && i >= 0);
      if (hasOptionContent && !hasValidCorrect) {
        errors.push(tr('courseAuthoring.quiz.validation.selectOneCorrect'));
      }
      if (!question.options || question.options.length < 2) {
        errors.push(tr('courseAuthoring.quiz.validation.twoOptions'));
      }
      if (hasOptionContent && question.options?.some(opt => !opt.text.trim())) {
        errors.push(tr('courseAuthoring.quiz.validation.optionsText'));
      }
    }

    // The key and the option flag are two records of one fact; a disagreement is a question somebody
    // must look at again, not one to save as it is.
    if (flagsDisagreeWithKey(question)) {
      errors.push(tr('courseAuthoring.quiz.validation.keyFlagMismatch'));
    }

    return { isValid: errors.length === 0, errors };
  };

  const getQuestionValidationStatus = (question: Question) => {
    return validateQuestion(question);
  };

  const removeQuestion = (index: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== index));
  };

  const moveQuestionUp = (index: number) => {
    if (index === 0) return;
    const newQuestions = [...quizQuestions];
    [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
    // Update order_index for both questions
    newQuestions[index - 1].order_index = index - 1;
    newQuestions[index].order_index = index;
    setQuizQuestions(newQuestions);
  };

  const moveQuestionDown = (index: number) => {
    if (index === quizQuestions.length - 1) return;
    const newQuestions = [...quizQuestions];
    [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
    // Update order_index for both questions
    newQuestions[index].order_index = index;
    newQuestions[index + 1].order_index = index + 1;
    setQuizQuestions(newQuestions);
  };


  const updateDraftOptionText = (idx: number, text: string) => {
    if (!draftQuestion || !draftQuestion.options) return;
    const options = [...draftQuestion.options];
    options[idx] = { ...options[idx], text };
    applyDraftUpdate({ options });
  };


  const setDraftCorrect = (idx: number, checked: boolean) => {
    if (!draftQuestion) return;
    if (draftQuestion.question_type === 'single_choice' || draftQuestion.question_type === 'media_question') {
      if (checked) applyDraftUpdate(withFlagsFromKey({ ...draftQuestion, correct_answer: idx }));
    } else if (draftQuestion.question_type === 'multiple_choice') {
      const current = Array.isArray(draftQuestion.correct_answer)
        ? [...draftQuestion.correct_answer]
        : [];
      const next = checked ? Array.from(new Set([...current, idx])) : current.filter((i) => i !== idx);
      applyDraftUpdate(withFlagsFromKey({ ...draftQuestion, correct_answer: next }));
    }
  };

  const saveDraftQuestion = () => {
    if (!draftQuestion) return;
    let correctAnswer: any = draftQuestion.correct_answer;
    if (draftQuestion.question_type === 'fill_blank') {
      // Extract answers from [[correct, wrong1, wrong2]] in content_text; take first as correct
      const text = (draftQuestion.content_text || '').toString();
      const separator = draftQuestion.gap_separator || ',';
      const gaps = [];
      const regex = /\[\[(.*?)\]\]/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        gaps.push(match);
      }
      const corrects = gaps
        .map(m => {
          const { correctOption } = parseGap(m[1] || '', separator);
          return correctOption;
        })
        .filter(Boolean);
      correctAnswer = corrects;
    }
    const toSave: Question = withFlagsFromKey({
      ...draftQuestion,
      correct_answer: correctAnswer,
      order_index: editingQuestionIndex !== null ? draftQuestion.order_index : quizQuestions.length,
    });

    if (editingQuestionIndex !== null) {
      // Update existing question
      const updatedQuestions = [...quizQuestions];
      updatedQuestions[editingQuestionIndex] = toSave;
      setQuizQuestions(updatedQuestions);
    } else {
      // Add new question
      setQuizQuestions([...quizQuestions, toSave]);
    }

    setShowQuestionModal(false);
    setDraftQuestion(null);
    setEditingQuestionIndex(null);
  };

  const uploadQuestionMedia = React.useCallback(async (file: File) => {
    setIsUploadingMedia(true);
    try {
      const result = await apiClient.uploadQuestionMedia(file);
      return result;
    } catch (error) {
      console.error('Error uploading media:', error);
      const errorMessage = error instanceof Error ? error.message : tr('courseAuthoring.quiz.media.uploadFailed');
      alert(errorMessage);
      return null;
    } finally {
      setIsUploadingMedia(false);
    }
  }, []);

  // Handle paste from clipboard for media
  const handleMediaPaste = React.useCallback(async (
    e: React.ClipboardEvent,
    onSuccess: (url: string, mediaType?: 'image' | 'pdf') => void
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const result = await uploadQuestionMedia(file);
            if (result?.file_url) {
              onSuccess(result.file_url, 'image');
            }
          } catch (error) {
            console.error('Error uploading pasted image:', error);
            alert(tr('courseAuthoring.quiz.media.pasteFailed'));
          }
          break;
        }
      }
    }
  }, [uploadQuestionMedia]);

  const handleQuestionMediaDrop = React.useCallback(async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return;

    const result = await uploadQuestionMedia(file);
    if (result) {
      const mediaType = file.type.startsWith('image/') ? 'image' : 'pdf';
      applyDraftUpdate({
        media_url: result.file_url,
        media_type: mediaType
      });
    }
  }, [uploadQuestionMedia, applyDraftUpdate]);

  const handleQuestionMediaPaste = React.useCallback(async (e: React.ClipboardEvent) => {
    await handleMediaPaste(e, (url, mediaType) => {
      applyDraftUpdate({
        media_url: url,
        media_type: mediaType || 'image'
      });
    });
  }, [handleMediaPaste, applyDraftUpdate]);

  const uploadQuizMedia = React.useCallback(async (file: File) => {
    setIsUploadingMedia(true);
    try {
      const result = await apiClient.uploadQuestionMedia(file);
      if (result) {
        setQuizMediaUrl(result.file_url);

        // Determine file type
        let fileType: 'audio' | 'pdf' | '' = '';
        if (file.type.startsWith('audio/')) {
          fileType = 'audio';
        } else if (file.type === 'application/pdf') {
          fileType = 'pdf';
        } else if (file.type.startsWith('image/')) {
          // For images, we still use 'pdf' as the media type but it will be rendered as image
          fileType = 'pdf';
        }

        setQuizMediaType(fileType);

        // Force "all at once" for PDF/image quizzes
        if (fileType === 'pdf' && setQuizDisplayMode) {
          setQuizDisplayMode('all_at_once');
        }
      }
      return result;
    } catch (error) {
      console.error('Error uploading quiz media:', error);
      const errorMessage = error instanceof Error ? error.message : tr('courseAuthoring.quiz.media.quizUploadFailed');
      alert(errorMessage);
      return null;
    } finally {
      setIsUploadingMedia(false);
    }
  }, [setQuizMediaUrl, setQuizMediaType, setQuizDisplayMode]);

  const handleQuizMediaPaste = React.useCallback(async (e: React.ClipboardEvent) => {
    if (quizType !== 'pdf') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await uploadQuizMedia(file);
          break;
        }
      }
    }
  }, [quizType, uploadQuizMedia]);

  const analyzeImageFile = React.useCallback(async (file: File, correctAnswers?: string, mode: 'sat' | 'nuet' = 'sat') => {
    setIsAnalyzingImage(true);
    try {
      const result = mode === 'nuet'
        ? await apiClient.analyzeNuetImage(file, correctAnswers)
        : await apiClient.analyzeSatImage(file, correctAnswers);
      console.log('Analysis result:', result);

      if (!result || result.success === false) {
        const message = (result && (result.explanation || result.error)) || tr('courseAuthoring.quiz.analyze.noData');
        alert(tr('courseAuthoring.quiz.analyze.failedWith', { message }));
        return;
      }

      // Check if we have a list of questions (new format)
      const questions = result.questions || [];
      
      if (questions.length > 0) {
        // Bulk import
        const newQuestions = questions.map((q: any, index: number) => {
          // Ensure options are properly formatted
          const options = Array.isArray(q.options) ? q.options : [];
          
          // Determine correct answer index
          let correctIndex = 0;
          if (typeof q.correct_answer === 'number') {
            correctIndex = q.correct_answer;
          } else if (typeof q.correct_answer === 'string') {
            // Try to match by letter if backend returns letter
            const idx = options.findIndex((opt: any) => opt.letter === q.correct_answer);
            if (idx >= 0) correctIndex = idx;
          }

          // Ensure options are properly formatted with all required fields
          const formattedOptions = Array.isArray(options) && options.length > 0 
            ? options.map((opt: any, optIdx: number) => ({
                id: Date.now().toString() + '_' + index + '_opt_' + optIdx,
                text: opt.text || opt || '',
                is_correct: opt.is_correct || false,
                letter: opt.letter || ['A', 'B', 'C', 'D', 'E'][optIdx] || ''
              }))
            : [];

          return {
            id: Date.now().toString() + '_' + index + '_' + Math.random().toString(36).substr(2, 9),
            assignment_id: '',
            question_text: q.question_text || '',
            question_type: q.question_type || 'single_choice',
            options: formattedOptions,
            correct_answer: correctIndex,
            points: 1,
            order_index: quizQuestions.length + index,
            explanation: q.explanation || '',
            original_image_url: result.file_url, // Use the uploaded file URL
            is_sat_question: true,
            content_text: q.content_text || '',
            needs_image: q.needs_image
          };
        });

        setQuizQuestions([...quizQuestions, ...newQuestions]);
        setShowSatImageModal(false);
        alert(tr('courseAuthoring.quiz.analyze.imported', { count: newQuestions.length }));
      } else {
        // Fallback for single question (old format or single result)
        // Convert SAT format to our Question format
        const optionsArray = Array.isArray(result.options) ? result.options : [];
        const correctIndex = optionsArray.findIndex((opt: any) => opt.letter === result.correct_answer);
  
        const satQuestion: Question = {
          id: Date.now().toString(),
          assignment_id: '',
          question_text: result.question_text || '',
          question_type: 'single_choice',
          options: optionsArray.map((opt: any, index: number) => ({
            id: Date.now().toString() + '_' + index,
            text: opt.text || '',
            is_correct: opt.letter === result.correct_answer,
            letter: opt.letter
          })) || [],
          correct_answer: correctIndex >= 0 ? correctIndex : 0,
          points: 1,
          order_index: quizQuestions.length,
          explanation: result.explanation || '',
          original_image_url: result.image_url,
          is_sat_question: true,
          content_text: result.content_text || ''
        };
  
        setDraftQuestion(satQuestion);
        setEditingQuestionIndex(null);
        setShowSatImageModal(false);
        setShowQuestionModal(true);
      }
    } catch (error) {
      console.error('Error analyzing file:', error);
      alert(tr('courseAuthoring.quiz.analyze.failed'));
    } finally {
      setIsAnalyzingImage(false);
    }
  }, [quizQuestions.length]);

  const handleSatImagePaste = React.useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setUploadedFile(file);
          break;
        }
      }
    }
  }, []);

  const handleSatImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
  };

  const handleAnalyzeClick = async () => {
    if (!uploadedFile) return;
    await analyzeImageFile(uploadedFile, correctAnswersText, analyzeMode);
  };

  // Global paste handler for the entire component
  React.useEffect(() => {
    const handleGlobalPaste = async (event: ClipboardEvent) => {
      // Only handle paste if SAT modal is open
      if (!showSatImageModal) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            setUploadedFile(file);
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, [showSatImageModal, analyzeImageFile, correctAnswersText]);

  // Keyboard shortcut for Preview (Cmd+O or Ctrl+O)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if question modal is open
      if (!showQuestionModal || !draftQuestion) return;

      // Cmd+O (Mac) or Ctrl+O (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'o') {
        event.preventDefault();
        setShowPreviewModal(true);
      }

      // Cmd+H (Mac) or Ctrl+H (Windows/Linux) for Help
      if ((event.metaKey || event.ctrlKey) && event.key === 'h') {
        event.preventDefault();
        setShowHelpModal(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showQuestionModal, draftQuestion]);

  // Close preview modal with Esc key
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showPreviewModal && event.key === 'Escape') {
        event.preventDefault();
        setShowPreviewModal(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPreviewModal]);


  return (
    <div className="space-y-6 p-1">
      {/* Quiz Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quiz-title">{tr('courseAuthoring.quiz.title')}</Label>
          <Input
            id="quiz-title"
            type="text"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder={tr('courseAuthoring.quiz.titlePlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{tr('courseAuthoring.quiz.maxScore')}</Label>
          <Input
            id="max-score"
            type="number"
            value={quizQuestions.length}
            onChange={() => {
              // This should probably be calculated automatically, not set manually
              // For now, just ignore the input
            }}
            min="1"
            placeholder={tr('courseAuthoring.quiz.autoCalculated')}
            disabled
          />
        </div>
        {setQuizPassingScorePercent && (
          <div className="space-y-2">
            <Label htmlFor="quiz-passing-score">{tr('courseAuthoring.quiz.passingScore')}</Label>
            <Input
              id="quiz-passing-score"
              type="number"
              min={0}
              max={100}
              value={quizPassingScorePercent ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  setQuizPassingScorePercent(undefined)
                  return
                }
                const parsed = Number(raw)
                if (Number.isNaN(parsed)) return
                setQuizPassingScorePercent(Math.min(100, Math.max(0, parsed)))
              }}
              placeholder={
                isOptionalStep
                  ? String(DEFAULT_QUIZ_PASSING_SCORE_OPTIONAL)
                  : String(DEFAULT_QUIZ_PASSING_SCORE_REQUIRED)
              }
            />
            <p className="text-xs text-muted-foreground">
              {isOptionalStep
                ? tr('courseAuthoring.quiz.passingDefaultOptional', { value: DEFAULT_QUIZ_PASSING_SCORE_OPTIONAL })
                : tr('courseAuthoring.quiz.passingDefault', { value: DEFAULT_QUIZ_PASSING_SCORE_REQUIRED })}
            </p>
          </div>
        )}
      </div>

      {/* Quiz Type Selection */}
      <div className="space-y-3">
        <Label>{tr('courseAuthoring.quiz.type')}</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizType === 'regular' ? 'border-brand bg-brand-surface' : 'border-border hover:border-input'
              }`}
            onClick={() => setQuizType('regular')}
          >
            <div className="font-medium">{tr('courseAuthoring.quiz.typeRegular')}</div>
            <div className="text-sm text-muted-foreground">{tr('courseAuthoring.quiz.typeRegularHint')}</div>
          </div>
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizType === 'text_based' ? 'border-brand bg-brand-surface' : 'border-border hover:border-input'
              }`}
            onClick={() => setQuizType('text_based')}
          >
            <div className="font-medium">{tr('courseAuthoring.quiz.typeText')}</div>
            <div className="text-sm text-muted-foreground">{tr('courseAuthoring.quiz.typeTextHint')}</div>
          </div>
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizType === 'audio' ? 'border-brand bg-brand-surface' : 'border-border hover:border-input'
              }`}
            onClick={() => setQuizType('audio')}
          >
            <div className="font-medium">{tr('courseAuthoring.quiz.typeAudio')}</div>
            <div className="text-sm text-muted-foreground">{tr('courseAuthoring.quiz.typeAudioHint')}</div>
          </div>
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizType === 'pdf' ? 'border-brand bg-brand-surface' : 'border-border hover:border-input'
              }`}
            onClick={() => setQuizType('pdf')}
          >
            <div className="font-medium">{tr('courseAuthoring.quiz.typeDocument')}</div>
            <div className="text-sm text-muted-foreground">{tr('courseAuthoring.quiz.typeDocumentHint')}</div>
          </div>
        </div>
      </div>

      {/* Text Content for Text-Based Quizzes */}
      {quizType === 'text_based' && (
        <div className="space-y-3">
          <Label>{tr('courseAuthoring.quiz.passageText')}</Label>
          <RichTextEditor
            value={quizMediaUrl}
            onChange={(value) => {
              setQuizMediaUrl(value);
              setQuizMediaType('text');
            }}
            placeholder={tr('courseAuthoring.quiz.passagePlaceholder')}
          />
          <p className="text-sm text-muted-foreground">
            {tr('courseAuthoring.quiz.passageHint')}
          </p>
        </div>
      )}

      {/* Media Upload for Audio/PDF Quizzes */}
      {(quizType === 'audio' || quizType === 'pdf') && (
        <div className="space-y-3">
          <Label>{quizType === 'audio' ? tr('courseAuthoring.quiz.audioFile') : tr('courseAuthoring.quiz.documentFile')}</Label>
          <div
            className="space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg"
            onPaste={quizType === 'pdf' ? handleQuizMediaPaste : undefined}
            tabIndex={quizType === 'pdf' ? 0 : -1}
            role={quizType === 'pdf' ? 'button' : undefined}
            aria-label={quizType === 'pdf'
              ? tr('courseAuthoring.quiz.documentAreaAria')
              : undefined}
          >
          {quizMediaUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {quizType === 'audio' ? (
                    <>
                      <Music className="h-4 w-4" aria-hidden="true" />
                      <span className="font-medium">{tr('courseAuthoring.quiz.audioUploaded')}</span>
                    </>
                  ) : isImageMediaUrl(quizMediaUrl) ? (
                    <>
                      <Image className="w-5 h-5 text-brand" />
                      <span className="font-medium">{tr('courseAuthoring.quiz.imageUploaded')}</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <span className="font-medium">{tr('courseAuthoring.quiz.pdfUploaded')}</span>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuizMediaUrl('');
                    setQuizMediaType('');
                  }}
                >
                  {tr('courseAuthoring.quiz.remove')}
                </Button>
              </div>

              {quizType === 'audio' && (
                <audio
                  controls
                  src={backendUrl + quizMediaUrl}
                  className="w-full max-w-md"
                />
              )}

              {quizType === 'pdf' && isImageMediaUrl(quizMediaUrl) && (
                <div className="relative bg-muted border rounded-lg overflow-hidden">
                  <div className="aspect-[4/3] relative flex items-center justify-center bg-muted">
                    <img
                      src={backendUrl + quizMediaUrl}
                      alt={tr('courseAuthoring.quiz.referenceAlt')}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="p-2 bg-card border-t">
                    <p className="text-xs font-medium text-foreground truncate">
                      {getMediaFilename(quizMediaUrl)}
                    </p>
                  </div>
                </div>
              )}

              {quizType === 'pdf' && !isImageMediaUrl(quizMediaUrl) && (
                <PDFPreview
                  filename={getMediaFilename(quizMediaUrl)}
                  fileUrl={quizMediaUrl}
                  fileSize={0}
                  showFullPreview={false}
                />
              )}

              {quizType === 'pdf' && (
                <p className="text-xs text-muted-foreground">
                  {tr('courseAuthoring.quiz.pasteToReplace')}
                </p>
              )}
            </div>
          ) : (
            <div
              className="text-center border-2 border-dashed border-input rounded-lg p-6 hover:border-brand transition-colors"
              onDrop={async (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const isValidType = quizType === 'audio'
                    ? file.type.startsWith('audio/')
                    : file.type === 'application/pdf' || file.type.startsWith('image/');
                  if (isValidType) {
                    await uploadQuizMedia(file);
                  } else {
                    alert(quizType === 'audio' ? tr('courseAuthoring.quiz.wrongTypeAudio') : tr('courseAuthoring.quiz.wrongTypeDocument'));
                  }
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-sm text-muted-foreground mb-2">
                {quizType === 'audio'
                  ? tr('courseAuthoring.quiz.dropAudio')
                  : tr('courseAuthoring.quiz.dropDocument')
                }
              </div>
              {quizType === 'pdf' && (
                <div className="text-xs text-muted-foreground mb-3">
                  {tr('courseAuthoring.quiz.orPaste')}
                </div>
              )}
              <input
                type="file"
                accept={quizType === 'audio' ? 'audio/*' : '.pdf,image/*'}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await uploadQuizMedia(file);
                  }
                }}
                className="hidden"
                id={`quiz-media-upload-${quizType}`}
              />
              <label htmlFor={`quiz-media-upload-${quizType}`} className="cursor-pointer">
                <Button variant="outline" size="sm" disabled={isUploadingMedia} asChild>
                  <span>
                    {isUploadingMedia ? tr('courseAuthoring.upload.uploading') : quizType === 'audio' ? tr('courseAuthoring.quiz.chooseAudio') : tr('courseAuthoring.quiz.chooseDocument')}
                  </span>
                </Button>
              </label>
            </div>
          )}
          </div>
        </div>
      )}

      {/* Audio Playback Mode Selection */}
      {quizType === 'audio' && setAudioPlaybackMode && (
        <div className="space-y-3">
          <Label>{tr('adminTools.quiz.audioMode')}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                audioPlaybackMode === 'flexible' 
                  ? 'border-brand bg-brand-surface' 
                  : 'border-border hover:border-input'
              }`}
              onClick={() => setAudioPlaybackMode('flexible')}
            >
              <div className="flex items-center gap-2 mb-2">
                <Headphones className="h-5 w-5 text-foreground/80" aria-hidden="true" />
                <span className="font-medium">{tr('adminTools.quiz.audioFlexible')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tr('adminTools.quiz.audioFlexibleHint')}
              </p>
            </div>
            <div
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                audioPlaybackMode === 'strict' 
                  ? 'border-brand bg-brand-surface' 
                  : 'border-border hover:border-input'
              }`}
              onClick={() => setAudioPlaybackMode('strict')}
            >
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-5 w-5 text-foreground/80" aria-hidden="true" />
                <span className="font-medium">{tr('adminTools.quiz.audioStrict')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tr('adminTools.quiz.audioStrictHint')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="time-limit">{tr('courseAuthoring.quiz.timeLimit')}</Label>
        <Input
          id="time-limit"
          type="number"
          value={quizTimeLimit || ''}
          onChange={(e) => setQuizTimeLimit(e.target.value ? parseInt(e.target.value) : undefined)}
          min="1"
          placeholder={tr('courseAuthoring.quiz.timeLimitPlaceholder')}
        />
      </div>

      {setQuizDisplayMode && (
        <div className="space-y-2">
          <Label>{tr('courseAuthoring.quiz.displayMode')}</Label>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`p-3 border-2 rounded-lg transition-colors ${quizType === 'pdf'
                ? 'opacity-50 cursor-not-allowed border-border bg-muted'
                : `cursor-pointer ${quizDisplayMode === 'one_by_one'
                  ? 'border-brand bg-brand-surface'
                  : 'border-border hover:border-input'
                }`
                }`}
              onClick={() => {
                if (quizType !== 'pdf' && quizType !== 'audio') {
                  setQuizDisplayMode('one_by_one');
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-brand rounded-full flex items-center justify-center">
                  {quizDisplayMode === 'one_by_one' && <div className="w-2 h-2 bg-brand-solid rounded-full"></div>}
                </div>
                <div>
                  <div className="font-medium text-sm">{tr('courseAuthoring.quiz.oneByOne')}</div>
                  <div className="text-xs text-muted-foreground">{tr('courseAuthoring.quiz.oneByOneHint')}</div>
                  {quizType === 'pdf' || quizType === 'audio' && <div className="text-xs text-muted-foreground">{tr('courseAuthoring.quiz.oneByOneUnavailable')}</div>}
                </div>
              </div>
            </div>

            <div
              className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizDisplayMode === 'all_at_once'
                ? 'border-brand bg-brand-surface'
                : 'border-border hover:border-input'
                }`}
              onClick={() => setQuizDisplayMode('all_at_once')}
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-brand rounded-full flex items-center justify-center">
                  {quizDisplayMode === 'all_at_once' && <div className="w-2 h-2 bg-brand-solid rounded-full"></div>}
                </div>
                <div>
                  <div className="font-medium text-sm">{tr('courseAuthoring.quiz.allAtOnce')}</div>
                  <div className="text-xs text-muted-foreground">{tr('courseAuthoring.quiz.allAtOnceHint')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground">{tr('courseAuthoring.quiz.questionsCount', { count: quizQuestions.length })}</h3>
          <div className="flex gap-2">
            <Button onClick={() => setShowBulkUploadModal(true)} variant="outline">{tr('courseAuthoring.flashcards.bulkUpload')}</Button>
            <Button onClick={() => setShowSatImageModal(true)} variant="outline">{tr('courseAuthoring.quiz.analyzeSat')}</Button>
            <Button onClick={openAddQuestion} variant="default">{tr('courseAuthoring.quiz.addQuestion')}</Button>
          </div>
        </div>

        <div className="space-y-4">
          {quizQuestions.map((q, idx) => {
            const validation = getQuestionValidationStatus(q);
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
            
            return (
              <div key={q.id} id={`question-${q.id}`} className={`rounded-lg border bg-card overflow-hidden ${!validation.isValid ? 'border-red-300 dark:border-red-800' : 'border-border'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted border-b">
                  <div className="flex items-center gap-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveQuestionUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={tr('courseAuthoring.quiz.moveUp')}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveQuestionDown(idx)}
                        disabled={idx === quizQuestions.length - 1}
                        className="p-1 rounded hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={tr('courseAuthoring.quiz.moveDown')}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-brand-solid text-white flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">
                        {QUESTION_TYPE_LABELS[q.question_type] ? tr(QUESTION_TYPE_LABELS[q.question_type]) : q.question_type}
                      </span>
                      {q.difficulty && <span className="ml-2 text-[10px] uppercase text-muted-foreground">{DIFFICULTY_LABELS[q.difficulty] ? tr(DIFFICULTY_LABELS[q.difficulty]) : q.difficulty}</span>}
                      {!validation.isValid && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded dark:text-red-400 dark:bg-red-950/40">
                          {validation.errors[0]}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={() => openEditQuestion(idx)} variant="outline" size="sm">
                      {tr('common.edit')}
                    </Button>
                    <Button onClick={() => removeQuestion(idx)} variant="destructive" size="sm">
                      {tr('courseAuthoring.quiz.remove')}
                    </Button>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="p-4">
                  {/* Image Content Type */}
                  {q.question_type === 'image_content' && (
                    <div className="flex flex-col items-center">
                      {q.media_url ? (
                        <img
                          src={`${backendUrl}${q.media_url}`}
                          alt={tr('courseAuthoring.quiz.questionImageAlt')}
                          className="max-w-full max-h-64 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-muted-foreground italic">{tr('courseAuthoring.quiz.noImage')}</div>
                      )}
                      {q.question_text && (
                        <p className="text-sm text-muted-foreground mt-2">{q.question_text}</p>
                      )}
                    </div>
                  )}

                  {/* Media Question Types */}
                  {(q.question_type === 'media_question' || q.question_type === 'media_open_question') && (
                    <div className="space-y-3">
                      {q.media_url && (
                        <div className="mb-3">
                          {q.media_type === 'image' ? (
                            <img
                              src={`${backendUrl}${q.media_url}`}
                              alt={tr('courseAuthoring.quiz.questionMediaAlt')}
                              className="max-w-full max-h-48 object-contain rounded-lg"
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded">
                              <FileText className="w-4 h-4" />
                              {tr('courseAuthoring.quiz.pdfAttached')}
                            </div>
                          )}
                        </div>
                      )}
                      <div 
                        className="text-foreground"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.question_text || '')) }}
                      />
                      {q.question_type === 'media_question' && q.options && q.options.length > 0 && (
                        <div className="space-y-2 mt-3">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={opt.id || optIdx}
                              className={`flex items-center gap-2 p-2 rounded border ${
                                q.correct_answer === optIdx ? 'bg-green-50 border-green-300 dark:bg-green-950/40 dark:border-green-800' : 'bg-muted border-border'
                              }`}
                            >
                              <span className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-xs font-medium">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="flex-1">{opt.text ? <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(opt.text)) }} /> : <span className="text-muted-foreground italic">{tr('courseAuthoring.quiz.emptyOption')}</span>}</span>
                              {q.correct_answer === optIdx && (
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Single/Multiple Choice */}
                  {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && (
                    <div className="space-y-3">
                      <div 
                        className="text-foreground font-medium"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.question_text || '')) }}
                      />
                      {q.options && q.options.length > 0 && (
                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = q.question_type === 'multiple_choice'
                              ? Array.isArray(q.correct_answer) && q.correct_answer.includes(optIdx)
                              : q.correct_answer === optIdx;
                            return (
                              <div
                                key={opt.id || optIdx}
                                className={`flex items-center gap-2 p-2 rounded border ${
                                  isCorrect ? 'bg-green-50 border-green-300 dark:bg-green-950/40 dark:border-green-800' : 'bg-muted border-border'
                                }`}
                              >
                                <span className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-xs font-medium">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="flex-1">{opt.text ? <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(opt.text)) }} /> : <span className="text-muted-foreground italic">{tr('courseAuthoring.quiz.emptyOption')}</span>}</span>
                                {isCorrect && (
                                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Short Answer */}
                  {q.question_type === 'short_answer' && (
                    <div className="space-y-3">
                      <div 
                        className="text-foreground font-medium"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.question_text || '')) }}
                      />
                      <div className="text-sm">
                        <span className="text-muted-foreground">{tr('courseAuthoring.quiz.correctAnswerLabel')}</span>{' '}
                        <span className="font-medium text-green-700 dark:text-green-300">{q.correct_answer || tr('courseAuthoring.quiz.notSet')}</span>
                      </div>
                    </div>
                  )}

                  {/* Fill in the Blank / Text Completion */}
                  {(q.question_type === 'fill_blank' || q.question_type === 'text_completion') && (
                    <div className="space-y-3">
                      {q.question_text && (
                        <div 
                          className="text-foreground font-medium"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.question_text)) }}
                        />
                      )}
                      <div className="bg-muted p-3 rounded border text-sm">
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: sanitizeHtml(renderTextWithLatex(
                              (q.content_text || '').replace(
                                /\[\[([^\]]+)\]\]/g,
                                '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded border border-green-300 font-medium">$1</span> dark:bg-green-900/40 dark:text-green-300 dark:border-green-800'
                              )
                            ))
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Long Text */}
                  {q.question_type === 'long_text' && (
                    <div className="space-y-3">
                      <div 
                        className="text-foreground font-medium"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.question_text || '')) }}
                      />
                      <div className="text-sm text-muted-foreground italic">
                        {tr('courseAuthoring.quiz.longTextExpected')}
                      </div>
                    </div>
                  )}

                  {/* Matching */}
                  {q.question_type === 'matching' && q.matching_pairs && (
                    <div className="space-y-3">
                      <div 
                        className="text-foreground font-medium"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(q.question_text || tr('courseAuthoring.quiz.matchFollowing'))) }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          {q.matching_pairs.map((pair, pairIdx) => (
                            <div key={pairIdx} className="p-2 bg-brand-surface rounded border border-brand-border text-sm">
                              {pair.left || <span className="text-muted-foreground italic">{tr('courseAuthoring.quiz.empty')}</span>}
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {q.matching_pairs.map((pair, pairIdx) => (
                            <div key={pairIdx} className="p-2 bg-green-50 rounded border border-green-200 text-sm dark:bg-green-950/40 dark:border-green-800/60">
                              {pair.right || <span className="text-muted-foreground italic">{tr('courseAuthoring.quiz.empty')}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {quizQuestions.length === 0 && (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              <p>{tr('courseAuthoring.quiz.noQuestions')}</p>
            </CardContent>
          </Card>
        )}

      </div>

      {showQuestionModal && draftQuestion && createPortal(
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[1001] flex items-center justify-center min-h-screen">
            <div
              className="bg-card rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl"
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingQuestionIndex !== null ? tr('courseAuthoring.quiz.editQuestion') : tr('courseAuthoring.quiz.addQuestion')}
                </h3>
                <div className="flex gap-2">
                  <div className="flex flex-col items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreviewModal(true)}
                      className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    >
                      {tr('courseAuthoring.create.previewAlt')}
                    </Button>
                    <div className="text-xs text-muted-foreground mt-1">⌘+O</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHelpModal(true)}
                      className="text-brand hover:text-brand"
                    >
                      {tr('courseAuthoring.quiz.helpButton')}
                    </Button>
                    <div className="text-xs text-muted-foreground mt-1">⌘+H</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-muted-foreground">{tr('courseAuthoring.quiz.difficulty')}</label>
                <select
                  className="h-8 rounded border bg-transparent px-2 text-xs"
                  value={draftQuestion.difficulty || ''}
                  onChange={(e) => applyDraftUpdate({ difficulty: (e.target.value || undefined) as any })}
                >
                  <option value="">{tr('courseAuthoring.quiz.difficultyNone')}</option>
                  <option value="easy">{tr('courseAuthoring.quiz.difficultyEasy')}</option>
                  <option value="medium">{tr('courseAuthoring.quiz.difficultyMedium')}</option>
                  <option value="hard">{tr('courseAuthoring.quiz.difficultyHard')}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left side - Passage and Explanation */}
                {draftQuestion.is_sat_question && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{tr('courseAuthoring.quiz.content')}</Label>
                        {draftQuestion.question_type === 'text_completion' && (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentText = draftQuestion.content_text || '';
                                // Replace "1. ", "2. " etc with empty string
                                const newText = currentText.replace(/\d+\.\s*/g, '');
                                applyDraftUpdate({ content_text: newText });
                              }}
                              className="text-xs"
                            >
                              {tr('courseAuthoring.quiz.removeNumbering')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentText = draftQuestion.content_text || '';
                                // Replace all [ ] with [[ ]]
                                const newText = currentText.replace(/\[([^\]]+)\]/g, '[[$1]]');
                                applyDraftUpdate({ content_text: newText });
                              }}
                              className="text-xs"
                            >
                              {tr('courseAuthoring.quiz.convertBrackets')}
                            </Button>
                          </div>
                        )}
                      </div>
                      <Tabs defaultValue="passage" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="passage">{tr('courseAuthoring.quiz.passage')}</TabsTrigger>
                          <TabsTrigger value="explanation">{tr('courseAuthoring.quiz.explanation')}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="passage" className="space-y-2">
                          <RichTextEditor
                            value={draftQuestion.content_text || ''}
                            onChange={(value) => {
                              console.log('RichTextEditor onChange:', value); // Debug log
                              // For text_completion questions, extract answers and update both content and answers
                              if (draftQuestion.question_type === 'text_completion') {
                                const regex = /\[\[(.*?)\]\]/g;
                                const gaps = [];
                                let match;
                                while ((match = regex.exec(value)) !== null) {
                                  gaps.push(match);
                                }
                                const answers = gaps.map(match => (match as RegExpMatchArray)[1].trim());
                                console.log('Extracted answers:', answers); // Debug log

                                // Use setTimeout to avoid potential race conditions with RichTextEditor
                                setTimeout(() => {
                                  applyDraftUpdate({
                                    content_text: value,
                                    correct_answer: answers
                                  });
                                }, 0);
                              } else {
                                applyDraftUpdate({ content_text: value });
                              }
                            }}
                            placeholder={tr('courseAuthoring.quiz.passageGapsPlaceholder')}
                            className="min-h-[200px]"
                          />
                          {(draftQuestion.content_text || '').trim() && (
                            <div className="text-xs text-muted-foreground p-2 bg-muted rounded border dark:border-gray-700 max-h-32 overflow-y-auto">
                              {tr('courseAuthoring.latex.preview')} <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex((draftQuestion.content_text || '').replace(/\[\[(.*?)\]\]/g, '<b>[$1]</b>'))) }} />
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="explanation" className="space-y-2">
                          <RichTextEditor
                            value={draftQuestion.explanation || ''}
                            onChange={(value) => applyDraftUpdate({ explanation: value })}
                            placeholder={tr('courseAuthoring.quiz.explanationPlaceholder')}
                            className="min-h-[200px]"
                          />
                          {(draftQuestion.explanation || '').trim() && (
                            <div className="text-xs text-muted-foreground p-2 bg-muted rounded border dark:border-gray-700 max-h-32 overflow-y-auto">
                              {tr('courseAuthoring.latex.preview')} <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(draftQuestion.explanation || '')) }} />
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                )}

                {/* Right side - Question settings and options */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{tr('courseAuthoring.quiz.questionText')}</Label>
                    <Input
                      value={draftQuestion.question_text}
                      onChange={(e) => applyDraftUpdate({ question_text: e.target.value })}
                      placeholder={tr('courseAuthoring.quiz.questionTextPlaceholder')}
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{tr('courseAuthoring.quiz.points')}</Label>
                      <Input
                        type="number"
                        value={draftQuestion.points}
                        onChange={(e) => applyDraftUpdate({ points: parseInt(e.target.value) || 0 })}
                        min={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{tr('courseAuthoring.quiz.questionType')}</Label>
                      <Select
                        value={draftQuestion.question_type}
                        onValueChange={(val) => {
                          const next: any = { ...draftQuestion };
                          if (val === 'single_choice') {
                            next.question_type = val;
                            if (Array.isArray(draftQuestion.correct_answer)) {
                              const nums = draftQuestion.correct_answer.filter(
                                (i: unknown) => typeof i === 'number' && i >= 0
                              ) as number[];
                              next.correct_answer = nums.length > 0 ? nums[0] : 0;
                            } else {
                              next.correct_answer =
                                typeof draftQuestion.correct_answer === 'number'
                                  ? draftQuestion.correct_answer
                                  : 0;
                            }
                            // Ensure options exist for single choice
                            if (!next.options || next.options.length === 0) {
                              const ts = Date.now().toString();
                              next.options = [
                                { id: ts + '_1', text: '', is_correct: false, letter: 'A' },
                                { id: ts + '_2', text: '', is_correct: false, letter: 'B' },
                                { id: ts + '_3', text: '', is_correct: false, letter: 'C' },
                                { id: ts + '_4', text: '', is_correct: false, letter: 'D' },
                              ];
                            }
                          } else if (val === 'multiple_choice') {
                            next.question_type = val;
                            if (Array.isArray(draftQuestion.correct_answer)) {
                              const nums = draftQuestion.correct_answer.filter(
                                (i: unknown) => typeof i === 'number' && i >= 0
                              ) as number[];
                              next.correct_answer = nums.length > 0 ? nums : [0];
                            } else if (typeof draftQuestion.correct_answer === 'number') {
                              next.correct_answer = [draftQuestion.correct_answer];
                            } else {
                              next.correct_answer = [0];
                            }
                            if (!next.options || next.options.length === 0) {
                              const ts = Date.now().toString();
                              next.options = [
                                { id: ts + '_1', text: '', is_correct: false, letter: 'A' },
                                { id: ts + '_2', text: '', is_correct: false, letter: 'B' },
                                { id: ts + '_3', text: '', is_correct: false, letter: 'C' },
                                { id: ts + '_4', text: '', is_correct: false, letter: 'D' },
                              ];
                            }
                          } else if (val === 'media_question') {
                            next.question_type = val;
                            next.correct_answer = typeof draftQuestion.correct_answer === 'number' ? draftQuestion.correct_answer : 0;
                            // Ensure options exist for media question
                            if (!next.options || next.options.length === 0) {
                              const ts = Date.now().toString();
                              next.options = [
                                { id: ts + '_1', text: '', is_correct: false, letter: 'A' },
                                { id: ts + '_2', text: '', is_correct: false, letter: 'B' },
                                { id: ts + '_3', text: '', is_correct: false, letter: 'C' },
                                { id: ts + '_4', text: '', is_correct: false, letter: 'D' },
                              ];
                            }
                          } else if (val === 'short_answer') {
                            next.question_type = 'short_answer';
                            next.correct_answer = '';
                            next.options = undefined; // Clear options for short_answer
                          } else if (val === 'fill_blank') {
                            next.question_type = 'fill_blank';
                            next.correct_answer = typeof draftQuestion.correct_answer === 'string' ? draftQuestion.correct_answer : '';
                            next.options = undefined; // Clear options for fill_blank
                            next.gap_separator = next.gap_separator || ','; // Set default separator
                          } else if (val === 'text_completion') {
                            next.question_type = 'text_completion';
                            next.correct_answer = [];
                            next.options = undefined; // Clear options for text_completion
                            // Auto-extract answers if content_text already has gaps
                            if (next.content_text) {
                              const regex = /\[\[(.*?)\]\]/g;
                              const gaps = [];
                              let match;
                              while ((match = regex.exec(next.content_text)) !== null) {
                                gaps.push(match);
                              }
                              const answers = gaps.map(match => (match as RegExpMatchArray)[1].trim());
                              next.correct_answer = answers;
                            }
                          } else if (val === 'long_text') {
                            next.question_type = 'long_text';
                            next.correct_answer = '';
                            next.options = undefined; // Clear options for long_text
                          } else if (val === 'media_open_question') {
                            next.question_type = val;
                            next.correct_answer = typeof draftQuestion.correct_answer === 'string' ? draftQuestion.correct_answer : '';
                            next.options = undefined; // No options for open answer
                          } else if (val === 'matching') {
                            next.question_type = 'matching';
                            next.options = undefined; // No options for matching
                            // Initialize matching pairs if not present
                            if (!next.matching_pairs || next.matching_pairs.length === 0) {
                              next.matching_pairs = [
                                { left: '', right: '' },
                                { left: '', right: '' },
                              ];
                            }
                            next.correct_answer = next.matching_pairs.map((_: { left: string; right: string }, i: number) => i);
                          } else if (val === 'image_content') {
                            next.question_type = 'image_content';
                            next.correct_answer = null; // No answer needed
                            next.options = undefined; // No options
                            next.points = 0; // No points for image content
                          }
                          setDraftQuestion(next);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tr('courseAuthoring.quiz.questionTypePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_choice">{tr('courseAuthoring.quiz.pickSingle')}</SelectItem>
                          <SelectItem value="multiple_choice">{tr('courseAuthoring.quiz.pickMultiple')}</SelectItem>
                          <SelectItem value="short_answer">{tr('courseAuthoring.quiz.pickShort')}</SelectItem>
                          <SelectItem value="fill_blank">{tr('courseAuthoring.quiz.pickFillBlank')}</SelectItem>
                          <SelectItem value="text_completion">{tr('courseAuthoring.quiz.pickTextCompletion')}</SelectItem>
                          <SelectItem value="long_text">{tr('courseAuthoring.quiz.pickLongText')}</SelectItem>
                          <SelectItem value="media_question">{tr('courseAuthoring.quiz.pickMedia')}</SelectItem>
                          <SelectItem value="media_open_question">{tr('courseAuthoring.quiz.pickMediaOpen')}</SelectItem>
                          <SelectItem value="matching">{tr('courseAuthoring.quiz.pickMatching')}</SelectItem>
                          <SelectItem value="image_content">{tr('courseAuthoring.quiz.pickImage')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Media Upload for Media Questions */}
                  {(draftQuestion.question_type === 'media_question' || draftQuestion.question_type === 'media_open_question' || draftQuestion.question_type === 'image_content') && (
                    <div className="space-y-2">
                      <Label>{draftQuestion.question_type === 'image_content' ? tr('courseAuthoring.quiz.qtype.image') : tr('courseAuthoring.quiz.mediaAttachment')}</Label>
                      {draftQuestion.question_type === 'image_content' && (
                        <p className="text-sm text-muted-foreground">
                          {tr('courseAuthoring.quiz.imageContentHint')}
                        </p>
                      )}
                      <div
                        className="border-2 border-dashed border-input rounded-lg p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        onPaste={handleQuestionMediaPaste}
                        onDrop={async (e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            await handleQuestionMediaDrop(file);
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={(e) => e.preventDefault()}
                        tabIndex={0}
                        role="button"
                        aria-label={tr('courseAuthoring.quiz.mediaAreaAria')}
                      >
                        {draftQuestion.media_url ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {draftQuestion.media_type === 'pdf' ? (
                                <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                              ) : (
                                <Image className="w-5 h-5 text-brand" />
                              )}
                              <span className="text-sm font-medium">{tr('courseAuthoring.quiz.mediaAttached')}</span>
                            </div>
                            {draftQuestion.media_type === 'image' && (
                              <div className="relative bg-muted border rounded-lg overflow-hidden">
                                <div className="aspect-[4/3] relative flex items-center justify-center bg-muted">
                                  <img
                                    src={backendUrl + draftQuestion.media_url}
                                    alt={tr('courseAuthoring.quiz.questionMediaAlt')}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                              </div>
                            )}
                            {draftQuestion.media_type === 'pdf' && draftQuestion.media_url && (
                              <PDFPreview
                                filename={getMediaFilename(draftQuestion.media_url)}
                                fileUrl={draftQuestion.media_url}
                                fileSize={0}
                                showFullPreview={false}
                              />
                            )}
                            <p className="text-xs text-muted-foreground">
                              {tr('courseAuthoring.quiz.pasteToReplace')}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applyDraftUpdate({ media_url: undefined, media_type: undefined })}
                            >
                              {tr('courseAuthoring.quiz.removeMedia')}
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center p-2">
                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                            <div className="text-sm text-muted-foreground mb-2">
                              {tr('courseAuthoring.quiz.dropPdfOrImage')}
                            </div>
                            <div className="text-xs text-muted-foreground mb-3">
                              {tr('courseAuthoring.quiz.orPasteArea')}
                            </div>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const result = await uploadQuestionMedia(file);
                                  if (result) {
                                    const mediaType = file.type.startsWith('image/') ? 'image' : 'pdf';
                                    applyDraftUpdate({
                                      media_url: result.file_url,
                                      media_type: mediaType
                                    });
                                  }
                                }
                              }}
                              className="hidden"
                              id={`media-upload-${draftQuestion?.id || 'new'}`}
                            />
                            <label htmlFor={`media-upload-${draftQuestion?.id || 'new'}`} className="cursor-pointer">
                              <Button variant="outline" size="sm" disabled={isUploadingMedia} asChild>
                                <span>
                                  {isUploadingMedia ? tr('courseAuthoring.upload.uploading') : tr('courseAuthoring.quiz.chooseFile')}
                                </span>
                              </Button>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Short Answer Configuration */}
                  {(draftQuestion.question_type === 'short_answer' || draftQuestion.question_type === 'media_open_question') && (
                      <div className="space-y-3">
                        <Label>{tr('courseAuthoring.quiz.correctAnswers')}</Label>
                        {(() => {
                          const answers = (draftQuestion.correct_answer || '').toString().split('|');
                          // Ensure at least one input
                          if (answers.length === 0 && !draftQuestion.correct_answer) answers.push('');
                          
                          return (
                            <div className="space-y-2">
                              {answers.map((ans: string, idx: number) => (
                                <div key={idx} className="flex gap-2">
                                  <Input
                                    type="text"
                                    value={ans}
                                    onChange={(e) => {
                                      const newAnswers = [...answers];
                                      newAnswers[idx] = e.target.value;
                                      applyDraftUpdate({ correct_answer: newAnswers.join('|') });
                                    }}
                                    placeholder={tr('courseAuthoring.quiz.variation', { n: idx + 1 })}
                                    className="flex-1"
                                  />
                                  {answers.length > 1 && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        const newAnswers = answers.filter((_: string, i: number) => i !== idx);
                                        applyDraftUpdate({ correct_answer: newAnswers.join('|') });
                                      }}
                                      className="shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentAnswers = (draftQuestion.correct_answer || '').toString().split('|');
                                  currentAnswers.push('');
                                  applyDraftUpdate({ correct_answer: currentAnswers.join('|') });
                                }}
                                className="mt-2"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                {tr('courseAuthoring.quiz.addVariation')}
                              </Button>
                            </div>
                          );
                        })()}
                        <p className="text-xs text-muted-foreground">
                          {tr('courseAuthoring.quiz.variationsHint')}
                        </p>
                        {(() => {
                          // What the grader will accept besides the variations written above, computed with
                          // the grader itself, and a warning for a key students will round (4.666 for 14/3).
                          const forms = acceptedFormsPreview(draftQuestion.correct_answer);
                          const truncated = truncatedDecimalKeys(draftQuestion.correct_answer);
                          return (
                            <>
                              {forms.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {tr('courseAuthoring.quiz.key.alsoAccepted', { forms: forms.join('   ') })}
                                </p>
                              )}
                              {truncated.length > 0 && (
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                  {tr('courseAuthoring.quiz.key.truncated', { key: truncated[0] })}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                  )}

                  {/* Text Completion Configuration */}
                  {draftQuestion.question_type === 'text_completion' && (
                    <div className="space-y-2">
                      <Label>{tr('courseAuthoring.quiz.gapAnswers')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {tr('courseAuthoring.quiz.gapAnswersHint')}
                      </p>

                      {/* Preview with detected gaps */}
                      {draftQuestion.content_text && (
                        <div className="space-y-2">
                          <div className="p-3 bg-muted border rounded-md text-sm">
                            <div className="font-medium mb-2">{tr('courseAuthoring.quiz.detectedGaps')}</div>
                            {(() => {
                              const text = (draftQuestion.content_text || '').toString();
                              const regex = /\[\[(.*?)\]\]/g;
                              const gaps = [];
                              let match;
                              while ((match = regex.exec(text)) !== null) {
                                gaps.push(match);
                              }
                              if (gaps.length === 0) {
                                return <div className="text-muted-foreground">{tr('courseAuthoring.quiz.noGapsDetected')}</div>;
                              }
                              return gaps.map((gap, index) => (
                                <div key={index} className="flex items-center gap-2 mb-2">
                                  <span className="text-muted-foreground">{tr('courseAuthoring.quiz.gapN', { n: index + 1 })}</span>
                                  <Input
                                    value={gap[1] || ''}
                                    onChange={(e) => {
                                      const text = (draftQuestion.content_text || '').toString();
                                      // Find specific instance of this gap using index
                                      const regex = /\[\[(.*?)\]\]/g;
                                      let match;
                                      let currentIndex = 0;
                                      let matchStart = -1;
                                      let matchLength = 0;
                                      
                                      while ((match = regex.exec(text)) !== null) {
                                        if (currentIndex === index) {
                                          matchStart = match.index;
                                          matchLength = match[0].length;
                                          break;
                                        }
                                        currentIndex++;
                                      }

                                      if (matchStart !== -1) {
                                        const newText = text.substring(0, matchStart) + 
                                                      `[[${e.target.value}]]` + 
                                                      text.substring(matchStart + matchLength);
                                        
                                        // Recalculate answers from the NEW text
                                        const newRegex = /\[\[(.*?)\]\]/g;
                                        const updatedGaps = [];
                                        let newMatch;
                                        while ((newMatch = newRegex.exec(newText)) !== null) {
                                          updatedGaps.push(newMatch);
                                        }
                                        const answers = updatedGaps.map(match => match[1].trim());
                                        
                                        // Apply both updates atomically
                                        applyDraftUpdate({ 
                                          content_text: newText,
                                          correct_answer: answers 
                                        });
                                      }
                                    }}
                                    placeholder={tr('courseAuthoring.quiz.correctAnswer')}
                                    className="w-32 text-sm"
                                  />
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Numbering option */}
                      <div className="flex items-center gap-2 mt-3">
                        <input
                          type="checkbox"
                          id="show-numbering"
                          checked={draftQuestion.show_numbering || false}
                          onChange={(e) => applyDraftUpdate({ show_numbering: e.target.checked })}
                          className="w-4 h-4 cursor-pointer accent-blue-600"
                        />
                        <label htmlFor="show-numbering" className="text-sm text-foreground/80 cursor-pointer">
                          {tr('courseAuthoring.quiz.showNumbering')}
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Long Text Answer Configuration */}
                  {draftQuestion.question_type === 'long_text' && (
                    <div className="space-y-2">
                      <Label>{tr('courseAuthoring.quiz.answerConfig')}</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expected-length">{tr('courseAuthoring.quiz.expectedLength')}</Label>
                          <Input
                            id="expected-length"
                            type="number"
                            value={draftQuestion.expected_length || ''}
                            onChange={(e) => applyDraftUpdate({ expected_length: parseInt(e.target.value) || undefined })}
                            placeholder={tr('courseAuthoring.quiz.expectedLengthPlaceholder')}
                            min="1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="keywords">{tr('courseAuthoring.quiz.keywords')}</Label>
                          <Input
                            id="keywords"
                            type="text"
                            value={draftQuestion.keywords?.join(', ') || ''}
                            onChange={(e) => {
                              const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                              applyDraftUpdate({ keywords: keywords.length > 0 ? keywords : undefined });
                            }}
                            placeholder={tr('courseAuthoring.quiz.keywordsPlaceholder')}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tr('courseAuthoring.quiz.keywordsHint')}
                      </div>
                    </div>
                  )}

                  {/* Show Options only for single_choice, multiple_choice, and media_question */}
                  {(draftQuestion.question_type === 'single_choice' ||
                    draftQuestion.question_type === 'multiple_choice' ||
                    draftQuestion.question_type === 'media_question') && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>{tr('courseAuthoring.quiz.optionsCount', { count: draftQuestion.options?.length || 0 })}</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{tr('courseAuthoring.quiz.optionPasteHint')}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const options = [...(draftQuestion.options || [])];
                                const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                                const newLetter = letters[options.length] || `${options.length + 1}`;
                                options.push({
                                  id: `opt_${Date.now()}_${options.length}`,
                                  text: '',
                                  is_correct: false,
                                  letter: newLetter
                                });
                                applyDraftUpdate({ options });
                              }}
                              className="text-xs h-7"
                            >
                              {tr('courseAuthoring.quiz.addOption')}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {(draftQuestion.options || []).map((opt, idx) => (
                            <div 
                              key={opt.id} 
                              className="p-3 border rounded-lg bg-card space-y-2"
                              onDrop={async (e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files?.[0];
                                if (file && file.type.startsWith('image/')) {
                                  const result = await uploadQuestionMedia(file);
                                  if (result) {
                                    const options = [...(draftQuestion.options || [])];
                                    options[idx] = { ...options[idx], image_url: result.file_url };
                                    applyDraftUpdate({ options });
                                  }
                                }
                              }}
                              onDragOver={(e) => e.preventDefault()}
                            >
                              <div className="flex items-center gap-2">
                                {draftQuestion.question_type === 'multiple_choice' ? (
                                  <input
                                    type="checkbox"
                                    checked={Array.isArray(draftQuestion.correct_answer) && draftQuestion.correct_answer.includes(idx)}
                                    onChange={(e) => setDraftCorrect(idx, e.target.checked)}
                                    className="w-4 h-4"
                                  />
                                ) : (
                                  <input
                                    type="radio"
                                    name="draft-correct"
                                    checked={draftQuestion.correct_answer === idx}
                                    onChange={() => setDraftCorrect(idx, true)}
                                    className="w-4 h-4"
                                  />
                                )}
                                <span className="font-bold text-muted-foreground w-6">{opt.letter || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[idx] || `${idx + 1}`}.</span>
                                <Input
                                  value={opt.text}
                                  onChange={(e) => updateDraftOptionText(idx, e.target.value)}
                                  placeholder={tr('courseAuthoring.quiz.optionText', { n: idx + 1 })}
                                  className="flex-1"
                                />
                                {(draftQuestion.options?.length || 0) > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const options = [...(draftQuestion.options || [])];
                                      options.splice(idx, 1);
                                      // Re-assign letters
                                      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                                      options.forEach((o, i) => { o.letter = letters[i] || `${i + 1}`; });
                                      // Adjust correct_answer if needed
                                      let newCorrect = draftQuestion.correct_answer;
                                      if (draftQuestion.question_type === 'multiple_choice' && Array.isArray(newCorrect)) {
                                        newCorrect = newCorrect.filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
                                      } else if (typeof newCorrect === 'number') {
                                        if (newCorrect === idx) newCorrect = 0;
                                        else if (newCorrect > idx) newCorrect = newCorrect - 1;
                                      }
                                      applyDraftUpdate({ options, correct_answer: newCorrect });
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1 dark:text-red-400 dark:hover:text-red-300"
                                    title={tr('courseAuthoring.quiz.removeOption')}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              
                              {/* Image Upload Section */}
                              <div className="ml-10">
                                {opt.image_url ? (
                                  <div
                                    className="relative inline-block outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                                    tabIndex={0}
                                    role="button"
                                    aria-label={tr('courseAuthoring.quiz.optionImageAria', { n: idx + 1 })}
                                    onPaste={(e) => handleMediaPaste(e, (url) => {
                                      const options = [...(draftQuestion.options || [])];
                                      options[idx] = { ...options[idx], image_url: url };
                                      applyDraftUpdate({ options });
                                    })}
                                  >
                                    <img
                                      src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + opt.image_url}
                                      alt={tr('courseAuthoring.quiz.optionAlt', { n: idx + 1 })}
                                      className="max-h-40 rounded border"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const options = [...(draftQuestion.options || [])];
                                        options[idx] = { ...options[idx], image_url: undefined };
                                        applyDraftUpdate({ options });
                                      }}
                                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand border border-dashed border-brand-border rounded px-2 py-1 hover:bg-brand-surface transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                                    tabIndex={0}
                                    role="button"
                                    aria-label={tr('courseAuthoring.quiz.addOptionImageAria', { n: idx + 1 })}
                                    onClick={(e) => {
                                      const input = e.currentTarget.querySelector('input');
                                      input?.click();
                                    }}
                                    onPaste={(e) => handleMediaPaste(e, (url) => {
                                      const options = [...(draftQuestion.options || [])];
                                      options[idx] = { ...options[idx], image_url: url };
                                      applyDraftUpdate({ options });
                                    })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        const input = e.currentTarget.querySelector('input');
                                        input?.click();
                                      }
                                    }}
                                  >
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const result = await uploadQuestionMedia(file);
                                          if (result) {
                                            const options = [...(draftQuestion.options || [])];
                                            options[idx] = { ...options[idx], image_url: result.file_url };
                                            applyDraftUpdate({ options });
                                          }
                                        }
                                      }}
                                    />
                                    <Image className="w-3 h-3" />
                                    {tr('courseAuthoring.quiz.addImagePaste')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Show Gaps preview only for fill_blank question type */}
                  {draftQuestion.question_type === 'fill_blank' && (
                    <div className="space-y-2">
                      <Label>{tr('courseAuthoring.quiz.gapSeparator')}</Label>
                      <Input
                        type="text"
                        value={draftQuestion.gap_separator || ','}
                        onChange={(e) => applyDraftUpdate({ gap_separator: e.target.value || ',' })}
                        placeholder=","
                        className="w-24"
                      />
                      <p className="text-xs text-muted-foreground">
                        {tr('courseAuthoring.quiz.gapSeparatorHint')}
                      </p>

                      <Label className="mt-4">{tr('courseAuthoring.quiz.gapsPreview')}</Label>
                      <div className="p-3 bg-muted border border-border rounded-md text-sm">
                        {(() => {
                          const text = (draftQuestion.content_text || '').toString();
                          const separator = draftQuestion.gap_separator || ',';
                          const regex = /\[\[(.*?)\]\]/g;
                          const gaps = [];
                          let match;
                          while ((match = regex.exec(text)) !== null) {
                            gaps.push(match);
                          }
                          if (gaps.length === 0) return <span>{tr('courseAuthoring.quiz.noGapsYet', { sep: separator })}</span>;

                          // Helper function to clean text from HTML tags and entities
                          const cleanText = (text: string): string => {
                            let cleaned = text;

                            // Remove asterisks first
                            cleaned = cleaned.replace(/\*/g, '');

                            // Replace HTML entities
                            cleaned = cleaned
                              .replace(/&nbsp;/g, ' ')
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/&amp;/g, '&')
                              .replace(/&quot;/g, '"')
                              .replace(/&#39;/g, "'");

                            // Remove ALL HTML tags (including broken/partial tags)
                            // This regex handles multiple scenarios
                            cleaned = cleaned
                              .replace(/<[^>]*>/g, '')  // Normal tags
                              .replace(/<[^>]*$/g, '')  // Unclosed tags at end
                              .replace(/^[^<]*>/g, '')  // Orphaned closing tags at start
                              .replace(/>[^<]*</g, '><'); // Then remove any remaining < or >

                            // Clean up any remaining angle brackets that might be leftovers
                            cleaned = cleaned.replace(/[<>]/g, '');

                            return cleaned.trim();
                          };

                          return (
                            <div className="space-y-2">
                              {gaps.map((m, i) => {
                                const rawTokens = (m[1] || '').split(separator).map(s => s.trim()).filter(Boolean);

                                // Find correct answer: if any token has *, use it; otherwise use first
                                let correctIndex = 0;
                                const markedIndex = rawTokens.findIndex(t => t.includes('*'));
                                if (markedIndex !== -1) {
                                  correctIndex = markedIndex;
                                }

                                const tokens = rawTokens.map(cleanText);
                                const correct = tokens[correctIndex] || tokens[0];
                                // Filter out empty options
                                const others = tokens.filter((_, idx) => idx !== correctIndex).filter(o => o && o.trim());

                                return (
                                  <div key={i} className="flex items-start gap-2 pb-2 border-b border-border last:border-0">
                                    <span className="text-muted-foreground font-medium min-w-[3rem]">#{i + 1}:</span>
                                    <div className="flex-1">
                                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded font-semibold text-sm dark:bg-green-900/40 dark:text-green-300">
                                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                        {correct || tr('courseAuthoring.quiz.emptyParen')}
                                      </div>
                                      {others.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          <span className="text-xs text-muted-foreground mr-1">{tr('courseAuthoring.quiz.others')}</span>
                                          {others.map((o, idx) => (
                                            <span key={idx} className="inline-flex items-center px-1.5 py-0.5 bg-border text-foreground/80 rounded text-xs">
                                              {o}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Matching Question Editor */}
                  {draftQuestion.question_type === 'matching' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>{tr('courseAuthoring.quiz.matchingPairs')}</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const pairs = [...(draftQuestion.matching_pairs || [])];
                            pairs.push({ left: '', right: '' });
                            applyDraftUpdate({ matching_pairs: pairs });
                          }}
                          className="text-xs h-7"
                        >
                          {tr('courseAuthoring.quiz.addPair')}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tr('courseAuthoring.quiz.pairsHint')}
                      </p>
                      <div className="space-y-2">
                        {(draftQuestion.matching_pairs || []).map((pair, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-3 border rounded-lg bg-card">
                            <span className="font-bold text-muted-foreground w-6">{idx + 1}.</span>
                            <Input
                              value={pair.left}
                              onChange={(e) => {
                                const pairs = [...(draftQuestion.matching_pairs || [])];
                                pairs[idx] = { ...pairs[idx], left: e.target.value };
                                applyDraftUpdate({ matching_pairs: pairs });
                              }}
                              placeholder={tr('courseAuthoring.quiz.leftPlaceholder')}
                              className="flex-1"
                            />
                            <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={tr('courseAuthoring.quiz.matchesAria')} />
                            <Input
                              value={pair.right}
                              onChange={(e) => {
                                const pairs = [...(draftQuestion.matching_pairs || [])];
                                pairs[idx] = { ...pairs[idx], right: e.target.value };
                                applyDraftUpdate({ matching_pairs: pairs });
                              }}
                              placeholder={tr('courseAuthoring.quiz.rightPlaceholder')}
                              className="flex-1"
                            />
                            {(draftQuestion.matching_pairs?.length || 0) > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const pairs = [...(draftQuestion.matching_pairs || [])];
                                  pairs.splice(idx, 1);
                                  applyDraftUpdate({ matching_pairs: pairs });
                                }}
                                className="text-red-500 hover:text-red-700 p-1 dark:text-red-400 dark:hover:text-red-300"
                                title={tr('courseAuthoring.quiz.removePair')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {(!draftQuestion.matching_pairs || draftQuestion.matching_pairs.length === 0) && (
                        <div className="text-center py-4 text-muted-foreground">
                          <p>{tr('courseAuthoring.quiz.noPairs')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setShowQuestionModal(false); setDraftQuestion(null); setEditingQuestionIndex(null); }}>{tr('common.cancel')}</Button>
                <Button onClick={saveDraftQuestion} className="bg-brand-solid hover:bg-brand-solid-hover">
                  {editingQuestionIndex !== null ? tr('courseAuthoring.quiz.updateQuestion') : tr('courseAuthoring.quiz.saveQuestion')}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && createPortal(
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[1001] flex items-center justify-center min-h-screen p-4">
            <div
              className="bg-card rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{tr('courseAuthoring.quiz.bulk.title')}</h3>
                <Button variant="outline" onClick={() => {
                  setShowBulkUploadModal(false);
                  setBulkUploadText('');
                  setBulkUploadErrors([]);
                }}>{tr('common.close')}</Button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {tr('courseAuthoring.quiz.bulk.introBefore')} <strong>+</strong> {tr('courseAuthoring.quiz.bulk.introAfter')}
                </p>

                <div className="bg-brand-surface border border-brand-border rounded-lg p-4 text-sm">
                  <div className="font-medium text-brand mb-2">{tr('courseAuthoring.quiz.bulk.mcqFormat')}</div>
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap bg-card p-2 rounded border">
{tr('courseAuthoring.quiz.bulk.mcqExample')}</pre>

                  <div className="font-medium text-brand mb-2 mt-4">{tr('courseAuthoring.quiz.bulk.matchingFormat')}</div>
                  <pre className="text-xs text-foreground/80 whitespace-pre-wrap bg-card p-2 rounded border">
{tr('courseAuthoring.quiz.bulk.matchingExample')}</pre>
                  <p className="text-xs text-brand mt-2">
                    <strong>{tr('courseAuthoring.quiz.bulk.tip')}</strong> {tr('courseAuthoring.quiz.bulk.tipText')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{tr('courseAuthoring.quiz.bulk.paste')}</Label>
                  <textarea
                    value={bulkUploadText}
                    onChange={(e) => setBulkUploadText(e.target.value)}
                    placeholder={tr('courseAuthoring.quiz.bulk.pastePlaceholder')}
                    className="w-full h-96 p-3 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-brand focus:border-brand"
                  />
                </div>

                {bulkUploadErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-950/40 dark:border-red-800/60">
                    <div className="font-medium text-red-900 mb-2 dark:text-red-300">{tr('courseAuthoring.flashcards.errors')}</div>
                    <ul className="list-disc list-inside space-y-1">
                      {bulkUploadErrors.map((error, index) => (
                        <li key={index} className="text-sm text-red-700 dark:text-red-300">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBulkUploadModal(false);
                      setBulkUploadText('');
                      setBulkUploadErrors([]);
                    }}
                  >
                    {tr('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleBulkUpload}
                    disabled={!bulkUploadText.trim()}
                    className="bg-brand-solid hover:bg-brand-solid-hover"
                  >
                    {tr('courseAuthoring.quiz.bulk.import')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SAT Image Analysis Modal */}
      {showSatImageModal && createPortal(
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[1001] flex items-center justify-center min-h-screen">
            <div
              className="bg-card rounded-lg w-full max-w-md p-6 space-y-4 shadow-xl"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{tr('courseAuthoring.quiz.analyze.title')}</h3>
                <Button variant="outline" onClick={() => setShowSatImageModal(false)}>{tr('common.close')}</Button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {tr('courseAuthoring.quiz.analyze.intro')}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAnalyzeMode('sat')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold border ${analyzeMode === 'sat' ? 'bg-brand-solid text-white border-brand' : 'bg-card text-foreground/80 border-input'}`}
                  >
                    SAT (Gemini)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalyzeMode('nuet')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold border ${analyzeMode === 'nuet' ? 'bg-brand-solid text-white border-brand' : 'bg-card text-foreground/80 border-input'}`}
                  >
                    NUET (ChatGPT)
                  </button>
                </div>

                <div
                  className="border-2 border-dashed border-input rounded-lg p-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
                      setUploadedFile(file);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add('border-brand', 'bg-brand-surface');
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-brand', 'bg-brand-surface');
                  }}
                  onPaste={handleSatImagePaste}
                  tabIndex={0}
                  role="button"
                  aria-label={tr('courseAuthoring.quiz.analyze.areaAria')}
                >
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,image/*"
                    onChange={handleSatImageUpload}
                    className="hidden"
                    id="sat-image-upload"
                    disabled={isAnalyzingImage}
                  />
                  <label htmlFor="sat-image-upload" className="cursor-pointer">
                    <div className="space-y-2">
                      <FileText className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                      <div className="text-sm font-medium">
                        {isAnalyzingImage ? tr('courseAuthoring.quiz.analyze.analyzing') : tr('courseAuthoring.quiz.analyze.clickOrDrop')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tr('courseAuthoring.quiz.analyze.supports')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tr('courseAuthoring.quiz.orPaste')}
                      </div>
                    </div>
                  </label>
                </div>

                {uploadedFile && (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/40 dark:border-green-800/60">
                    <div className="flex items-center gap-2">
                      <FileText className="h-6 w-6 shrink-0 text-green-700 dark:text-green-300" aria-hidden="true" />
                      <div>
                        <div className="text-sm font-medium text-green-900 dark:text-green-300">{uploadedFile.name}</div>
                        <div className="text-xs text-green-700 dark:text-green-300">{tr('courseAuthoring.size.kb', { size: (uploadedFile.size / 1024).toFixed(1) })}</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUploadedFile(null)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      {tr('courseAuthoring.quiz.remove')}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="correct-answers">{tr('courseAuthoring.quiz.analyze.answers')}</Label>
                  <textarea
                    id="correct-answers"
                    value={correctAnswersText}
                    onChange={(e) => setCorrectAnswersText(e.target.value)}
                    placeholder={tr('courseAuthoring.quiz.analyze.answersPlaceholder')}
                    className="w-full h-24 p-3 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-brand focus:border-brand"
                    disabled={isAnalyzingImage}
                  />
                  <p className="text-xs text-muted-foreground">
                    {tr('courseAuthoring.quiz.analyze.answersHint')}
                  </p>
                </div>

                <Button
                  onClick={handleAnalyzeClick}
                  disabled={!uploadedFile || isAnalyzingImage}
                  className="w-full bg-brand-solid hover:bg-brand-solid-hover text-white"
                  size="lg"
                >
                  {isAnalyzingImage ? (
                    <span className="inline-flex items-center gap-2">
                      <ThinkingLoader state={analyzeStage} size={20} theme="dark" />
                      {tr('courseAuthoring.quiz.analyze.analyzing')}
                    </span>
                  ) : tr('courseAuthoring.quiz.analyze.run')}
                </Button>

                {isAnalyzingImage && (
                  <div className="flex flex-col items-center py-4 gap-2">
                    <ThinkingLoader state={analyzeStage} size={64} label={tr('courseAuthoring.quiz.analyze.withAi', { ai: analyzeMode === 'nuet' ? 'ChatGPT' : 'Gemini' })} />
                    <p className="text-sm text-muted-foreground">{tr('courseAuthoring.quiz.analyze.withAiWait', { ai: analyzeMode === 'nuet' ? 'ChatGPT' : 'Gemini' })}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      {showPreviewModal && draftQuestion && createPortal(
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[1001] flex items-center justify-center min-h-screen p-4">
            <div className="bg-card rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-semibold text-foreground">{tr('courseAuthoring.quiz.preview.title')}</h3>
                <div className="text-center">
                  <Button variant="outline" size="sm" onClick={() => setShowPreviewModal(false)}>{tr('common.close')}</Button>
                  <div className="text-xs text-muted-foreground mt-1">Esc</div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Passage/Content */}
                {draftQuestion.content_text && (
                  <div className="bg-muted p-4 rounded-lg border">
                    <div className="text-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(draftQuestion.content_text)) }} />
                  </div>
                )}

                {/* Media for Media Questions */}
                {draftQuestion.question_type === 'media_question' && draftQuestion.media_url && (
                  <div className="flex items-center justify-center bg-muted p-4 rounded-lg border">
                    {draftQuestion.media_type === 'image' ? (
                      <img
                        src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + draftQuestion.media_url}
                        alt={tr('courseAuthoring.quiz.questionMediaAlt')}
                        className="max-w-full max-h-96 object-contain rounded-lg shadow-sm"
                      />
                    ) : draftQuestion.media_type === 'pdf' ? (
                      <div className="text-center">
                        <FileText className="w-12 h-12 mx-auto text-brand mb-2" />
                        <div className="font-medium text-foreground/80">{tr('courseAuthoring.quiz.preview.pdfDocument')}</div>
                        <a
                          href={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + draftQuestion.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand hover:text-brand text-sm"
                        >
                          {tr('courseAuthoring.quiz.preview.viewPdf')}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Question Text */}
                <div className="space-y-3">
                  <div className="text-lg font-semibold text-foreground">
                    <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(draftQuestion.question_text)) }} />
                  </div>
                  <div className="text-sm text-muted-foreground">{tr('courseAuthoring.quiz.preview.points', { points: draftQuestion.points })}</div>
                </div>

                {/* Answer Options based on question type */}
                {(draftQuestion.question_type === 'single_choice' || draftQuestion.question_type === 'multiple_choice' || draftQuestion.question_type === 'media_question') && (
                  <div className="space-y-2">
                    {draftQuestion.options?.map((opt, idx) => {
                      const isCorrect = draftQuestion.question_type === 'multiple_choice'
                        ? Array.isArray(draftQuestion.correct_answer) && draftQuestion.correct_answer.includes(idx)
                        : draftQuestion.correct_answer === idx;

                      return (
                        <label
                          key={opt.id || idx}
                          className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-colors ${isCorrect
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/40'
                            : 'border-border bg-card hover:border-input'
                            }`}
                        >
                          <input
                            type={draftQuestion.question_type === 'multiple_choice' ? 'checkbox' : 'radio'}
                            name="preview-option"
                            className="mt-1"
                            checked={isCorrect}
                            readOnly
                          />
                          <div className="flex-1">
                            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(opt.text)) }} />
                            {isCorrect && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-green-700 dark:text-green-300"><Check className="h-3.5 w-3.5" aria-hidden="true" />{tr('courseAuthoring.quiz.preview.correct')}</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Short Answer */}
                {draftQuestion.question_type === 'short_answer' && (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder={tr('courseAuthoring.quiz.preview.answerPlaceholder')}
                      disabled
                      className="bg-muted"
                    />
                    <div className="text-sm text-muted-foreground bg-green-50 border border-green-200 rounded p-3 dark:bg-green-950/40 dark:border-green-800/60">
                      <span className="font-medium text-green-700 dark:text-green-300">{tr('courseAuthoring.quiz.correctAnswerLabel')}</span> {draftQuestion.correct_answer}
                    </div>
                  </div>
                )}

                {/* Fill in the Blank */}
                {draftQuestion.question_type === 'fill_blank' && (
                  <div className="p-4 rounded-lg border bg-muted">
                    <FillInBlankRenderer
                      text={(draftQuestion.content_text || '').toString()}
                      separator={draftQuestion.gap_separator || ','}
                      disabled={true}
                    />
                  </div>
                )}

                {/* Text Completion */}
                {draftQuestion.question_type === 'text_completion' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg border bg-muted">
                      <TextCompletionRenderer
                        text={(draftQuestion.content_text || '').toString()}
                        disabled={true}
                        correctAnswers={Array.isArray(draftQuestion.correct_answer) ? draftQuestion.correct_answer : []}
                        showCorrectAnswers={false}
                        showNumbering={draftQuestion.show_numbering || false}
                      />
                    </div>
                  </div>
                )}

                {/* Long Text Answer */}
                {draftQuestion.question_type === 'long_text' && (
                  <div className="space-y-2">
                    <textarea
                      rows={6}
                      placeholder={tr('courseAuthoring.quiz.preview.longAnswerPlaceholder')}
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-muted resize-none"
                    />
                    {(draftQuestion.expected_length || draftQuestion.keywords) && (
                      <div className="text-sm bg-brand-surface border border-brand-border rounded p-3 space-y-1">
                        {draftQuestion.expected_length && (
                          <div className="text-foreground/80">
                            <span className="font-medium">{tr('courseAuthoring.quiz.preview.expectedLength')}</span> {tr('courseAuthoring.quiz.preview.characters', { count: draftQuestion.expected_length })}
                          </div>
                        )}
                        {draftQuestion.keywords && draftQuestion.keywords.length > 0 && (
                          <div className="text-foreground/80">
                            <span className="font-medium">{tr('courseAuthoring.quiz.preview.keywords')}</span> {draftQuestion.keywords.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Matching Question Preview */}
                {draftQuestion.question_type === 'matching' && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground/80">{tr('courseAuthoring.quiz.preview.matchingPairs')}</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase">{tr('courseAuthoring.quiz.preview.left')}</div>
                        {draftQuestion.matching_pairs?.map((pair, idx) => (
                          <div key={idx} className="p-3 bg-brand-surface border border-brand-border rounded-lg">
                            <span className="font-medium text-brand">{idx + 1}.</span> {pair.left}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground uppercase">{tr('courseAuthoring.quiz.preview.right')}</div>
                        {draftQuestion.matching_pairs?.map((pair, idx) => (
                          <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/40 dark:border-green-800/60">
                            {pair.right}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Explanation */}
                {draftQuestion.explanation && (
                  <div className="bg-brand-surface border border-brand-border rounded-lg p-4">
                    <div className="text-sm font-medium text-brand mb-2">{tr('courseAuthoring.quiz.preview.explanation')}</div>
                    <div className="text-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderTextWithLatex(draftQuestion.explanation)) }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Help Modal */}
      {showHelpModal && createPortal(
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[1001] flex items-center justify-center min-h-screen">
            <div
              className="bg-card rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{tr('courseAuthoring.quiz.help.title')}</h3>
                <Button variant="outline" onClick={() => setShowHelpModal(false)}>{tr('common.close')}</Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">{tr('courseAuthoring.quiz.help.textTitle')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {tr('courseAuthoring.quiz.help.textIntro')}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-muted rounded">
                      <code className="text-sm font-mono bg-card px-2 py-1 rounded border">_text_</code>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={tr('courseAuthoring.quiz.help.rendersAs')} />
                      <em className="text-sm">{tr('courseAuthoring.quiz.help.italic')}</em>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-muted rounded">
                      <code className="text-sm font-mono bg-card px-2 py-1 rounded border">**text**</code>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={tr('courseAuthoring.quiz.help.rendersAs')} />
                      <strong className="text-sm">{tr('courseAuthoring.quiz.help.bold')}</strong>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-muted rounded">
                      <code className="text-sm font-mono bg-card px-2 py-1 rounded border">__text__</code>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={tr('courseAuthoring.quiz.help.rendersAs')} />
                      <u className="text-sm">{tr('courseAuthoring.quiz.help.underline')}</u>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-muted rounded">
                      <code className="text-sm font-mono bg-card px-2 py-1 rounded border">~~text~~</code>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={tr('courseAuthoring.quiz.help.rendersAs')} />
                      <del className="text-sm">{tr('courseAuthoring.quiz.help.strike')}</del>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-muted rounded">
                      <code className="text-sm font-mono bg-card px-2 py-1 rounded border">`text`</code>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={tr('courseAuthoring.quiz.help.rendersAs')} />
                      <code className="text-sm bg-border px-1 rounded">{tr('courseAuthoring.quiz.help.code')}</code>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">{tr('courseAuthoring.quiz.help.latexTitle')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {tr('courseAuthoring.quiz.help.latexIntro')}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-muted rounded">
                      <code className="text-sm font-mono bg-card px-2 py-1 rounded border">$x^2$</code>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={tr('courseAuthoring.quiz.help.rendersAs')} />
                      <span className="text-sm">{tr('courseAuthoring.quiz.help.inlineFormula')}</span>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-muted rounded">
                      <code className="text-sm font-mono bg-card px-2 py-1 rounded border">$$\frac{"{a}"}{"{b}"}$$</code>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={tr('courseAuthoring.quiz.help.rendersAs')} />
                      <span className="text-sm">{tr('courseAuthoring.quiz.help.blockFormula')}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">{tr('courseAuthoring.quiz.help.richTitle')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {tr('courseAuthoring.quiz.help.richIntro')}
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>{tr('courseAuthoring.quiz.help.richStyles')}</li>
                    <li>{tr('courseAuthoring.quiz.help.richColors')}</li>
                    <li>{tr('courseAuthoring.quiz.help.richLists')}</li>
                    <li>{tr('courseAuthoring.quiz.help.richLinks')}</li>
                    <li>{tr('courseAuthoring.quiz.help.richLatex')}</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">{tr('courseAuthoring.quiz.help.blankTitle')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {tr('courseAuthoring.quiz.help.blankIntro')}
                  </p>
                  <div className="p-3 bg-brand-surface rounded border space-y-2">
                    <div>
                      <div className="text-xs font-medium text-foreground/80 mb-1">{tr('courseAuthoring.quiz.help.blankDefault')}</div>
                      <code className="text-sm font-mono">
                        {tr('courseAuthoring.quiz.help.blankDefaultExample')}
                      </code>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground/80 mb-1">{tr('courseAuthoring.quiz.help.blankCustom')}</div>
                      <code className="text-sm font-mono">
                        {tr('courseAuthoring.quiz.help.blankCustomExample')}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {tr('courseAuthoring.quiz.help.blankNote')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}


