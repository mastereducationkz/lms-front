import React, { useState, useEffect } from 'react';
import YouTubeVideoPlayer from '../YouTubeVideoPlayer';
import RichTextEditor from '../RichTextEditor';
import FileUploadArea from '../FileUploadArea';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import apiClient from '../../services/api';
import type { StepAttachment } from '../../types';

export interface VideoLessonEditorProps {
  lessonTitle: string;
  videoUrlRu: string;
  videoUrlEn: string;
  videoError?: string | null;
  onVideoUrlRuChange: (url: string) => void;
  onVideoUrlEnChange: (url: string) => void;
  onClearUrlRu: () => void;
  onClearUrlEn: () => void;
  onVideoError?: (error: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  stepId?: number;
  attachments?: string; // JSON string of attachments
  onAttachmentsChange?: (attachments: string) => void;
  onTempFilesChange?: (files: File[]) => void; // For new steps without ID
}

export default function VideoLessonEditor({
  lessonTitle,
  videoUrlRu,
  videoUrlEn,
  videoError,
  onVideoUrlRuChange,
  onVideoUrlEnChange,
  onClearUrlRu,
  onClearUrlEn,
  onVideoError,
  content,
  onContentChange,
  stepId,
  attachments,
  onAttachmentsChange,
  onTempFilesChange
}: VideoLessonEditorProps) {
  const [currentAttachments, setCurrentAttachments] = useState<StepAttachment[]>([])
  const [tempFiles, setTempFiles] = useState<File[]>([])
  const [previewLanguage, setPreviewLanguage] = useState<'ru' | 'en'>('ru')

  useEffect(() => {
    if (previewLanguage === 'en' && !videoUrlEn && videoUrlRu) {
      setPreviewLanguage('ru')
      return
    }
    if (previewLanguage === 'ru' && !videoUrlRu && videoUrlEn) {
      setPreviewLanguage('en')
    }
  }, [previewLanguage, videoUrlRu, videoUrlEn])

  // Parse attachments when they change
  useEffect(() => {
    if (attachments) {
      try {
        const parsed = JSON.parse(attachments);
        setCurrentAttachments(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        setCurrentAttachments([]);
      }
    } else {
      setCurrentAttachments([]);
    }
  }, [attachments]);

  const handleFileUpload = async (file: File) => {
    if (stepId) {
      // For existing steps, upload to server immediately
      const result = await apiClient.uploadStepAttachment(stepId.toString(), file);
      
      // Add the new attachment to the list
      const newAttachment: StepAttachment = {
        id: result.attachment_id,
        filename: result.filename,
        file_url: result.file_url,
        file_type: result.file_type,
        file_size: result.file_size,
        uploaded_at: new Date().toISOString()
      };

      const updatedAttachments = [...currentAttachments, newAttachment];
      setCurrentAttachments(updatedAttachments);
      
      // Notify parent component
      if (onAttachmentsChange) {
        onAttachmentsChange(JSON.stringify(updatedAttachments));
      }
    } else {
      // For new steps, store files temporarily
      const updatedTempFiles = [...tempFiles, file];
      setTempFiles(updatedTempFiles);
      
      // Notify parent component about temp files
      if (onTempFilesChange) {
        onTempFilesChange(updatedTempFiles);
      }
    }
  };

  const handleFileDelete = async (attachmentId: number | string) => {
    if (stepId && typeof attachmentId === 'number') {
      // Delete from server for existing steps
      await apiClient.deleteStepAttachment(stepId.toString(), attachmentId);
      
      // Remove the attachment from the list
      const updatedAttachments = currentAttachments.filter(att => att.id !== attachmentId);
      setCurrentAttachments(updatedAttachments);
      
      // Notify parent component
      if (onAttachmentsChange) {
        onAttachmentsChange(JSON.stringify(updatedAttachments));
      }
    } else if (!stepId && typeof attachmentId === 'string') {
      // Remove from temporary files for new steps (using filename as ID)
      const updatedTempFiles = tempFiles.filter(file => file.name !== attachmentId);
      setTempFiles(updatedTempFiles);
      
      // Notify parent component about temp files
      if (onTempFilesChange) {
        onTempFilesChange(updatedTempFiles);
      }
    }
  };

  return (
    <div className="space-y-6">
      {(videoUrlRu || videoUrlEn) && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">
              Video Preview
            </label>
            {videoUrlRu && videoUrlEn && (
              <div className="flex items-center gap-1 rounded-md border border-gray-200 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewLanguage('ru')}
                  className={`px-2 py-1 text-xs rounded ${previewLanguage === 'ru' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  RU
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLanguage('en')}
                  className={`px-2 py-1 text-xs rounded ${previewLanguage === 'en' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  EN
                </button>
              </div>
            )}
          </div>
          <YouTubeVideoPlayer
            url={previewLanguage === 'en' ? videoUrlEn : videoUrlRu}
            title={`${lessonTitle || 'Lesson Video'} (${previewLanguage.toUpperCase()})`}
            className="w-full"
            onError={onVideoError}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Video URL (YouTube, RU)
        </label>
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox 
            id="explanation-mode" 
            checked={content.includes("Watch the explanations for the previous questions")}
            onCheckedChange={(checked) => {
              if (checked === true) {
                if (!content.includes("Watch the explanations for the previous questions")) {
                  onContentChange(`<p><strong>Watch the explanations for the previous questions</strong></p>${content}`);
                }
              } else {
                onContentChange(content.replace(/<p><strong>Watch the explanations for the previous questions<\/strong><\/p>/g, ''));
              }
            }}
          />
          <label 
            htmlFor="explanation-mode" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Add "Watch explanations" text
          </label>
        </div>
        <div className="flex gap-2 p-1">
          <Input
            type="url"
            value={videoUrlRu}
            onChange={(e) => onVideoUrlRuChange(e.target.value)}
            className="flex-1"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <button
            onClick={onClearUrlRu}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
        {videoError && (
          <p className="text-sm text-red-600 mt-1">{videoError}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">
          Paste a YouTube video URL in Russian
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Video URL (YouTube, EN)
        </label>
        <div className="flex gap-2 p-1">
          <Input
            type="url"
            value={videoUrlEn}
            onChange={(e) => onVideoUrlEnChange(e.target.value)}
            className="flex-1"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <button
            type="button"
            onClick={onClearUrlEn}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Paste a YouTube video URL in English
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Video Lesson Content
        </label>
        <RichTextEditor
          value={content}
          onChange={onContentChange}
          placeholder="Add description, notes, or additional content for this video lesson..."
        />
        <p className="text-sm text-gray-500 mt-1">
          Add text content to accompany the video (optional)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          File Attachments
        </label>
        <FileUploadArea
          attachments={stepId ? currentAttachments : tempFiles.map((file, index) => ({
            id: index, // Use index as temporary ID
            filename: file.name,
            file_url: '', // No URL for temp files
            file_type: file.name.split('.').pop() || '',
            file_size: file.size,
            uploaded_at: new Date().toISOString()
          }))}
          onFileUpload={handleFileUpload}
          onFileDelete={handleFileDelete}
          maxFileSize={10}
          allowedTypes={['pdf', 'docx', 'doc', 'jpg', 'png', 'gif', 'webp', 'txt', 'zip', 'xlsx', 'pptx']}
          disabled={false}
          tempMode={!stepId} // Pass temp mode flag
        />
      </div>
    </div>
  );
}


