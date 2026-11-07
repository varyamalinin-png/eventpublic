import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from './logger';

const logger = createLogger('QueryCache');

/**
 * Маленький кэш серверных ответов, переживающий перезапуск приложения.
 *
 * Зачем: экран, который при каждом открытии ждёт сеть, секунду-другую показывает
 * пустоту, а потом дёргается, подставляя данные. Так себя не ведёт ни одна
 * крупная соцсеть — там открытая раньше страница появляется мгновенно, из
 * последнего known-good состояния, и только потом тихо обновляется. Это
 * называется stale-while-revalidate, и вот его основа.
 *
 * Два уровня:
 *  - Map в памяти — чтобы читать СИНХРОННО, прямо в первом рендере. Асинхронное
 *    чтение из хранилища не помогло бы: один кадр с пустым экраном всё равно
 *    случился бы.
 *  - AsyncStorage — чтобы кэш пережил закрытие приложения. Читается один раз при
 *    старте (hydrateQueryCache), пишется с задержкой, пачкой.
 *
 * Ключи формируем с id текущего пользователя (см. cacheKey), иначе после
 * переключения аккаунта человек увидел бы чужие данные.
 */

type Entry = { data: unknown; at: number };

const STORAGE_KEY = '@query_cache_v1';
/** Больше держать смысла нет: это кэш для мгновенной отрисовки, а не база. */
const MAX_ENTRIES = 300;
const WRITE_DEBOUNCE_MS = 800;

const memory = new Map<string, Entry>();
let hydrated = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/** Ключ, привязанный к аккаунту: `friends` у разных пользователей — разные данные. */
export function cacheKey(viewerId: string | null | undefined, ...parts: string[]): string {
  return `${viewerId ?? 'anon'}:${parts.join(':')}`;
}

function scheduleWrite() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    // Пишем только самые свежие записи — файл кэша не должен расти без предела.
    const entries = Array.from(memory.entries())
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_ENTRIES);
    memory.clear();
    entries.forEach(([key, entry]) => memory.set(key, entry));
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(error => {
      logger.debug('Не удалось сохранить кэш', error);
    });
  }, WRITE_DEBOUNCE_MS);
}

/** Вызывается один раз при старте приложения, до того как человек дойдёт до экранов. */
export async function hydrateQueryCache(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries: Array<[string, Entry]> = JSON.parse(raw);
    entries.forEach(([key, entry]) => {
      if (key && entry && typeof entry.at === 'number' && !memory.has(key)) {
        memory.set(key, entry);
      }
    });
    logger.debug(`Кэш восстановлен: ${memory.size} записей`);
  } catch (error) {
    // Битый кэш — не повод падать: просто начинаем с пустого.
    logger.debug('Не удалось прочитать кэш', error);
  }
}

export function readQueryCache<T>(key: string | null): T | null {
  if (!key) return null;
  const entry = memory.get(key);
  return entry ? (entry.data as T) : null;
}

export function writeQueryCache(key: string | null, data: unknown): void {
  if (!key) return;
  memory.set(key, { data, at: Date.now() });
  scheduleWrite();
}

/** Полная очистка — при выходе из аккаунта. */
export function clearQueryCache(): void {
  memory.clear();
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}
