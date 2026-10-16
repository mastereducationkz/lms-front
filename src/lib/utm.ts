/** Where a visitor came from, kept for the whole visit so it survives going from the page to the form. */
const KEY = 'ow:attribution';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export interface Attribution {
  utm: Record<string, string>;
  referer?: string;
}

export function captureAttribution(search: string = window.location.search, referrer: string = document.referrer): Attribution {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Attribution;
  } catch {
    /* storage blocked: read it fresh each time */
  }
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) utm[key] = value.slice(0, 200);
  }
  const found: Attribution = { utm, referer: referrer ? referrer.slice(0, 500) : undefined };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(found));
  } catch {
    /* ignore */
  }
  return found;
}
