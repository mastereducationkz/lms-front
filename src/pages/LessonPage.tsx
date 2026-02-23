import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ChevronLeft, ChevronRight, Play, FileText, HelpCircle, ChevronDown, ChevronUp, Lock, Trophy, PanelLeftOpen, PanelLeftClose, SkipForward, Languages } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { Progress } from '../components/ui/progress';
import apiClient from '../services/api';
import type { Lesson, Step, Course, CourseModule, StepProgress, StepAttachment } from '../types';
import YouTubeVideoPlayer from '../components/YouTubeVideoPlayer';
import { renderTextWithLatex } from '../utils/latex';
import FlashcardViewer from '../components/lesson/FlashcardViewer';
import QuizRenderer from '../components/lesson/QuizRenderer';
import SummaryStepRenderer from '../components/lesson/SummaryStepRenderer';
import TextLookupPopover from '../components/lesson/TextLookupPopover';
import MaintenanceBanner from '../components/MaintenanceBanner';

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

  // Calculate total progress for the course based on modules data
  const calculateTotalProgress = () => {
    if (!modules.length) return 0;

    let totalLessons = 0;
    let completedLessons = 0;

    modules.forEach(module => {
      const lessons = module.lessons || [];
      totalLessons += lessons.length;
      completedLessons += lessons.filter(l => l.is_completed).length;
    });

    return totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  };

  return (
    <div className={`${isCollapsed ? 'w-0 border-none' : 'w-80 border-r'} bg-card border-border h-screen flex flex-col transition-all duration-300 overflow-hidden`}>
      <div className={`p-4 border-b border-border flex-shrink-0 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
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
      
      {!isCollapsed && (
        <div className="px-6 pb-4 pt-2">
           <Progress value={calculateTotalProgress()} className="h-2" />
        </div>
      )}

      {/* Modules and Lessons - Scrollable */}
      {!isCollapsed && (
      <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
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
                        ? 'bg-accent border-l-4 border-l-primary'
                        : 'hover:bg-muted/40'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium text-foreground">{module.title}</span>
                          <span className="text-xs text-muted-foreground">{completedInModule}/{lectures.length} lessons</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={lectures.length ? (completedInModule / lectures.length) * 100 : 0} className="w-16 h-1" />
                        {isExpanded ?
                          <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" /> :
                          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        }
                      </div>
                    </button>

                    {/* Lessons List */}
                    {isExpanded && (
                      <div className="bg-muted/30">
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
                                    ? 'bg-accent border-l-4 border-l-primary' 
                                    : isAccessible 
                                      ? 'hover:bg-muted/60' 
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                              >
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted/50">
                                  {!isAccessible ? <Lock className="w-4 h-4 text-muted-foreground" /> : getLessonIcon()}
                                </div>
                                <div className="flex items-center justify-between w-full min-w-0">
                                  <span className="truncate">{lecture.title}</span>
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
  const [quizCompleted, setQuizCompleted] = useState<Map<string, boolean>>(new Map());
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);

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

  // Ref for text lookup popover
  const textContentRef = useRef<HTMLDivElement>(null);

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

  // Sync URL step/stepId parameters with currentStepIndex
  useEffect(() => {
    if (steps.length > 0) {
      const stepParam = searchParams.get('step');
      const stepIdParam = searchParams.get('stepId');
      
      let targetIndex = 0;

      if (stepIdParam) {
        // Try to find step by its unique ID
        const stepId = parseInt(stepIdParam, 10);
        const foundIndex = steps.findIndex(s => s.id === stepId);
        if (foundIndex !== -1) targetIndex = foundIndex;
      } else if (stepParam) {
        // Try to find step by its 1-based index
        const stepNumber = parseInt(stepParam, 10);
        targetIndex = Math.max(1, Math.min(stepNumber, steps.length)) - 1;
      }

      if (targetIndex !== currentStepIndex) {
        setCurrentStepIndex(targetIndex);
      }
    }
  }, [searchParams, steps, currentStepIndex]);

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
        setError(accessCheck.reason || 'You cannot access this lesson yet.');
        alert(accessCheck.reason || 'Please complete previous lessons first.');
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

  const markStepAsStarted = async (stepId: string) => {
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
  };

  const markStepAsVisited = async (stepId: string, timeSpent: number = 1) => {
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

      // Check if all steps in current lesson are now completed
      // If so, reload modules to update is_accessible for lessons unlocked by redirect
      const allStepsCompleted = steps.every(step => {
        if (step.id.toString() === stepId) {
          return true; // This step is now completed
        }
        const stepProgress = stepsProgress.find(p => p.step_id === step.id);
        return stepProgress?.status === 'completed';
      });

      console.log('Step completed. All steps done?', allStepsCompleted, 'Lesson has next_lesson_id?', !!lesson?.next_lesson_id);

      if (allStepsCompleted) {
      // Lesson is now complete - reload modules to update sidebar and unlock target
      console.log('Lesson completed, reloading modules...');
      loadCourseData(false);
    }
    } catch (error) {
      console.error('Failed to mark step as visited:', error);
    }
  };

  const currentStep = steps[currentStepIndex];

  // Check if step is completed based on content type
  const isStepCompleted = (step: Step): boolean => {
    const stepProgress = stepsProgress.find(p => p.step_id === step.id);
    return stepProgress?.status === 'completed';
  };

  // Load step content on demand
  useEffect(() => {
    const loadStepContent = async () => {
      if (!currentStep) return;
      
      // If content is already loaded or being loaded, skip
      if (loadedStepIds.has(currentStep.id) || isStepContentLoading) return;
      
      // Check if step actually needs content (some types might not)
      // But generally we want to ensure we have the full step object
      
      try {
        setIsStepContentLoading(true);
        console.log(`Loading content for step ${currentStep.id}...`);
        
        const fullStep = await apiClient.getStep(currentStep.id.toString());
        
        setSteps(prevSteps => 
          prevSteps.map(s => s.id === fullStep.id ? fullStep : s)
        );
        
        setLoadedStepIds(prev => new Set(prev).add(fullStep.id));
      } catch (error) {
        console.error('Failed to load step content:', error);
      } finally {
        setIsStepContentLoading(false);
      }
    };

    loadStepContent();
  }, [currentStepIndex, currentStep, loadedStepIds, isStepContentLoading]);

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
      const loadQuizData = async () => {
        try {
          const parsedQuizData = JSON.parse(currentStep.content_text || '{}');

          if (!isMounted) return;

          setQuizData(parsedQuizData);
          setQuestions(parsedQuizData.questions || []);

          // Initialize gap answers map per question
          const init = new Map<string, string[]>();
          (parsedQuizData.questions || []).forEach((q: any) => {
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
          
          // SERVER-FIRST APPROACH: Check server for existing attempts first
          // localStorage is only used as fallback if server has no data
          let serverAttemptRestored = false;
          
          try {
            const attempts = await apiClient.getStepQuizAttempts(currentStep.id);

            if (!isMounted) return;

            if (attempts && attempts.length > 0) {
              const lastAttempt = attempts[0]; // Get the most recent attempt
              console.log('Found server quiz attempt:', lastAttempt);
              
              // Check if quiz content has changed since this attempt
              const attemptHash = lastAttempt.quiz_content_hash;
              if (attemptHash && attemptHash !== currentContentHash) {
                console.warn('⚠️ Quiz content changed since last attempt - invalidating old answers');
                // Don't restore old answers, clear localStorage too
                localStorage.removeItem(`quiz_answers_${currentStep.id}`);
                localStorage.removeItem(`gap_answers_${currentStep.id}`);
                // Continue with fresh state
              } else {
                // Quiz unchanged or no hash (legacy attempt), restore answers
                setQuizAttempt(lastAttempt);
                serverAttemptRestored = true;

                // Restore answers
                if (lastAttempt.answers) {
                  try {
                    const savedAnswers = JSON.parse(lastAttempt.answers);
                    console.log('Parsed saved answers:', savedAnswers);

                    // Handle both Map-like array [[key, val], ...] and object {key: val} formats
                    let answersMap: Map<string, any>;
                    if (Array.isArray(savedAnswers)) {
                      answersMap = deserializeQuizAnswers(savedAnswers);
                    } else {
                      answersMap = new Map(Object.entries(savedAnswers)) as Map<string, any>;
                    }

                    setQuizAnswers(answersMap);

                    // Restore gap answers
                    const newGapAnswers = new Map(init);

                    (parsedQuizData.questions || []).forEach((q: any) => {
                      if ((q.question_type === 'fill_blank' || q.question_type === 'text_completion') && answersMap.has(q.id.toString())) {
                        const savedGapAns = answersMap.get(q.id.toString());
                        console.log(`Restoring gap answer for Q ${q.id}:`, savedGapAns);
                        if (Array.isArray(savedGapAns)) {
                          newGapAnswers.set(q.id.toString(), savedGapAns);
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
                console.log('Restoring from localStorage (server had no data)');
                
                if (localQuizAnswers) {
                  setQuizAnswers(deserializeQuizAnswers(JSON.parse(localQuizAnswers)));
                }
                if (localGapAnswers) {
                  setGapAnswers(new Map(JSON.parse(localGapAnswers)));
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
                // No data anywhere, use defaults
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
             if (questionIdParam && (parsedQuizData.questions || []).length > 0) {
               const questionIndex = (parsedQuizData.questions || []).findIndex((q: any) => q.id.toString() === questionIdParam);
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
  }, [currentStep]);

  // Persist quiz progress to localStorage
  useEffect(() => {
    if (currentStep?.content_type === 'quiz' && (quizAnswers.size > 0 || gapAnswers.size > 0)) {
      localStorage.setItem(`quiz_answers_${currentStep.id}`, JSON.stringify(serializeQuizAnswers(quizAnswers)));
      localStorage.setItem(`gap_answers_${currentStep.id}`, JSON.stringify(Array.from(gapAnswers.entries())));
    }
  }, [quizAnswers, gapAnswers, currentStep, currentQuestionIndex]);

  // Auto-save quiz progress to server (debounced)
  useEffect(() => {
    if (!currentStep?.content_type || currentStep.content_type !== 'quiz') return;
    if (!courseId || !lessonId) return;
    if (quizState === 'completed' || quizState === 'title') return;
    if (quizAnswers.size === 0 && gapAnswers.size === 0) return;

    const saveToServer = async () => {
      try {
        // Combine quiz and gap answers, serializing Maps properly
        const combinedAnswers = new Map([...quizAnswers, ...gapAnswers]);
        const answersToSave = serializeQuizAnswers(combinedAnswers);
        const timeSpentSeconds = quizStartTime
          ? Math.floor((Date.now() - quizStartTime) / 1000)
          : undefined;

        // Calculate total questions including gaps (to match getScore logic)
        const { total } = getScore();

        const attemptData = {
          step_id: parseInt(currentStep.id.toString()),
          course_id: parseInt(courseId),
          lesson_id: parseInt(lessonId),
          quiz_title: quizData?.title || 'Quiz',
          total_questions: total,  // Use total from getScore to include gaps
          correct_answers: 0,
          score_percentage: 0,
          answers: JSON.stringify(answersToSave),
          time_spent_seconds: timeSpentSeconds,
          is_draft: true,
          current_question_index: currentQuestionIndex
        };

        if (quizAttempt?.id && quizAttempt.is_draft) {
          // Update existing draft
          await apiClient.updateQuizAttempt(quizAttempt.id, {
            answers: JSON.stringify(answersToSave),
            current_question_index: currentQuestionIndex,
            time_spent_seconds: timeSpentSeconds
          });
          console.log('Quiz draft updated on server');
        } else if (!quizAttempt) {
          // Create new draft with content hash for version tracking
          const contentHash = await computeQuizContentHash(currentStep.content_text || '{}');
          const draftData = {
            ...attemptData,
            quiz_content_hash: contentHash
          };
          const savedAttempt = await apiClient.saveQuizAttempt(draftData);
          setQuizAttempt(savedAttempt);
          console.log('Quiz draft saved to server');
        }
      } catch (error) {
        console.error('Failed to auto-save quiz progress:', error);
      }
    };

    // Debounce: save after 3 seconds of no changes
    const timer = setTimeout(saveToServer, 3000);
    return () => clearTimeout(timer);
  }, [quizAnswers, gapAnswers, currentQuestionIndex, currentStep, courseId, lessonId, quizState, quizData, questions.length, quizStartTime, quizAttempt]);

  // Check if user can proceed to next step
  const canProceedToNext = (): boolean => {
    // Teachers and admins can always proceed
    if (user?.role === 'teacher' || user?.role === 'admin') return true;

    if (!currentStep) return false;

    // Optional steps can always be skipped
    if (currentStep.is_optional) return true;

    const stepId = currentStep.id.toString();

    // Check if already completed in backend/local state
    const stepProgress = stepsProgress.find(p => p.step_id === currentStep.id);
    if (stepProgress?.status === 'completed') return true;

    if (currentStep.content_type === 'video_text') {
      // For video steps, check if video is watched 90%+
      const progress = videoProgress.get(stepId) || 0; // progress is a fraction [0..1]
      return progress >= 0.9;
    } else if (currentStep.content_type === 'quiz') {
      // For quiz steps, check if quiz is completed
      return quizCompleted.get(stepId) || false;
    }

    // For other step types, allow proceeding
    return true;
  };

  const goToNextStep = () => {
    // Check if current step is completed
    if (currentStep && !canProceedToNext()) {
      let message = '';

      switch (currentStep.content_type) {
        case 'video_text':
          const videoProgressValue = videoProgress.get(currentStep.id.toString()) || 0; // fraction [0..1]
          const progressPercent = Math.round(videoProgressValue * 100);
          message = `Пожалуйста, досмотрите видео до конца (просмотрено ${progressPercent}%, требуется 90%+) перед переходом к следующему шагу.`;
          break;
        case 'quiz':
          message = 'Пожалуйста, завершите квиз перед переходом к следующему шагу.';
          break;
        default:
          message = 'Пожалуйста, завершите текущий шаг перед переходом к следующему.';
      }

      alert(message);
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      goToStep(currentStepIndex + 1);
    } else if (nextLessonId) {
      setCurrentStepIndex(0);
      navigate(`/course/${courseId}/lesson/${nextLessonId}`);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };

  const goToStep = (index: number) => {
    // Prevent moving forward if current step is not complete
    if (index > currentStepIndex && currentStep && !canProceedToNext()) {
      let message = '';
      switch (currentStep.content_type) {
        case 'video_text':
          const videoProgressValue = videoProgress.get(currentStep.id.toString()) || 0;
          const progressPercent = Math.round(videoProgressValue * 100);
          message = `Пожалуйста, досмотрите видео до конца (просмотрено ${progressPercent}%, требуется 90%+) перед переходом к следующему шагу.`;
          break;
        case 'quiz':
          message = 'Пожалуйста, завершите квиз перед переходом к следующему шагу.';
          break;
        default:
          message = 'Пожалуйста, завершите текущий шаг перед переходом к следующему.';
      }
      alert(message);
      return;
    }

    // Mark current step as visited ONLY if it satisfies completion criteria
    if (currentStep && canProceedToNext()) {
      markStepAsVisited(currentStep.id.toString(), 2); // 2 minutes for step completion
    }
    setCurrentStepIndex(index);

    // Update URL with step parameter (1-based)
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('step', (index + 1).toString());
    setSearchParams(newSearchParams);
  };

  const skipLesson = async () => {
    if (!lesson) return;
    if (!confirm('Are you sure you want to skip this lesson? It will be marked as completed.')) return;
    
    try {
      await apiClient.markLessonComplete(lesson.id.toString(), 0);
      // Reload to update status
      loadLessonData();
      loadCourseData(false);
    } catch (err) {
      console.error('Failed to skip lesson:', err);
      alert('Failed to skip lesson');
    }
  };

  // Dev mode: Auto-complete all steps quickly
  const autoCompleteAllSteps = async () => {
    if (!lesson || !steps.length) return;
    
    const confirmMsg = `🚀 DEV MODE: Auto-complete all ${steps.length} steps in this lesson?\n\nThis will:\n✓ Mark all steps as completed\n✓ Auto-fill quiz answers\n✓ Mark lesson as complete\n\n⚠️ This is for development/testing only!`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
      // Auto-complete all steps
      for (const step of steps) {
        const stepId = step.id.toString();
        
        // Mark step as visited/completed
        await markStepAsVisited(stepId, 0);
        
        // If it's a quiz, auto-complete it
        if (step.content_type === 'quiz') {
          setQuizCompleted(prev => new Map(prev).set(stepId, true));
        }
        
        // If it's a video, mark as fully watched
        if (step.content_type === 'video_text') {
          setVideoProgress(prev => new Map(prev).set(stepId, 1.0));
        }
      }
      
      // Mark lesson as complete
      await apiClient.markLessonComplete(lesson.id.toString(), 0);
      
      // Reload data
      await loadLessonData();
      await loadCourseData(false);
      
      alert('✅ All steps completed! Lesson marked as done.');
    } catch (err) {
      console.error('Failed to auto-complete steps:', err);
      alert('❌ Failed to auto-complete steps');
    }
  };

  const getStepIcon = (step: Step) => {
    switch (step.content_type) {
      case 'video_text':
        return <Play className="w-4 h-4" />;
      case 'quiz':
        return <HelpCircle className="w-4 h-4" />;
      case 'flashcard':
        return <HelpCircle className="w-4 h-4" />; // Using HelpCircle as fallback for BookOpen if not imported, or add BookOpen import
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



  const handleQuizAnswer = (questionId: string, answer: any) => {
    setQuizAnswers(prev => new Map(prev.set(questionId, answer)));
  };

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
      const scorePercentage = total > 0 ? (score / total) * 100 : 0;
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
    const scorePercentage = total > 0 ? (score / total) * 100 : 0;
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
        if (question.question_type === 'fill_blank' || question.question_type === 'text_completion') {
          // Extract correct answers from gaps
          const text = question.content_text || question.question_text || '';
          const separator = question.gap_separator || ',';
          const correctAnswers = extractCorrectAnswersFromGaps(text, separator);
          newGapAnswers.set(question.id.toString(), correctAnswers);
        } else if (question.question_type === 'long_text') {
          // For long text, fill with sample text
          newQuizAnswers.set(question.id, 'Sample answer for development testing');
        } else {
          // For single_choice, multiple_choice, etc.
          newQuizAnswers.set(question.id, question.correct_answer);
        }
      });

      setQuizAnswers(newQuizAnswers);
      setGapAnswers(newGapAnswers);
      console.log('✅ Auto-filled correct answers for development');
    }
  };

  const getCurrentQuestion = () => {
    return questions[currentQuestionIndex];
  };

  const getCurrentUserAnswer = () => {
    const question = getCurrentQuestion();
    return question ? quizAnswers.get(question.id) : undefined;
  };


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

      const answersToSave = Array.from(new Map([...quizAnswers, ...gapAnswers]).entries());
      console.log('Saving quiz attempt:', {
        score,
        totalQuestions,
        answersCount: answersToSave.length,
        hasLongText,
        sampleAnswers: answersToSave.slice(0, 3)
      });

      // If quiz has long_text questions, it needs teacher grading
      // Otherwise, it's auto-graded
      const isGraded = !hasLongText;

      // If we have an existing draft, finalize it instead of creating new
      if (quizAttempt?.id && quizAttempt.is_draft) {
        const savedAttempt = await apiClient.updateQuizAttempt(quizAttempt.id, {
          answers: JSON.stringify(answersToSave),
          time_spent_seconds: timeSpentSeconds,
          is_draft: false,  // Finalize the draft
          total_questions: totalQuestions,  // Update total_questions to include gaps
          correct_answers: score,
          score_percentage: totalQuestions > 0 ? (score / totalQuestions) * 100 : 0,
          is_graded: isGraded
        });
        setQuizAttempt(savedAttempt);
        console.log('Quiz draft finalized successfully');
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
          score_percentage: totalQuestions > 0 ? (score / totalQuestions) * 100 : 0,
          answers: JSON.stringify(answersToSave),
          time_spent_seconds: timeSpentSeconds,
          is_graded: isGraded,
          is_draft: false,
          quiz_content_hash: contentHash
        };

        const savedAttempt = await apiClient.saveQuizAttempt(attemptData);
        setQuizAttempt(savedAttempt);
        console.log('Quiz attempt saved successfully');
      }
      
      // Clear localStorage only after successful server save
      localStorage.removeItem(`quiz_answers_${currentStep.id}`);
      localStorage.removeItem(`gap_answers_${currentStep.id}`);
    } catch (error) {
      console.error('Failed to save quiz attempt:', error);
    }
  };

  // Get detailed gap statistics for display
  const getGapStatistics = () => {
    let totalGaps = 0;
    let correctGaps = 0;
    let regularQuestions = 0;
    let correctRegular = 0;

    questions.forEach(question => {
      // Skip image_content - it's not a question, just visual content
      if (question.question_type === 'image_content') return;
      
      if (question.question_type === 'fill_blank' || question.question_type === 'text_completion') {
        const userAnswers = gapAnswers.get(question.id.toString()) || [];

        // Extract correct answers from the text using the new utility
        const text = question.content_text || question.question_text || '';
        const separator = question.gap_separator || ',';
        const correctAnswers = extractCorrectAnswersFromGaps(text, separator);

        console.log(`Stats for Q ${question.id}:`, {
          userAnswers,
          correctAnswers,
          userAnswersLen: userAnswers.length,
          correctAnswersLen: correctAnswers.length
        });

        const gaps = correctAnswers.length;
        totalGaps += gaps;

        userAnswers.forEach((userAns, idx) => {
          if (idx < correctAnswers.length) {
            const isGapCorrect = (userAns || '').toString().trim().toLowerCase() ===
              (correctAnswers[idx] || '').toString().trim().toLowerCase();
            if (isGapCorrect) correctGaps++;
          }
        });
      } else {
        regularQuestions++;
        const answer = quizAnswers.get(question.id);

        // For long_text questions, automatically count as correct if answer is not empty
        if (question.question_type === 'long_text') {
          if (answer && answer.toString().trim() !== '') {
            correctRegular++;
          }
        } else if (question.question_type === 'short_answer' || question.question_type === 'media_open_question') {
          const correctAnswers = (question.correct_answer || '').toString().split('|').map((a: string) => a.trim().toLowerCase()).filter((a: string) => a.length > 0);
          const userVal = (answer || '').toString().trim().toLowerCase();
          if (correctAnswers.includes(userVal)) {
            correctRegular++;
          }
        } else {
          // For other question types, check if answer is correct
          if (answer !== undefined && answer === question.correct_answer) {
            correctRegular++;
          }
        }
      }
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

    // Show loader if content is loading or not yet loaded
    if (isStepContentLoading || !loadedStepIds.has(currentStep.id)) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading step content...</p>
        </div>
      );
    }



    const optionalBanner = currentStep.is_optional ? (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-1 border-indigo-200 dark:border-indigo-800 rounded-md p-3 mb-4 flex items-start gap-3">
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
  
              {currentStep.video_url && (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <YouTubeVideoPlayer
                    key={currentStep.id}
                    url={currentStep.video_url}
                    title={currentStep.title || 'Lesson Video'}
                    className="w-full"
                    onProgress={(progress) => {
                      setVideoProgress(prev => new Map(prev.set(currentStep.id.toString(), progress)));
  
                      // Auto-complete video step when 90%+ is watched
                      if (progress >= 0.9) {
                        const stepProgress = stepsProgress.find(p => p.step_id === currentStep.id);
                        if (!stepProgress || stepProgress.status !== 'completed') {
                          // Calculate time spent based on video duration and progress
                          const timeSpent = Math.ceil(progress * 10); // Estimate time spent in minutes
                          markStepAsVisited(currentStep.id.toString(), timeSpent);
                        }
                      }
                    }}
                  />
                </div>
              )}
  
              {/* Video Progress Indicator */}
              {currentStep && currentStep.video_url && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300/80">Video Watch Progress</span>
                    <span className="text-sm text-blue-600 dark:text-blue-400/80">
                      {Math.round((videoProgress.get(currentStep.id.toString()) || 0) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-900/40 rounded-full h-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-600/70 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(videoProgress.get(currentStep.id.toString()) || 0) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400/70 mt-2">
                    You need to watch 90% or more of the video to proceed to the next step
                  </p>
                </div>
              )}
  
              {renderAttachments(currentStep.attachments)}
  
              {currentStep.content_text && (
                <div className="prose dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ 
                    __html: renderTextWithLatex(
                      currentStep.content_text.replace(/<p><strong>Watch the explanations for the previous questions<\/strong><\/p>/g, '')
                    ) 
                  }} />
                </div>
              )}
            </div>
          );
  
        case 'quiz':
          if (!isQuizReady) {
            return (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
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
            <h1 className="font-semibold text-lg truncate max-w-[200px] sm:max-w-md">
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
                    ? 'text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800' 
                    : 'bg-white dark:bg-card text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
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
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {/* Steps Navigation */}
                <div className="mb-6">
                  <div className="grid gap-2 [grid-template-columns:repeat(6,minmax(0,1fr))] sm:[grid-template-columns:repeat(10,minmax(0,1fr))] lg:[grid-template-columns:repeat(15,minmax(0,1fr))]">
                    {steps
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((step, index) => {
                        const isCompleted = isStepCompleted(step);

                        // Teachers/admins can click on any step
                        // Students can click on completed steps OR any step up to the furthest step they've reached
                        const isClickable = user?.role !== 'student' || isCompleted || index <= furthestStepIndex;

                        return (
                          <button
                            key={step.id}
                            onClick={() => isClickable && goToStep(index)}
                            disabled={!isClickable}
                            title={!isClickable ? 'Завершите предыдущие шаги, чтобы открыть' : step.title || `Шаг ${step.order_index}`}
                            className={`aspect-square rounded-md text-white p-1 relative shadow-sm transition-all ${
                              isClickable ? 'hover:shadow-md cursor-pointer' : 'cursor-not-allowed opacity-50'
                            } ${currentStepIndex === index
                              ? 'bg-blue-800 ring-2 ring-blue-400'
                              : isCompleted
                                ? `bg-green-600 ${isClickable ? 'hover:bg-green-700' : ''}`
                                : step.is_optional
                                  ? `bg-indigo-400 ${isClickable ? 'hover:bg-indigo-500' : ''}`
                                  : `bg-gray-500 ${isClickable ? 'hover:bg-gray-600' : ''}`
                              }`}
                          >
                            {/* Striped overlay for locked steps */}
                            {!isClickable && (
                              <div 
                                className="absolute inset-0 rounded-md opacity-30"
                                style={{
                                  background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 6px)'
                                }}
                              />
                            )}
                            <div className="h-full w-full flex flex-col items-start justify-end">
                              <div className="absolute top-1 left-1 text-[10px] sm:text-[11px] bg-white/20 rounded px-1 py-0.5">
                                {step.order_index}
                              </div>
                              <div className="flex items-center gap-1 opacity-90">
                                {!isClickable ? <Lock className="w-4 h-4" /> : getStepIcon(step)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Step Content */}
                <Card className="border-none shadow-none">
                  <CardContent className="p-4 sm:p-6 border-none">
                    {currentStep ? (
                      <div className="min-h-[300px] sm:min-h-[400px] border-none">
                        {renderStepContent()}
                      </div>
                    ) : (
                      <div className="text-center py-12 border-none">
                        <p className="text-gray-500 dark:text-gray-400">No steps available for this lesson.</p>
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
                    className="w-full sm:w-auto"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground order-[-1] sm:order-none">
                    <span>Step {currentStep?.order_index ?? currentStepIndex + 1} of {steps.length}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Lesson {lesson.module_id}.{lesson.order_index}</span>
                    {currentStep?.is_optional && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">(Optional)</span>
                      </>
                    )}
                    {currentStep && !isStepCompleted(currentStep) && !currentStep.is_optional && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          {currentStep.content_type === 'video_text' ? 'Video not watched enough' :
                              currentStep.content_type === 'quiz' && !isStepCompleted(currentStep) ? 'Quiz is not complete' :
                              'Step is not completed'}
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    onClick={goToNextStep}
                    className="w-full sm:w-auto"
                    disabled={!canProceedToNext()}
                  >
                    {currentStepIndex < steps.length - 1 ? 'Next' : (nextLessonId ? 'Next Lesson' : 'Next')}
                    <ChevronRight className="w-4 h-4 ml-2" />
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
