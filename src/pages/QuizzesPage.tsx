import { useEffect, useState } from 'react';
import { fetchQuizzes, getQuizAttemptsLeft } from "../services/api";
import type { Quiz } from '../types';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/lessonPlayer';

interface QuizItem extends Quiz {
  attemptsLeft: number;
}

export default function QuizzesPage() {
  const t = useT();
  const [items, setItems] = useState<QuizItem[]>([]);
  useEffect(() => {
    fetchQuizzes().then((qs: any[]) => setItems(qs.map(q => ({ 
      ...q, 
      id: String(q.id), 
      attemptsLeft: getQuizAttemptsLeft(String(q.id)) 
    }))));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('lessonPlayer.quizzes.title')}</h1>
      <div className="bg-card rounded-2xl shadow-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">{t('lessonPlayer.quizzes.colTitle')}</th>
              <th className="text-left px-4 py-3">{t('lessonPlayer.quizzes.colTime')}</th>
              <th className="text-left px-4 py-3">{t('lessonPlayer.quizzes.colAttempts')}</th>
              <th className="text-left px-4 py-3">{t('lessonPlayer.quizzes.colAction')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map(q => (
              <tr key={q.id} className="border-t">
                <td className="px-4 py-3 font-medium">{q.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{t('common.minutes', { count: Math.round((q.timeLimitSec || 0)/60) })}</td>
                <td className="px-4 py-3 text-muted-foreground">{q.attemptsLeft}</td>
                <td className="px-4 py-3">
                  <a className="whitespace-nowrap px-3 py-1.5 bg-brand-solid hover:bg-brand-solid-hover text-brand-solid-foreground rounded-lg" href={`#/quiz/${q.id}`}>{t('lessonPlayer.common.start')}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


