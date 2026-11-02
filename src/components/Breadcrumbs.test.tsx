// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Breadcrumbs from './Breadcrumbs';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('<Breadcrumbs>', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = (label?: string) => act(() => root.render(
    <MemoryRouter>
      <Breadcrumbs label={label} items={[{ to: '/dashboard', label: 'Дашборд' }, { to: '/courses', label: 'Курсы' }, { label: 'Модуль 1' }]} />
    </MemoryRouter>,
  ));

  it('is a named list that may wrap, one item per crumb', () => {
    render('Навигация по курсу');
    const nav = host.querySelector('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Навигация по курсу');
    const ol = nav.querySelector('ol')!;
    expect(ol.className).toContain('flex-wrap');
    expect(ol.querySelectorAll('li')).toHaveLength(3);
  });

  it('keeps each separator out of the link text and hidden from screen readers', () => {
    render();
    const links = [...host.querySelectorAll('a')].map((a) => a.textContent);
    expect(links).toEqual(['Дашборд', 'Курсы']);
    const seps = host.querySelectorAll('[aria-hidden="true"]');
    expect(seps).toHaveLength(2);
    seps.forEach((s) => expect(s.textContent).toBe('/'));
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('Модуль 1');
  });

  it('renders nothing without items', () => {
    act(() => root.render(<MemoryRouter><Breadcrumbs items={[]} /></MemoryRouter>));
    expect(host.innerHTML).toBe('');
  });
});
