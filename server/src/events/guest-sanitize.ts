/**
 * Гостевая выдача событий.
 *
 * Анонимный посетитель (без JWT) видит ленту и карточки, но точные дата,
 * время и место открываются только после регистрации — в клиенте они
 * рисуются заблюренными. Поэтому здесь эти поля не «прячутся», а
 * физически вырезаются из ответа: всё, что уехало анониму в JSON,
 * никакой клиентский блюр уже не защитит.
 *
 * Что остаётся: заголовок, описание, обложка, цена, теги, лимит мест,
 * организатор (id/имя/username/аватар) и ЧИСЛО участников — этого хватает,
 * чтобы карточка выглядела настоящей.
 */
export function sanitizeEventForGuest<T extends Record<string, any>>(event: T | null): T | null {
  if (!event) return event;

  const memberships = Array.isArray(event.memberships) ? event.memberships : [];
  const participantsCount = memberships.filter((m: any) => m?.status === 'ACCEPTED').length;

  const organizer = event.organizer
    ? {
        id: event.organizer.id,
        name: event.organizer.name,
        username: event.organizer.username,
        avatarUrl: event.organizer.avatarUrl,
      }
    : event.organizer;

  return {
    ...event,
    startTime: null,
    endTime: null,
    recurringCustomDates: [],
    location: null,
    latitude: null,
    longitude: null,
    memberships: [],
    personalPhotos: [],
    organizer,
    participantsCount,
  };
}

export function sanitizeEventsForGuest<T extends Record<string, any>>(events: T[]): T[] {
  return (events ?? []).map((event) => sanitizeEventForGuest(event) as T);
}
