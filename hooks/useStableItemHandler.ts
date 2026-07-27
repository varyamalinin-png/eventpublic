import { useCallback, useRef } from 'react';

/**
 * Стабильный колбэк на элемент списка.
 *
 * EventCard и другие карточки обёрнуты в memo, но `onPress={() => handle(item)}`
 * создаёт новую ссылку на каждый рендер списка, и мемоизация не срабатывает ни
 * разу. Здесь на каждый id приходится одна и та же функция.
 *
 * Сам элемент и обработчик читаются из рефов в момент вызова, а не в момент
 * создания колбэка — иначе стабильная ссылка означала бы залипший объект
 * события со старыми данными.
 */
export function useStableItemHandler<T extends { id: string }>(
  items: readonly T[],
  handler: (item: T) => void,
): (id: string) => () => void {
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const cache = useRef(new Map<string, () => void>()).current;

  return useCallback((id: string) => {
    let fn = cache.get(id);
    if (!fn) {
      fn = () => {
        const item = itemsRef.current.find(i => i.id === id);
        if (item) handlerRef.current(item);
      };
      cache.set(id, fn);
    }
    return fn;
  }, [cache]);
}
