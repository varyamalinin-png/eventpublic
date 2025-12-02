import { useCallback, useRef, useEffect } from 'react';
import { apiRequest, ApiError, API_BASE_URL } from '../../services/api';
import type { Event, CreateEventInput, EventProfile, EventRequest, Chat } from '../../types';
import type { ServerUser, ServerEvent } from '../../types/api';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EventActions');

export interface UseEventActionsParams {
  accessToken: string | null;
  currentUserId: string | null;
  refreshToken: string | null;
  handleUnauthorizedError: (error: unknown) => Promise<boolean>;
  refreshSession: (refreshToken: string) => Promise<void>;
  applyServerUserDataToState: (serverUser: ServerUser) => void;
  // Состояния для обновления
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  setEventProfiles: React.Dispatch<React.SetStateAction<EventProfile[]>>;
  setEventRequests: React.Dispatch<React.SetStateAction<EventRequest[]>>;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  // Вспомогательные функции
  mapServerEventToClient: (serverEvent: ServerEvent, language: string) => Event;
  isEventPast: (event: Event) => boolean;
  fetchEventProfile: ((eventId: string) => Promise<EventProfile | null>) | null;
  refreshPendingJoinRequests: (eventsSnapshot?: Event[]) => Promise<void>;
  syncEventsFromServer: () => Promise<void>;
  getEventParticipants: (eventId: string) => string[];
  events: Event[];
  eventProfiles: EventProfile[];
  language: string;
}

