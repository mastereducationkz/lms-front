// SSO Phase 2 — OIDC Authorization-Code + PKCE login against the central IdP (Zitadel),
// offered alongside the existing email/password login. The IdP access token is injected
// into the app's existing `tokenManager`, so every existing API call attaches it as a
// Bearer and the LMS backend validates it via JWKS (dual-run with legacy HS256).
//
// The whole feature is gated on the OIDC env being present, so a build without the
// VITE_OIDC_* vars simply never shows the button — nothing changes.
import { UserManager, WebStorageStateStore, type User as OidcUser } from 'oidc-client-ts'
import { API_BASE_URL, tokenManager } from './api/client'

const authority = import.meta.env.VITE_OIDC_AUTHORITY as string | undefined
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined
const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI as string | undefined
// offline_access → refresh token so oidc-client-ts can silently renew the access token.
// (Optionally append the Zitadel project-audience scope to force the lms-api resource id
// into aud: `urn:zitadel:iam:org:project:id:<PROJECT_ID>:aud`.)
const scope = (import.meta.env.VITE_OIDC_SCOPES as string | undefined) || 'openid profile email offline_access'
const postLogoutUri = (import.meta.env.VITE_OIDC_POST_LOGOUT_URI as string | undefined) || redirectUri

const OIDC_MARKER = 'auth_provider_oidc'

/**
 * Why completing the /auth/callback round-trip failed.
 *
 * Every one of these used to surface as the same catch-all sentence with no logging, which
 * made a broken SSO login impossible to tell apart from a callback link the user simply
 * opened twice — and impossible for support to act on. Naming the failure is what makes it
 * fixable.
 */
export type OidcFailureReason =
  /** The IdP refused before issuing a code: no project grant, deactivated account, declined consent. */
  | 'idp_rejected'
  /** The one-time code/PKCE state is spent or missing: replayed callback, or another browser holds it. */
  | 'link_expired'
  /** localStorage unavailable (private mode, "block all cookies", some embedded webviews). */
  | 'storage_blocked'
  /** The build shipped without VITE_OIDC_*. */
  | 'not_configured'
  /** Token / userinfo / metadata request never completed. */
  | 'network'
  /** LMS itself is unreachable while loading the signed-in user. */
  | 'lms_unreachable'
  /** The IdP token is valid but no active LMS account matches it. */
  | 'no_lms_account'
  /** LMS itself refused the IdP token (OIDC acceptance off, audience/issuer/JWKS problem). */
  | 'token_rejected'
  | 'unknown'

export class OidcCallbackError extends Error {
  readonly reason: OidcFailureReason
  readonly idpError?: string
  readonly idpErrorDescription?: string

  constructor(reason: OidcFailureReason, detail: string, idpError?: string, idpErrorDescription?: string) {
    super(detail)
    this.name = 'OidcCallbackError'
    this.reason = reason
    this.idpError = idpError
    this.idpErrorDescription = idpErrorDescription
  }
}

/** True when this browser actually lets us persist the PKCE state across the IdP round-trip. */
export function oidcStorageAvailable(): boolean {
  try {
    const probe = '__oidc_probe__'
    window.localStorage.setItem(probe, '1')
    const ok = window.localStorage.getItem(probe) === '1'
    window.localStorage.removeItem(probe)
    return ok
  } catch {
    return false
  }
}

/** Does the current URL still carry an unspent callback response? */
export function hasOidcCallbackParams(url: string = window.location.href): boolean {
  try {
    const q = new URL(url).searchParams
    return q.has('code') || q.has('state') || q.has('error')
  } catch {
    return false
  }
}

function readIdpErrorFromUrl(url: string): { error: string; description?: string } | null {
  try {
    const q = new URL(url).searchParams
    const error = q.get('error')
    return error ? { error, description: q.get('error_description') || undefined } : null
  } catch {
    return null
  }
}

/**
 * Drop the spent `code`/`state`/`error` from the address bar.
 *
 * They are single-use: once the exchange has read them, ANY re-run of the callback on the
 * same URL fails with "No matching state found in storage". Reloads are not exotic here —
 * a pull-to-refresh, the Back button, or the PWA's own update reload all replay the URL —
 * so the params must not survive the first read.
 */
function stripOidcCallbackParams(): void {
  try {
    if (!hasOidcCallbackParams()) return
    window.history.replaceState(null, '', window.location.pathname)
  } catch {
    /* history unavailable — non-fatal */
  }
}

