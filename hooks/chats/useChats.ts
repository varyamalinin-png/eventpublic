import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest, ApiError } from '../../services/api';
import type { Chat, ChatMessage, Event, EventRequest, EventProfile } from '../../types';
import type { ServerUser, ServerChat, ServerChatMessage } from '../../types/api';
import { createLogger } from '../../utils/logger';

const logger = createLogger('Chats');

// Утилиты для маппинга данных с сервера
export const mapServerMessageToClient = (message: ServerChatMessage): ChatMessage => ({
  id: message.id,
  chatId: message.chatId || '',
  fromUserId: message.senderId ?? message.fromUserId ?? '',
  text: message.content ?? undefined,
  eventId: message.eventId ?? undefined,
  createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
});

export const mapServerChatToClient = (chat: ServerChat): Chat => ({
  id: chat.id,
  type: (chat.type ? String(chat.type).toLowerCase() : 'personal') as Chat['type'],
  eventId: chat.eventId ?? undefined,
  name: chat.name ?? chat.event?.title ?? 'Чат',
  participants: (chat.participants ?? []).map((participant) => participant.userId ?? '').filter(Boolean),
  lastMessage: chat.lastMessage ? mapServerMessageToClient(chat.lastMessage) : undefined,
  lastActivity: chat.updatedAt ? new Date(chat.updatedAt) : new Date(),
  createdAt: chat.createdAt ? new Date(chat.createdAt) : new Date(),
  avatar: chat.event?.originalMediaUrl ?? chat.event?.mediaUrl ?? undefined,
});

