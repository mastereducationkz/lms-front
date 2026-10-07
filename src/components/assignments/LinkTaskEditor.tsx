import { useState, useEffect } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/homeworkStaff';

interface LinkTaskEditorProps {
  content: any;
  onContentChange: (content: any) => void;
}

export default function LinkTaskEditor({ content, onContentChange }: LinkTaskEditorProps) {
  const t = useT();
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
        <Label htmlFor="link-url">{t('homeworkStaff.link.url')}</Label>
        <Input
          id="link-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/resource"
        />
      </div>

      <div>
        <Label htmlFor="link-description">{t('homeworkStaff.link.description')}</Label>
        <Textarea
          id="link-description"
          value={linkDescription}
          onChange={(e) => setLinkDescription(e.target.value)}
          placeholder={t('homeworkStaff.link.descriptionPlaceholder')}
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="completion-criteria">{t('homeworkStaff.link.criteria')}</Label>
        <Select
          value={completionCriteria}
          onValueChange={setCompletionCriteria}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="visit">{t('homeworkStaff.link.visit')}</SelectItem>
            <SelectItem value="watch">{t('homeworkStaff.link.watch')}</SelectItem>
            <SelectItem value="read">{t('homeworkStaff.link.read')}</SelectItem>
            <SelectItem value="complete">{t('homeworkStaff.link.complete')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground  mt-1">
          {t('homeworkStaff.link.criteriaHint')}
        </p>
      </div>
    </div>
  );
}
