import { io, type Socket } from 'socket.io-client';
import { liveApi, type Requester } from '../lib/liveLesson/api';
import { client as defaultClient, type ApiClient } from './api';
import { API_BASE } from './config';

/**
 * The live lesson from the Meet panel: the same `/live` API over the panel's Bearer client, and a
 * Socket.IO connection of its own. The panel has no cookies, so the socket authenticates with the
 * panel's access token, read afresh on every (re)connect.
 */
export function panelRequester(api: Pick<ApiClient, 'request'> = defaultClient): Requester {
  return <T,>(path: string, init?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }) => api.request<T>(path, {
    method: init?.method ?? 'GET',
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export const panelLive = liveApi(panelRequester());

let socket: Socket | null = null;

export function panelSocket(): Socket {
  if (socket) return socket;
  socket = io(API_BASE, {
    path: '/ws/socket.io',
    auth: (cb) => cb({ token: defaultClient.tokens.accessToken ?? '' }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  return socket;
}

/** Where the presenter view opens: the LMS site that served the panel. */
export function presenterUrl(id: number): string {
  return `${window.location.origin}/live/present/${id}`;
}
