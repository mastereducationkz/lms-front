/**
 * Lightweight in-memory SWR-style cache for the axios API client.
 *
 * Goals:
 * - Speed up navigation: identical GETs within TTL are served from memory.
 * - In-flight deduplication: concurrent identical GETs share a single promise.
 * - Pattern-based invalidation: mutations (POST/PUT/PATCH/DELETE) drop matching entries.
 * - Safe by default: only successful (status 2xx) GET responses are cached;
 *   auth, refresh, file-streaming and per-request opt-outs are bypassed.
 *
 * Persistence: valid entries are mirrored to sessionStorage so a full reload
 * (or the PWA being resumed) reuses them instead of re-fetching everything.
 * Persistence NEVER extends staleness — entries still expire at their original
 * `expiresAt`, so the worst-case age across a reload is the same TTL that
 * applies within a session. The blob is per-tab (sessionStorage), versioned,
 * and wiped by clearCache() on logout so it never crosses users.
 *
 * Revalidate-on-focus: when the tab becomes visible again after being away,
 * entries older than FOCUS_STALE_MS are expired so the next request (navigation
 * or a visibility-gated poll) refetches fresh data — mirroring React Query's
 * refetchOnWindowFocus without a second caching layer.
 */

import type { AxiosRequestConfig } from 'axios'

const MAX_ENTRIES = 250

type CacheEntry = {
  data: unknown
  expiresAt: number
  cachedAt: number
}

const store = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

const DEFAULT_TTL_MS = 60 * 1000

// --- Persistence + focus-revalidation config ---
const PERSIST_KEY = 'lms:api-cache:v1'
// Bump when the entry shape or a deploy should invalidate any persisted blob.
const PERSIST_VERSION = 1
// On regaining focus, treat anything older than this as stale so it refetches.
const FOCUS_STALE_MS = 10 * 1000
const hasWindow = typeof window !== 'undefined'
const sessionStore: Storage | null = (() => {
  try {
    return hasWindow ? window.sessionStorage : null
  } catch {
    return null // Storage can throw in private-mode / sandboxed iframes.
  }
})()

/**
 * Per-endpoint TTL rules. The first matching pattern wins.
 * URLs are matched against the path portion of the request URL.
 * A TTL of 0 disables caching for the endpoint.
 */
