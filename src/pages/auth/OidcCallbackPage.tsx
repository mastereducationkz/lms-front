// SSO Phase 2 — handles the IdP redirect back at /auth/callback: completes the PKCE code
// exchange, injects the access token, loads the LMS user, and routes into the app.
//
// Everything here is shaped by one fact: the `code` and `state` in the callback URL are
// SINGLE-USE. Anything that runs this page twice on the same URL — a remount, a
// pull-to-refresh, the Back button, the PWA's own update reload — burns them, and the
// second run fails. That is why this page
//   (a) never runs the exchange twice for one URL (see completeOidcLogin),
//   (b) strips the spent params from the address bar,
//   (c) recovers from a spent link by restarting the login once instead of dead-ending,
//   (d) and, when it genuinely can't recover, says WHICH failure it was and reports it —
//       the previous catch-all sentence made ten unrelated faults indistinguishable.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import apiClient from '../../services/api'
import {
  completeOidcLogin,
  hasOidcCallbackParams,
  OidcCallbackError,
  oidcCompletionStarted,
  reportOidcFailure,
  startOidcLogin,
  type OidcFailureReason,
} from '../../services/oidc'

/** Survives the redirect to the IdP and back (same tab, same origin), so one silent
 *  re-login attempt can never become a redirect loop. */
const RETRY_KEY = 'oidc_callback_retried'

function retryAlreadyUsed(): boolean {
  try {
    return sessionStorage.getItem(RETRY_KEY) === '1'
  } catch {
    return true // can't remember a retry ⇒ must not start one
  }
}

/** Returns true only if the flag actually persisted — otherwise a retry would loop forever. */
function claimRetry(): boolean {
  try {
    sessionStorage.setItem(RETRY_KEY, '1')
    return sessionStorage.getItem(RETRY_KEY) === '1'
  } catch {
    return false
  }
}

function releaseRetry(): void {
  try {
    sessionStorage.removeItem(RETRY_KEY)
  } catch {
    /* ignore */
  }
}

const MESSAGES: Record<OidcFailureReason, string> = {
  idp_rejected:
    'Master Education не разрешил вход в LMS. Обычно это значит, что у аккаунта пока нет доступа к LMS или он деактивирован — обратитесь к куратору или администратору.',
  link_expired:
    'Ссылка для входа уже была использована. Так бывает, если страница обновилась или открылась второй раз. Начните вход заново.',
  storage_blocked:
    'Браузер не разрешает сайту сохранять данные, поэтому вход невозможно завершить. Откройте LMS в обычном окне браузера (не в режиме инкогнито и не внутри Telegram или Instagram) и разрешите файлы cookie для этого сайта.',
  not_configured: 'Вход через Master Education сейчас недоступен. Сообщите администратору.',
  token_rejected:
    'LMS не принял вход от Master Education. Это настройка на стороне сервера — сообщите администратору код ниже.',
  network: 'Не удалось связаться с Master Education. Проверьте интернет и попробуйте ещё раз.',
  lms_unreachable: 'Вход выполнен, но LMS сейчас не отвечает. Проверьте интернет и попробуйте ещё раз.',
  no_lms_account: 'Аккаунт не найден в LMS. Обратитесь к администратору, чтобы связать вашу учётную запись.',
  unknown: 'Не удалось завершить вход через Master Education. Попробуйте ещё раз.',
}

type Failure = { reason: OidcFailureReason; code: string }

