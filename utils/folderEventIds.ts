import type { EventFolder } from '../types/EventFolder';

/**
 * id всех событий, разложенных по папкам.
 *
 * Событие, убранное в папку, из общей сетки «меморис» пропадает: папка и есть
 * его новое место. Раньше сетка складывалась из папок И всех прошедших
 * событий подряд, поэтому одна и та же карточка стояла и в папке, и рядом с
 * ней — в своём профиле и в чужом одинаково.
 *
 * Список событий у папки приходит в двух формах: массив самих событий и
 * массив связок `{ event }` (см. EventFolderEvent). Разбираем обе.
 */
export function collectFolderEventIds(
  folders?: Array<EventFolder | null | undefined> | null,
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(folders)) return ids;

  folders.forEach(folder => {
    const items = (folder as any)?.events;
    if (!Array.isArray(items)) return;
    items.forEach((item: any) => {
      const id = item?.event?.id ?? item?.id ?? item?.eventId;
      if (typeof id === 'string' && id) ids.add(id);
    });
  });

  return ids;
}
