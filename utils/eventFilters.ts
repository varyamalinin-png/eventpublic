/**
 * Утилиты для фильтрации событий
 * Централизованная логика проверки участия пользователя в событиях
 */

import type { Event, EventProfile } from '../types';
import { isEventPast, isEventUpcoming } from './eventHelpers';

/**
 * Проверяет, является ли пользователь участником события
 * Использует единую логику для всех событий (предстоящих и прошедших)
 * @deprecated Используйте isUserEventMember из EventsContext вместо этой функции
 */
export function isUserEventParticipant(
  event: Event,
  userId: string,
  eventProfiles?: EventProfile[] // Оставлено для обратной совместимости, но не используется
): boolean {
  if (!event || !userId) return false;

<<<<<<< HEAD
  // Для будущих событий используем стандартную проверку
  if (isEventUpcoming(event)) {
    // Проверяем через organizerId и participantsData/participantsList
    if (event.organizerId === userId) return true;
    
    if (event.participantsData && Array.isArray(event.participantsData)) {
      return event.participantsData.some((p: any) => p.userId === userId || p.id === userId);
    }
    
    if (event.participantsList && Array.isArray(event.participantsList)) {
      return event.participantsList.includes(userId);
    }
    
    return false;
=======
  // Проверяем через organizerId и participantsData/participantsList
  if (event.organizerId === userId) return true;
  
  if (event.participantsData && Array.isArray(event.participantsData)) {
    return event.participantsData.some((p: any) => (p.userId || p.id) === userId);
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
  }
  
  if (event.participantsList && Array.isArray(event.participantsList)) {
    return event.participantsList.includes(userId);
  }
  
  return false;
}

/**
 * Фильтрует события, где пользователь является участником
 * @deprecated Используйте фильтрацию через EventsContext напрямую
 */
export function filterUserEvents(
  events: Event[],
  userId: string,
  eventProfiles?: EventProfile[] // Оставлено для обратной совместимости, но не используется
): Event[] {
  return events.filter(event => isUserEventParticipant(event, userId, eventProfiles));
}

/**
 * Фильтрует будущие события пользователя
 * @deprecated Используйте фильтрацию через EventsContext напрямую
 */
export function filterUpcomingUserEvents(
  events: Event[],
  userId: string,
  eventProfiles?: EventProfile[] // Оставлено для обратной совместимости, но не используется
): Event[] {
  return events.filter(event => 
    isEventUpcoming(event) && isUserEventParticipant(event, userId, eventProfiles)
  );
}

/**
 * Фильтрует прошедшие события пользователя
 * @deprecated Используйте фильтрацию через EventsContext напрямую
 */
export function filterPastUserEvents(
  events: Event[],
  userId: string,
  eventProfiles?: EventProfile[] // Оставлено для обратной совместимости, но не используется
): Event[] {
  return events.filter(event => 
    isEventPast(event) && isUserEventParticipant(event, userId, eventProfiles)
  );
}

