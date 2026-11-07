import { useCallback, useEffect, useRef, useState } from 'react';
import { readQueryCache, writeQueryCache } from '../utils/queryCache';

/**
 * stale-while-revalidate: сразу отдаёт последний известный ответ, потом молча
 * обновляет его с сервера.
 *
 * Три вещи, ради которых это написано:
 *
 *  1. Первый рендер берёт данные из кэша СИНХРОННО — экран не бывает пустым,
 *     если его уже открывали (в том числе в прошлый запуск приложения).
 *  2. `loading` означает «данных нет вообще», а не «идёт запрос». Только по нему
 *     стоит показывать скелетон: при обновлении уже показанного списка мигать
 *     плейсхолдерами не нужно.
 *  3. Новый ответ применяется, только если он ОТЛИЧАЕТСЯ от показанного. Иначе
 *     каждый фоновый запрос перерисовывал бы список — то самое «обновление на
 *     глазах», которого быть не должно.
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T | null>,
  options?: { auto?: boolean },
) {
  const [data, setData] = useState<T | null>(() => readQueryCache<T>(key));
  const [refreshing, setRefreshing] = useState(false);
  // Сам факт неудачи отдаём наружу: экран без данных должен показать это и дать
  // повторить, а не висеть скелетоном без объяснений.
  const [failed, setFailed] = useState(false);
  const serializedRef = useRef<string | null>(
    data === null ? null : JSON.stringify(data),
  );
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Смена ключа (другой пользователь) — подставляем его кэш, не показывая чужой.
  useEffect(() => {
    const cached = readQueryCache<T>(key);
    setData(cached);
    serializedRef.current = cached === null ? null : JSON.stringify(cached);
  }, [key]);

  const refresh = useCallback(async () => {
    if (!key) return;
    setRefreshing(true);
    try {
      const fresh = await fetcherRef.current();
      setFailed(false);
      if (fresh === null || fresh === undefined) return;
      const serialized = JSON.stringify(fresh);
      writeQueryCache(key, fresh);
      if (serialized !== serializedRef.current) {
        serializedRef.current = serialized;
        setData(fresh);
      }
    } catch {
      setFailed(true);
      /**
       * Ошибку гасим намеренно.
       *
       * Без этого промис отклонялся прямо в эффекте — и, что важнее, экран,
       * у которого ещё нет данных, оставался в скелетоне НАВСЕГДА: повторить
       * запрос было некому. Ровно так и вышло с лентой меморис: первый запрос
       * уходил в общем всплеске при старте приложения, упирался в ограничитель
       * частоты, и лента больше не загружалась до перезапуска.
       *
       * Кто хочет повторить — вызывает refresh() снова (например, при
       * возвращении на экран).
       */
    } finally {
      setRefreshing(false);
    }
  }, [key]);

  // auto: false — когда обновление уже привязано к появлению экрана
  // (useFocusEffect). Иначе при первом монтаже ушло бы два одинаковых запроса.
  const auto = options?.auto !== false;
  useEffect(() => {
    if (auto) refresh();
  }, [auto, refresh]);

  return { data, loading: data === null && !failed, failed, refreshing, refresh, setData };
}
