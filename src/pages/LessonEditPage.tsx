import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../services/api';
import type { Course, CourseModule, Lesson, LessonContentType, Assignment, Question, Step, FlashcardSet } from '../types';
import { 
  ChevronDown, 
  ChevronUp, 
  HelpCircle, 
  Settings, 
  Save, 
  ArrowLeft, 
  Video, 
  FileText, 
  HelpCircle as QuizIcon,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Play,
  Edit3,
  GripVertical,
  Trophy,
  Scissors
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isValidYouTubeUrl } from '../utils/youtube';
import VideoLessonEditor from '../components/lesson/VideoLessonEditor';
import TextLessonEditor from '../components/lesson/TextLessonEditor';
import QuizLessonEditor from '../components/lesson/QuizLessonEditor';
import FlashcardEditor from '../components/lesson/FlashcardEditor';
import Loader from '../components/Loader.tsx';
import MaintenanceBanner from '../components/MaintenanceBanner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';

interface LessonSidebarProps {
  course: Course | null;
  modules: CourseModule[];
  selectedLessonId: string;
  onLessonSelect: (lessonId: string) => void;
}

const videoLanguageMetaPattern = /<!--\s*video_lang_urls:\s*(\{[\s\S]*?\})\s*-->/i

const extractVideoLanguageMeta = (rawContent?: string) => {
  const content = rawContent || ''
  const match = content.match(videoLanguageMetaPattern)
  if (!match) {
    return {
      cleanContent: content,
      videoUrlEn: ''
    }
  }

  let videoUrlEn = ''
  try {
    const parsed = JSON.parse(match[1])
    if (parsed && typeof parsed.en === 'string') {
      videoUrlEn = parsed.en.trim()
    }
  } catch (error) {
    console.error('Failed to parse video language metadata:', error)
  }

  return {
    cleanContent: content.replace(videoLanguageMetaPattern, '').trim(),
    videoUrlEn
  }
}

const buildVideoStepContent = (content: string, videoUrlEn: string) => {
  const cleanContent = content.replace(videoLanguageMetaPattern, '').trim()
  const normalizedVideoUrlEn = videoUrlEn.trim()
  if (!normalizedVideoUrlEn) {
    return cleanContent
  }
  const metadata = `<!-- video_lang_urls:${JSON.stringify({ en: normalizedVideoUrlEn })} -->`
  return `${metadata}\n${cleanContent}`.trim()
}




