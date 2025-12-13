import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest, ApiError } from '../../services/api';
import { createLogger } from '../../utils/logger';
import type { Event, EventRequest } from '../../types';
import type { ServerEventRequest } from '../../types/api';

const logger = createLogger('useEventRequests');

export interface UseEventRequestsParams {
  accessToken: string | null;
  currentUserId: string | null;
  refreshToken: string | null;
  handleUnauthorizedError: (error: unknown) => Promise<boolean>;
  refreshSession: (refreshToken: string) => Promise<void>;
  applyServerUserDataToState: (serverUser: any) => void;
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  setEventProfiles: React.Dispatch<React.SetStateAction<any[]>>;
  setChats: React.Dispatch<React.SetStateAction<any[]>>;
  updateEvent: (id: string, updates: Partial<Event>) => Promise<void>;
  syncEventsFromServer: () => Promise<void>;
  syncChatsFromServer: () => Promise<void>;
  createEventProfile: (eventId: string) => Promise<void>;
  addParticipantToChat: (eventId: string, userId: string) => Promise<void>;
  createEventChatWithParticipants: (eventId: string, userId: string) => Promise<void>;
  getUserData: (userId: string) => any;
  isUserEventMember: (event: Event, userId: string) => boolean;
  isEventPast: (event: Event) => boolean;
  resolveUserId: (userId: string | null) => string;
  chats: any[];
  eventProfiles: any[];
}

export interface UseEventRequestsReturn {
  eventRequests: EventRequest[];
  setEventRequests: React.Dispatch<React.SetStateAction<EventRequest[]>>;
  refreshPendingJoinRequests: (eventsSnapshot?: Event[]) => Promise<void>;
  sendEventRequest: (eventId: string, userId: string) => Promise<void>;
  sendEventInvite: (eventId: string, fromUserId: string, toUserId: string, eventParam?: Event) => Promise<void>;
  acceptInvitation: (requestId: string) => Promise<void>;
  rejectInvitation: (requestId: string) => Promise<void>;
  respondToEventRequest: (requestId: string, accepted: boolean) => Promise<void>;
  cancelEventRequest: (eventId: string, userId: string) => Promise<void>;
  cancelEventParticipation: (eventId: string, userId: string) => Promise<void>;
  removeEventRequestById: (requestId: string) => void;
  resolveRequestUserId: (request: EventRequest | null | undefined) => string | null;
  requestBelongsToUser: (request: EventRequest, userId: string | null) => boolean;
}

