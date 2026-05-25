import { useState, useEffect } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface LinkTaskEditorProps {
  content: any;
  onContentChange: (content: any) => void;
}

export default function LinkTaskEditor({ content, onContentChange }: LinkTaskEditorProps) {
  const [url, setUrl] = useState(content.url || '');
  const [linkDescription, setLinkDescription] = useState(content.link_description || '');
  const [completionCriteria, setCompletionCriteria] = useState(content.completion_criteria || 'visit');

  useEffect(() => {
    onContentChange({
      url,
      link_description: linkDescription,
      completion_criteria: completionCriteria
    });
  }, [url, linkDescription, completionCriteria]);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="link-url">URL *</Label>
        <Input
          id="link-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/resource"
        />
      </div>

      <div>
        <Label htmlFor="link-description">Description *</Label>
        <Textarea
          id="link-description"
          value={linkDescription}
          onChange={(e) => setLinkDescription(e.target.value)}
          placeholder="Describe what students should do with this link..."
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="completion-criteria">Completion Criteria</Label>
        <Select
          value={completionCriteria}
          onValueChange={setCompletionCriteria}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="visit">Visit the link</SelectItem>
            <SelectItem value="watch">Watch video</SelectItem>
            <SelectItem value="read">Read article</SelectItem>
            <SelectItem value="complete">Complete activity</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          What should students do with this resource?
        </p>
      </div>
    </div>
  );
}
