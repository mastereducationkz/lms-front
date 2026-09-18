import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { money } from '../../lib/discipline';
import { checkDecision, decisionPayload, type DecisionDraft } from '../../lib/disciplineDecision';
import type { DisciplineReason } from '../../services/api/discipline';

/**
 * Pricing or waiving one finding.
 *
 * This replaces two `window.prompt` boxes, which asked a head teacher to type «2 перенесли урок»
 * — a reason number and a note in one string — and answered a typo by silently doing nothing.
 * A native prompt cannot show what the rule proposed, cannot list the reasons as anything but
 * text to be counted, and cannot say why it refused. This is money coming off somebody's pay:
 * the decision is worth a form.
 */

export type DecisionTarget = {
  lessonLabel: string;
  kindLabel: string;
  minutes: number | null;
  /** What the rule asked for — null for a miss, which only a person can price. */
  proposed: number | null;
  /** What it currently stands at, if somebody already decided it. */
  current: number | null;
  currentReason: string | null;
  currentNote: string | null;
};

export default function DecisionDialog({
  open, target, reasons, saving, onCancel, onSubmit,
}: {
  open: boolean;
  target: DecisionTarget | null;
  reasons: DisciplineReason[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (amount: number, reasonCode: string | null, note: string | null) => void;
}) {
  const [draft, setDraft] = useState<DecisionDraft>({ amount: '', reasonCode: null, note: '' });
  const [touched, setTouched] = useState(false);

  // Reopening on a different finding must not inherit the last one's answer.
  useEffect(() => {
    if (!open || !target) return;
    setDraft({
      amount: String(target.current ?? target.proposed ?? ''),
      reasonCode: target.currentReason,
      note: target.currentNote || '',
    });
    setTouched(false);
  }, [open, target]);

  if (!target) return null;

  const check = checkDecision(draft, target.proposed);
  const showError = touched && check.error;

  const submit = () => {
    setTouched(true);
    const payload = decisionPayload(draft, target.proposed);
    if (!payload) return;
    onSubmit(payload.amount, payload.reason_code, payload.note);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target.kindLabel}</DialogTitle>
          <DialogDescription>
            {target.lessonLabel}
            {target.minutes !== null && <> · {target.minutes} min</>}
            {/* What the rule asked is stated, not implied: it is the number being departed from. */}
            {target.proposed !== null
              ? <> · the rule asks {money(target.proposed)}</>
              : <> · the rule cannot price a missed lesson</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="decision-amount">Amount, ₸</Label>
            <Input
              id="decision-amount"
              inputMode="numeric"
              autoFocus
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" variant="outline"
                      onClick={() => { setDraft({ ...draft, amount: '0' }); setTouched(true); }}>
                Waive — 0 ₸
              </Button>
              {target.proposed !== null && (
                <Button type="button" size="sm" variant="outline"
                        onClick={() => setDraft({ ...draft, amount: String(target.proposed) })}>
                  Use {money(target.proposed)}
                </Button>
              )}
            </div>
          </div>

          {/* Shown whenever money is coming off, which is exactly when it is required. */}
          {check.needsReason && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Reason</legend>
              <div className="space-y-1">
                {reasons.map((reason) => (
                  <label key={reason.code} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="decision-reason"
                      className="h-4 w-4"
                      checked={draft.reasonCode === reason.code}
                      onChange={() => { setDraft({ ...draft, reasonCode: reason.code }); setTouched(true); }}
                    />
                    <span>{reason.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="decision-note">Note <span className="text-gray-500">(optional)</span></Label>
            <Textarea
              id="decision-note"
              rows={2}
              value={draft.note}
              placeholder="What happened, for whoever reads this later"
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </div>

          {showError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {check.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !check.ready}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