export interface UseEventActionsReturn {
  createEvent: (input: CreateEventInput) => Promise<Event | null>;
  updateEvent: (id: string, updates: Partial<Event>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  cancelEvent: (eventId: string) => Promise<void>;
  cancelOrganizerParticipation: (eventId: string) => Promise<void>;
  removeParticipantFromEvent: (eventId: string, userId: string) => Promise<void>;
}

export function useEventActions({
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
}: UseEventActionsParams): UseEventActionsReturn {
  const currentAccessTokenRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Обновляем refs при изменении токена или userId через useEffect
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
    currentUserIdRef.current = currentUserId;
  }, [accessToken, currentUserId]);

  // Вспомогательная функция для проверки URL
  const isHttpUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const createEvent = useCallback(
    async (input: CreateEventInput): Promise<Event | null> => {
      const actualToken = currentAccessTokenRef.current;
      const actualUserId = currentUserIdRef.current;
      
      if (!actualToken || !actualUserId) {
        throw new Error('Чтобы создавать события, необходимо авторизоваться');
      }

      try {
        const start = new Date(`${input.date}T${input.time}:00`);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

        // Upload media file if it's a local URI
        let finalMediaUrl = input.mediaUrl;
        let finalOriginalMediaUrl = input.originalMediaUrl;
        
        logger.debug('📸 Проверка медиа для события:');
        logger.debug('input.mediaUrl:', input.mediaUrl);
        logger.debug('input.originalMediaUrl:', input.originalMediaUrl);
        logger.debug('input.mediaType:', input.mediaType);
        logger.debug('isHttpUrl(mediaUrl):', isHttpUrl(input.mediaUrl));
        logger.debug('isHttpUrl(originalMediaUrl):', isHttpUrl(input.originalMediaUrl));
        
        // Загружаем обрезанное фото (mediaUrl)
        if (input.mediaUrl && !isHttpUrl(input.mediaUrl)) {
          logger.info('📤 Начинаем загрузку локального медиа (mediaUrl)...');
          try {
            const formData = new FormData();
            const fileName = input.mediaUrl.split('/').pop() || 'image.jpg';
            const fileType = input.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
            
            formData.append('file', {
              uri: input.mediaUrl,
              name: fileName,
              type: fileType,
            } as any);

            logger.debug('📤 Загрузка медиа события:', { fileName, fileType, uri: input.mediaUrl });
            const uploadResponse = await fetch(`${API_BASE_URL}/events/media`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${actualToken}`,
              },
              body: formData,
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              finalMediaUrl = uploadData.url || uploadData.mediaUrl || uploadData.publicUrl;
              logger.info('✅ Медиа загружено успешно:', finalMediaUrl);
            } else {
              if (uploadResponse.status === 401 && refreshToken && refreshToken.trim() !== '') {
                try {
                  logger.debug('🔄 Токен протух при загрузке медиа, обновляю и повторяю...');
                  const refreshData = await apiRequest(
                    '/auth/refresh',
                    {
                      method: 'POST',
                      body: JSON.stringify({ refreshToken }),
                    },
                    null,
                  );
                  const retryResp = await fetch(`${API_BASE_URL}/events/media`, {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${refreshData.accessToken}`,
                    },
                    body: formData,
                  });
                  if (retryResp.ok) {
                    const retryData = await retryResp.json();
                    finalMediaUrl = retryData.url || retryData.mediaUrl || retryData.publicUrl;
                    logger.info('✅ Медиа загружено успешно после refresh:', finalMediaUrl);
                  } else {
                    const retryText = await retryResp.text();
                    logger.error('❌ Ошибка повторной загрузки медиа:', retryResp.status, retryText);
                    finalMediaUrl = undefined;
                  }
                } catch (refreshOrRetryError: any) {
                  logger.error('❌ Ошибка обновления токена/повторной загрузки медиа:', refreshOrRetryError?.message || refreshOrRetryError);
                  finalMediaUrl = undefined;
                }
              } else {
                const errorText = await uploadResponse.text();
                logger.error('❌ Ошибка загрузки медиа:', uploadResponse.status, errorText);
                finalMediaUrl = undefined;
              }
            }
          } catch (uploadError: any) {
            logger.error('❌ Исключение при загрузке медиа:', uploadError?.message || uploadError);
            finalMediaUrl = undefined;
          }
        }

        // Загружаем оригинальное фото (originalMediaUrl)
        if (input.originalMediaUrl && !isHttpUrl(input.originalMediaUrl)) {
          logger.info('📤 Начинаем загрузку локального медиа (originalMediaUrl)...');
          try {
            const formData = new FormData();
            const fileName = input.originalMediaUrl.split('/').pop() || 'image.jpg';
            const fileType = input.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
            
            formData.append('file', {
              uri: input.originalMediaUrl,
              name: fileName,
              type: fileType,
            } as any);

            logger.debug('📤 Загрузка оригинального медиа события:', { fileName, fileType, uri: input.originalMediaUrl });
            const uploadResponse = await fetch(`${API_BASE_URL}/events/media`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${actualToken}`,
              },
              body: formData,
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              finalOriginalMediaUrl = uploadData.url || uploadData.mediaUrl || uploadData.publicUrl;
              logger.info('✅ Оригинальное медиа загружено успешно:', finalOriginalMediaUrl);
            } else {
              if (uploadResponse.status === 401 && refreshToken && refreshToken.trim() !== '') {
                try {
                  logger.debug('🔄 Токен протух при загрузке оригинального медиа, обновляю и повторяю...');
                  const refreshData = await apiRequest(
                    '/auth/refresh',
                    {
                      method: 'POST',
                      body: JSON.stringify({ refreshToken }),
                    },
                    null,
                  );
                  const retryResp = await fetch(`${API_BASE_URL}/events/media`, {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${refreshData.accessToken}`,
                    },
                    body: formData,
                  });
                  if (retryResp.ok) {
                    const retryData = await retryResp.json();
                    finalOriginalMediaUrl = retryData.url || retryData.mediaUrl || retryData.publicUrl;
                    logger.info('✅ Оригинальное медиа загружено успешно после refresh:', finalOriginalMediaUrl);
                  } else {
                    const retryText = await retryResp.text();
                    logger.error('❌ Ошибка повторной загрузки оригинального медиа:', retryResp.status, retryText);
                    finalOriginalMediaUrl = undefined;
                  }
                } catch (refreshOrRetryError: any) {
                  logger.error('❌ Ошибка обновления токена/повторной загрузки оригинального медиа:', refreshOrRetryError?.message || refreshOrRetryError);
                  finalOriginalMediaUrl = undefined;
                }
              } else {
                const errorText = await uploadResponse.text();
                logger.error('❌ Ошибка загрузки оригинального медиа:', uploadResponse.status, errorText);
                finalOriginalMediaUrl = undefined;
              }
            }
          } catch (uploadError: any) {
            logger.error('❌ Исключение при загрузке оригинального медиа:', uploadError?.message || uploadError);
            finalOriginalMediaUrl = undefined;
          }
        }

        const sanitizedMediaUrl = isHttpUrl(finalMediaUrl) ? finalMediaUrl : undefined;
        const sanitizedOriginalMediaUrl = isHttpUrl(finalOriginalMediaUrl) ? finalOriginalMediaUrl : undefined;
        
        logger.debug('✅ Итоговые URL медиа:');
        logger.debug('sanitizedMediaUrl:', sanitizedMediaUrl);
        logger.debug('sanitizedOriginalMediaUrl:', sanitizedOriginalMediaUrl);

        // Создаем payload только с полями, которые есть в CreateEventDto
        const payload: Record<string, any> = {
          title: input.title,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          maxParticipants: input.maxParticipants,
        };

        // Опциональные поля добавляем только если они есть
        if (input.description) {
          payload.description = input.description;
        }
        if (input.location) {
          payload.location = input.location;
        }
        if (input.price) {
          payload.price = input.price;
        }

        if (sanitizedMediaUrl) {
          payload.mediaUrl = sanitizedMediaUrl;
        }
        if (sanitizedOriginalMediaUrl) {
          payload.originalMediaUrl = sanitizedOriginalMediaUrl;
        }

        // Добавляем координаты в payload
        if (input.coordinates) {
          payload.coordinates = input.coordinates;
        }

        // Send invited user IDs to backend
        if (input.invitedUsers && input.invitedUsers.length > 0) {
          payload.invitedUserIds = input.invitedUsers.map(id => 
            id === 'own-profile-1' ? actualUserId : id
          ).filter(Boolean);
        }

        // Поля для регулярных событий
        if (input.isRecurring !== undefined) {
          payload.isRecurring = input.isRecurring;
        }
        if (input.recurringType) {
          payload.recurringType = input.recurringType;
        }
        if (input.recurringDays && input.recurringDays.length > 0) {
          payload.recurringDays = input.recurringDays;
        }
        if (input.recurringDayOfMonth) {
          payload.recurringDayOfMonth = input.recurringDayOfMonth;
        }
        if (input.recurringCustomDates && input.recurringCustomDates.length > 0) {
          payload.recurringCustomDates = input.recurringCustomDates;
        }

        // Метки (теги)
        if (input.tags && input.tags.length > 0) {
          payload.customTags = input.tags;
        }

        // Дополнительные поля
        if (input.ageRestriction) {
          payload.ageRestriction = input.ageRestriction;
        }
        if (input.genderRestriction && input.genderRestriction.length > 0) {
          payload.genderRestriction = input.genderRestriction;
        }
        if (input.mediaType) {
          payload.mediaType = input.mediaType;
        }
        if (input.mediaAspectRatio) {
          payload.mediaAspectRatio = input.mediaAspectRatio;
        }
        if (input.targeting) {
          payload.targeting = input.targeting;
        }

        logger.debug('Creating event with payload:', JSON.stringify(payload, null, 2));

        // Выполняем запрос с обработкой ошибки 401 (автоматическое обновление токена)
        let response;
        try {
          response = await apiRequest(
            '/events',
            {
              method: 'POST',
              body: JSON.stringify(payload),
            },
            actualToken,
          );
        } catch (error) {
          if (error instanceof ApiError && error.status === 401 && refreshToken && refreshToken.trim() !== '') {
            logger.debug('Token expired, refreshing and retrying...');
            try {
              const refreshData = await apiRequest(
                '/auth/refresh',
                {
                  method: 'POST',
                  body: JSON.stringify({ refreshToken }),
                },
                null,
              );
              
              await refreshSession(refreshToken);
              
              response = await apiRequest(
                '/events',
                {
                  method: 'POST',
                  body: JSON.stringify(payload),
                },
                refreshData.accessToken,
              );
            } catch (refreshError) {
              logger.error('Failed to refresh token, logging out', refreshError);
              await handleUnauthorizedError(error);
              throw error;
            }
          } else {
            throw error;
          }
        }

        if (!response) {
          return null;
        }

        if (response.organizer) {
          applyServerUserDataToState(response.organizer);
        }

        if (typeof mapServerEventToClient !== 'function') {
          logger.error('mapServerEventToClient is not available', { type: typeof mapServerEventToClient, value: mapServerEventToClient });
          // Fallback: создаем базовое событие из response
          const start = response.startTime ? new Date(response.startTime) : new Date();
          const date = start.toISOString().split('T')[0];
          const time = start.toISOString().slice(11, 16);
          const mapped: Event = {
            id: response.id,
            title: response.title || '',
            description: response.description || '',
            date,
            time,
            displayDate: date,
            displayTime: time,
            location: response.location || '',
            price: response.price || '0₽',
            participants: response.memberships?.filter((m: any) => m.status === 'ACCEPTED').length || 0,
            maxParticipants: response.maxParticipants || 0,
            organizerId: response.organizerId || response.organizer?.id || '',
            organizerAvatar: response.organizer?.avatarUrl || '',
            // Используем загруженные URL или URL из ответа сервера
            mediaUrl: sanitizedMediaUrl || response.mediaUrl || response.originalMediaUrl,
            originalMediaUrl: sanitizedOriginalMediaUrl || response.originalMediaUrl || response.mediaUrl,
            mediaType: sanitizedMediaUrl ? input.mediaType : (response.mediaType || 'image'),
            mediaAspectRatio: sanitizedMediaUrl ? input.mediaAspectRatio : (response.mediaAspectRatio || 1),
            coordinates: input.coordinates || response.coordinates,
            tags: response.customTags || [],
            isRecurring: response.isRecurring || false,
            invitedUsers: input.invitedUsers,
          };
          setEvents(prev => [mapped, ...prev.filter(event => event.id !== mapped.id)]);
          return mapped;
        }

        const mapped = mapServerEventToClient(response, language);
        // Обновляем mediaUrl и originalMediaUrl из загруженных файлов, если они были загружены
        if (sanitizedMediaUrl) {
          mapped.mediaUrl = sanitizedMediaUrl;
          mapped.mediaType = input.mediaType;
          mapped.mediaAspectRatio = input.mediaAspectRatio;
        }
        if (sanitizedOriginalMediaUrl) {
          mapped.originalMediaUrl = sanitizedOriginalMediaUrl;
        }
        // Если mediaUrl не был загружен, но originalMediaUrl был - используем его как mediaUrl
        if (!mapped.mediaUrl && mapped.originalMediaUrl) {
          mapped.mediaUrl = mapped.originalMediaUrl;
        }
        mapped.coordinates = input.coordinates;
        mapped.invitedUsers = input.invitedUsers;

        setEvents(prev => [mapped, ...prev.filter(event => event.id !== mapped.id)]);

        setEventProfiles(prev => {
          const existing = prev.find(p => p.eventId === mapped.id);
          if (existing) {
            return prev;
          }
          const newProfile: any = {
            id: `profile-${mapped.id}`,
            eventId: mapped.id,
            name: mapped.title,
            description: mapped.description,
            date: mapped.date,
            time: mapped.time,
            location: mapped.location,
            participants: [mapped.organizerId],
            organizerId: mapped.organizerId,
            isCompleted: false,
            posts: [],
            createdAt: new Date(),
            avatar: mapped.mediaUrl,
          };
          return [newProfile, ...prev];
        });

        // КРИТИЧЕСКИ ВАЖНО: После создания события нужно сразу обновить приглашения
        try {
          await refreshPendingJoinRequests([mapped]);
        } catch (error) {
          logger.warn('Failed to refresh invitations after event creation', error);
        }

        return mapped;
      } catch (error) {
        logger.error('Failed to create event', error);
        throw error;
      }
    },
    [
      accessToken,
      currentUserId,
      refreshToken,
      refreshSession,
      handleUnauthorizedError,
      applyServerUserDataToState,
      mapServerEventToClient,
      language,
      setEvents,
      setEventProfiles,
      refreshPendingJoinRequests,
    ],
  );

  const updateEvent = useCallback(async (id: string, updates: Partial<Event>) => {
    // Для временных событий (preview) обновляем только локально, без API-запроса
    if (id.includes('-temp') || id.startsWith('preview-')) {
      setEvents(prev => {
        const existingEvent = prev.find(e => e.id === id);
        if (existingEvent) {
          return prev.map(event => 
            event.id === id ? { ...event, ...updates } : event
          );
        } else {
          return [...prev, { ...updates, id } as Event];
        }
      });
      return;
    }

    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;

    if (!actualToken || !actualUserId) {
      // Fallback: обновляем локально, если нет доступа
      setEvents(prev => prev.map(event => 
        event.id === id ? { ...event, ...updates } : event
      ));
      return;
    }

    try {
      // Преобразуем обновления в формат для бэкенда
      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.location) updateData.location = updates.location;
      if (updates.price) updateData.price = updates.price;
      if (updates.maxParticipants) updateData.maxParticipants = updates.maxParticipants;
      if (updates.mediaUrl) updateData.mediaUrl = updates.mediaUrl;
      if (updates.date && updates.time) {
        const start = new Date(`${updates.date}T${updates.time}:00`);
        updateData.startTime = start.toISOString();
        updateData.endTime = new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString();
      }

      const response = await apiRequest(
        `/events/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        },
        actualToken,
      );

      if (response) {
        if (response.organizer) {
          applyServerUserDataToState(response.organizer);
        }
        if (!mapServerEventToClient) {
          logger.error('mapServerEventToClient is not available');
          // Fallback: обновляем событие напрямую из response
          setEvents(prev => prev.map(event => {
            if (event.id !== id) return event;
            const start = response.startTime ? new Date(response.startTime) : new Date(event.date);
            const date = start.toISOString().split('T')[0];
            const time = start.toISOString().slice(11, 16);
            return {
              ...event,
              title: response.title || event.title,
              description: response.description !== undefined ? response.description : event.description,
              date,
              time,
              displayDate: date,
              displayTime: time,
              location: response.location || event.location,
              price: response.price || event.price,
              maxParticipants: response.maxParticipants || event.maxParticipants,
              mediaUrl: response.mediaUrl || event.mediaUrl,
            };
          }));
          return;
        }
        const mapped = mapServerEventToClient(response, language);
        setEvents(prev => prev.map(event => event.id === id ? mapped : event));
      }
    } catch (error) {
      // Не обновляем локально при ошибке 403 (Forbidden) - пользователь не имеет прав
      if (error instanceof ApiError && error.status === 403) {
        logger.error('Failed to update event: Only organizer can update event', error);
        throw error;
      }
      logger.error('Failed to update event', error);
      // Fallback: обновляем локально только при других ошибках (не 403)
      setEvents(prev => prev.map(event => 
        event.id === id ? { ...event, ...updates } : event
      ));
    }
  }, [accessToken, currentUserId, applyServerUserDataToState, mapServerEventToClient, language, setEvents]);

  // Используем useRef для избежания циклической зависимости в cancelEvent -> deleteEvent
  const deleteEventRef = useRef<((id: string) => Promise<void>) | null>(null);
  
  // ЕДИНЫЙ МЕХАНИЗМ УДАЛЕНИЯ для будущих и прошедших событий
  const deleteEvent = useCallback(async (id: string) => {
    // Находим событие ДО удаления, чтобы проверить, прошедшее ли оно
    const eventToDelete = events.find(e => e.id === id);
    let isPastEvent = false;
    if (isEventPast && eventToDelete) {
      isPastEvent = isEventPast(eventToDelete);
    } else if (eventToDelete) {
      // Fallback: проверяем вручную
      const eventDate = new Date(`${eventToDelete.date}T${eventToDelete.time}:00`);
      isPastEvent = new Date().getTime() > eventDate.getTime();
    }
    
    logger.info(`🗑️ Удаляем событие ${id} (${isPastEvent ? 'прошедшее' : 'будущее'})`);
    
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    // ЕДИНАЯ ЛОГИКА: Всегда вызываем сервер для удаления участия
    let serverSuccess = false;
    let eventDeleted = false;
    
    if (actualToken && actualUserId) {
      try {
        const response = await apiRequest(`/events/${id}/participation`, { method: 'DELETE' }, actualToken);
        logger.info(`✅ Участие удалено на сервере для события ${id}`, response);
        serverSuccess = true;
        
        // Проверяем, было ли событие полностью удалено (последний участник)
        if (response?.eventDeleted) {
          logger.info(`✅ Событие полностью удалено с сервера (был последний участник)`);
          eventDeleted = true;
        }
      } catch (error) {
        // Для прошедших событий ошибка "Membership not found" может быть нормальной
        if (error instanceof ApiError && error.status === 400 && error.message?.includes('Membership not found')) {
          logger.warn(`⚠️ Membership not found на сервере для события ${id}, проверяем профиль...`);
          if (fetchEventProfile && isPastEvent) {
            try {
              const updatedProfile = await fetchEventProfile(id);
              if (updatedProfile) {
                const isStillParticipant = updatedProfile.participants.includes(actualUserId);
                if (!isStillParticipant) {
                  logger.info(`Пользователь удален из профиля на сервере`);
                  serverSuccess = true;
                } else {
                  logger.warn(`Пользователь все еще в профиле на сервере`);
                  serverSuccess = false;
                }
              } else {
                logger.warn(`Профиль не найден - возможно событие удалено`);
                serverSuccess = true;
                const eventExists = events.find(e => e.id === id);
                if (!eventExists) {
                  eventDeleted = true;
                }
              }
            } catch (profileError) {
              logger.warn(`Не удалось загрузить профиль с сервера:`, profileError);
            }
          }
        } else {
          logger.warn(`Ошибка при удалении на сервере для события ${id}:`, error);
        }
      }
    }
    
    // КРИТИЧЕСКИ ВАЖНО: Если событие полностью удалено - удаляем из всех локальных состояний
    if (eventDeleted) {
      logger.info(`Событие полностью удалено - убираем из локального состояния`);
      setEvents(prev => prev.filter(e => e.id !== id));
      setEventProfiles(prev => prev.filter(p => p.eventId !== id));
      setEventRequests(prev => prev.filter(req => req.eventId !== id));
      return;
    }

    // Если удаление на сервере успешно, но событие не удалено полностью - обновляем локальное состояние
    if (serverSuccess) {
      logger.info(`Удаление на сервере успешно - удаляем событие из локального состояния`);
      setEvents(prev => prev.filter(e => e.id !== id));
      setEventRequests(prev => prev.filter(req => req.eventId !== id));
      
      if (isPastEvent) {
        if (fetchEventProfile) {
          try {
            const updatedProfile = await fetchEventProfile(id);
            if (updatedProfile) {
              logger.info(`Профиль обновлен с сервера, участников: ${updatedProfile.participants.length}`);
              setEventProfiles(prev => prev.map(p => 
                p.eventId === id ? {
                  ...p,
                  participants: updatedProfile.participants
                } : p
              ));
            } else {
              logger.warn(`Профиль не найден - пользователь не участник, удаляем профиль`);
              setEventProfiles(prev => prev.filter(p => p.eventId !== id));
            }
          } catch (error) {
            logger.warn(`Не удалось обновить профиль с сервера:`, error);
            setEventProfiles(prev => prev.filter(p => p.eventId !== id));
          }
        } else {
          setEventProfiles(prev => prev.filter(p => p.eventId !== id));
        }
      } else {
        setEventProfiles(prev => prev.filter(p => p.eventId !== id));
      }
      
      // Удаляем из чатов
      setChats(prev => prev.filter(c => c.eventId !== id));
      return;
    }

    // Если удаление на сервере не удалось - делаем локальное удаление (fallback)
    logger.warn(`Удаление на сервере не удалось, делаем локальное удаление`);
    setEvents(prev => prev.filter(e => e.id !== id));
    setEventRequests(prev => prev.filter(req => req.eventId !== id));
    setChats(prev => prev.filter(c => c.eventId !== id));
    
    if (isPastEvent && actualUserId) {
      setEventProfiles(prev => prev.map(p => 
        p.eventId === id 
          ? { ...p, participants: p.participants.filter(pid => pid !== actualUserId) }
          : p
      ));
    } else {
      setEventProfiles(prev => prev.filter(p => p.eventId !== id));
    }
  }, [accessToken, currentUserId, events, eventProfiles, isEventPast, fetchEventProfile, setEvents, setEventProfiles, setEventRequests, setChats]);

  // Обновляем ref при изменении deleteEvent для использования в cancelEvent
  deleteEventRef.current = deleteEvent;

  const cancelEvent = useCallback(async (eventId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot cancel event: no access');
      return;
    }

    const event = events.find(e => e.id === eventId);
    if (!event) {
      logger.warn('Event not found for cancellation');
      return;
    }

    // Проверяем количество участников
    let participantsCount = 1; // Минимум организатор
    if (getEventParticipants) {
      participantsCount = getEventParticipants(eventId).length;
    } else {
      logger.warn('getEventParticipants is not available, using fallback');
      // Fallback: используем событие напрямую
      const profile = eventProfiles.find(p => p.eventId === eventId);
      if (profile) {
        participantsCount = profile.participants.length + 1; // +1 для организатора
      }
    }
    
    if (participantsCount <= 2) {
      // ≤2 участников - полная отмена события
      try {
        await apiRequest(
          `/events/${eventId}`,
          { method: 'DELETE' },
          actualToken,
        );
        if (deleteEventRef.current) {
          await deleteEventRef.current(eventId);
        }
        if (syncEventsFromServer) {
          await syncEventsFromServer();
        }
        logger.info('✅ Событие отменено:', eventId);
      } catch (error) {
        logger.error('❌ Ошибка при отмене события:', error);
        throw error;
      }
    } else {
      // >2 участников - отмена участия организатора
      try {
        await apiRequest(
          `/events/${eventId}/organizer-participation`,
          { method: 'DELETE' },
          actualToken,
        );
        if (syncEventsFromServer) {
          await syncEventsFromServer();
        }
        await refreshPendingJoinRequests();
        logger.info('✅ Участие организатора отменено:', eventId);
      } catch (error) {
        logger.error('❌ Ошибка при отмене участия организатора:', error);
        throw error;
      }
    }
  }, [accessToken, currentUserId, events, getEventParticipants, syncEventsFromServer, refreshPendingJoinRequests]);

  const cancelOrganizerParticipation = useCallback(async (eventId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot cancel organizer participation: no access');
      return;
    }

    const event = events.find(e => e.id === eventId);
    if (!event) {
      logger.warn('Event not found');
      return;
    }

    // Проверяем количество участников
    if (!getEventParticipants) {
      logger.error('getEventParticipants is not available');
      // Fallback: используем событие напрямую
      const event = events.find(e => e.id === eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      // Предполагаем, что участников больше 2, иначе бы использовали cancelEvent
      try {
        await apiRequest(
          `/events/${eventId}/organizer-participation`,
          { method: 'DELETE' },
          actualToken,
        );
        if (syncEventsFromServer) {
          await syncEventsFromServer();
        }
        await refreshPendingJoinRequests();
        logger.info('✅ Участие организатора отменено:', eventId);
      } catch (error) {
        logger.error('❌ Ошибка при отмене участия организатора:', error);
        throw error;
      }
      return;
    }
    const participantsCount = getEventParticipants(eventId).length;
    if (participantsCount <= 2) {
      logger.warn('Use cancelEvent for events with ≤2 participants');
      return cancelEvent(eventId);
    }

    try {
      await apiRequest(
        `/events/${eventId}/organizer-participation`,
        { method: 'DELETE' },
        actualToken,
      );
      await syncEventsFromServer();
      await refreshPendingJoinRequests();
      logger.info('✅ Участие организатора отменено:', eventId);
    } catch (error) {
      logger.error('❌ Ошибка при отмене участия организатора:', error);
      throw error;
    }
  }, [accessToken, currentUserId, events, getEventParticipants, cancelEvent, syncEventsFromServer, refreshPendingJoinRequests]);

  const removeParticipantFromEvent = useCallback(async (eventId: string, userId: string) => {
    const actualToken = currentAccessTokenRef.current;
    
    if (!actualToken) {
      logger.warn('Нет доступа для удаления участника из события');
      return;
    }

    try {
      await apiRequest(`/events/${eventId}/participants/${userId}`, { method: 'DELETE' }, actualToken);
      // Обновляем запросы на участие
      setEventRequests(prev => prev.filter(req => !(req.eventId === eventId && req.fromUserId === userId && req.status === 'accepted')));
      // Обновляем профиль события, удаляя участника
      setEventProfiles(prev => prev.map(profile => 
        profile.eventId === eventId 
          ? { ...profile, participants: profile.participants.filter((pid: string) => pid !== userId) }
          : profile
      ));
    } catch (error) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      logger.error('Failed to remove participant from event', error);
    }
  }, [accessToken, handleUnauthorizedError, setEventRequests, setEventProfiles]);

  return {
    createEvent,
    updateEvent,
    deleteEvent,
    cancelEvent,
    cancelOrganizerParticipation,
    removeParticipantFromEvent,
  };
}

