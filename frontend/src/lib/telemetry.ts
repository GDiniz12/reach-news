'use client';

const LOCAL_AFFINITY_KEY = 'reach_news_local_affinity';

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

  // 1. Always update local affinity map in browser for instant responsiveness
  if (typeof window !== 'undefined') {
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
