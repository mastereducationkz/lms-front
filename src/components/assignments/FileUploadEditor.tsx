import { useState, useEffect } from 'react';
import { FileText, Trash2, Plus, X } from 'lucide-react';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface FileUploadEditorProps {
  content: any;
  onContentChange: (content: any) => void;
}

export default function FileUploadEditor({ content, onContentChange }: FileUploadEditorProps) {
  const [question, setQuestion] = useState(content.question || '');
  const [allowedTypes, setAllowedTypes] = useState(content.allowed_file_types || ['pdf', 'docx']);
  const [maxSize, setMaxSize] = useState(content.max_file_size_mb || 10);
  const [teacherFile, setTeacherFile] = useState<File | null>(content.teacher_file || null);
  const [teacherFileName, setTeacherFileName] = useState(content.teacher_file_name || '');

  useEffect(() => {
    if (content.question && !question) setQuestion(content.question);
    if (content.allowed_file_types && content.allowed_file_types.length > 0 && allowedTypes.length === 2 && allowedTypes.includes('pdf')) {
       // Only update if current is default
       setAllowedTypes(content.allowed_file_types);
    }
    if (content.max_file_size_mb && maxSize === 10) setMaxSize(content.max_file_size_mb);
    if (content.teacher_file_name && !teacherFileName) setTeacherFileName(content.teacher_file_name);
  }, [content]);

  useEffect(() => {
    onContentChange({
      question,
      allowed_file_types: allowedTypes,
      max_file_size_mb: maxSize,
      teacher_file: teacherFile,
      teacher_file_name: teacherFileName,
      answer_fields: content.answer_fields || []
    });
  }, [question, allowedTypes, maxSize, teacherFile, teacherFileName]);

  const fileTypes = [
    { value: 'pdf', label: 'PDF' },
    { value: 'docx', label: 'DOCX' },
    { value: 'doc', label: 'DOC' },
    { value: 'jpg', label: 'JPG' },
    { value: 'png', label: 'PNG' },
    { value: 'gif', label: 'GIF' },
    { value: 'txt', label: 'TXT' }
  ];

  const toggleFileType = (type: string) => {
    if (allowedTypes.includes(type)) {
      setAllowedTypes(allowedTypes.filter((t: string) => t !== type));
    } else {
      setAllowedTypes([...allowedTypes, type]);
    }
  };

  const handleTeacherFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setTeacherFile(file);
      setTeacherFileName(file.name);
    }
  };

  const removeTeacherFile = () => {
    setTeacherFile(null);
    setTeacherFileName('');
  };

  const uniqueId = `teacher-file-${Math.random().toString(36).substr(2, 9)}`;

  // Answer Fields for Auto-Check
  const answerFields = content.answer_fields || [];

  const addAnswerField = () => {
    const newField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `${answerFields.length + 1}`,
      correct_answer: ''
    };
    onContentChange({
      ...content,
      question,
      allowed_file_types: allowedTypes,
      max_file_size_mb: maxSize,
      teacher_file: teacherFile,
      teacher_file_name: teacherFileName,
      answer_fields: [...answerFields, newField]
    });
  };

  const updateAnswerField = (index: number, field: 'label' | 'correct_answer', value: string) => {
    const updatedFields = [...answerFields];
    updatedFields[index] = {
      ...updatedFields[index],
      [field]: value
    };
    onContentChange({
      ...content,
      question,
      allowed_file_types: allowedTypes,
      max_file_size_mb: maxSize,
      teacher_file: teacherFile,
      teacher_file_name: teacherFileName,
      answer_fields: updatedFields
    });
  };

  const removeAnswerField = (index: number) => {
    const updatedFields = answerFields.filter((_: any, i: number) => i !== index);
    onContentChange({
      ...content,
      question,
      allowed_file_types: allowedTypes,
      max_file_size_mb: maxSize,
      teacher_file: teacherFile,
      teacher_file_name: teacherFileName,
      answer_fields: updatedFields
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="file-question">Question/Instructions *</Label>
        <Textarea
          id="file-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter instructions for the file upload..."
          rows={3}
        />
      </div>

      <div>
        <Label className="mb-2">Teacher's Reference File (Optional)</Label>
        <div className="space-y-2">
          {content.teacher_file_url ? (
            // Display existing uploaded file
            <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 flex-1">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-300">{content.teacher_file_name || 'Reference File'}</span>
                  <a 
                    href={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + content.teacher_file_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View/Download File
                  </a>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onContentChange({
                    ...content,
                    teacher_file_url: null,
                    teacher_file_name: null,
                    teacher_file: null
                  });
                }}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : teacherFile ? (
            // Display newly selected file (not yet uploaded)
            <div className="flex items-center justify-between p-3 border dark:border-border rounded-lg bg-gray-50 dark:bg-secondary">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-foreground">{teacherFileName}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({(teacherFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeTeacherFile}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            // No file selected - show upload area
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input
                type="file"
                id={uniqueId}
                onChange={handleTeacherFileUpload}
                className="hidden"
                accept={fileTypes.map(type => `.${type.value}`).join(',')}
              />
              <label htmlFor={uniqueId} className="cursor-pointer">
                <div className="flex flex-col items-center space-y-2">
                  <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  <div>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                      Click to upload reference file
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Supported: {fileTypes.map(type => type.label).join(', ')}
                    </p>
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-2">Allowed File Types for Students</Label>
        <div className="grid grid-cols-2 gap-2">
          {fileTypes.map(type => (
            <div key={type.value} className="flex items-center space-x-2">
              <Checkbox
                checked={allowedTypes.includes(type.value)}
                onCheckedChange={() => toggleFileType(type.value)}
              />
              <Label className="text-sm">{type.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="file-max-size">Maximum File Size (MB)</Label>
        <Input
          id="file-max-size"
          type="number"
          value={maxSize}
          onChange={(e) => setMaxSize(parseInt(e.target.value) || 10)}
          min="1"
          max="100"
        />
      </div>

      {/* Answer Fields for Auto-Check */}
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-semibold">Answer Fields (Auto-Check)</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Students will enter answers; system will auto-check them.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAnswerField}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Field
          </Button>
        </div>

        {answerFields.length > 0 && (
          <div className="space-y-2">
            {answerFields.map((field: any, index: number) => (
              <div key={field.id} className="flex items-center gap-2">
                <span className="text-base font-semibold text-gray-700 dark:text-gray-300 min-w-[24px]">{index + 1}.</span>
                <Input
                  type="text"
                  value={field.correct_answer}
                  onChange={(e) => {
                    updateAnswerField(index, 'correct_answer', e.target.value);
                    // Auto-update label to match index
                    if (field.label !== `${index + 1}`) {
                      updateAnswerField(index, 'label', `${index + 1}`);
                    }
                  }}
                  placeholder="Enter correct answer..."
                  className="text-sm font-mono flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAnswerField(index)}
                  className="h-9 w-9 p-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {answerFields.length === 0 && (
          <div className="text-center py-6 bg-gray-50 dark:bg-secondary border border-dashed dark:border-border rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">No answer fields added yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click "Add Field" to create an answer field</p>
          </div>
        )}
      </div>
    </div>
  );
}
