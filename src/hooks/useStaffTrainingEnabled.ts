import { useEffect, useState } from 'react';
import { getTrainingMe } from '../services/api/staffTraining';

const STAFF_ROLES: ReadonlySet<string> = new Set(['admin', 'teacher', 'head_teacher', 'curator', 'head_curator', 'marketing']);
const FRESH_MS = 5 * 60 * 1000;

let probe: { key: string; at: number; answer: Promise<boolean> } | null = null;

/** Forgets the last answer (a test, or a switch of account). */
export function resetStaffTrainingProbe(): void {
  probe = null;
}

/**
 * Whether staff training is switched on for this person. While the backend answers 404 `staff_training_off`
 * (and on any other failure, since "not sure" must not show a section nobody can use) the answer is false, so
 * the sidebar entry stays hidden and staff see nothing until the owner turns the flag on. The answer is kept for
 * five minutes: every page mounts its own sidebar, and this asks the server only once in that time.
 */
function staffTrainingEnabled(key: string): Promise<boolean> {
  const now = Date.now();
  if (probe && probe.key === key && now - probe.at < FRESH_MS) return probe.answer;
  const answer = getTrainingMe().then(() => true, () => false);
  probe = { key, at: now, answer };
  return answer;
}

export function useStaffTrainingEnabled(userId: string | number | null | undefined, role: string | null | undefined): boolean {
  const eligible = !!userId && !!role && STAFF_ROLES.has(role);
  const key = `${userId}:${role}`;
  const [answer, setAnswer] = useState<{ key: string; on: boolean } | null>(null);

  useEffect(() => {
    if (!eligible) return;
    let live = true;
    staffTrainingEnabled(key).then((on) => {
      if (live) setAnswer({ key, on });
    });
    return () => {
      live = false;
    };
  }, [eligible, key]);

  return eligible && answer?.key === key && answer.on;
}
