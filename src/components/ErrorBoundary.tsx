import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

const LAST_ERROR_STORAGE_KEY = 'lms:lastError';

/**
 * App-wide safety net. Without this, any exception thrown while rendering
 * unmounts the whole React tree and the user is left with a blank white page
 * (there is no other error boundary in the app). This catches the crash,
 * shows a friendly recovery screen, and surfaces the exact error on-screen
 * (plus localStorage + console) so the specific edge case is diagnosable
 * without digging through the browser console.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    componentStack: '',
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentStack = info?.componentStack ?? '';
    this.setState({ componentStack });

    // Always log to console for developers.
    console.error('[ErrorBoundary] Caught render error:', error, componentStack);

    // Persist the last error so it can be retrieved later even after a reload.
    try {
      window.localStorage.setItem(
        LAST_ERROR_STORAGE_KEY,
        JSON.stringify({
          message: error?.message ?? String(error),
          stack: error?.stack ?? '',
          componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          at: new Date().toISOString(),
        }),
      );
    } catch {
      /* localStorage may be unavailable (private mode / quota) — ignore */
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = async () => {
    // Recovers from a stale service-worker / cache serving a broken app shell.
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* best effort */
    } finally {
      window.location.reload();
    }
  };

  private handleCopy = () => {
    const { error, componentStack } = this.state;
    const details = [
      `Message: ${error?.message ?? String(error)}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      '',
      `Stack:\n${error?.stack ?? '(none)'}`,
      '',
      `Component stack:${componentStack || '\n(none)'}`,
    ].join('\n');
    navigator.clipboard?.writeText(details).catch(() => { /* ignore */ });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, componentStack } = this.state;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 className="text-center text-xl font-bold text-gray-900">Что-то пошло не так</h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Страница неожиданно перестала отвечать. Обычно помогает перезагрузка.
            Если не помогает — нажмите «Очистить кэш и перезагрузить».
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={this.handleReload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Обновить страницу
            </button>
            <button
              onClick={this.handleClearCacheAndReload}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-slate-50"
            >
              Очистить кэш и перезагрузить
            </button>
          </div>

          <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Технические детали (пришлите скриншот этого блока)
            </summary>
            <div className="mt-2">
              <button
                onClick={this.handleCopy}
                className="mb-2 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-slate-100"
              >
                Скопировать
              </button>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs text-red-700">
                {error?.message ?? String(error)}
                {error?.stack ? `\n\n${error.stack}` : ''}
                {componentStack ? `\n\nComponent stack:${componentStack}` : ''}
              </pre>
            </div>
          </details>
        </div>
      </div>
    );
  }
}
