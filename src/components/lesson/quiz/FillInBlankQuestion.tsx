import React from 'react';
import { FillInBlankRenderer } from '../FillInBlankRenderer';

interface FillInBlankQuestionProps {
  question: any;
  questionId?: string;
  highlights?: Array<{ text: string; color: 'yellow' | 'pink' | 'blue' }>;
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
  disabled?: boolean;
  showResult?: boolean;
}

export const FillInBlankQuestion: React.FC<FillInBlankQuestionProps> = ({
  question,
  questionId,
  highlights,
  answers,
  onAnswerChange,
  disabled,
  showResult
}) => {
  const correctAnswers: string[] = Array.isArray(question.correct_answer) ? question.correct_answer : (question.correct_answer ? [question.correct_answer] : []);
  
  // Convert array to object for FillInBlankRenderer
  const answersObj: Record<number, string> = {};
  answers.forEach((val, idx) => {
    answersObj[idx] = val;
  });

  return (
    <div className="p-1">
      <FillInBlankRenderer
        text={question.content_text || question.question_text || ''}
        questionId={questionId}
        highlights={highlights}
        separator={question.gap_separator || ','}
        answers={answersObj}
        onAnswerChange={onAnswerChange}
        disabled={disabled}
        showCorrectAnswers={showResult}
        correctAnswers={correctAnswers}
        shuffleOptions={true}
      />
    </div>
  );
};
