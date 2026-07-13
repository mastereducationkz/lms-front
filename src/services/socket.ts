import { io, Socket } from 'socket.io-client';
import { isAuthenticated } from './api';

const RAW_API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const API_BASE_URL = (typeof window !== 'undefined' && window.location.protocol === 'https:' && RAW_API_BASE_URL.startsWith('http://'))
  ? RAW_API_BASE_URL.replace('http://', 'https://')
  : RAW_API_BASE_URL;

let socket: Socket | null = null;
let lastToken: string | null = null;

// Access token is stored in cookies by TokenManager. We forward it via extraHeaders.
function getAccessTokenFromCookie(): string | null {
  const name = 'access_token=';
  const parts = document.cookie.split(';');
  for (let c of parts) {
    c = c.trim();
    if (c.startsWith(name)) return decodeURIComponent(c.substring(name.length));
  }
  return null;
}

export function connectSocket(): Socket {
  const token = getAccessTokenFromCookie();

  // Reuse the existing socket whenever the token still matches — whether it is already
  // connected OR still connecting/reconnecting. Previously, a socket that existed but was
  // not yet `.connected` fell through and `io(..., forceNew:true)` spawned a SECOND socket,
  // orphaning the first (which kept its own reconnection loop + listeners running). Three
  // components call connectSocket() together on mount, so that leaked one socket per mount.
  if (socket) {
    const currentAuthToken = (socket as any)?.auth?.token ?? null;
    if (currentAuthToken !== token) {
      // Token changed (login/refresh/logout) — tear the old one down and rebuild below.
      try { socket.disconnect(); } catch {}
      socket = null;
    } else {
      // Same token: hand back the single shared instance. If it was fully stopped (not
      // actively (re)connecting), nudge it back to life instead of building a new one.
      if (!socket.connected && !socket.active) {
        try { socket.connect(); } catch {}
      }
      return socket;
    }
  }

  socket = io(API_BASE_URL, {
    path: '/ws/socket.io',
    withCredentials: true,
    // Browsers cannot send custom headers over WS; use auth payload
    auth: token ? { token } : undefined,
    autoConnect: isAuthenticated(),
    // Optimized reconnection settings for better stability
    reconnection: true,
    reconnectionAttempts: 5,  // Limited attempts instead of Infinity
    reconnectionDelay: 1000,  // Start with 1s delay
    reconnectionDelayMax: 10000,  // Max 10s delay
    timeout: 20000,  // 20s connection timeout
    // Prefer WebSocket, but allow fallback to polling if WS isn't available
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    forceNew: true,
  });

  lastToken = token;

  // Add connection event listeners for debugging
  socket.on('connect', () => {
    console.log('🔗 Socket.IO connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.IO disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket.IO connection error:', error);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    // Refresh auth token before each reconnect attempt
    const freshToken = getAccessTokenFromCookie();
    (socket as any).auth = freshToken ? { token: freshToken } : undefined;
    lastToken = freshToken;
    console.log('🔄 Socket.IO reconnection attempt:', attemptNumber);
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ Socket.IO reconnection error:', error);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Socket.IO reconnection failed');
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Call this after login/logout to force the socket to pick up a new token
export function refreshSocketAuth(): void {
  const current = getAccessTokenFromCookie();
  if (!socket) {
    if (isAuthenticated()) connectSocket();
    return;
  }
  if (current !== lastToken) {
    try { socket.disconnect(); } catch {}
    socket = null;
    connectSocket();
  }
}


