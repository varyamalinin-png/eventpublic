import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest, ApiError, API_BASE_URL } from '../../services/api';
import { createLogger } from '../../utils/logger';
import type { Event, EventProfile, EventProfilePost } from '../../types';
import type { ServerEventProfile, ServerEventProfilePost } from '../../types/api';

const logger = createLogger('useEventProfiles');

export interface UseEventProfilesParams {
  accessToken: string | null;
  currentUserId: string | null;
  events: Event[];
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  isEventPast: (event: Event) => boolean;
  normalizeMediaUrl: (input?: string | null) => string | undefined;
  removeSavedMemoryPost?: (eventId: string, postId: string) => void;
}

export interface UseEventProfilesReturn {
  eventProfiles: EventProfile[];
  setEventProfiles: React.Dispatch<React.SetStateAction<EventProfile[]>>;
  getEventProfile: (eventId: string) => EventProfile | null;
  fetchEventProfile: (eventId: string) => Promise<EventProfile | null>;
  createEventProfile: (eventId: string) => Promise<void>;
  addEventProfilePost: (eventId: string, post: Omit<EventProfilePost, 'id' | 'eventId' | 'createdAt'>) => Promise<EventProfilePost | null>;
  updateEventProfile: (eventId: string, updates: Partial<EventProfile>) => Promise<void>;
  updateEventProfilePost: (eventId: string, postId: string, updates: Partial<EventProfilePost>) => Promise<void>;
  deleteEventProfilePost: (eventId: string, postId: string) => Promise<void>;
  canEditEventProfile: (eventId: string, userId: string) => boolean;
  addPostComment: (eventId: string, postId: string, comment: Omit<import('../../types').PostComment, 'id' | 'postId' | 'createdAt'>) => Promise<void>;
}

