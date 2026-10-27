import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined) };
});

import { setActiveLocale } from '../../lib/i18n';
import { PlannedPayCard, type PlannedPayItem } from './PlannedPayCard';

const items: PlannedPayItem[] = [
  { event_id: 1, kind: 'lesson', title: 'SAT Mon Wed', day: '2026-10-14', minutes: 90, amount_tenge: 6000, awaiting_register: false },
  { event_id: 2, kind: 'lesson', title: 'IELTS Evening', day: '2026-10-13', minutes: 60, amount_tenge: 4000, awaiting_register: true },
];

describe('PlannedPayCard', () => {
  afterEach(() => setActiveLocale('en'));

  it('lists planned lessons beside the total, flags the ones waiting for the register', () => {
    setActiveLocale('ru');
    const html = renderToStaticMarkup(
      createElement(PlannedPayCard, { items, plannedAmount: 10000, totalWithPlanned: 30000 }),
    );
    expect(html).toContain('Запланировано (ещё не проведено):');
    expect(html).toContain('SAT Mon Wed');
    expect(html).toContain('90 мин');
    expect(html).toContain('ждёт отметки');
    expect(html).toContain('Итого с запланированными:');
    expect(html).toContain('оплачиваются только после проведения');
  });

  it('renders nothing when nothing is planned', () => {
    expect(renderToStaticMarkup(createElement(PlannedPayCard, { items: [] }))).toBe('');
    expect(renderToStaticMarkup(createElement(PlannedPayCard, {}))).toBe('');
  });
});
