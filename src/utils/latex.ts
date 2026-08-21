import katex from 'katex';
// CSS is imported in main.tsx

export interface LatexMatch {
  type: 'inline' | 'block';
  start: number;
  end: number;
  content: string;
  latex: string;
}

/**
 * Находит все LaTeX формулы в тексте
 */
export function findLatexFormulas(text: string): LatexMatch[] {
  const matches: LatexMatch[] = [];
  
  // 1. Сначала ищем Block формулы: $$...$$
  // Они имеют приоритет, так как захватывают $$
  const blockRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    matches.push({
      type: 'block',
      start: match.index,
      end: match.index + match[0].length,
      content: match[0],
      latex: match[1]
    });
  }
  
  // 2. Затем ищем Inline формулы: $...$
  const inlineRegex = /\$([^$\n]+?)\$/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    
    // Проверяем, не пересекается ли с уже найденными блочными формулами
    // Это предотвращает дублирование, когда $$...$$ распознается и как блок, и как инлайн
    const isOverlapping = matches.some(m => 
      (start >= m.start && start < m.end) || 
      (end > m.start && end <= m.end)
    );
    
    if (isOverlapping) {
      continue;
    }

    const content = match[1];
    
    // Skip if content is ONLY an escaped dollar sign (like $\$$ which is meant to render as $)
    // But allow valid LaTeX that starts with backslash commands like \begin, \frac, etc.
    if (content === '\\$' || content.startsWith('\\$ ') || content.startsWith('\\$\n')) {
      continue;
    }
    
    // Skip if content is just a number (likely currency like $500$)
    // REMOVED: User wants numbers to be rendered as LaTeX for consistency
    // if (/^\s*\d+\s*$/.test(content)) {
    //   continue;
    // }
    
    // Skip if content contains HTML tags (likely broken match across paragraphs)
    if (/<[^>]+>/.test(content)) {
      continue;
    }
    
    // Skip if content is too long (> 200 chars) - likely not real LaTeX
    if (content.length > 200) {
      continue;
    }
    
    // Skip if content starts with a number followed by space (currency like "$24 coming to me"),
    // but NOT when it contains actual math — e.g. "12 + 11\sqrt{2}" or "2 + 19" are real formulas,
    // not currency. Only bail out when there's no LaTeX command, operator or math syntax.
    if (/^\d+\s/.test(content) && !/[\\+\-=^_{}<>]|\b(sqrt|frac|times|cdot|div|sum|int|pi)\b/.test(content)) {
      continue;
    }
    
    matches.push({
      type: 'inline',
      start: start,
      end: end,
      content: match[0],
      latex: content
    });
  }
  
  // Сортируем по позиции
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Рендерит LaTeX формулу в HTML
 */
export function renderLatex(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000'
    });
  } catch (error) {
    console.error('LaTeX rendering error:', error);
    return `<span style="color: #cc0000;">LaTeX Error: ${latex}</span>`;
  }
}

/**
 * Автоматически оборачивает LaTeX команды в $ делимитеры
 */
