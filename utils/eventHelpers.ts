import type { Event } from '../types';

// Утилиты для работы с событиями
export const getEventDateTime = (event: Event): Date => {
  const [hh, mm] = event.time.split(':').map(Number);
  const date = new Date(event.date);
  date.setHours(hh, mm, 0, 0);
  return date;
};

export const isEventUpcoming = (event: Event): boolean => {
  const eventDateTime = getEventDateTime(event);
  return eventDateTime.getTime() > Date.now();
};

export const isEventPast = (event: Event): boolean => {
  const eventDateTime = getEventDateTime(event);
  return eventDateTime.getTime() <= Date.now();
};

