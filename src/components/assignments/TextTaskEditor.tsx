import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface TextTaskEditorProps {
  content: any;
  onContentChange: (content: any) => void;
}

export default function TextTaskEditor({ content, onContentChange }: TextTaskEditorProps) {
  const [question, setQuestion] = useState(content.question || '');
  const [maxLength, setMaxLength] = useState(content.max_length || 1000);
  const [keywords, setKeywords] = useState(content.keywords?.join(', ') || '');

  useEffect(() => {
    onContentChange({
      question,
      max_length: maxLength,
      keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [],
      answer_fields: content.answer_fields || []
    });
  }, [question, maxLength, keywords]);

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
      max_length: maxLength,
      keywords: keywords ? keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k) : [],
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
      max_length: maxLength,
      keywords: keywords ? keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k) : [],
      answer_fields: updatedFields
    });
  };

  const removeAnswerField = (index: number) => {
    const updatedFields = answerFields.filter((_: any, i: number) => i !== index);
    onContentChange({
      ...content,
      question,
      max_length: maxLength,
      keywords: keywords ? keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k) : [],
      answer_fields: updatedFields
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text-question">Question/Prompt *</Label>
        <Textarea
          id="text-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter the question or prompt for the text response..."
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="max-length">Maximum Length (characters)</Label>
          <Input
            id="max-length"
            type="number"
            value={maxLength}
            onChange={(e) => setMaxLength(parseInt(e.target.value) || 1000)}
            min="100"
            max="10000"
          />
        </div>

        <div>
          <Label htmlFor="keywords">Keywords for Auto-Grading (Optional)</Label>
          <Input
            id="keywords"
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="keyword1, keyword2, keyword3"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comma-separated keywords to check in the answer</p>
        </div>
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