function classifyOidcError(err: unknown): OidcCallbackError {
  if (err instanceof OidcCallbackError) return err
  const message = err instanceof Error ? err.message : String(err)
  const name = (err as { name?: string } | null)?.name

  // oidc-client-ts raises ErrorResponse both for an IdP `?error=` redirect (handled earlier,
  // before we get here) and for an OAuth error body from the token/userinfo endpoints.
  if (name === 'ErrorResponse') {
    const code = (err as { error?: string }).error || ''
    const description = (err as { error_description?: string }).error_description || undefined
    // invalid_grant is the token endpoint saying the code was already redeemed or has expired.
    const reason: OidcFailureReason = code === 'invalid_grant' || code === 'invalid_request' ? 'link_expired' : 'idp_rejected'
    return new OidcCallbackError(reason, message || code, code, description)
  }
  if (name === 'ErrorTimeout' || /failed to fetch|networkerror|load failed|timed out/i.test(message)) {
    return new OidcCallbackError('network', message)
  }
  if (
    /no matching state found in storage|no state in response|expected code in response|state does not match|mismatch on settings vs\. signin state/i.test(
      message,
    )
  ) {
    return new OidcCallbackError('link_expired', message)
  }
  return new OidcCallbackError('unknown', message)
}

/**
 * Fire-and-forget report of a failed SSO callback so support can see WHY a login broke
 * without depending on the student to describe a red screen.
 *
 * Deliberately plain `fetch`, not the app's axios client: there is no session yet and the
 * client's 401 interceptor would redirect. Never throws, never blocks the UI.
 */
export function reportOidcFailure(reason: OidcFailureReason, detail: string, idpError?: string): void {
  try {
    const body = JSON.stringify({
      reason,
      detail: String(detail || '').slice(0, 500),
      idp_error: idpError ? String(idpError).slice(0, 200) : null,
      hint_email: getLastAccount()?.email || null,
      user_agent: navigator.userAgent.slice(0, 300),
    })
    void fetch(`${API_BASE_URL}/auth/sso-callback-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* reporting is best-effort */
    })
  } catch {
    /* reporting is best-effort */
  }
}

export function isOidcConfigured(): boolean {
  return Boolean(authority && clientId && redirectUri)
}

let _manager: UserManager | null = null

function manager(): UserManager {
  if (!isOidcConfigured()) throw new OidcCallbackError('not_configured', 'OIDC is not configured')
  if (!_manager) {
    // The PKCE state has to survive the round-trip to the IdP. Where storage is blocked
    // (Safari "Block All Cookies", some embedded webviews) the login could only ever
    // dead-end at the callback, so refuse here with a reason the UI can explain.
    if (!oidcStorageAvailable()) throw new OidcCallbackError('storage_blocked', 'browser storage is unavailable')
    _manager = new UserManager({
      authority: authority!,
      client_id: clientId!,
      redirect_uri: redirectUri!,
      post_logout_redirect_uri: postLogoutUri,
      response_type: 'code', // oidc-client-ts uses PKCE (S256) automatically for code flow
      scope,
      automaticSilentRenew: true, // refresh-token silent renew keeps the Bearer fresh
      // Zitadel id_tokens don't carry name/email by default, so pull the profile from userinfo —
      // this is what populates user.profile.{name,email} for the "Continue as X" hint.
      loadUserInfo: true,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
    })
    // Whenever the IdP token is (re)issued — initial login or a silent renew — mirror the
    // fresh access token into the app's tokenManager so outgoing requests stay authenticated.
    _manager.events.addUserLoaded((u: OidcUser) => {
      if (u.access_token) tokenManager.setTokens(u.access_token, '')
    })
  }
  return _manager
}

// --- "Continue as X": remember the last Master Education account across ALL *.mastereducation.kz
// platforms (lms/sat/ielts/crm) via a shared cookie, so a returning user gets a personalized
// button everywhere after signing in once anywhere. Non-sensitive display hint only (name+email);
// the real auth is still the OIDC flow. ------------------------------------------------------------
const LAST_ACCOUNT_COOKIE = 'me_last_account'

function lastAccountCookieDomain(): string {
  // Share across every mastereducation.kz subdomain; host-only elsewhere (e.g. localhost).
  return window.location.hostname.endsWith('mastereducation.kz') ? '; domain=.mastereducation.kz' : ''
}

export function setLastAccount(acct: { name?: string | null; email?: string | null }): void {
  const email = (acct.email || '').trim()
  const name = (acct.name || '').trim()
  if (!email && !name) return
  try {
    const value = encodeURIComponent(JSON.stringify({ name, email }))
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${LAST_ACCOUNT_COOKIE}=${value}; path=/${lastAccountCookieDomain()}; max-age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`
  } catch {
    /* cookies unavailable — non-fatal */
  }
}

export function getLastAccount(): { name: string; email: string } | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)me_last_account=([^;]*)/)
    if (!m) return null
    const o = JSON.parse(decodeURIComponent(m[1])) as { name?: unknown; email?: unknown }
    const name = typeof o.name === 'string' ? o.name : ''
    const email = typeof o.email === 'string' ? o.email : ''
    return name || email ? { name, email } : null
  } catch {
    return null
  }
}

