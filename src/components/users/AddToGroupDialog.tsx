import { useState, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import api from '../../services/api';
import { toast } from '../Toast';
import { Button } from '../ui/button';
import { Dialog, DialogContent } from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';

interface AddToGroupDialogProps {
  open: boolean;
  studentIds: number[];
  groups: { id: number; name: string }[];
  onClose: (changed: boolean) => void;
}

/**
 * Bulk-add a set of students to one group. Reusable by admin (groups = all groups)
 * and by curators (groups = own groups); the backend 403-guards foreign groups.
 */
export function AddToGroupDialog({ open, studentIds, groups, onClose }: AddToGroupDialogProps) {
  const [groupId, setGroupId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setGroupId(''); }, [open]);

  const confirm = async () => {
    if (!groupId) return;
    setSaving(true);
    try {
      await api.bulkAddStudentsToGroup(Number(groupId), studentIds);
      const groupName = groups.find((g) => g.id === Number(groupId))?.name || '';
      toast(`${studentIds.length} учеников добавлено в «${groupName}»`, 'success');
      onClose(true);
    } catch (e) {
      console.error('Failed to add students to group', e);
      toast('Не удалось добавить в группу', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(false); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b">
          <h2 className="text-base font-semibold">Добавить в группу</h2>
          <p className="text-xs text-muted-foreground mt-1">Выбрано учеников: {studentIds.length}</p>
        </div>
        <div className="px-5 py-4">
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите группу" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {groups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onClose(false)} disabled={saving}>Отмена</Button>
          <Button size="sm" onClick={confirm} disabled={saving || !groupId}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Добавление</> : <><Check className="w-3.5 h-3.5 mr-1.5" /> Добавить</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
