import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../services/api';
import type { Lesson, Step } from '../types';
import Tabs from '../components/Tabs';
import Loader from '../components/Loader';

export default function LecturePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user] = useState(() => apiClient.getCurrentUserSync());

  useEffect(() => {
    if (!lessonId) return;

    const loadLessonData = async () => {
      try {
        setLoading(true);
        const [lessonData, stepsData, materialsData, assignmentsData] = await Promise.all([
          apiClient.getLesson(lessonId),
          apiClient.getLessonSteps(lessonId),
          apiClient.getLessonMaterials(lessonId),
          apiClient.getAssignments({ lesson_id: lessonId })
        ]);

        setLesson(lessonData);
        setSteps(stepsData);
        setMaterials(materialsData);
        setAssignments(assignmentsData);
      } catch (error) {
        console.error('Failed to load lesson data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLessonData();
  }, [lessonId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900">Lesson not found</h2>
        <p className="text-gray-600 mt-2">The lesson you're looking for doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  // Get the first step to determine content type and content
  const firstStep = steps.length > 0 ? steps[0] : null;
  const contentType = firstStep?.content_type || 'text';
  const videoUrl = firstStep?.video_url;
  const contentText = firstStep?.content_text;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-gray-600 mt-1">{lesson.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Tabs tabs={["Content", "Materials", "Assignments"]} value={tab} onChange={setTab} />
      </div>

      {tab === 0 && (
        <div className="space-y-4">
          {contentType === 'video_text' && videoUrl ? (
            <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video">
              {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                <iframe
                  src={videoUrl.replace('watch?v=', 'embed/')}
                  className="w-full h-full"
                  allowFullScreen
                  title={lesson.title}
                />
              ) : (
                <video controls src={videoUrl} className="w-full h-full" />
              )}
            </div>
          ) : (
            <div className="card p-6">
              <div className="prose dark:prose-invert max-w-none">
                {contentText ? (
                  <div dangerouslySetInnerHTML={{ __html: contentText }} />
                ) : (
                  <p className="text-gray-500">No content available for this lesson</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 1 && (
        <div className="card p-5">
          <div className="font-semibold mb-3">Materials</div>
          {materials.length === 0 ? (
            <div className="text-gray-500 text-sm">No materials available</div>
          ) : (
            <ul className="space-y-2">
              {materials.map(material => (
                <li key={material.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="font-medium">{material.title}</div>
                    <div className="text-sm text-gray-500">
                      {material.file_type} • {material.file_size_bytes ? 
                        `${Math.round(material.file_size_bytes / 1024)} KB` : 
                        'Unknown size'
                      }
                    </div>
                  </div>
                  <a 
                    href={material.file_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn-secondary text-sm"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 2 && (
        <div className="card p-5">
          <div className="font-semibold mb-3">Assignments</div>
          {assignments.length === 0 ? (
            <div className="text-gray-500 text-sm">No assignments for this lesson</div>
          ) : (
            <ul className="space-y-3">
              {assignments.map(assignment => (
                <li key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{assignment.title}</div>
                    <div className="text-sm text-gray-600">{assignment.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Type: {assignment.assignment_type} • Max Score: {assignment.max_score}
                      {assignment.time_limit_minutes && (
                        <span> • Time Limit: {assignment.time_limit_minutes} minutes</span>
                      )}
                    </div>
                  </div>
                  <a 
                    href={`/assignment/${assignment.id}`} 
                    className="btn-primary text-sm"
                  >
                    {user?.role === 'student' ? 'Start Assignment' : 'View Assignment'}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


