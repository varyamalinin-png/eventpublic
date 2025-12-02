import type { Event, EventRequest, EventProfile } from '../types';
import { createLogger } from './logger';

const logger = createLogger('eventUtils');

/**
 * Получить DateTime события
 */
export const getEventDateTime = (event: Event): Date => {
  if (!event?.date || !event?.time) return new Date(0);
  const [hh, mm] = event.time.split(':').map((v: string) => parseInt(v, 10));
  return new Date(event.date + 'T' + `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
};

/**
 * Получить список принятых участников события
 */
export const getAcceptedParticipants = (
  eventId: string,
  events: Event[],
  eventProfiles: EventProfile[],
  eventRequests: EventRequest[],
  resolveRequestUserId: (request: EventRequest) => string | null,
  getUserData: (userId: string) => { avatar: string },
  knownUserIds: string[],
): string[] => {
  const event = events.find(e => e.id === eventId);
  if (!event) return [];
  
  const participants = new Set<string>();
  
  // Добавляем участников из eventProfile
  const profile = eventProfiles.find(p => p.eventId === eventId);
  if (profile) {
    profile.participants.forEach(id => participants.add(id));
  }
  
  // Добавляем участников из accepted requests
  const acceptedRequests = eventRequests.filter(
    req => req.eventId === eventId && req.status === 'accepted'
  );
  acceptedRequests.forEach(req => {
    const participantId = resolveRequestUserId(req);
    if (participantId) {
      participants.add(participantId);
    }
  });
  
  // Добавляем участников из participantsData
  if (event.participantsData) {
    event.participantsData.forEach(p => {
      if (p.userId) {
        participants.add(p.userId);
      }
    });
  }
  
  // Добавляем участников из participantsList (через avatar -> userId)
  if (event.participantsList) {
    event.participantsList.forEach(avatar => {
      for (const uid of knownUserIds) {
        const user = getUserData(uid);
        if (user.avatar === avatar) {
          participants.add(uid);
          break;
        }
      }
    });
  }
  
  return Array.from(participants);
};

/**
 * Проверка, является ли событие предстоящим
 */
export const isEventUpcoming = (event: Event, getEventDateTime: (event: Event) => Date): boolean => {
  // Для регулярных событий проверяем ближайшую будущую дату
  if (event.isRecurring) {
    const now = Date.now();
    const [hh, mm] = event.time.split(':').map((v: string) => parseInt(v, 10));
    
    switch (event.recurringType) {
      case 'daily':
        // Ежедневные события всегда предстоящие
        return true;
        
      case 'weekly':
      case 'monthly':
        // Для weekly и monthly события всегда предстоящие (они повторяются)
        return true;
        
      case 'custom':
        // Для custom проверяем, есть ли хотя бы одна будущая дата
        if (event.recurringCustomDates && event.recurringCustomDates.length > 0) {
          const hasFutureDate = event.recurringCustomDates.some(dateStr => {
            const dateTime = new Date(dateStr + 'T' + `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
            return dateTime.getTime() > now;
          });
          return hasFutureDate;
        }
        return false;
        
      default:
        // Для неизвестного типа используем стандартную логику
        const eventDateTime = getEventDateTime(event);
        return eventDateTime.getTime() > Date.now();
    }
  }
  
  // Для обычных событий проверяем дату события
  const eventDateTime = getEventDateTime(event);
  return eventDateTime.getTime() > Date.now();
};

/**
 * Проверка, является ли событие прошедшим
 */
