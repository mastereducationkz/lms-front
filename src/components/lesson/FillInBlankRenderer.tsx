import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { renderTextWithLatex } from '../../utils/latex';
import { parseGap } from '../../utils/gapParser';
import { applyHighlightsToDOM } from '../../utils/highlightUtils';

interface FillInBlankRendererProps {
  text: string;
  questionId?: string;
  highlights?: Array<{ text: string; color: 'yellow' | 'pink' | 'blue' }>;
  separator?: string;
  answers?: Record<number, string>;
  onAnswerChange?: (gapIndex: number, value: string) => void;
  disabled?: boolean;
  showCorrectAnswers?: boolean;
  correctAnswers?: string[];
  shuffleOptions?: boolean;
}

interface GapData {
  index: number;
  options: string[];
  correctOption: string; // The correct answer without the asterisk
  container: HTMLElement | null;
}

export const FillInBlankRenderer: React.FC<FillInBlankRendererProps> = ({
  text,
  questionId,
  highlights = [],
  separator = ',',
  answers = {},
  onAnswerChange,
  disabled = false,
  showCorrectAnswers = false,
  correctAnswers = [],
  shuffleOptions = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gaps, setGaps] = useState<GapData[]>([]);
  const [mounted, setMounted] = useState(false);

  // Serialize highlights for stable useEffect dependency (avoids re-render on same data with new array ref)
  const highlightsKey = JSON.stringify(highlights);

  useEffect(() => {
    if (!containerRef.current) return;

    // Parse text and create HTML with placeholder containers
    const parts = text.split(/(\[\[.*?\]\])/g);
    const gapData: GapData[] = [];
    let gapIndex = 0;

    const htmlContent = parts.map((part) => {
      const gapMatch = part.match(/\[\[(.*?)\]\]/);
      if (!gapMatch) {
        return renderTextWithLatex(part);
      }

      const { options, correctOption } = parseGap(gapMatch[1], separator);

      // If shuffleOptions is enabled, shuffle them
      let displayOptions = shuffleOptions ? [...options].sort(() => Math.random() - 0.5) : options;

      const id = `gap-container-${gapIndex}`;
      gapData.push({ index: gapIndex, options: displayOptions, correctOption, container: null });
      gapIndex++;

      // Create inline container for the select
      return `<span id="${id}" class="inline-flex align-baseline mx-0.5" style="display: inline-flex; vertical-align: baseline;"></span>`;
    }).join('');

    // Set HTML content (without highlights initially)
    containerRef.current.innerHTML = htmlContent;

    // Find all gap containers and store references
    const updatedGaps = gapData.map(gap => {
      const container = containerRef.current?.querySelector(`#gap-container-${gap.index}`) as HTMLElement;
      return { ...gap, container };
    });

    setGaps(updatedGaps);
    setMounted(true);
  }, [text, separator, shuffleOptions, questionId]);

  // Apply highlights dynamically without rebuilding innerHTML
  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    applyHighlightsToDOM(containerRef.current, highlights, questionId);
  }, [highlightsKey, mounted, questionId]);

  return (
    <div
      ref={containerRef}
      className="text-gray-800 dark:text-gray-100 text-lg leading-relaxed prose prose-lg dark:prose-invert max-w-none"
    >
      {mounted && gaps.map((gap) => {
        if (!gap.container) return null;

        const value = answers[gap.index] || '';
        // Use the correct option extracted from the gap text (with asterisk marker)
        // Falls back to correctAnswers prop if needed (for backward compatibility)
        const correctAnswer = gap.correctOption || correctAnswers[gap.index];

        // Temporary debug logging
        if (showCorrectAnswers) {
          console.log(`Gap #${gap.index + 1}:`, {
            userAnswer: value,
            correctAnswer: correctAnswer,
            match: value.trim().toLowerCase() === correctAnswer.trim().toLowerCase(),
            allOptions: gap.options
          });
        }

        const isCorrect = showCorrectAnswers && value && correctAnswer &&
          value.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
        const isIncorrect = showCorrectAnswers && value && correctAnswer &&
          value.trim().toLowerCase() !== correctAnswer.trim().toLowerCase();

        return createPortal(
          <span key={gap.index} className="inline-flex items-center align-baseline gap-1">
            <Select
              value={value}
              onValueChange={(newValue) => onAnswerChange?.(gap.index, newValue)}
              disabled={disabled}
            >
              <SelectTrigger
                className={`
                  inline-flex !w-auto w-fit items-center justify-between h-8 py-0.5 px-2 text-sm font-medium border-2 rounded
                  ${disabled ? 'cursor-not-allowed opacity-70 bg-gray-100' : 'cursor-pointer bg-white hover:bg-gray-50'}
                  ${isCorrect ? 'border-green-500 bg-green-50' : ''}
                  ${isIncorrect ? 'border-red-500 bg-red-50' : ''}
                  ${!showCorrectAnswers ? 'border-blue-400' : ''}
                  transition-colors duration-200
                `.trim().replace(/\s+/g, ' ')}
                style={{ display: 'inline-flex', width: 'auto', minWidth: '52px' }}
              >
                <SelectValue placeholder={`#${gap.index + 1}`} />
              </SelectTrigger>
              <SelectContent>
                {gap.options.map((option, optIdx) => (
                  <SelectItem key={optIdx} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>,
          gap.container
        );
      })}
    </div>
  );
};
