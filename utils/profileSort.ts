import type { Event } from '../types';
import type { EventFolder } from '../types/EventFolder';
import { getEventDateTime } from './eventHelpers';

/** Время события и папки для сортировки.
 *  ВАЖНО: одни и те же функции используются и сеткой профиля, и лентой —
 *  раньше сетка ставила папку по её самому свежему событию, а лента по дате
 *  СОЗДАНИЯ папки, из-за чего порядок в этих двух режимах не совпадал.
 *  Живут здесь, а не в файле экрана: их использует и профиль другого
 *  пользователя, а импортировать один экран из другого нельзя. */
export const eventSortTime = (e: Event) => {
  try {
    return getEventDateTime(e).getTime();
  } catch {
    return 0;
  }
};

export const folderSortTime = (f: EventFolder) => {
  // Элементы папки приходят как event либо как обёртка { event }
  const inFolder: Event[] = Array.isArray(f.events)
    ? f.events.map((item: any) => (item?.event || item) as Event).filter((e: Event) => e && e.id)
    : [];
  if (inFolder.length > 0) {
    const times = inFolder.map(eventSortTime).filter(n => n > 0);
    if (times.length > 0) return Math.max(...times);
  }
  const fallback = f.duration?.end || f.updatedAt || f.createdAt;
  const parsed = fallback ? new Date(fallback).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};