const TTL_RULES: Array<{ test: RegExp; ttlMs: number }> = [
  // Never cache
  { test: /^\/auth\//, ttlMs: 0 },
  { test: /^\/messages\//, ttlMs: 0 },
  { test: /^\/uploads?\//, ttlMs: 0 },
  { test: /\/download(\b|\/)/, ttlMs: 0 },
  { test: /\/export(\b|\/)/, ttlMs: 0 },

  // Very short - frequently changing
  { test: /^\/dashboard\//, ttlMs: 30 * 1000 },
  { test: /^\/daily-questions\//, ttlMs: 30 * 1000 },
  { test: /^\/gamification\//, ttlMs: 30 * 1000 },
  { test: /^\/leaderboard\//, ttlMs: 30 * 1000 },
  { test: /^\/assignments\/.*\/submissions/, ttlMs: 30 * 1000 },
  { test: /\/progress\//, ttlMs: 30 * 1000 },

  // Medium - mostly stable read data
  { test: /^\/progress\/student\/overview/, ttlMs: 60 * 1000 },
  { test: /^\/admin\/dashboard/, ttlMs: 60 * 1000 },
  { test: /^\/curator-tasks\//, ttlMs: 60 * 1000 },
  { test: /^\/analytics\//, ttlMs: 60 * 1000 },
  { test: /^\/events\//, ttlMs: 60 * 1000 },
  { test: /^\/users\//, ttlMs: 2 * 60 * 1000 },
  { test: /^\/groups\//, ttlMs: 2 * 60 * 1000 },

  // Long - course content rarely changes inside a session
  { test: /^\/courses\//, ttlMs: 5 * 60 * 1000 },
  { test: /^\/lessons\//, ttlMs: 5 * 60 * 1000 },
  { test: /^\/quizzes\//, ttlMs: 5 * 60 * 1000 },
  { test: /^\/flashcards\//, ttlMs: 5 * 60 * 1000 },
]

/**
 * Mutation-to-GET invalidation rules. When a mutation matches `mutation`,
 * any cached GET key starting with one of the listed prefixes is dropped.
 */
const INVALIDATION_RULES: Array<{ mutation: RegExp; invalidatePrefixes: string[] }> = [
  { mutation: /^\/courses(\/|$)/, invalidatePrefixes: ['/courses', '/progress', '/dashboard', '/analytics'] },
  { mutation: /^\/modules(\/|$)/, invalidatePrefixes: ['/courses', '/modules', '/progress'] },
  { mutation: /^\/lessons(\/|$)/, invalidatePrefixes: ['/courses', '/lessons', '/progress'] },
  { mutation: /^\/steps(\/|$)/, invalidatePrefixes: ['/courses', '/lessons', '/progress'] },
  { mutation: /^\/assignments(\/|$)/, invalidatePrefixes: ['/assignments', '/dashboard', '/progress', '/analytics'] },
  { mutation: /^\/assignment-zero(\/|$)/, invalidatePrefixes: ['/assignment-zero', '/dashboard'] },
  { mutation: /^\/progress(\/|$)/, invalidatePrefixes: ['/progress', '/dashboard', '/analytics', '/courses'] },
  { mutation: /^\/quizzes(\/|$)/, invalidatePrefixes: ['/quizzes', '/progress', '/analytics'] },
  { mutation: /^\/events(\/|$)/, invalidatePrefixes: ['/events', '/dashboard'] },
  { mutation: /^\/users(\/|$)/, invalidatePrefixes: ['/users', '/groups', '/admin'] },
  { mutation: /^\/groups(\/|$)/, invalidatePrefixes: ['/groups', '/users', '/courses', '/analytics'] },
  { mutation: /^\/admin(\/|$)/, invalidatePrefixes: ['/admin', '/users', '/courses', '/dashboard'] },
  { mutation: /^\/leaderboard(\/|$)/, invalidatePrefixes: ['/leaderboard', '/student-journal'] },
  { mutation: /^\/curator-tasks(\/|$)/, invalidatePrefixes: ['/curator-tasks', '/student-journal'] },
  { mutation: /^\/student-journal(\/|$)/, invalidatePrefixes: ['/student-journal', '/curator-tasks'] },
  { mutation: /^\/flashcards(\/|$)/, invalidatePrefixes: ['/flashcards'] },
  { mutation: /^\/lesson-requests(\/|$)/, invalidatePrefixes: ['/lesson-requests', '/events'] },
  { mutation: /^\/media(\/|$)/, invalidatePrefixes: ['/courses'] },
]

const extractPath = (url: string): string => {
  if (!url) return ''
  // Strip baseURL or origin if axios passed an absolute URL.
  const cleaned = url.replace(/^https?:\/\/[^/]+/, '')
  // Drop query/hash; query is encoded into the key separately via params.
  const noQuery = cleaned.split('?')[0]?.split('#')[0] ?? ''
  if (!noQuery) return '/'
  return noQuery.startsWith('/') ? noQuery : `/${noQuery}`
}

const ttlForPath = (path: string): number => {
  for (const rule of TTL_RULES) {
    if (rule.test.test(path)) return rule.ttlMs
  }
  return DEFAULT_TTL_MS
}

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return `{${keys.map((k) => `${k}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
}

export const buildCacheKey = (url: string, config?: AxiosRequestConfig): string => {
  const path = extractPath(url)
  const params = config?.params ? stableStringify(config.params) : ''
  return `${path}::${params}`
}

const isCacheableConfig = (config?: AxiosRequestConfig & { cache?: boolean | { ttl?: number } }): boolean => {
  if (!config) return true
  if (config.cache === false) return false
  if (config.responseType && config.responseType !== 'json') return false
  return true
}

const resolveTtl = (
  path: string,
  config?: AxiosRequestConfig & { cache?: boolean | { ttl?: number } },
): number => {
  const override = typeof config?.cache === 'object' ? config.cache?.ttl : undefined
  if (typeof override === 'number') return override
  return ttlForPath(path)
}

const enforceLimit = (): void => {
  while (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value
    if (!oldestKey) break
    store.delete(oldestKey)
  }
}

export const getCached = <T = unknown,>(key: string): T | undefined => {
  const entry = store.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    store.delete(key)
    return undefined
  }
  // Touch for LRU-ish behavior.
  store.delete(key)
  store.set(key, entry)
  return entry.data as T
}

export const setCached = (key: string, data: unknown, ttlMs: number): void => {
  if (!ttlMs || ttlMs <= 0) return
  const now = Date.now()
  store.set(key, { data, expiresAt: now + ttlMs, cachedAt: now })
  enforceLimit()
  schedulePersist()
}

export const getInflight = <T = unknown,>(key: string): Promise<T> | undefined => {
  return inflight.get(key) as Promise<T> | undefined
}

export const trackInflight = <T,>(key: string, promise: Promise<T>): Promise<T> => {
  inflight.set(key, promise as Promise<unknown>)
  const cleanup = () => inflight.delete(key)
  promise.then(cleanup, cleanup)
  return promise
}

export const invalidateByPrefix = (prefix: string): number => {
  let removed = 0
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(`${prefix}/`) || key.startsWith(`${prefix}::`) || key === prefix) {
      store.delete(key)
      removed += 1
    }
  }
  return removed
}

export const invalidateForMutation = (url: string): void => {
  const path = extractPath(url)
  if (!path) return
  const prefixes = new Set<string>()
  for (const rule of INVALIDATION_RULES) {
    if (rule.mutation.test(path)) {
      rule.invalidatePrefixes.forEach((p) => prefixes.add(p))
    }
  }
  // Always invalidate the resource's own prefix as a safety net.
  const firstSegment = path.split('/').filter(Boolean)[0]
  if (firstSegment) prefixes.add(`/${firstSegment}`)
  prefixes.forEach((p) => invalidateByPrefix(p))
}

export const clearCache = (): void => {
  store.clear()
  inflight.clear()
  if (persistTimer !== null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  try {
    sessionStore?.removeItem(PERSIST_KEY)
  } catch {
    /* ignore */
  }
}

// --- sessionStorage persistence (debounced) ---
let persistTimer: ReturnType<typeof setTimeout> | null = null

const persistNow = (): void => {
  persistTimer = null
  if (!sessionStore) return
  const now = Date.now()
  const entries: Array<[string, CacheEntry]> = []
  for (const [key, entry] of store) {
    if (entry.expiresAt > now) entries.push([key, entry])
  }
  try {
    if (entries.length === 0) {
      sessionStore.removeItem(PERSIST_KEY)
    } else {
      sessionStore.setItem(PERSIST_KEY, JSON.stringify({ v: PERSIST_VERSION, entries }))
    }
  } catch {
    // Quota exceeded or serialization failure: drop the persisted copy rather
    // than throw. In-memory cache keeps working.
    try {
      sessionStore.removeItem(PERSIST_KEY)
    } catch {
      /* ignore */
    }
  }
}

const schedulePersist = (): void => {
  if (!sessionStore || persistTimer !== null) return
  persistTimer = setTimeout(persistNow, 500)
}

const hydrate = (): void => {
  if (!sessionStore) return
  let raw: string | null = null
  try {
    raw = sessionStore.getItem(PERSIST_KEY)
  } catch {
    return
  }
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as { v?: number; entries?: Array<[string, CacheEntry]> }
    if (parsed.v !== PERSIST_VERSION || !Array.isArray(parsed.entries)) {
      sessionStore.removeItem(PERSIST_KEY)
      return
    }
    const now = Date.now()
    for (const [key, entry] of parsed.entries) {
      // Honor the original expiry — persistence never extends staleness.
      if (entry && typeof entry.expiresAt === 'number' && entry.expiresAt > now) {
        store.set(key, {
          data: entry.data,
          expiresAt: entry.expiresAt,
          cachedAt: typeof entry.cachedAt === 'number' ? entry.cachedAt : now,
        })
      }
    }
    enforceLimit()
  } catch {
    try {
      sessionStore.removeItem(PERSIST_KEY)
    } catch {
      /* ignore */
    }
  }
}

// --- Revalidate on focus ---
// When the tab regains visibility, expire anything older than FOCUS_STALE_MS so
// the next request refetches. Cheap (a Map sweep) and only runs on focus.
const expireStaleOnFocus = (): void => {
  const now = Date.now()
  let changed = false
  for (const [key, entry] of Array.from(store)) {
    if (now - entry.cachedAt > FOCUS_STALE_MS) {
      store.delete(key)
      changed = true
    }
  }
  if (changed) schedulePersist()
}

if (hasWindow) {
  hydrate()
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') expireStaleOnFocus()
  })
  window.addEventListener('focus', expireStaleOnFocus)
}

export const isCacheableGet = (
  method: string | undefined,
  url: string | undefined,
  config?: AxiosRequestConfig & { cache?: boolean | { ttl?: number } },
): boolean => {
  if ((method ?? 'get').toLowerCase() !== 'get') return false
  if (!url) return false
  if (!isCacheableConfig(config)) return false
  const path = extractPath(url)
  if (!path) return false
  if (resolveTtl(path, config) <= 0) return false
  return true
}

export const getTtlForUrl = (
  url: string,
  config?: AxiosRequestConfig & { cache?: boolean | { ttl?: number } },
): number => resolveTtl(extractPath(url), config)
