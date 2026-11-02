import { describe, expect, it } from 'vitest';
import {
  buildView, edgeIndex, foldText, moveIndex, optionMatches, searchWords, shouldSearch, typeAheadIndex,
  type DropdownEntry, type DropdownOption,
} from './logic';

const opt = (value: string, text = value, extra: Partial<DropdownOption> = {}): DropdownOption =>
  ({ kind: 'option', key: value, value, label: text, text, ...extra });

describe('foldText', () => {
  it('lower-cases and folds ё and the Kazakh letters', () => {
    expect(foldText('Ёлка')).toBe('елка');
    expect(foldText('ӘҒҚҢӨҰҮҺІ')).toBe('агкноуухи');
    expect(foldText('Әсем Құрманғали')).toBe('асем курмангали');
  });
  it('leaves Latin and Cyrillic as typed', () => {
    expect(foldText('SAT Math')).toBe('sat math');
    expect(foldText('Алия')).toBe('алия');
  });
});

describe('optionMatches', () => {
  it('needs every word, anywhere in label, keywords or group', () => {
    const o = opt('1', 'August 19 SAT - Gulzada', { keywords: 'teacher' });
    expect(optionMatches(o, searchWords('aug gulz'))).toBe(true);
    expect(optionMatches(o, searchWords('gulz teacher'))).toBe(true);
    expect(optionMatches(o, searchWords('gulz math'))).toBe(false);
    expect(optionMatches(o, searchWords('gulz math'), 'Math groups')).toBe(true);
  });
  it('matches folded letters both ways', () => {
    const o = opt('1', 'Әсем Қайрат');
    expect(optionMatches(o, searchWords('асем'))).toBe(true);
    expect(optionMatches(o, searchWords('ӘСЕМ қай'))).toBe(true);
    expect(optionMatches(opt('2', 'Артём'), searchWords('артем'))).toBe(true);
  });
  it('an empty query matches everything', () => {
    expect(optionMatches(opt('1'), searchWords('   '))).toBe(true);
  });
});

describe('shouldSearch', () => {
  it('shows the search box from 6 listed options; hidden ones do not count', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((v) => opt(v));
    expect(shouldSearch(five)).toBe(false);
    expect(shouldSearch([...five, opt('f')])).toBe(true);
    expect(shouldSearch([...five, opt('f', 'f', { hidden: true })])).toBe(false);
  });
});

describe('buildView', () => {
  const entries: DropdownEntry[] = [
    opt('', 'All'),
    { kind: 'separator', key: 's1' },
    { kind: 'group', key: 'g1', label: 'Math', text: 'Math' },
    opt('m1', 'Algebra', { group: 'g1' }),
    opt('m2', 'Geometry', { group: 'g1' }),
    { kind: 'separator', key: 's2' },
    { kind: 'group', key: 'g2', label: 'English', text: 'English' },
    opt('e1', 'Reading', { group: 'g2' }),
    opt('e2', 'Hidden', { group: 'g2', hidden: true }),
    { kind: 'separator', key: 's3' },
  ];

  it('without a query: every listed option, groups and inner separators, no trailing separator', () => {
    const view = buildView(entries, '');
    expect(view.rows.map((r) => (r.kind === 'option' ? r.option.value : `${r.kind}:${r.key}`))).toEqual([
      '', 'separator:s1', 'group:g1', 'm1', 'm2', 'separator:s2', 'group:g2', 'e1',
    ]);
    expect(view.options.map((o) => o.value)).toEqual(['', 'm1', 'm2', 'e1']);
    expect(view.capped).toBe(false);
  });

  it('with a query: no separators, only groups that still have a row', () => {
    const view = buildView(entries, 'geo');
    expect(view.rows.map((r) => (r.kind === 'option' ? r.option.value : `${r.kind}:${r.key}`))).toEqual(['group:g1', 'm2']);
  });

  it('a group label matches its rows', () => {
    expect(buildView(entries, 'english').options.map((o) => o.value)).toEqual(['e1']);
  });

  it('no leading separator', () => {
    const view = buildView([{ kind: 'separator', key: 's' }, opt('a')], '');
    expect(view.rows.map((r) => r.kind)).toEqual(['option']);
  });

  it('caps the rows and says so', () => {
    const many = Array.from({ length: 450 }, (_, i) => opt(String(i), `Student ${i}`));
    const view = buildView(many, '');
    expect(view.options).toHaveLength(300);
    expect(view.matched).toBe(450);
    expect(view.capped).toBe(true);
    const narrowed = buildView(many, 'student 44');
    expect(narrowed.capped).toBe(false);
    expect(narrowed.options.map((o) => o.value)).toEqual(['44', '144', '244', '344', '440', '441', '442', '443', '444', '445', '446', '447', '448', '449']);
  });
});