export function autoWrapLatex(text: string): string {
  // Type guard: ensure text is a string
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }
  
  // Паттерны LaTeX команд, которые должны быть в математическом режиме
  const latexPatterns = [
    /\\frac\{[^}]*\}\{[^}]*\}/g,  // \frac{a}{b}
    /\\sqrt(?:\[[^\]]*\])?\{[^}]*\}/g,  // \sqrt{x} or \sqrt[n]{x}
    /\\(?:sin|cos|tan|log|ln|exp|lim|sum|int|prod)\b/g,  // математические функции
    /\\(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega|Gamma|Delta|Theta|Lambda|Pi|Sigma|Phi|Omega)\b/g,  // греческие буквы
    /\\(?:pm|mp|times|div|cdot|approx|neq|leq|geq|infty)\b/g,  // операторы
  ];
  
  let result = text;
  
  // Обрабатываем каждый паттерн
  for (const pattern of latexPatterns) {
    // const matches = [...result.matchAll(pattern)];
    // Using exec instead of matchAll for better compatibility
    const matches: RegExpExecArray[] = [];
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(result)) !== null) {
      matches.push(m);
    }
    
    // Обрабатываем совпадения в обратном порядке, чтобы не сбить индексы
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const matchText = match[0];
      const matchStart = match.index!;
      const matchEnd = matchStart + matchText.length;
      
      // Проверяем, не находится ли уже внутри $ $
      const beforeMatch = result.substring(0, matchStart);
      
      // Считаем количество $ до совпадения
      const dollarsBefore = (beforeMatch.match(/\$/g) || []).length;
      
      // Если нечетное количество $, то мы уже внутри формулы
      if (dollarsBefore % 2 === 1) {
        continue;
      }
      
      // Заменяем совпадение на обернутую версию
      result = result.substring(0, matchStart) + `$${matchText}$` + result.substring(matchEnd);
    }
  }
  
  return result;
}

/**
 * Преобразует markdown форматирование в HTML
 */
