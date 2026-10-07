import { api } from './client';

/**
 * Web push endpoints (lms-backend notification center, src/notifications/routes.py). The
 * browser's PushSubscription goes to the server as `subscription.toJSON()`; the server sends
 * pushes to it with its VAPID key pair. Re-posting the same endpoint (another account signing in
 * on this browser) moves it to the current user.
 */
export interface WebPushSubscriptionJson {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

/**
 * The server's VAPID public key (base64url), or null when push isn't set up on the server
 * (`{"public_key": null}`, or a server that predates the endpoint: 404): the UI then treats push
 * as unsupported instead of failing on a tap.
 */
export async function getWebPushPublicKey(): Promise<string | null> {
  try {
    const response = await api.get('/me/web-push/public-key', { cache: false } as never);
    const key = (response.data as { public_key?: string | null } | undefined)?.public_key;
    return typeof key === 'string' && key ? key : null;
  } catch (error) {
    const status = (error as { response?: { status?: number }; status?: number })?.response?.status ?? (error as { status?: number })?.status;
    if (status === 404 || status === 501 || status === 503) return null;
    throw error;
  }
}

/** Idempotent on the endpoint: saving the same subscription again just refreshes it. */
export async function saveWebPushSubscription(subscription: WebPushSubscriptionJson): Promise<void> {
  await api.post('/me/web-push-subscriptions', {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    // Lets the person tell their devices apart in a list of them (the server keeps 300 chars).
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  });
}

/** By query string: some proxies drop a DELETE's body. */
export async function deleteWebPushSubscription(endpoint: string): Promise<void> {
  await api.delete('/me/web-push-subscriptions', { params: { endpoint } });
}
