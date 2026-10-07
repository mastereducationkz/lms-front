/**
 * One language per role (owner, 2026-10-07): curators and head curators read Russian, everyone
 * else English, all through lib/i18n. This test keeps it that way:
 *
 *  - Russian text may live only in the ru catalog (src/lib/i18n/ru) and the files in
 *    ui-language.allowlist.ts. Anywhere else, add the copy to src/lib/i18n/en/<area>.ts and
 *    ru/<area>.ts and show it with t('<area>.key') or useT().
 *  - No language chosen by a role check, no 'ru-RU', and no toLocale*String() without a locale:
 *    use formatDate / formatTime / formatDateTime / formatNumber from lib/i18n.
 *
 * ui-language.baseline.json is a ratchet for legacy per-module en/ru tables that already follow
 * the locale: a file's count may only go down. After migrating one, refresh it with
 *   UPDATE_UI_LANGUAGE_BASELINE=1 ./node_modules/.bin/vitest run src/test/ui-language.test.ts
 * and list every open finding with UI_LANGUAGE_REPORT=/some/file.txt (same command).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUSSIAN_ALLOWED } from './ui-language.allowlist';
import { scan, type Finding } from './uiLanguageScan';

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_PATH = path.join(__dirname, 'ui-language.baseline.json');

const findings = scan(ROOT);
const readBaseline = (): Record<string, number> => JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

const report = (list: Finding[]) => list.map((f) => `${f.kind.padEnd(10)} ${f.file}:${f.line}  ${f.text}`).join('\n');

const countByFile = (list: Finding[]) =>
  list.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.file]: (acc[f.file] ?? 0) + 1 }), {});

describe('one UI language per role', () => {
  const russian = findings.filter((f) => f.kind === 'cyrillic' && !(f.file in RUSSIAN_ALLOWED));

  // UI_LANGUAGE_REPORT=<file> writes every finding outside the allowlist, one per line.
  if (process.env.UI_LANGUAGE_REPORT) {
    const open = findings.filter((f) => !(f.file in RUSSIAN_ALLOWED) || f.kind === 'ru-RU' || f.kind === 'no-locale');
    fs.writeFileSync(process.env.UI_LANGUAGE_REPORT, `${report(open)}\n`);
  }

  if (process.env.UPDATE_UI_LANGUAGE_BASELINE) {
    const counts = countByFile(russian);
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2)}\n`);
  }

  it('keeps Russian text in the ru catalog (or an allowlisted curator/parsing file)', () => {
    const baseline = readBaseline();
    const counts = countByFile(russian);
    const over = russian.filter((f) => (counts[f.file] ?? 0) > (baseline[f.file] ?? 0));
    expect(over, `Russian text outside the ru catalog:\n${report(over)}`).toEqual([]);
  });

  it('only ever lowers the baseline', () => {
    const counts = countByFile(russian);
    const stale = Object.entries(readBaseline())
      .filter(([file, n]) => (counts[file] ?? 0) < n)
      .map(([file, n]) => `${file}: baseline ${n}, now ${counts[file] ?? 0}`);
    expect(stale, 'lower ui-language.baseline.json (see the comment at the top of this test)').toEqual([]);
  });

  it('never picks the language with a role check', () => {
    const gated = findings.filter((f) => f.kind === 'role-gated' && !(f.file in RUSSIAN_ALLOWED));
    expect(gated, `use useLocale()/t() instead of a role check:\n${report(gated)}`).toEqual([]);
  });

  it("formats dates and numbers through lib/i18n (no 'ru-RU', no browser locale)", () => {
    const formatting = findings.filter((f) => f.kind === 'ru-RU' || f.kind === 'no-locale');
    expect(formatting, `use formatDate/formatTime/formatDateTime/formatNumber:\n${report(formatting)}`).toEqual([]);
  });

  it('lists only allowlisted files that exist and still need it', () => {
    const withRussian = new Set(findings.filter((f) => f.kind !== 'ru-RU' && f.kind !== 'no-locale').map((f) => f.file));
    const stale = Object.keys(RUSSIAN_ALLOWED).filter((file) => !withRussian.has(file));
    expect(stale, 'remove these from ui-language.allowlist.ts').toEqual([]);
  });
});
