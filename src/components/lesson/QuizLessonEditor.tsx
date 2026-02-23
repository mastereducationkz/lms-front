import React, { useState } from 'react';
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
import RichTextEditor from '../RichTextEditor';
import { Upload, FileText, Image, Plus, Trash2, ChevronUp, ChevronDown, CheckCircle } from 'lucide-react';
import { FillInBlankRenderer } from './FillInBlankRenderer';
import { TextCompletionRenderer } from './TextCompletionRenderer';
import { parseGap } from '../../utils/gapParser';

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
  quizMediaType,
  setQuizMediaType,
  audioPlaybackMode = 'flexible',
  setAudioPlaybackMode,
  highlightedQuestionId,
}: QuizLessonEditorProps) {
  // Handle scrolling to highlighted question
  React.useEffect(() => {
    if (highlightedQuestionId && quizQuestions.length > 0) {
      // Small timeout to ensure DOM is ready and images/content are partially loaded
      const timer = setTimeout(() => {
        const element = document.getElementById(`question-${highlightedQuestionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a more prominent and persistent highlight
          element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'shadow-2xl', 'scale-[1.01]', 'transition-all', 'duration-500');
          
          // Keep highlight for longer to ensure user sees it
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'shadow-2xl', 'scale-[1.01]');
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
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [correctAnswersText, setCorrectAnswersText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadText, setBulkUploadText] = useState('');
  const [bulkUploadErrors, setBulkUploadErrors] = useState<string[]>([]);

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
            errors.push(`Matching block ${blockIndex + 1}: Need at least 2 pairs`);
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
          errors.push(`Block ${blockIndex + 1}: Could not find question text`);
          continue;
        }

        if (optionLines.length < 2) {
          errors.push(`Block ${blockIndex + 1}: Need at least 2 options`);
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
        errors.push(`Block ${blockIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      setBulkUploadErrors(['No valid questions found. Please check the format.']);
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
        errors.push('Please upload an image');
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
      errors.push('Question text is required');
    }
    if (question.question_type === 'fill_blank') {
      const answers = Array.isArray(question.correct_answer)
        ? question.correct_answer
        : (typeof question.correct_answer === 'string' && question.correct_answer.trim())
          ? [question.correct_answer.trim()]
          : [];
      if (answers.length === 0) {
        errors.push('Please add at least one gap [[answer]] in the passage');
      }
    } else if (question.question_type === 'short_answer' || question.question_type === 'media_open_question') {
      // Short answer and media_open_question need a correct answer
      if (!question.correct_answer || (typeof question.correct_answer === 'string' && !question.correct_answer.trim())) {
        errors.push('Please provide the correct answer');
      }
    } else if (question.question_type === 'text_completion') {
      // Text completion questions need passage with gaps and correct answers
      const text = (question.content_text || '').toString();
      const gaps = Array.from(text.matchAll(/\[\[(.*?)\]\]/g));
      if (gaps.length === 0) {
        errors.push('Please add gaps using [[answer]] format in the text');
      }
      const answers = Array.isArray(question.correct_answer) ? question.correct_answer : [];
      if (answers.length !== gaps.length) {
        errors.push('Number of answers must match number of gaps');
      }
      if (answers.some((answer: string) => !answer || !answer.trim())) {
        errors.push('All gap answers must be provided');
      }
    } else if (question.question_type === 'long_text') {
      // Long text questions don't need options validation
      if (!question.correct_answer && question.correct_answer !== '') {
        // For long text, we just need some placeholder for correct_answer
        errors.push('Please provide sample answer or grading criteria');
      }
    } else if (question.question_type === 'matching') {
      // Matching questions require pairs
      if (!question.matching_pairs || question.matching_pairs.length < 2) {
        errors.push('At least 2 matching pairs are required');
      }
      if (question.matching_pairs?.some(pair => !pair.left.trim() || !pair.right.trim())) {
        errors.push('All matching pairs must have both left and right values');
      }
    } else if (question.question_type === 'single_choice' || question.question_type === 'multiple_choice' || question.question_type === 'media_question') {
      // single_choice, multiple_choice, media_question - require options
      const hasOptionContent = question.options?.some(opt => opt.text.trim());
      if (hasOptionContent && (typeof question.correct_answer !== 'number' || question.correct_answer < 0)) {
        errors.push('Please select a correct answer');
      }
      if (!question.options || question.options.length < 2) {
        errors.push('At least 2 options are required');
      }
      if (hasOptionContent && question.options?.some(opt => !opt.text.trim())) {
        errors.push('All options must have text');
      }
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
      if (checked) applyDraftUpdate({ correct_answer: idx });
    } else if (draftQuestion.question_type === 'multiple_choice') {
      const current = Array.isArray(draftQuestion.correct_answer)
        ? [...draftQuestion.correct_answer]
        : [];
      const next = checked ? Array.from(new Set([...current, idx])) : current.filter((i) => i !== idx);
      applyDraftUpdate({ correct_answer: next });
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
    const toSave: Question = {
      ...draftQuestion,
      correct_answer: correctAnswer,
      order_index: editingQuestionIndex !== null ? draftQuestion.order_index : quizQuestions.length,
    };

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload media. Please try again.';
      alert(errorMessage);
      return null;
    } finally {
      setIsUploadingMedia(false);
    }
  }, []);

  // Handle paste from clipboard for media
  const handleMediaPaste = React.useCallback(async (
    e: React.ClipboardEvent,
    onSuccess: (url: string) => void
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
              onSuccess(result.file_url);
            }
          } catch (error) {
            console.error('Error uploading pasted image:', error);
            alert('Failed to upload image from clipboard');
          }
          break;
        }
      }
    }
  }, [uploadQuestionMedia]);

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload quiz media. Please try again.';
      alert(errorMessage);
      return null;
    } finally {
      setIsUploadingMedia(false);
    }
  }, [setQuizMediaUrl, setQuizMediaType, setQuizDisplayMode]);

  const analyzeImageFile = React.useCallback(async (file: File, correctAnswers?: string) => {
    setIsAnalyzingImage(true);
    try {
      const result = await apiClient.analyzeSatImage(file, correctAnswers);
      console.log('SAT analysis result:', result);

      if (!result || result.success === false) {
        const message = (result && (result.explanation || result.error)) || 'Analysis returned no data';
        alert(`Failed to analyze file. ${message}`);
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
                letter: opt.letter || ['A', 'B', 'C', 'D'][optIdx] || ''
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
        alert(`Successfully imported ${newQuestions.length} questions!`);
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
      alert('Failed to analyze file. Please try again.');
    } finally {
      setIsAnalyzingImage(false);
    }
  }, [quizQuestions.length]);

  const handleSatImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
  };

  const handleAnalyzeClick = async () => {
    if (!uploadedFile) return;
    await analyzeImageFile(uploadedFile, correctAnswersText);
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
          <Label htmlFor="quiz-title">Quiz Title</Label>
          <Input
            id="quiz-title"
            type="text"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="Enter quiz title"
          />
        </div>
        <div className="space-y-2">
          <Label>Max Score</Label>
          <Input
            id="max-score"
            type="number"
            value={quizQuestions.length}
            onChange={() => {
              // This should probably be calculated automatically, not set manually
              // For now, just ignore the input
            }}
            min="1"
            placeholder="Auto-calculated"
            disabled
          />
        </div>
      </div>

      {/* Quiz Type Selection */}
      <div className="space-y-3">
        <Label>Quiz Type</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizType === 'regular' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            onClick={() => setQuizType('regular')}
          >
            <div className="font-medium">Regular Quiz</div>
            <div className="text-sm text-gray-600">Standard questions</div>
          </div>
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizType === 'text_based' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            onClick={() => setQuizType('text_based')}
          >
            <div className="font-medium">Text Based</div>
            <div className="text-sm text-gray-600">Questions with text passage</div>
          </div>
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizType === 'audio' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            onClick={() => setQuizType('audio')}
          >
            <div className="font-medium">Audio Quiz</div>
            <div className="text-sm text-gray-600">Audio-based questions</div>
          </div>
          <div
            className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizType === 'pdf' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            onClick={() => setQuizType('pdf')}
          >
            <div className="font-medium">Document Quiz</div>
            <div className="text-sm text-gray-600">PDF or image based</div>
          </div>
        </div>
      </div>

      {/* Text Content for Text-Based Quizzes */}
      {quizType === 'text_based' && (
        <div className="space-y-3">
          <Label>Passage Text</Label>
          <RichTextEditor
            value={quizMediaUrl}
            onChange={(value) => {
              setQuizMediaUrl(value);
              setQuizMediaType('text');
            }}
            placeholder="Enter the reading passage or text that students will read before answering questions..."
          />
          <p className="text-sm text-gray-500">
            Students will read this passage before answering the quiz questions
          </p>
        </div>
      )}

      {/* Media Upload for Audio/PDF Quizzes */}
      {(quizType === 'audio' || quizType === 'pdf') && (
        <div className="space-y-3">
          <Label>{quizType === 'audio' ? 'Audio File' : 'Document (PDF or Image)'}</Label>
          {quizMediaUrl ? (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {quizType === 'audio' ? (
                    <>
                      🎵 <span className="font-medium">Audio uploaded</span>
                    </>
                  ) : quizMediaType === 'pdf' ? (
                    <>
                      📄 <span className="font-medium">PDF uploaded</span>
                    </>
                  ) : (
                    <>
                      🖼️ <span className="font-medium">Image uploaded</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  {quizType === 'audio' && (
                    <audio
                      controls
                      src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizMediaUrl}
                      className="max-w-xs"
                    />
                  )}
                  {quizType === 'pdf' && quizMediaType === 'pdf' && (
                    <a
                      href={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizMediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View PDF →
                    </a>
                  )}
                  {quizType === 'pdf' && quizMediaType !== 'pdf' && (
                    <img
                      src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + quizMediaUrl}
                      alt="Quiz reference"
                      className="max-h-20 rounded"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuizMediaUrl('');
                      setQuizMediaType('');
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="text-center border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors"
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
                    alert(`Please upload ${quizType === 'audio' ? 'an audio' : 'a PDF or image'} file.`);
                  }
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="text-sm text-gray-600 mb-2">
                {quizType === 'audio'
                  ? 'Drag & drop or click to upload audio file (MP3, WAV, etc.)'
                  : 'Drag & drop or click to upload PDF or image (JPG, PNG, etc.)'
                }
              </div>
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
                    {isUploadingMedia ? 'Uploading...' : `Choose ${quizType === 'audio' ? 'Audio' : 'Document'} File`}
                  </span>
                </Button>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Audio Playback Mode Selection */}
      {quizType === 'audio' && setAudioPlaybackMode && (
        <div className="space-y-3">
          <Label>Режим воспроизведения аудио</Label>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                audioPlaybackMode === 'flexible' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setAudioPlaybackMode('flexible')}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎧</span>
                <span className="font-medium">Свободный режим</span>
              </div>
              <p className="text-xs text-gray-500">
                Студент может перематывать, ставить на паузу и переслушивать аудио без ограничений. 
                Подходит для практики и обучения.
              </p>
            </div>
            <div
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                audioPlaybackMode === 'strict' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setAudioPlaybackMode('strict')}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔒</span>
                <span className="font-medium">Экзаменационный режим</span>
              </div>
              <p className="text-xs text-gray-500">
                Студент не может перематывать аудио. Доступно только 2 повтора. 
                Подходит для экзаменов и тестирования.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="time-limit">Time Limit (minutes) - Optional</Label>
        <Input
          id="time-limit"
          type="number"
          value={quizTimeLimit || ''}
          onChange={(e) => setQuizTimeLimit(e.target.value ? parseInt(e.target.value) : undefined)}
          min="1"
          placeholder="Leave empty for no time limit"
        />
      </div>

      {setQuizDisplayMode && (
        <div className="space-y-2">
          <Label>Display Mode</Label>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`p-3 border-2 rounded-lg transition-colors ${quizType === 'pdf'
                ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-100'
                : `cursor-pointer ${quizDisplayMode === 'one_by_one'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }`
                }`}
              onClick={() => {
                if (quizType !== 'pdf' && quizType !== 'audio') {
                  setQuizDisplayMode('one_by_one');
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 rounded-full flex items-center justify-center">
                  {quizDisplayMode === 'one_by_one' && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                </div>
                <div>
                  <div className="font-medium text-sm">One by One</div>
                  <div className="text-xs text-gray-500">Show questions sequentially</div>
                  {quizType === 'pdf' || quizType === 'audio' && <div className="text-xs text-gray-400">(Not available for PDF and Audio quizzes)</div>}
                </div>
              </div>
            </div>

            <div
              className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${quizDisplayMode === 'all_at_once'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={() => setQuizDisplayMode('all_at_once')}
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 rounded-full flex items-center justify-center">
                  {quizDisplayMode === 'all_at_once' && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                </div>
                <div>
                  <div className="font-medium text-sm">All at Once</div>
                  <div className="text-xs text-gray-500">Show all questions together</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Questions ({quizQuestions.length})</h3>
          <div className="flex gap-2">
            <Button onClick={() => setShowBulkUploadModal(true)} variant="outline">Bulk Upload</Button>
            <Button onClick={() => setShowSatImageModal(true)} variant="outline">Analyze SAT Image</Button>
            <Button onClick={openAddQuestion} variant="default">Add Question</Button>
          </div>
        </div>

        <div className="space-y-4">
          {quizQuestions.map((q, idx) => {
            const validation = getQuestionValidationStatus(q);
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
            
            return (
              <div key={q.id} id={`question-${q.id}`} className={`rounded-lg border bg-white overflow-hidden ${!validation.isValid ? 'border-red-300' : 'border-gray-200'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                  <div className="flex items-center gap-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveQuestionUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveQuestionDown(idx)}
                        disabled={idx === quizQuestions.length - 1}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-600">
                        {q.question_type === 'single_choice' ? 'Single Choice' :
                          q.question_type === 'multiple_choice' ? 'Multiple Choice' :
                            q.question_type === 'short_answer' ? 'Short Answer' :
                              q.question_type === 'fill_blank' ? 'Fill in the Blank' :
                                q.question_type === 'text_completion' ? 'Text Completion' :
                                  q.question_type === 'long_text' ? 'Long Text' :
                                    q.question_type === 'media_question' ? 'Media Question' :
                                      q.question_type === 'media_open_question' ? 'Open Media' :
                                        q.question_type === 'image_content' ? 'Image/Map' :
                                          q.question_type === 'matching' ? 'Matching' :
                                          q.question_type}
                      </span>
                      {!validation.isValid && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                          {validation.errors[0]}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={() => openEditQuestion(idx)} variant="outline" size="sm">
                      Edit
                    </Button>
                    <Button onClick={() => removeQuestion(idx)} variant="destructive" size="sm">
                      Remove
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
                          alt="Question image"
                          className="max-w-full max-h-64 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-gray-400 italic">No image uploaded</div>
                      )}
                      {q.question_text && (
                        <p className="text-sm text-gray-600 mt-2">{q.question_text}</p>
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
                              alt="Question media"
                              className="max-w-full max-h-48 object-contain rounded-lg"
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded">
                              <FileText className="w-4 h-4" />
                              PDF attached
                            </div>
                          )}
                        </div>
                      )}
                      <div 
                        className="text-gray-900"
                        dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.question_text || '') }}
                      />
                      {q.question_type === 'media_question' && q.options && q.options.length > 0 && (
                        <div className="space-y-2 mt-3">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={opt.id || optIdx}
                              className={`flex items-center gap-2 p-2 rounded border ${
                                q.correct_answer === optIdx ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="flex-1">{opt.text || <span className="text-gray-400 italic">Empty option</span>}</span>
                              {q.correct_answer === optIdx && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
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
                        className="text-gray-900 font-medium"
                        dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.question_text || '') }}
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
                                  isCorrect ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="flex-1">{opt.text || <span className="text-gray-400 italic">Empty option</span>}</span>
                                {isCorrect && (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
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
                        className="text-gray-900 font-medium"
                        dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.question_text || '') }}
                      />
                      <div className="text-sm">
                        <span className="text-gray-500">Correct answer:</span>{' '}
                        <span className="font-medium text-green-700">{q.correct_answer || 'Not set'}</span>
                      </div>
                    </div>
                  )}

                  {/* Fill in the Blank / Text Completion */}
                  {(q.question_type === 'fill_blank' || q.question_type === 'text_completion') && (
                    <div className="space-y-3">
                      {q.question_text && (
                        <div 
                          className="text-gray-900 font-medium"
                          dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.question_text) }}
                        />
                      )}
                      <div className="bg-gray-50 p-3 rounded border text-sm">
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: renderTextWithLatex(
                              (q.content_text || '').replace(
                                /\[\[([^\]]+)\]\]/g, 
                                '<span class="px-2 py-0.5 bg-green-100 text-green-800 rounded border border-green-300 font-medium">$1</span>'
                              )
                            )
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Long Text */}
                  {q.question_type === 'long_text' && (
                    <div className="space-y-3">
                      <div 
                        className="text-gray-900 font-medium"
                        dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.question_text || '') }}
                      />
                      <div className="text-sm text-gray-500 italic">
                        Long text response expected
                      </div>
                    </div>
                  )}

                  {/* Matching */}
                  {q.question_type === 'matching' && q.matching_pairs && (
                    <div className="space-y-3">
                      <div 
                        className="text-gray-900 font-medium"
                        dangerouslySetInnerHTML={{ __html: renderTextWithLatex(q.question_text || 'Match the following:') }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          {q.matching_pairs.map((pair, pairIdx) => (
                            <div key={pairIdx} className="p-2 bg-blue-50 rounded border border-blue-200 text-sm">
                              {pair.left || <span className="text-gray-400 italic">Empty</span>}
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {q.matching_pairs.map((pair, pairIdx) => (
                            <div key={pairIdx} className="p-2 bg-green-50 rounded border border-green-200 text-sm">
                              {pair.right || <span className="text-gray-400 italic">Empty</span>}
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
            <CardContent className="text-center py-8 text-gray-500">
              <p>No questions added yet. Click "Add Question" to get started.</p>
            </CardContent>
          </Card>
        )}

      </div>

      {showQuestionModal && draftQuestion && createPortal(
        <div className="fixed inset-0 z-[1000]">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[1001] flex items-center justify-center min-h-screen">
            <div
              className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl"
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingQuestionIndex !== null ? 'Edit Question' : 'Add Question'}
                </h3>
                <div className="flex gap-2">
                  <div className="flex flex-col items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreviewModal(true)}
                      className="text-green-600 hover:text-green-700"
                    >
                      Preview
                    </Button>
                    <div className="text-xs text-gray-500 mt-1">⌘+O</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHelpModal(true)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Help
                    </Button>
                    <div className="text-xs text-gray-500 mt-1">⌘+H</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left side - Passage and Explanation */}
                {draftQuestion.is_sat_question && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Content:</Label>
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
                              Remove Numbering
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
                              Convert [ ] to [[ ]]
                            </Button>
                          </div>
                        )}
                      </div>
                      <Tabs defaultValue="passage" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="passage">Passage</TabsTrigger>
                          <TabsTrigger value="explanation">Explanation</TabsTrigger>
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
                            placeholder="Enter passage. Use [[answer]] to mark gaps, e.g. 'The sky is [[blue]]'."
                            className="min-h-[200px]"
                          />
                          {(draftQuestion.content_text || '').trim() && (
                            <div className="text-xs text-gray-600 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 max-h-32 overflow-y-auto">
                              Preview: <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex((draftQuestion.content_text || '').replace(/\[\[(.*?)\]\]/g, '<b>[$1]</b>')) }} />
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="explanation" className="space-y-2">
                          <RichTextEditor
                            value={draftQuestion.explanation || ''}
                            onChange={(value) => applyDraftUpdate({ explanation: value })}
                            placeholder="Explanation for the correct answer (supports rich text formatting and LaTeX)"
                            className="min-h-[200px]"
                          />
                          {(draftQuestion.explanation || '').trim() && (
                            <div className="text-xs text-gray-600 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-800 rounded border dark:border-gray-700 max-h-32 overflow-y-auto">
                              Preview: <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(draftQuestion.explanation || '') }} />
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
                    <Label>Question Text</Label>
                    <Input
                      value={draftQuestion.question_text}
                      onChange={(e) => applyDraftUpdate({ question_text: e.target.value })}
                      placeholder="Enter your question"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Points</Label>
                      <Input
                        type="number"
                        value={draftQuestion.points}
                        onChange={(e) => applyDraftUpdate({ points: parseInt(e.target.value) || 0 })}
                        min={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Question Type</Label>
                      <Select
                        value={draftQuestion.question_type}
                        onValueChange={(val) => {
                          const next: any = { ...draftQuestion };
                          if (val === 'single_choice') {
                            next.question_type = val;
                            next.correct_answer = typeof draftQuestion.correct_answer === 'number' ? draftQuestion.correct_answer : 0;
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
                          <SelectValue placeholder="Select question type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_choice">Single choice</SelectItem>
                          <SelectItem value="short_answer">Short answer</SelectItem>
                          <SelectItem value="fill_blank">Fill in the blank</SelectItem>
                          <SelectItem value="text_completion">Text completion</SelectItem>
                          <SelectItem value="long_text">Long text answer</SelectItem>
                          <SelectItem value="media_question">Media-based question</SelectItem>
                          <SelectItem value="media_open_question">Open media question</SelectItem>
                          <SelectItem value="matching">Matching</SelectItem>
                          <SelectItem value="image_content">Image/Map (no question)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Media Upload for Media Questions */}
                  {(draftQuestion.question_type === 'media_question' || draftQuestion.question_type === 'media_open_question' || draftQuestion.question_type === 'image_content') && (
                    <div className="space-y-2">
                      <Label>{draftQuestion.question_type === 'image_content' ? 'Image/Map' : 'Media Attachment'}</Label>
                      {draftQuestion.question_type === 'image_content' && (
                        <p className="text-sm text-muted-foreground">
                          This will display as an image between questions (e.g., a map for listening exercises). No answer input will be shown.
                        </p>
                      )}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                        {draftQuestion.media_url ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {draftQuestion.media_type === 'pdf' ? (
                                <FileText className="w-5 h-5 text-red-600" />
                              ) : (
                                <Image className="w-5 h-5 text-blue-600" />
                              )}
                              <span className="text-sm font-medium">Media attached</span>
                            </div>
                            {draftQuestion.media_type === 'image' && (
                              <img
                                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + draftQuestion.media_url}
                                alt="Question media"
                                className="max-w-xs max-h-48 object-contain rounded"
                              />
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applyDraftUpdate({ media_url: undefined, media_type: undefined })}
                            >
                              Remove Media
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="text-center border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors"
                            onDrop={async (e) => {
                              e.preventDefault();
                              const file = e.dataTransfer.files?.[0];
                              if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
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
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnter={(e) => e.preventDefault()}
                            onPaste={(e) => handleMediaPaste(e, (url) => {
                              applyDraftUpdate({
                                media_url: url,
                                media_type: 'image'
                              });
                            })}
                            tabIndex={0}
                          >
                            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <div className="text-sm text-gray-600 mb-2">
                              Drag & drop or click to upload PDF or image
                            </div>
                            <div className="text-xs text-gray-500 mb-3">
                              Or press Ctrl+V to paste from clipboard
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
                                  {isUploadingMedia ? 'Uploading...' : 'Choose File'}
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
                        <Label>Correct Answer(s)</Label>
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
                                    placeholder={`Variation ${idx + 1}`}
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
                                      <Trash2 className="w-4 h-4 text-red-500" />
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
                                Add Variation
                              </Button>
                            </div>
                          );
                        })()}
                        <p className="text-xs text-gray-500">
                          Students can enter any of these variations to get the answer correct (case-insensitive).
                        </p>
                      </div>
                  )}

                  {/* Text Completion Configuration */}
                  {draftQuestion.question_type === 'text_completion' && (
                    <div className="space-y-2">
                      <Label>Gap Answers</Label>
                      <p className="text-xs text-gray-500">
                        Add gaps in the Passage above using [[answer]] format. Example: "The capital of France is [[Paris]]."
                      </p>

                      {/* Preview with detected gaps */}
                      {draftQuestion.content_text && (
                        <div className="space-y-2">
                          <div className="p-3 bg-gray-50 border rounded-md text-sm">
                            <div className="font-medium mb-2">Detected Gaps:</div>
                            {(() => {
                              const text = (draftQuestion.content_text || '').toString();
                              const regex = /\[\[(.*?)\]\]/g;
                              const gaps = [];
                              let match;
                              while ((match = regex.exec(text)) !== null) {
                                gaps.push(match);
                              }
                              if (gaps.length === 0) {
                                return <div className="text-gray-500">No gaps detected. Use [[answer]] format in the Passage above.</div>;
                              }
                              return gaps.map((gap, index) => (
                                <div key={index} className="flex items-center gap-2 mb-2">
                                  <span className="text-gray-600">Gap {index + 1}:</span>
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
                                    placeholder="Correct answer"
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
                        <label htmlFor="show-numbering" className="text-sm text-gray-700 cursor-pointer">
                          Show numbering (e.g., "1. [input] 2. [input]")
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Long Text Answer Configuration */}
                  {draftQuestion.question_type === 'long_text' && (
                    <div className="space-y-2">
                      <Label>Answer Configuration</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expected-length">Expected Length (characters)</Label>
                          <Input
                            id="expected-length"
                            type="number"
                            value={draftQuestion.expected_length || ''}
                            onChange={(e) => applyDraftUpdate({ expected_length: parseInt(e.target.value) || undefined })}
                            placeholder="e.g. 500"
                            min="1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                          <Input
                            id="keywords"
                            type="text"
                            value={draftQuestion.keywords?.join(', ') || ''}
                            onChange={(e) => {
                              const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                              applyDraftUpdate({ keywords: keywords.length > 0 ? keywords : undefined });
                            }}
                            placeholder="keyword1, keyword2, keyword3"
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Keywords help with automatic grading. Students' answers will be checked for these terms.
                      </div>
                    </div>
                  )}

                  {/* Show Options only for single_choice, multiple_choice, and media_question */}
                  {(draftQuestion.question_type === 'single_choice' ||
                    draftQuestion.question_type === 'multiple_choice' ||
                    draftQuestion.question_type === 'media_question') && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Options ({draftQuestion.options?.length || 0})</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Drag & drop or click to add images</span>
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
                              + Add Option
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {(draftQuestion.options || []).map((opt, idx) => (
                            <div 
                              key={opt.id} 
                              className="p-3 border rounded-lg bg-white space-y-2"
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
                              onPaste={(e) => handleMediaPaste(e, (url) => {
                                const options = [...(draftQuestion.options || [])];
                                options[idx] = { ...options[idx], image_url: url };
                                applyDraftUpdate({ options });
                              })}
                              tabIndex={0}
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
                                <span className="font-bold text-gray-600 w-6">{opt.letter || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[idx] || `${idx + 1}`}.</span>
                                <Input
                                  value={opt.text}
                                  onChange={(e) => updateDraftOptionText(idx, e.target.value)}
                                  placeholder={`Option ${idx + 1} text`}
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
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Remove option"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              
                              {/* Image Upload Section */}
                              <div className="ml-10">
                                {opt.image_url ? (
                                  <div className="relative inline-block">
                                    <img
                                      src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + opt.image_url}
                                      alt={`Option ${idx + 1}`}
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
                                  <label className="cursor-pointer">
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
                                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 rounded px-2 py-1 hover:bg-blue-50 transition-colors">
                                      <Image className="w-3 h-3" />
                                      Add image (or Ctrl+V)
                                    </span>
                                  </label>
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
                      <Label>Gap Separator</Label>
                      <Input
                        type="text"
                        value={draftQuestion.gap_separator || ','}
                        onChange={(e) => applyDraftUpdate({ gap_separator: e.target.value || ',' })}
                        placeholder=","
                        className="w-24"
                      />
                      <p className="text-xs text-gray-500">
                        Character to separate correct answer from distractors (default: comma)
                      </p>

                      <Label className="mt-4">Gaps preview</Label>
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm">
                        {(() => {
                          const text = (draftQuestion.content_text || '').toString();
                          const separator = draftQuestion.gap_separator || ',';
                          const regex = /\[\[(.*?)\]\]/g;
                          const gaps = [];
                          let match;
                          while ((match = regex.exec(text)) !== null) {
                            gaps.push(match);
                          }
                          if (gaps.length === 0) return <span>No gaps yet. Add [[correct{separator}wrong1{separator}wrong2]] in the passage field.</span>;

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
                                  <div key={i} className="flex items-start gap-2 pb-2 border-b border-gray-200 last:border-0">
                                    <span className="text-gray-600 font-medium min-w-[3rem]">#{i + 1}:</span>
                                    <div className="flex-1">
                                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded font-semibold text-sm">
                                        ✓ {correct || '(empty)'}
                                      </div>
                                      {others.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          <span className="text-xs text-gray-500 mr-1">Others:</span>
                                          {others.map((o, idx) => (
                                            <span key={idx} className="inline-flex items-center px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
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
                        <Label>Matching Pairs</Label>
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
                          + Add Pair
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Create pairs that students will need to match. The right side will be shuffled.
                      </p>
                      <div className="space-y-2">
                        {(draftQuestion.matching_pairs || []).map((pair, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                            <span className="font-bold text-gray-500 w-6">{idx + 1}.</span>
                            <Input
                              value={pair.left}
                              onChange={(e) => {
                                const pairs = [...(draftQuestion.matching_pairs || [])];
                                pairs[idx] = { ...pairs[idx], left: e.target.value };
                                applyDraftUpdate({ matching_pairs: pairs });
                              }}
                              placeholder="Left side (e.g., Term)"
                              className="flex-1"
                            />
                            <span className="text-gray-400">↔</span>
                            <Input
                              value={pair.right}
                              onChange={(e) => {
                                const pairs = [...(draftQuestion.matching_pairs || [])];
                                pairs[idx] = { ...pairs[idx], right: e.target.value };
                                applyDraftUpdate({ matching_pairs: pairs });
                              }}
                              placeholder="Right side (e.g., Definition)"
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
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove pair"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {(!draftQuestion.matching_pairs || draftQuestion.matching_pairs.length === 0) && (
                        <div className="text-center py-4 text-gray-500">
                          <p>No pairs yet. Click "+ Add Pair" to start.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setShowQuestionModal(false); setDraftQuestion(null); setEditingQuestionIndex(null); }}>Cancel</Button>
                <Button onClick={saveDraftQuestion} className="bg-blue-600 hover:bg-blue-700">
                  {editingQuestionIndex !== null ? 'Update Question' : 'Save Question'}
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
              className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Bulk Upload Questions</h3>
                <Button variant="outline" onClick={() => {
                  setShowBulkUploadModal(false);
                  setBulkUploadText('');
                  setBulkUploadErrors([]);
                }}>Close</Button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Paste your questions in the format below. Supports any number of options (A-Z). Mark correct answers with <strong>+</strong> at the end. For multiple correct answers, mark each with +.
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                  <div className="font-medium text-blue-900 mb-2">MCQ Format (any number of options):</div>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-2 rounded border">
{`1. What is the capital of France?
A) London
B) Paris +
C) Berlin
D) Madrid

2. Which are primary colors? (multiple choice)
A) Red +
B) Orange
C) Blue +
D) Green
E) Yellow +`}</pre>

                  <div className="font-medium text-blue-900 mb-2 mt-4">Matching Format:</div>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-2 rounded border">
{`3. MATCHING: Match the countries with capitals
France = Paris
Germany = Berlin
Spain = Madrid
Italy = Rome`}</pre>
                  <p className="text-xs text-blue-700 mt-2">
                    <strong>Tip:</strong> Use "MATCHING:" prefix for matching questions. Pairs are separated by "=" sign.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Paste Questions:</Label>
                  <textarea
                    value={bulkUploadText}
                    onChange={(e) => setBulkUploadText(e.target.value)}
                    placeholder="Paste your questions here..."
                    className="w-full h-96 p-3 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {bulkUploadErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="font-medium text-red-900 mb-2">Errors:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {bulkUploadErrors.map((error, index) => (
                        <li key={index} className="text-sm text-red-700">{error}</li>
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
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkUpload}
                    disabled={!bulkUploadText.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Import Questions
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
              className="bg-white rounded-lg w-full max-w-md p-6 space-y-4 shadow-xl"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Import Questions (PDF/Image)</h3>
                <Button variant="outline" onClick={() => setShowSatImageModal(false)}>Close</Button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Upload a PDF document or Image of a test (e.g., SAT) to automatically extract questions, options, and correct answers using AI.
                </p>

                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors"
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
                    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                  }}
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
                      <div className="text-4xl">📄</div>
                      <div className="text-sm font-medium">
                        {isAnalyzingImage ? 'Analyzing...' : 'Click to upload or drag & drop'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Supports PDF, PNG, JPG, JPEG, GIF, WEBP
                      </div>
                    </div>
                  </label>
                </div>

                {uploadedFile && (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="text-2xl">📄</div>
                      <div>
                        <div className="text-sm font-medium text-green-900">{uploadedFile.name}</div>
                        <div className="text-xs text-green-700">{(uploadedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUploadedFile(null)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="correct-answers">Correct Answers (Optional)</Label>
                  <textarea
                    id="correct-answers"
                    value={correctAnswersText}
                    onChange={(e) => setCorrectAnswersText(e.target.value)}
                    placeholder="Enter correct answers (e.g., 1.A 2.B 3.C 4.D or A,B,C,D)"
                    className="w-full h-24 p-3 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isAnalyzingImage}
                  />
                  <p className="text-xs text-gray-500">
                    If provided, these answers will be used instead of AI-detected answers.
                  </p>
                </div>

                <Button
                  onClick={handleAnalyzeClick}
                  disabled={!uploadedFile || isAnalyzingImage}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  {isAnalyzingImage ? 'Analyzing...' : 'Analyze Questions'}
                </Button>

                {isAnalyzingImage && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">Analyzing file with Gemini AI... This may take a minute.</p>
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
            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-semibold text-gray-900">Question Preview</h3>
                <div className="text-center">
                  <Button variant="outline" size="sm" onClick={() => setShowPreviewModal(false)}>Close</Button>
                  <div className="text-xs text-gray-500 mt-1">Esc</div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Passage/Content */}
                {draftQuestion.content_text && (
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <div className="text-gray-800 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(draftQuestion.content_text) }} />
                  </div>
                )}

                {/* Media for Media Questions */}
                {draftQuestion.question_type === 'media_question' && draftQuestion.media_url && (
                  <div className="flex items-center justify-center bg-gray-50 p-4 rounded-lg border">
                    {draftQuestion.media_type === 'image' ? (
                      <img
                        src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + draftQuestion.media_url}
                        alt="Question media"
                        className="max-w-full max-h-96 object-contain rounded-lg shadow-sm"
                      />
                    ) : draftQuestion.media_type === 'pdf' ? (
                      <div className="text-center">
                        <FileText className="w-12 h-12 mx-auto text-blue-600 mb-2" />
                        <div className="font-medium text-gray-700">PDF Document</div>
                        <a
                          href={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + draftQuestion.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View PDF →
                        </a>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Question Text */}
                <div className="space-y-3">
                  <div className="text-lg font-semibold text-gray-900">
                    <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex(draftQuestion.question_text) }} />
                  </div>
                  <div className="text-sm text-gray-500">Points: {draftQuestion.points}</div>
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
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
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
                            <span dangerouslySetInnerHTML={{ __html: renderTextWithLatex(opt.text) }} />
                            {isCorrect && (
                              <span className="ml-2 text-xs font-medium text-green-600">✓ Correct</span>
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
                      placeholder="Student's answer will be typed here..."
                      disabled
                      className="bg-gray-50"
                    />
                    <div className="text-sm text-gray-600 bg-green-50 border border-green-200 rounded p-3">
                      <span className="font-medium text-green-700">Correct answer:</span> {draftQuestion.correct_answer}
                    </div>
                  </div>
                )}

                {/* Fill in the Blank */}
                {draftQuestion.question_type === 'fill_blank' && (
                  <div className="p-4 rounded-lg border bg-gray-50">
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
                    <div className="p-4 rounded-lg border bg-gray-50">
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
                      placeholder="Student's long answer will be typed here..."
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50 resize-none"
                    />
                    {(draftQuestion.expected_length || draftQuestion.keywords) && (
                      <div className="text-sm bg-blue-50 border border-blue-200 rounded p-3 space-y-1">
                        {draftQuestion.expected_length && (
                          <div className="text-gray-700">
                            <span className="font-medium">Expected length:</span> ~{draftQuestion.expected_length} characters
                          </div>
                        )}
                        {draftQuestion.keywords && draftQuestion.keywords.length > 0 && (
                          <div className="text-gray-700">
                            <span className="font-medium">Keywords to include:</span> {draftQuestion.keywords.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Matching Question Preview */}
                {draftQuestion.question_type === 'matching' && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700">Matching Pairs:</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-500 uppercase">Left Side</div>
                        {draftQuestion.matching_pairs?.map((pair, idx) => (
                          <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <span className="font-medium text-blue-900">{idx + 1}.</span> {pair.left}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-500 uppercase">Right Side (shuffled for students)</div>
                        {draftQuestion.matching_pairs?.map((pair, idx) => (
                          <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            {pair.right}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Explanation */}
                {draftQuestion.explanation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-900 mb-2">Explanation:</div>
                    <div className="text-gray-800 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderTextWithLatex(draftQuestion.explanation) }} />
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
              className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Formatting Help</h3>
                <Button variant="outline" onClick={() => setShowHelpModal(false)}>Close</Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Text Formatting in Input Fields</h4>
                  <p className="text-sm text-gray-600">
                    You can use simple markdown formatting in Question Text and Options fields:
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border">_text_</code>
                      <span className="text-sm">→</span>
                      <em className="text-sm">italic text</em>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border">**text**</code>
                      <span className="text-sm">→</span>
                      <strong className="text-sm">bold text</strong>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border">__text__</code>
                      <span className="text-sm">→</span>
                      <u className="text-sm">underlined text</u>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border">~~text~~</code>
                      <span className="text-sm">→</span>
                      <del className="text-sm">strikethrough text</del>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border">`text`</code>
                      <span className="text-sm">→</span>
                      <code className="text-sm bg-gray-200 px-1 rounded">code text</code>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">LaTeX Formulas</h4>
                  <p className="text-sm text-gray-600">
                    For mathematical expressions, use LaTeX syntax:
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border">$x^2$</code>
                      <span className="text-sm">→</span>
                      <span className="text-sm">x² (inline formula)</span>
                    </div>

                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded border">$$\frac{"{a}"}{"{b}"}$$</code>
                      <span className="text-sm">→</span>
                      <span className="text-sm">a/b (block formula)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Rich Text Editor</h4>
                  <p className="text-sm text-gray-600">
                    For Passage and Explanation fields, use the rich text editor with full formatting toolbar including:
                  </p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>Bold, italic, underline, strikethrough</li>
                    <li>Colors and background colors</li>
                    <li>Lists (ordered and bullet)</li>
                    <li>Links and images</li>
                    <li>LaTeX formulas with visual editor</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Fill in the Blank Questions</h4>
                  <p className="text-sm text-gray-600">
                    For fill-in-the-blank questions, use double brackets in the passage:
                  </p>
                  <div className="p-3 bg-blue-50 rounded border space-y-2">
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Default (comma separator):</div>
                      <code className="text-sm font-mono">
                        The sky is [[blue, azure, cyan]] and the grass is [[green, emerald]].
                      </code>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Custom separator (e.g., slash):</div>
                      <code className="text-sm font-mono">
                        The capital is [[Paris / Lyon / Marseille]] and the river is [[Seine / Loire]].
                      </code>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      First option is correct, others are distractors. You can customize the separator character in the question settings.
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


