import { useEffect, useMemo, useState } from 'react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { Send, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { getOnboarding, updateOnboardingStatus } from '../services/api/onboarding';
import type { OnboardingCard, OnboardingStatus } from '../types';

const COLUMNS: { key: OnboardingStatus; title: string }[] = [
  { key: 'new', title: 'Новые' },
  { key: 'in_progress', title: 'В работе' },
  { key: 'done', title: 'Завершено' },
];

function Card({ card, isHead }: { card: OnboardingCard; isHead: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: card.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 mb-2 shadow-sm cursor-grab active:cursor-grabbing"
    >
      <div className="font-medium text-gray-900 dark:text-gray-100">{card.student_name}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{card.group_name || '—'}
        {isHead && card.curator_name ? ` · ${card.curator_name}` : ''}</div>
      {card.telegram_link ? (
        <a href={card.telegram_link} target="_blank" rel="noreferrer"
           onPointerDown={(e) => e.stopPropagation()}
           className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
          <Send size={14} /> Написать в Telegram
        </a>
      ) : card.phone_number ? (
        <a href={`tel:${card.phone_number}`}
           onPointerDown={(e) => e.stopPropagation()}
           className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 hover:underline">
          <Phone size={14} /> {card.phone_number}
        </a>
      ) : (
        <span className="text-xs text-gray-400">нет контактов</span>
      )}
    </div>
  );
}

function Column({ col, cards, isHead }: { col: { key: OnboardingStatus; title: string }; cards: OnboardingCard[]; isHead: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div ref={setNodeRef}
         className={`flex-1 min-w-[240px] rounded-xl p-3 ${isOver ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-gray-50 dark:bg-gray-900/40'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{col.title}</h3>
        <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">{cards.length}</span>
      </div>
      {cards.map((c) => <Card key={c.id} card={c} isHead={isHead} />)}
    </div>
  );
}

export default function CuratorOnboardingPage() {
  const { user } = useAuth();
  const isHead = user?.role === 'head_curator' || user?.role === 'admin';
  const [cards, setCards] = useState<OnboardingCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOnboarding().then(setCards).catch((e) => console.error('Failed to load onboarding', e)).finally(() => setLoading(false));
  }, []);

  const byStatus = useMemo(() => {
    const m: Record<string, OnboardingCard[]> = { new: [], in_progress: [], done: [] };
    for (const c of cards) if (m[c.status]) m[c.status].push(c);
    return m;
  }, [cards]);

  async function onDragEnd(e: DragEndEvent) {
    const id = Number(e.active.id);
    const target = e.over?.id as OnboardingStatus | undefined;
    if (!target) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === target) return;
    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: target } : c)));
    try {
      await updateOnboardingStatus(id, target);
    } catch {
      setCards(prev); // rollback on failure
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Онбординг учеников</h1>
      <p className="text-sm text-gray-500 mb-4">
        {isHead ? 'Новые ученики всех кураторов' : 'Отправьте приветственное сообщение новым ученикам'}
      </p>
      {loading ? (
        <div className="text-gray-500">Загрузка…</div>
      ) : (
        <DndContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto">
            {COLUMNS.map((col) => <Column key={col.key} col={col} cards={byStatus[col.key] || []} isHead={isHead} />)}
          </div>
        </DndContext>
      )}
    </div>
  );
}