export const isEventPast = (event: Event): boolean => {
  // Для регулярных событий проверяем ближайшую будущую дату
  if (event.isRecurring) {
    const now = Date.now();
    const [hh, mm] = event.time.split(':').map((v: string) => parseInt(v, 10));
    
    switch (event.recurringType) {
      case 'daily':
        // Для ежедневных событий проверяем время сегодня
        // Если время уже прошло сегодня, событие будет завтра
        const today = new Date();
        today.setHours(hh, mm || 0, 0, 0);
        // Событие прошедшее только если оно было в прошлом и больше не повторяется
        // Для ежедневных событий это никогда (они всегда актуальны)
        return false;
        
      case 'weekly':
      case 'monthly':
        // Для weekly и monthly проверяем, есть ли еще будущие даты
        // Ближайшая дата - это дата из event.date
        const eventDateTime = new Date(event.date + 'T' + `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
        // Если текущая дата прошла, ищем следующую
        if (eventDateTime.getTime() <= now) {
          // Для weekly/monthly событий, если первая дата прошла, 
          // событие все еще актуально (будет на следующей неделе/месяце)
          return false;
        }
        return false;
        
      case 'custom':
        // Для custom проверяем, есть ли хотя бы одна будущая дата
        if (event.recurringCustomDates && event.recurringCustomDates.length > 0) {
          // Сбрасываем время для корректного сравнения только по дате
          const nowDateOnly = new Date();
          nowDateOnly.setHours(0, 0, 0, 0);
          
          const hasFutureDate = event.recurringCustomDates.some(dateStr => {
            // dateStr может быть в формате "YYYY-MM-DD" или Date объект
            const dateOnly = typeof dateStr === 'string' 
              ? new Date(dateStr + 'T00:00:00')
              : new Date(dateStr);
            dateOnly.setHours(0, 0, 0, 0);
            return dateOnly >= nowDateOnly;
          });
          // Событие прошедшее только если все даты в прошлом
          return !hasFutureDate;
        }
        // Если дат нет - считаем событие прошедшим (невалидное событие)
        return true;
        
      default:
        return false;
    }
  }
  
  // Для обычных событий проверяем дату события
  const eventDateTime = new Date(event.date + 'T' + event.time + ':00');
  return eventDateTime.getTime() <= Date.now();
};

/**
 * Проверка, набрано ли событие (достигнут максимум участников)
 */
export const isEventFull = (
  event: Event,
  getAcceptedParticipants: (eventId: string) => string[],
): boolean => {
  const acceptedParticipants = getAcceptedParticipants(event.id);
  return acceptedParticipants.length >= event.maxParticipants;
};

/**
 * Проверка, является ли пользователь организатором события
 */
export const isUserOrganizer = (event: Event, userId: string, resolveUserId: (userId: string) => string): boolean => {
  const resolvedUserId = resolveUserId(userId);
  return event.organizerId === resolvedUserId;
};

/**
 * Проверка, является ли пользователь участником события (принятый, но не организатор)
 */
export const isUserAttendee = (
  event: Event,
  userId: string,
  resolveUserId: (userId: string) => string,
  getAcceptedParticipants: (eventId: string) => string[],
  getUserData: (userId: string) => { avatar: string },
): boolean => {
  const resolvedUserId = resolveUserId(userId);
  if (event.organizerId === resolvedUserId) return false; // Организатор не является участником
  
  const acceptedParticipants = getAcceptedParticipants(event.id);
  const isInAccepted = acceptedParticipants.includes(resolvedUserId);
  
  // Дополнительная проверка через participantsData и participantsList
  // Это важно для случаев, когда userId есть в данных, но не в eventRequests
  if (event.participantsData) {
    const foundInParticipantsData = event.participantsData.some(p => p.userId === resolvedUserId);
    if (foundInParticipantsData) return true;
  }
  
  // Проверяем через participantsList (avatar -> userId mapping)
  if (event.participantsList) {
    const userData = getUserData(resolvedUserId);
    const foundInParticipantsList = event.participantsList.includes(userData.avatar);
    if (foundInParticipantsList) return true;
  }
  
  return isInAccepted;
};

/**
 * Проверка, является ли пользователь членом события (организатор ИЛИ принятый участник)
 */
export const isUserEventMember = (
  event: Event,
  userId: string,
  resolveUserId: (userId: string) => string,
  getAcceptedParticipants: (eventId: string) => string[],
  getUserData: (userId: string) => { avatar: string },
): boolean => {
  return isUserOrganizer(event, userId, resolveUserId) || 
         isUserAttendee(event, userId, resolveUserId, getAcceptedParticipants, getUserData);
};

/**
 * Получить список участников события (включая организатора)
 */
export const getEventParticipants = (
  eventId: string,
  events: Event[],
  eventProfiles: EventProfile[],
  eventRequests: EventRequest[],
  resolveRequestUserId: (request: EventRequest) => string | null,
  getUserData: (userId: string) => { avatar: string },
  knownUserIds: string[],
): string[] => {
  const event = events.find(e => e.id === eventId);
  if (!event) return [];
  
  // Всегда начинаем с организатора
  const participants = new Set<string>([event.organizerId]);
  
  // Добавляем участников из eventProfile
  const profile = eventProfiles.find(p => p.eventId === eventId);
  if (profile) {
    profile.participants.forEach(id => participants.add(id));
  }
  
  // Добавляем участников из accepted requests
  const acceptedRequests = eventRequests.filter(
    req => req.eventId === eventId && req.status === 'accepted'
  );
  acceptedRequests.forEach(req => {
    const participantId = resolveRequestUserId(req);
    if (participantId) {
      participants.add(participantId);
    }
  });
  
  // Добавляем участников из participantsData
  if (event.participantsData) {
    event.participantsData.forEach(p => {
      if (p.userId) {
        participants.add(p.userId);
      }
    });
  }
  
  // Добавляем участников из participantsList (через avatar -> userId)
  if (event.participantsList) {
    event.participantsList.forEach(avatar => {
      for (const uid of knownUserIds) {
        const user = getUserData(uid);
        if (user.avatar === avatar) {
          participants.add(uid);
          break;
        }
      }
    });
  }
  
  return Array.from(participants);
};

