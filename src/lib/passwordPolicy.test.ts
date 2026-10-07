import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordPolicyError } from './passwordPolicy';

describe('passwordPolicyError', () => {
  it('accepts 8+ characters with a digit', () => {
    expect(passwordPolicyError('abcdefg1')).toBeNull();
    expect(passwordPolicyError('correct horse 7')).toBeNull();
    expect(passwordPolicyError('a1'.padEnd(PASSWORD_MAX_LENGTH, 'x'))).toBeNull();
  });

  it('rejects short passwords (the old 6-character minimum no longer passes)', () => {
    expect(passwordPolicyError('')).toMatch(/at least 8/);
    expect(passwordPolicyError('abc123')).toMatch(/at least 8/);
    expect(passwordPolicyError('abcde12')).toMatch(/at least 8/);
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('rejects passwords over 128 characters, counting an emoji once', () => {
    expect(passwordPolicyError('a1'.padEnd(PASSWORD_MAX_LENGTH + 1, 'x'))).toMatch(/at most 128/);
    expect(passwordPolicyError('1' + '😀'.repeat(PASSWORD_MAX_LENGTH - 1))).toBeNull();
  });

  it('rejects whitespace-only and digit-free passwords', () => {
    expect(passwordPolicyError('          ')).toMatch(/only spaces/);
    expect(passwordPolicyError('abcdefghij')).toMatch(/digit/);
  });
});
