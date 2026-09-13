import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import apiClient from '../../services/api';

type Resource = { id: string; kind: 'text' | 'file'; body?: string; file?: File; file_url?: string; file_name?: string };
type AnswerKey = { id: string; title: string; release_policy: 'immediate' | 'after_submission' | 'after_due_date' | 'manual'; resources: Resource[] };

export function AnswerKeyEditor({ answerKeys = [], onChange, assignmentId, taskId }: { answerKeys?: AnswerKey[]; onChange: (keys: AnswerKey[]) => void; assignmentId?: string; taskId?: string }) {
  const update = (index: number, value: Partial<AnswerKey>) => onChange(answerKeys.map((key, i) => i === index ? { ...key, ...value } : key));
  const add = () => onChange([...answerKeys, {
    id: `answer_key_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: 'Answer key', release_policy: 'after_submission', resources: [],
  }]);
  return <section className="mt-5 border-t pt-4 space-y-3">
    <div className="flex items-center justify-between"><div><Label className="font-semibold">Answer keys / worked examples</Label><p className="text-xs text-muted-foreground mt-1">These are support materials, not separate student tasks or points.</p></div><Button type="button" variant="outline" size="sm" onClick={add}><Plus className="w-4 h-4 mr-1" />Add answer key</Button></div>
    {answerKeys.map((key, index) => <div key={key.id} className="rounded-md border p-3 space-y-3 bg-muted/20">
      <div className="flex gap-2"><Input value={key.title} onChange={e => update(index, { title: e.target.value })} aria-label="Answer key title" /><select value={key.release_policy} onChange={e => update(index, { release_policy: e.target.value as AnswerKey['release_policy'] })} className="rounded-md border bg-background px-2 text-sm"><option value="immediate">Immediately</option><option value="after_submission">After submission</option><option value="after_due_date">After due date</option><option value="manual">Manual release</option></select>{assignmentId && taskId && key.release_policy === 'manual' && <Button type="button" size="sm" onClick={() => apiClient.releaseAnswerKey(assignmentId, taskId, key.id)}>Release now</Button>}<Button type="button" variant="ghost" size="icon" onClick={() => onChange(answerKeys.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>
      {key.resources.map((resource, resourceIndex) => <div key={resource.id} className="flex gap-2"><Textarea value={resource.body || ''} onChange={e => update(index, { resources: key.resources.map((item, i) => i === resourceIndex ? { ...item, body: e.target.value } : item) })} placeholder="Explanation or worked solution" rows={2} /><Button type="button" variant="ghost" size="icon" onClick={() => update(index, { resources: key.resources.filter((_, i) => i !== resourceIndex) })}><Trash2 className="w-4 h-4" /></Button></div>)}
      <div className="flex gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => update(index, { resources: [...key.resources, { id: `resource_${Date.now()}_${Math.random().toString(36).slice(2)}`, kind: 'text', body: '' }] })}><Plus className="w-3 h-3 mr-1" />Add explanation</Button><label className="inline-flex"><input className="hidden" type="file" onChange={e => { const file = e.target.files?.[0]; if (file) update(index, { resources: [...key.resources, { id: `resource_${Date.now()}_${Math.random().toString(36).slice(2)}`, kind: 'file', file, file_name: file.name }] }); }} /><span className="inline-flex h-8 items-center rounded-md border px-3 text-xs cursor-pointer">Add file</span></label></div>
    </div>)}
  </section>;
}