export default function OidcCallbackPage() {
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const [failure, setFailure] = useState<Failure | null>(null)
  // Second belt around the retry guard: even with sessionStorage misbehaving, one page
  // load can only ever kick off one re-login.
  const retriedThisLoad = useRef(false)

  const fail = useCallback((reason: OidcFailureReason, detail: string, idpError?: string) => {
    releaseRetry()
    reportOidcFailure(reason, detail, idpError)
    console.error(`[sso] callback failed (${reason})${idpError ? ` [${idpError}]` : ''}: ${detail}`)
    setFailure({ reason, code: idpError ? `${reason}/${idpError}` : reason })
  }, [])

  useEffect(() => {
    let cancelled = false

    /** A spent or missing one-time link is the most common failure here and is almost never
     *  the user's doing. The IdP session is normally still valid, so restarting the login is
     *  an invisible round-trip. Guarded so it happens at most once. */
    const restartLogin = async (detail: string): Promise<boolean> => {
      if (retriedThisLoad.current || retryAlreadyUsed() || !claimRetry()) return false
      retriedThisLoad.current = true
      try {
        await startOidcLogin()
        return true
      } catch (err) {
        console.warn('[sso] silent re-login failed:', detail, err)
        releaseRetry()
        return false
      }
    }

    /**
     * /auth/me with the freshly injected IdP token.
     *
     * Called directly rather than through refreshUser(), because the HTTP status is the
     * whole answer here and refreshUser() collapses every failure into `undefined`: LMS
     * answers 404 for "no such/inactive user" and 401 for "I don't accept this token",
     * yet a plain network blip looks identical from the outside. That is how a backend
     * hiccup used to be reported to a student as "аккаунт не найден в LMS".
     */
    const loadLmsUser = async (): Promise<boolean> => {
      const backoffMs = [0, 800, 2500] // only transient faults get a second look
      let last = ''
      for (let attempt = 0; attempt < backoffMs.length; attempt++) {
        if (backoffMs[attempt] > 0) await new Promise((r) => setTimeout(r, backoffMs[attempt]))
        if (cancelled) return true
        try {
          const user = await apiClient.getCurrentUser()
          if (cancelled) return true
          updateUser(user)
          releaseRetry()
          navigate('/dashboard', { replace: true })
          return true
        } catch (err) {
          const status = (err as { status?: number } | null)?.status
          last = `${status ?? 'network'}: ${err instanceof Error ? err.message : String(err)}`
          if (cancelled) return true
          // Neither of these improves on a retry.
          if (status === 401 || status === 403) {
            fail('token_rejected', `/auth/me rejected the IdP token (${last})`)
            return false
          }
          if (status === 404) {
            fail('no_lms_account', `/auth/me found no active LMS user (${last})`)
            return false
          }
        }
      }
      fail('lms_unreachable', `/auth/me unavailable after retries (${last})`)
      return false
    }

    void (async () => {
      try {
        // `oidcCompletionStarted()` matters as much as the URL here: the exchange strips the
        // spent params the moment it reads them, so a REMOUNT (StrictMode in dev, or any
        // re-render of the route) sees a bare URL while the first attempt is still in flight.
        // Treating that as a replayed callback would abort a login that was about to succeed.
        if (!hasOidcCallbackParams() && !oidcCompletionStarted()) {
          // Nothing left to exchange: this page was replayed (reload / Back / PWA update
          // reload) or opened directly. If an earlier run already succeeded we are signed
          // in and can simply continue; otherwise restart the login rather than dead-end.
          if (apiClient.isAuthenticated()) {
            // A session already exists, so the earlier run got far enough to inject the
            // token: loadLmsUser() owns the outcome from here, success or failure. Falling
            // through to a re-login would throw away a real answer (e.g. "no LMS account")
            // and bounce the user back through the IdP for nothing.
            await loadLmsUser()
            return
          }
          if (cancelled) return
          if (await restartLogin('callback opened without code/state')) return
          fail('link_expired', 'callback opened without code/state and re-login already attempted')
          return
        }

        await completeOidcLogin() // exchange code -> tokens, inject Bearer
        if (cancelled) return
        await loadLmsUser()
      } catch (error) {
        if (cancelled) return
        const err =
          error instanceof OidcCallbackError
            ? error
            : new OidcCallbackError('unknown', error instanceof Error ? error.message : String(error))
        if (err.reason === 'link_expired' && (await restartLogin(err.message))) return
        if (cancelled) return
        fail(err.reason, err.message, err.idpError)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      {failure ? (
        <>
          <p className="max-w-md text-sm text-destructive">{MESSAGES[failure.reason]}</p>
          <button
            type="button"
            onClick={() => {
              releaseRetry()
              void startOidcLogin({ selectAccount: true }).catch(() => navigate('/login', { replace: true }))
            }}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Войти ещё раз
          </button>
          <Link to="/login" className="text-sm text-primary underline hover:no-underline">
            Вернуться ко входу
          </Link>
          {/* Support needs to know WHICH failure this was; the student can only relay what
              is on screen, so put the classification where they can screenshot it. */}
          <p className="text-xs text-muted-foreground">Код для поддержки: {failure.code}</p>
        </>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Выполняется вход…</p>
        </>
      )}
    </div>
  )
}
