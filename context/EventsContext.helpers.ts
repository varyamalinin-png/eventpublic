import type { Event, User } from '../types';
import type { UserProfilePatch } from './EventsContext.types';
import { API_BASE_URL } from '../services/api';
import { getEventDateTime } from '../utils/eventHelpers';
import type { ServerUser } from '../types/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('EventsHelpers');

// Функция для вычисления возраста из dateOfBirth
export const calculateAge = (dateOfBirth: string | Date | null | undefined): string | undefined => {
  if (!dateOfBirth) return undefined;
  
  try {
    const birthDate = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    if (isNaN(birthDate.getTime())) return undefined;
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age > 0 ? `${age} лет` : undefined;
  } catch (error) {
    logger.warn('Failed to calculate age from dateOfBirth:', error);
    return undefined;
  }
};

export const DEFAULT_AVATAR_URL = 'https://cdn.jsdelivr.net/gh/identicons/jasonlong/resources/png/identicon.png';

export const mapServerUserToClient = (user: ServerUser): User => {
  if (!user?.id) {
    throw new Error('Invalid user payload');
  }
  return {
    id: user.id,
    name: user.name ?? user.username ?? 'Пользователь',
    username: user.username ?? '',
    avatar: String(user.avatarUrl ?? DEFAULT_AVATAR_URL),
    bio: user.bio ?? '',
    age: user.age ?? '',
    geoPosition: user.geoPosition ?? '',
  };
};

export const isHttpUrl = (value?: string | null): boolean => {
  if (!value) return false;
  return /^https?:\/\/.+/i.test(value.trim());
};


// Ниже — функции, вынесенные из провайдера: они не замыкались на состояние
// (пустой список зависимостей у useCallback), значит это обычные чистые функции.

export const mergeUserRecord = (record: Record<string, UserProfilePatch>, userId: string, updates: UserProfilePatch) => {
  const nextEntry: UserProfilePatch = { ...(record[userId] ?? {}) };
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      delete nextEntry[key as keyof UserProfilePatch];
    } else {
      (nextEntry as any)[key] = value;
    }
  });
  if (Object.keys(nextEntry).length === 0) {
    const { [userId]: _removed, ...rest } = record;
    return rest;
  }
  return {
    ...record,
    [userId]: nextEntry,
  };
};

export const normalizeMediaUrl = (input?: string | null): string | undefined => {
  if (!input) return undefined;
  try {
    // Получаем storage URL из переменной окружения (поддерживаем и EXPO_PUBLIC для мобильных, и NEXT_PUBLIC для веба)
    const storageUrl = (typeof process !== 'undefined' && process.env) 
      ? (process.env.NEXT_PUBLIC_STORAGE_URL || process.env.EXPO_PUBLIC_STORAGE_URL || 'https://iwent.ru/storage')
      : 'https://iwent.ru/storage';
    
    // Заменяем старые origin на актуальный, остальную часть пути сохраняем
    let normalized = input;

    // Исправляем известные “битые” demo-URL (Wikimedia иногда удаляет/перемещает файлы → 404).
    // Делаем это здесь, чтобы починить и кэшированные на клиенте карточки.
    const DEMO_URL_FIXES: Record<string, string> = {
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Phoenicopterus_ruber_ruber.jpg/1200px-Phoenicopterus_ruber_ruber.jpg':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Phoenicopterus_ruber_Bonaire_1.jpg/1200px-Phoenicopterus_ruber_Bonaire_1.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Siberian_tiger_at_Columbus_Zoo.jpg/1200px-Siberian_tiger_at_Columbus_Zoo.jpg':
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Siberian_Tiger_by_Malene_Th.jpg/1200px-Siberian_Tiger_by_Malene_Th.jpg',
    };
    normalized = DEMO_URL_FIXES[normalized] ?? normalized;

    // Заменяем старые IP адреса на актуальный
    normalized = normalized.replace(/http:\/\/192\.168\.0\.\d+:9000/g, storageUrl);
    normalized = normalized.replace(/http:\/\/192\.168\.0\.\d+:4000/g, storageUrl);
    normalized = normalized.replace(/https?:\/\/(www\.)?iventapp\.ru/gi, 'https://iwent.ru');

    return normalized || undefined;
  } catch {
    return input || undefined;
  }
};

export const isEventUpcoming = (event: Event): boolean => {
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