/** Redirect the browser to the IdP to begin an Authorization-Code + PKCE login. */
export async function startOidcLogin(opts?: { selectAccount?: boolean; loginHint?: string }): Promise<void> {
  // Default: reuse an existing Zitadel session (fast, one click). `selectAccount` forces Zitadel's
  // account chooser (prompt=select_account, Advisory a10000); `loginHint` pre-selects a specific
  // account (the "Continue as X" returning-user path).
  const extra: Record<string, string> = {}
  if (opts?.selectAccount) extra.prompt = 'select_account'
  if (opts?.loginHint) extra.login_hint = opts.loginHint
  await manager().signinRedirect(Object.keys(extra).length ? { extraQueryParams: extra } : undefined)
}

/**
 * One completion attempt per page load.
 *
 * The authorization code and the PKCE state are SINGLE-USE, and `signinRedirectCallback()`
 * removes the stored state before it validates anything — so a second call always fails with
 * "No matching state found in storage", destroying a login that was on its way to
 * succeeding. React StrictMode double-invokes effects in dev and a remount can happen at any
 * time in production, so every later caller must observe the FIRST attempt rather than start
 * a competing exchange. A page load has exactly one callback URL, so the module instance is
 * the right scope; a deliberate retry is a fresh navigation, which gets a fresh module.
 */
let _completion: Promise<OidcUser> | null = null

/** True once this page load has begun (or finished) its one completion attempt. */
export function oidcCompletionStarted(): boolean {
  return _completion !== null
}

/**
 * Complete the login on the /auth/callback route: exchange the code for tokens and inject
 * the access token into tokenManager. The caller then loads the LMS user via /auth/me.
 * We intentionally do NOT store the IdP refresh token as the LMS refresh token (the LMS
 * /auth/refresh only understands its own HS256 refresh tokens); oidc-client-ts keeps the
 * IdP refresh token in its own store and renews via `automaticSilentRenew`.
 *
 * Always rejects with an {@link OidcCallbackError} so the caller can say what went wrong.
 */
export function completeOidcLogin(): Promise<OidcUser> {
  if (!_completion) {
    _completion = runOidcCompletion(window.location.href)
    // Keep a handled branch so an unmount before the caller awaits can't raise an
    // unhandled rejection; the caller still sees the real outcome.
    _completion.catch(() => {})
  }
  return _completion
}

async function runOidcCompletion(href: string): Promise<OidcUser> {
  // The IdP can refuse before ever issuing a code — no grant for the LMS project, a
  // deactivated account, declined consent, `prompt=none` with no session — and it says which
  // in the query string. That is the one case where we know exactly what happened, so read
  // it rather than letting it fall into the generic bucket.
  const idp = readIdpErrorFromUrl(href)
  stripOidcCallbackParams()
  if (idp) {
    throw new OidcCallbackError('idp_rejected', idp.description || idp.error, idp.error, idp.description)
  }

  let user: OidcUser
  try {
    user = await manager().signinRedirectCallback(href)
  } catch (err) {
    throw classifyOidcError(err)
  }
  if (!user.access_token) {
    throw new OidcCallbackError('idp_rejected', 'No access token returned by the identity provider')
  }

  tokenManager.setTokens(user.access_token, '')
  try {
    localStorage.setItem(OIDC_MARKER, '1')
    const p = (user.profile || {}) as { name?: string; email?: string; preferred_username?: string }
    setLastAccount({ name: p.name, email: p.email || p.preferred_username })
  } catch {
    /* storage unavailable — non-fatal */
  }
  return user
}

/**
 * Renew the IdP access token on demand (used by the API interceptor when a request 401s and
 * there is no LMS refresh token to fall back on — the OIDC path). Uses the stored refresh token
 * (offline_access) so it needs no iframe. On success the addUserLoaded handler above mirrors the
 * fresh token into tokenManager; we also return it so the caller can retry immediately.
 * Returns null when this isn't an OIDC session or the renew fails (caller then ends the session).
 */
export async function trySilentRenewAccessToken(): Promise<string | null> {
  if (!isOidcConfigured() || !isOidcSession()) return null
  try {
    const user = await manager().signinSilent()
    return user?.access_token ?? null
  } catch (error) {
    console.warn('OIDC silent renew failed:', error)
    return null
  }
}

export function isOidcSession(): boolean {
  try {
    return localStorage.getItem(OIDC_MARKER) === '1'
  } catch {
    return false
  }
}

/**
 * Local logout for an OIDC session: stop the background silent-renew and drop the stored
 * IdP user so it can't re-inject a fresh token after the app logs out. Does NOT redirect to
 * the IdP end-session endpoint (that heavier single-logout is a later enhancement) — keeps
 * the existing in-app "logout → /login" UX.
 */
export async function clearOidcSession(): Promise<void> {
  try {
    localStorage.removeItem(OIDC_MARKER)
  } catch {
    /* ignore */
  }
  if (_manager) {
    try {
      _manager.stopSilentRenew()
    } catch {
      /* ignore */
    }
    try {
      await _manager.removeUser()
    } catch {
      /* ignore */
    }
  }
}
