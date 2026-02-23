import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderTextWithLatex } from '../../utils/latex';

interface TextCompletionRendererProps {
    text: string;
    answers?: Record<number, string>;
    onAnswerChange?: (gapIndex: number, value: string) => void;
    disabled?: boolean;
    showCorrectAnswers?: boolean;
    correctAnswers?: string[];
    showNumbering?: boolean; // Show numbering like "1. [input] 2. [input]"
}

interface GapData {
    index: number;
    container: HTMLElement | null;
}

export const TextCompletionRenderer: React.FC<TextCompletionRendererProps> = ({
    text,
    answers = {},
    onAnswerChange,
    disabled = false,
    showCorrectAnswers = false,
    correctAnswers = [],
    showNumbering = false,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [gaps, setGaps] = useState<GapData[]>([]);
    const [mounted, setMounted] = useState(false);

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

            const id = `gap-container-${gapIndex}`;
            gapData.push({ index: gapIndex, container: null });
            gapIndex++;

            // Create inline container for the input
            return `<span id="${id}" class="inline-block align-baseline mx-1" style="display: inline-block; vertical-align: baseline;"></span>`;
        }).join('');

        // Set HTML content
        containerRef.current.innerHTML = htmlContent;

        // Find all gap containers and store references
        const updatedGaps = gapData.map(gap => {
            const container = containerRef.current?.querySelector(`#gap-container-${gap.index}`) as HTMLElement;
            return { ...gap, container };
        });

        setGaps(updatedGaps);
        setMounted(true);
    }, [text]);

    return (
        <div
            ref={containerRef}
            className="text-gray-800 dark:text-gray-100 text-lg leading-relaxed prose prose-lg dark:prose-invert max-w-none"
        >
            {mounted && gaps.map((gap) => {
                if (!gap.container) return null;

                const value = answers[gap.index] || '';
                const correctAnswer = correctAnswers[gap.index];

                const isCorrect = showCorrectAnswers && value && correctAnswer &&
                    value.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
                const isIncorrect = showCorrectAnswers && value && correctAnswer &&
                    value.trim().toLowerCase() !== correctAnswer.trim().toLowerCase();

                return createPortal(
                    <span className="inline-flex items-center gap-1">
                        {showNumbering && (
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                {gap.index + 1}.
                            </span>
                        )}
                        <input
                            key={gap.index}
                            type="text"
                            value={value}
                            onChange={(e) => onAnswerChange?.(gap.index, e.target.value)}
                            disabled={disabled}
                            placeholder={showNumbering ? '' : `#${gap.index + 1}`}
                            className={`
              inline-flex items-center h-auto py-1 px-3 my-1 text-sm font-medium border-2 rounded
              ${disabled ? 'cursor-not-allowed opacity-70 bg-gray-100' : 'cursor-text bg-white hover:bg-gray-50'}
              ${isCorrect ? 'border-green-500 bg-green-50' : ''}
              ${isIncorrect ? 'border-red-500 bg-red-50' : ''}
              ${!showCorrectAnswers ? 'border-blue-400' : ''}
              transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500
            `.trim().replace(/\s+/g, ' ')}
                            style={{
                                display: 'inline-flex',
                                width: 'auto',
                                minWidth: '100px',
                                maxWidth: '200px'
                            }}
                        />
                        {isIncorrect && (
                            <span className="text-sm font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20 px-2 py-0.5 rounded border border-green-200 dark:border-green-400">
                                {correctAnswer}
                            </span>
                        )}
                    </span>,
                    gap.container
                );
            })}
        </div>
    );
};
