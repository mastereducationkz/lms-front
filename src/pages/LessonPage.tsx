import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { ChevronLeft, ChevronRight, Play, FileText, HelpCircle, ChevronDown, ChevronUp, Lock, Trophy, PanelLeftOpen, PanelLeftClose, SkipForward, Languages, Layers, Check, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import apiClient from '../services/api';
import type { Lesson, Step, Course, CourseModule, StepProgress, StepAttachment } from '../types';
import YouTubeVideoPlayer from '../components/YouTubeVideoPlayer';
import { renderTextWithLatex } from '../utils/latex';
import FlashcardViewer from '../components/lesson/FlashcardViewer';
import QuizRenderer from '../components/lesson/QuizRenderer';
import SummaryStepRenderer from '../components/lesson/SummaryStepRenderer';
import TextLookupPopover from '../components/lesson/TextLookupPopover';
import MaintenanceBanner from '../components/MaintenanceBanner';
import { toast } from '../components/Toast';
import { gradeQuestion, getAnswerKey } from '../components/lesson/quiz/scoring';

// Utility function to extract correct answers from gap text
// If an option ends with *, it's the correct answer (without the *)
// Otherwise, the first option is correct
const extractCorrectAnswersFromGaps = (text: string, separator: string = ','): string[] => {
  if (typeof text !== 'string') text = String(text || '');
  
  const gaps = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    gaps.push(match);
  }
  
  return gaps.map(match => {
    const rawOptions = match[1].split(separator).map(s => s.trim()).filter(Boolean);

    // Helper to strip HTML tags and entities - must match FillInBlankRenderer logic exactly
    const stripHTML = (str: string) => {
      let cleaned = str;

      // Replace HTML entities first
      cleaned = cleaned
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      // Remove ALL HTML tags (including broken/partial tags)
      cleaned = cleaned
        .replace(/<[^>]*>/g, '')     // Normal tags
        .replace(/<[^>]*$/g, '')     // Unclosed tags at end
        .replace(/^[^<]*>/g, '')     // Orphaned closing tags at start
        .replace(/>[^<]*</g, '><');  // Text between tags

      // Clean up any remaining angle brackets
      cleaned = cleaned.replace(/[<>]/g, '');

      return cleaned.trim();
    };

    // Find option with asterisk
    let correctIndex = 0;
    rawOptions.forEach((opt, idx) => {
      if (opt.includes('*')) {
        correctIndex = idx;
      }
    });

    // Clean options: remove asterisks first, then HTML tags
    const cleanedOptions = rawOptions.map(opt => stripHTML(opt.replace(/\*/g, '')));

    // Filter out empty options
    const options = cleanedOptions.filter(opt => opt && opt.trim());

    // Determine correct option using the same logic as renderer
    let correctOption = cleanedOptions[correctIndex];

    // If the correct option was filtered out (empty), or doesn't exist in options,
    // default to the first option
    if (!correctOption || !correctOption.trim() || !options.includes(correctOption)) {
      correctOption = options[0] || '';
    }

    return correctOption;
  });
};

// Helper functions to serialize/deserialize quiz answers with nested Maps
// Maps are not JSON serializable, so we need to convert them to arrays/objects
const serializeQuizAnswers = (answers: Map<string, any>): [string, any][] => {
  return Array.from(answers.entries()).map(([key, value]) => {
    // If value is a Map (for matching questions), convert to array of entries
    if (value instanceof Map) {
      return [key, { __type: 'Map', data: Array.from(value.entries()) }];
    }
    return [key, value];
  });
};

const deserializeQuizAnswers = (data: [string, any][]): Map<string, any> => {
  const map = new Map<string, any>();
  for (const [key, value] of data) {
    // If value was a serialized Map, reconstruct it
    if (value && typeof value === 'object' && value.__type === 'Map') {
      map.set(key, new Map(value.data));
    } else {
      map.set(key, value);
    }
  }
  return map;
};

