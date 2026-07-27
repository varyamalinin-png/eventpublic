import type { User } from '../types';
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
