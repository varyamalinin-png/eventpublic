/**
 * Утилиты для фильтрации событий
 * Централизованная логика проверки участия пользователя в событиях
 */

import type { Event, EventProfile } from '../types';
import { isEventPast, isEventUpcoming } from './eventHelpers';

/**
 * Проверяет, является ли пользователь участником события
 * Для будущих событий - через обычную проверку
 * Для прошедших событий - через eventProfiles.participants
 */
export function isUserEventParticipant(
  event: Event,
  userId: string,
  eventProfiles: EventProfile[]
): boolean {
  if (!event || !userId) return false;

  // Для будущих событий используем стандартную проверку
  if (isEventUpcoming(event)) {
    // Проверяем через organizerId и participantsData/participantsList
    if (event.organizerId === userId) return true;
    
    if (event.participantsData && Array.isArray(event.participantsData)) {
      return event.participantsData.some((p: any) => p.userId === p.id === userId);
    }
    
    if (event.participantsList && Array.isArray(event.participantsList)) {
      return event.participantsList.includes(userId);
    }
    
    return false;
  }

  // Для прошедших событий проверяем через eventProfiles
  if (isEventPast(event)) {
    const profile = eventProfiles.find(p => p.eventId === event.id);
    if (profile) {
      return profile.participants.includes(userId);
    }
    // Если профиля нет - пользователь не участник (был удален)
    return false;
  }

  return false;
}

/**
 * Фильтрует события, где пользователь является участником
 */
export function filterUserEvents(
  events: Event[],
  userId: string,
  eventProfiles: EventProfile[]
): Event[] {
  return events.filter(event => isUserEventParticipant(event, userId, eventProfiles));
}

/**
 * Фильтрует будущие события пользователя
 */
export function filterUpcomingUserEvents(
  events: Event[],
  userId: string,
  eventProfiles: EventProfile[]
): Event[] {
  return events.filter(event => 
    isEventUpcoming(event) && isUserEventParticipant(event, userId, eventProfiles)
  );
}

/**
 * Фильтрует прошедшие события пользователя
 */
export function filterPastUserEvents(
  events: Event[],
  userId: string,
  eventProfiles: EventProfile[]
): Event[] {
  return events.filter(event => 
    isEventPast(event) && isUserEventParticipant(event, userId, eventProfiles)
  );
}

