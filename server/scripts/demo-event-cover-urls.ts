/**
 * Прямые HTTPS-URL обложек для демо/заполнения пустых событий.
 * Храним файлы в нашем Object Storage (публичное чтение) — Wikimedia часто даёт 404.
 */

import fallback from './fallback-event-cover-urls.json';

export const DEMO_EVENT_COVER_URLS: string[] = fallback.urls;

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Обложка карточки и оригинал (чуть другой индекс для разнообразия). */
export function demoCoverUrls(seedKey: string): { mediaUrl: string; originalMediaUrl: string } {
  const n = DEMO_EVENT_COVER_URLS.length;
  const i = hashSeed(seedKey) % n;
  const j = (i + 7 + (hashSeed(seedKey + '-o') % (n - 1 || 1))) % n;
  return {
    mediaUrl: DEMO_EVENT_COVER_URLS[i]!,
    originalMediaUrl: DEMO_EVENT_COVER_URLS[j]!,
  };
}
