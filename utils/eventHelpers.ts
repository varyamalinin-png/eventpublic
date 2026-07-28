import type { Event } from '../types';

// Утилиты для работы с событиями
export const getEventDateTime = (event: Event): Date => {
  // event.date — локальная дата вида YYYY-MM-DD. new Date('YYYY-MM-DD') разбирает
  // её как полночь UTC, после чего setHours работает уже в локальном поясе — пара
  // получалась разнородной. Собираем момент сразу из локальных компонентов.
  const [hh, mm] = event.time.split(':').map(Number);
  const [y, mo, d] = event.date.split('-').map(Number);
  return new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
};

export const isEventUpcoming = (event: Event): boolean => {
  const eventDateTime = getEventDateTime(event);
  return eventDateTime.getTime() > Date.now();
};

export const isEventPast = (event: Event): boolean => {
  const eventDateTime = getEventDateTime(event);
  return eventDateTime.getTime() <= Date.now();
};