const LessonSidebar = ({ course, modules, selectedLessonId, onLessonSelect }: LessonSidebarProps) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [moduleLectures, setModuleLectures] = useState<Map<string, Lesson[]>>(new Map());

  // Update expanded modules when modules are loaded
  useEffect(() => {
    if (modules.length > 0) {
      setExpandedModules(new Set(modules.map(m => m.id.toString())));
    }
  }, [modules]);

  // Auto-expand module containing current lesson
  useEffect(() => {
    if (selectedLessonId && modules.length > 0 && moduleLectures.size > 0) {
      // Find which module contains the current lesson
      for (const [moduleId, lessons] of moduleLectures.entries()) {
        const hasCurrentLesson = lessons.some(lesson => lesson.id === selectedLessonId);
        if (hasCurrentLesson) {
          setExpandedModules(prev => new Set([...prev, moduleId]));
          break;
        }
      }
    }
  }, [selectedLessonId, modules, moduleLectures]);

  // Load lectures for all modules on component mount
  useEffect(() => {
    const loadAllLectures = async () => {
      try {
        console.log('Loading lessons for course:', course?.id);
        // Use optimized endpoint to get all lessons for the course
        const allLessons = await apiClient.getCourseLessons(course?.id || '');
        console.log('Loaded lessons:', allLessons);
        
        // Group lessons by module
        const lecturesMap = new Map<string, Lesson[]>();
        for (const lesson of allLessons) {
          const moduleId = lesson.module_id.toString();
          if (!lecturesMap.has(moduleId)) {
            lecturesMap.set(moduleId, []);
          }
          lecturesMap.get(moduleId)!.push(lesson);
        }
        
        console.log('Grouped lessons by module:', lecturesMap);
        setModuleLectures(lecturesMap);
      } catch (error) {
        console.error('Failed to load course lessons:', error);
      }
    };
    
    if (modules.length > 0 && course?.id) {
      loadAllLectures();
    }
  }, [modules, course?.id]);

  const toggleModuleExpanded = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  return (
    <div className="w-64 bg-background border-r h-screen flex flex-col">
      {/* Course Header - Fixed */}
      <div className="p-4 border-b bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg truncate">{course?.title || 'Course'}</h2>
        </div>
      </div>
      
      {/* Modules and Lessons - Scrollable */}
      <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
        <div className="p-2">
          <div className="space-y-1">
            {modules
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
              .map((module, moduleIndex) => {
                const lectures = moduleLectures.get(module.id.toString()) || [];
                const isExpanded = expandedModules.has(module.id.toString());
                
                return (
                  <div key={module.id} className="space-y-1">
                    {/* Module Header */}
                    <button
                      onClick={() => toggleModuleExpanded(module.id.toString())}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left group ${
                        lectures.some(lesson => lesson.id === selectedLessonId)
                          ? 'bg-primary/10 border-l-2 border-primary'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-7 h-7 bg-primary text-primary-foreground rounded-full text-xs font-semibold">
                          {moduleIndex + 1}
                        </span>
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium text-foreground">{module.title}</span>
                          <span className="text-xs text-muted-foreground">{lectures.length} lesson{lectures.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </span>
                        {isExpanded ? 
                          <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" /> : 
                          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        }
                      </div>
                    </button>
                    
                    {/* Lessons List */}
                    {isExpanded && (
                      <div className="ml-4 space-y-1">
                        {lectures
                          .sort((a, b) => {
                            const orderA = a.order_index || 0;
                            const orderB = b.order_index || 0;
                            // If order_index is the same, use lesson ID for stable sorting
                            if (orderA === orderB) {
                              return parseInt(a.id) - parseInt(b.id);
                            }
                            return orderA - orderB;
                          })
                          .map((lecture, lectureIndex) => {
                            const isSelected = selectedLessonId === lecture.id;
                            const getLessonIcon = (steps: Step[] = []) => {
                              // Determine icon based on first step content type
                              if (steps.length > 0) {
                                switch (steps[0].content_type) {
                                  case 'video_text': return <Play className="w-4 h-4" />;
                                case 'quiz': return <QuizIcon className="w-4 h-4" />;
                                case 'text': return <FileText className="w-4 h-4" />;
                                default: return <Edit3 className="w-4 h-4" />;
                              }
                              }
                              return <Edit3 className="w-4 h-4" />;
                            };
                            
                            return (
                              <button
                                key={lecture.id}
                                onClick={() => onLessonSelect(lecture.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left text-sm transition-all duration-200 relative ${
                                  isSelected 
                                    ? 'bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30 border-l-4 border-primary' 
                                    : 'hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {/* Active indicator */}
                                {isSelected && (
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"></div>
                                )}
                                
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
                                  isSelected ? 'bg-primary-foreground/20' : 'bg-muted/50'
                                }`}>
                                  {getLessonIcon(lecture.steps || [])}
                                </div>
                                <div className="flex flex-col items-start flex-1 min-w-0">
                                  <span className={`font-medium truncate w-full ${
                                    isSelected ? 'text-primary-foreground' : ''
                                  }`}>
                                    {moduleIndex + 1}.{lectureIndex + 1} {lecture.title}
                                  </span>
                                  <div className="flex items-center gap-2 mt-1">
                                    {isSelected && (
                                      <span className="text-xs text-primary-foreground/80">
                                        Currently editing
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckCircle className="w-4 h-4 flex-shrink-0 text-primary-foreground" />
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Sortable Step Item Component
interface SortableStepItemProps {
  step: Step;
  isSelected: boolean;
  onSelect: () => void;
}

const SortableStepItem = ({ step, isSelected, onSelect }: SortableStepItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStepIcon = (contentType: string) => {
    switch (contentType) {
      case 'video_text':
        return <Play className="w-4 h-4" />;
      case 'quiz':
        return <HelpCircle className="w-4 h-4" />;
      case 'flashcard':
        return <BookOpen className="w-4 h-4" />;
      case 'summary':
        return <Trophy className="w-4 h-4" />;
      case 'text':
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      <div
        onClick={onSelect}
        className={`aspect-square rounded-md text-white p-1 relative shadow-sm hover:shadow-md transition-all cursor-pointer ${
          isSelected
            ? 'bg-blue-800 ring-2 ring-blue-400'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        <div className="h-full w-full flex flex-col items-start justify-end">
          <div className="absolute top-1 left-1 text-[10px] sm:text-[11px] bg-white/20 rounded px-1 py-0.5">
            {step.order_index}
          </div>
          <div className="flex items-center gap-1 opacity-90">
            {getStepIcon(step.content_type)}
          </div>
        </div>
      </div>
      
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center text-white shadow-md cursor-grab active:cursor-grabbing z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <GripVertical className="w-3 h-3" />
      </div>
    </div>
  );
};

export default function LessonEditPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isValidVideoUrl, setIsValidVideoUrl] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasCheckedDraft, setHasCheckedDraft] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isFixingOrder, setIsFixingOrder] = useState(false);
  const [nextLessonId, setNextLessonId] = useState<number | null>(null);
  const [courseLessons, setCourseLessons] = useState<Lesson[]>([]);

  // New tab state
  const [selectedTab, setSelectedTab] = useState<'video' | 'text' | 'quiz'>('video');
  const [contentType, setContentType] = useState<LessonContentType>('video');
  
  // Quiz state
  const [quizTitle, setQuizTitle] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizTimeLimit, setQuizTimeLimit] = useState<number | undefined>(undefined);
  const [quizDisplayMode, setQuizDisplayMode] = useState<'one_by_one' | 'all_at_once'>('one_by_one');
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);

  // Steps management state
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [stepTitle, setStepTitle] = useState('');
 const [stepContentType, setStepContentType] = useState<'text' | 'video_text' | 'quiz' | 'flashcard' | 'summary'>('text');
  const [stepContent, setStepContent] = useState('');
  const [stepVideoUrl, setStepVideoUrl] = useState('');
  const [stepVideoUrlEn, setStepVideoUrlEn] = useState('');
  const [stepIsOptional, setStepIsOptional] = useState(false);
  const [stepQuizTitle, setStepQuizTitle] = useState('');
  const [stepQuizQuestions, setStepQuizQuestions] = useState<Question[]>([]);
  const [stepQuizDisplayMode, setStepQuizDisplayMode] = useState<'one_by_one' | 'all_at_once'>('one_by_one');
  
  // Flashcard state
  const [stepFlashcardSet, setStepFlashcardSet] = useState<FlashcardSet>({
    title: '',
    description: '',
    cards: [],
    study_mode: 'sequential',
    auto_flip: false,
    show_progress: true
  });
  
  // Temporary files for new steps
  const [tempFiles, setTempFiles] = useState<Map<number, File[]>>(new Map());
  
  // Handle temporary files for new steps
  const handleTempFilesChange = (stepId: number, files: File[]) => {
    const newTempFiles = new Map(tempFiles);
    if (files.length > 0) {
      newTempFiles.set(stepId, files);
    } else {
      newTempFiles.delete(stepId);
    }
    setTempFiles(newTempFiles);
  };
  
  const [stepQuizTimeLimit, setStepQuizTimeLimit] = useState<number | undefined>(undefined);
  const [stepQuizType, setStepQuizType] = useState<'regular' | 'audio' | 'pdf' | 'text_based'>('regular');
  const [stepQuizMediaUrl, setStepQuizMediaUrl] = useState<string>('');
  const [stepQuizMediaType, setStepQuizMediaType] = useState<'audio' | 'pdf' | 'text' | ''>('');
  const [stepAudioPlaybackMode, setStepAudioPlaybackMode] = useState<'strict' | 'flexible'>('flexible');
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepType, setNewStepType] = useState<'text' | 'video_text' | 'quiz' | 'flashcard' | 'summary'>('text');
  
  // State for step switching with unsaved changes
  const [showStepSwitchDialog, setShowStepSwitchDialog] = useState(false);
  const [pendingStepToSwitch, setPendingStepToSwitch] = useState<Step | null>(null);
  const [isLoadingStep, setIsLoadingStep] = useState(false);
  
  // State for step reordering
  const [isReordering, setIsReordering] = useState(false);

  // Immediate auto-save function
  const immediateAutoSave = useCallback(
    (lessonId: string, title: string, contentData: any, contentType: string) => {
      setAutoSaveStatus('saving');
      saveToLocalStorage(lessonId, { title, contentData, contentType });
    },
    []
  );

  useEffect(() => {
    if (!courseId || !lessonId) return;
    loadData();
  }, [courseId, lessonId]);



  // Load draft from localStorage on component mount (silent)
  useEffect(() => {
    if (lessonId && !isLoading && !hasCheckedDraft) {
      const savedData = loadFromLocalStorage(lessonId);
      if (savedData) {
        // Silently restore draft data
        setLessonTitle(savedData.title);
        setContentType(savedData.contentType);
        setSelectedTab(savedData.contentType === 'quiz' ? 'quiz' : savedData.contentType === 'text' ? 'text' : 'video');
        
        if (savedData.contentType === 'video') {
          if (savedData.contentData?.videoUrl) {
            setVideoUrl(savedData.contentData.videoUrl);
          }
          if (savedData.contentData?.lessonContent) {
            setLessonContent(savedData.contentData.lessonContent);
          }
        } else if (savedData.contentType === 'text' && savedData.contentData?.lessonContent) {
          setLessonContent(savedData.contentData.lessonContent);
                    } else if (savedData.contentType === 'quiz' && savedData.contentData) {
              setQuizTitle(savedData.contentData.quizTitle || '');
              setQuizQuestions(savedData.contentData.quizQuestions || []);
              setQuizTimeLimit(savedData.contentData.quizTimeLimit);
              setQuizDisplayMode(savedData.contentData.quizDisplayMode || 'one_by_one');
            }
        
        // Don't mark as unsaved - we just loaded the data
        // setHasUnsavedChanges(true); // REMOVED
      }
      setHasCheckedDraft(true);
    }
  }, [lessonId, isLoading, hasCheckedDraft]);

  // Auto-save on changes
  useEffect(() => {
    if (lessonId && !isLoading) {
      let hasContent = false;
      let contentData = {};
      
      if (contentType === 'video' && (videoUrl || lessonContent)) {
        hasContent = true;
        contentData = { videoUrl, lessonContent };
      } else if (contentType === 'text' && lessonContent) {
        hasContent = true;
        contentData = { lessonContent };
      } else if (contentType === 'quiz' && (quizTitle || quizQuestions.length > 0)) {
        hasContent = true;
        contentData = { quizTitle, quizQuestions, quizTimeLimit, quizDisplayMode };
      }
      
      if (lessonTitle || hasContent) {
        immediateAutoSave(lessonId, lessonTitle, contentData, contentType);
      }
    }
  }, [lessonId, lessonTitle, lessonContent, videoUrl, quizTitle, quizQuestions, quizTimeLimit, contentType, isLoading, immediateAutoSave]);
  
  // Handler to mark as unsaved when user actually changes something
  const markAsUnsaved = () => {
    if (!isLoading && !isSaving && !isLoadingStep && hasCheckedDraft) {
      setHasUnsavedChanges(true);
    }
  };
  
  // Wrapped setters that mark as unsaved only on user input
  const handleStepTitleChange = (value: string) => {
    setStepTitle(value);
    markAsUnsaved();
  };
  
  const handleStepContentChange = (value: string) => {
    setStepContent(value);
    markAsUnsaved();
  };
  
  const handleStepVideoUrlChange = (value: string) => {
    setStepVideoUrl(value);
    markAsUnsaved();
  };

  const handleStepVideoUrlEnChange = (value: string) => {
    setStepVideoUrlEn(value)
    markAsUnsaved()
  }
  
  const handleStepQuizTitleChange = (value: string) => {
    setStepQuizTitle(value);
    markAsUnsaved();
  };
  
  const handleStepQuizQuestionsChange = (value: Question[]) => {
    setStepQuizQuestions(value);
    markAsUnsaved();
  };
  
  const handleStepFlashcardSetChange = (value: FlashcardSet) => {
    setStepFlashcardSet(value);
    markAsUnsaved();
  };

  const handleStepIsOptionalChange = (checked: boolean) => {
    setStepIsOptional(checked);
    markAsUnsaved();
  };

  // Unsaved changes warning - block navigation if there are unsaved changes
  const { confirmLeave, cancelLeave, isBlocked } = useUnsavedChangesWarning({
    hasUnsavedChanges,
    message: 'You have unsaved changes in this lesson. Save this step before continuing!',
    onConfirmLeave: () => {
      setHasUnsavedChanges(false);
    }
  });

  const loadData = async () => {
    if (!courseId || !lessonId) return;
    
    setIsLoading(true);
    try {
      // Debug: Check authentication
      const isAuth = apiClient.isAuthenticated();
      
      if (!isAuth) {
        console.error('User is not authenticated');
        throw new Error('Authentication required');
      }
      
      // Load course and modules
      const courseData = await apiClient.getCourse(courseId);
      setCourse(courseData);
      console.log('Loaded course:', courseData);
      
      const modulesData = await apiClient.getCourseModules(courseId);
      setModules(modulesData);
      console.log('Loaded modules:', modulesData);
      // Load all lessons of the course for selector
      try {
        const allLessons = await apiClient.getCourseLessons(courseId);
        setCourseLessons(allLessons);
      } catch (e) {
        setCourseLessons([]);
      }
      
      // Load lesson with steps
      const lessonData = await apiClient.getLesson(lessonId);
      
      setLesson(lessonData);
      setLessonTitle(lessonData.title);
      setNextLessonId((lessonData as any).next_lesson_id ?? null);
      
      // Load steps for this lesson
      const stepsData = await apiClient.getLessonSteps(lessonId);
      setSteps(stepsData);
      
      // Set content type and tab based on first step
      if (stepsData.length > 0) {
        const firstStep = stepsData[0];
        setContentType(firstStep.content_type as LessonContentType);
      
      // Map content type to tab and set data based on type
        if (firstStep.content_type === 'quiz') {
        setSelectedTab('quiz');
          try {
            const quizData = JSON.parse(firstStep.content_text || '{}');
            setQuizTitle(quizData.title || lessonData.title);
            setQuizQuestions(quizData.questions || []);
            setQuizTimeLimit(quizData.time_limit_minutes);
            setQuizDisplayMode(quizData.display_mode || 'one_by_one');
          } catch (e) {
            console.error('Failed to parse quiz data:', e);
          }
        } else if (firstStep.content_type === 'text') {
        setSelectedTab('text');
          setLessonContent(firstStep.content_text || '');
        } else if (firstStep.content_type === 'video_text') {
        setSelectedTab('video');
          setVideoUrl(firstStep.video_url || '');
          setLessonContent(extractVideoLanguageMeta(firstStep.content_text).cleanContent);
        }
        
        // Select first step by default
        setIsLoadingStep(true);
        setSelectedStepId(firstStep.id);
        setStepTitle(firstStep.title || 'Step 1');
        setStepContentType(firstStep.content_type);
        const firstStepVideoMeta = extractVideoLanguageMeta(firstStep.content_text);
        setStepContent(firstStepVideoMeta.cleanContent);
        setStepVideoUrl(firstStep.video_url || '');
        setStepVideoUrlEn(firstStepVideoMeta.videoUrlEn);
        setStepIsOptional(firstStep.is_optional || false);
        
        if (firstStep.content_type === 'quiz') {
          try {
            const quizData = JSON.parse(firstStep.content_text || '{}');
            setStepQuizTitle(quizData.title || '');
            setStepQuizQuestions(quizData.questions || []);
            setStepQuizTimeLimit(quizData.time_limit_minutes);
            setStepQuizDisplayMode(quizData.display_mode || 'one_by_one');
            setStepQuizType(quizData.quiz_type || 'regular');
            setStepQuizMediaUrl(quizData.quiz_media_url || '');
            setStepQuizMediaType(quizData.quiz_media_type || '');
            setStepAudioPlaybackMode(quizData.audio_playback_mode || 'flexible');
          } catch (e) {
            console.error('Failed to parse quiz data:', e);
          }
        }
        
        // Reset loading flag after initial load
        setTimeout(() => setIsLoadingStep(false), 0);
      } else {
        // No steps yet, create a default step (local only)
        const localDefaultStep: Step = {
          id: -Date.now(),
          lesson_id: parseInt(lessonId),
          title: 'Step 1',
          content_type: 'text' as const,
          content_text: '',
          video_url: '',
          order_index: 1,
          created_at: new Date().toISOString(),
        } as unknown as Step;
        setSteps([localDefaultStep]);
        setIsLoadingStep(true);
        setSelectedStepId(localDefaultStep.id);
        setStepTitle(localDefaultStep.title);
        setStepContentType(localDefaultStep.content_type);
        setStepContentType(localDefaultStep.content_type);
        setStepContent(localDefaultStep.content_text || '');
        setStepVideoUrlEn('');
        setStepIsOptional(false);
        setTimeout(() => setIsLoadingStep(false), 0);
         
        // Default to text
        setSelectedTab('text');
        setContentType('text' as LessonContentType);
      }
      
    } catch (error) {
      console.error('Failed to load lesson data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Steps management functions
  const addNewStep = () => {
    setShowAddStepModal(true);
  };

  const createStep = async () => {
    const maxOrderIndex = steps.length > 0 ? Math.max(...steps.map(s => s.order_index)) : 0;
    const stepNumber = maxOrderIndex + 1;

    const newLocalStep: Step = {
      id: -Date.now(),
      lesson_id: parseInt(lessonId || '0'),
      title: `Step ${stepNumber}`,
      content_type: newStepType,
      content_text: '',
      order_index: stepNumber,
      created_at: new Date().toISOString(),
    } as unknown as Step;

    const updated = [...steps, newLocalStep].sort((a, b) => a.order_index - b.order_index);
    setSteps(updated);
    setSelectedStepId(newLocalStep.id);
    setStepTitle(newLocalStep.title);
    setStepContentType(newLocalStep.content_type);
    setStepContent('');
    setStepVideoUrl('');
    setStepVideoUrlEn('');
    setStepIsOptional(false);
    
    // Initialize quiz with default question if it's a quiz step
    if (newStepType === 'quiz') {
      const ts = Date.now().toString();
      const baseQuestion: Question = {
        id: ts,
        assignment_id: '',
        question_text: '',
        question_type: 'single_choice',
        options: [
          { text: '', is_correct: false },
          { text: '', is_correct: false }
        ],
        correct_answers: [],
        explanation: '',
        media_files: [],
        difficulty: 1,
        order_index: 0,
      } as unknown as Question;
      
      setStepQuizTitle('');
      setStepQuizQuestions([baseQuestion]);
      setStepQuizTimeLimit(undefined);
    } else {
      setStepQuizTitle('');
      setStepQuizQuestions([]);
      setStepQuizTimeLimit(undefined);
    }
    
    setShowAddStepModal(false);
    setNewStepType('text');
  };


  const selectStep = (step: Step) => {
    // Check if there are unsaved changes before switching
    if (hasUnsavedChanges && step.id !== selectedStepId) {
      setPendingStepToSwitch(step);
      setShowStepSwitchDialog(true);
      return;
    }
    
    // Actually switch to the step
    performStepSwitch(step);
  };
  
  // Handle URL step parameter for deep linking
  useEffect(() => {
    if (steps.length > 0 && !isLoading) {
      const stepParam = searchParams.get('step');
      const questionIdParam = searchParams.get('questionId');
      
      if (stepParam) {
        const stepNum = parseInt(stepParam, 10);
        if (!isNaN(stepNum) && stepNum > 0) {
          // Find step by 1-based index (order_index-based)
          const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
          if (stepNum <= sortedSteps.length) {
            const targetStep = sortedSteps[stepNum - 1];
            // Only switch if we're not already on this step
            if (selectedStepId !== targetStep.id) {
              selectStep(targetStep);
            }
          }
        }
      } else if (searchParams.get('stepId')) {
        const sId = parseInt(searchParams.get('stepId')!, 10);
        const targetStep = steps.find(s => s.id === sId);
        if (targetStep && selectedStepId !== targetStep.id) {
          selectStep(targetStep);
        }
      }
    }
  }, [steps.length, isLoading, searchParams]);
  
  const performStepSwitch = (step: Step) => {
    setIsLoadingStep(true); // Prevent marking as unsaved during load
    
    setSelectedStepId(step.id);
    setStepTitle(step.title || `Step ${step.order_index || 1}`);
    setStepContentType(step.content_type);
    const stepVideoMeta = extractVideoLanguageMeta(step.content_text);
    setStepContent(stepVideoMeta.cleanContent);
    setStepVideoUrl(step.video_url || '');
    setStepVideoUrlEn(stepVideoMeta.videoUrlEn);
    setStepIsOptional(step.is_optional || false);

    if (step.content_type === 'quiz') {
      try {
        const quizData = JSON.parse(step.content_text || '{}');
        setStepQuizTitle(quizData.title || '');
        setStepQuizQuestions(quizData.questions || []);
        setStepQuizTimeLimit(quizData.time_limit_minutes);
        setStepQuizDisplayMode(quizData.display_mode || 'one_by_one');
        setStepQuizType(quizData.quiz_type || 'regular');
        setStepQuizMediaUrl(quizData.quiz_media_url || '');
        setStepQuizMediaType(quizData.quiz_media_type || '');
        setStepAudioPlaybackMode(quizData.audio_playback_mode || 'flexible');
      } catch (e) {
        console.error('Failed to parse quiz data:', e);
      }
    } else {
      setStepQuizTitle('');
      setStepQuizQuestions([]);
      setStepQuizTimeLimit(undefined);
      setStepQuizDisplayMode('one_by_one');
      setStepQuizType('regular');
      setStepQuizMediaUrl('');
      setStepQuizMediaType('');
      setStepAudioPlaybackMode('flexible');
    }

    if (step.content_type === 'flashcard') {
      try {
        const flashcardData = JSON.parse(step.content_text || '{}');
        setStepFlashcardSet({
          title: flashcardData.title || '',
          description: flashcardData.description || '',
          cards: flashcardData.cards || [],
          study_mode: flashcardData.study_mode || 'sequential',
          auto_flip: flashcardData.auto_flip || false,
          show_progress: flashcardData.show_progress !== false
        });
      } catch (e) {
        console.error('Failed to parse flashcard data:', e);
        setStepFlashcardSet({
          title: '',
          description: '',
          cards: [],
          study_mode: 'sequential',
          auto_flip: false,
          show_progress: true
        });
      }
    } else {
      setStepFlashcardSet({
        title: '',
        description: '',
        cards: [],
        study_mode: 'sequential',
        auto_flip: false,
        show_progress: true
      });
    }
    
    // Reset loading flag after state updates
    setTimeout(() => setIsLoadingStep(false), 0);
  };

  const deleteStep = async (stepId: number) => {
    const remaining = steps
      .filter(s => s.id !== stepId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((s, idx) => ({ ...s, order_index: idx + 1, title: (s.title || '').replace(/^Step \d+/, `Step ${idx + 1}`) }));
    setSteps(remaining);

    if (selectedStepId === stepId) {
      if (remaining.length > 0) {
        selectStep(remaining[0]);
      } else {
        setSelectedStepId(null);
      }
    }
  };

  const splitLessonAtStep = async (stepId: number) => {
    if (!courseId || !lessonId) return;
    const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
    const stepIndex = sortedSteps.findIndex(s => s.id === stepId);
    if (stepIndex < 0 || stepIndex >= sortedSteps.length - 1) {
      alert('Cannot split: this must not be the last step.');
      return;
    }
    const stepsAfter = sortedSteps.length - stepIndex - 1;
    if (!confirm(`Split lesson after step ${stepIndex + 1}? ${stepsAfter} step(s) will be moved to a new lesson.`)) return;
    try {
      const result = await apiClient.splitLesson(courseId, lessonId, stepIndex);
      alert(`Lesson split! New lesson "${result.new_lesson_title}" created with ${result.steps_moved} step(s).`);
      // Reload current lesson (now shorter)
      const stepsData = await apiClient.getLessonSteps(lessonId);
      setSteps(stepsData);
      if (stepsData.length > 0) {
        selectStep(stepsData[0]);
      } else {
        setSelectedStepId(null);
      }
    } catch (error) {
      console.error('Failed to split lesson:', error);
      alert('Failed to split lesson. Please try again.');
    }
  };

  // Handle drag end for step reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setIsReordering(true);
    try {
      const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
      const oldIndex = sortedSteps.findIndex((step) => step.id === active.id);
      const newIndex = sortedSteps.findIndex((step) => step.id === over.id);

      const newSteps = arrayMove(sortedSteps, oldIndex, newIndex);
      
      // Update order_index for all steps
      newSteps.forEach((step, index) => {
        step.order_index = index + 1;
      });

      // Optimistically update UI
      setSteps(newSteps);

      // Send update to backend
      const stepIds = newSteps.map((s) => s.id);
      await apiClient.reorderSteps(lessonId!, stepIds);

      // Reload steps to ensure consistency
      const stepsData = await apiClient.getLessonSteps(lessonId!);
      setSteps(stepsData);

      markAsUnsaved();
    } catch (error) {
      console.error('Failed to reorder steps:', error);
      // Revert on error - reload from backend
      const stepsData = await apiClient.getLessonSteps(lessonId!);
      setSteps(stepsData);
      alert('Failed to reorder steps. Please try again.');
    } finally {
      setIsReordering(false);
    }
  };

  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const saveCurrentStep = async () => {
    if (!selectedStepId) return;

    const updatedSteps = steps.map(s => {
      if (s.id !== selectedStepId) return s;
      const updated: Partial<Step> = {
        title: stepTitle,
        content_type: stepContentType,
        attachments: s.attachments, // Preserve existing attachments
        is_optional: stepIsOptional,
      };
      if (stepContentType === 'text') {
        updated.content_text = stepContent;
        updated.video_url = '';
      } else if (stepContentType === 'video_text') {
        updated.video_url = stepVideoUrl;
        updated.content_text = buildVideoStepContent(stepContent, stepVideoUrlEn);
      } else if (stepContentType === 'quiz') {
        updated.content_text = JSON.stringify({
          title: stepQuizTitle,
          questions: stepQuizQuestions,
          time_limit_minutes: stepQuizTimeLimit,
          display_mode: stepQuizDisplayMode
        });
        updated.video_url = '';
      } else if (stepContentType === 'flashcard') {
        updated.content_text = JSON.stringify(stepFlashcardSet);
        updated.video_url = '';
      }
      return { ...s, ...updated } as Step;
    });

    setSteps(updatedSteps);
  };

  const handleSave = async () => {
    if (!lessonId) return;
    
    setIsSaving(true);
    try {
      // 1) Merge current editor state into steps so unsaved edits are included
      let mergedSteps = steps;
      if (selectedStepId) {
        mergedSteps = steps.map(s => {
          if (s.id !== selectedStepId) return s;
          const updated: Partial<Step> = {
            title: stepTitle,
            content_type: stepContentType,
            attachments: s.attachments, // Preserve existing attachments
            is_optional: stepIsOptional,
          };
          if (stepContentType === 'text') {
            updated.content_text = stepContent;
            updated.video_url = '';
          } else if (stepContentType === 'video_text') {
            updated.video_url = stepVideoUrl;
            updated.content_text = buildVideoStepContent(stepContent, stepVideoUrlEn);
          } else if (stepContentType === 'quiz') {
            updated.content_text = JSON.stringify({
              title: stepQuizTitle,
              questions: stepQuizQuestions,
              time_limit_minutes: stepQuizTimeLimit,
              display_mode: stepQuizDisplayMode,
              quiz_type: stepQuizType,
              quiz_media_url: stepQuizMediaUrl,
              quiz_media_type: stepQuizMediaType,
              audio_playback_mode: stepAudioPlaybackMode
            });
            updated.video_url = '';
          } else if (stepContentType === 'flashcard') {
            updated.content_text = JSON.stringify(stepFlashcardSet);
            updated.video_url = '';
          }
          return { ...s, ...updated } as Step;
        });
        setSteps(mergedSteps);
      }

      const lessonUpdateData = {
        title: lessonTitle,
        order_index: lesson?.order_index || 0,
        next_lesson_id: nextLessonId ?? null
      };
      
      const updatedLesson = await apiClient.updateLesson(lessonId, lessonUpdateData);
      setLesson(updatedLesson);
      
      // Sync steps: update existing, create new, delete removed
      // This approach preserves step IDs and therefore student progress
      const existingSteps = await apiClient.getLessonSteps(lessonId);
      const existingStepIds = new Set(existingSteps.map(s => s.id));
      
      const orderedLocal = [...mergedSteps].sort((a, b) => a.order_index - b.order_index);
      // Local steps with positive IDs are existing steps; negative IDs are new (temporary)
      const localExistingStepIds = new Set(orderedLocal.filter(s => s.id > 0).map(s => s.id));
      
      // 1. Delete steps that exist on server but not in local state (explicitly removed by teacher)
      for (const s of existingSteps) {
        if (!localExistingStepIds.has(s.id)) {
          await apiClient.deleteStep(s.id.toString());
        }
      }
      
      // 2. Update existing steps or create new ones
      const stepIdMapping = new Map<number, number>(); // Maps old temp ID to new real ID
      
      for (const s of orderedLocal) {
        const payload: Partial<Step> = {
          title: s.title,
          content_type: s.content_type,
          order_index: s.order_index,
          content_text: s.content_text || '',
          video_url: s.video_url || '',
          attachments: s.attachments || undefined,
          is_optional: s.is_optional
        };
        
        let actualStepId: number;
        
        if (s.id > 0 && existingStepIds.has(s.id)) {
          // Update existing step (preserves step_id, preserves StepProgress)
          await apiClient.updateStep(s.id.toString(), payload);
          actualStepId = s.id;
        } else {
          // Create new step (only for new steps with negative temporary IDs)
          const createdStep = await apiClient.createStep(lessonId, payload);
          actualStepId = createdStep.id;
          stepIdMapping.set(s.id, actualStepId);
        }
        
        // Upload temporary files for this step if any exist
        const tempFilesForStep = tempFiles.get(s.id);
        
        if (tempFilesForStep && tempFilesForStep.length > 0) {
          for (const file of tempFilesForStep) {
            try {
              await apiClient.uploadStepAttachment(actualStepId.toString(), file);
            } catch (error) {
              console.error(`Failed to upload file ${file.name} for step ${actualStepId}:`, error);
            }
          }
          // Clear temporary files after successful upload
          const newTempFiles = new Map(tempFiles);
          newTempFiles.delete(s.id);
          setTempFiles(newTempFiles);
        }
      }

      // Reload fresh steps from server and sync selection by order_index
      const freshSteps = await apiClient.getLessonSteps(lessonId);
      setSteps(freshSteps);
      setIsLoadingStep(true); // Prevent marking as unsaved during reload after save
      if (selectedStepId) {
        const prevOrder = orderedLocal.find(s => s.id === selectedStepId)?.order_index || 1;
        const match = freshSteps.find(s => s.order_index === prevOrder) || freshSteps[0];
        if (match) {
          setSelectedStepId(match.id);
          setStepTitle(match.title);
          setStepContentType(match.content_type as any);
          const matchVideoMeta = extractVideoLanguageMeta(match.content_text);
          setStepContent(matchVideoMeta.cleanContent);
          setStepVideoUrl(match.video_url || '');
          setStepVideoUrlEn(matchVideoMeta.videoUrlEn);
          setStepIsOptional(match.is_optional || false);
          
          // Load quiz data if it's a quiz step
          if (match.content_type === 'quiz') {
            try {
              const quizData = JSON.parse(match.content_text || '{}');
              setStepQuizTitle(quizData.title || '');
              setStepQuizQuestions(quizData.questions || []);
              setStepQuizTimeLimit(quizData.time_limit_minutes);
              setStepQuizDisplayMode(quizData.display_mode || 'one_by_one');
              setStepQuizType(quizData.quiz_type || 'regular');
              setStepQuizMediaUrl(quizData.quiz_media_url || '');
              setStepQuizMediaType(quizData.quiz_media_type || '');
              setStepAudioPlaybackMode(quizData.audio_playback_mode || 'flexible');
            } catch (e) {
              console.error('Failed to parse quiz data:', e);
            }
          }
          
          // Load flashcard data if it's a flashcard step
          if (match.content_type === 'flashcard') {
            try {
              const flashcardData = JSON.parse(match.content_text || '{}');
              setStepFlashcardSet({
                title: flashcardData.title || '',
                description: flashcardData.description || '',
                cards: flashcardData.cards || [],
                study_mode: flashcardData.study_mode || 'sequential',
                auto_flip: flashcardData.auto_flip || false,
                show_progress: flashcardData.show_progress !== false
              });
            } catch (e) {
              console.error('Failed to parse flashcard data:', e);
            }
          }
          
          setTimeout(() => setIsLoadingStep(false), 0);
        }
      }

      // Refresh sidebar modules
      if (course?.id) {
        const updatedModules = await apiClient.getCourseModules(course.id);
        setModules(updatedModules);
      }
      
      // Refresh to sync next lesson value
      const refreshedLesson = await apiClient.getLesson(lessonId);
      setLesson(refreshedLesson);
      setNextLessonId((refreshedLesson as any).next_lesson_id ?? null);

      clearLocalStorage(lessonId);
      setHasUnsavedChanges(false); // Clear unsaved flag after successful save
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save lesson:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLessonSelect = (newLessonId: string) => {
    if (newLessonId !== lessonId) {
      navigate(`/teacher/course/${courseId}/lesson/${newLessonId}/edit`);
    }
  };

  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
    setVideoError(null);
    
    // Immediate save on video URL change
    if (lessonId && !isLoading && contentType === 'video') {
      const contentData = { videoUrl: url, lessonContent };
      immediateAutoSave(lessonId, lessonTitle, contentData, contentType);
    }
    
    if (url.trim() === '') {
      return;
    }
    
    const isValid = isValidYouTubeUrl(url);
    
    if (!isValid && url.trim() !== '') {
      setVideoError('Please enter a valid YouTube URL');
    }
  };

  const handleVideoError = (error: string) => {
    setVideoError(error);
  };

  // LocalStorage functions
  const getLocalStorageKey = (lessonId: string) => `lesson_draft_${lessonId}`;
  const getTimestampKey = (lessonId: string) => `lesson_draft_timestamp_${lessonId}`;

  const saveToLocalStorage = (lessonId: string, data: {
    title: string;
    contentData: any;
    contentType: string;
  }) => {
    try {
      const key = getLocalStorageKey(lessonId);
      const timestampKey = getTimestampKey(lessonId);
      const timestamp = Date.now();
      
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(timestampKey, timestamp.toString());
      
      setAutoSaveStatus('saved');
      // Don't set hasUnsavedChanges here - it's set by user input changes
      // setHasUnsavedChanges(true); // REMOVED - this was causing false positives
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      setAutoSaveStatus('unsaved');
    }
  };

  const loadFromLocalStorage = (lessonId: string) => {
    try {
      const key = getLocalStorageKey(lessonId);
      const timestampKey = getTimestampKey(lessonId);
      
      const savedData = localStorage.getItem(key);
      const savedTimestamp = localStorage.getItem(timestampKey);
      
      if (savedData && savedTimestamp) {
        const data = JSON.parse(savedData);
        const timestamp = parseInt(savedTimestamp);
        const hoursSinceLastSave = (Date.now() - timestamp) / (1000 * 60 * 60);
        
        // Only restore if saved within last 24 hours
        if (hoursSinceLastSave < 24) {
          return data;
        } else {
          // Clear old drafts
          clearLocalStorage(lessonId);
        }
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    return null;
  };

  const clearLocalStorage = (lessonId: string) => {
    try {
      const key = getLocalStorageKey(lessonId);
      const timestampKey = getTimestampKey(lessonId);
      
      localStorage.removeItem(key);
      localStorage.removeItem(timestampKey);
      
      setAutoSaveStatus('saved');
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader size="xl" animation="spin" color="#2563eb" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-600">Lesson not found</div>
      </div>
    );
  }

  const remainingChars = 100 - lessonTitle.length;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <LessonSidebar
        course={course}
        modules={modules}
        selectedLessonId={lessonId!}
        onLessonSelect={handleLessonSelect}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* <MaintenanceBanner /> */}
        {/* Header */}
        <Card className="border-0 rounded-none border-b">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Lesson Settings</CardTitle>
                  <CardDescription>
                    Configure your lesson content and settings
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {showSaveSuccess && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-md border border-green-200">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Lesson saved</span>
                  </div>
                )}
                {autoSaveStatus === 'saving' && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium">Saving...</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
        
        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-3">
            {/* Lesson Title */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5" />
                  Lesson Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lesson-title">Title</Label>
                    <span className="text-sm text-muted-foreground">
                      {remainingChars} characters remaining
                    </span>
                  </div>
                  <Input
                    id="lesson-title"
                    type="text"
                    value={lessonTitle}
                    onChange={(e) => {
                      setLessonTitle(e.target.value);
                      // Immediate save on each character
                      if (lessonId && !isLoading) {
                        const contentData = contentType === 'video' ? { videoUrl } : 
                                          contentType === 'text' ? { lessonContent } : 
                                          contentType === 'quiz' ? { quizTitle, quizQuestions, quizTimeLimit, quizDisplayMode } : {};
                        immediateAutoSave(lessonId, e.target.value, contentData, contentType);
                      }
                    }}
                    maxLength={100}
                    placeholder="Enter lesson title"
                  />
                </div>
                {/* Next Lesson Selector */}
                <div className="space-y-2">
                  <Label>Next lesson (optional)</Label>
                  <Select
                    value={nextLessonId ? String(nextLessonId) : 'none'}
                    onValueChange={(value) => {
                      setNextLessonId(value === 'none' ? null : parseInt(value));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None (follow default order)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (follow default order)</SelectItem>
                      {modules
                        .slice()
                        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                        .map((m) => (
                          <SelectGroup key={m.id}>
                            <SelectLabel>{`Section ${m.order_index+1}: ${m.title}`}</SelectLabel>
                            {courseLessons
                              .filter((l) => String(l.module_id) === String(m.id))
                              .slice()
                              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                              .filter((l) => String(l.id) !== String(lessonId))
                              .map((l) => (
                                <SelectItem key={l.id} value={String(l.id)}>
                                  {m.order_index+1}.{l.order_index} {l.title}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            {/* Steps (blue tiles) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-foreground">Lesson Content</h3>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={steps.map(s => s.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
                    {steps
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((step) => (
                        <SortableStepItem
                          key={step.id}
                          step={step}
                          isSelected={selectedStepId === step.id}
                          onSelect={() => selectStep(step)}
                        />
                      ))}
                    <button
                      onClick={addNewStep}
                      className="aspect-square rounded-md border-2 border-dashed border-blue-300 hover:border-blue-500 flex items-center justify-center text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <Plus className="w-6 h-6" />
                      </div>
                    </button>
                  </div>
                </SortableContext>
              </DndContext>
            </div>
                         <div className="flex-1 overflow-y-auto mt-4">
               {selectedStepId && (
                 <div className="space-y-2">
                   <div className="flex items-center gap-2 pb-2 font-medium text-foreground text-lg">
                     <h3>
                       Step {steps.find(s => s.id === selectedStepId)?.order_index}: {stepContentType === 'video_text' ? 'Video + Text' : stepContentType.charAt(0).toUpperCase() + stepContentType.slice(1)}
                     </h3>
                     <div className="flex items-center gap-1 ml-auto">
                       <Button 
                         variant="outline" 
                         size="icon"
                         onClick={() => splitLessonAtStep(selectedStepId)}
                         className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                         title="Split lesson after this step"
                       >
                         <Scissors className="w-4 h-4" />
                       </Button>
                       <Button 
                         variant="outline" 
                         size="icon"
                         onClick={() => deleteStep(selectedStepId)}
                         className="text-red-600 hover:text-red-700 hover:bg-red-50"
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                     </div>
                    </div>
                    {/* Optional Step Toggle */}
                    <div className="flex items-center space-x-2 my-2 p-2 bg-muted/30 rounded-md">
                      <input
                        type="checkbox"
                        id="is-optional"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={stepIsOptional}
                        onChange={(e) => handleStepIsOptionalChange(e.target.checked)}
                      />
                      <label 
                        htmlFor="is-optional" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Optional Step (students can skip this step)
                      </label>
                    </div>
                    <div>
                    {stepContentType === 'text' && (
                      <div className="space-y-3">
                        <TextLessonEditor
                          content={stepContent}
                          onContentChange={handleStepContentChange}
                          stepId={selectedStepId && selectedStepId > 0 ? selectedStepId : undefined}
                          attachments={steps.find(s => s.id === selectedStepId)?.attachments}
                          onAttachmentsChange={(attachments) => {
                            // Update the current step's attachments in the steps array
                            const updatedSteps = steps.map(s => 
                              s.id === selectedStepId 
                                ? { ...s, attachments }
                                : s
                            );
                            setSteps(updatedSteps);
                            markAsUnsaved();
                          }}
                          onTempFilesChange={selectedStepId && selectedStepId < 0 ? (files) => handleTempFilesChange(selectedStepId, files) : undefined}
                        />
                      </div>
                    )}

                    {stepContentType === 'video_text' && (
                      <div className="space-y-3">
                    <VideoLessonEditor
                          lessonTitle={stepTitle || lessonTitle}
                          videoUrlRu={stepVideoUrl}
                          videoUrlEn={stepVideoUrlEn}
                          onVideoUrlRuChange={handleStepVideoUrlChange}
                          onVideoUrlEnChange={handleStepVideoUrlEnChange}
                          onClearUrlRu={() => handleStepVideoUrlChange('')}
                          onClearUrlEn={() => handleStepVideoUrlEnChange('')}
                          content={stepContent}
                          onContentChange={handleStepContentChange}
                          stepId={selectedStepId && selectedStepId > 0 ? selectedStepId : undefined}
                          attachments={steps.find(s => s.id === selectedStepId)?.attachments}
                          onAttachmentsChange={(attachments) => {
                            // Update the current step's attachments in the steps array
                            const updatedSteps = steps.map(s => 
                              s.id === selectedStepId 
                                ? { ...s, attachments }
                                : s
                            );
                            setSteps(updatedSteps);
                            markAsUnsaved();
                          }}
                          onTempFilesChange={selectedStepId && selectedStepId < 0 ? (files) => handleTempFilesChange(selectedStepId, files) : undefined}
                        />
                      </div>
                    )}

                    {stepContentType === 'quiz' && (
                      <div className="space-y-3">
                        <QuizLessonEditor
                          quizTitle={stepQuizTitle}
                          setQuizTitle={handleStepQuizTitleChange}
                          quizQuestions={stepQuizQuestions}
                          setQuizQuestions={handleStepQuizQuestionsChange}
                          quizTimeLimit={stepQuizTimeLimit}
                          setQuizTimeLimit={(value) => {
                            setStepQuizTimeLimit(value);
                            markAsUnsaved();
                          }}
                          quizDisplayMode={stepQuizDisplayMode}
                          setQuizDisplayMode={(value) => {
                            setStepQuizDisplayMode(value);
                            markAsUnsaved();
                          }}
                          quizType={stepQuizType}
                          setQuizType={(value) => {
                            setStepQuizType(value);
                            markAsUnsaved();
                          }}
                          quizMediaUrl={stepQuizMediaUrl}
                          setQuizMediaUrl={(value) => {
                            setStepQuizMediaUrl(value);
                            markAsUnsaved();
                          }}
                          quizMediaType={stepQuizMediaType}
                          setQuizMediaType={(value) => {
                            setStepQuizMediaType(value);
                            markAsUnsaved();
                          }}
                          audioPlaybackMode={stepAudioPlaybackMode}
                          setAudioPlaybackMode={(value) => {
                            setStepAudioPlaybackMode(value);
                            markAsUnsaved();
                          }}
                          highlightedQuestionId={searchParams.get('questionId') || undefined}
                        />
                      </div>
                    )}

                    {stepContentType === 'flashcard' && (
                      <div className="space-y-3">
                        <FlashcardEditor
                          flashcardSet={stepFlashcardSet}
                          setFlashcardSet={handleStepFlashcardSetChange}
                        />
                      </div>
                    )}

                   
                   </div>
                 </div>
               )}
               </div>
          </div>
        </div>

      
        
        {/* Bottom Bar */}
        <Card className="border-0 rounded-none border-t">
          <CardContent className="p-4">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/teacher/course/${courseId}`)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Course
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Lesson'}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>Unsaved changes</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Step Modal */}
      {showAddStepModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Add New Step</h2>
              <p className="text-muted-foreground">Choose the content type for your new step</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  newStepType === 'text' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setNewStepType('text')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Text</h3>
                    <p className="text-sm text-muted-foreground">Rich text content with formatting</p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  newStepType === 'video_text' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setNewStepType('video_text')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Video className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Video + Text</h3>
                    <p className="text-sm text-muted-foreground">YouTube video with additional text</p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  newStepType === 'quiz' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setNewStepType('quiz')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <QuizIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Quiz</h3>
                    <p className="text-sm text-muted-foreground">Interactive quiz with questions</p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  newStepType === 'flashcard' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setNewStepType('flashcard')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Flashcards</h3>
                    <p className="text-sm text-muted-foreground">Interactive flashcards for vocabulary learning</p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  newStepType === 'summary' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setNewStepType('summary')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Summary</h3>
                    <p className="text-sm text-muted-foreground">Lesson quiz summary with statistics</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddStepModal(false);
                  setNewStepType('text');
                }}
              >
                Cancel
              </Button>
              <Button onClick={createStep} className="bg-blue-600 hover:bg-blue-700">
                Create Step
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Unsaved Changes Warning Dialog - for navigation */}
      <UnsavedChangesDialog
        open={isBlocked}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        title="Save This Step!"
        description="You have unsaved changes in this step. Please save before moving to the next step or lesson to avoid losing your work."
      />

      {/* Step Switch Warning Dialog - for switching between steps */}
      <UnsavedChangesDialog
        open={showStepSwitchDialog}
        onConfirm={() => {
          if (pendingStepToSwitch) {
            setHasUnsavedChanges(false);
            performStepSwitch(pendingStepToSwitch);
            setPendingStepToSwitch(null);
          }
          setShowStepSwitchDialog(false);
        }}
        onCancel={() => {
          setPendingStepToSwitch(null);
          setShowStepSwitchDialog(false);
        }}
        title="Save This Step!"
        description="You have unsaved changes in this step. Please save before switching to another step to avoid losing your work."
      />
    </div>
  );
}

