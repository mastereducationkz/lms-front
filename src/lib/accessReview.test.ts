import { describe, expect, it } from 'vitest';
import { filterRows, offboardingStarted, rowActions, rowState, storedContacts, uncheckedSources } from './accessReview';
import type { AccessReviewRow } from '../services/api/accessReview';

const row = (patch: Partial<AccessReviewRow>): AccessReviewRow => ({
  id: 41, system: 'zitadel', category: 'orphan',
  account: { key: '2884512', id: '2884512', email: 'old.teacher@mastereducation.kz', name: 'Old Teacher', role: null, is_active: true, last_seen: null },
  person: { lms_user_id: 812, crm_user_id: null, name: 'Old Teacher' }, why: 'Active in Zitadel, but their LMS account is inactive',
  offboard_target: { lms_user_id: 812, crm_user_id: null }, offboarding: null, decision: null, keep: null, previous_keep: null, contacts: null,
  ...patch,
});

describe('access review rows', () => {
  it('offers keep or offboard on an open row, by hand when nobody owns the account', () => {
    expect(rowActions(row({}))).toEqual(['keep', 'offboard']);
    expect(rowActions(row({ offboard_target: null, person: null }))).toEqual(['keep', 'by_hand']);
  });

  it('offers undo on a kept row, nothing once offboarding started', () => {
    expect(rowActions(row({ decision: 'keep', keep: { reason: 'developer', at: '', by: null } }))).toEqual(['unkeep']);
    expect(rowActions(row({ offboarding: { record_id: 9, status: 'pending' } }))).toEqual([]);
    expect(rowActions(row({ offboarding: { record_id: 9, status: 'cancelled' } }))).toEqual(['keep', 'offboard']);
  });

  it('treats an «active after offboarding» row as open: its completed record is why it is listed', () => {
    const after = row({ system: 'lms', category: 'active_after_offboarding', offboarding: { record_id: 9, status: 'completed' } });
    expect(offboardingStarted(after)).toBe(false);
    expect(rowState(after)).toBe('open');
    expect(rowActions(after)).toEqual(['keep', 'offboard']);
    expect(offboardingStarted(row({ offboarding: { record_id: 9, status: 'completed' } }))).toBe(true);
  });

  it('offers only clearing on a contacts row, until it is cleared', () => {
    const contacts = { last_day: '2023-05-31', last_day_source: 'offboarding' as const, personal_email: true, avatar: false, telegram: true };
    expect(rowActions(row({ system: 'lms', category: 'contacts_due', contacts }))).toEqual(['clear_contacts']);
    expect(rowActions(row({ system: 'lms', category: 'contacts_due', contacts, decision: 'contacts_cleared' }))).toEqual([]);
  });

  it('files rows under open, kept and done', () => {
    const rows = [
      row({ id: 1 }),
      row({ id: 2, decision: 'keep', keep: { reason: 'dev', at: '', by: null } }),
      row({ id: 3, offboarding: { record_id: 9, status: 'pending' } }),
      row({ id: 4, category: 'contacts_due', decision: 'contacts_cleared' }),
    ];
    expect(filterRows(rows, 'open').map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, 'kept').map((r) => r.id)).toEqual([2]);
    expect(filterRows(rows, 'done').map((r) => r.id)).toEqual([3, 4]);
    expect(filterRows(rows, 'all')).toHaveLength(4);
  });
});

describe('review sources', () => {
  it('lists the systems that were not checked, in a fixed order', () => {
    const sources = {
      workspace: { checked: true, accounts: 58, error: null },
      sat: { checked: false, accounts: 0, error: 'SAT not checked: HTTP 503' },
      ielts: { checked: false, accounts: 0, error: 'IELTS not checked: no staff list endpoint yet' },
      lms: { checked: true, accounts: 64, error: null },
    };
    expect(uncheckedSources({ sources }).map((s) => s.system)).toEqual(['ielts', 'sat']);
    expect(uncheckedSources({ sources: {} })).toEqual([]);
  });
});

describe('contact details still stored', () => {
  const contacts = { last_day: '2023-05-31', last_day_source: 'offboarding' as const, personal_email: true, avatar: false, telegram: true };

  it('lists the LMS kinds, and the CRM kinds when the CRM was asked', () => {
    expect(storedContacts({ ...contacts, crm: { phone: true, telegram: false, personal_email: false, other_text: true } }))
      .toEqual({ lms: ['personal_email', 'telegram'], crm: ['phone', 'other_text'] });
    expect(storedContacts({ ...contacts, crm: null })).toEqual({ lms: ['personal_email', 'telegram'], crm: [] });
    expect(storedContacts(contacts).crm).toEqual([]);
  });
});
