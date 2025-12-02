import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { apiRequest, ApiError, API_BASE_URL } from '../services/api';
import { createSocketConnection, disconnectSocket, getSocket } from '../services/websocket';
import type { Socket } from 'socket.io-client';
import type {
  Event,
  User,
  UserFolder,
  FriendRequest,
  EventRequest,
  ScheduledEvent,
  Chat,
  ChatMessage,
  MessageFolder,
  EventProfile,
  EventProfilePost,
  Notification,
} from '../types';
import type { ServerUser, ServerEvent, ServerChat } from '../types/api';
import { formatDate, formatRecurringEventDate } from '../utils/dateHelpers';
import { createLogger } from '../utils/logger';
import { isUserEventParticipant, filterUserEvents, filterUpcomingUserEvents, filterPastUserEvents } from '../utils/eventFilters';
import { useNotifications } from '../hooks/notifications/useNotifications';
import { useFriends } from '../hooks/friends/useFriends';
import { useChats, mapServerMessageToClient } from '../hooks/chats/useChats';
import { useEventActions } from '../hooks/events/useEventActions';
import { useEventProfiles } from '../hooks/events/useEventProfiles';
import { useEventRequests } from '../hooks/events/useEventRequests';
import { useSavedEvents } from '../hooks/events/useSavedEvents';
import { useSavedMemoryPosts } from '../hooks/events/useSavedMemoryPosts';
import { useUserFolders } from '../hooks/folders/useUserFolders';
import { useMessageFolders } from '../hooks/folders/useMessageFolders';

// Создаем именованный логгер для EventsContext
const logger = createLogger('Events');

