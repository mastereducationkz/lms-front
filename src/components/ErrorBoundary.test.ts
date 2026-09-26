import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import ErrorBoundary from './ErrorBoundary';

// `renderToStaticMarkup` (the legacy synchronous SSR renderer, all this repo's vitest has —
// no jsdom, see vitest.config.ts) never invokes error boundaries: a throw from a child just
// propagates past them instead of being caught, so there's no way to make React trigger
// `componentDidCatch` here. Instead we drive the render-phase side directly: call the same
// static method React would (`getDerivedStateFromError`), merge it into a fresh instance's
// state by hand (React normally does this merge for us), and render the result.
function renderWithError(error: Error): string {
  const instance = new ErrorBoundary({ children: null });
  instance.state = { ...instance.state, ...ErrorBoundary.getDerivedStateFromError(error) };
  return renderToStaticMarkup(instance.render() as ReactElement);
}

function chunkLoadError(message = 'chunk failed to load'): Error {
  const error = new Error(message);
  error.name = 'ChunkLoadError';
  return error;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing has failed', () => {
    const instance = new ErrorBoundary({ children: null });
    expect(instance.render()).toBeNull();
  });

  it('shows the "new version" screen for a ChunkLoadError, with a reload button', () => {
    const html = renderWithError(chunkLoadError());
    expect(html).toContain('Вышла новая версия — обновите страницу');
    expect(html).toContain('Обновить страницу');
    // Not the generic crash screen.
    expect(html).not.toContain('Что-то пошло не так');
  });

  it('still shows the generic crash screen for every other error', () => {
    const html = renderWithError(new Error('unrelated render crash'));
    expect(html).toContain('Что-то пошло не так');
    expect(html).not.toContain('Вышла новая версия');
  });
});
