import React, { useState, useEffect } from 'react';
import RichTextEditor from '../RichTextEditor';
import FileUploadArea from '../FileUploadArea';
import { Checkbox } from '../ui/checkbox';
import apiClient from '../../services/api';
import type { StepAttachment } from '../../types';

export interface TextLessonEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  stepId?: number;
  attachments?: string; // JSON string of attachments
  onAttachmentsChange?: (attachments: string) => void;
  onTempFilesChange?: (files: File[]) => void; // For new steps without ID
}

export default function TextLessonEditor({ 
  content, 
  onContentChange, 
  stepId,
  attachments,
  onAttachmentsChange,
  onTempFilesChange 
}: TextLessonEditorProps) {
  const [currentAttachments, setCurrentAttachments] = useState<StepAttachment[]>([]);
  const [tempFiles, setTempFiles] = useState<File[]>([]);

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
      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-2">
          Lesson Content
        </label>
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox 
            id="explanation-mode" 
            checked={content.includes("Read the explanation and make notes.")}
            onCheckedChange={(checked) => {
              if (checked === true) {
                if (!content.includes("Read the explanation and make notes.")) {
                  onContentChange(`<p><strong>Read the explanation and make notes.</strong></p>${content}`);
                }
              } else {
                onContentChange(content.replace(/<p><strong>Read the explanation and make notes.<\/strong><\/p>/g, ''));
              }
            }}
          />
          <label 
            htmlFor="explanation-mode" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Add "Read explanation" text
          </label>
        </div>
        <RichTextEditor
          value={content}
          onChange={onContentChange}
          placeholder="Start writing lesson content..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-2">
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