export interface UseChatsReturn {
  chats: Chat[];
  chatMessages: ChatMessage[];
  syncChatsFromServer: () => Promise<void>;
  createEventChat: (eventId: string) => void;
  createEventChatWithParticipants: (eventId: string, firstAcceptedUserId: string) => Promise<void>;
  createPersonalChat: (otherUserId: string) => Promise<string>;
  sendChatMessage: (chatId: string, text: string, eventId?: string, postId?: string) => Promise<void>;
  getChatMessages: (chatId: string) => ChatMessage[];
  getChat: (chatId: string) => Chat | null;
  getChatsForUser: (userId: string) => Chat[];
  addParticipantToChat: (eventId: string, userId: string) => Promise<void>;
  fetchMessagesForChat: (chatId: string) => Promise<void>;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export interface UseChatsParams {
  accessToken: string | null;
  currentUserId: string | null;
  handleUnauthorizedError: (error: unknown) => Promise<boolean>;
  applyServerUserDataToState: (serverUser: ServerUser) => void;
  // Зависимости для создания чатов
  events: Event[];
  eventRequests: EventRequest[];
  eventProfiles: EventProfile[];
  // Зависимости для отправки сообщений и событий
  resolveRequestUserId: (request: EventRequest) => string | null;
  getUserData: (userId: string) => { name?: string; username?: string; avatar?: string; [key: string]: unknown };
}

export function useChats({
  accessToken,
  currentUserId,
  handleUnauthorizedError,
  applyServerUserDataToState,
  events,
  eventRequests,
  eventProfiles,
  resolveRequestUserId,
  getUserData,
}: UseChatsParams): UseChatsReturn {
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const loadedChatMessages = useRef<Set<string>>(new Set());
  const currentAccessTokenRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Обновляем ref при изменении токена и userId через useEffect
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
    currentUserIdRef.current = currentUserId;
  }, [accessToken, currentUserId]);

  const syncChatsFromServer = useCallback(async () => {
    // Используем актуальный токен из ref
    const actualToken = currentAccessTokenRef.current;
    if (!actualToken) return;
    
    try {
      const response = await apiRequest('/chats', {}, actualToken);
      if (Array.isArray(response)) {
        response.forEach((chat: ServerChat) => {
          (chat?.participants ?? []).forEach((participant) => {
            if (participant?.user) {
              applyServerUserDataToState(participant.user);
            }
          });
          if (chat?.lastMessage?.sender) {
            applyServerUserDataToState(chat.lastMessage.sender);
          }
          if (chat?.event?.organizer) {
            applyServerUserDataToState(chat.event.organizer);
          }
        });
        const mapped = response.map(mapServerChatToClient);
        // Исправляем название личных чатов - должно быть имя получателя
        const currentUserIdValue = currentUserId;
        const mappedWithFixedNames = mapped.map(chat => {
          if (chat.type === 'personal' && currentUserIdValue && getUserData) {
            // Находим другого участника (не текущего пользователя)
            const otherUserId = chat.participants.find(p => p !== currentUserIdValue);
            if (otherUserId) {
              const otherUserData = getUserData(otherUserId);
              if (otherUserData) {
                chat.name = otherUserData.name || otherUserData.username || 'Чат';
              }
            }
          }
          return chat;
        });
        loadedChatMessages.current.clear();
        setChats(mappedWithFixedNames);
      }
    } catch (error) {
      // Проверяем только 401/403 - другие ошибки не должны вызывать logout
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        if (await handleUnauthorizedError(error)) {
          return;
        }
      }
      logger.error('Failed to load chats from API', error);
    }
  }, [applyServerUserDataToState, handleUnauthorizedError]);

  const createEventChat = useCallback((eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) {
      logger.warn('Событие не найдено:', eventId);
      return;
    }

    // Проверяем, есть ли уже чат для этого события ТОЛЬКО по eventId и типу 'event'
    const existingChat = chats.find(c => c.eventId === eventId && c.type === 'event');
    if (existingChat) {
      logger.debug('Чат уже существует для события:', eventId);
      return;
    }

    // Формируем уникальный ID чата на основе eventId
    const chatId = `chat-event-${eventId}`;

    // Формируем название чата: дата + название события
    const chatName = `${event.displayDate} - ${event.title}`;

    // Получаем участников события
    const participants: string[] = [event.organizerId];
    
    // Добавляем принятых участников
    const acceptedRequests = eventRequests.filter(req => 
      req.eventId === eventId && req.status === 'accepted'
    );
    
    acceptedRequests.forEach(req => {
      const participantId = resolveRequestUserId(req);
      if (participantId && !participants.includes(participantId)) {
        participants.push(participantId);
      }
    });

    // Создаем чат только если участников >= 2
    if (participants.length >= 2) {
      // Получаем аватарку события: originalMediaUrl, mediaUrl или eventProfile.avatar
      let chatAvatar: string | undefined = event.originalMediaUrl || event.mediaUrl;
      if (!chatAvatar) {
        const profile = eventProfiles.find(p => p.eventId === eventId);
        chatAvatar = profile?.avatar;
      }

      const newChat: Chat = {
        id: chatId,
        type: 'event',
        eventId: eventId,
        name: chatName,
        participants,
        avatar: chatAvatar,
        lastActivity: new Date(),
        createdAt: new Date()
      };

      setChats(prev => [...prev, newChat]);
      logger.info('✅ Создан новый чат события:', chatId, 'с участниками:', participants.length);
    } else {
      logger.warn('Недостаточно участников для создания чата:', participants.length);
    }
  }, [events, chats, eventRequests, eventProfiles, resolveRequestUserId]);

  const createEventChatWithParticipants = useCallback(async (eventId: string, firstAcceptedUserId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      logger.warn('Нет доступа для создания чата');
      return;
    }

    const event = events.find(e => e.id === eventId);
    if (!event) {
      logger.warn('Событие не найдено:', eventId);
      return;
    }

    // Проверяем, есть ли уже чат для этого события
    const existingChat = chats.find(c => c.eventId === eventId && c.type === 'event');
    if (existingChat) {
      logger.debug('Чат уже существует для события:', eventId);
      // Если чат существует, но нового участника нет - добавляем его на бэкенде
      if (!existingChat.participants.includes(firstAcceptedUserId)) {
        try {
          await apiRequest(
            `/chats/events/${eventId}`,
            {
              method: 'POST',
              body: JSON.stringify({ 
                participantIds: [...existingChat.participants, firstAcceptedUserId] 
              }),
            },
            actualToken,
          );
          // Синхронизируем чаты после обновления
          await syncChatsFromServer();
        } catch (error) {
          logger.error('❌ Ошибка при добавлении участника в чат:', error);
        }
      }
      return;
    }

    // Получаем участников: организатор + новый участник
    const participants: string[] = [event.organizerId];
    if (!participants.includes(firstAcceptedUserId)) {
      participants.push(firstAcceptedUserId);
    }

    try {
      // Создаем чат на бэкенде
      const serverChat = await apiRequest(
        `/chats/events/${eventId}`,
        {
          method: 'POST',
          body: JSON.stringify({ participantIds: participants }),
        },
        actualToken,
      );

      if (serverChat) {
        // Применяем данные пользователей из чата
        if (serverChat.participants) {
          serverChat.participants.forEach((participant: any) => {
            if (participant?.user) {
              applyServerUserDataToState(participant.user);
            }
          });
        }
        if (serverChat.event?.organizer) {
          applyServerUserDataToState(serverChat.event.organizer);
        }

        // Маппим и добавляем в локальное состояние
        const mappedChat = mapServerChatToClient(serverChat);
        setChats(prev => {
          const exists = prev.find(c => c.id === mappedChat.id);
          if (exists) return prev;
          return [...prev, mappedChat];
        });

        logger.info('✅ Создан новый чат события на бэкенде:', mappedChat.id, 'с участниками:', participants.length);
      }
    } catch (error) {
      logger.error('❌ Ошибка при создании чата на бэкенде:', error);
      // Fallback: создаем локально, если бэкенд недоступен
      const chatId = `chat-event-${eventId}`;
      const chatName = `${event.displayDate} - ${event.title}`;
      let chatAvatar: string | undefined = event.originalMediaUrl || event.mediaUrl;
      if (!chatAvatar) {
        const profile = eventProfiles.find(p => p.eventId === eventId);
        chatAvatar = profile?.avatar;
      }

      const newChat: Chat = {
        id: chatId,
        type: 'event',
        eventId: eventId,
        name: chatName,
        participants,
        avatar: chatAvatar,
        lastActivity: new Date(),
        createdAt: new Date()
      };

      setChats(prev => {
        const exists = prev.find(c => c.id === newChat.id);
        if (exists) return prev;
        return [...prev, newChat];
      });
      logger.debug('Чат создан локально (fallback):', chatId);
    }
  }, [events, chats, eventProfiles, applyServerUserDataToState, syncChatsFromServer]);

  const createPersonalChat = useCallback(async (otherUserId: string): Promise<string> => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      throw new Error('Необходима авторизация для создания чата');
    }

    // Проверяем, существует ли уже чат с этим пользователем
    const existingChat = chats.find(chat => 
      chat.type === 'personal' && 
      chat.participants.includes(actualUserId) && 
      chat.participants.includes(otherUserId) &&
      chat.participants.length === 2
    );

    if (existingChat) {
      return existingChat.id;
    }

    try {
      const response = await apiRequest(
        '/chats/personal',
        {
          method: 'POST',
          body: JSON.stringify({ otherUserId }),
        },
        actualToken,
      );

      if (response) {
        // Применяем данные пользователей
        if (response.participants) {
          response.participants.forEach((participant: any) => {
            if (participant?.user) {
              applyServerUserDataToState(participant.user);
            }
          });
        }

        const mappedChat = mapServerChatToClient(response);
        setChats(prev => {
          const exists = prev.find(c => c.id === mappedChat.id);
          if (exists) return prev;
          return [...prev, mappedChat];
        });

        // Синхронизируем список чатов с сервера, чтобы убедиться, что оба участника видят чат
        syncChatsFromServer().catch(error => {
          logger.warn('Failed to sync chats after creating personal chat:', error);
        });

        return mappedChat.id;
      } else {
        // Если ответ пустой, создаем локальный ID
        const localId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return localId;
      }
    } catch (error) {
      logger.warn('Failed to create personal chat on server, creating locally', error);
      // Fallback: создаем локально
      const otherUserData = getUserData(otherUserId);
      const chatName = otherUserData.name || otherUserData.username || 'Чат';
      const chatId = `chat-personal-${actualUserId}-${otherUserId}`;
      const newChat: Chat = {
        id: chatId,
        type: 'personal',
        name: chatName,
        participants: [actualUserId, otherUserId],
        avatar: otherUserData.avatar,
        lastActivity: new Date(),
        createdAt: new Date()
      };

      setChats(prev => {
        const exists = prev.find(c => c.id === newChat.id);
        if (exists) return prev;
        return [...prev, newChat];
      });

      return chatId;
    }
  }, [chats, getUserData, applyServerUserDataToState]);

  const sendChatMessage = useCallback(async (chatId: string, text: string, eventId?: string, postId?: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot send message: no access');
      return;
    }

    try {
      const payload: any = { content: text };
      if (eventId) payload.eventId = eventId;
      // postId не отправляем на сервер (сервер не принимает это поле)
      // но сохраним его в локальном состоянии сообщения

      const response = await apiRequest(
        `/chats/${chatId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        actualToken,
      );

      if (response?.sender) {
        applyServerUserDataToState(response.sender);
      }

      const newMessage = mapServerMessageToClient(response);
      // Сохраняем postId в локальном состоянии, если он был передан
      // Это важно, так как сервер не сохраняет postId
      if (postId) {
        newMessage.postId = postId;
      }
      // Также сохраняем eventId, если он был передан
      if (eventId) {
        newMessage.eventId = eventId;
      }
      setChatMessages(prev => {
        const exists = prev.find(msg => msg.id === newMessage.id);
        if (exists) {
          // Обновляем существующее сообщение с postId и eventId
          return prev.map(msg => msg.id === newMessage.id ? { ...msg, postId: postId || msg.postId, eventId: eventId || msg.eventId } : msg);
        }
        return [...prev, newMessage];
      });

      // Обновляем lastActivity чата
      setChats(prev => prev.map(chat =>
        chat.id === chatId
          ? { ...chat, lastActivity: new Date(), lastMessage: newMessage }
          : chat
      ));
    } catch (error) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      logger.warn(`Failed to send chat message: ${error instanceof ApiError ? error.status : 'unknown'} ${error instanceof ApiError ? error.message : String(error)}`);
    }
  }, [applyServerUserDataToState, handleUnauthorizedError]);

  const fetchMessagesForChat = useCallback(
    async (chatId: string) => {
      const actualToken = currentAccessTokenRef.current;
      if (!actualToken) return;
      if (loadedChatMessages.current.has(chatId)) return;

      loadedChatMessages.current.add(chatId);
      try {
        const response = await apiRequest(`/chats/${chatId}/messages`, {}, actualToken);
        if (Array.isArray(response)) {
          response.forEach((message: any) => {
            if (message?.sender) {
              applyServerUserDataToState(message.sender);
            }
          });
          setChatMessages(prev => {
            const existingIds = new Set(prev.map(msg => msg.id));
            const mappedMessages = response
              .map(mapServerMessageToClient)
              .filter(msg => !existingIds.has(msg.id));
            if (mappedMessages.length === 0) {
              return prev;
            }
            return [...prev, ...mappedMessages];
          });
        }
      } catch (error) {
        loadedChatMessages.current.delete(chatId);
        if (await handleUnauthorizedError(error)) {
          return;
        }
        logger.error(`Failed to load messages for chat ${chatId}`, error);
      }
    },
    [applyServerUserDataToState, handleUnauthorizedError],
  );

  const getChatMessages = useCallback((chatId: string): ChatMessage[] => {
    return chatMessages
      .filter(msg => msg.chatId === chatId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [chatMessages]);

  const getChat = useCallback((chatId: string): Chat | null => {
    return chats.find(c => c.id === chatId) ?? null;
  }, [chats]);

  const getChatsForUser = useCallback((userId: string): Chat[] => {
    return chats.filter(chat => chat.participants.includes(userId)).sort((a, b) => 
      b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }, [chats]);

  const addParticipantToChat = useCallback(async (eventId: string, userId: string) => {
    // Ищем чат ТОЛЬКО по eventId и типу 'event'
    const eventChat = chats.find(c => c.eventId === eventId && c.type === 'event');
    
    if (!eventChat) {
      logger.warn('Чат не найден для события:', eventId);
      return;
    }
    
    // Проверяем, что пользователь еще не в чате
    if (eventChat.participants.includes(userId)) {
      // Пользователь уже в чате - тихо возвращаемся без логирования ошибки
      return;
    }
    
    // Добавляем участника в чат
    setChats(prev => prev.map(chat =>
      chat.id === eventChat.id
        ? { ...chat, participants: [...chat.participants, userId] }
        : chat
    ));
    logger.info('✅ Участник добавлен в чат события:', eventId);
  }, [chats]);

  return {
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
  };
}