export function renderMarkdown(text: string): string {
  // Type guard: ensure text is a string
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }
  
  // Protect sequences of underscores (2 or more) from being interpreted as markdown
  // We replace them with a unique placeholder that won't be touched by markdown regex
  // Using a format without underscores to avoid the placeholder itself being processed
  const underscorePlaceholder = 'XUNDERSCOREX';
  let protectedText = text.replace(/_{2,}/g, (match) => {
    return underscorePlaceholder + match.length + underscorePlaceholder;
  });

  // Protect HTML tags from markdown processing
  // This preserves tags from RichTextEditor (like <ul>, <li>, <ol>, <p>, etc.)
  const htmlTagPlaceholder = 'XHTMLTAGX';
  const htmlTags: string[] = [];
  protectedText = protectedText.replace(/<[^>]+>/g, (match) => {
    const index = htmlTags.length;
    htmlTags.push(match);
    return `${htmlTagPlaceholder}${index}${htmlTagPlaceholder}`;
  });

  let processed = protectedText
    // Жирный текст: **text** -> <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Курсив: _text_ -> <em>text</em>
    .replace(/\_(.*?)\_/g, '<em>$1</em>')
    // Альтернативный курсив: *text* -> <em>text</em> (только если не часть **text**)
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
    // Подчеркивание: __text__ -> <u>text</u>
    .replace(/\_\_([^_]+?)\_\_/g, '<u>$1</u>')
    // Зачеркивание: ~~text~~ -> <del>text</del>
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    // Код: `text` -> <code>text</code>
    .replace(/`([^`]+?)`/g, '<code>$1</code>');

  // Restore HTML tags
  processed = processed.replace(new RegExp(`${htmlTagPlaceholder}(\\d+)${htmlTagPlaceholder}`, 'g'), (_, index) => {
    return htmlTags[parseInt(index, 10)];
  });

  // Restore underscores
  processed = processed.replace(new RegExp(`${underscorePlaceholder}(\\d+)${underscorePlaceholder}`, 'g'), (_, length) => {
    return '_'.repeat(parseInt(length, 10));
  });

  return processed;
}

/**
 * Преобразует текст с LaTeX формулами в HTML
 */
export function renderTextWithLatex(text: string): string {
  // Type guard: ensure text is a string
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }
  
  // 1. Сначала автоматически оборачиваем LaTeX команды (если они не обернуты)
  const wrappedText = autoWrapLatex(text);
  
  // 2. Находим все LaTeX формулы
  const matches = findLatexFormulas(wrappedText);
  
  if (matches.length === 0) {
    // Если формул нет, просто рендерим markdown
    return renderMarkdown(wrappedText);
  }
  
  // 3. Заменяем формулы на уникальные плейсхолдеры
  const latexPlaceholder = 'XLATEXFORMULAX';
  const formulas: string[] = [];
  
  // Обрабатываем с конца, чтобы не сбить индексы (хотя здесь мы используем replace по контенту, но лучше быть аккуратным)
  // Но так как мы заменяем в строке, индексы сдвинутся.
  // Проще собрать новую строку.
  
  let result = '';
  let lastIndex = 0;
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    
    // Добавляем текст до формулы
    result += wrappedText.slice(lastIndex, match.start);
    
    // Добавляем плейсхолдер
    result += `${latexPlaceholder}${i}${latexPlaceholder}`;
    
    // Рендерим формулу и сохраняем
    formulas.push(renderLatex(match.latex, match.type === 'block'));
    
    lastIndex = match.end;
  }
  
  // Добавляем оставшийся текст
  result += wrappedText.slice(lastIndex);
  
  // 4. Рендерим markdown в тексте с плейсхолдерами
  const markdownRendered = renderMarkdown(result);
  
  // 5. Восстанавливаем отрендеренные формулы
  const finalResult = markdownRendered.replace(new RegExp(`${latexPlaceholder}(\\d+)${latexPlaceholder}`, 'g'), (_, index) => {
    return formulas[parseInt(index, 10)];
  });
  
  return finalResult;
}

/**
 * Валидирует LaTeX синтаксис
 */
export function validateLatex(latex: string): { isValid: boolean; error?: string } {
  try {
    katex.renderToString(latex, { throwOnError: true });
    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Вставляет LaTeX формулу в текст
 */
export function insertLatexFormula(
  text: string, 
  cursorPosition: number, 
  latex: string, 
  type: 'inline' | 'block' = 'inline'
): { newText: string; newCursorPosition: number } {
  const delimiter = type === 'inline' ? '$' : '$$';
  const formula = `${delimiter}${latex}${delimiter}`;
  
  const newText = text.slice(0, cursorPosition) + formula + text.slice(cursorPosition);
  const newCursorPosition = cursorPosition + formula.length;
  
  return { newText, newCursorPosition };
}

/**
 * Базовые математические символы для toolbar
 */
export const mathSymbols = {
  basic: [
    { symbol: '\\alpha', label: 'α' },
    { symbol: '\\beta', label: 'β' },
    { symbol: '\\gamma', label: 'γ' },
    { symbol: '\\delta', label: 'δ' },
    { symbol: '\\epsilon', label: 'ε' },
    { symbol: '\\theta', label: 'θ' },
    { symbol: '\\lambda', label: 'λ' },
    { symbol: '\\mu', label: 'μ' },
    { symbol: '\\pi', label: 'π' },
    { symbol: '\\sigma', label: 'σ' },
    { symbol: '\\phi', label: 'φ' },
    { symbol: '\\omega', label: 'ω' }
  ],
  operators: [
    { symbol: '\\pm', label: '±' },
    { symbol: '\\mp', label: '∓' },
    { symbol: '\\times', label: '×' },
    { symbol: '\\div', label: '÷' },
    { symbol: '\\cdot', label: '·' },
    { symbol: '\\sqrt{}', label: '√' },
    { symbol: '\\frac{}{}', label: '⁄' },
    { symbol: '\\sum', label: '∑' },
    { symbol: '\\int', label: '∫' },
    { symbol: '\\infty', label: '∞' },
    { symbol: '\\approx', label: '≈' },
    { symbol: '\\neq', label: '≠' },
    { symbol: '\\leq', label: '≤' },
    { symbol: '\\geq', label: '≥' }
  ],
  functions: [
    { symbol: '\\sin', label: 'sin' },
    { symbol: '\\cos', label: 'cos' },
    { symbol: '\\tan', label: 'tan' },
    { symbol: '\\log', label: 'log' },
    { symbol: '\\ln', label: 'ln' },
    { symbol: '\\exp', label: 'exp' }
  ]
};
