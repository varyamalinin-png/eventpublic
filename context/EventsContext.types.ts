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
import type { EventFolder } from '../types/EventFolder';

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
  // Поле для массового события
  isMassEvent?: boolean;
  // Метки (теги)
  tags?: string[];
  // Дополнительные поля
  targeting?: {
    enabled?: boolean;
    reach?: number;
    responses?: number;
  };
  // Для веба: File объект для загрузки (используется вместо mediaUrl/originalMediaUrl)
  selectedFile?: File | null;
};

export type UserProfilePatch = Partial<{
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

export type UserProfile = {
  name: string;
  username: string;
  avatar: string;
  age: string;
  bio: string;
  geoPosition: string;
  accountType?: 'personal' | 'business'; // Тип аккаунта: личный или бизнес
};

export interface EventsContextType {
  events: Event[];
  syncEventsFromServer: () => Promise<void>;
  syncChatsFromServer: () => Promise<void>;
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
  // Система папок событий
  eventFolders: EventFolder[];
  createEventFolder: (name: string, description?: string, coverPhoto?: { uri: string; type: string; name: string }) => Promise<EventFolder | null>;
  updateEventFolder: (folderId: string, name?: string, description?: string, coverPhoto?: { uri: string; type: string; name: string }) => Promise<EventFolder | null>;
  deleteEventFolder: (folderId: string) => Promise<void>;
  addEventToFolder: (folderId: string, eventId: string) => Promise<void>;
  removeEventFromFolder: (folderId: string, eventId: string) => Promise<void>;
  getEventFolderById: (folderId: string) => Promise<EventFolder | null>;
  refreshEventFolders: () => Promise<void>;
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
  deleteChat: (chatId: string, leaveEvent?: boolean) => Promise<void>;
  sendEventToChats: (eventId: string, chatIds: string[]) => Promise<void>;
  sendMemoryPostToChats: (eventId: string, postId: string, chatIds: string[]) => Promise<void>;
  getChatMessages: (chatId: string) => ChatMessage[];
  getChat: (chatId: string) => Chat | null;
  getChatsForUser: (userId: string) => Chat[];
  fetchMessagesForChat: (chatId: string, force?: boolean) => Promise<void>;
  markChatAsRead: (chatId: string) => Promise<void>;
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
  transferOrganizerRole: (eventId: string, newOrganizerId: string) => Promise<void>; // Передача роли организатора другому участнику
  removeParticipantFromEvent: (eventId: string, userId: string) => void; // Удаление участника из события (для организатора)
  getEventProfile: (eventId: string) => EventProfile | null;
  fetchEventProfile: (eventId: string) => Promise<EventProfile | null>;
  createEventProfile: (eventId: string) => Promise<void>;
  addEventProfilePost: (eventId: string, post: Omit<EventProfilePost, 'id' | 'eventId' | 'createdAt'>) => Promise<EventProfilePost | null>;
  updateEventProfile: (eventId: string, updates: Partial<EventProfile>) => Promise<void>;
  updateEventProfilePost: (eventId: string, postId: string, updates: Partial<EventProfilePost>) => Promise<void>;
  addPostComment: (eventId: string, postId: string, comment: Omit<PostComment, 'id' | 'postId' | 'createdAt'>) => Promise<void>;
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
  saveEvent: (eventId: string, eventObject?: Event) => void;
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
