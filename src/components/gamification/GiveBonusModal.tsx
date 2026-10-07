import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import apiClient from '../../services/api';
import { Loader2, Star, Trophy } from 'lucide-react';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherDesk';

interface GiveBonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: number;
  studentName: string;
  onSuccess: () => void;
  defaultAmount?: number;
}

export function GiveBonusModal({ 
  isOpen, 
  onClose, 
  studentId, 
  studentName,
  onSuccess,
  defaultAmount = 5
}: GiveBonusModalProps) {
  const t = useT();
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [reason, setReason] = useState(() => t('teacherDesk.bonus.defaultReason'));

  // Update amount when defaultAmount changes or modal reopens
  useEffect(() => {
    if (isOpen) {
      setAmount(defaultAmount);
    }
  }, [isOpen, defaultAmount]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.giveTeacherBonus({
        student_id: studentId,
        amount,
        reason
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to give bonus:', err);
      setError(err.response?.data?.detail || t('teacherDesk.bonus.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
            {t('teacherDesk.bonus.title')}
          </DialogTitle>
          <DialogDescription>
            {t('teacherDesk.bonus.description').split(/\{(\w+)\}/).map((part, i) => (i % 2 ? <strong key={i}>{studentName}</strong> : part))}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">{t('teacherDesk.bonus.amount')}</Label>
            <div className="relative">
              <Star className="absolute left-3 top-2.5 h-4 w-4 text-yellow-500 dark:text-yellow-400" />
              <Input
                id="amount"
                type="number"
                min={1}
                max={50}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">{t('teacherDesk.bonus.reason')}</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('teacherDesk.bonus.reasonPlaceholder')}
              required
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 p-2 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-yellow-600 hover:bg-yellow-700 text-white">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('teacherDesk.bonus.awarding')}
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4 fill-current" />
                  {t('teacherDesk.awards.awardPoints')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
