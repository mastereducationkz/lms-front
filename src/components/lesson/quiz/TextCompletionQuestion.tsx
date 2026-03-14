import React from 'react';
import { TextCompletionRenderer } from '../TextCompletionRenderer';

interface TextCompletionQuestionProps {
  question: any;
  questionId?: string;
  highlights?: Array<{ text: string; color: 'yellow' | 'pink' | 'blue' }>;
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
  disabled?: boolean;
  showResult?: boolean;
}

export const TextCompletionQuestion: React.FC<TextCompletionQuestionProps> = ({
  question,
  questionId,
  highlights,
  answers,
  onAnswerChange,
  disabled,
  showResult
}) => {
  const correctAnswers: string[] = Array.isArray(question.correct_answer) ? question.correct_answer : (question.correct_answer ? [question.correct_answer] : []);

  // Convert array to object for TextCompletionRenderer
  const answersObj: Record<number, string> = {};
  answers.forEach((val, idx) => {
    answersObj[idx] = val;
  });

  // Get the text from either content_text or question_text
  const textToRender = question.content_text || question.question_text || '';

  return (
    <div className="p-1">
      <TextCompletionRenderer
        text={textToRender}
        questionId={questionId}
        highlights={highlights}
        answers={answersObj}
        onAnswerChange={onAnswerChange}
        disabled={disabled}
        showCorrectAnswers={showResult}
        correctAnswers={correctAnswers}
        showNumbering={question.show_numbering || false}
      />
    </div>
  );
};
