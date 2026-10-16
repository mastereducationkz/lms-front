// Shared by the open-webinar page tests: a fake backend, in-memory storage and small DOM helpers.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vi } from 'vitest';
import type { ReactElement } from 'react';

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

export function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, String(value)); },
    removeItem: (key: string) => { items.delete(key); },
    clear: () => items.clear(),
  };
}

export const webinar = (over: Record<string, unknown> = {}) => ({
  slug: 'ielts-writing-2030-03-03', title: 'IELTS Writing Office Hours', description: 'Bring an essay.\nGet feedback.',
  access_mode: 'registration', starts_at: '2099-03-03T09:00:00Z', ends_at: '2099-03-03T10:30:00Z', join_opens_at: '2099-03-03T08:45:00Z',
  state: 'upcoming', join_url: null, registration_open: true, speaker: null, recording_slug: null,
  consent: { text_ru: 'RU consent text.', text_en: 'I consent to processing my data.', policy_version: 'abc12345', policy_ready: true },
  ...over,
});

type Reply = { status?: number; body: unknown };

/** Routes the page's fetches to canned replies, and remembers every call. */
export function fakeBackend(routes: Record<string, Reply | (() => Reply)>) {
  const calls: { url: string; method: string; body: Record<string, unknown> | null }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^https?:\/\/[^/]+/, '');
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    const route = routes[`${method} ${url}`];
    if (!route) return { ok: false, status: 404, json: async () => ({ detail: 'not found' }) } as Response;
    const reply = typeof route === 'function' ? route() : route;
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.body } as Response;
  });
  return { fetchMock, calls };
}

let root: Root | null = null;
export async function mount(element: ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(element); });
  await settle();
  return host;
}
export const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });
export async function unmount() {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
}
export async function type(selector: string, value: string) {
  const input = document.querySelector(selector) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
export const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); }); };
export const submit = async () => { await act(async () => { (document.querySelector('form') as HTMLFormElement).requestSubmit(); }); await settle(); };
export const text = () => document.body.textContent ?? '';
