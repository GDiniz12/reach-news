'use client';

import { UserProfile } from './types';

const LOCAL_AFFINITY_KEY = 'reach_news_local_affinity';
const TOKEN_KEY = 'reach_news_token';
const SESSION_USER_KEY = 'reach_news_session_user';
const SESSION_EXPIRES_KEY = 'reach_news_session_expires_at';
// Rolling session lifetime: 14 days (exceeds 1 week requirement and auto-renews on every app visit/interaction)
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function saveAuthSession(token: string, user?: UserProfile | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    const expiresAt = Date.now() + SESSION_TTL_MS;
    localStorage.setItem(SESSION_EXPIRES_KEY, String(expiresAt));

    if (user) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore storage quota errors
  }
}

export function touchAuthSession(newToken?: string, updatedUser?: UserProfile | null) {
  if (typeof window === 'undefined') return;
  try {
    const existingToken = newToken || localStorage.getItem(TOKEN_KEY);
    if (!existingToken) return;
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    }
    localStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + SESSION_TTL_MS));
    if (updatedUser) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(updatedUser));
    }
  } catch {
    // ignore
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_EXPIRES_KEY);
  } catch {
    // ignore
  }
}

export function getCachedAuthSession(): {
  token: string | null;
  user: UserProfile | null;
} {
  if (typeof window === 'undefined') return { token: null, user: null };
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { token: null, user: null };
    }

    const expiresRaw = localStorage.getItem(SESSION_EXPIRES_KEY);
    if (expiresRaw) {
      const expiresAt = Number(expiresRaw);
      if (!isNaN(expiresAt) && Date.now() > expiresAt) {
        clearAuthSession();
        return { token: null, user: null };
      }
    } else {
      // Initialize rolling window if legacy token had no timestamp yet
      localStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + SESSION_TTL_MS));
    }

    let user: UserProfile | null = null;
    const rawUser = localStorage.getItem(SESSION_USER_KEY);
    if (rawUser) {
      user = JSON.parse(rawUser) as UserProfile;
    }

    // Renew rolling window on read
    localStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + SESSION_TTL_MS));

    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

/**
 * Validates and refreshes the user session against `/api/auth/me` with automatic retries
 * so backend cold-starts or momentary network blips never leave the user appearing logged out.
 */
export async function syncSessionWithBackend(apiBaseUrl: string): Promise<{
  token: string | null;
  user: UserProfile | null;
  unauthorized: boolean;
}> {
  const cached = getCachedAuthSession();
  if (!cached.token) {
    return { token: null, user: null, unauthorized: false };
  }

  let delay = 1000;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${cached.token}` },
      });

      if (res.status === 401) {
        clearAuthSession();
        return { token: null, user: null, unauthorized: true };
      }

      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          const activeToken = data.token || cached.token;
          saveAuthSession(activeToken, data.user);
          return { token: activeToken, user: data.user, unauthorized: false };
        }
      }

      if (res.status >= 500 && attempt < 2) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 1.5;
        continue;
      }
      break;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 1.5;
        continue;
      }
    }
  }

  // If network/server was temporarily unreachable, keep the cached user session alive!
  return { token: cached.token, user: cached.user, unauthorized: false };
}

export type TelemetryEventType = 'view' | 'dwell' | 'bookmark' | 'chat' | 'radar';

const EVENT_WEIGHTS: Record<TelemetryEventType, number> = {
  view: 2,
  dwell: 4,
  chat: 5,
  radar: 5,
  bookmark: 6,
};

export function getLocalAffinityMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_AFFINITY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

export function seedLocalInterests(interests: string[]) {
  if (typeof window === 'undefined') return;
  const current = getLocalAffinityMap();
  for (const interest of interests) {
    const k = interest.toLowerCase().trim();
    current[k] = Math.max(current[k] || 0, 15);
  }
  localStorage.setItem(LOCAL_AFFINITY_KEY, JSON.stringify(current));
}

export async function recordUserSignal(params: {
  apiBaseUrl: string;
  token?: string | null;
  storyId?: string;
  category: string;
  topicTag?: string;
  eventType: TelemetryEventType;
}) {
  const { apiBaseUrl, token, storyId, category, topicTag, eventType } = params;
  if (!category) return;

  const points = EVENT_WEIGHTS[eventType] || 2;
  const catKey = category.toLowerCase().trim();
  const tagKey = topicTag ? topicTag.toLowerCase().trim() : '';

  // 1. Always update local affinity map in browser for instant responsiveness & renew session TTL
  if (typeof window !== 'undefined') {
    touchAuthSession();
    const current = getLocalAffinityMap();
    current[catKey] = Math.round(((current[catKey] || 0) + points) * 10) / 10;
    if (tagKey && tagKey.length >= 2 && tagKey !== catKey) {
      current[`tag:${tagKey}`] =
        Math.round(((current[`tag:${tagKey}`] || 0) + points * 0.8) * 10) / 10;
    }
    localStorage.setItem(LOCAL_AFFINITY_KEY, JSON.stringify(current));
  }

  // 2. If user is signed in, sync telemetry signal to PostgreSQL
  if (token) {
    try {
      await fetch(`${apiBaseUrl}/api/auth/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storyId,
          category: catKey,
          topicTag: tagKey || undefined,
          eventType,
        }),
      });
    } catch {
      // ignore network error
    }
  }
}
