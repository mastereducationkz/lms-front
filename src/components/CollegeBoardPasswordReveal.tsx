import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, RotateCw } from 'lucide-react';
import apiClient from '../services/api';
import { cn } from '../lib/utils';
import { collegeBoardPasswordDisplay } from '../lib/assignmentZeroCollegeBoard';

const HIDE_AFTER_MS = 60_000;

type RevealState =
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'revealed'; value: string }
  | { status: 'error'; kind: 'forbidden' | 'not_found' | 'network' };

const COPY = {
  ru: {
    show: 'Показать',
    dash: '—',
    copy: 'Скопировать',
    copied: 'Пароль скопирован',
    copyFailed: 'Не удалось скопировать',
    hide: 'Скрыть',
    forbidden: 'Нет доступа',
    notFound: 'Пароль не указан',
    network: 'Ошибка сети',
    retry: 'Повторить',
    loading: 'Загрузка…',
  },
  en: {
    show: 'Show',
    dash: '—',
    copy: 'Copy',
    copied: 'Password copied',
    copyFailed: 'Failed to copy',
    hide: 'Hide',
    forbidden: 'Access denied',
    notFound: 'No password set',
    network: 'Network error',
    retry: 'Retry',
    loading: 'Loading…',
  },
} as const;

/**
 * Reveal-on-click for a student's College Board password (G9 a′, 2026-09-26).
 *
 * The plaintext no longer travels with any list or profile response — only
 * `hasPassword` does. Clicking fetches it from a dedicated POST endpoint and keeps
 * it in this component's own state only: it is never written to a store, context,
 * the API cache, or localStorage/sessionStorage. It disappears again when the
 * viewer hides it, when this component unmounts (covers navigating away, since
 * that unmounts the page tree), and on its own after HIDE_AFTER_MS, so a
 * forgotten open tab doesn't leave it on screen indefinitely.
 *
 * Deliberately a plain inline disclosure rather than a positioned popover: it
 * needs no outside-click/collision handling (the hide button and the timeout
 * already close it), and staying free of a portal-based primitive keeps it
 * trivially render-testable without a DOM (see the .test.ts file).
 *
 * A stored password this viewer isn't allowed to reveal (`canReveal: false`,
 * per `can_reveal_college_board_password`) renders nothing at all — no button,
 * no dots — rather than a control that would just 403. See
 * `collegeBoardPasswordDisplay` in `lib/assignmentZeroCollegeBoard` for the
 * three-way decision and `defaultCanReveal`'s role when the server omits the
 * flag.
 */
export function CollegeBoardPasswordReveal({
  userId,
  hasPassword,
  canReveal,
  defaultCanReveal,
  lang = 'ru',
  className,
}: {
  userId: number;
  hasPassword: boolean;
  canReveal?: boolean;
  defaultCanReveal: boolean;
  lang?: 'ru' | 'en';
  className?: string;
}) {
  const [state, setState] = useState<RevealState>({ status: 'hidden' });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the reveal request's continuation: a response landing after unmount
  // (navigated away while the POST was in flight) must not call setState and
  // must not resurrect the plaintext into a state React will never render.
  const mountedRef = useRef(true);
  const t = COPY[lang];

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearHideTimer();
    };
  }, []);

  const hide = () => {
    clearHideTimer();
    setState({ status: 'hidden' });
  };

  const load = async () => {
    setState({ status: 'loading' });
    try {
      const value = await apiClient.revealCollegeBoardPassword(userId);
      if (!mountedRef.current) return;
      setState({ status: 'revealed', value });
      clearHideTimer();
      hideTimer.current = setTimeout(hide, HIDE_AFTER_MS);
    } catch (error: any) {
      if (!mountedRef.current) return;
      const httpStatus = error?.response?.status;
      setState({
        status: 'error',
        kind: httpStatus === 403 ? 'forbidden' : httpStatus === 404 ? 'not_found' : 'network',
      });
    }
  };

  const copy = async () => {
    if (state.status !== 'revealed') return;
    try {
      await navigator.clipboard.writeText(state.value);
      toast.success(t.copied);
    } catch {
      toast.error(t.copyFailed);
    }
  };

  const display = collegeBoardPasswordDisplay(hasPassword, canReveal, defaultCanReveal);

  if (display === 'none') {
    return <span className={className}>{t.dash}</span>;
  }

  if (display === 'hidden_no_access') {
    return null;
  }

  if (state.status === 'hidden') {
    return (
      <button
        type="button"
        onClick={load}
        className={cn(
          'inline-flex items-center gap-1 font-mono text-sm text-gray-600 underline decoration-dotted hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100',
          className,
        )}
      >
        <Eye className="w-3.5 h-3.5" />
        •••••• {t.show}
      </button>
    );
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {state.status === 'loading' && <span className="text-xs text-gray-500">{t.loading}</span>}
      {state.status === 'revealed' && (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm break-all dark:border dark:border-border dark:bg-card">
          {state.value}
        </code>
      )}
      {state.status === 'revealed' && (
        <button
          type="button"
          onClick={copy}
          title={t.copy}
          className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-secondary dark:hover:text-gray-100"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
      {state.status === 'error' && (
        <span className="text-xs text-rose-600">
          {state.kind === 'forbidden' ? t.forbidden : state.kind === 'not_found' ? t.notFound : t.network}
        </span>
      )}
      {state.status === 'error' && state.kind === 'network' && (
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <RotateCw className="w-3 h-3" />
          {t.retry}
        </button>
      )}
      {(state.status === 'revealed' || state.status === 'error') && (
        <button
          type="button"
          onClick={hide}
          title={t.hide}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-secondary"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  );
}
