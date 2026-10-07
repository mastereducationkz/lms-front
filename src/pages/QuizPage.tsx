import { useEffect, useMemo, useState } from 'react';
import { sanitizeHtml } from '../lib/safeHtml';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchQuizById, getQuizAttemptsLeft, submitQuiz } from "../services/api";
import { toast } from '../components/Toast.tsx';
import type { Quiz } from '../types';
import { ArrowRight, FileText, Music } from 'lucide-react';

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [left, setLeft] = useState<number>(0);
  const [time, setTime] = useState<number>(0);

  useEffect(() => {
    if (!id) return;
    
    fetchQuizById(id).then(q => {
      setQuiz(q);
      setLeft(getQuizAttemptsLeft(id));
      setTime(q?.timeLimitSec || 0);
    });
  }, [id]);

  useEffect(() => {
    if (time <= 0) return;
    const t = setInterval(() => setTime(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [time]);

  const score = useMemo(() => {
    if (!quiz) return 0;
    let correct = 0;
    for (const q of quiz.questions) {
      if (q.type === 'single') {
        if (q.correct && q.correct.length > 0 && Number(answers[q.id]) === q.correct[0]) correct += 1;
      } else if (q.type === 'short') {
        if ((answers[q.id]||'').trim().toLowerCase() === (q.correctText||'').trim().toLowerCase()) correct += 1;
      }
    }
    return Math.round((correct / quiz.questions.length) * 100);
  }, [answers, quiz]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    await submitQuiz(id, answers, score);
    toast(`Your score: ${score}%`, 'success');
    nav('/quizzes');
  };

  if (!quiz) return <div className="text-muted-foreground">Loading...</div>;
  if (left <= 0) return <div className="text-muted-foreground">No attempts left.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="min-w-0 break-words text-3xl font-bold">{quiz.title}</h1>
        <div className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm dark:bg-secondary dark:text-foreground">Time: {Math.floor(time/60)}:{String(time%60).padStart(2,'0')}</div>
      </div>
      {/* Quiz-level media for audio/PDF quizzes */}
      {(quiz as any).quiz_media_url && (
        <div className="bg-card rounded-2xl shadow-card p-6 mb-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
            {(quiz as any).quiz_media_type === 'audio' ? (
              <><Music className="h-5 w-5" aria-hidden="true" />Audio Material</>
            ) : (
              <><FileText className="h-5 w-5" aria-hidden="true" />Reference Document</>
            )}
          </h3>
          {(quiz as any).quiz_media_type === 'audio' ? (
            <audio 
              controls 
              src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + (quiz as any).quiz_media_url}
              className="w-full"
            />
          ) : (quiz as any).quiz_media_type === 'pdf' ? (
            <div className="border rounded-lg p-4 bg-muted">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-700 dark:text-foreground">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">Reference PDF Document</span>
                </div>
                <a 
                  href={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + (quiz as any).quiz_media_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-solid text-brand-solid-foreground rounded-lg hover:bg-brand-solid-hover text-sm"
                >
                  Open PDF
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Reference this document to answer the questions below.
              </p>
            </div>
          ) : null}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {quiz.questions.map((q, idx) => (
          <div key={q.id} className="bg-card rounded-2xl shadow-card p-5">
            <div className="text-sm text-muted-foreground">Question {idx+1}</div>
            <div className="font-medium mb-3">{q.body}</div>
            
            {/* Media attachment for media questions */}
            {(q as any).media_url && (
              <div className="mb-4">
                {(q as any).media_type === 'image' ? (
                  <img 
                    src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + (q as any).media_url} 
                    alt="Question media" 
                    className="max-w-full max-h-96 object-contain rounded-lg border shadow-sm"
                  />
                ) : (q as any).media_type === 'pdf' ? (
                  <div className="border rounded-lg p-4 bg-muted">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-foreground">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">PDF Document</span>
                    </div>
                    <a 
                      href={(q as any).media_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-subtle-foreground text-sm mt-1 inline-flex items-center gap-1"
                    >
                      View PDF
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                ) : null}
              </div>
            )}
            
            {q.type === 'single' && (
              <div className="space-y-2">
                {q.options?.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name={q.id} 
                      value={i} 
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} 
                    /> {opt}
                  </label>
                ))}
              </div>
            )}
            {(q.type === 'short' || (q as any).question_type === 'short_answer') && (
              <input
                className="mt-1 border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your answer"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
            )}
            {(q as any).question_type === 'text_completion' && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-3">Fill in the blanks:</div>
                <div className="space-y-2">
                  {(() => {
                    const text = ((q as any).content_text || '').toString();
                    const parts = text.split(/\[\[(.*?)\]\]/g);
                    let gapIndex = 0;
                    
                    return (
                      <div className="leading-relaxed">
                        {parts.map((part, index) => {
                          const isGap = index % 2 === 1;
                          if (!isGap) {
                            return <span key={index} dangerouslySetInnerHTML={{ __html: sanitizeHtml(part) }} />;
                          }
                          const currentGapIndex = gapIndex++;
                          return (
                            <input
                              key={index}
                              type="text"
                              className="inline-block mx-1 px-2 py-1 border-b-2 border-brand bg-transparent text-center min-w-[80px] focus:outline-none focus:border-brand-subtle-foreground"
                              placeholder="____"
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const currentAnswers = answers[q.id] ? JSON.parse(answers[q.id] as string) : [];
                                currentAnswers[currentGapIndex] = e.target.value;
                                setAnswers(a => ({ ...a, [q.id]: JSON.stringify(currentAnswers) }));
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        ))}
        <button className="px-4 py-2 bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground rounded-lg">Submit</button>
      </form>
    </div>
  );
}


