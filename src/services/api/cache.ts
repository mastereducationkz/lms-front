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
 * The cache is intentionally NOT persisted to storage; it lives only for the
 * lifetime of the page so we never serve stale data across full reloads.
 */

import type { AxiosRequestConfig } from 'axios'

const MAX_ENTRIES = 250

type CacheEntry = {
  data: unknown
  expiresAt: number
}

const store = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

const DEFAULT_TTL_MS = 60 * 1000

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

export const getCached = <T = unknown>(key: string): T | undefined => {
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
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
  enforceLimit()
}

export const getInflight = <T = unknown>(key: string): Promise<T> | undefined => {
  return inflight.get(key) as Promise<T> | undefined
}

export const trackInflight = <T>(key: string, promise: Promise<T>): Promise<T> => {
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
