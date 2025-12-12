// Типы для серверных ответов API

import type { User, UserFolder } from './User';
import type { Event } from './Event';
import type { EventRequest, FriendRequest } from './Request';
import type { Chat, ChatMessage, MessageFolder } from './Chat';
import type { EventProfile, EventProfilePost } from './EventProfile';
import type { Notification } from './Notification';

/**
 * Серверный ответ с данными пользователя
 */
export interface ServerUser {
  id: string;
  name?: string;
  username?: string;
  avatar?: string;
  age?: string;
  bio?: string;
  geoPosition?: string;
  accountType?: 'personal' | 'business';
  dateOfBirth?: string;
  showAge?: boolean;
  [key: string]: unknown; // Для дополнительных полей
}

/**
 * Серверный ответ с данными события
 */
export interface ServerEventMembership {
  id?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  user?: ServerUser;
  userId?: string;
  [key: string]: unknown;
}

export interface ServerEventPersonalPhoto {
  userId: string;
  photoUrl: string;
  [key: string]: unknown;
}

export interface ServerEvent {
  id: string;
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  price?: string;
  participants?: number;
  maxParticipants?: number;
  organizerId?: string;
  organizer?: ServerUser;
  mediaUrl?: string;
  originalMediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaAspectRatio?: number;
  participantsList?: string[];
  participantsData?: Array<{ avatar?: string; userId?: string; name?: string; user?: ServerUser }>;
  memberships?: ServerEventMembership[];
  createdAt?: string;
  updatedAt?: string;
  personalPhotos?: ServerEventPersonalPhoto[] | Record<string, string>;
  ageRestriction?: { min: number; max: number };
  genderRestriction?: string[];
  visibility?: {
    type: 'all' | 'friends' | 'all_except_friends' | 'all_except_excluded' | 'only_me' | 'me_and_excluded';
    excludedUsers?: string[];
  };
  invitedUsers?: string[];
  isRecurring?: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurringDays?: number[];
  recurringDayOfMonth?: number;
  recurringCustomDates?: string[];
  tags?: string[];
  autoTags?: string[];
  customTags?: string[];
  startTime?: string;
  [key: string]: unknown;
}

/**
 * Серверный ответ с запросом на участие в событии
 */
export interface ServerEventRequest {
  id: string;
  eventId?: string;
  event?: ServerEvent;
  type?: 'join' | 'invite';
  status?: 'pending' | 'accepted' | 'rejected';
  fromUserId?: string;
  fromUser?: ServerUser;
  toUserId?: string;
  toUser?: ServerUser;
  userId?: string; // Для обратной совместимости
  user?: ServerUser; // Для обратной совместимости
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Серверный ответ с запросом в друзья
 */
export interface ServerFriendRequest {
  id: string;
  requesterId?: string;
  requester?: ServerUser;
  addresseeId?: string;
  addressee?: ServerUser;
  status?: 'pending' | 'accepted' | 'rejected';
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Серверный ответ с чатом
 */
export interface ServerChat {
  id: string;
  type?: 'event' | 'personal';
  eventId?: string;
  event?: ServerEvent;
  name?: string;
  participants?: Array<{
    userId?: string;
    user?: ServerUser;
    [key: string]: unknown;
  }>;
  lastMessage?: ServerChatMessage;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Серверный ответ с сообщением чата
 */
export interface ServerChatMessage {
  id: string;
  chatId?: string;
  senderId?: string;
  fromUserId?: string;
  sender?: ServerUser;
  content?: string;
  text?: string;
  eventId?: string;
  postId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Серверный ответ с профилем события
 */
export interface ServerEventProfile {
  id: string;
  eventId?: string;
  event?: ServerEvent;
  name?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  participants?: Array<{
    userId?: string;
    user?: ServerUser;
    [key: string]: unknown;
  }>;
  organizerId?: string;
  organizer?: ServerUser;
  isCompleted?: boolean;
  hiddenParameters?: Record<string, unknown>;
  posts?: ServerEventProfilePost[];
  avatar?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Серверный ответ с постом профиля события
 */
export interface ServerEventProfilePost {
  id: string;
  eventId?: string;
  authorId?: string;
  author?: ServerUser;
  content?: string;
  photoUrl?: string;
  photoUrls?: string[];
  captions?: string[];
  caption?: string;
  comments?: Array<{
    id: string;
    postId: string;
    authorId: string;
    author?: ServerUser;
    content: string;
    createdAt?: string;
  }>;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Серверный ответ с папкой пользователей
 */
export interface ServerUserFolder {
  id: string;
  name?: string;
  userIds?: Array<{
    userId?: string;
    user?: ServerUser;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Серверный ответ с папкой сообщений
 */
export interface ServerMessageFolder {
  id: string;
  name?: string;
  type?: 'default' | 'custom';
  chats?: Array<{
    chatId?: string;
    chat?: ServerChat;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Серверный ответ с уведомлением
 */
export interface ServerNotification {
  id: string;
  userId?: string;
  type?: string;
  payload?: Record<string, unknown>;
  readAt?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

