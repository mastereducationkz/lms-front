export type HighlightColor = 'yellow' | 'pink' | 'blue';

export interface TextHighlight {
  text: string;
  color: HighlightColor;
}

export const getHighlightClassByColor = (color: HighlightColor): string => {
  if (color === 'pink') return 'bg-pink-200 dark:bg-pink-700/60';
  if (color === 'blue') return 'bg-sky-200 dark:bg-sky-700/60';
  return 'bg-amber-200 dark:bg-amber-700/60';
};

export const removeHighlightsFromDOM = (root: HTMLElement) => {
  const marks = root.querySelectorAll('mark[data-highlight-text]');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    }
  });
  root.normalize(); // Merge adjacent text nodes back together
};

export const applyHighlightsToDOM = (root: HTMLElement, highlights: TextHighlight[], questionId?: string) => {
  removeHighlightsFromDOM(root);

  if (highlights.length === 0) return;

  const uniqueHighlights = highlights
    .map((value) => ({ text: value.text.replace(/\s+/g, ' ').trim(), color: value.color }))
    .filter((value) => value.text.length >= 2)
    .sort((a, b) => b.text.length - a.text.length);

  uniqueHighlights.forEach((highlight) => {
    const loweredHighlight = highlight.text.toLowerCase();
    
    interface CharMap { char: string; node: Text; offset: number; }
    const charMap: CharMap[] = [];
    
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      const parentTag = textNode.parentElement?.tagName?.toLowerCase();
      if (parentTag !== 'mark' && parentTag !== 'script' && parentTag !== 'style') {
        const text = textNode.nodeValue || '';
        for (let i = 0; i < text.length; i++) {
          charMap.push({ char: text[i], node: textNode, offset: i });
        }
      }
      node = walker.nextNode();
    }

    let normalizedText = "";
    const normalizedToCharMapIndex: number[] = [];
    
    let inWhitespace = false;
    for (let i = 0; i < charMap.length; i++) {
      const char = charMap[i].char;
      const isWhitespace = /\\s/.test(char);
      
      if (isWhitespace) {
        if (!inWhitespace) {
          normalizedText += " ";
          normalizedToCharMapIndex.push(i);
          inWhitespace = true;
        }
      } else {
        normalizedText += char.toLowerCase();
        normalizedToCharMapIndex.push(i);
        inWhitespace = false;
      }
    }

    // We do match loop, because a highlight might appear multiple times
    let startIndexSearch = 0;
    while (true) {
      const matchIndex = normalizedText.indexOf(loweredHighlight, startIndexSearch);
      if (matchIndex === -1) break;
      
      const startIndex = normalizedToCharMapIndex[matchIndex];
      const endIndex = normalizedToCharMapIndex[matchIndex + loweredHighlight.length - 1];
      
      const nodeExtents = new Map<Text, { start: number, end: number }>();
      for (let i = startIndex; i <= endIndex; i++) {
        const pos = charMap[i];
        if (!nodeExtents.has(pos.node)) {
          nodeExtents.set(pos.node, { start: pos.offset, end: pos.offset + 1 });
        } else {
          const ext = nodeExtents.get(pos.node)!;
          ext.start = Math.min(ext.start, pos.offset);
          ext.end = Math.max(ext.end, pos.offset + 1);
        }
      }

      // Convert map to array to process
      const extentsArray = Array.from(nodeExtents.entries());
      
      extentsArray.forEach(([textNode, ext]) => {
        // Split text node
        const localStart = ext.start;
        const localEnd = ext.end;
        
        if (localStart >= localEnd) return;

        const middleNode = textNode.splitText(localStart);
        middleNode.splitText(localEnd - localStart);

        const mark = document.createElement('mark');
        mark.className = `${getHighlightClassByColor(highlight.color)} text-inherit`;
        mark.style.padding = '0';
        mark.style.borderRadius = '0';
        mark.style.cursor = 'pointer';
        mark.title = 'Click to remove highlight';
        mark.setAttribute('data-highlight-text', highlight.text);
        if (questionId) {
          mark.setAttribute('data-highlight-question-id', questionId);
        }
        
        mark.appendChild(middleNode.cloneNode(true));
        middleNode.parentNode?.replaceChild(mark, middleNode);
      });

      // Break after first match to apply it, subsequent matches will be handled on next loop iteration 
      // of uniqueHighlights if we reset DOM?
      // Actually because we mutate DOM, charMap nodes are invalid now!
      // We must restart the uniqueHighlights loop for the rest of matches.
      // Easiest is to break entirely and rely on re-running `charMap` collection. 
      // So we just apply FIRST match, then `break`. Wait, if the highlight appears twice, the user selected one.
      // Currently `applyHighlightsToHtml` only flags highlightDone = true on the FIRST text node match. 
      // So it only highlights ONE occurrence. 
      break; 
    }
  });
};

export const applyHighlightsToHtml = (
  html: string,
  highlights: TextHighlight[],
  questionId?: string
): string => {
  if (!html || highlights.length === 0 || typeof window === 'undefined') {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<div id="quiz-highlight-root">${html}</div>`,
      'text/html'
    );
    const root = doc.getElementById('quiz-highlight-root');
    if (!root) return html;

    applyHighlightsToDOM(root, highlights, questionId);

    return root.innerHTML;
  } catch (error) {
    console.error('Failed to apply highlights:', error);
    return html;
  }
};