describe('keyboard moves', () => {
  const list = [opt('a', 'a', { disabled: true }), opt('b'), opt('c', 'c', { disabled: true }), opt('d'), opt('e', 'e', { disabled: true })];

  it('edges skip disabled rows', () => {
    expect(edgeIndex(list, 'first')).toBe(1);
    expect(edgeIndex(list, 'last')).toBe(3);
    expect(edgeIndex([opt('x', 'x', { disabled: true })], 'first')).toBe(-1);
  });

  it('arrows skip disabled rows and do not wrap', () => {
    expect(moveIndex(list, 1, 1)).toBe(3);
    expect(moveIndex(list, 3, 1)).toBe(3);
    expect(moveIndex(list, 3, -1)).toBe(1);
    expect(moveIndex(list, 1, -1)).toBe(1);
  });

  it('from nowhere, down starts at the top and up at the bottom', () => {
    expect(moveIndex(list, -1, 1)).toBe(1);
    expect(moveIndex(list, -1, -1)).toBe(3);
  });

  it('page moves land on the nearest pickable row', () => {
    const long = Array.from({ length: 20 }, (_, i) => opt(String(i), String(i), { disabled: i === 8 || i === 19 }));
    expect(moveIndex(long, 0, 8)).toBe(9);
    expect(moveIndex(long, 15, 8)).toBe(18);
    expect(moveIndex(long, 10, -8)).toBe(2);
    expect(moveIndex(long, 3, -8)).toBe(0);
  });

  it('nothing pickable: -1', () => {
    expect(moveIndex([opt('x', 'x', { disabled: true })], -1, 1)).toBe(-1);
  });
});

describe('typeAheadIndex', () => {
  const list = ['Apple', 'Banana', 'Blueberry', 'Cherry', 'Bread'].map((t) => opt(t));

  it('jumps to the next row starting with the letter, cycling', () => {
    expect(typeAheadIndex(list, 'b', 0)).toBe(1);
    expect(typeAheadIndex(list, 'b', 1)).toBe(2);
    expect(typeAheadIndex(list, 'b', 2)).toBe(4);
    expect(typeAheadIndex(list, 'b', 4)).toBe(1);
  });

  it('a longer prefix may stay on the current row', () => {
    expect(typeAheadIndex(list, 'bl', 2)).toBe(2);
    expect(typeAheadIndex(list, 'br', 1)).toBe(4);
  });

  it('a repeated letter cycles like one letter', () => {
    expect(typeAheadIndex(list, 'bb', 1)).toBe(2);
  });

  it('skips disabled rows, folds letters, -1 when nothing starts so', () => {
    const rows = [opt('1', 'Ёж', { disabled: true }), opt('2', 'Ель'), opt('3', 'Әлем')];
    expect(typeAheadIndex(rows, 'е', -1)).toBe(1);
    expect(typeAheadIndex(rows, 'а', -1)).toBe(2);
    expect(typeAheadIndex(rows, 'z', 0)).toBe(-1);
  });
});
