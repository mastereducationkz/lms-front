import { describe, expect, it } from 'vitest';

import { checkDecision, decisionPayload, parseAmount, type DecisionDraft } from './disciplineDecision';

const draft = (over: Partial<DecisionDraft> = {}): DecisionDraft => ({
  amount: '', reasonCode: null, note: '', ...over,
});

describe('the amount a head teacher types', () => {
  it('reads a spaced figure the way it is written on screen', () => {
    expect(parseAmount('1 400')).toBe(1400);
    expect(parseAmount('1400')).toBe(1400);
    expect(parseAmount('0')).toBe(0);
  });

  it('refuses anything that is not whole tenge', () => {
    expect(parseAmount('-200')).toBeNull();
    expect(parseAmount('1.5')).toBeNull();
    expect(parseAmount('шесть')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('says what is wrong instead of silently doing nothing', () => {
    // The native prompt's failure mode: a typo just closed the box and nothing happened.
    expect(checkDecision(draft({ amount: '' }), 600).error).toBe('Enter an amount');
    expect(checkDecision(draft({ amount: '-5' }), 600).error).toBe('Only whole tenge, digits alone');
  });
});

describe('lowering what the rule asked', () => {
  it('needs a reason, because somebody will ask why months later', () => {
    const lowered = checkDecision(draft({ amount: '0' }), 600);
    expect(lowered.needsReason).toBe(true);
    expect(lowered.ready).toBe(false);
    expect(lowered.error).toBe('Choose a reason for lowering it');
  });

  it('is ready once the reason is given', () => {
    const waived = checkDecision(draft({ amount: '0', reasonCode: 'moved' }), 600);
    expect(waived.ready).toBe(true);
    expect(waived.error).toBeNull();
  });

  it('does not ask for one when the rule is simply confirmed', () => {
    const confirmed = checkDecision(draft({ amount: '600' }), 600);
    expect(confirmed.needsReason).toBe(false);
    expect(confirmed.ready).toBe(true);
  });

  it('does not ask for one when the amount is raised', () => {
    expect(checkDecision(draft({ amount: '800' }), 600).needsReason).toBe(false);
  });

  it('does not ask for one when pricing a miss, which the rule never priced', () => {
    const priced = checkDecision(draft({ amount: '2000' }), null);
    expect(priced.needsReason).toBe(false);
    expect(priced.ready).toBe(true);
  });
});

describe('what reaches the API', () => {
  it('sends the amount, the reason and a trimmed note', () => {
    expect(decisionPayload(draft({ amount: '1 400', reasonCode: 'technical', note: '  свет  ' }), 1400))
      .toEqual({ amount: 1400, reason_code: 'technical', note: 'свет' });
  });

  it('sends null rather than an empty note', () => {
    expect(decisionPayload(draft({ amount: '600' }), 600))
      .toEqual({ amount: 600, reason_code: null, note: null });
  });

  it('refuses to build anything from an incomplete decision', () => {
    expect(decisionPayload(draft({ amount: '0' }), 600)).toBeNull();
    expect(decisionPayload(draft({ amount: 'abc' }), 600)).toBeNull();
  });
});
