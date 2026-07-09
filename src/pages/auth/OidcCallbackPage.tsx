// SSO Phase 2 — handles the IdP redirect back at /auth/callback: completes the PKCE code
// exchange, injects the access token, loads the LMS user, and routes into the app.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { completeOidcLogin } from '../../services/oidc'

export default function OidcCallbackPage() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await completeOidcLogin() // exchange code -> tokens, inject Bearer
        const user = await refreshUser() // GET /auth/me with the IdP token
        if (cancelled) return
        if (!user) {
          // Token was valid but no matching/active LMS user (refreshUser logs out on 404).
          setError('Аккаунт не найден в LMS. Обратитесь к администратору, чтобы связать вашу учётную запись.')
          return
        }
        navigate('/dashboard', { replace: true })
      } catch {
        if (!cancelled) setError('Не удалось завершить вход через Master Education. Попробуйте ещё раз.')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      {error ? (
        <>
          <p className="max-w-md text-sm text-destructive">{error}</p>
          <Link to="/login" className="text-sm text-primary underline hover:no-underline">
            Вернуться ко входу
          </Link>
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
