import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { setActiveLocale } from '../lib/i18n';

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
  afterEach(() => setActiveLocale('en'));

  it('renders children when nothing has failed', () => {
    const instance = new ErrorBoundary({ children: null });
    expect(instance.render()).toBeNull();
  });

  it('shows the "new version" screen for a ChunkLoadError, with a reload button', () => {
    const html = renderWithError(chunkLoadError());
    expect(html).toContain('A new version is out — please reload the page');
    expect(html).toContain('Reload page');
    // Not the generic crash screen.
    expect(html).not.toContain('Something went wrong');
  });

  it('speaks the signed-in user\'s language (a curator reads Russian)', () => {
    setActiveLocale('ru');
    expect(renderWithError(chunkLoadError())).toContain('Вышла новая версия — обновите страницу');
    expect(renderWithError(new Error('crash'))).toContain('Что-то пошло не так');
  });

  it('still shows the generic crash screen for every other error', () => {
    const html = renderWithError(new Error('unrelated render crash'));
    expect(html).toContain('Something went wrong');
    expect(html).not.toContain('A new version is out');
  });
});
