import { describe, expect, it } from 'vitest';
import trainingKeys from './training-tip-keys.json';
import { TIPS } from './tips';

/**
 * The staff-training copy marks every one-time tip as already dismissed so no card covers a recorded frame
 * (lms-backend `src/training_copy/quiet.py::TIP_KEYS`). A tip added here and missing there would pop up over the
 * clips, so this fails until `training-tip-keys.json` (the same list as `TIP_KEYS`) has it.
 */
describe('one-time tips and the training copy', () => {
  it('lists every tip key in training-tip-keys.json', () => {
    const keys = [...new Set(TIPS.map((tip) => tip.key))].sort();
    expect(
      [...trainingKeys].sort(),
      'Add the new tip key to src/components/guide/training-tip-keys.json AND to TIP_KEYS in lms-backend src/training_copy/quiet.py',
    ).toEqual(keys);
  });
});