// Compute a simple hash of quiz content to detect changes
// Uses Web Crypto API for SHA-256 hashing
const computeQuizContentHash = async (quizJson: string): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(quizJson);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (e) {
    // Fallback for environments without Web Crypto API
    console.warn('Web Crypto API not available, using simple hash');
    let hash = 0;
    for (let i = 0; i < quizJson.length; i++) {
      const char = quizJson.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
};

type StepVideoLanguage = 'ru' | 'en'

const videoLanguageMetaPattern = /<!--\s*video_lang_urls:\s*(\{[\s\S]*?\})\s*-->/i

const extractStepVideoUrls = (step: Step) => {
  const content = step.content_text || ''
  const match = content.match(videoLanguageMetaPattern)
  let metadataEnUrl = ''

  if (match) {
    try {
      const parsed = JSON.parse(match[1])
      if (parsed && typeof parsed.en === 'string') {
        metadataEnUrl = parsed.en.trim()
      }
    } catch (error) {
      console.error('Failed to parse video language metadata:', error)
    }
  }

  return {
    ru: (step.video_url_ru || step.video_url || '').trim(),
    en: (step.video_url_en || metadataEnUrl || '').trim()
  }
}

const stripVideoLanguageMeta = (content?: string) => {
  return (content || '').replace(videoLanguageMetaPattern, '').trim()
}

interface LessonSidebarProps {
  course: Course | null;
  modules: CourseModule[];
  selectedLessonId: string;
  onLessonSelect: (lessonId: string) => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const LessonSidebar = ({ course, modules, selectedLessonId, onLessonSelect, isCollapsed = false, onToggle }: LessonSidebarProps) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Update expanded modules when modules are loaded
  useEffect(() => {
    if (modules.length > 0) {
      setExpandedModules(new Set(modules.map(m => m.id.toString())));
    }
  }, [modules]);

  // Auto-expand module containing current lesson
  useEffect(() => {
    if (selectedLessonId && modules.length > 0) {
      // Find which module contains the current lesson
      for (const module of modules) {
        const hasCurrentLesson = module.lessons?.some(lesson => lesson.id.toString() === selectedLessonId);
        if (hasCurrentLesson) {
          setExpandedModules(prev => new Set([...prev, module.id.toString()]));
          break;
        }
      }
    }
  }, [selectedLessonId, modules]);

  // Scroll to active lesson
  useEffect(() => {
    if (selectedLessonId && modules.length > 0) {
      const activeLessonElement = document.getElementById(`lesson-sidebar-${selectedLessonId}`);
      if (activeLessonElement) {
        activeLessonElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedLessonId, modules, expandedModules]);

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
    <div className={`${isCollapsed ? 'w-0 border-none' : 'w-80 border-r'} bg-background border-border/70 h-screen flex flex-col transition-all duration-300 overflow-hidden`}>
      <div className={`p-4 border-b border-border/70 bg-background/90 flex-shrink-0 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <img src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + (course?.cover_image_url || '')} alt={course?.title} className="w-10 h-10 rounded-lg object-cover" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold truncate text-sm">{course?.title || 'Course'}</h2>
              <p className="text-xs text-muted-foreground truncate">Lesson navigation</p>
            </div>
          </div>
        )}
        {isCollapsed && (
           <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 mb-2">
              <img src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + (course?.cover_image_url || '')} alt={course?.title} className="w-10 h-10 rounded-lg object-cover" />
           </div>
        )}
        
        {onToggle && !isCollapsed && (
          <Button variant="ghost" size="icon" onClick={onToggle} title="Collapse Sidebar">
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Modules and Lessons - Scrollable */}
      {!isCollapsed && (
      <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar bg-background">
        <div className="p-2">
          <div className="space-y-1">
            {modules
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
              .map((module, _moduleIndex) => {
                const lectures = module.lessons || [];
                const isExpanded = expandedModules.has(module.id.toString());
                const completedInModule = lectures.filter(l => l.is_completed).length;

                return (
                  <div key={module.id} className="space-y-1">
                    {/* Module Header */}
                    <button
                      onClick={() => toggleModuleExpanded(module.id.toString())}
                      className={`w-full justify-between p-4 h-auto rounded-none border-b border-border/50 flex items-center text-left group ${lectures.some(lesson => lesson.id.toString() === selectedLessonId)
                        ? 'bg-primary/15 border-l-4 border-l-primary'
                        : 'hover:bg-muted/25'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium text-foreground">{module.title}</span>
                          <span className="text-xs text-muted-foreground">{completedInModule}/{lectures.length} lessons</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isExpanded ?
                          <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" /> :
                          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        }
                      </div>
                    </button>

                    {/* Lessons List */}
                    {isExpanded && (
                      <div className="bg-muted/15">
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
                          .map((lecture, _lectureIndex) => {
                            const isSelected = selectedLessonId === lecture.id.toString();
                            const isAccessible = (lecture as any).is_accessible !== false; // Default to accessible if not specified
                            
                            const getLessonIcon = () => {
                              return <Play className="w-4 h-4" />;
                            };

                            return (
                              <button
                                key={lecture.id}
                                id={`lesson-sidebar-${lecture.id}`}
                                onClick={() => isAccessible && onLessonSelect(lecture.id.toString())}
                                disabled={!isAccessible}
                                title={!isAccessible ? "Complete previous lessons to unlock" : ""}
                                className={`w-full justify-start pl-12 pr-4 py-3 h-auto rounded-none border-b border-border/30 flex items-center gap-3 text-left text-sm ${
                                  isSelected 
                                    ? 'bg-primary/15 border-l-4 border-l-primary' 
                                    : isAccessible 
                                      ? 'hover:bg-muted/35' 
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                              >
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted/50">
                                  {!isAccessible ? <Lock className="w-4 h-4 text-muted-foreground" /> : getLessonIcon()}
                                </div>
                                <div className="flex items-center justify-between w-full min-w-0">
                                  <span className="truncate text-foreground">{lecture.title}</span>
                                  {lecture.is_completed ? (
                                    <span className="ml-2 h-5 px-2 inline-flex items-center rounded bg-accent text-primary border border-primary/20 text-[10px]">✓</span>
                                  ) : null}
                                </div>
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
      )}
    </div>
  );
};

export default function LessonPage() {
  const { user } = useAuth();
  const { isLookUpEnabled, toggleLookUp } = useSettings(); // Added useSettings hook
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCourseLoading, setIsCourseLoading] = useState(true);
  const [isLessonLoading, setIsLessonLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepsProgress, setStepsProgress] = useState<StepProgress[]>([]);
  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Optimization: Track which steps have their content loaded
  const [loadedStepIds, setLoadedStepIds] = useState<Set<number>>(new Set());
  const [isStepContentLoading, setIsStepContentLoading] = useState(false);
  const [videoProgress, setVideoProgress] = useState<Map<string, number>>(new Map());
  const [videoStepTechErrors, setVideoStepTechErrors] = useState<Map<string, string>>(new Map());
  const [selectedVideoLanguageByStep, setSelectedVideoLanguageByStep] = useState<Map<string, StepVideoLanguage>>(new Map());
  const [quizCompleted, setQuizCompleted] = useState<Map<string, boolean>>(new Map());
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Map<string, any>>(new Map());
  const [gapAnswers, setGapAnswers] = useState<Map<string, string[]>>(new Map());
  const [quizState, setQuizState] = useState<'title' | 'question' | 'result' | 'completed' | 'feed'>('title');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizData, setQuizData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [feedChecked, setFeedChecked] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);
  const [isQuizReady, setIsQuizReady] = useState(false);
  const [quizAttempt, setQuizAttempt] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('lessonSidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Refs for race-safe operations
  const textContentRef = useRef<HTMLDivElement>(null);
  const activeStepIdRef = useRef<number | null>(null);
  const stepLoadAbortRef = useRef<AbortController | null>(null);
  const pendingDraftCreateRef = useRef<boolean>(false);
  const cachedHashRef = useRef<{ stepId: number; hash: string } | null>(null);
  const videoMarkedRef = useRef<Set<number>>(new Set());
  const isSpecialGroupStudent = user?.role === 'student' && user?.special_group_only_student === true;

  const devLog = useCallback((...args: unknown[]) => {
    if (import.meta.env.DEV) console.log(...args);
  }, []);

  const orderedSteps = useMemo(() => {
    return [...steps].sort((a, b) => {
      const orderA = a.order_index || 0;
      const orderB = b.order_index || 0;
      if (orderA === orderB) return Number(a.id) - Number(b.id);
      return orderA - orderB;
    });
  }, [steps]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('lessonSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Track the furthest step the student has reached
  useEffect(() => {
    if (currentStepIndex > furthestStepIndex) {
      setFurthestStepIndex(currentStepIndex);
    }
  }, [currentStepIndex, furthestStepIndex]);

  // Load Course Data (Sidebar structure) - Only when courseId changes
  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId]);

  // Load Lesson Data (Content) - When lessonId changes
  useEffect(() => {
    if (lessonId) {
      loadLessonData();
    }
  }, [lessonId]);

  // Calculate next lesson when lesson or modules change
  useEffect(() => {
    if (lesson && modules.length > 0) {
      try {
        const explicitNext = (lesson as any).next_lesson_id;
        if (explicitNext) {
          setNextLessonId(String(explicitNext));
        } else {
          // Flatten lessons from modules to find next lesson
          const allLessons = modules
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
            .flatMap(m => (m.lessons || []).sort((a, b) => {
              const orderA = a.order_index || 0;
              const orderB = b.order_index || 0;
              if (orderA === orderB) return parseInt(a.id) - parseInt(b.id);
              return orderA - orderB;
            }));

          const currentIndex = allLessons.findIndex((l: any) => String(l.id) === String(lesson.id));
          const next = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
          setNextLessonId(next ? String(next.id) : null);
        }
      } catch (e) {
        setNextLessonId(null);
      }
    }
  }, [lesson, modules]);

  // Sync URL step/stepId parameters with currentStepIndex (uses orderedSteps so URL/stepper agree)
  useEffect(() => {
    if (orderedSteps.length === 0) return;

    const stepParam = searchParams.get('step');
    const stepIdParam = searchParams.get('stepId');

    let targetIndex = 0;

    if (stepIdParam) {
      const stepId = parseInt(stepIdParam, 10);
      const foundIndex = orderedSteps.findIndex(s => s.id === stepId);
      if (foundIndex !== -1) targetIndex = foundIndex;
    } else if (stepParam) {
      const stepNumber = parseInt(stepParam, 10);
      targetIndex = Math.max(1, Math.min(stepNumber, orderedSteps.length)) - 1;
    }

    if (targetIndex !== currentStepIndex) {
      setCurrentStepIndex(targetIndex);
    }
  }, [searchParams, orderedSteps, currentStepIndex]);

  const loadCourseData = async (showLoader = true) => {
    try {
      if (showLoader) {
        setIsCourseLoading(true);
      }
      
      const promises: Promise<any>[] = [apiClient.getCourseModules(courseId!, true)];
      
      // Only fetch course info if we don't have it yet
      if (!course) {
        promises.push(apiClient.getCourse(courseId!));
      }
      
      const results = await Promise.all(promises);
      const modulesData = results[0];
      
      // If we fetched course data, update it
      if (results[1]) {
        setCourse(results[1]);
      }
      
      setModules(modulesData);
    } catch (error) {
      console.error('Failed to load course data:', error);
      setError('Failed to load course data');
    } finally {
      if (showLoader) {
        setIsCourseLoading(false);
      }
    }
  };

  const loadLessonData = async () => {
    try {
      setIsLessonLoading(true);

      // Optimization: Check access using locally available modules data first
      // This saves a network request if we already know the status
      let isLocallyVerified = false;
      if (modules.length > 0) {
        const foundLesson = modules.flatMap(m => m.lessons || []).find(l => l.id.toString() === lessonId);
        if (foundLesson && (foundLesson as any).is_accessible) {
          isLocallyVerified = true;
        }
      }

      // Prepare promises for parallel execution
      const promises: Promise<any>[] = [
        apiClient.getLesson(lessonId!),
        apiClient.getLessonSteps(lessonId!, false), // Fetch lightweight steps initially
        apiClient.getLessonStepsProgress(lessonId!)
      ];

      // Only add access check if not locally verified
      if (!isLocallyVerified) {
        promises.push(apiClient.checkLessonAccess(lessonId!));
      }

      const results = await Promise.all(promises);
      
      const lessonData = results[0];
      const stepsData = results[1];
      const progressData = results[2];
      const accessCheck = isLocallyVerified ? { accessible: true } : results[3];

      // Handle access check result
      if (!accessCheck.accessible) {
        const reason = accessCheck.reason || 'Please complete previous lessons first.';
        setError(reason);
        toast(reason, 'error');
        navigate(`/course/${courseId}`);
        return;
      }

      setLesson(lessonData);
      setSteps(stepsData);
      setStepsProgress(progressData || []);
      
      // Reset loaded steps when lesson changes
      setLoadedStepIds(new Set());
      
      // Initialize furthestStepIndex based on existing progress
      // Find the highest step index that has been visited/started
      if (stepsData && stepsData.length > 0 && progressData) {
        const sortedSteps = [...stepsData].sort((a: any, b: any) => a.order_index - b.order_index);
        let maxReachedIndex = 0;
        sortedSteps.forEach((step: any, index: number) => {
          const stepProgress = progressData.find((p: any) => p.step_id === step.id);
          if (stepProgress && (stepProgress.status === 'completed' || stepProgress.status === 'in_progress')) {
            maxReachedIndex = index;
          }
        });
        setFurthestStepIndex(maxReachedIndex);
      } else {
        setFurthestStepIndex(0);
      }

    } catch (error) {
      console.error('Failed to load lesson data:', error);
      setError('Failed to load lesson data');
    } finally {
      setIsLessonLoading(false);
    }
  };

  const markStepAsStarted = useCallback(async (stepId: string) => {
    try {
      await apiClient.markStepStarted(stepId);

      // Update local progress state
      setStepsProgress(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(p => p.step_id === parseInt(stepId));

        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: 'in_progress',
            started_at: new Date().toISOString(),
            visited_at: new Date().toISOString()
          };
        } else {
          // Create new progress entry
          updated.push({
            id: Date.now(), // temporary ID
            user_id: 0, // will be set by backend
            course_id: 0, // will be set by backend
            lesson_id: 0, // will be set by backend
            step_id: parseInt(stepId),
            status: 'in_progress',
            started_at: new Date().toISOString(),
            visited_at: new Date().toISOString(),
            completed_at: undefined,
            time_spent_minutes: 0
          });
        }

        return updated;
      });
    } catch (error) {
      console.error('Failed to mark step as started:', error);
    }
  }, []);

  const markStepAsVisited = useCallback(async (stepId: string, timeSpent: number = 1) => {
    // Check if already completed locally to avoid redundant requests
    const existingProgress = stepsProgress.find(p => p.step_id === parseInt(stepId));
    if (existingProgress?.status === 'completed') {
      return;
    }

    try {
      await apiClient.markStepVisited(stepId, timeSpent);

      // Update local progress state
      setStepsProgress(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(p => p.step_id === parseInt(stepId));

        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            status: 'completed',
            visited_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            time_spent_minutes: updated[existingIndex].time_spent_minutes + timeSpent
          };
        } else {
          // Create new progress record
          updated.push({
            id: Date.now(), // Temporary ID
            user_id: 0, // Will be set by backend
            course_id: parseInt(courseId!),
            lesson_id: parseInt(lessonId!),
            step_id: parseInt(stepId),
            status: 'completed',
            visited_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            time_spent_minutes: 1
          });
        }

        return updated;
      });

      const allStepsCompleted = steps.every(step => {
        if (step.id.toString() === stepId) return true;
        const stepProgress = stepsProgress.find(p => p.step_id === step.id);
        return stepProgress?.status === 'completed';
      });

      if (allStepsCompleted) {
        loadCourseData(false);
      }
    } catch (error) {
      console.error('Failed to mark step as visited:', error);
    }
  }, [stepsProgress, steps, courseId, lessonId]);

  const currentStep = orderedSteps[currentStepIndex];

  // Check if step is completed based on content type
  const isStepCompleted = useCallback((step: Step): boolean => {
    const stepProgress = stepsProgress.find(p => p.step_id === step.id);
    return stepProgress?.status === 'completed';
  }, [stepsProgress]);

  // Load step content on demand (per-step AbortController; ignore stale responses)
  useEffect(() => {
    if (!currentStep) return;
    if (loadedStepIds.has(currentStep.id)) return;

    const stepId = currentStep.id;
    activeStepIdRef.current = stepId;

    if (stepLoadAbortRef.current) {
      stepLoadAbortRef.current.abort();
    }
    const abort = new AbortController();
    stepLoadAbortRef.current = abort;

    setIsStepContentLoading(true);

    (async () => {
      try {
        devLog(`Loading content for step ${stepId}...`);
        const fullStep = await apiClient.getStep(stepId.toString());
        if (abort.signal.aborted) return;
        if (activeStepIdRef.current !== stepId) return;

        setSteps(prevSteps => prevSteps.map(s => s.id === fullStep.id ? fullStep : s));
        setLoadedStepIds(prev => new Set(prev).add(fullStep.id));
      } catch (err) {
        if ((err as any)?.name === 'CanceledError' || (err as any)?.name === 'AbortError') return;
        if (abort.signal.aborted) return;
        console.error('Failed to load step content:', err);
      } finally {
        if (activeStepIdRef.current === stepId) {
          setIsStepContentLoading(false);
        }
      }
    })();

    return () => {
      abort.abort();
    };
  }, [currentStep?.id, loadedStepIds, devLog]);

  // Mark current step as started when it changes
  useEffect(() => {
    if (currentStep && stepsProgress.length > 0) {
      const stepProgress = stepsProgress.find(p => p.step_id === currentStep.id);
      if (!stepProgress || stepProgress.status === 'not_started') {
        markStepAsStarted(currentStep.id.toString());
      }
    }
  }, [currentStepIndex, currentStep, stepsProgress]);

  // Initialize quiz when quiz step is loaded
  useEffect(() => {
    let isMounted = true;

    if (currentStep?.content_type === 'quiz') {
      setIsQuizReady(false); // Start loading
      setQuizState('title'); // Reset state immediately so old step's state doesn't bleed in
      setQuizAnswers(new Map());
      setGapAnswers(new Map());
      setFeedChecked(false);
      setCurrentQuestionIndex(0);
      setQuizAttempt(null);
      pendingDraftCreateRef.current = false;
      cachedHashRef.current = null;
      const loadQuizData = async () => {
        try {
          const parsedQuizData = JSON.parse(currentStep.content_text || '{}');

          if (!isMounted) return;

          setQuizData(parsedQuizData);
          const originalQuestions = parsedQuizData.questions || [];
          setQuestions(originalQuestions);

          // Initialize gap answers map per question
          const init = new Map<string, string[]>();
          originalQuestions.forEach((q: any) => {
            if (q.question_type === 'fill_blank' || q.question_type === 'text_completion') {
              const text = (q.content_text || q.question_text || '').toString();
              // const gaps = Array.from(text.matchAll(/\[\[(.*?)\]\]/g));
              // Use exec for better compatibility
              const gaps = [];
              const regex = /\[\[(.*?)\]\]/g;
              let match;
              while ((match = regex.exec(text)) !== null) {
                gaps.push(match);
              }
              const answers: string[] = Array.isArray(q.correct_answer) ? q.correct_answer : (q.correct_answer ? [q.correct_answer] : []);
              init.set(q.id.toString(), new Array(Math.max(gaps.length, answers.length)).fill(''));
            }
          });

          // Compute current quiz content hash for version comparison
          const currentContentHash = await computeQuizContentHash(currentStep.content_text || '{}');
          cachedHashRef.current = { stepId: currentStep.id, hash: currentContentHash };

          // SERVER-FIRST APPROACH: Check server for existing attempts first
          // localStorage is only used as fallback if server has no data
          let serverAttemptRestored = false;

          try {
            const attempts = await apiClient.getStepQuizAttempts(currentStep.id);

            if (!isMounted) return;

            if (attempts && attempts.length > 0) {
              const lastAttempt = attempts[0]; // Get the most recent attempt
              devLog('Found server quiz attempt:', lastAttempt);

              // Check if quiz content has changed since this attempt
              const attemptHash = lastAttempt.quiz_content_hash;
              if (attemptHash && attemptHash !== currentContentHash) {
                devLog('Quiz content changed since last attempt — invalidating old answers');
                localStorage.removeItem(`quiz_answers_${currentStep.id}`);
                localStorage.removeItem(`gap_answers_${currentStep.id}`);
                toast('This quiz was updated. Your previous answers were cleared.', 'info');
                // Continue with fresh state
              } else {
                // Quiz unchanged or no hash (legacy attempt), restore answers
                setQuizAttempt(lastAttempt);
                serverAttemptRestored = true;

                // Restore answers
                if (lastAttempt.answers) {
                  try {
                    const savedAnswers = JSON.parse(lastAttempt.answers);
                    devLog('Parsed saved answers:', savedAnswers);

                    let answersMap: Map<string, any>;
                    if (Array.isArray(savedAnswers)) {
                      answersMap = deserializeQuizAnswers(savedAnswers);
                    } else {
                      answersMap = new Map(Object.entries(savedAnswers)) as Map<string, any>;
                    }

                    // Normalize all keys to strings to keep map lookups consistent
                    const normalizedAnswers = new Map<string, any>();
                    for (const [key, value] of answersMap.entries()) {
                      normalizedAnswers.set(String(key), value);
                    }
                    setQuizAnswers(normalizedAnswers);

                    // Restore gap answers
                    const newGapAnswers = new Map(init);

                    originalQuestions.forEach((q: any) => {
                      const key = getAnswerKey(q);
                      if ((q.question_type === 'fill_blank' || q.question_type === 'text_completion') && normalizedAnswers.has(key)) {
                        const savedGapAns = normalizedAnswers.get(key);
                        devLog(`Restoring gap answer for Q ${q.id}:`, savedGapAns);
                        if (Array.isArray(savedGapAns)) {
                          newGapAnswers.set(key, savedGapAns);
                        }
                      }
                    });

                    setGapAnswers(newGapAnswers);

                  } catch (e) {
                    console.error('Failed to parse saved answers:', e);
                  }
                }

                // Check if this is a draft (in-progress) or completed attempt
                if (lastAttempt.is_draft) {
                  // Draft - restore to in-progress state
                  console.log('Restoring draft quiz attempt');
                  const displayMode = parsedQuizData.display_mode || 'one_by_one';
                  if (displayMode === 'all_at_once') {
                    setQuizState('feed');
                  } else {
                    // Restore to the question they were on
                    setCurrentQuestionIndex(lastAttempt.current_question_index || 0);
                    setQuizState('question');
                  }
                  setQuizStartTime(Date.now() - (lastAttempt.time_spent_seconds || 0) * 1000);
                } else {
                  // Completed attempt - show completed state
                  setQuizState('completed');
                  const passed = lastAttempt.score_percentage >= 50;
                  setQuizCompleted(prev => new Map(prev.set(currentStep.id.toString(), passed)));
                }
                
                // Clear localStorage since server is source of truth
                localStorage.removeItem(`quiz_answers_${currentStep.id}`);
                localStorage.removeItem(`gap_answers_${currentStep.id}`);
                
                setIsQuizReady(true);
                return; // Skip default initialization
              }
            }
          } catch (err) {
            console.error('Failed to load quiz attempts from server:', err);
          }

          // FALLBACK: Check localStorage if server had no data
          if (!serverAttemptRestored) {
            try {
              const localQuizAnswers = localStorage.getItem(`quiz_answers_${currentStep.id}`);
              const localGapAnswers = localStorage.getItem(`gap_answers_${currentStep.id}`);

              if (localQuizAnswers || localGapAnswers) {
                devLog('Restoring from localStorage (server had no data)');

                if (localQuizAnswers) {
                  const parsed = deserializeQuizAnswers(JSON.parse(localQuizAnswers));
                  const normalized = new Map<string, any>();
                  for (const [k, v] of parsed.entries()) normalized.set(String(k), v);
                  setQuizAnswers(normalized);
                }
                if (localGapAnswers) {
                  const entries: [string, string[]][] = JSON.parse(localGapAnswers);
                  setGapAnswers(new Map(entries.map(([k, v]) => [String(k), v])));
                }

                const displayMode = parsedQuizData.display_mode || 'one_by_one';
                if (displayMode === 'all_at_once') {
                  setQuizState('feed');
                } else {
                  setQuizState('title');
                }

                setIsQuizReady(true);
                return;
              } else {
                setGapAnswers(init);
                setQuizAnswers(new Map());
              }
            } catch (e) {
              console.error('Failed to restore from localStorage:', e);
              setGapAnswers(init);
              setQuizAnswers(new Map());
            }
          }


          if (!isMounted) return;

          // If we reached here, it means we either loaded from localStorage (and set state there)
          // or we didn't find anything in localStorage AND didn't find anything in backend
          // In the latter case, we need to set initial state
             setCurrentQuestionIndex(0);
             setFeedChecked(false);
             
             // If we have a questionId in the URL, automatically start the quiz and jump to it
             const questionIdParam = searchParams.get('questionId');
             if (questionIdParam && originalQuestions.length > 0) {
               const questionIndex = originalQuestions.findIndex((q: any) => q.id.toString() === questionIdParam);
               if (questionIndex >= 0) {
                 const displayMode = parsedQuizData.display_mode || 'one_by_one';
                 if (displayMode === 'all_at_once') {
                   setQuizState('feed');
                 } else {
                   setCurrentQuestionIndex(questionIndex);
                   setQuizState('question');
                 }
                 setQuizStartTime(Date.now());
               } else {
                 // Default title screen if question not found
                 setQuizState('title');
               }
             } else {
               const displayMode = parsedQuizData.display_mode || 'one_by_one';
               if (displayMode === 'all_at_once') {
                 setQuizState('feed');
               } else {
                 setQuizState('title');
               }
             }
             
             setIsQuizReady(true);

        } catch (error) {
          console.error('Failed to parse quiz data:', error);
          setIsQuizReady(true); // Ready even on error to show something (or handle error UI)
        }
      };

      loadQuizData();
    }

    return () => {
      isMounted = false;
    };
  }, [currentStep, searchParams, devLog]);

  // Persist quiz progress to localStorage
  useEffect(() => {
    if (currentStep?.content_type === 'quiz' && (quizAnswers.size > 0 || gapAnswers.size > 0)) {
      localStorage.setItem(`quiz_answers_${currentStep.id}`, JSON.stringify(serializeQuizAnswers(quizAnswers)));
      localStorage.setItem(`gap_answers_${currentStep.id}`, JSON.stringify(Array.from(gapAnswers.entries())));
    }
  }, [quizAnswers, gapAnswers, currentStep, currentQuestionIndex]);

  // Auto-save quiz progress to server (debounced, race-safe)
  useEffect(() => {
    if (!currentStep?.content_type || currentStep.content_type !== 'quiz') return;
    if (!courseId || !lessonId) return;
    if (quizState === 'completed' || quizState === 'title') return;
    if (quizAnswers.size === 0 && gapAnswers.size === 0) return;

    const saveToServer = async () => {
      try {
        const combinedAnswers = new Map([...quizAnswers, ...gapAnswers]);
        const answersToSave = serializeQuizAnswers(combinedAnswers);
        const timeSpentSeconds = quizStartTime
          ? Math.floor((Date.now() - quizStartTime) / 1000)
          : undefined;

        const { total } = getScore();

        if (quizAttempt?.id && quizAttempt.is_draft) {
          setSaveStatus('saving');
          await apiClient.updateQuizAttempt(quizAttempt.id, {
            answers: JSON.stringify(answersToSave),
            current_question_index: currentQuestionIndex,
            time_spent_seconds: timeSpentSeconds
          });
          setSaveStatus('saved');
          devLog('Quiz draft updated on server');
        } else if (!quizAttempt && !pendingDraftCreateRef.current) {
          pendingDraftCreateRef.current = true;
          setSaveStatus('saving');
          try {
            // Use cached hash if available to avoid recomputing per save
            let contentHash = cachedHashRef.current?.stepId === currentStep.id
              ? cachedHashRef.current.hash
              : undefined;
            if (!contentHash) {
              contentHash = await computeQuizContentHash(currentStep.content_text || '{}');
              cachedHashRef.current = { stepId: currentStep.id, hash: contentHash };
            }
            const draftData = {
              step_id: parseInt(currentStep.id.toString()),
              course_id: parseInt(courseId),
              lesson_id: parseInt(lessonId),
              quiz_title: quizData?.title || 'Quiz',
              total_questions: total,
              correct_answers: 0,
              score_percentage: 0,
              answers: JSON.stringify(answersToSave),
              time_spent_seconds: timeSpentSeconds,
              is_draft: true,
              current_question_index: currentQuestionIndex,
              quiz_content_hash: contentHash
            };
            const savedAttempt = await apiClient.saveQuizAttempt(draftData);
            setQuizAttempt(savedAttempt);
            setSaveStatus('saved');
            devLog('Quiz draft saved to server');
          } finally {
            pendingDraftCreateRef.current = false;
          }
        }
      } catch (error) {
        console.error('Failed to auto-save quiz progress:', error);
        setSaveStatus('error');
      }
    };

    setSaveStatus(prev => (prev === 'saving' ? prev : 'idle'));
    const timer = setTimeout(saveToServer, 3000);
    return () => clearTimeout(timer);
  }, [quizAnswers, gapAnswers, currentQuestionIndex, currentStep, courseId, lessonId, quizState, quizData, questions.length, quizStartTime, quizAttempt, devLog]);

  // Compute proceed reason (or null when allowed)
  const getProceedBlockReason = useCallback((): string | null => {
    if (user?.role === 'teacher' || user?.role === 'admin') return null;
    if (!currentStep) return 'No active step';
    if (currentStep.is_optional) return null;

    const stepId = currentStep.id.toString();
    const stepProgress = stepsProgress.find(p => p.step_id === currentStep.id);
    if (stepProgress?.status === 'completed') return null;

    if (currentStep.content_type === 'video_text') {
      const progress = videoProgress.get(stepId) || 0;
      if (progress >= 0.9) return null;
      const pct = Math.round(progress * 100);
      return `Watch the video to at least 90% to continue (${pct}% watched)`;
    }
    if (currentStep.content_type === 'quiz') {
      return quizCompleted.get(stepId) ? null : 'Complete the quiz to continue';
    }
    return null;
  }, [user?.role, currentStep, stepsProgress, videoProgress, quizCompleted]);

  const canProceedToNext = useCallback((): boolean => getProceedBlockReason() === null, [getProceedBlockReason]);

  const goToStep = useCallback((index: number) => {
    if (index > currentStepIndex && currentStep && !canProceedToNext()) {
      const reason = getProceedBlockReason() || 'Please complete the current step first';
      toast(reason, 'info');
      return;
    }

    if (currentStep && canProceedToNext()) {
      markStepAsVisited(currentStep.id.toString(), 2);
    }
    setCurrentStepIndex(index);

    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('step', (index + 1).toString());
    setSearchParams(newSearchParams);
  }, [currentStepIndex, currentStep, canProceedToNext, getProceedBlockReason, markStepAsVisited, searchParams, setSearchParams]);

  const goToNextStep = useCallback(async () => {
    if (currentStep && !canProceedToNext()) {
      const reason = getProceedBlockReason() || 'Please complete the current step first';
      toast(reason, 'info');
      return;
    }

    if (currentStepIndex < orderedSteps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else if (nextLessonId) {
      if (currentStep && !currentStep.is_optional && !isStepCompleted(currentStep)) {
        await markStepAsVisited(currentStep.id.toString(), 2);
      }
      setCurrentStepIndex(0);
      navigate(`/course/${courseId}/lesson/${nextLessonId}`);
    }
  }, [currentStep, canProceedToNext, getProceedBlockReason, currentStepIndex, orderedSteps.length, nextLessonId, goToStep, isStepCompleted, markStepAsVisited, navigate, courseId]);

  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  const skipLesson = async () => {
    if (!lesson) return;
    if (!confirm('Are you sure you want to skip this lesson? It will be marked as completed.')) return;

    try {
      await apiClient.markLessonComplete(lesson.id.toString(), 0);
      loadLessonData();
      loadCourseData(false);
      toast('Lesson skipped', 'success');
    } catch (err) {
      console.error('Failed to skip lesson:', err);
      toast('Failed to skip lesson', 'error');
    }
  };

  const autoCompleteAllSteps = async () => {
    if (!lesson || !orderedSteps.length) return;

    const confirmMsg = `DEV MODE: Auto-complete all ${orderedSteps.length} steps?\n\nThis is for development/testing only.`;
    if (!confirm(confirmMsg)) return;

    try {
      for (const step of orderedSteps) {
        const stepId = step.id.toString();
        await markStepAsVisited(stepId, 0);
        if (step.content_type === 'quiz') {
          setQuizCompleted(prev => new Map(prev).set(stepId, true));
        }
        if (step.content_type === 'video_text') {
          setVideoProgress(prev => new Map(prev).set(stepId, 1.0));
        }
      }

      await apiClient.markLessonComplete(lesson.id.toString(), 0);
      await loadLessonData();
      await loadCourseData(false);

      toast('All steps completed! Lesson marked as done.', 'success');
    } catch (err) {
      console.error('Failed to auto-complete steps:', err);
      toast('Failed to auto-complete steps', 'error');
    }
  };

  const handleSkipVideoStepDueToError = useCallback(async () => {
    if (!currentStep || currentStep.content_type !== 'video_text') return;

    const confirmed = confirm('Video has a technical issue. Skip this video step and mark it as completed?')
    if (!confirmed) return;

    const stepId = currentStep.id.toString()
    videoMarkedRef.current.add(currentStep.id)
    setVideoProgress(prev => new Map(prev).set(stepId, 1))
    await markStepAsVisited(stepId, 0)
    toast('Video step skipped due to technical issue', 'success')
  }, [currentStep, markStepAsVisited])

  const getStepIcon = (step: Step) => {
    switch (step.content_type) {
      case 'video_text':
        return <Play className="w-4 h-4" />;
      case 'quiz':
        return <HelpCircle className="w-4 h-4" />;
      case 'flashcard':
        return <Layers className="w-4 h-4" />;
      case 'summary':
        return <Trophy className="w-4 h-4" />;
      case 'text':
      default:
        return <FileText className="w-4 h-4" />;
    }
  };


  // Quiz functions
  const startQuiz = () => {
    // Determine the next state based on display mode
    const displayMode = quizData?.display_mode || 'one_by_one';
    if (displayMode === 'all_at_once') {
      setQuizState('feed');
    } else {
      setQuizState('question');
    }
    setQuizStartTime(Date.now());
  };



  const handleQuizAnswer = useCallback((questionId: string, answer: any) => {
    setQuizAnswers(prev => new Map(prev.set(String(questionId), answer)));
  }, []);

  const checkAnswer = () => {
    // For long_text questions, skip result screen and go directly to next question
    const question = questions[currentQuestionIndex];
    if (question?.question_type === 'long_text') {
      nextQuestion();
      return;
    }
    // For other question types, show result first
    setQuizState('result');
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setQuizState('question');
      
      // Explicitly autosave progress when moving to next question
      // This ensures current_question_index is updated on server even if no answer changed
      if (quizAttempt?.id && quizAttempt.is_draft) {
          apiClient.updateQuizAttempt(quizAttempt.id, {
            current_question_index: nextIndex
          }).catch(err => console.error('Failed to autosave question index:', err));
      }
    } else {
      // Save quiz attempt before completing
      const { score, total } = getScore();
      const scorePercentage = total > 0 ? (score / total) * 100 : 100;
      saveQuizAttempt(score, total);

      // Always show completed state first, regardless of pass/fail or step position
      setQuizState('completed');

      // Mark quiz completion status
      if (currentStep) {
        const passed = scorePercentage >= 50;
        setQuizCompleted(prev => new Map(prev.set(currentStep.id.toString(), passed)));
        if (passed) {
          markStepAsVisited(currentStep.id.toString(), 3); // 3 minutes for quiz completion
          // localStorage is cleared in saveQuizAttempt after successful server save
        }
      }
    }
  };

  const finishQuiz = () => {
    const { score, total } = getScore();
    const scorePercentage = total > 0 ? (score / total) * 100 : 100;
    saveQuizAttempt(score, total);
    setQuizState('completed');

    if (currentStep) {
      const passed = scorePercentage >= 50;
      setQuizCompleted(prev => new Map(prev.set(currentStep.id.toString(), passed)));
      if (passed) {
        markStepAsVisited(currentStep.id.toString(), 3);
        // localStorage is cleared in saveQuizAttempt after successful server save
      }
    }
  };

  const reviewQuiz = () => {
    setQuizState('feed');
    setFeedChecked(true);
  };

  const resetQuiz = () => {
    // Clear quiz attempt state (new attempt will be saved when quiz is completed)
    setQuizAttempt(null);
    
    // For "all at once", return to feed; for "one by one", return to title screen
    const displayMode = quizData?.display_mode || 'one_by_one';
    if (displayMode === 'all_at_once') {
      setQuizState('feed');
    } else {
      setQuizState('title');
    }
    
    // We keep the previous answers so the user can edit them instead of starting from scratch
    // setQuizAnswers(new Map());
    // setGapAnswers(init);
    
    setCurrentQuestionIndex(0);
    setFeedChecked(false);
    setQuizStartTime(Date.now());
    
    // Reset quiz completion status for this step
    if (currentStep) {
      setQuizCompleted(prev => {
        const newMap = new Map(prev);
        newMap.delete(currentStep.id.toString());
        return newMap;
      });
    }

    // Don't clear localStorage so answers persist
  };
  const autoFillCorrectAnswers = () => {
    const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'curator';
    if (import.meta.env.DEV || isTeacher) {
      const newQuizAnswers = new Map<string, any>();
      const newGapAnswers = new Map<string, string[]>();

      questions.forEach((question: any) => {
        const key = getAnswerKey(question);
        if (question.question_type === 'fill_blank' || question.question_type === 'text_completion') {
          const text = question.content_text || question.question_text || '';
          const separator = question.gap_separator || ',';
          const correctAnswers = extractCorrectAnswersFromGaps(text, separator);
          newGapAnswers.set(key, correctAnswers);
        } else if (question.question_type === 'long_text') {
          newQuizAnswers.set(key, 'Sample answer for development testing');
        } else if (question.question_type === 'matching') {
          const pairs = question.matching_pairs || [];
          const map = new Map<number, number>();
          pairs.forEach((_p: unknown, idx: number) => map.set(idx, idx));
          newQuizAnswers.set(key, map);
        } else {
          newQuizAnswers.set(key, question.correct_answer);
        }
      });

      setQuizAnswers(newQuizAnswers);
      setGapAnswers(newGapAnswers);
      devLog('Auto-filled correct answers for development');
    }
  };

  const getCurrentQuestion = useCallback(() => {
    return questions[currentQuestionIndex];
  }, [questions, currentQuestionIndex]);

  const getCurrentUserAnswer = useCallback(() => {
    const question = getCurrentQuestion();
    return question ? quizAnswers.get(getAnswerKey(question)) : undefined;
  }, [getCurrentQuestion, quizAnswers]);


  const getScore = () => {
    const stats = getGapStatistics();
    return {
      score: stats.correctGaps + stats.correctRegular,
      total: stats.totalGaps + stats.regularQuestions
    };
  };

  const saveQuizAttempt = async (score: number, totalQuestions: number) => {
    if (!currentStep || !courseId || !lessonId) return;

    // Check if quiz needs manual grading
    const hasLongText = questions.some(q => q.question_type === 'long_text');

    try {
      const timeSpentSeconds = quizStartTime
        ? Math.floor((Date.now() - quizStartTime) / 1000)
        : undefined;

      const combinedAnswers = new Map([...quizAnswers, ...gapAnswers]);
      const answersToSave = serializeQuizAnswers(combinedAnswers);
      devLog('Saving quiz attempt:', { score, totalQuestions, answersCount: answersToSave.length, hasLongText });

      // If quiz has long_text questions, it needs teacher grading
      // Otherwise, it's auto-graded
      const isGraded = isSpecialGroupStudent ? true : !hasLongText;

      // If we have an existing draft, finalize it instead of creating new
      if (quizAttempt?.id && quizAttempt.is_draft) {
        const savedAttempt = await apiClient.updateQuizAttempt(quizAttempt.id, {
          answers: JSON.stringify(answersToSave),
          time_spent_seconds: timeSpentSeconds,
          is_draft: false,  // Finalize the draft
          total_questions: totalQuestions,  // Update total_questions to include gaps
          correct_answers: score,
          score_percentage: totalQuestions > 0 ? (score / totalQuestions) * 100 : 100,
          is_graded: isGraded
        });
        setQuizAttempt(savedAttempt);
        devLog('Quiz draft finalized successfully');
      } else {
        // Create new completed attempt with content hash for version tracking
        const contentHash = await computeQuizContentHash(currentStep.content_text || '{}');
        const attemptData = {
          step_id: parseInt(currentStep.id.toString()),
          course_id: parseInt(courseId),
          lesson_id: parseInt(lessonId),
          quiz_title: quizData?.title || 'Quiz',
          total_questions: totalQuestions,
          correct_answers: score,
          score_percentage: totalQuestions > 0 ? (score / totalQuestions) * 100 : 100,
          answers: JSON.stringify(answersToSave),
          time_spent_seconds: timeSpentSeconds,
          is_graded: isGraded,
          is_draft: false,
          quiz_content_hash: contentHash
        };

        const savedAttempt = await apiClient.saveQuizAttempt(attemptData);
        setQuizAttempt(savedAttempt);
        devLog('Quiz attempt saved successfully');
      }

      localStorage.removeItem(`quiz_answers_${currentStep.id}`);
      localStorage.removeItem(`gap_answers_${currentStep.id}`);
    } catch (error) {
      console.error('Failed to save quiz attempt:', error);
      toast('Failed to save quiz attempt. Please try again.', 'error');
    }
  };

  // Detailed gap statistics for display.
  // Uses the shared `gradeQuestion` helper so QuizRenderer review badges and
  // these stats stay aligned. Long-text for special-group students is excluded
  // from regular question count because their long_text answers must be teacher-graded.
  const getGapStatistics = () => {
    let totalGaps = 0;
    let correctGaps = 0;
    let regularQuestions = 0;
    let correctRegular = 0;

    questions.forEach(question => {
      if (question.question_type === 'image_content') return;
      const key = getAnswerKey(question);

      if (question.question_type === 'fill_blank' || question.question_type === 'text_completion') {
        const provided = gapAnswers.get(key) || [];
        const result = gradeQuestion(question, undefined, provided);
        totalGaps += result.totalParts;
        correctGaps += result.correctParts;
        return;
      }

      if (question.question_type === 'long_text' && isSpecialGroupStudent) {
        // Excluded — these are graded by the teacher; counting them locally would
        // distort the displayed denominator before grading completes.
        return;
      }

      regularQuestions++;
      const answer = quizAnswers.get(key);
      const result = gradeQuestion(question, answer, undefined, { isSpecialGroupStudent });
      if (result.isCorrect) correctRegular++;
    });

    return { totalGaps, correctGaps, regularQuestions, correctRegular };
  };

  const renderAttachments = (attachmentsJson?: string) => {
    if (!attachmentsJson) return null;

    try {
      const attachments: StepAttachment[] = JSON.parse(attachmentsJson);
      if (!attachments || attachments.length === 0) return null;

      return (
        <div className="mt-6 p-4 rounded-lg border dark:border-gray-700">
          <div className="space-y-4">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="rounded">
                {/* PDF Preview */}
                {attachment.file_type.toLowerCase() === 'pdf' && (
                  <iframe
                    src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${attachment.file_url}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-96 sm:h-[500px] lg:h-[600px] border-0"
                    title={`Preview of ${attachment.filename}`}
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )}

                {/* Image Preview */}
                {['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(attachment.file_type.toLowerCase()) && (
                  <div className="mt-3">
                    <img
                      src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${attachment.file_url}`}
                      alt={attachment.filename}
                      className="w-full h-auto rounded"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    } catch (e) {
      console.error('Failed to parse attachments:', e);
      return null;
    }
  };

  const handleSummaryLoad = useCallback(() => {
    if (currentStep && !isStepCompleted(currentStep)) {
      markStepAsVisited(currentStep.id.toString());
    }
  }, [currentStep, isStepCompleted, markStepAsVisited]);

  const renderStepContent = () => {
    if (!currentStep) return null;

    if (isStepContentLoading || !loadedStepIds.has(currentStep.id)) {
      return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading step content">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-48 w-full" />
        </div>
      );
    }



    const optionalBanner = currentStep.is_optional ? (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md p-3 mb-4 flex items-start gap-3">
         <div>
            <h4 className="text-sm font-medium text-indigo-800 dark:text-indigo-400">Optional Step</h4>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
              You can skip this step and proceed to the next one without completing it.
            </p>
         </div>
      </div>
    ) : null;

    const content = (() => {
      switch (currentStep.content_type) {
        case 'text':
          return (
            <div ref={textContentRef} className="relative">
              {/* Text Lookup Popover */}
              <TextLookupPopover containerRef={textContentRef} />
              
              {/* Special "Read explanation" text above everything */}
              {currentStep.content_text && currentStep.content_text.includes("Read the explanation and make notes.") && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-700 dark:text-blue-400">
                  <p className="font-medium">Read the explanation and make notes.</p>
                </div>
              )}
  
              {renderAttachments(currentStep.attachments)}
              <div className="prose dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ 
                  __html: renderTextWithLatex(
                    (currentStep.content_text || '').replace(/<p><strong>Read the explanation and make notes.<\/strong><\/p>/g, '')
                  ) 
                }} />
              </div>
            </div>
          );
  
        case 'video_text':
          const stepVideoUrls = extractStepVideoUrls(currentStep)
          const hasRuVideo = !!stepVideoUrls.ru
          const hasEnVideo = !!stepVideoUrls.en
          const defaultVideoLanguage: StepVideoLanguage = hasRuVideo ? 'ru' : 'en'
          const selectedVideoLanguage = selectedVideoLanguageByStep.get(currentStep.id.toString()) || defaultVideoLanguage
          const activeVideoUrl = selectedVideoLanguage === 'en' ? stepVideoUrls.en : stepVideoUrls.ru
          const currentVideoStepError = videoStepTechErrors.get(currentStep.id.toString())
          const cleanVideoContentText = stripVideoLanguageMeta(currentStep.content_text)
          return (
            <div ref={textContentRef} className="space-y-4 relative">
              {/* Text Lookup Popover */}
              <TextLookupPopover containerRef={textContentRef} />
  
              {/* Special "Watch explanations" text above video */}
              {currentStep.content_text && currentStep.content_text.includes("Watch the explanations for the previous questions") && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-blue-700 dark:text-blue-400">
                  <p className="font-medium">Watch the explanations for the previous questions</p>
                </div>
              )}
  
              {(hasRuVideo || hasEnVideo) && (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  {hasRuVideo && hasEnVideo && (
                    <div className="flex items-center justify-end gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Video language</span>
                      <Button
                        variant={selectedVideoLanguage === 'ru' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedVideoLanguageByStep(prev => new Map(prev).set(currentStep.id.toString(), 'ru'))}
                      >
                        RU
                      </Button>
                      <Button
                        variant={selectedVideoLanguage === 'en' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedVideoLanguageByStep(prev => new Map(prev).set(currentStep.id.toString(), 'en'))}
                      >
                        EN
                      </Button>
                    </div>
                  )}
                  <YouTubeVideoPlayer
                    key={`${currentStep.id}-${selectedVideoLanguage}`}
                    url={activeVideoUrl}
                    title={currentStep.title || 'Lesson Video'}
                    className="w-full"
                    onError={(errorMessage) => {
                      setVideoStepTechErrors(prev => {
                        const stepId = currentStep.id.toString()
                        if (prev.get(stepId) === errorMessage) return prev
                        const updated = new Map(prev)
                        updated.set(stepId, errorMessage)
                        return updated
                      })
                    }}
                    onProgress={(progress) => {
                      setVideoProgress(prev => new Map(prev.set(currentStep.id.toString(), progress)));
                      if (progress >= 0.9 && !videoMarkedRef.current.has(currentStep.id)) {
                        videoMarkedRef.current.add(currentStep.id);
                        const stepProgress = stepsProgress.find(p => p.step_id === currentStep.id);
                        if (!stepProgress || stepProgress.status !== 'completed') {
                          const timeSpent = Math.ceil(progress * 10);
                          markStepAsVisited(currentStep.id.toString(), timeSpent);
                        }
                      }
                    }}
                  />
                </div>
              )}
              {currentVideoStepError && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-medium">Video technical issue detected</p>
                  <p className="mt-1">{currentVideoStepError}</p>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={handleSkipVideoStepDueToError}>
                      Skip this video step
                    </Button>
                  </div>
                </div>
              )}
              {renderAttachments(currentStep.attachments)}
  
              {currentStep.content_text && (
                <div className="prose dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ 
                    __html: renderTextWithLatex(
                      cleanVideoContentText.replace(/<p><strong>Watch the explanations for the previous questions<\/strong><\/p>/g, '')
                    ) 
                  }} />
                </div>
              )}
            </div>
          );
  
        case 'quiz':
          if (!isQuizReady) {
            return (
              <div className="space-y-4" aria-busy="true" aria-label="Loading quiz">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            );
          }

          return (
            <div ref={textContentRef} className="relative">
              <TextLookupPopover containerRef={textContentRef} />
              <QuizRenderer
                quizState={quizState}
  
              quizData={quizData}
              questions={questions}
              currentQuestionIndex={currentQuestionIndex}
              quizAnswers={quizAnswers}
              gapAnswers={gapAnswers}
              feedChecked={feedChecked}
              startQuiz={startQuiz}
              handleQuizAnswer={handleQuizAnswer}
              setGapAnswers={setGapAnswers}
              checkAnswer={checkAnswer}
              nextQuestion={nextQuestion}
              resetQuiz={resetQuiz}
              getScore={getScore}
              getCurrentQuestion={getCurrentQuestion}
              getCurrentUserAnswer={getCurrentUserAnswer}
              goToNextStep={goToNextStep}
              setQuizCompleted={setQuizCompleted}
              markStepAsVisited={markStepAsVisited}
              currentStep={currentStep}
              saveQuizAttempt={saveQuizAttempt}
              setFeedChecked={setFeedChecked}
              getGapStatistics={getGapStatistics}
              setQuizAnswers={setQuizAnswers}
              steps={steps}
              goToStep={goToStep}
              currentStepIndex={currentStepIndex}
              nextLessonId={nextLessonId}
              courseId={courseId}
              finishQuiz={finishQuiz}
              reviewQuiz={reviewQuiz}
              autoFillCorrectAnswers={autoFillCorrectAnswers}
              quizAttempt={quizAttempt}
              highlightedQuestionId={searchParams.get('questionId') || undefined}
              isTeacher={user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'curator'}
              isSpecialGroupStudent={isSpecialGroupStudent}
            />
            </div>
          );
  
        case 'flashcard':
          try {
            const flashcardData = JSON.parse(currentStep.content_text || '{}');
            return (
              <div>
                <FlashcardViewer
                  flashcardSet={flashcardData}
                  stepId={currentStep.id}
                  lessonId={parseInt(lessonId || '0')}
                  courseId={parseInt(courseId || '0')}
                  onComplete={() => {
                    // Mark flashcard step as completed
                    if (currentStep) {
                      markStepAsVisited(currentStep.id.toString(), 5); // 5 minutes for flashcard completion
                    }
                  }}
                  onProgress={(completed, total) => {
                    // Optional: track flashcard progress
                    console.log(`Flashcard progress: ${completed}/${total}`);
                  }}
                />
              </div>
            );
          } catch (error) {
            console.error('Failed to parse flashcard data:', error);
            return <div>Error loading flashcards</div>;
          }
  
        case 'summary':
          return (
            <SummaryStepRenderer 
              lessonId={lessonId || ''} 
              onLoad={handleSummaryLoad}
            />
          );
  
        default:
          return <div>Unsupported content type</div>;
      }
    })();

    return (
      <div className="step-content-wrapper">
        {optionalBanner}
        {content}
      </div>
    );
  };

  const handleLessonSelect = (newLessonId: string) => {
    if (newLessonId !== lessonId) {
      setCurrentStepIndex(0);
      navigate(`/course/${courseId}/lesson/${newLessonId}`);
    }
  };

  if (isCourseLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden md:block w-80 border-r border-border/70 p-4 space-y-3" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-8 w-3/4" />
        </div>
        <div className="flex-1 p-8 space-y-4" aria-busy="true">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!lesson || !course) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <div className="hidden md:block">
        <LessonSidebar
          course={course}
          modules={modules}
          selectedLessonId={lessonId!}
          onLessonSelect={handleLessonSelect}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
        {/* <MaintenanceBanner /> */}
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4 md:px-6 bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileSidebarOpen(true)}>
              <ChevronRight className="w-5 h-5" />
            </Button>
            {isSidebarCollapsed && (
              <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => setIsSidebarCollapsed(false)} title="Expand Sidebar">
                <PanelLeftOpen className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => navigate(`/course/${courseId}`)} title="Back to Course">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold text-base sm:text-lg leading-tight line-clamp-2 break-words max-w-[220px] sm:max-w-2xl">
              {lesson.title}
            </h1>
            {(user?.role === 'teacher' || user?.role === 'admin') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={skipLesson} 
                title="Skip Lesson (Teacher Only)"
                className="ml-2 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            {import.meta.env.DEV && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={autoCompleteAllSteps} 
                title="DEV: Auto-complete all steps"
                className="ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-mono text-xs"
              >
                🚀 Auto-Complete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Look Up Toggle */}
            {user?.role === 'student' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLookUp}
                className={`h-9 w-9 p-0 rounded-lg border transition-colors ${
                  isLookUpEnabled 
                    ? 'text-primary bg-primary/10 border-primary/30 hover:bg-primary/15' 
                    : 'bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
                }`}
                title={isLookUpEnabled ? 'Disable Look Up' : 'Enable Look Up'}
              >
                <Languages className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
          <div className="max-w-4xl mx-auto pb-20">
            {isLessonLoading ? (
              <div className="space-y-4" aria-busy="true" aria-label="Loading lesson">
                <div className="grid gap-2 grid-cols-6 sm:grid-cols-10 lg:grid-cols-15">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square" />
                  ))}
                </div>
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <>
                {/* Steps Navigation */}
                <div className="mb-6">
                  <div
                    role="tablist"
                    aria-label="Lesson steps"
                    className="grid gap-2 [grid-template-columns:repeat(6,minmax(0,1fr))] sm:[grid-template-columns:repeat(10,minmax(0,1fr))] lg:[grid-template-columns:repeat(15,minmax(0,1fr))]"
                  >
                    {orderedSteps.map((step, index) => {
                      const isCompleted = isStepCompleted(step);
                      const isClickable = user?.role !== 'student' || isCompleted || index <= furthestStepIndex;
                      const isActive = currentStepIndex === index;

                      const handleStepKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
                        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          for (let i = index + 1; i < orderedSteps.length; i += 1) {
                            const candidate = orderedSteps[i];
                            const candidateClickable = user?.role !== 'student' || isStepCompleted(candidate) || i <= furthestStepIndex;
                            if (candidateClickable) {
                              const next = document.getElementById(`step-tab-${candidate.id}`);
                              next?.focus();
                              break;
                            }
                          }
                        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                          e.preventDefault();
                          for (let i = index - 1; i >= 0; i -= 1) {
                            const prev = document.getElementById(`step-tab-${orderedSteps[i].id}`);
                            prev?.focus();
                            break;
                          }
                        } else if (e.key === 'Home') {
                          e.preventDefault();
                          document.getElementById(`step-tab-${orderedSteps[0].id}`)?.focus();
                        } else if (e.key === 'End') {
                          e.preventDefault();
                          document.getElementById(`step-tab-${orderedSteps[orderedSteps.length - 1].id}`)?.focus();
                        }
                      };

                      return (
                        <button
                          key={step.id}
                          id={`step-tab-${step.id}`}
                          role="tab"
                          aria-current={isActive ? 'step' : undefined}
                          aria-selected={isActive}
                          aria-label={`Step ${step.order_index}${step.title ? `: ${step.title}` : ''}${isCompleted ? ' (completed)' : ''}${!isClickable ? ' (locked)' : ''}`}
                          tabIndex={isActive ? 0 : -1}
                          onClick={() => isClickable && goToStep(index)}
                          onKeyDown={handleStepKeyDown}
                          disabled={!isClickable}
                          title={!isClickable ? 'Complete previous steps to unlock' : step.title || `Step ${step.order_index}`}
                          className={`aspect-square rounded-md p-1 relative shadow-sm transition-all min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isClickable ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed opacity-50'
                          } ${isActive
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/40'
                            : isCompleted
                              ? `bg-emerald-600 text-white ${isClickable ? 'hover:bg-emerald-700' : ''}`
                              : step.is_optional
                                ? `bg-accent text-accent-foreground border border-border/60 ${isClickable ? 'hover:bg-accent/80' : ''}`
                                : `bg-muted text-muted-foreground border border-border/60 ${isClickable ? 'hover:bg-muted/80' : ''}`
                            }`}
                        >
                          {!isClickable && (
                            <div
                              aria-hidden="true"
                              className="absolute inset-0 rounded-md opacity-30"
                              style={{
                                background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 6px)'
                              }}
                            />
                          )}
                          {isCompleted && !isActive && (
                            <div className="absolute top-1 right-1 bg-white/20 rounded-full p-0.5" aria-hidden="true">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className="h-full w-full flex flex-col items-start justify-end">
                            <div className="absolute top-1 left-1 text-[10px] sm:text-[11px] bg-background/70 text-foreground rounded px-1 py-0.5">
                              {step.order_index}
                            </div>
                            <div className="flex items-center gap-1 opacity-90">
                              {!isClickable ? <Lock className="w-4 h-4" aria-hidden="true" /> : <span aria-hidden="true">{getStepIcon(step)}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step Content */}
                <Card className="border-none shadow-none bg-transparent">
                  <CardContent className="p-4 sm:p-6 border-none bg-transparent">
                    {currentStep ? (
                      <div className="min-h-[300px] sm:min-h-[400px] border-none">
                        {renderStepContent()}
                      </div>
                    ) : (
                      <div className="text-center py-12 border-none">
                        <p className="text-muted-foreground">No steps available for this lesson.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bottom step navigation */}
                <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={goToPreviousStep}
                    disabled={currentStepIndex === 0}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                    Previous
                  </Button>
                  <div className="flex flex-col items-center gap-1 order-[-1] sm:order-none">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Step {currentStep?.order_index ?? currentStepIndex + 1} of {orderedSteps.length}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Lesson {lesson.module_id}.{lesson.order_index}</span>
                      {currentStep?.is_optional && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">(Optional)</span>
                        </>
                      )}
                    </div>
                    {currentStep?.content_type === 'quiz' && saveStatus !== 'idle' && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                        {saveStatus === 'saving' && (<><Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /><span>Saving…</span></>)}
                        {saveStatus === 'saved' && (<><Cloud className="w-3 h-3 text-emerald-500" aria-hidden="true" /><span>Saved</span></>)}
                        {saveStatus === 'error' && (<><CloudOff className="w-3 h-3 text-rose-500" aria-hidden="true" /><span>Save failed</span></>)}
                      </div>
                    )}
                    {!canProceedToNext() && getProceedBlockReason() && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-medium" aria-live="polite">
                        {getProceedBlockReason()}
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={goToNextStep}
                    className="w-full sm:w-auto min-h-[44px]"
                    disabled={!canProceedToNext()}
                  >
                    {currentStepIndex < orderedSteps.length - 1 ? 'Next' : (nextLessonId ? 'Next Lesson' : 'Next')}
                    <ChevronRight className="w-4 h-4 ml-2" aria-hidden="true" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsMobileSidebarOpen(false)} />
          <div className="absolute top-0 left-0 w-72 max-w-[85%] h-full bg-background border-r shadow-xl">
            <LessonSidebar
              course={course}
              modules={modules}
              selectedLessonId={lessonId!}
              onLessonSelect={(id) => { handleLessonSelect(id); setIsMobileSidebarOpen(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
