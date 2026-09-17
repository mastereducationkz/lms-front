import React from 'react';
import { FillInBlankRenderer } from '../FillInBlankRenderer';
import { gapMarks } from './scoring';

interface FillInBlankQuestionProps {
  question: any;
  questionId?: string;
  highlights?: Array<{ text: string; color: 'yellow' | 'pink' | 'blue' }>;
  answers: string[];
  onAnswerChange: (index: number, value: string) => void;
  disabled?: boolean;
  showResult?: boolean;
  revealCorrect?: boolean;
}

export const FillInBlankQuestion: React.FC<FillInBlankQuestionProps> = ({
  question,
  questionId,
  highlights,
  answers,
  onAnswerChange,
  disabled,
  showResult,
  revealCorrect
}) => {
  const correctAnswers: string[] = Array.isArray(question.correct_answer) ? question.correct_answer : (question.correct_answer ? [question.correct_answer] : []);
  
  // Convert array to object for FillInBlankRenderer
  const answersObj: Record<number, string> = {};
  answers.forEach((val, idx) => {
    answersObj[idx] = val;
  });
  // The review marks what the score counted, gap by gap — never a second grader.
  const review = showResult ? gapMarks(question, answers) : null;

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
        revealCorrect={revealCorrect}
        correctAnswers={correctAnswers}
        shuffleOptions={true}
        marks={review?.marks}
        expectedAnswers={review?.expected}
      />
    </div>
  );
};
