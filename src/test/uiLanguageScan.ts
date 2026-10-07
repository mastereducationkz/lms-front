/**
 * The scanner behind ui-language.test.ts: walks src/ with the TypeScript parser (so comments
 * never count) and reports what would show a user the wrong language.
 *
 *   cyrillic    Russian text in a string, template or JSX text outside the ru catalog
 *   role-gated  Russian text picked by a role check (`isCurator ? 'Курсы' : 'Courses'`) instead of
 *               by the locale — the language rule lives in lib/i18n only
 *   ru-RU       a hard-coded Russian Intl locale
 *   no-locale   toLocale*String() / Intl formatters with no locale, which follow the browser
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type FindingKind = 'cyrillic' | 'role-gated' | 'ru-RU' | 'no-locale';

export interface Finding {
  file: string; // relative to the repo root, e.g. src/pages/SettingsPage.tsx
  line: number;
  kind: FindingKind;
  text: string;
}

const CYRILLIC = /[Ѐ-ӿ]/;
const ROLE_CHECK = /\b(role|isCurator|isHeadCurator|isTeacher|isAdmin|isStudent|isParent|curator|head_curator)\b/;
const LOCALE_CALLS = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']);
const INTL_FORMATTERS = new Set(['DateTimeFormat', 'NumberFormat', 'RelativeTimeFormat', 'PluralRules', 'ListFormat']);
const SKIP_DIRS = new Set(['__tests__', 'test', 'tests', '__mocks__']);

/** Where the translation layer lives: its catalogs and helpers are allowed everything. */
export const I18N_DIR = 'src/lib/i18n/';

export function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        out.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  walk(path.join(root, 'src'));
  return out.sort();
}

/** A Russian literal chosen by a role check rather than by the locale. */
function roleGated(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n && !ts.isFunctionLike(n) && !ts.isSourceFile(n); n = n.parent) {
    if (ts.isConditionalExpression(n) && ROLE_CHECK.test(n.condition.getText())) return true;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && ROLE_CHECK.test(n.left.getText())) return true;
  }
  return false;
}

function isLocaleless(args: ts.NodeArray<ts.Expression> | undefined): boolean {
  if (!args || args.length === 0) return true;
  const first = args[0];
  return first.getText() === 'undefined' || (ts.isArrayLiteralExpression(first) && first.elements.length === 0);
}

const isRussianTag = (e: ts.Expression | undefined): boolean =>
  !!e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && /^ru(-|$)/i.test(e.text);

export function scanFile(root: string, file: string): Finding[] {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings: Finding[] = [];
  const add = (node: ts.Node, kind: FindingKind, value: string) => {
    findings.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, kind, text: value.replace(/\s+/g, ' ').trim().slice(0, 80) });
  };

  const visit = (node: ts.Node) => {
    let value: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) value = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) value = node.text;
    else if (ts.isJsxText(node)) value = node.text;
    if (value !== null && CYRILLIC.test(value) && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent)) {
      add(node, roleGated(node) ? 'role-gated' : 'cyrillic', value);
    }

    if (ts.isStringLiteral(node) && node.text === 'ru-RU') add(node, 'ru-RU', node.text);

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text;
      if (LOCALE_CALLS.has(name)) {
        if (isLocaleless(node.arguments)) add(node, 'no-locale', node.getText());
        else if (isRussianTag(node.arguments[0]) && node.arguments[0].getText().slice(1, -1) !== 'ru-RU') add(node, 'ru-RU', node.getText());
      }
    }
    if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText() === 'Intl' && INTL_FORMATTERS.has(node.expression.name.text)) {
      if (isLocaleless(node.arguments)) add(node, 'no-locale', node.getText().slice(0, 80));
      else if (isRussianTag(node.arguments?.[0]) && node.arguments![0].getText().slice(1, -1) !== 'ru-RU') add(node, 'ru-RU', node.getText().slice(0, 80));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

export function scan(root: string): Finding[] {
  return sourceFiles(root).filter((f) => !f.startsWith(I18N_DIR)).flatMap((f) => scanFile(root, f));
}
