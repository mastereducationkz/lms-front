// SSO Phase 2 — OIDC Authorization-Code + PKCE login against the central IdP (Zitadel),
// offered alongside the existing email/password login. The IdP access token is injected
// into the app's existing `tokenManager`, so every existing API call attaches it as a
// Bearer and the LMS backend validates it via JWKS (dual-run with legacy HS256).
//
// The whole feature is gated on the OIDC env being present, so a build without the
// VITE_OIDC_* vars simply never shows the button — nothing changes.
import { UserManager, WebStorageStateStore, type User as OidcUser } from 'oidc-client-ts'
import { tokenManager } from './api/client'

const authority = import.meta.env.VITE_OIDC_AUTHORITY as string | undefined
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined
const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI as string | undefined
// offline_access → refresh token so oidc-client-ts can silently renew the access token.
// (Optionally append the Zitadel project-audience scope to force the lms-api resource id
// into aud: `urn:zitadel:iam:org:project:id:<PROJECT_ID>:aud`.)
const scope = (import.meta.env.VITE_OIDC_SCOPES as string | undefined) || 'openid profile email offline_access'
const postLogoutUri = (import.meta.env.VITE_OIDC_POST_LOGOUT_URI as string | undefined) || redirectUri

const OIDC_MARKER = 'auth_provider_oidc'

export function isOidcConfigured(): boolean {
  return Boolean(authority && clientId && redirectUri)
}

let _manager: UserManager | null = null

function manager(): UserManager {
  if (!isOidcConfigured()) throw new Error('OIDC is not configured')
  if (!_manager) {
    _manager = new UserManager({
      authority: authority!,
      client_id: clientId!,
      redirect_uri: redirectUri!,
      post_logout_redirect_uri: postLogoutUri,
      response_type: 'code', // oidc-client-ts uses PKCE (S256) automatically for code flow
      scope,
      automaticSilentRenew: true, // refresh-token silent renew keeps the Bearer fresh
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

/** Redirect the browser to the IdP to begin an Authorization-Code + PKCE login. */
export async function startOidcLogin(opts?: { selectAccount?: boolean }): Promise<void> {
  // Default: reuse an existing Zitadel session (fast, one click). The "switch account" link passes
  // { selectAccount: true } to force Zitadel's account chooser (existing session(s) + "add another
  // account") via prompt=select_account (Zitadel Technical Advisory a10000).
  await manager().signinRedirect(
    opts?.selectAccount ? { extraQueryParams: { prompt: 'select_account' } } : undefined
  )
}

/**
 * Complete the login on the /auth/callback route: exchange the code for tokens and inject
 * the access token into tokenManager. The caller then loads the LMS user via /auth/me.
 * We intentionally do NOT store the IdP refresh token as the LMS refresh token (the LMS
 * /auth/refresh only understands its own HS256 refresh tokens); oidc-client-ts keeps the
 * IdP refresh token in its own store and renews via `automaticSilentRenew`.
 */
export async function completeOidcLogin(): Promise<OidcUser> {
  const user = await manager().signinRedirectCallback()
  if (!user.access_token) throw new Error('No access token returned by the identity provider')
  tokenManager.setTokens(user.access_token, '')
  try {
    localStorage.setItem(OIDC_MARKER, '1')
  } catch {
    /* storage unavailable — non-fatal */
  }
  return user
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