export const useEventRequests = ({
  accessToken,
  currentUserId,
  refreshToken,
  handleUnauthorizedError,
  refreshSession,
  applyServerUserDataToState,
  events,
  setEvents,
  setEventProfiles,
  setChats,
  updateEvent,
  syncEventsFromServer,
  syncChatsFromServer,
  createEventProfile,
  addParticipantToChat,
  createEventChatWithParticipants,
  getUserData,
  isUserEventMember,
  isEventPast,
  resolveUserId,
  chats,
  eventProfiles,
}: UseEventRequestsParams): UseEventRequestsReturn => {
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
  const currentAccessTokenRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Обновляем refs при изменении accessToken и currentUserId через useEffect
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
    currentUserIdRef.current = currentUserId;
  }, [accessToken, currentUserId]);

  // Вспомогательная функция для получения userId из запроса
  const resolveRequestUserId = (request: EventRequest | null | undefined): string | null => {
    if (!request) return null;
    if (request.type === 'invite') {
      return request.toUserId ?? request.userId ?? null;
    }
    if (request.type === 'join') {
      return request.fromUserId ?? request.userId ?? null;
    }
    return request.userId ?? null;
  };

  // Вспомогательная функция для проверки принадлежности запроса пользователю
  const requestBelongsToUser = (request: EventRequest, userId: string | null): boolean => {
    if (!userId) return false;
    const resolvedUserId = resolveUserId(userId);
    const resolved = resolveRequestUserId(request);
    if (!resolved) return false;
    return resolved === resolvedUserId;
  };

  // Обновление запросов на участие с сервера
  const refreshPendingJoinRequests = useCallback(
    async (eventsSnapshot?: Event[]) => {
      // Используем актуальный токен из ref, чтобы избежать использования старого токена после переключения аккаунта
      const actualToken = currentAccessTokenRef.current;
      const actualUserId = currentUserIdRef.current;
      
      if (!actualToken || !actualUserId) {
        logger.debug('refreshPendingJoinRequests: нет токена или userId, пропускаем');
        return;
      }
      
      try {
        // 📥 ИСПОЛЬЗУЕМ НОВЫЙ API ДЛЯ ПОЛУЧЕНИЯ ПРИГЛАШЕНИЙ
        // Получаем входящие приглашения (где меня пригласили)
        logger.debug('refreshPendingJoinRequests: запрашиваем входящие приглашения для userId:', actualUserId);
        const incomingInvitations = await apiRequest(
          `/events/requests/user?type=incoming`,
          {},
          actualToken,
        ).catch(error => {
          if (error?.status === 401 && refreshToken && refreshToken.trim() !== '') {
            return refreshSession(refreshToken).then(() => []);
          }
          logger.warn('Failed to fetch incoming invitations:', error);
          return [];
        });
        
        logger.debug('refreshPendingJoinRequests: получено входящих приглашений:', Array.isArray(incomingInvitations) ? incomingInvitations.length : 0);

        // Получаем исходящие приглашения (где я пригласил других)
        const outgoingInvitations = await apiRequest(
          `/events/requests/user?type=outgoing`,
          {},
          actualToken,
        ).catch(error => {
          if (error?.status === 401 && refreshToken && refreshToken.trim() !== '') {
            return refreshSession(refreshToken).then(() => []);
          }
          logger.warn('Failed to fetch outgoing invitations:', error);
          return [];
        });

        // КРИТИЧЕСКИ ВАЖНО: Получаем исходящие join-запросы (где я отправил запрос на участие)
        // Это нужно для сохранения статуса запросов при перезапуске приложения
        const outgoingJoinRequests = await apiRequest(
          `/events/requests/user?type=join`,
          {},
          actualToken,
        ).catch(error => {
          if (error?.status === 401 && refreshToken && refreshToken.trim() !== '') {
            return refreshSession(refreshToken).then(() => []);
          }
          logger.warn('Failed to fetch outgoing join requests:', error);
          return [];
        });
        
        logger.debug('refreshPendingJoinRequests: получено исходящих join-запросов:', Array.isArray(outgoingJoinRequests) ? outgoingJoinRequests.length : 0);

        // Получаем события, где пользователь является организатором (для запросов на участие)
        // Исключаем временные события (preview-event-temp и т.д.)
        const organizedEvents = (eventsSnapshot ?? events).filter(event => 
          event.organizerId === actualUserId && 
          !event.id.includes('-temp') && 
          !event.id.startsWith('preview-')
        );
        
        // Получаем запросы на участие для событий, где пользователь является организатором
        const organizerRequestsByEvent = await Promise.all(
          organizedEvents.map(async event => {
            try {
              // Проверка на временные события перед запросом к серверу
              if (event.id.includes('-temp') || event.id.startsWith('preview-')) {
                return [];
              }
              const pending = await apiRequest(`/events/${event.id}/requests`, {}, actualToken);
              if (!Array.isArray(pending)) {
                return [];
              }
              return pending
              .map((membership: any) => {
                if (membership?.user) {
                  applyServerUserDataToState(membership.user);
                }
                const statusRaw = String(membership?.status ?? 'pending').toLowerCase();
                const status: EventRequest['status'] =
                  statusRaw === 'accepted' || statusRaw === 'rejected' ? statusRaw : 'pending';
                
                // Если есть invitedBy, это приглашение (invite), иначе это запрос на участие (join)
                const isInvite = !!membership.invitedBy;
                
                // Для запросов организатора показываем только join-запросы (не приглашения)
                if (isInvite) return null;
                
                const mappedRequest = {
                  id: membership.id,
                  type: 'join' as const,
                  eventId: membership.eventId || membership.event?.id || '',
                  fromUserId: membership.userId || '',
                  toUserId: event.organizerId || '',
                  status,
                  createdAt: membership.createdAt ? new Date(membership.createdAt) : new Date(),
                  userId: membership.userId,
                };
                
                return mappedRequest;
              })
              .filter(Boolean);
            } catch (error: any) {
              if (error?.status === 403 || error?.status === 404) {
                return [];
              }
              logger.warn(`Failed to fetch requests for event ${event.id}:`, error);
              return [];
            }
          }),
        );

        // Маппим входящие приглашения с сервера
        const mappedIncomingInvitations: EventRequest[] = (Array.isArray(incomingInvitations) ? incomingInvitations : [])
          .map((membership: any) => {
            if (membership?.event?.organizer) {
              applyServerUserDataToState(membership.event.organizer);
            }
            if (membership?.user) {
              applyServerUserDataToState(membership.user);
            }
            
            const statusRaw = String(membership?.status ?? 'pending').toLowerCase();
            const status: EventRequest['status'] =
              statusRaw === 'accepted' || statusRaw === 'rejected' ? statusRaw : 'pending';
            
            // КРИТИЧЕСКИ ВАЖНО: для входящих приглашений
            // fromUserId = кто пригласил (invitedBy или organizerId из event)
            // toUserId = кого пригласили (userId из membership)
            const fromUserId = (membership.invitedBy || membership.event?.organizerId || '') as string;
            
            logger.debug('📥 Входящее приглашение:', {
              id: membership.id,
              eventId: membership.eventId,
              fromUserId,
              toUserId: membership.userId,
              status,
              invitedBy: membership.invitedBy,
            });
            
            return {
              id: membership.id,
              type: 'invite' as const,
              eventId: membership.eventId || membership.event?.id || '',
              fromUserId: fromUserId || '',
              toUserId: membership.userId || '',
              status,
              createdAt: membership.createdAt ? new Date(membership.createdAt) : new Date(),
              userId: membership.userId || '',
            };
          });
        
        logger.debug('refreshPendingJoinRequests: маппировано входящих приглашений:', mappedIncomingInvitations.length);

        // Маппим исходящие приглашения с сервера
        const mappedOutgoingInvitations: EventRequest[] = (Array.isArray(outgoingInvitations) ? outgoingInvitations : [])
          .map((membership: any) => {
            if (membership?.event?.organizer) {
              applyServerUserDataToState(membership.event.organizer);
            }
            if (membership?.user) {
              applyServerUserDataToState(membership.user);
            }
            
            const statusRaw = String(membership?.status ?? 'pending').toLowerCase();
            const status: EventRequest['status'] =
              statusRaw === 'accepted' || statusRaw === 'rejected' ? statusRaw : 'pending';
            
            return {
              id: membership.id,
              type: 'invite' as const,
              eventId: membership.eventId || membership.event?.id || '',
              fromUserId: (membership.invitedBy || actualUserId || '') as string,
              toUserId: membership.userId || '',
              status,
              createdAt: membership.createdAt ? new Date(membership.createdAt) : new Date(),
              userId: membership.userId || '',
            };
          });

        // Маппим исходящие join-запросы с сервера
        const mappedOutgoingJoinRequests: EventRequest[] = (Array.isArray(outgoingJoinRequests) ? outgoingJoinRequests : [])
          .map((membership: any) => {
            if (membership?.event?.organizer) {
              applyServerUserDataToState(membership.event.organizer);
            }
            if (membership?.user) {
              applyServerUserDataToState(membership.user);
            }
            
            const statusRaw = String(membership?.status ?? 'pending').toLowerCase();
            const status: EventRequest['status'] =
              statusRaw === 'accepted' || statusRaw === 'rejected' ? statusRaw : 'pending';
            
            logger.debug('📤 Исходящий join-запрос:', {
              id: membership.id,
              eventId: membership.eventId || membership.event?.id || '',
              fromUserId: membership.userId || '',
              toUserId: membership.event?.organizerId || '',
              status,
            });
            
            return {
              id: membership.id,
              type: 'join' as const,
              eventId: membership.eventId || membership.event?.id || '',
              fromUserId: membership.userId || '',
              toUserId: membership.event?.organizerId || '',
              status,
              createdAt: membership.createdAt ? new Date(membership.createdAt) : new Date(),
              userId: membership.userId || '',
            };
          });
        
        logger.debug('refreshPendingJoinRequests: маппировано исходящих join-запросов:', mappedOutgoingJoinRequests.length);

        const allRequests = [
          ...organizerRequestsByEvent.flat(),
          ...mappedIncomingInvitations,
          ...mappedOutgoingInvitations,
          ...mappedOutgoingJoinRequests, // Добавляем исходящие join-запросы
        ];

        logger.debug('refreshPendingJoinRequests: всего запросов после маппинга:', allRequests.length);
        logger.debug('refreshPendingJoinRequests: входящих приглашений:', mappedIncomingInvitations.length);
        logger.debug('refreshPendingJoinRequests: исходящих приглашений:', mappedOutgoingInvitations.length);
        logger.debug('refreshPendingJoinRequests: исходящих join-запросов:', mappedOutgoingJoinRequests.length);
        
        setEventRequests(prev => {
          const byId = new Map<string, EventRequest>();
          
          // КРИТИЧЕСКИ ВАЖНО: Сначала сохраняем ВСЕ локальные join-запросы от текущего пользователя
          // Это нужно, потому что сервер может еще не вернуть их через API
          prev.forEach(req => {
            // Сохраняем все приглашения (и входящие, и исходящие)
            if (req.type === 'invite') {
              byId.set(req.id, req);
            }
            // Сохраняем ВСЕ join-запросы, где текущий пользователь - отправитель (исходящие)
            // Это важно для сохранения только что созданных запросов
            else if (req.type === 'join' && req.fromUserId === actualUserId) {
              // Проверяем, что запрос еще pending (не был принят/отклонен)
              if (req.status === 'pending') {
                byId.set(req.id, req);
              }
            }
            // Сохраняем входящие join-запросы (где текущий пользователь - получатель/организатор)
            else if (req.type === 'join' && req.toUserId === actualUserId) {
              byId.set(req.id, req);
            }
          });
          
          // Добавляем/обновляем запросы с сервера
          // Запросы с сервера имеют приоритет, так как они более актуальные
          allRequests.forEach(req => {
            if (req) {
              byId.set(req.id, req);
            }
          });
          
          const finalRequests = Array.from(byId.values());
          logger.debug('refreshPendingJoinRequests: итоговое количество запросов:', finalRequests.length);
          logger.debug('refreshPendingJoinRequests: локальных join-запросов сохранено:', 
            prev.filter(r => r.type === 'join' && r.fromUserId === actualUserId && r.status === 'pending').length);
          return finalRequests;
        });
      } catch (error) {
        if (await handleUnauthorizedError(error)) {
          return;
        }
        logger.error('Failed to load event requests from API', error);
      }
    },
    [events, applyServerUserDataToState, handleUnauthorizedError, refreshToken, refreshSession],
  );

  // Ответ на запрос (принять/отклонить) - объявлен первым, чтобы использоваться в sendEventRequest
  const respondToEventRequestRef = useRef<((requestId: string, accepted: boolean) => Promise<void>) | null>(null);

  // Отправка запроса на участие в событии
  const sendEventRequest = useCallback(
    async (eventId: string, userId: string) => {
      const actualToken = currentAccessTokenRef.current;
      const actualUserId = currentUserIdRef.current;
      if (!actualToken || !actualUserId) return;

      const hasPending = eventRequests.some(
        req => req.eventId === eventId && requestBelongsToUser(req, userId) && req.status === 'pending',
      );
      if (hasPending) {
        return;
      }

      try {
        const membership = await apiRequest(
          `/events/${eventId}/join`,
          {
            method: 'POST',
          },
          actualToken,
        );

        const targetEvent = events.find(e => e.id === eventId);
        const organizerId = targetEvent?.organizerId ?? actualUserId ?? userId;

        // Важно: применяем данные пользователя ДО создания запроса, чтобы аватарка обновилась
        if (membership?.user) {
          applyServerUserDataToState(membership.user);
          // Даем время на обновление состояния
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        const statusRaw = String(membership?.status ?? 'pending').toLowerCase();
        const status: EventRequest['status'] =
          statusRaw === 'accepted' || statusRaw === 'rejected' ? statusRaw : 'pending';

        // КРИТИЧЕСКИ ВАЖНО: Используем actualUserId для fromUserId, чтобы совпадало с resolvedUserId в getUserRelationship
        // НЕ используем membership?.userId, так как он может отличаться от actualUserId
        // Это важно для правильного определения статуса "waiting" в getUserRelationship
        const requestUserId = actualUserId ?? userId;
        
        logger.debug(`[sendEventRequest] Создаем запрос для события ${eventId}:`, {
          requestUserId,
          actualUserId,
          membershipUserId: membership?.userId,
          organizerId
        });
        
        const newRequest: EventRequest = {
          id: membership?.id ?? `${Date.now()}`,
          eventId,
          type: 'join',
          fromUserId: requestUserId, // КРИТИЧЕСКИ ВАЖНО: Используем actualUserId для совпадения с resolvedUserId
          toUserId: organizerId,
          status,
          createdAt: membership?.createdAt ? new Date(membership.createdAt) : new Date(),
          userId: requestUserId, // Также обновляем userId для совместимости
        };

        setEventRequests(prev => {
          const filtered = prev.filter(
            req => !(req.eventId === eventId && requestBelongsToUser(req, newRequest.fromUserId)),
          );
          return [...filtered, newRequest];
        });

        // Для бизнес-аккаунтов автоматически принимаем запрос
        // ВАЖНО: Проверяем, что getUserData является функцией перед вызовом
        let isBusinessAccount = false;
        if (typeof getUserData === 'function' && organizerId) {
          try {
            const organizerData = getUserData(organizerId);
            isBusinessAccount = organizerData?.accountType === 'business';
          } catch (error) {
            logger.warn('Failed to get organizer data for business account check:', error);
            // Продолжаем выполнение, даже если не удалось получить данные организатора
          }
        } else if (organizerId) {
          logger.warn('getUserData is not a function, skipping business account check', {
            getUserDataType: typeof getUserData,
            organizerId,
          });
        }
        
        if (isBusinessAccount && newRequest.status === 'pending' && respondToEventRequestRef.current) {
          // Автоматически принимаем запрос для бизнес-аккаунта
          try {
            await respondToEventRequestRef.current(newRequest.id, true);
            logger.debug('Auto-accepted request for business account event');
          } catch (error) {
            logger.error('Failed to auto-accept request for business account:', error);
          }
        }

        if (organizerId && organizerId === actualUserId) {
          await refreshPendingJoinRequests();
        }
      } catch (error) {
        if (await handleUnauthorizedError(error)) {
          return;
        }
        // Обрабатываем ошибку "Already requested or member" - это нормальная ситуация
        if (error instanceof ApiError) {
          const errorMessage = error.message?.toLowerCase() || '';
          if (errorMessage.includes('already requested') || errorMessage.includes('already member') || errorMessage.includes('already a member')) {
            // Это нормальная ситуация - пользователь уже отправил запрос или является участником
            // НЕ вызываем refreshPendingJoinRequests здесь, так как это может удалить локальный запрос
            // Вместо этого проверяем, есть ли уже запрос в локальном состоянии
            const existingRequest = eventRequests.find(req => 
              req.eventId === eventId && 
              req.type === 'join' && 
              req.fromUserId === actualUserId && 
              req.status === 'pending'
            );
            if (!existingRequest) {
              // Если запроса нет в локальном состоянии, значит он уже на сервере
              // Обновляем состояние запросов, чтобы получить его с сервера
              logger.debug('User already requested or is a member, refreshing requests to get server state');
              try {
                await refreshPendingJoinRequests();
              } catch (refreshError) {
                logger.warn('Failed to refresh pending requests after already requested error:', refreshError);
              }
            } else {
              logger.debug('User already requested or is a member, local request exists, skipping refresh');
            }
            return; // Возвращаемся без пробрасывания ошибки
          }
        }
        // Для других ошибок логируем и пробрасываем
        logger.error('Failed to send event request', error);
        throw error; // Пробрасываем ошибку для других случаев
      }
    },
    [
      accessToken,
      eventRequests,
      events,
      applyServerUserDataToState,
      requestBelongsToUser,
      refreshPendingJoinRequests,
      handleUnauthorizedError,
      getUserData,
    ],
  );

  // Удаление запроса по ID (для приглашений)
  const removeEventRequestById = useCallback((requestId: string) => {
    setEventRequests(prev => 
      prev.filter(req => req.id !== requestId)
    );
    logger.debug('✅ Запрос удален по ID:', requestId);
  }, []);

  // Принятие приглашения (invited → accepted)
  const acceptInvitation = useCallback(
    async (requestId: string) => {
      const actualToken = currentAccessTokenRef.current;
      const actualUserId = currentUserIdRef.current;
      if (!actualToken || !actualUserId) return;

      const request = eventRequests.find(req => req.id === requestId);
      if (!request) {
        logger.warn('acceptInvitation: request not found', requestId);
        return;
      }

      // Проверяем, что это приглашение для текущего пользователя
      if (request.toUserId !== actualUserId && request.userId !== actualUserId) {
        logger.warn('acceptInvitation: not your invitation', requestId);
        return;
      }

      try {
        await apiRequest(
          `/events/invitations/${requestId}/accept`,
          {
            method: 'POST',
          },
          actualToken,
        );

        // КРИТИЧЕСКИ ВАЖНО: Удаляем приглашение из списка сразу после принятия
        // Это нужно, чтобы кнопка "принять приглашение" исчезла в календаре
        setEventRequests(prev => prev.filter(req => req.id !== requestId));
        
        // КРИТИЧЕСКИ ВАЖНО: Обновляем локальное состояние события, добавляя пользователя в participants
        // Это нужно, чтобы событие сразу появилось в профиле после принятия приглашения
        const event = events.find(e => e.id === request.eventId);
        if (event && actualUserId) {
          // Обновляем событие, добавляя пользователя в participantsList и participantsData
          setEvents(prev => prev.map(e => {
            if (e.id !== request.eventId) return e;
            
            // Проверяем, не добавлен ли уже пользователь
            const isAlreadyParticipant = e.participantsList?.includes(actualUserId) || 
                                        e.participantsData?.some((p: any) => 
                                          (p.userId || p.id) === actualUserId
                                        );
            
            if (isAlreadyParticipant) return e;
            
            // Добавляем пользователя в participantsList
            const updatedParticipantsList = [...(e.participantsList || []), actualUserId];
            
            // Добавляем пользователя в participantsData (если есть getUserData)
            const userData = getUserData?.(actualUserId);
            const updatedParticipantsData = userData 
              ? [...(e.participantsData || []), {
                  id: actualUserId,
                  userId: actualUserId,
                  name: userData.name,
                  username: userData.username,
                  avatar: userData.avatar || '',
                }]
              : e.participantsData;
            
            // Увеличиваем количество участников
            const updatedParticipants = e.participants + 1;
            
            return {
              ...e,
              participantsList: updatedParticipantsList,
              participantsData: updatedParticipantsData,
              participants: updatedParticipants,
            };
          }));
        }
        
        // Синхронизируем события и чаты для получения обновленных данных
        // Чат события создается автоматически на сервере при принятии первого участника
        await Promise.all([
          syncEventsFromServer?.() || Promise.resolve(),
          syncChatsFromServer?.() || Promise.resolve(),
          refreshPendingJoinRequests(),
        ]);

        logger.info('✅ Приглашение принято:', requestId);
      } catch (error) {
        logger.error('❌ Ошибка при принятии приглашения:', error);
        throw error;
      }
    },
    [eventRequests, syncEventsFromServer, syncChatsFromServer, refreshPendingJoinRequests, events, setEvents, getUserData],
  );

  // Отклонение приглашения (invited → rejected)
  const rejectInvitation = useCallback(
    async (requestId: string) => {
      const actualToken = currentAccessTokenRef.current;
      const actualUserId = currentUserIdRef.current;
      if (!actualToken || !actualUserId) return;

      const request = eventRequests.find(req => req.id === requestId);
      if (!request) {
        logger.warn('rejectInvitation: request not found', requestId);
        return;
      }

      // Проверяем, что это приглашение для текущего пользователя
      if (request.toUserId !== actualUserId && request.userId !== actualUserId) {
        logger.warn('rejectInvitation: not your invitation', requestId);
        return;
      }

      try {
        await apiRequest(
          `/events/invitations/${requestId}/reject`,
          {
            method: 'POST',
          },
          actualToken,
        );

        // Обновляем состояние - удаляем из списка, так как отклоненные не должны показываться
        setEventRequests(prev => prev.filter(req => req.id !== requestId));
        
        // Синхронизируем события
        await syncEventsFromServer();
        await refreshPendingJoinRequests();

        logger.info('✅ Приглашение отклонено:', requestId);
      } catch (error) {
        logger.error('❌ Ошибка при отклонении приглашения:', error);
        throw error;
      }
    },
    [eventRequests, syncEventsFromServer, refreshPendingJoinRequests],
  );

  const respondToEventRequest = useCallback(
    async (requestId: string, accepted: boolean) => {
      const actualToken = currentAccessTokenRef.current;
      const actualUserId = currentUserIdRef.current;
      if (!actualToken || !actualUserId) return;

      const request = eventRequests.find(req => req.id === requestId);
      if (!request) {
        logger.warn('respondToEventRequest: request not found', requestId);
        return;
      }

      // Если это приглашение (invite), используем специальные методы
      if (request.type === 'invite' && request.toUserId === actualUserId) {
        if (accepted) {
          return acceptInvitation(requestId);
        } else {
          return rejectInvitation(requestId);
        }
      }

      try {
        await apiRequest(
          `/events/${request.eventId}/requests/${requestId}?accept=${accepted}`,
          {
            method: 'PATCH',
          },
          actualToken,
        );

        const userId = resolveRequestUserId(request);
        if (accepted && userId) {
          const event = events.find(e => e.id === request.eventId);
          if (event) {
            updateEvent(request.eventId, {
              participants: event.participants + 1,
            });

            if (setEventProfiles) {
              setEventProfiles(prev =>
                prev.map(profile =>
                  profile.eventId === request.eventId && !profile.participants.includes(userId)
                    ? { ...profile, participants: [...profile.participants, userId] }
                    : profile,
                ),
              );
            }

            // Создаем чат сразу, не через setTimeout
            const existingChat = chats.find(c => c.eventId === request.eventId && c.type === 'event');
            if (existingChat) {
              if (!existingChat.participants.includes(userId)) {
                addParticipantToChat(request.eventId, userId);
              }
            } else {
              // Создаем чат на бэкенде
              createEventChatWithParticipants(request.eventId, userId).catch((error) => {
                logger.error('❌ Ошибка при создании чата после принятия запроса:', error);
              });
            }

            if (createEventProfile) {
              setTimeout(() => {
                createEventProfile(request.eventId).catch((error) => {
                  logger.error('❌ Ошибка при создании профиля события после принятия запроса:', error);
                });
              }, 1000);
            }
          }
        }

        // Обновляем статус запроса локально сразу, чтобы UI не сломался
        // Если запрос принят и это входящий запрос на участие (не приглашение), удаляем его из списка
        // для обычных аккаунтов (бизнес-аккаунты показывают accepted запросы)
        if (accepted && (!request.type || request.type === 'join')) {
          // Проверяем, является ли организатор бизнес-аккаунтом
          const event = events.find(e => e.id === request.eventId);
          const organizerData = event ? getUserData(event.organizerId) : null;
          const isBusinessAccount = organizerData?.accountType === 'business';
          
          if (!isBusinessAccount) {
            // Для обычных аккаунтов удаляем принятый запрос из списка
            setEventRequests(prev => prev.filter(req => req.id !== requestId));
          } else {
            // Для бизнес-аккаунтов обновляем статус
            setEventRequests(prev => 
              prev.map(req => 
                req.id === requestId 
                  ? { ...req, status: 'accepted' }
                  : req
              )
            );
          }
        } else {
          // Для отклоненных или приглашений обновляем статус
          setEventRequests(prev => 
            prev.map(req => 
              req.id === requestId 
                ? { ...req, status: accepted ? 'accepted' : 'rejected' }
                : req
            )
          );
        }

        // Синхронизируем с сервером после локального обновления
        try {
          await Promise.all([
            refreshPendingJoinRequests(),
            syncEventsFromServer?.() || Promise.resolve(),
            syncChatsFromServer?.() || Promise.resolve(),
          ]);
        } catch (syncError) {
          logger.error('Error during sync after accepting request:', syncError);
        }
      } catch (error) {
        if (await handleUnauthorizedError(error)) {
          return;
        }
        logger.error('Failed to respond to event request', error);
      }
    },
    [
      eventRequests,
      refreshPendingJoinRequests,
      syncEventsFromServer,
      syncChatsFromServer,
      handleUnauthorizedError,
      resolveRequestUserId,
      events,
      updateEvent,
      setEventProfiles,
      chats,
      addParticipantToChat,
      createEventChatWithParticipants,
      createEventProfile,
      acceptInvitation,
      getUserData,
      rejectInvitation,
    ],
  );

  respondToEventRequestRef.current = respondToEventRequest;

  // Отмена запроса на участие
  const cancelEventRequest = useCallback(async (eventId: string, userId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    // Проверка на временные события - не делаем запрос к серверу
    if (eventId.includes('-temp') || eventId.startsWith('preview-')) {
      logger.debug('Temporary event, removing request locally only');
      setEventRequests(prev => 
        prev.filter(req => !(req.eventId === eventId && requestBelongsToUser(req, userId)))
      );
      return;
    }
    
    if (!actualToken || !actualUserId || userId !== actualUserId) {
      setEventRequests(prev => 
        prev.filter(req => !(req.eventId === eventId && requestBelongsToUser(req, userId)))
      );
      return;
    }

    const request = eventRequests.find(req => 
      req.eventId === eventId && requestBelongsToUser(req, userId) && req.status === 'pending'
    );

    if (!request) {
      logger.warn('Request not found for cancellation');
      return;
    }

    try {
      // Используем правильный endpoint для отмены запроса
      // На сервере endpoint: DELETE /events/requests/:membershipId (без eventId)
      // request.id должен быть membershipId
      await apiRequest(
        `/events/requests/${request.id}`,
        { method: 'DELETE' },
        actualToken,
      );
      setEventRequests(prev => prev.filter(req => req.id !== request.id));
      await syncEventsFromServer();
      logger.info('✅ Запрос отменен:', { eventId, userId, requestId: request.id });
    } catch (error) {
      logger.error('Failed to cancel request', error);
      // Удаляем локально даже при ошибке
      setEventRequests(prev => prev.filter(req => req.id !== request.id));
    }
  }, [eventRequests, requestBelongsToUser, syncEventsFromServer]);

  // Отмена участия
  const cancelEventParticipation = useCallback(async (eventId: string, userId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId || userId !== actualUserId) {
      logger.warn('Cannot cancel participation: invalid user or no access');
      return;
    }

    // Проверяем, прошедшее ли это событие (для Memories)
    const event = events.find(e => e.id === eventId);
    const isPastEvent = event ? isEventPast(event) : false;

    try {
      // Новый упрощенный эндпоинт: сервер сам находит membership по eventId+userId
      await apiRequest(`/events/${eventId}/participation`, { method: 'DELETE' }, actualToken);
      
      // КРИТИЧЕСКИ ВАЖНО: Сразу обновляем локальное состояние события,
      // удаляя пользователя из списка участников, чтобы событие не появилось обратно в ленте
      // НО: НЕ удаляем событие полностью - оно должно остаться у организатора
      setEvents(prev => prev.map(e => {
        if (e.id !== eventId) return e;
        
        // Удаляем пользователя из participantsList
        const updatedParticipantsList = e.participantsList?.filter(id => id !== userId) || [];
        
        // Удаляем пользователя из participantsData
        const updatedParticipantsData = e.participantsData?.filter(p => {
          const pUserId = (p as any).userId || (p as any).id;
          return pUserId !== userId;
        }) || [];
        
        // Уменьшаем количество участников
        const updatedParticipants = Math.max(0, e.participants - 1);
        
        // КРИТИЧЕСКИ ВАЖНО: Событие остается в списке, даже если участник отменил участие
        // Организатор должен видеть событие, пока не заполнится список участников другими участниками
        return {
          ...e,
          participantsList: updatedParticipantsList,
          participantsData: updatedParticipantsData,
          participants: updatedParticipants,
        };
      }));
      
      // КРИТИЧЕСКИ ВАЖНО: Создаем запрос со статусом 'rejected', чтобы событие не появлялось обратно в ленте
      // НО: Для прошедших событий это не нужно, так как они не показываются в лентах
      // Для прошедших событий rejected статус не применяется, чтобы событие оставалось видимым для других участников
      if (!isPastEvent) {
        // Только для будущих событий создаем rejected запрос, чтобы скрыть событие из лент
        setEventRequests(prev => {
          // Удаляем accepted запросы
          const withoutAccepted = prev.filter(req => !(req.eventId === eventId && req.status === 'accepted' && requestBelongsToUser(req, userId)));
          
          // Проверяем, есть ли уже rejected запрос для этого события
          const hasRejected = withoutAccepted.some(req => 
            req.eventId === eventId && 
            requestBelongsToUser(req, userId) && 
            req.status === 'rejected'
          );
          
          // Если rejected запроса нет - создаем его, чтобы событие не появлялось в ленте
          if (!hasRejected) {
            const rejectedRequest: EventRequest = {
              id: `rejected-${eventId}-${userId}`,
              eventId,
              type: 'join',
              fromUserId: userId,
              toUserId: event?.organizerId || '',
              userId: userId,
              status: 'rejected',
              createdAt: new Date(),
            };
            return [...withoutAccepted, rejectedRequest];
          }
          
          return withoutAccepted;
        });
      } else {
        // Для прошедших событий просто удаляем accepted запросы, но НЕ создаем rejected
        // Это позволяет событию оставаться видимым для других участников
        setEventRequests(prev => prev.filter(req => 
          !(req.eventId === eventId && req.status === 'accepted' && requestBelongsToUser(req, userId))
        ));
      }
      
      // Для прошедших событий также обновляем eventProfiles
      // КРИТИЧЕСКИ ВАЖНО: Событие НЕ удаляется у других участников
      // Только текущий пользователь удаляется из списка участников
      if (isPastEvent) {
        setEventProfiles(prev => prev.map(profile => {
          if (profile.eventId === eventId) {
            // Удаляем только текущего пользователя из списка участников
            // Событие остается для других участников
            const updatedParticipants = profile.participants.filter((pid: string) => pid !== userId);
            logger.debug(`Обновлен список участников для прошедшего события ${eventId}: удален ${userId}, осталось ${updatedParticipants.length} участников`);
            return {
              ...profile,
              participants: updatedParticipants,
            };
          }
          return profile;
        }));
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Удаляем чат события полностью, если пользователь больше не является членом события
      // Проверяем, является ли пользователь еще членом события после удаления
      const updatedEvent = events.find(e => e.id === eventId);
      const isStillMember = updatedEvent && (
        updatedEvent.organizerId === userId ||
        updatedEvent.participantsList?.includes(userId) ||
        updatedEvent.participantsData?.some((p: any) => {
          const pUserId = p.userId || p.id;
          return pUserId === userId;
        })
      );
      
      if (!isStillMember) {
        // Пользователь больше не является членом события - удаляем чат полностью
        setChats(prev => prev.filter(chat => !(chat.eventId === eventId && chat.type === 'event')));
        logger.info('✅ Чат события удален, так как пользователь больше не является членом события:', { eventId, userId });
      } else {
        // Пользователь все еще член события - только удаляем из списка участников чата
        setChats(prev => prev.map(chat => {
          if (chat.eventId === eventId && chat.participants?.includes(userId)) {
            return {
              ...chat,
              participants: chat.participants.filter((pid: string) => pid !== userId)
            };
          }
          return chat;
        }));
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий НЕ синхронизируем с сервером сразу
      // Это может привести к тому, что событие вернется в локальное состояние
      // Вместо этого полагаемся на WebSocket уведомления для обновления профиля
      if (!isPastEvent) {
        // Для будущих событий синхронизируем с сервером
        await syncEventsFromServer();
      } else {
        // Для прошедших событий только обновляем профиль через WebSocket
        // Событие остается в локальном состоянии для других участников
        logger.info('✅ Участие отменено в прошедшем событии, событие остается для других участников');
      }
      logger.info('✅ Участие отменено, пользователь удален из локального состояния, событие помечено как rejected:', { eventId, userId, isPastEvent });
    } catch (error) {
      logger.error('Failed to cancel participation', error);
    }
  }, [events, eventRequests, requestBelongsToUser, syncEventsFromServer, isEventPast, setEvents, setEventProfiles, setChats]);

  // Отправка приглашения на событие (от организатора к пользователю)
  const sendEventInvite = useCallback(async (eventId: string, fromUserId: string, toUserId: string, eventParam?: Event) => {
    // Проверка: приглашать может ТОЛЬКО организатор события
    const event = eventParam || events.find(e => e.id === eventId);
    if (!event) {
      logger.warn('Событие не найдено:', eventId);
      return;
    }
    
    if (event.organizerId !== fromUserId) {
      logger.warn('Приглашать может только организатор события:', { eventId, fromUserId, organizerId: event.organizerId });
      return;
    }
    
    // Проверка: нельзя приглашать пользователя, который уже является членом события
    if (isUserEventMember(event, toUserId)) {
      logger.warn('Пользователь уже является членом события:', { eventId, toUserId });
      return;
    }
    
    // Отправляем приглашение на бэкенд
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (actualToken && fromUserId === actualUserId) {
      try {
        await apiRequest(
          `/events/${eventId}/invite`,
          {
            method: 'POST',
            body: JSON.stringify({ userId: toUserId }),
          },
          actualToken,
        );
        
        // После успешной отправки синхронизируем события, чтобы получить обновленные memberships
        await syncEventsFromServer();
        await refreshPendingJoinRequests();
        
        logger.info('✅ Приглашение отправлено на бэкенд:', { eventId, fromUserId, toUserId });
      } catch (error) {
        logger.error('❌ Ошибка при отправке приглашения на бэкенд:', error);
      }
    } else {
      // Fallback для локального состояния (если нет токена или это не текущий пользователь)
      setEventRequests(prev => {
        const existingRequest = prev.find(req => 
          req.eventId === eventId && 
          req.type === 'invite' && 
          req.fromUserId === fromUserId && 
          req.toUserId === toUserId
        );
        
        if (existingRequest) {
          return prev;
        }
        
        const newInvite: EventRequest = {
          id: `invite-${eventId}-${fromUserId}-${toUserId}-${Date.now()}`,
          type: 'invite',
          eventId,
          fromUserId,
          toUserId,
          status: 'pending',
          createdAt: new Date()
        };
        
        return [...prev, newInvite];
      });
    }
  }, [events, isUserEventMember, syncEventsFromServer, refreshPendingJoinRequests]);

  return {
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
  };
};