export const useEventProfiles = ({
  accessToken,
  currentUserId,
  events,
  setEvents,
  isEventPast,
  normalizeMediaUrl,
  removeSavedMemoryPost,
}: UseEventProfilesParams): UseEventProfilesReturn => {
  const [eventProfiles, setEventProfiles] = useState<EventProfile[]>([]);
  const creatingProfiles = useRef<Set<string>>(new Set());
  const currentAccessTokenRef = useRef<string | null>(accessToken);
  const currentUserIdRef = useRef<string | null>(currentUserId);

  // Обновляем refs при изменении токена и userId через useEffect
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
    currentUserIdRef.current = currentUserId;
  }, [accessToken, currentUserId]);

  const getEventProfile = (eventId: string): EventProfile | null => {
    return eventProfiles.find(profile => profile.eventId === eventId) || null;
  };

  // Функция для загрузки существующего профиля с сервера
  const fetchEventProfile = useCallback(async (eventId: string): Promise<EventProfile | null> => {
    const actualToken = currentAccessTokenRef.current;
    if (!actualToken) return null;

    try {
      logger.info(`Загружаем профиль для события ${eventId}`);
      const response = await apiRequest(
        `/events/${eventId}/profile`,
        { method: 'GET' },
        actualToken,
      ) as ServerEventProfile | null;

      logger.debug(`Ответ сервера для события ${eventId}:`, response ? 'найден' : 'не найден (null)');
      
      const event = events.find(e => e.id === eventId);
      
      // КРИТИЧЕСКИ ВАЖНО: Если профиль не найден на сервере, НЕ создаем пустой профиль автоматически
      // Это может привести к тому, что удаленный пользователь снова появится в participants
      // Вместо этого возвращаем null - профиль должен быть создан на сервере или загружен правильно
      if (!response && event) {
        logger.warn(`Профиль не найден на сервере для события ${eventId}`);
        logger.warn(`НЕ создаем пустой профиль - это может привести к неправильному отображению удаленных пользователей`);
        // Возвращаем null - профиль должен быть создан на сервере или загружен правильно
        return null;
      }
      
      if (response) {
        const mappedProfile: EventProfile = {
          id: response.id || `profile-${eventId}`,
          eventId,
          name: response.name || event?.title || (typeof response.event?.name === 'string' ? response.event.name : '') || '',
          description: response.description || event?.description || response.event?.description || '',
          date: response.date || event?.date || response.event?.date || '',
          time: response.time || event?.time || response.event?.time || '',
          location: response.location || event?.location || response.event?.location || '',
          participants: (response.participants || []).map((p) => {
            if (typeof p === 'string') return p;
            return p.userId || (p as { user?: { id: string } }).user?.id;
          }).filter(Boolean) as string[],
          organizerId: event?.organizerId || response.organizerId || response.event?.organizerId || '',
          isCompleted: response.isCompleted || false,
          hiddenParameters: (response.hiddenParameters || {}) as Record<string, boolean>,
          posts: (response.posts || []).map((post: ServerEventProfilePost) => ({
            id: post.id,
            eventId,
            authorId: post.authorId || post.author?.id || '',
            content: post.content,
            photoUrl: normalizeMediaUrl(post.photoUrl),
            photoUrls: Array.isArray(post.photoUrls) ? post.photoUrls.map((url: any) => normalizeMediaUrl(url)) : undefined,
            captions: Array.isArray(post.captions) ? post.captions : undefined,
            caption: post.caption || (Array.isArray(post.captions) && post.captions.length > 0 ? post.captions[0] : undefined),
            comments: Array.isArray((post as any).comments) ? (post as any).comments.map((comment: any) => ({
              id: comment.id,
              postId: comment.postId || post.id,
              authorId: comment.authorId || comment.author?.id || '',
              content: comment.content || '',
              createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
            })) : undefined,
            createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
          })),
          createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
          avatar: normalizeMediaUrl(response.avatar) || normalizeMediaUrl(event?.mediaUrl) || normalizeMediaUrl(response.event?.mediaUrl),
        };
        
        logger.info(`✅ Профиль загружен для события ${eventId}, постов: ${mappedProfile.posts?.length || 0}, участников: ${mappedProfile.participants.length}`);

        setEventProfiles(prev => {
          const exists = prev.find(p => p.eventId === eventId);
          if (exists) {
            logger.debug(`Обновляем существующий профиль для события ${eventId}`);
            return prev.map(p => p.eventId === eventId ? mappedProfile : p);
          }
          logger.debug(`Добавляем новый профиль для события ${eventId}, всего профилей: ${prev.length + 1}`);
          return [...prev, mappedProfile];
        });

        return mappedProfile;
      }
      
      // Если сервер возвращает null - это означает, что профиль еще не создан
      // Профиль события доступен ВСЕМ для просмотра (если он существует)
      // Редактирование доступно только участникам (проверяется на сервере)
      logger.debug(`Профиль не найден на сервере для события ${eventId} - профиль еще не создан`);
      
      // НЕ удаляем профиль из локального состояния, так как он может быть создан позже
      // Просто возвращаем null
      
      // Если событие прошедшее (Memories), удаляем его из локального состояния
      // Переиспользуем переменную event, объявленную выше
      if (event && isEventPast(event)) {
        logger.warn(`Прошедшее событие ${eventId} не найдено - удаляем из локального состояния`);
        setEvents(prev => {
          const filtered = prev.filter(e => e.id !== eventId);
          if (filtered.length < prev.length) {
            logger.debug(`✅ Событие удалено из локального состояния для события ${eventId}`);
          }
          return filtered;
        });
      }
      
      return null;
    } catch (error) {
      // Обрабатываем различные типы ошибок
      if (error instanceof ApiError) {
        // 404 - профиль не найден (это нормально)
        if (error.status === 404) {
          logger.debug(`Профиль не найден (404) для события ${eventId}`);
          logger.debug(`НЕ создаем пустой профиль - это может привести к неправильному отображению удаленных пользователей`);
          // Возвращаем null - профиль должен быть создан на сервере или загружен правильно
          return null;
        }
        // 403/500 - пользователь не имеет доступа или временная проблема сервера
        // Это ожидаемое поведение, не логируем как ошибку
        if (error.status === 403 || error.status === 500) {
          return null;
        }
        // Для других ошибок логируем как предупреждение
        logger.warn('Failed to fetch event profile:', error.status, error.message);
      } else {
        logger.warn('Failed to fetch event profile:', error);
      }
    }
    return null;
  }, [events, isEventPast, normalizeMediaUrl, setEvents]);

  const createEventProfile = useCallback(async (eventId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot create event profile: no access');
      return;
    }

    const event = events.find(e => e.id === eventId);
    if (!event) {
      logger.warn('Event not found for profile creation');
      return;
    }

    // Проверяем, не существует ли уже профиль локально
    const existingProfile = eventProfiles.find(p => p.eventId === eventId);
    if (existingProfile) {
      return;
    }

    // Защита от повторных вызовов
    if (creatingProfiles.current.has(eventId)) {
      return;
    }

    creatingProfiles.current.add(eventId);

    try {
      const response = await apiRequest(
        `/events/${eventId}/profile`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: event.title,
            description: event.description,
            date: event.date,
            time: event.time,
            location: event.location,
            avatar: event.mediaUrl,
            isCompleted: false,
          }),
        },
        actualToken,
      ) as ServerEventProfile | null;

      if (response) {
        // Маппим ответ сервера в формат EventProfile
        const mappedProfile: EventProfile = {
          id: response.id || `profile-${eventId}`,
          eventId,
          name: response.name || event.title,
          description: response.description || event.description,
          date: response.date || event.date,
          time: response.time || event.time,
          location: response.location || event.location,
          participants: (response.participants || []).map((p) => {
            if (typeof p === 'string') return p;
            return (p as { userId?: string; user?: { id?: string } }).userId || (p as { user?: { id?: string } }).user?.id;
          }).filter(Boolean) as string[],
          organizerId: event.organizerId,
          isCompleted: response.isCompleted || false,
          hiddenParameters: (response.hiddenParameters || {}) as Record<string, boolean>,
          posts: (response.posts || []).map((post: ServerEventProfilePost) => ({
            id: post.id,
            eventId,
            authorId: post.authorId || post.author?.id || '',
            content: post.content,
            photoUrl: post.photoUrl,
            createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
          })),
          createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
          avatar: response.avatar || event.mediaUrl,
        };

        setEventProfiles(prev => {
          const exists = prev.find(p => p.eventId === eventId);
          if (exists) return prev;
          return [...prev, mappedProfile];
        });
      }
    } catch (error) {
      // Обрабатываем ошибки создания профиля
      if (error instanceof ApiError) {
        const errorMessage = error.message?.toLowerCase() || '';
        if (error.status === 400 && (errorMessage.includes('already exists') || errorMessage.includes('Profile already exists'))) {
          // Профиль уже существует на сервере, пытаемся загрузить его
          // Это ожидаемая ситуация, не логируем как ошибку
          await fetchEventProfile(eventId);
        } else if (error.status === 500) {
          // При ошибке сервера пытаемся загрузить существующий профиль
          const fetched = await fetchEventProfile(eventId);
          if (!fetched) {
            // Если не удалось загрузить, это может быть временная проблема сервера
            // Логируем только как предупреждение, не как критическую ошибку
            logger.warn('Server error during profile creation/fetch. Will retry later.');
          }
        } else {
          // Для других ошибок просто логируем как предупреждение
          logger.warn('Failed to create event profile', error.status, error.message);
        }
      } else {
        logger.warn('Failed to create event profile', error);
      }
    } finally {
      creatingProfiles.current.delete(eventId);
    }
  }, [events, eventProfiles, fetchEventProfile]);

  const addEventProfilePost = useCallback(async (eventId: string, post: Omit<EventProfilePost, 'id' | 'eventId' | 'createdAt'>) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot add post: no access');
      return;
    }

    try {
      // Убеждаемся, что профиль существует перед добавлением поста
      const existingProfile = eventProfiles.find(p => p.eventId === eventId);
      if (!existingProfile) {
        // Пытаемся создать профиль, если его нет
        await createEventProfile(eventId);
      }

      // Если photoUrl - локальный URI (file://), загружаем через FormData
      let response: ServerEventProfilePost | null = null;
      if (post.photoUrl && (post.photoUrl.startsWith('file://') || post.photoUrl.startsWith('content://'))) {
        // Загружаем фото через FormData
        const formData = new FormData();
        const filename = post.photoUrl.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('file', {
          uri: post.photoUrl,
          name: filename,
          type: type,
        } as any);
        
        if (post.content) {
          formData.append('content', post.content);
        }

        // ВАЖНО: Не устанавливаем Content-Type вручную для FormData
        // React Native автоматически установит правильный Content-Type с boundary
        const uploadResponse = await fetch(`${API_BASE_URL}/events/${eventId}/profile/posts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${actualToken}`,
            // НЕ устанавливаем Content-Type - React Native сделает это автоматически для FormData
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          let errorBody: unknown;
          try {
            errorBody = JSON.parse(errorText);
          } catch {
            errorBody = errorText;
          }
          const errorMessage = (errorBody && typeof errorBody === 'object' && 'message' in errorBody) 
            ? String(errorBody.message) 
            : 'Failed to upload post';
          throw new ApiError(errorMessage, uploadResponse.status, errorBody);
        }

        response = await uploadResponse.json() as ServerEventProfilePost;
      } else {
        // Если photoUrl - уже загруженный URL или нет фото, отправляем через JSON
        logger.debug('Отправляем запрос на создание поста с каруселью:', {
          content: post.content,
          photoUrl: post.photoUrl,
          photoUrls: post.photoUrls,
          photoUrlsCount: Array.isArray(post.photoUrls) ? post.photoUrls.length : 0,
          captions: post.captions,
          captionsCount: Array.isArray(post.captions) ? post.captions.length : 0,
        });
        
        response = await apiRequest(
          `/events/${eventId}/profile/posts`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: post.content,
              photoUrl: post.photoUrl,
              photoUrls: post.photoUrls,
              captions: post.captions,
            }),
          },
          actualToken,
        ) as ServerEventProfilePost | null;
        
        logger.debug('Ответ от сервера:', {
          hasResponse: !!response,
          responseType: typeof response,
          responseId: response?.id,
          responsePhotoUrls: response?.photoUrls,
          responsePhotoUrlsType: typeof response?.photoUrls,
          responsePhotoUrlsIsArray: Array.isArray(response?.photoUrls),
          fullResponse: JSON.stringify(response, null, 2),
        });
      }

      if (!response) {
        logger.error('❌ Сервер не вернул ответ при создании поста');
        return null;
      }

      if (response) {
        logger.debug('Создан новый пост:', {
          id: response.id,
          hasPhotoUrl: !!response.photoUrl,
          hasPhotoUrls: !!response.photoUrls,
          photoUrlsType: typeof response.photoUrls,
          photoUrlsValue: response.photoUrls,
          photoUrlsLength: Array.isArray(response.photoUrls) ? response.photoUrls.length : 0,
        });
        
        const newPost: EventProfilePost = {
          id: response.id,
          eventId,
          authorId: response.authorId || response.author?.id || currentUserId || '',
          content: response.content,
          photoUrl: normalizeMediaUrl(response.photoUrl),
          photoUrls: Array.isArray(response.photoUrls) ? response.photoUrls.map((url: any) => normalizeMediaUrl(url)) : undefined,
          captions: Array.isArray(response.captions) ? response.captions : undefined,
          caption: response.caption || (Array.isArray(response.captions) && response.captions.length > 0 ? response.captions[0] : undefined),
          comments: Array.isArray((response as any).comments) ? (response as any).comments.map((comment: any) => ({
            id: comment.id,
            postId: comment.postId || response.id,
            authorId: comment.authorId || comment.author?.id || '',
            content: comment.content || '',
            createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
          })) : undefined,
          createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
        };
        
        logger.debug('Создан EventProfilePost:', {
          id: newPost.id,
          hasPhotoUrl: !!newPost.photoUrl,
          hasPhotoUrls: !!newPost.photoUrls,
          photoUrlsLength: Array.isArray(newPost.photoUrls) ? newPost.photoUrls.length : 0,
        });

        setEventProfiles(prev => prev.map(profile => 
          profile.eventId === eventId 
            ? { ...profile, posts: [newPost, ...profile.posts] }
            : profile
        ));
        
        return newPost;
      }
      
      return null;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          // Профиль не найден, пытаемся создать
          try {
            await createEventProfile(eventId);
            // Повторяем попытку добавления поста
            let retryResponse: any;
            if (post.photoUrl && (post.photoUrl.startsWith('file://') || post.photoUrl.startsWith('content://'))) {
              // Загружаем фото через FormData
              const formData = new FormData();
              const filename = post.photoUrl.split('/').pop() || 'photo.jpg';
              const match = /\.(\w+)$/.exec(filename);
              const type = match ? `image/${match[1]}` : 'image/jpeg';
              
              formData.append('file', {
                uri: post.photoUrl,
                name: filename,
                type: type,
              } as any);
              
              if (post.content) {
                formData.append('content', post.content);
              }

              // ВАЖНО: Не устанавливаем Content-Type вручную для FormData
              const uploadResponse = await fetch(`${API_BASE_URL}/events/${eventId}/profile/posts`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${actualToken}`,
                  // НЕ устанавливаем Content-Type - React Native сделает это автоматически для FormData
                },
                body: formData,
              });

              if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                let errorBody: any;
                try {
                  errorBody = JSON.parse(errorText);
                } catch {
                  errorBody = errorText;
                }
                throw new ApiError(errorBody?.message || 'Failed to upload post', uploadResponse.status, errorBody);
              }

              retryResponse = await uploadResponse.json();
            } else {
              retryResponse = await apiRequest(
                `/events/${eventId}/profile/posts`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    content: post.content,
                    photoUrl: post.photoUrl,
                    photoUrls: post.photoUrls,
                    captions: post.captions,
                  }),
                },
                actualToken,
              );
            }
            
            const response = retryResponse;
            if (response) {
              const newPost: EventProfilePost = {
                id: response.id,
                eventId,
                authorId: response.authorId || response.author?.id || currentUserId || '',
                content: response.content,
                photoUrl: normalizeMediaUrl(response.photoUrl),
                photoUrls: Array.isArray(response.photoUrls) ? response.photoUrls.map((url: any) => normalizeMediaUrl(url)) : undefined,
                captions: Array.isArray(response.captions) ? response.captions : undefined,
                caption: response.caption || (Array.isArray(response.captions) && response.captions.length > 0 ? response.captions[0] : undefined),
                comments: Array.isArray((response as any).comments) ? (response as any).comments.map((comment: any) => ({
                  id: comment.id,
                  postId: comment.postId || response.id,
                  authorId: comment.authorId || comment.author?.id || '',
                  content: comment.content || '',
                  createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
                })) : undefined,
                createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
              };
              setEventProfiles(prev => prev.map(profile => 
                profile.eventId === eventId 
                  ? { ...profile, posts: [newPost, ...profile.posts] }
                  : profile
              ));
              return newPost;
            }
            return null;
          } catch (retryError) {
            logger.error('Failed to add event profile post after profile creation', retryError);
            return null;
          }
        } else {
          logger.error('Failed to add event profile post', error.status, error.message);
          return null;
        }
      } else {
        logger.error('Failed to add event profile post', error);
        return null;
      }
    }
  }, [eventProfiles, createEventProfile, normalizeMediaUrl, currentUserId]);

  const updateEventProfile = useCallback(async (eventId: string, updates: Partial<EventProfile>) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      // Fallback: обновляем локально
      setEventProfiles(prev => prev.map(profile => 
        profile.eventId === eventId 
          ? { ...profile, ...updates }
          : profile
      ));
      return;
    }

    try {
      // Убеждаемся, что профиль существует перед обновлением
      const existingProfile = eventProfiles.find(p => p.eventId === eventId);
      if (!existingProfile) {
        // Пытаемся создать профиль, если его нет
        await createEventProfile(eventId);
      }

      const response = await apiRequest(
        `/events/${eventId}/profile`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        },
        actualToken,
      ) as ServerEventProfile | null;

      if (response) {
        // Обновляем локально после успешного обновления на бэкенде
        const updatedProfile: EventProfile = {
          id: response.id || `profile-${eventId}`,
          eventId,
          name: response.name || updates.name || '',
          description: (response.description ?? updates.description) || '',
          date: response.date || updates.date || '',
          time: response.time || updates.time || '',
          location: (response.location ?? updates.location) || '',
          participants: (response.participants || []).map((p: any) => p.userId || p.user?.id).filter(Boolean),
          organizerId: updates.organizerId || '',
          isCompleted: response.isCompleted ?? updates.isCompleted ?? false,
          hiddenParameters: (response.hiddenParameters || updates.hiddenParameters || {}) as Record<string, boolean>,
          posts: (response.posts || []).map((post: any) => ({
            id: post.id,
            eventId,
            authorId: post.authorId || post.author?.id || '',
            content: post.content,
            photoUrl: normalizeMediaUrl(post.photoUrl),
            createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
          })),
          createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
          avatar: normalizeMediaUrl(response.avatar) ?? normalizeMediaUrl(updates.avatar),
        };

        setEventProfiles(prev => prev.map(profile => 
          profile.eventId === eventId ? updatedProfile : profile
        ));
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          // Профиль не найден, пытаемся создать
          try {
            await createEventProfile(eventId);
            // Повторяем попытку обновления
            const response = await apiRequest(
              `/events/${eventId}/profile`,
              {
                method: 'PATCH',
                body: JSON.stringify(updates),
              },
              actualToken,
            ) as ServerEventProfile | null;
            if (response) {
              const updatedProfile: EventProfile = {
                id: response.id || `profile-${eventId}`,
                eventId,
                name: response.name || updates.name || '',
                description: (response.description ?? updates.description) || '',
                date: response.date || updates.date || '',
                time: response.time || updates.time || '',
                location: (response.location ?? updates.location) || '',
                participants: (response.participants || []).map((p: any) => p.userId || p.user?.id).filter(Boolean),
                organizerId: updates.organizerId || '',
                isCompleted: response.isCompleted ?? updates.isCompleted ?? false,
                posts: (response.posts || []).map((post: any) => ({
                  id: post.id,
                  eventId,
                  authorId: post.authorId || post.author?.id || '',
                  content: post.content,
                  photoUrl: normalizeMediaUrl(post.photoUrl),
                  createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
                })),
                createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
                avatar: normalizeMediaUrl(response.avatar) ?? normalizeMediaUrl(updates.avatar),
              };
              setEventProfiles(prev => prev.map(profile => 
                profile.eventId === eventId ? updatedProfile : profile
              ));
            }
          } catch (retryError) {
            logger.error('Failed to update event profile after profile creation', retryError);
            // Fallback: обновляем локально при ошибке
            setEventProfiles(prev => prev.map(profile => 
              profile.eventId === eventId 
                ? { ...profile, ...updates }
                : profile
            ));
          }
        } else {
          logger.error('Failed to update event profile', error.status, error.message);
          // Fallback: обновляем локально при ошибке
          setEventProfiles(prev => prev.map(profile => 
            profile.eventId === eventId 
              ? { ...profile, ...updates }
              : profile
          ));
        }
      } else {
        logger.error('Failed to update event profile', error);
        // Fallback: обновляем локально при ошибке
        setEventProfiles(prev => prev.map(profile => 
          profile.eventId === eventId 
            ? { ...profile, ...updates }
            : profile
        ));
      }
    }
  }, [eventProfiles, createEventProfile, normalizeMediaUrl]);

  const updateEventProfilePost = useCallback(async (eventId: string, postId: string, updates: Partial<EventProfilePost>) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      // Fallback: обновляем локально
      setEventProfiles(prev => prev.map(profile => 
        profile.eventId === eventId 
          ? { 
              ...profile, 
              posts: profile.posts.map(post => 
                post.id === postId 
                  ? { ...post, ...updates }
                  : post
              )
            }
          : profile
      ));
      return;
    }

    try {
      const response = await apiRequest(
        `/events/${eventId}/profile/posts/${postId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        },
        actualToken,
      ) as ServerEventProfilePost | null;

      if (response) {
        const updatedPost: EventProfilePost = {
          id: response.id || postId,
          eventId,
          authorId: response.authorId || response.author?.id || '',
          content: response.content ?? updates.content,
          photoUrl: response.photoUrl ?? updates.photoUrl,
          createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
        };

        setEventProfiles(prev => prev.map(profile => 
          profile.eventId === eventId 
            ? { 
                ...profile, 
                posts: profile.posts.map(post => 
                  post.id === postId ? updatedPost : post
                )
              }
            : profile
        ));
      }
    } catch (error) {
      logger.error('Failed to update event profile post', error);
      // Fallback: обновляем локально при ошибке
      setEventProfiles(prev => prev.map(profile => 
        profile.eventId === eventId 
          ? { 
              ...profile, 
              posts: profile.posts.map(post => 
                post.id === postId 
                  ? { ...post, ...updates }
                  : post
              )
            }
          : profile
      ));
    }
  }, []);

  const deleteEventProfilePost = useCallback(async (eventId: string, postId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot delete post: no access');
      return;
    }

    try {
      await apiRequest(
        `/events/${eventId}/profile/posts/${postId}`,
        { method: 'DELETE' },
        actualToken,
      );

      // Удаляем пост из локального состояния
      setEventProfiles(prev => prev.map(profile => 
        profile.eventId === eventId 
          ? { 
              ...profile, 
              posts: profile.posts.filter(post => post.id !== postId)
            }
          : profile
      ));

      // Также удаляем из сохраненных, если был сохранен
      if (removeSavedMemoryPost) {
        removeSavedMemoryPost(eventId, postId);
      }

      // КРИТИЧЕСКИ ВАЖНО: Обновляем профиль события с сервера, чтобы все пользователи увидели удаление
      // Это гарантирует, что удаление будет видно для всех участников события
      try {
        await fetchEventProfile(eventId);
        logger.debug('Event profile refreshed after post deletion');
      } catch (refreshError) {
        logger.warn('Failed to refresh event profile after post deletion:', refreshError);
        // Не пробрасываем ошибку, так как пост уже удален локально
      }
    } catch (error) {
      logger.error('Failed to delete event profile post', error);
      throw error;
    }
  }, [removeSavedMemoryPost, fetchEventProfile]);

  const canEditEventProfile = useCallback((eventId: string, userId: string): boolean => {
    const event = events.find(e => e.id === eventId);
    if (!event) return false;
    
    const profile = eventProfiles.find(p => p.eventId === eventId);
    
    // Проверяем, является ли пользователь организатором или участником
    // Если профиль существует, проверяем через него
    // Если профиля нет, проверяем только организатора (для будущих событий)
    const isOrganizerOrParticipant = profile 
      ? (profile.organizerId === userId || profile.participants.includes(userId))
      : (event.organizerId === userId);
    
    if (!isOrganizerOrParticipant) return false;
    
    // Для прошедших событий (в разделе Memories) разрешаем редактирование
    if (isEventPast(event)) {
      return true;
    }
    
    // Для будущих событий тоже разрешаем редактирование (как было раньше)
    return true;
  }, [events, eventProfiles, isEventPast]);

  const addPostComment = useCallback(async (eventId: string, postId: string, comment: Omit<import('../../types').PostComment, 'id' | 'postId' | 'createdAt'>) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot add comment: no access');
      return;
    }

    try {
      const response = await apiRequest(
        `/events/${eventId}/profile/posts/${postId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: comment.content,
          }),
        },
        actualToken,
      ) as any;

      if (response) {
        const newComment: import('../../types').PostComment = {
          id: response.id,
          postId,
          authorId: response.authorId || response.author?.id || actualUserId || '',
          content: response.content || '',
          createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
        };

        setEventProfiles(prev => prev.map(profile => 
          profile.eventId === eventId 
            ? {
                ...profile,
                posts: profile.posts.map(post =>
                  post.id === postId
                    ? {
                        ...post,
                        comments: [...(post.comments || []), newComment],
                      }
                    : post
                ),
              }
            : profile
        ));
      }
    } catch (error) {
      logger.error('Failed to add post comment', error);
      throw error;
    }
  }, [setEventProfiles]);

  return {
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
    addPostComment,
  };
};