// Функция для вычисления возраста из dateOfBirth
const calculateAge = (dateOfBirth: string | Date | null | undefined): string | undefined => {
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

// Re-export types for backward compatibility
export type { 
  Event, 
  User, 
  UserFolder, 
  FriendRequest, 
  EventRequest, 
  ScheduledEvent, 
  Chat, 
  ChatMessage, 
  EventProfile, 
  EventProfilePost 
};

export type CreateEventInput = {
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  price?: string;
  maxParticipants: number;
  mediaUrl?: string; // Обрезанное фото для карточки
  originalMediaUrl?: string; // Оригинальное фото для профиля
  mediaType?: 'image' | 'video';
  mediaAspectRatio?: number;
  coordinates?: { latitude: number; longitude: number };
  ageRestriction?: {
    min: number;
    max: number;
  };
  genderRestriction?: string[];
  visibility?: {
    type: 'all' | 'friends' | 'all_except_friends' | 'all_except_excluded' | 'only_me' | 'me_and_excluded';
    excludedUsers?: string[];
  };
  invitedUsers?: string[];
  // Поля для регулярных событий
  isRecurring?: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurringDays?: number[];
  recurringDayOfMonth?: number;
  recurringCustomDates?: string[];
  // Метки (теги)
  tags?: string[];
  // Дополнительные поля
  targeting?: {
    enabled?: boolean;
    reach?: number;
    responses?: number;
  };
};

type UserProfilePatch = Partial<{
  name: string;
  username: string;
  avatar: string;
  age: string;
  bio: string;
  geoPosition: string;
  dateOfBirth: string;
  showAge: boolean;
  accountType: 'personal' | 'business';
}>;

type UserProfile = {
  name: string;
  username: string;
  avatar: string;
  age: string;
  bio: string;
  geoPosition: string;
  accountType?: 'personal' | 'business'; // Тип аккаунта: личный или бизнес
};

interface EventsContextType {
  events: Event[];
  createEvent: (input: CreateEventInput) => Promise<Event | null>;
  updateEvent: (id: string, updates: Partial<Event>) => void;
  deleteEvent: (id: string) => Promise<void>;
  getUserData: (userId: string) => UserProfile;
  updateUserData: (userId: string, updates: Partial<{ name: string; username: string; avatar: string; age: string; bio: string; geoPosition: string }>) => void;
  getOrganizerStats: (organizerId: string) => {
    totalEvents: number;
    organizedEvents: number;
    participatedEvents: number;
    complaints: number;
    friends: number;
  };
  // Система друзей
  friends: string[]; // ID друзей текущего пользователя
  friendRequests: FriendRequest[];
  sendFriendRequest: (toUserId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  respondToFriendRequest: (requestId: string, accepted: boolean) => Promise<void>;
  getFriendsList: () => User[];
  getUserFriendsList: (userId: string) => User[];
  isFriend: (userId: string) => boolean;
  getFriendsForEvents: () => Event[];
  // Система папок пользователей
  userFolders: UserFolder[];
  addUserToFolder: (userId: string, folderId: string) => Promise<void>;
  removeUserFromFolder: (userId: string, folderId: string) => Promise<void>;
  createUserFolder: (name: string) => Promise<void>;
  deleteUserFolder: (folderId: string) => Promise<void>;
  getEventsByUserFolder: (folderId: string) => Event[];
  messageFolders: MessageFolder[];
  refreshMessageFolders: () => Promise<void>;
  createMessageFolder: (name: string) => Promise<MessageFolder | null>;
  addChatsToMessageFolder: (folderId: string, chatIds: string[]) => Promise<void>;
  removeChatFromMessageFolder: (folderId: string, chatId: string) => Promise<void>;
  // Система чатов
  chats: Chat[];
  chatMessages: ChatMessage[];
  createEventChat: (eventId: string) => void;
  createEventChatWithParticipants: (eventId: string, firstAcceptedUserId: string) => void;
  createPersonalChat: (otherUserId: string) => Promise<string>;
  sendChatMessage: (chatId: string, text: string, eventId?: string, postId?: string) => Promise<void>;
  sendEventToChats: (eventId: string, chatIds: string[]) => Promise<void>;
  sendMemoryPostToChats: (eventId: string, postId: string, chatIds: string[]) => Promise<void>;
  getChatMessages: (chatId: string) => ChatMessage[];
  getChat: (chatId: string) => Chat | null;
  getChatsForUser: (userId: string) => Chat[];
  addParticipantToChat: (eventId: string, userId: string) => Promise<void>;
  // Система профилей событий
  eventRequests: EventRequest[];
  eventProfiles: EventProfile[];
  sendEventRequest: (eventId: string, userId: string) => void;
  sendEventInvite: (eventId: string, fromUserId: string, toUserId: string, event?: Event) => void; // Отправка приглашения на событие (event опционально для новых событий)
  acceptInvitation: (requestId: string) => Promise<void>; // Принятие приглашения (invited → accepted)
  rejectInvitation: (requestId: string) => Promise<void>; // Отклонение приглашения (invited → rejected)
  respondToEventRequest: (requestId: string, accepted: boolean) => void;
  cancelEventRequest: (eventId: string, userId: string) => void; // Отмена запроса на участие
  removeEventRequestById: (requestId: string) => void; // Удаление запроса по ID
  cancelEventParticipation: (eventId: string, userId: string) => void; // Отмена участия (удаление из участников)
  cancelEvent: (eventId: string) => void; // Отмена события (полное удаление)
  cancelOrganizerParticipation: (eventId: string) => void; // Отмена участия организатора (удаление организатора, событие остается)
  removeParticipantFromEvent: (eventId: string, userId: string) => void; // Удаление участника из события (для организатора)
  getEventProfile: (eventId: string) => EventProfile | null;
  fetchEventProfile: (eventId: string) => Promise<EventProfile | null>;
  createEventProfile: (eventId: string) => Promise<void>;
  addEventProfilePost: (eventId: string, post: Omit<EventProfilePost, 'id' | 'eventId' | 'createdAt'>) => Promise<void>;
  updateEventProfile: (eventId: string, updates: Partial<EventProfile>) => Promise<void>;
  updateEventProfilePost: (eventId: string, postId: string, updates: Partial<EventProfilePost>) => Promise<void>;
  getEventParticipants: (eventId: string) => string[];
  canEditEventProfile: (eventId: string, userId: string) => boolean;
  // Новые функции для системы участия
  getMyEventRequests: () => EventRequest[];
  getEventOrganizer: (eventId: string) => { name: string; username: string; avatar: string; age: string; bio: string; geoPosition: string } | null;
  getMyEventParticipationStatus: (eventId: string) => 'pending' | 'accepted' | 'rejected' | null;
  // Универсальная проверка участия пользователя в событии
  isUserParticipant: (event: Event, userId: string) => boolean;
  // Функции для календарей
  getMyCalendarEvents: () => Event[];
  getUserCalendarEvents: (userId: string) => Event[];
  getGlobalEvents: () => Event[];
  // Новая декларативная система состояний
  isEventUpcoming: (event: Event) => boolean;
  isEventPast: (event: Event) => boolean;
  isEventFull: (event: Event) => boolean;
  isEventNotFull: (event: Event) => boolean;
  isUserOrganizer: (event: Event, userId: string) => boolean;
  isUserAttendee: (event: Event, userId: string) => boolean;
  isUserEventMember: (event: Event, userId: string) => boolean;
  getUserRequestStatus: (event: Event, userId: string) => 'organizer' | 'accepted' | 'rejected' | 'pending' | 'not_requested';
  getUserRelationship: (event: Event, userId: string) => 'invited' | 'organizer' | 'accepted' | 'waiting' | 'rejected' | 'non_member';
  isFriendOfOrganizer: (event: Event, userId: string) => boolean;
  getAcceptedParticipants: (eventId: string) => string[];
  // Персонализированные фото событий
  getEventPhotoForUser: (eventId: string, userId: string, viewerUserId?: string, useOriginal?: boolean) => string | undefined;
  setPersonalEventPhoto: (eventId: string, userId: string, photoUrl: string) => void;
  // Сохраненные события
  savedEvents: string[];
  saveEvent: (eventId: string) => void;
  removeSavedEvent: (eventId: string) => void;
  isEventSaved: (eventId: string) => boolean;
  getSavedEvents: () => Event[];
  // Система сохраненных меморис постов
  savedMemoryPosts: Array<{ eventId: string; postId: string }>;
  saveMemoryPost: (eventId: string, postId: string) => void;
  removeSavedMemoryPost: (eventId: string, postId: string) => void;
  isMemoryPostSaved: (eventId: string, postId: string) => boolean;
  getSavedMemoryPosts: <T extends { id: string }>(eventProfiles: Array<{ eventId: string; posts: T[] }>) => Array<{ post: T; eventId: string }>;
  // Удаление и жалобы на меморис посты
  deleteEventProfilePost: (eventId: string, postId: string) => Promise<void>;
  reportMemoryPost: (eventId: string, postId: string) => Promise<void>;
  // Система уведомлений
  notifications: Notification[];
  unreadNotificationsCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  // Поиск пользователей по username
  findUserByUsername: (username: string) => Promise<User | null>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
}

const EventsContext = createContext<EventsContextType | undefined>(undefined);

export const useEvents = () => {
  const context = useContext(EventsContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
};

interface EventsProviderProps {
  children: ReactNode;
}

// formatDate теперь импортируется из utils/dateHelpers

export function EventsProvider({ children }: EventsProviderProps) {
  const { accessToken, refreshToken, initializing: authInitializing, user: authUser, logout, refreshSession } = useAuth();
  const { language } = useLanguage();
  const currentUserId = authUser?.id ?? null;
  const [isSyncing, setIsSyncing] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  // userFolders и setUserFolders теперь в useUserFolders хуке
  // messageFolders и setMessageFolders теперь в useMessageFolders хуке
  // Состояние чатов теперь в useChats хуке
  // eventRequests и setEventRequests теперь в useEventRequests хуке
  // eventProfiles и setEventProfiles теперь в useEventProfiles хуке
  // savedEvents и setSavedEvents теперь в useSavedEvents хуке
  // savedMemoryPosts и setSavedMemoryPosts теперь в useSavedMemoryPosts хуке
  const [serverUserData, setServerUserData] = useState<Record<string, UserProfilePatch>>({});
  const [userDataUpdates, setUserDataUpdates] = useState<Record<string, UserProfilePatch>>({});
  // loadedChatMessages теперь в useChats хуке
  // creatingProfiles теперь в useEventProfiles хуке
  // Ref для отслеживания актуального токена (для предотвращения использования старого токена после переключения аккаунта)
  const currentAccessTokenRef = useRef<string | null>(accessToken);
  const currentUserIdRef = useRef<string | null>(currentUserId);
  
  // Обновляем ref при изменении токена или пользователя
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
    currentUserIdRef.current = currentUserId;
  }, [accessToken, currentUserId]);

  // Функция для обработки ошибок авторизации (нужно объявить до использования в хуках)
  const handleUnauthorizedError = useCallback(
    async (error: unknown) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        // КРИТИЧЕСКИ ВАЖНО: Сначала пытаемся обновить токен
        // Только если refresh не удался - вызываем logout
        if (refreshToken && refreshToken.trim() !== '' && refreshSession) {
          try {
            logger.debug('Attempting to refresh token before logout...');
            await refreshSession(refreshToken);
            // Если refresh успешен, токен обновлен, не нужно logout
            return false;
          } catch (refreshError) {
            logger.warn('Token refresh failed, proceeding with logout', refreshError);
            // Refresh не удался, продолжаем с logout
          }
        }
        
        // Если refresh не удался или нет refreshToken - вызываем logout
        try {
          await logout();
        } catch (logoutError) {
          logger.warn('Failed to logout after auth error', logoutError);
        }
        return true;
      }
      return false;
    },
    [logout, refreshToken, refreshSession],
  );

  const mergeUserRecord = useCallback((record: Record<string, UserProfilePatch>, userId: string, updates: UserProfilePatch) => {
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
  }, []);


  const resolveUserId = useCallback(
    (userId: string | null) => {
      if (!userId) return '';
      if (userId === 'own-profile-1' && currentUserId) {
        return currentUserId;
      }
      return userId;
    },
    [currentUserId],
  );

  // knownUserIds будет объявлен после всех хуков, так как использует переменные из них

  // resolveRequestUserId и requestBelongsToUser теперь в useEventRequests хуке

  // Нормализация ссылок медиа (устраняем старый IP в уже сохраненных URL)
  const normalizeMediaUrl = useCallback((input?: string | null): string | undefined => {
    if (!input) return undefined;
    try {
      // Получаем storage URL из переменной окружения или используем дефолтный
      const storageUrl = process.env.EXPO_PUBLIC_STORAGE_URL || 'http://192.168.0.39:9000';
      
      // Заменяем старые origin на актуальный, остальную часть пути сохраняем
      let normalized = input;
      // Заменяем старые IP адреса на актуальный
      normalized = normalized.replace(/http:\/\/192\.168\.0\.\d+:9000/g, storageUrl);
      normalized = normalized.replace(/http:\/\/192\.168\.0\.\d+:4000/g, storageUrl);
      
      return normalized || undefined;
    } catch {
      return input || undefined;
    }
  }, []);

  const applyServerUserDataToState = useCallback(
    (serverUser: ServerUser | any) => {
      if (!serverUser || !serverUser.id) {
        return;
      }

      // Вычисляем возраст из dateOfBirth, если он есть
      const computedAge = serverUser.dateOfBirth 
        ? calculateAge(serverUser.dateOfBirth) 
        : undefined;

      setServerUserData(prev =>
        mergeUserRecord(prev, serverUser.id, {
          name: serverUser.name ?? undefined,
          username: serverUser.username ?? undefined,
          avatar: normalizeMediaUrl(serverUser.avatarUrl as string | null | undefined) ?? undefined,
          age: computedAge ?? serverUser.age ?? undefined,
          bio: serverUser.bio ?? undefined,
          geoPosition: serverUser.geoPosition ?? undefined,
          dateOfBirth: serverUser.dateOfBirth ?? undefined,
          showAge: serverUser.showAge ?? undefined,
        }),
      );
    },
    [mergeUserRecord, normalizeMediaUrl],
  );

  // Используем хук для работы с друзьями
  const {
    friends,
    friendRequests,
    userFriendsMap,
    sendFriendRequest,
    removeFriend,
    respondToFriendRequest,
    syncFriendsFromServer,
    syncFriendRequestsFromServer,
    setFriends,
    setFriendRequests,
    setUserFriendsMap,
  } = useFriends({
    accessToken,
    currentUserId,
    handleUnauthorizedError,
    applyServerUserDataToState,
  });

  // Используем ref для функций из useChats, чтобы избежать циклической зависимости
  const syncChatsFromServerRef = useRef<(() => Promise<void>) | null>(null);
  const addParticipantToChatRef = useRef<((eventId: string, userId: string) => Promise<void>) | null>(null);
  const createEventChatWithParticipantsRef = useRef<((eventId: string, userId: string) => Promise<void>) | null>(null);
  const setChatsRef = useRef<React.Dispatch<React.SetStateAction<Chat[]>> | null>(null);
  const chatsRef = useRef<Chat[]>([]);

  // Временные функции-обертки для функций из useChats
  const syncChatsFromServerWrapper = useCallback(async () => {
    if (syncChatsFromServerRef.current) {
      return syncChatsFromServerRef.current();
    }
    return Promise.resolve();
  }, []);

  const addParticipantToChatWrapper = useCallback(async (eventId: string, userId: string) => {
    if (addParticipantToChatRef.current) {
      return addParticipantToChatRef.current(eventId, userId);
    }
    return Promise.resolve();
  }, []);

  const createEventChatWithParticipantsWrapper = useCallback(async (eventId: string, userId: string) => {
    if (createEventChatWithParticipantsRef.current) {
      return createEventChatWithParticipantsRef.current(eventId, userId);
    }
    return Promise.resolve();
  }, []);

  const setChatsWrapper = useCallback((value: Chat[] | ((prev: Chat[]) => Chat[])) => {
    if (setChatsRef.current) {
      setChatsRef.current(value);
    }
  }, []);

  // Используем ref для updateEvent, чтобы избежать циклической зависимости
  const updateEventRef = useRef<((id: string, updates: Partial<Event>) => Promise<void>) | null>(null);

  // Временная функция-обертка для updateEvent
  const updateEventWrapper = useCallback(async (id: string, updates: Partial<Event>) => {
    if (updateEventRef.current) {
      return updateEventRef.current(id, updates);
    }
    // Fallback - обновляем локально, если updateEvent еще не определен
    setEvents(prev => prev.map(event => event.id === id ? { ...event, ...updates } : event));
  }, [setEvents]);

  // getUserData должен быть определен ПЕРЕД вызовом useEventRequests
  const getUserData = useCallback((userId: string): UserProfile => {
    const resolvedId = resolveUserId(userId);

    const serverPatch = serverUserData[resolvedId] ?? {};
    const localPatch = userDataUpdates[resolvedId] ?? {};

    const baseName = authUser && resolvedId === authUser.id ? authUser.name : serverPatch.name;
    const baseUsername =
      authUser && resolvedId === authUser.id
        ? authUser.username ?? (authUser.email ? authUser.email.split('@')[0] : undefined)
        : serverPatch.username;
    const baseAvatar =
      authUser && resolvedId === authUser.id ? authUser.avatarUrl ?? serverPatch.avatar : serverPatch.avatar;
    const baseBio = authUser && resolvedId === authUser.id ? authUser.bio ?? serverPatch.bio : serverPatch.bio;
    const baseGeo =
      authUser && resolvedId === authUser.id
        ? authUser.geoPosition ?? serverPatch.geoPosition
        : serverPatch.geoPosition;
    
    // Получаем dateOfBirth и showAge
    const dateOfBirth = localPatch.dateOfBirth ?? serverPatch.dateOfBirth ?? 
      (authUser && resolvedId === authUser.id && authUser.dateOfBirth ? authUser.dateOfBirth : undefined);
    const showAge = localPatch.showAge ?? serverPatch.showAge ?? 
      (authUser && resolvedId === authUser.id && authUser.showAge !== undefined ? authUser.showAge : true);
    
    // Вычисляем возраст из dateOfBirth, если он есть
    const computedAge = dateOfBirth ? calculateAge(dateOfBirth) : undefined;
    const baseAge = computedAge ?? (authUser && resolvedId === authUser.id ? authUser.age : undefined) ?? serverPatch.age;

    // Получаем accountType
    const baseAccountType = authUser && resolvedId === authUser.id 
      ? (authUser.accountType ?? serverPatch.accountType)
      : serverPatch.accountType;
    const accountType = localPatch.accountType ?? baseAccountType ?? 'personal';

    return {
      name: localPatch.name ?? baseName ?? 'Пользователь',
      username: localPatch.username ?? baseUsername ?? 'user',
      avatar: (() => {
        const chosen = localPatch.avatar ?? baseAvatar;
        if (chosen && chosen.trim() !== '') return chosen;
        // Фолбэк: возьмем обложку любого события, где пользователь организатор
        const organizerEvent = events.find(e => e.organizerId === resolvedId && e.mediaUrl);
        return organizerEvent?.mediaUrl ?? DEFAULT_AVATAR_URL;
      })(),
      age: (() => {
        // Если showAge = false, не показываем возраст
        if (showAge === false) {
          return '';
        }
        return localPatch.age ?? baseAge ?? '';
      })(),
      bio: localPatch.bio ?? baseBio ?? '',
      geoPosition: localPatch.geoPosition ?? baseGeo ?? '',
      accountType,
    };
  }, [authUser, serverUserData, userDataUpdates, events, resolveUserId]);

  // Используем хук для работы с запросами на участие в событиях
  const {
    eventRequests,
    setEventRequests,
    refreshPendingJoinRequests,
    sendEventRequest,
    sendEventInvite,
    acceptInvitation,
    rejectInvitation,
    respondToEventRequest,
    cancelEventRequest,
    cancelEventParticipation,
    removeEventRequestById,
    resolveRequestUserId,
    requestBelongsToUser,
  } = useEventRequests({
    accessToken,
    currentUserId,
    refreshToken,
    handleUnauthorizedError,
    refreshSession,
    applyServerUserDataToState,
    events,
    setEvents,
    setEventProfiles,
    setChats: setChatsWrapper,
    updateEvent: updateEventWrapper,
    syncEventsFromServer,
    syncChatsFromServer: syncChatsFromServerWrapper,
    createEventProfile,
    addParticipantToChat: addParticipantToChatWrapper,
    createEventChatWithParticipants: createEventChatWithParticipantsWrapper,
    getUserData,
    isUserEventMember,
    isEventPast,
    resolveUserId,
    chats: chatsRef.current,
    eventProfiles,
  });

  // Используем хук для работы с чатами
  const {
    chats,
    chatMessages,
    syncChatsFromServer,
    createEventChat,
    createEventChatWithParticipants,
    createPersonalChat,
    sendChatMessage,
    getChatMessages,
    getChat,
    getChatsForUser,
    addParticipantToChat,
    fetchMessagesForChat,
    setChats,
    setChatMessages,
  } = useChats({
    accessToken,
    currentUserId,
    handleUnauthorizedError,
    applyServerUserDataToState,
    events,
    eventRequests,
    eventProfiles,
    resolveRequestUserId,
    getUserData,
  });

  // Обновляем refs после определения функций из useChats
  // Используем useEffect для обновления refs, чтобы избежать проблем с порядком выполнения
  useEffect(() => {
    syncChatsFromServerRef.current = syncChatsFromServer;
    addParticipantToChatRef.current = addParticipantToChat;
    createEventChatWithParticipantsRef.current = createEventChatWithParticipants;
    setChatsRef.current = setChats;
    chatsRef.current = chats;
  }, [syncChatsFromServer, addParticipantToChat, createEventChatWithParticipants, setChats, chats]);

  // Функция для проверки, является ли пользователь другом другого пользователя
  // Используется для проверки возможности приглашения
  const isUserInFriendsList = (userId: string, friendId: string): boolean => {
    const userFriends = userFriendsMap[userId] || [];
    return userFriends.includes(friendId);
  };

  // createEvent, updateEvent, deleteEvent, cancelEvent, cancelOrganizerParticipation, removeParticipantFromEvent
  // теперь в useEventActions хуке (вызывается после fetchEventProfile)

  // Используем хук для действий с событиями
  // (вызывается после fetchEventProfile ниже)
  // getUserData теперь определен выше, перед вызовом useEventRequests

  // Функция для обновления данных пользователя
  const updateUserData = (userId: string, updates: UserProfilePatch) => {
    setServerUserData(prev => mergeUserRecord(prev, userId, updates));
    setUserDataUpdates(prev => mergeUserRecord(prev, userId, updates));
  };

  // Эти функции теперь находятся в useEventActions hook

  // Функции updateEvent и deleteEvent теперь находятся в useEventActions hook

  // Поиск пользователя по username (без учета регистра и символа @)
  const findUserByUsername = useCallback(async (username: string): Promise<User | null> => {
    const cleanUsername = username.startsWith('@') ? username.slice(1).toLowerCase() : username.toLowerCase();
    
    // Сначала проверяем локальный кэш
    for (const userId of knownUserIds) {
      const userData = getUserData(userId);
      if (userData.username.toLowerCase() === cleanUsername) {
        return {
          id: userId,
          ...userData
        };
      }
    }
    
    // Если не найдено локально, ищем на бэкенде
    if (accessToken) {
      try {
        const response = await apiRequest(
          `/users/search?username=${encodeURIComponent(cleanUsername)}`,
          { method: 'GET' },
          accessToken,
        );
        
        if (response && response.length > 0) {
          const user = response[0];
          const mappedUser = mapServerUserToClient(user);
          applyServerUserDataToState(mappedUser);
          return mappedUser;
        }
      } catch (error) {
        logger.error('Failed to search user by username', error);
      }
    }
    
    return null;
  }, [accessToken, knownUserIds, getUserData, applyServerUserDataToState]);

  // Проверка доступности username (не используется ли уже)
  const isUsernameAvailable = useCallback(async (username: string): Promise<boolean> => {
    const cleanUsername = username.startsWith('@') ? username.slice(1).toLowerCase() : username.toLowerCase();
    
    // Проверяем локально
    for (const userId of knownUserIds) {
      const userData = getUserData(userId);
      if (userData.username.toLowerCase() === cleanUsername) {
        return false;
      }
    }
    
    // Проверяем на бэкенде
    if (accessToken) {
      try {
        const response = await apiRequest(
          `/users/search?username=${encodeURIComponent(cleanUsername)}`,
          { method: 'GET' },
          accessToken,
        );
        return !response || response.length === 0;
      } catch (error) {
        logger.error('Failed to check username availability', error);
        // При ошибке считаем, что username доступен (оптимистично)
        return true;
      }
    }
    
    return true;
  }, [accessToken, knownUserIds, getUserData]);

  // Функция для детерминированной генерации значений на основе ID
  const generateDeterministicStats = (organizerId: string) => {
    // Создаем хэш из строки ID для получения детерминированного значения
    let hash = 0;
    for (let i = 0; i < organizerId.length; i++) {
      const char = organizerId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Используем хэш для генерации стабильных значений
    const complaints = Math.abs(hash % 3); // 0-2 жалобы
    const friends = Math.abs(hash % 150) + 20; // 20-169 друзей
    
    return { complaints, friends };
  };

  // Кэш для количества жалоб по пользователям
  const complaintsCountCache = useRef<Record<string, number>>({});
  const [organizerStatsCache, setOrganizerStatsCache] = useState<Record<string, {
    totalEvents: number;
    organizedEvents: number;
    participatedEvents: number;
    complaints: number;
    friends: number;
  }>>({});

  // Загружаем статистику жалоб для пользователя
  const loadComplaintsCount = useCallback(async (userId: string) => {
    if (complaintsCountCache.current[userId] !== undefined) {
      return complaintsCountCache.current[userId];
    }
    
    if (!accessToken) {
      complaintsCountCache.current[userId] = 0;
      return 0;
    }

    try {
      const response = await apiRequest(`/complaints/count/${userId}`, {}, accessToken);
      const count = response.count || 0;
      complaintsCountCache.current[userId] = count;
      return count;
    } catch (error) {
      complaintsCountCache.current[userId] = 0;
      return 0;
    }
  }, [accessToken]);

  const getOrganizerStats = useCallback((organizerId: string) => {
    // Получаем все события где пользователь является членом (организатор или участник)
    const allUserEvents = events.filter(event => isUserEventMember(event, organizerId));
    
    // Получаем события где пользователь организатор
    const organizedEvents = events.filter(event => event.organizerId === organizerId);
    
    // Получаем события где пользователь участник (но не организатор)
    const participatedEvents = events.filter(event => 
      isUserAttendee(event, organizerId)
    );

    // Получаем реальное количество друзей из userFriendsMap (единый источник истины)
    const userFriends = userFriendsMap[organizerId] || [];
    const friendsCount = userFriends.length;

    // Получаем количество жалоб из кэша (загружается асинхронно)
    const complaintsCount = complaintsCountCache.current[organizerId] ?? 0;

    // Загружаем жалобы асинхронно, если еще не загружены
    if (complaintsCountCache.current[organizerId] === undefined && accessToken) {
      loadComplaintsCount(organizerId).then(count => {
        setOrganizerStatsCache(prev => ({
          ...prev,
          [organizerId]: {
            totalEvents: allUserEvents.length,
            organizedEvents: organizedEvents.length,
            participatedEvents: participatedEvents.length,
            complaints: count,
            friends: friendsCount,
          }
        }));
      });
    }

    return {
      totalEvents: allUserEvents.length, // Уникальные события (как в профиле)
      organizedEvents: organizedEvents.length,
      participatedEvents: participatedEvents.length,
      complaints: complaintsCount,
      friends: friendsCount,
    };
  }, [events, isUserEventMember, isUserAttendee, userFriendsMap, accessToken, loadComplaintsCount]);

  const getFriendsList = (): User[] => {
    if (!currentUserId) {
      return [];
    }
    const friendIds = userFriendsMap[currentUserId] ?? friends;
    return friendIds.map(friendId => {
      const userData = getUserData(friendId);
      return {
        id: friendId,
        ...userData,
      };
    });
  };

  // Получить реальный список друзей для любого пользователя
  // Использует единый источник истины - userFriendsMap
  const getUserFriendsList = (userId: string): User[] => {
    const resolvedUserId = resolveUserId(userId);
    const friendIds = userFriendsMap[resolvedUserId] || [];
    
    // Возвращаем список друзей с данными пользователей
    return friendIds.map(friendId => {
      const userData = getUserData(friendId);
      return {
        id: friendId,
        ...userData
      };
    });
  };

  const isFriend = (userId: string): boolean => {
    return friends.includes(userId);
  };

  // Обновленная логика FRIENDS согласно новой системе
  const getFriendsForEvents = (): Event[] => {
    if (!currentUserId) {
      return [];
    }
    const viewerId = currentUserId;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 часа назад
    
    const recentWindowMs = 2 * 60 * 60 * 1000; // 2 часа назад
    const filtered = events.filter(event => {
      const eventStart = getEventDateTime(event);
      const recentlyStarted = eventStart.getTime() >= now.getTime() - recentWindowMs;

      // предстоящее или только что начавшееся
      if (!isEventUpcoming(event) && !recentlyStarted) return false;
      // не_набрано
      if (isEventFull(event)) return false;
      
      // Исключаем отклоненные события
      const userStatus = getUserRequestStatus(event, viewerId);
      if (userStatus === 'rejected') return false;
      
      // Для остальных событий применяем обычные фильтры:
      // !я_член_события (скрываем все события, где мы уже участники, но не организаторы)
      if (isUserEventMember(event, viewerId) && !isUserOrganizer(event, viewerId)) return false;
      // друг_организатора
      if (!isFriendOfOrganizer(event, viewerId)) return false;
      return true;
    });
    
    // Сортируем: сначала события, где я организатор (недавно созданные), затем остальные
    return filtered.sort((a, b) => {
      const aIsMyOrganizer = isUserOrganizer(a, viewerId);
      const bIsMyOrganizer = isUserOrganizer(b, viewerId);
      if (aIsMyOrganizer && !bIsMyOrganizer) return -1;
      if (!aIsMyOrganizer && bIsMyOrganizer) return 1;
      return 0;
    });
  };

  // getEventsByUserFolder теперь в useUserFolders хуке

  // Функции для работы с чатами теперь в useChats хуке

  // Обертки для отправки событий и постов в чаты (используют функции из useChats хука)
  const sendEventToChats = async (eventId: string, chatIds: string[]) => {
    logger.debug('sendEventToChats called:', { eventId, chatIds });
    await Promise.all(
      chatIds.map(chatId => {
        logger.debug('Sending event to chat:', chatId, 'eventId:', eventId);
        return sendChatMessage(chatId, '', eventId);
      }),
    );
  };

  const sendMemoryPostToChats = async (eventId: string, postId: string, chatIds: string[]) => {
    logger.debug('sendMemoryPostToChats called:', { eventId, postId, chatIds });
    await Promise.all(
      chatIds.map(chatId => {
        logger.debug('Sending memory post to chat:', chatId, 'eventId:', eventId, 'postId:', postId);
        return sendChatMessage(chatId, '', eventId, postId);
      }),
    );
  };

  // refreshPendingJoinRequests и sendEventRequest теперь в useEventRequests хуке

  // Все функции запросов на участие теперь в useEventRequests хуке
  // cancelEvent и cancelOrganizerParticipation теперь в useEventActions хуке

  // Используем хук для работы с профилями событий
  const {
    eventProfiles,
    setEventProfiles,
    getEventProfile,
    fetchEventProfile,
    createEventProfile,
    addEventProfilePost,
    updateEventProfile,
    updateEventProfilePost,
    deleteEventProfilePost,
    canEditEventProfile,
  } = useEventProfiles({
        accessToken,
    currentUserId,
    events,
    setEvents,
    isEventPast,
    normalizeMediaUrl,
    removeSavedMemoryPost,
  });

  // Функции профилей событий теперь находятся в useEventProfiles хуке
  // Функции запросов на участие теперь находятся в useEventRequests хуке

  // Определяем mapServerEventToClient ДО использования в useEventActions
  const mapServerEventToClient = useCallback((serverEvent: any, eventLanguage: string = 'en'): Event => {
    const lang = (eventLanguage === 'ru' || eventLanguage === 'en') ? eventLanguage : 'en';
    if (!serverEvent) {
      throw new Error('Invalid event payload');
    }

    const start = serverEvent.startTime ? new Date(serverEvent.startTime) : null;
    const date = start ? start.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const time = start ? start.toISOString().slice(11, 16) : '00:00';

    // Фильтруем только ACCEPTED memberships - pending приглашения не должны показываться как участники
    const participantsData = (serverEvent.memberships ?? [])
      .filter((membership: any) => membership.status === 'ACCEPTED')
      .map((membership: any) => {
        const user = membership.user ?? {};
        return {
          avatar: normalizeMediaUrl(user.avatarUrl) ?? '',
          userId: user.id ?? '',
          name: user.name ?? user.username ?? 'Участник',
        };
      })
      .filter((participant: { userId: string }) => Boolean(participant.userId));

    return {
      id: serverEvent.id,
      title: serverEvent.title ?? 'Событие',
      description: serverEvent.description ?? '',
      date,
      time,
      displayDate: serverEvent.isRecurring 
        ? formatRecurringEventDate({
            isRecurring: serverEvent.isRecurring,
            recurringType: serverEvent.recurringType,
            recurringDays: serverEvent.recurringDays,
            recurringDayOfMonth: serverEvent.recurringDayOfMonth,
            recurringCustomDates: serverEvent.recurringCustomDates,
            date: date,
          }, lang)
        : formatDate(date),
      displayTime: time,
      location: serverEvent.location ?? '',
      price: serverEvent.price ?? 'Бесплатно',
      participants: participantsData.length,
      maxParticipants: serverEvent.maxParticipants ?? 0,
      organizerAvatar: normalizeMediaUrl(serverEvent.organizer?.avatarUrl) ?? '',
      organizerId: serverEvent.organizerId,
      // Если mediaUrl отсутствует, но есть originalMediaUrl - используем его
      mediaUrl: normalizeMediaUrl(serverEvent.mediaUrl) ?? normalizeMediaUrl(serverEvent.originalMediaUrl) ?? undefined,
      originalMediaUrl: normalizeMediaUrl(serverEvent.originalMediaUrl) ?? undefined,
      mediaType: serverEvent.mediaType ?? 'image',
      mediaAspectRatio: serverEvent.mediaAspectRatio ?? 1,
      participantsList: participantsData
        .map((participant: { avatar: string }) => participant.avatar)
        .filter(Boolean),
      participantsData,
      createdAt: serverEvent.createdAt ? new Date(serverEvent.createdAt) : new Date(),
      // Маппим координаты из бэкенда
      coordinates: (() => {
        if (serverEvent.latitude != null && serverEvent.longitude != null) {
          return { latitude: Number(serverEvent.latitude), longitude: Number(serverEvent.longitude) };
        }
        if (serverEvent.coordinates) {
          return { latitude: Number(serverEvent.coordinates.latitude), longitude: Number(serverEvent.coordinates.longitude) };
        }
        return undefined;
      })(),
      // Маппим personalPhotos из массива в объект { userId: photoUrl }
      personalPhotos: serverEvent.personalPhotos
        ? (Array.isArray(serverEvent.personalPhotos)
          ? serverEvent.personalPhotos.reduce((acc: Record<string, string>, photo: any) => {
              if ('userId' in photo && 'photoUrl' in photo && photo.userId && photo.photoUrl) {
                acc[photo.userId] = normalizeMediaUrl(photo.photoUrl) || photo.photoUrl;
              }
              return acc;
            }, {})
          : serverEvent.personalPhotos as Record<string, string>)
        : undefined,
      // Поля для регулярных событий
      isRecurring: serverEvent.isRecurring ?? false,
      recurringType: serverEvent.recurringType ?? undefined,
      recurringDays: serverEvent.recurringDays ?? undefined,
      recurringDayOfMonth: serverEvent.recurringDayOfMonth ?? undefined,
      recurringCustomDates: serverEvent.recurringCustomDates 
        ? serverEvent.recurringCustomDates.map((d: string | Date) => 
            typeof d === 'string' ? d : d.toISOString().split('T')[0]
          )
        : undefined,
      // Метки (теги) - объединяем автоматические и пользовательские, фильтруя дубликаты
      tags: (() => {
        const autoTags = serverEvent.autoTags || [];
        const customTags = serverEvent.customTags || [];
        
        // Словарь эквивалентов тегов
        const tagEquivalents: Record<string, string[]> = {
          'recurring': ['recurring', 'регулярное', 'regular', 'регулярно'],
          'women_only': ['women_only', 'women only', 'только женщины', 'only women'],
          'age_18_plus': ['age_18_plus', '18+', '18 плюс', '18 plus'],
          'starting_soon': ['starting_soon', 'скоро', 'через', 'soon'],
        };
        
        const normalizedAutoTags = new Set<string>();
        autoTags.forEach((tag: string) => {
          const normalized = tag.toLowerCase().trim();
          normalizedAutoTags.add(normalized);
          for (const equivalents of Object.values(tagEquivalents)) {
            if (equivalents.some(eq => eq.toLowerCase() === normalized)) {
              equivalents.forEach(eq => normalizedAutoTags.add(eq.toLowerCase()));
              break;
            }
          }
        });
        
        const filteredCustomTags = customTags.filter((tag: string) => {
          const normalized = tag.toLowerCase().trim();
          if (normalizedAutoTags.has(normalized)) {
            return false;
          }
          for (const equivalents of Object.values(tagEquivalents)) {
            if (equivalents.some(eq => eq.toLowerCase() === normalized)) {
              const hasAutoEquivalent = autoTags.some((autoTag: string) => {
                const autoNormalized = autoTag.toLowerCase().trim();
                return equivalents.some(eq => eq.toLowerCase() === autoNormalized);
              });
              if (hasAutoEquivalent) {
                return false;
              }
            }
          }
          return true;
        });
        
        return [...autoTags, ...filteredCustomTags];
      })(),
      ageRestriction: serverEvent.ageRestriction ?? undefined,
      genderRestriction: serverEvent.genderRestriction ?? undefined,
      visibility: serverEvent.visibility ?? undefined,
      invitedUsers: serverEvent.invitedUsers ?? undefined,
    };
  }, [normalizeMediaUrl]);

  // Используем хук для действий с событиями
  const {
    createEvent,
    updateEvent,
    deleteEvent,
    cancelEvent,
    cancelOrganizerParticipation,
    removeParticipantFromEvent,
  } = useEventActions({
          accessToken,
    currentUserId,
    refreshToken,
    handleUnauthorizedError,
    refreshSession,
    applyServerUserDataToState,
    setEvents,
    setEventProfiles,
    setEventRequests,
    setChats,
    mapServerEventToClient,
    isEventPast,
    fetchEventProfile,
    refreshPendingJoinRequests,
    syncEventsFromServer,
    getEventParticipants,
    events,
    eventProfiles,
    language,
  });

  // Обновляем ref после определения updateEvent
  updateEventRef.current = updateEvent;

  // Используем хук для работы с сохраненными событиями
  const {
    savedEvents,
    setSavedEvents,
    saveEvent,
    removeSavedEvent,
    isEventSaved,
    getSavedEvents,
  } = useSavedEvents({
    events,
  });

  // Используем хук для работы с папками пользователей
  const {
    userFolders,
    setUserFolders,
    syncUserFoldersFromServer,
    addUserToFolder,
    removeUserFromFolder,
    createUserFolder,
    deleteUserFolder,
    getEventsByUserFolder,
  } = useUserFolders({
          accessToken,
    currentUserId,
    events,
    applyServerUserDataToState,
    handleUnauthorizedError,
  });

  // Используем хук для работы с папками сообщений
  const {
    messageFolders,
    setMessageFolders,
    syncMessageFolders,
    createMessageFolder,
    addChatsToMessageFolder,
    removeChatFromMessageFolder,
  } = useMessageFolders({
      accessToken,
      currentUserId,
      applyServerUserDataToState,
      handleUnauthorizedError,
  });

  // Используем хук для работы с сохраненными меморис постами
  const {
    savedMemoryPosts,
    setSavedMemoryPosts,
    saveMemoryPost,
    removeSavedMemoryPost,
    isMemoryPostSaved,
    getSavedMemoryPosts,
  } = useSavedMemoryPosts({
    eventProfiles,
  });

  // Функции запросов на участие теперь находятся в useEventRequests хуке
  // Функции сохраненных событий теперь находятся в useSavedEvents хуке
  // Функции папок пользователей теперь находятся в useUserFolders хуке
  // Функции папок сообщений теперь находятся в useMessageFolders хуке
  // Функции сохраненных меморис постов теперь находятся в useSavedMemoryPosts хуке

  // Используем хук для работы с уведомлениями (после всех хуков, чтобы избежать проблем с порядком)
  const {
    notifications,
    unreadNotificationsCount,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    setNotifications,
  } = useNotifications(accessToken, currentUserId, handleUnauthorizedError);

  // knownUserIds вычисляется после объявления всех хуков
  const knownUserIds = useMemo(() => {
    const ids = new Set<string>(Object.keys(serverUserData));
    Object.keys(userDataUpdates).forEach(id => ids.add(id));
    events.forEach(event => {
      ids.add(event.organizerId);
      event.participantsData?.forEach(p => {
        if (p.userId) {
          ids.add(p.userId);
        }
      });
      event.invitedUsers?.forEach(id => ids.add(id));
    });
    eventProfiles.forEach(profile => {
      ids.add(profile.organizerId);
      profile.participants.forEach(id => ids.add(id));
    });
    eventRequests.forEach(request => {
      if (request.fromUserId) ids.add(request.fromUserId);
      if (request.toUserId) ids.add(request.toUserId);
      if (request.userId) ids.add(request.userId);
    });
    friends.forEach(id => ids.add(id));
    Object.keys(userFriendsMap).forEach(id => ids.add(id));
    Object.values(userFriendsMap).forEach(list => list.forEach(id => ids.add(id)));
    if (currentUserId) ids.add(currentUserId);
    if (authUser?.id) ids.add(authUser.id);
    return Array.from(ids);
  }, [events, eventProfiles, eventRequests, userDataUpdates, friends, userFriendsMap, currentUserId, authUser?.id, serverUserData]);

  // ========== НОВАЯ ДЕКЛАРАТИВНАЯ СИСТЕМА СОСТОЯНИЙ СОБЫТИЙ ==========
  
  // 1. БАЗОВЫЕ АТРИБУТЫ (вычисляются из данных события)
  
  // Получить DateTime события
  const getEventDateTime = (event: Event): Date => {
    if (!event?.date || !event?.time) return new Date(0);
    const [hh, mm] = event.time.split(':').map((v: string) => parseInt(v, 10));
    return new Date(event.date + 'T' + `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
  };
  
  // Получить список принятых участников (только userId)
  const getAcceptedParticipants = (eventId: string): string[] => {
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
  
  // Получить статус заявки пользователя
  type RequestStatus = 'organizer' | 'accepted' | 'rejected' | 'pending' | 'not_requested';
  const getUserRequestStatus = (event: Event, userId: string | null): RequestStatus => {
    if (!userId) return 'not_requested';
    const resolvedUserId = resolveUserId(userId);
    // Если пользователь - организатор
    if (event.organizerId === resolvedUserId) {
      return 'organizer';
    }
    
    // Сначала проверяем memberships из события (данные с бэкенда)
    // Ищем membership для текущего пользователя в participantsData
    const userMembership = event.participantsData?.find(
      (p: { userId: string }) => p.userId === resolvedUserId
    );
    
    // Если membership найден в данных события, это означает, что пользователь принят
    if (userMembership) {
      return 'accepted';
    }
    
    // Проверяем pending memberships через eventRequests (для приглашений и запросов)
    const request = eventRequests.find(
      req => req.eventId === event.id && requestBelongsToUser(req, resolvedUserId)
    );
    
    if (request) {
      if (request.status === 'accepted') return 'accepted';
      if (request.status === 'rejected') return 'rejected';
      if (request.status === 'pending') return 'pending';
    }
    
    return 'not_requested';
  };

  // НОВАЯ ФУНКЦИЯ: Определяет отношения пользователя к событию с приоритетом для приглашений
  const getUserRelationship = (event: Event, userId: string | null): 'invited' | 'organizer' | 'accepted' | 'waiting' | 'rejected' | 'non_member' => {
    if (!userId) return 'non_member';
    const resolvedUserId = resolveUserId(userId);
    
    // 🎯 ПРИОРИТЕТ 1: Приглашение имеет высший приоритет
    const inviteRequest = eventRequests.find(req => 
      req.eventId === event.id &&
      req.type === 'invite' &&
      req.toUserId === resolvedUserId &&
      req.status === 'pending'
    );
    if (inviteRequest) {
      return 'invited';
    }
    
    // ПРИОРИТЕТ 2: Организатор
    if (event.organizerId === resolvedUserId) {
      return 'organizer';
    }
    
    // ПРИОРИТЕТ 3: Участник (accepted)
    const userMembership = event.participantsData?.find(
      (p: { userId: string }) => p.userId === resolvedUserId
    );
    if (userMembership) {
      return 'accepted';
    }
    
    // Проверяем accepted через eventRequests
    const acceptedRequest = eventRequests.find(req => 
      req.eventId === event.id && 
      requestBelongsToUser(req, resolvedUserId) &&
      req.status === 'accepted'
    );
    if (acceptedRequest) {
      return 'accepted';
    }
    
    // ПРИОРИТЕТ 4: В ожидании (waiting) - pending join request
    const pendingRequest = eventRequests.find(req => 
      req.eventId === event.id &&
      req.type === 'join' &&
      req.fromUserId === resolvedUserId &&
      req.status === 'pending'
    );
    if (pendingRequest) {
      return 'waiting';
    }
    
    // ПРИОРИТЕТ 5: Отклонен (rejected)
    const rejectedRequest = eventRequests.find(req => 
      req.eventId === event.id && 
      requestBelongsToUser(req, resolvedUserId) &&
      req.status === 'rejected'
    );
    if (rejectedRequest) {
      return 'rejected';
    }
    
    // ПРИОРИТЕТ 6: Не член (non_member)
    return 'non_member';
  };

  // Персонализированные фото событий
  // Получить фото события для конкретного пользователя с учетом viewerUserId
  // Логика:
  // 1. По умолчанию - фото организатора (event.mediaUrl)
  // 2. Если событие прошло И viewerUserId указан (третье лицо смотрит через профиль участника) - показываем персональное фото viewerUserId (если есть)
  // 3. Если событие прошло И userId имеет персональное фото - показываем его (для самого участника)
  // 4. Иначе - фото организатора
  const getEventPhotoForUser = (eventId: string, userId: string, viewerUserId?: string, useOriginal: boolean = false): string | undefined => {
    const event = events.find(e => e.id === eventId);
    if (!event) return undefined;

    // Проверяем, прошло ли событие
    const isPast = isEventPast(event);

    // Если событие прошло
    if (isPast && event.personalPhotos) {
      // Приоритет 1: Для третьих лиц - персональное фото участника, через профиль которого смотрят
      if (viewerUserId && event.personalPhotos[viewerUserId]) {
        return event.personalPhotos[viewerUserId];
      }
      
      // Приоритет 2: Для самого участника - его персональное фото (если есть)
      if (event.personalPhotos[userId]) {
        return event.personalPhotos[userId];
      }
    }

    // Если запрашивается оригинальное фото - используем originalMediaUrl
    if (useOriginal && event.originalMediaUrl) {
      return event.originalMediaUrl;
    }

    // По умолчанию - обрезанное фото события (mediaUrl)
    if (event.mediaUrl) {
      return event.mediaUrl;
    }

    // Fallback на avatar из eventProfile (только если нет mediaUrl)
    const profile = eventProfiles.find(p => p.eventId === eventId);
    if (profile?.avatar) {
      return profile.avatar;
    }

    // Последний fallback - НЕ возвращаем аватарку организатора, возвращаем undefined
    // чтобы было видно, что фото не установлено
    return undefined;
  };

  // Установить персональное фото события для пользователя (объявлена после syncEventsFromServer)
  
  // 2. ПРОИЗВОДНЫЕ АТРИБУТЫ (вычисляются)
  
  // Событие предстоящее
  const isEventUpcoming = (event: Event): boolean => {
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
  
  // Событие прошедшее
  const isEventPast = (event: Event): boolean => {
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
  
  // Событие набрано (достигнут максимум участников)
  const isEventFull = (event: Event): boolean => {
    const acceptedParticipants = getAcceptedParticipants(event.id);
    return acceptedParticipants.length >= event.maxParticipants;
  };
  
  // Событие не набрано
  const isEventNotFull = (event: Event): boolean => {
    return !isEventFull(event);
  };
  
  // 3. ОТНОШЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ К СОБЫТИЮ
  
  // Я организатор
  const isUserOrganizer = (event: Event, userId: string): boolean => {
    const resolvedUserId = resolveUserId(userId);
    return event.organizerId === resolvedUserId;
  };
  
  // Я участник (принятый, но не организатор)
  const isUserAttendee = (event: Event, userId: string): boolean => {
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
  
  // Я член события (организатор ИЛИ принятый участник)
  const isUserEventMember = (event: Event, userId: string): boolean => {
    return isUserOrganizer(event, userId) || isUserAttendee(event, userId);
  };
  
  // 4. ОТНОШЕНИЕ К ДРУГИМ ПОЛЬЗОВАТЕЛЯМ
  
  // Организатор события - мой друг
  const isFriendOfOrganizer = (event: Event, userId: string | null): boolean => {
    if (!userId) return false;
    const resolvedUserId = resolveUserId(userId);
    const friendIds = userFriendsMap[resolvedUserId] ?? [];
    return friendIds.includes(event.organizerId);
  };
  
  // Универсальная функция для проверки участия пользователя в событии (для обратной совместимости)
  const isUserParticipant = (event: Event, userId: string): boolean => {
    return isUserEventMember(event, userId);
  };

  const getEventParticipants = (eventId: string): string[] => {
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

  // canEditEventProfile теперь находится в useEventProfiles хуке

  // Получить мои исходящие запросы на события
  const getMyEventRequests = (): EventRequest[] => {
    const myUserId = currentUserId;
    if (!myUserId) return [];
    
    // Возвращаем как запросы на участие (join), так и приглашения (invite)
    // Для join: где пользователь является отправителем (fromUserId === myUserId)
    // Для invite: где пользователь является отправителем (fromUserId === myUserId) ИЛИ получателем (toUserId === myUserId)
    const result = eventRequests.filter(req => {
      // Для запросов типа 'join' проверяем userId или fromUserId
      if (req.type === 'join' || !req.type) {
        // Проверяем несколько вариантов для совместимости
        const belongsToUser = requestBelongsToUser(req, myUserId);
        const matchesFromUserId = req.fromUserId === myUserId;
        const matchesUserId = req.userId === myUserId;
        return belongsToUser || matchesFromUserId || matchesUserId;
      }
      // Для приглашений (invite) проверяем:
      // - fromUserId (отправитель приглашения - исходящие)
      // - toUserId (получатель приглашения - входящие)
      if (req.type === 'invite') {
        return req.fromUserId === myUserId || req.toUserId === myUserId;
      }
      return false;
    });
    logger.debug('getMyEventRequests вызван, eventRequests.length:', eventRequests.length, 'результат:', result.length);
    result.forEach(req => {
      logger.debug('Мой запрос:', { id: req.id, type: req.type, eventId: req.eventId, fromUserId: req.fromUserId, toUserId: req.toUserId, userId: req.userId, status: req.status });
    });
    return result;
  };

  // Получить организатора события
  const getEventOrganizer = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return null;
    return getUserData(event.organizerId);
  };

  // Проверить мой статус участия в событии
  const getMyEventParticipationStatus = (eventId: string): 'pending' | 'accepted' | 'rejected' | null => {
    const request = eventRequests.find(req => 
      req.eventId === eventId && requestBelongsToUser(req, currentUserId)
    );
    return request ? request.status : null;
  };

  // Получить события для моего календаря (только где я организатор или участник со статусом accepted)
  const getMyCalendarEvents = (): Event[] => {
    return events.filter(event => {
      // Я организатор
      if (event.organizerId === currentUserId) {
        return true;
      }
      // Я участник со статусом accepted
      const status = getMyEventParticipationStatus(event.id);
      if (status === 'accepted') {
        return true;
      }
      // Проверка через participantsList (для старых событий)
      const isParticipant = event.participantsList?.includes('https://randomuser.me/api/portraits/women/68.jpg');
      if (isParticipant) {
        return true;
      }
      return false;
    });
  };

  // Получить события для календаря другого пользователя
  const getUserCalendarEvents = (userId: string): Event[] => {
    return events.filter(event => {
      // Пользователь организатор
      if (event.organizerId === userId) {
        return true;
      }
      // Проверка через participantsList (упрощенная проверка)
      // Для другого пользователя проверяем только организатора, т.к. нет данных о их участниках
      return false;
    });
  };

  // Получить глобальные события (на которые я еще не откликался)
  // Показываем только события НЕ-друзей
  // Обновленная логика GLOB согласно новой системе
  const getGlobalEvents = (): Event[] => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 часа назад
    
    const filtered = events.filter(event => {
      // предстоящее
      if (!isEventUpcoming(event)) {
        logger.debug(`[getGlobalEvents] Event ${event.id} filtered: not upcoming`);
        return false;
      }
      // не_набрано
      if (isEventFull(event)) {
        logger.debug(`[getGlobalEvents] Event ${event.id} filtered: full`);
        return false;
      }
      
      // Используем getUserRelationship для определения отношений
      const relationship = getUserRelationship(event, currentUserId);
      
      // Скрываем отклоненные приглашения
      if (relationship === 'rejected') {
        logger.debug(`[getGlobalEvents] Event ${event.id} filtered: rejected`);
        return false;
      }
      
      // События, где я организатор И которые были созданы недавно (за последние 24 часа)
      // ИЛИ регулярные события (они всегда актуальны)
      if (relationship === 'organizer') {
        const eventCreatedAt = event.createdAt instanceof Date ? event.createdAt : new Date(event.createdAt);
        // Для регулярных событий показываем всегда (они актуальны)
        if (event.isRecurring) {
          logger.debug(`[getGlobalEvents] Event ${event.id} included: organizer, recurring`);
          return true;
        }
        // Для обычных событий показываем только если созданы за последние 24 часа
        if (eventCreatedAt >= oneDayAgo) {
          logger.debug(`[getGlobalEvents] Event ${event.id} included: organizer, recent`);
          return true;
        } else {
          logger.debug(`[getGlobalEvents] Event ${event.id} filtered: organizer, too old`);
        }
      }
      
      // ПРАВИЛО: я_участник = исчезает из лент (скрываем все события, где мы уже участники, но не организаторы)
      if (relationship === 'accepted') {
        logger.debug(`[getGlobalEvents] Event ${event.id} filtered: accepted`);
        return false;
      }
      
      // Показываем приглашения (invited) - они должны быть видны в ленте
      if (relationship === 'invited') {
        logger.debug(`[getGlobalEvents] Event ${event.id} included: invited`);
        return true;
      }
      
      // Показываем запланированные события (waiting) - они должны оставаться в ленте со значком часов
      if (relationship === 'waiting') {
        logger.debug(`[getGlobalEvents] Event ${event.id} included: waiting`);
        return true;
      }
      
      // !друг_организатора
      if (currentUserId && isFriendOfOrganizer(event, currentUserId)) {
        logger.debug(`[getGlobalEvents] Event ${event.id} filtered: friend of organizer`);
        return false;
      }
      
      logger.debug(`[getGlobalEvents] Event ${event.id} included: default`);
      return true;
    });
    
    // Сортируем: сначала события, где я организатор (недавно созданные), затем остальные
    return filtered.sort((a, b) => {
      const aIsMyOrganizer = currentUserId ? isUserOrganizer(a, currentUserId) : false;
      const bIsMyOrganizer = currentUserId ? isUserOrganizer(b, currentUserId) : false;
      if (aIsMyOrganizer && !bIsMyOrganizer) return -1;
      if (!aIsMyOrganizer && bIsMyOrganizer) return 1;
      return 0;
    });
  };

// mapServerFriendRequest теперь в hooks/friends/useFriends.ts

const DEFAULT_AVATAR_URL = 'https://cdn.jsdelivr.net/gh/identicons/jasonlong/resources/png/identicon.png';

const mapServerUserToClient = (user: ServerUser): User => {
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

const isHttpUrl = (value?: string | null): boolean => {
  if (!value) return false;
  return /^https?:\/\/.+/i.test(value.trim());
};

// mapServerMessageToClient и mapServerChatToClient теперь в hooks/chats/useChats.ts

// mapServerFolderToMessageFolder теперь в useMessageFolders хуке

  // Функции для работы с друзьями теперь в useFriends хуке
  
  // syncChatsFromServer теперь в useChats хуке

  // syncUserFoldersFromServer, addUserToFolder, removeUserFromFolder, createUserFolder, deleteUserFolder теперь в useUserFolders хуке

  // createEventChatWithParticipants и fetchMessagesForChat теперь в useChats хуке

  const syncEventsFromServer = useCallback(async () => {
    // Используем актуальный токен из ref
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    if (!actualToken || !actualUserId) return;
    
    // Проверяем, что токен не изменился
    if (actualToken !== accessToken || actualUserId !== currentUserId) {
      logger.debug('syncEventsFromServer: токен или userId изменились, отменяем');
      return;
    }
    
    setIsSyncing(true);
    try {
      logger.info('[syncEventsFromServer] Starting sync...', {
        hasToken: !!actualToken,
        userId: actualUserId,
        apiUrl: API_BASE_URL
      });
      const response = await apiRequest('/events', {}, actualToken);
      logger.info('[syncEventsFromServer] Received response:', {
        isArray: Array.isArray(response),
        length: Array.isArray(response) ? response.length : 'not array',
        type: typeof response
      });
      if (Array.isArray(response)) {
        // Extract pending memberships (invitations) for current user
        const pendingInvitations: EventRequest[] = [];
        const outgoingInvitations: EventRequest[] = [];
        
        response.forEach((serverEvent: any) => {
          // Логируем координаты для отладки
          if (serverEvent.latitude != null || serverEvent.longitude != null) {
            logger.debug(`Server event ${serverEvent.id} has coordinates:`, {
              latitude: serverEvent.latitude,
              longitude: serverEvent.longitude,
              title: serverEvent.title
            });
          } else {
            logger.debug(`Server event ${serverEvent.id} has NO coordinates:`, {
              latitude: serverEvent.latitude,
              longitude: serverEvent.longitude,
              title: serverEvent.title,
              hasCoordinatesField: 'coordinates' in serverEvent
            });
          }
          
          if (serverEvent?.organizer) {
            applyServerUserDataToState(serverEvent.organizer);
          }
          (serverEvent?.memberships ?? []).forEach((membership: any) => {
            if (membership?.user) {
              applyServerUserDataToState(membership.user);
            }
            
            // If membership is pending and has invitedBy, it's an invitation
            // Входящее приглашение: я приглашен (invitedBy !== actualUserId, userId === actualUserId)
            if (
              membership.status === 'PENDING' &&
              membership.invitedBy &&
              membership.userId === actualUserId &&
              membership.invitedBy !== actualUserId
            ) {
              pendingInvitations.push({
                id: membership.id,
                type: 'invite',
                eventId: membership.eventId,
                fromUserId: membership.invitedBy,
                toUserId: membership.userId,
                userId: membership.userId, // Добавляем userId для правильной работы requestBelongsToUser
                status: 'pending',
                createdAt: membership.createdAt ? new Date(membership.createdAt) : new Date(),
              });
            }
            
            // Исходящее приглашение: я организатор и пригласил кого-то (invitedBy === actualUserId, userId !== actualUserId)
            if (
              membership.status === 'PENDING' &&
              membership.invitedBy === actualUserId &&
              membership.userId !== actualUserId &&
              serverEvent.organizerId === actualUserId
            ) {
              outgoingInvitations.push({
                id: membership.id,
                type: 'invite',
                eventId: membership.eventId,
                fromUserId: membership.invitedBy,
                toUserId: membership.userId,
                userId: membership.userId, // Добавляем userId для правильной работы requestBelongsToUser
                status: 'pending',
                createdAt: membership.createdAt ? new Date(membership.createdAt) : new Date(),
              });
            }
          });
        });
        
        const mapped = response.map((event: any) => mapServerEventToClient(event, language));
        logger.info('syncEventsFromServer success', mapped.length, 'events');
        
        // ВАЖНО: Объединяем события с сервера с существующими, чтобы сохранить прошедшие события
        // Прошедшие события могут не возвращаться с сервера, но должны оставаться в локальном состоянии
        setEvents(prev => {
          const serverEventIds = new Set(mapped.map(e => e.id));
          // Сохраняем прошедшие события, которых нет в ответе сервера
          const pastEventsToKeep = prev.filter(event => {
            const isPast = isEventPast(event);
            const notInServer = !serverEventIds.has(event.id);
            return isPast && notInServer;
          });
          
          // Объединяем: события с сервера + сохраненные прошедшие события
          const merged = [...mapped, ...pastEventsToKeep];
          
          logger.debug('syncEventsFromServer: объединено событий', {
            fromServer: mapped.length,
            pastEventsKept: pastEventsToKeep.length,
            total: merged.length
          });
          
          return merged;
        });
        
        // Update eventRequests with pending invitations (both incoming and outgoing)
        // ВАЖНО: всегда обновляем eventRequests, даже если нет новых приглашений, чтобы сохранить существующие
        setEventRequests(prev => {
          const byId = new Map<string, EventRequest>();
          // Сохраняем все существующие запросы, кроме приглашений, которые могут быть обновлены
          prev.forEach(req => {
            // Сохраняем join-запросы
            if (req.type !== 'invite') {
              byId.set(req.id, req);
            }
            // Сохраняем приглашения, которые не относятся к текущему пользователю (чтобы не потерять чужие)
            else if (req.fromUserId !== actualUserId && req.toUserId !== actualUserId) {
              byId.set(req.id, req);
            }
            // Приглашения, где текущий пользователь участвует, будут обновлены ниже
          });
          // Add/update incoming invitations
          pendingInvitations.forEach(inv => byId.set(inv.id, inv));
          // Add/update outgoing invitations - ВАЖНО: сохраняем исходящие приглашения
          outgoingInvitations.forEach(inv => {
            byId.set(inv.id, inv);
            logger.debug('✅ Сохранено исходящее приглашение:', { id: inv.id, eventId: inv.eventId, toUserId: inv.toUserId });
          });
          const result = Array.from(byId.values());
          logger.debug('Обновлено eventRequests:', result.length, 'исходящих приглашений:', outgoingInvitations.length);
          return result;
        });
        
        await refreshPendingJoinRequests(mapped);
      }
    } catch (error) {
      // Проверяем только 401/403 - другие ошибки не должны вызывать logout
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        if (await handleUnauthorizedError(error)) {
          return;
        }
      }
      logger.error('Failed to load events from API', error);
    } finally {
      setIsSyncing(false);
    }
  }, [accessToken, currentUserId, language, applyServerUserDataToState, handleUnauthorizedError, refreshPendingJoinRequests, events.length, isEventPast]);

  // cancelEventRequest и cancelEventParticipation теперь в useEventRequests хуке
  // removeParticipantFromEvent теперь в useEventActions хуке

  // Установить персональное фото события для пользователя (объявлена после syncEventsFromServer)
  const setPersonalEventPhoto = useCallback(async (eventId: string, userId: string, photoUrl: string) => {
    if (!accessToken || !currentUserId || userId !== currentUserId) {
      // Fallback: обновляем локально
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            personalPhotos: {
              ...event.personalPhotos,
              [userId]: photoUrl
            }
          };
        }
        return event;
      }));
      return;
    }

    try {
      // Загружаем фото на бэкенд
      // photoUrl может быть локальным URI или уже загруженным URL
      if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
        // Если уже загружено, просто сохраняем URL
        await apiRequest(
          `/events/${eventId}/personal-photo`,
          {
            method: 'POST',
            body: JSON.stringify({ photoUrl }),
          },
          accessToken,
        );
      } else {
        // Если локальный URI, загружаем файл через FormData
        const formData = new FormData();
        const filename = photoUrl.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('file', {
          uri: photoUrl,
          name: filename,
          type: type,
        } as any);

        // ВАЖНО: Не устанавливаем Content-Type вручную для FormData
        // React Native автоматически установит правильный Content-Type с boundary
        const response = await fetch(`${API_BASE_URL}/events/${eventId}/personal-photo`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            // НЕ устанавливаем Content-Type - React Native сделает это автоматически для FormData
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to upload photo: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        // Обновляем локально с загруженным URL
        if (result.photoUrl || result.publicUrl) {
          setEvents(prev => prev.map(event => {
            if (event.id === eventId) {
              return {
                ...event,
                personalPhotos: {
                  ...event.personalPhotos,
                  [userId]: result.photoUrl || result.publicUrl
                }
              };
            }
            return event;
          }));
        }
      }

      // Синхронизируем с сервером после успешной загрузки
      await syncEventsFromServer();
    } catch (error) {
      logger.error('Failed to set personal photo', error);
      // Fallback: обновляем локально при ошибке
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            personalPhotos: {
              ...event.personalPhotos,
              [userId]: photoUrl
            }
          };
        }
        return event;
      }));
    }
  }, [accessToken, currentUserId, syncEventsFromServer]);

  // syncMessageFolders, createMessageFolder, addChatsToMessageFolder, removeChatFromMessageFolder теперь в useMessageFolders хуке

  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authUser?.id) {
      applyServerUserDataToState(authUser);
    }
  }, [authUser, applyServerUserDataToState]);

  // Track last sync to prevent infinite loops
  const lastSyncRef = useRef<{ userId: string | null; accessToken: string | null }>({
    userId: null,
    accessToken: null,
  });

  useEffect(() => {
    const previousUserId = previousUserIdRef.current;
    const userChanged = previousUserId !== (currentUserId ?? null);

    // Если пользователь изменился (переключение аккаунта), очищаем состояние СРАЗУ
    // Это предотвращает выполнение старых запросов с новым токеном
    if (userChanged && previousUserId && currentUserId) {
      logger.info('Account switched, clearing user-specific data');
      // Очищаем данные, специфичные для пользователя
      setFriends([]);
      setFriendRequests([]);
      setUserFolders([]);
      setMessageFolders([]);
      setChats([]);
      setChatMessages([]);
      setEventRequests([]);
      setNotifications([]);
      setSavedEvents([]);
      setSavedMemoryPosts([]);
      // loadedChatMessages теперь в useChats хуке, очистка происходит через setChatMessages([])
      // Очищаем userFriendsMap, оставляя только данные для нового пользователя
      setUserFriendsMap({});
    }

    // Only sync if user/accessToken changed, not on every render
    const shouldSync =
      !authInitializing &&
      accessToken &&
      currentUserId &&
      (lastSyncRef.current.userId !== currentUserId ||
        lastSyncRef.current.accessToken !== accessToken);

    if (shouldSync) {
      lastSyncRef.current = { userId: currentUserId, accessToken };
      
      // Синхронизируем параллельно
      // Используем Promise.allSettled, чтобы ошибка в одной синхронизации не прерывала остальные
      Promise.allSettled([
        syncEventsFromServer(),
        syncFriendsFromServer(),
        syncFriendRequestsFromServer(),
        syncChatsFromServer(),
        syncMessageFolders(),
        syncUserFoldersFromServer(),
        refreshPendingJoinRequests(), // Синхронизируем приглашения при загрузке
        refreshNotifications(), // Синхронизируем уведомления при загрузке
      ]).then((results) => {
        // Логируем ошибки, но не прерываем процесс
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const syncNames = ['events', 'friends', 'friendRequests', 'chats', 'messageFolders', 'userFolders', 'requests', 'notifications'];
            logger.warn(`Sync ${syncNames[index]} failed:`, result.reason);
          }
        });
      }).catch((error) => {
        logger.error('Error during sync after account switch:', error);
      });
    }

    if (!currentUserId && userChanged) {
      // logged out - очищаем все
      setEvents([]);
      setFriends([]);
      setFriendRequests([]);
      setUserFriendsMap({});
      setUserFolders([]);
      setMessageFolders([]);
      setChats([]);
      setChatMessages([]);
      setEventRequests([]);
      setEventProfiles([]);
      setNotifications([]);
      setSavedEvents([]);
      setSavedMemoryPosts([]);
      // loadedChatMessages теперь в useChats хуке, очистка происходит через setChatMessages([])
      lastSyncRef.current = { userId: null, accessToken: null };
      // Отключаем WebSocket при выходе
      disconnectSocket();
    }

    previousUserIdRef.current = currentUserId ?? null;
  }, [
    currentUserId,
    accessToken,
    authInitializing,
    syncEventsFromServer,
    syncFriendsFromServer,
    syncFriendRequestsFromServer,
    syncChatsFromServer,
    syncMessageFolders,
    syncUserFoldersFromServer,
    refreshPendingJoinRequests,
    refreshNotifications,
  ]);

  useEffect(() => {
    if (!accessToken) return;
    chats.forEach(chat => {
      fetchMessagesForChat(chat.id);
    });
  }, [accessToken, chats, fetchMessagesForChat]);

  // WebSocket подключение для real-time обновлений чатов
  useEffect(() => {
    if (!accessToken || !currentUserId) {
      disconnectSocket();
      return;
    }

    // Callback для обновления токена перед подключением к WebSocket
    const refreshTokenForSocket = async (): Promise<string | null> => {
      if (!refreshToken || !refreshSession) {
        return null;
      }
      try {
        await refreshSession(refreshToken);
        // После обновления токена, accessToken обновится в AuthContext
        // Но нам нужно подождать, пока он обновится
        // Возвращаем null - useEffect перезапустится с новым accessToken
        // и создаст новое подключение
        return null;
      } catch (error) {
        logger.warn('Failed to refresh token for WebSocket:', error);
        return null;
      }
    };

    const socket = createSocketConnection(accessToken, refreshTokenForSocket);
    
    // Если сокет не создан (токен истек и обновляется), выходим
    if (!socket) {
      return;
    }

    // Храним обработчики для возможности их удаления
    const eventHandlers: Array<{ event: string; handler: (...args: any[]) => void }> = [];

    // Подписка на новые сообщения
    const handleMessageNew = (message: any) => {
      logger.debug('📨 Получено новое сообщение через WebSocket:', message);
      
      // Применяем данные отправителя
      if (message?.sender) {
        applyServerUserDataToState(message.sender);
      }

      // Преобразуем сообщение и добавляем в состояние
      const mappedMessage = mapServerMessageToClient(message);
      
      setChatMessages(prev => {
        // Проверяем, нет ли уже такого сообщения
        const exists = prev.find(msg => msg.id === mappedMessage.id);
        if (exists) return prev;
        
        // Добавляем новое сообщение
        return [...prev, mappedMessage];
      });

      // Обновляем lastMessage в чате
      setChats(prev => {
        const chat = prev.find(c => c.id === message.chatId);
        if (!chat) return prev;
        
        return prev.map(c => 
          c.id === message.chatId 
            ? { ...c, lastMessage: mappedMessage, lastActivity: new Date() }
            : c
        );
      });

      // Помечаем, что сообщения для этого чата загружены через fetchMessagesForChat из useChats
      // loadedChatMessages теперь в useChats хуке
    };
    socket.on('message:new', handleMessageNew);
    eventHandlers.push({ event: 'message:new', handler: handleMessageNew });

    // Подписка на обновление списка чатов
    const handleChatsUpdate = () => {
      logger.debug('🔄 Получено обновление списка чатов через WebSocket');
      // Синхронизируем список чатов с сервера
      syncChatsFromServer().catch(error => {
        logger.error('Failed to sync chats after WebSocket update:', error);
      });
    };
    socket.on('chats:update', handleChatsUpdate);
    eventHandlers.push({ event: 'chats:update', handler: handleChatsUpdate });

    // Подписка на создание нового события
    socket.on('event:created', (eventData: any) => {
      logger.debug('📅 Получено новое событие через WebSocket:', eventData);
      // Подключаемся к комнате нового события, если это событие текущего пользователя
      if (eventData.id && currentUserId) {
        socket.emit('event:join', { eventId: eventData.id });
      }
      // Синхронизируем события с сервера, чтобы получить полные данные
      syncEventsFromServer().catch(error => {
        logger.error('Failed to sync events after WebSocket event:created:', error);
      });
    });

    // Подписка на обновление события
    socket.on('event:updated', (eventData: any) => {
      logger.debug('🔄 Получено обновление события через WebSocket:', eventData);
      // Синхронизируем события с сервера
      syncEventsFromServer().catch(error => {
        logger.error('Failed to sync events after WebSocket event:updated:', error);
      });
    });

    // Подписка на удаление события
    socket.on('event:deleted', (eventData: any) => {
      logger.debug('🗑️ Получено событие об удалении события через WebSocket:', eventData);
      // Удаляем событие из состояния
      if (eventData.eventId) {
        setEvents(prev => prev.filter(event => event.id !== eventData.eventId));
        // Также удаляем из сохраненных
        setSavedEvents(prev => prev.filter(id => id !== eventData.eventId));
      }
    });

    // Подписка на новый запрос на участие в событии
    socket.on('event:request:new', (requestData: any) => {
      logger.debug('📨 Получен новый запрос на участие через WebSocket:', requestData);
      // Если это запрос от текущего пользователя, подключаемся к комнате события
      if (requestData.eventId && requestData.userId === currentUserId) {
        socket.emit('event:join', { eventId: requestData.eventId });
      }
      // Обновляем запросы на участие
      refreshPendingJoinRequests().catch(error => {
        logger.error('Failed to refresh requests after WebSocket event:request:new:', error);
      });
      // Также синхронизируем события
      syncEventsFromServer().catch(error => {
        logger.error('Failed to sync events after WebSocket event:request:new:', error);
      });
    });

    // Подписка на обновление статуса запроса/приглашения
    socket.on('event:request:updated', (requestData: any) => {
      logger.debug('🔄 Получено обновление статуса запроса через WebSocket:', requestData);
      // Если запрос принят и это запрос текущего пользователя, подключаемся к комнате события
      if (requestData.status === 'ACCEPTED' && requestData.userId === currentUserId && requestData.eventId) {
        socket.emit('event:join', { eventId: requestData.eventId });
      }
      // Обновляем запросы на участие
      refreshPendingJoinRequests().catch(error => {
        logger.error('Failed to refresh requests after WebSocket event:request:updated:', error);
      });
      // Синхронизируем события
      syncEventsFromServer().catch(error => {
        logger.error('Failed to sync events after WebSocket event:request:updated:', error);
      });
    });

    // Подписка на статус запроса (отправляется конкретному пользователю)
    socket.on('event:request:status', (requestData: any) => {
      logger.debug('📊 Получен статус запроса через WebSocket:', requestData);
      // Если запрос принят и это запрос текущего пользователя, подключаемся к комнате события
      if (requestData.status === 'ACCEPTED' && requestData.userId === currentUserId && requestData.eventId) {
        socket.emit('event:join', { eventId: requestData.eventId });
      }
      // Обновляем запросы на участие
      refreshPendingJoinRequests().catch(error => {
        logger.error('Failed to refresh requests after WebSocket event:request:status:', error);
      });
      // Синхронизируем события
      syncEventsFromServer().catch(error => {
        logger.error('Failed to sync events after WebSocket event:request:status:', error);
      });
    });

    // Подписка на новый запрос в друзья
    socket.on('friend:request:new', (requestData: any) => {
      logger.debug('👥 Получен новый запрос в друзья через WebSocket:', requestData);
      // Синхронизируем запросы в друзья
      syncFriendRequestsFromServer().catch(error => {
        logger.error('Failed to sync friend requests after WebSocket friend:request:new:', error);
      });
    });

    // Подписка на обновление статуса запроса в друзья
    socket.on('friend:request:status', (requestData: any) => {
      logger.debug('🔄 Получено обновление статуса запроса в друзья через WebSocket:', requestData);
      // Синхронизируем запросы в друзья и друзей
      Promise.all([
        syncFriendRequestsFromServer(),
        syncFriendsFromServer(),
      ]).catch(error => {
        logger.error('Failed to sync friends after WebSocket friend:request:status:', error);
      });
    });

    // Подписка на новое уведомление
    socket.on('notification:new', (notificationData: any) => {
      logger.debug('🔔 Получено новое уведомление через WebSocket:', notificationData);
      // Добавляем уведомление в состояние
      setNotifications(prev => {
        // Проверяем, нет ли уже такого уведомления
        const exists = prev.find(n => n.id === notificationData.id);
        if (exists) return prev;
        
        // Преобразуем данные уведомления в формат клиента
        const notification: Notification = {
          id: notificationData.id,
          userId: notificationData.userId || currentUserId || '',
          type: notificationData.type,
          payload: notificationData.payload || {},
          readAt: notificationData.readAt ? new Date(notificationData.readAt) : null,
          createdAt: new Date(notificationData.createdAt),
        };
        
        return [notification, ...prev];
      });
      
      // Также обновляем счетчик непрочитанных
      refreshNotifications().catch(error => {
        logger.error('Failed to refresh notifications after WebSocket notification:new:', error);
      });
    });

    // Подключение к комнатам всех чатов пользователя
    const joinChatRooms = () => {
      if (!socket.connected) return;
      chats.forEach(chat => {
        socket.emit('chat:join', { chatId: chat.id });
        logger.debug('✅ Подключились к комнате чата:', chat.id);
      });
    };

    // Если чаты уже загружены и сокет подключен, сразу подключаемся к комнатам
    if (chats.length > 0 && socket.connected) {
      joinChatRooms();
    }

    // Обработчик подключения - подключаемся к комнатам
    const onConnect = () => {
      logger.info('✅ WebSocket подключен, присоединяемся к чатам');
      // Используем актуальный список чатов из состояния с небольшой задержкой
      setTimeout(() => {
        if (socket?.connected && chats.length > 0) {
          chats.forEach(chat => {
            socket?.emit('chat:join', { chatId: chat.id });
          });
        }
      }, 100);
    };
    
    socket.on('connect', onConnect);
    eventHandlers.push({ event: 'connect', handler: onConnect });

      // Функция для подключения к комнате конкретного чата (используется при открытии чата)
    const joinChat = (chatId: string) => {
      socket.emit('chat:join', { chatId });
    };

    // Экспортируем функцию для использования вне этого эффекта
    (socket as any).joinChat = joinChat;

    // Очистка при размонтировании или переподключении
    return () => {
      // Удаляем все сохраненные обработчики
      eventHandlers.forEach(({ event, handler }) => {
        socket.off(event, handler as any);
      });
      // Также удаляем все обработчики напрямую для гарантии
      socket.off('message:new');
      socket.off('chats:update');
      socket.off('event:created');
      socket.off('event:updated');
      socket.off('event:deleted');
      socket.off('event:request:new');
      socket.off('event:request:updated');
      socket.off('event:request:status');
      socket.off('friend:request:new');
      socket.off('friend:request:status');
      socket.off('notification:new');
      socket.off('connect');
      // НЕ отключаем сокет полностью, так как он может использоваться после смены токена
      // Отключение произойдет только при отсутствии токена или смене пользователя
    };
  }, [accessToken, currentUserId, refreshToken, refreshSession]);

  // Автоматическое подключение к новым чатам при их добавлении
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    // Подключаемся к новым чатам
    chats.forEach(chat => {
      socket.emit('chat:join', { chatId: chat.id });
    });
  }, [chats]);

  // Загружаем уведомления при изменении accessToken или currentUserId
  useEffect(() => {
    if (accessToken && currentUserId) {
      refreshNotifications();
    }
  }, [accessToken, currentUserId, refreshNotifications]);

  // saveEvent, removeSavedEvent, isEventSaved, getSavedEvents теперь в useSavedEvents хуке

  // saveMemoryPost, removeSavedMemoryPost, isMemoryPostSaved, getSavedMemoryPosts теперь в useSavedMemoryPosts хуке

  // deleteEventProfilePost теперь находится в useEventProfiles хуке

  // Жалоба на меморис пост
  const reportMemoryPost = useCallback(async (eventId: string, postId: string) => {
    if (!accessToken || !currentUserId) {
      logger.warn('Cannot report post: no access');
      return;
    }

    try {
      await apiRequest(
        `/events/${eventId}/profile/posts/${postId}/report`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: 'inappropriate' }),
        },
        accessToken,
      );
    } catch (error) {
      logger.error('Failed to report memory post', error);
      throw error;
    }
  }, [accessToken, currentUserId]);

  return (
    <EventsContext.Provider value={{ 
      events, 
      createEvent, 
      updateEvent, 
      deleteEvent, 
      getUserData,
      updateUserData,
      getOrganizerStats,
      friends,
      friendRequests,
      sendFriendRequest,
      removeFriend,
      respondToFriendRequest,
      getFriendsList,
      getUserFriendsList,
      isFriend,
      getFriendsForEvents,
      userFolders,
      addUserToFolder,
      removeUserFromFolder,
      createUserFolder,
      deleteUserFolder,
      getEventsByUserFolder,
      messageFolders,
      refreshMessageFolders: syncMessageFolders,
      createMessageFolder,
      addChatsToMessageFolder,
      removeChatFromMessageFolder,
      chats,
      chatMessages,
      createEventChat,
      createEventChatWithParticipants,
      createPersonalChat,
      sendChatMessage,
      sendEventToChats,
      sendMemoryPostToChats,
      getChatMessages,
      getChat,
      getChatsForUser,
      addParticipantToChat,
      eventRequests,
      eventProfiles,
      sendEventRequest,
      sendEventInvite,
      acceptInvitation,
      rejectInvitation,
      respondToEventRequest,
      cancelEventRequest,
      removeEventRequestById,
      cancelEventParticipation,
      cancelEvent,
      cancelOrganizerParticipation,
      removeParticipantFromEvent,
      getEventProfile,
      fetchEventProfile,
      createEventProfile,
      addEventProfilePost,
      updateEventProfile,
      updateEventProfilePost,
      getEventParticipants,
      canEditEventProfile,
      getMyEventRequests,
      getEventOrganizer,
      getMyEventParticipationStatus,
      isUserParticipant,
      getMyCalendarEvents,
      getUserCalendarEvents,
      getGlobalEvents,
      // Новая декларативная система состояний
      isEventUpcoming,
      isEventPast,
      isEventFull,
      isEventNotFull,
      isUserOrganizer,
      isUserAttendee,
      isUserEventMember,
      getUserRequestStatus,
      getUserRelationship,
      isFriendOfOrganizer,
      getAcceptedParticipants,
      // Персонализированные фото событий
      getEventPhotoForUser,
      setPersonalEventPhoto,
      // Сохраненные события
      savedEvents,
      saveEvent,
      removeSavedEvent,
      isEventSaved,
      getSavedEvents,
      savedMemoryPosts,
      saveMemoryPost,
      removeSavedMemoryPost,
      isMemoryPostSaved,
      getSavedMemoryPosts,
      deleteEventProfilePost,
      reportMemoryPost,
      // Система уведомлений
      notifications,
      unreadNotificationsCount,
      refreshNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      deleteNotification,
      // Поиск пользователей по username
      findUserByUsername,
      isUsernameAvailable
    }}>
      {children}
    </EventsContext.Provider>
  );
}