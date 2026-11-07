import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { apiRequest, ApiError, API_BASE_URL } from '../../services/api';
import { createLogger } from '../../utils/logger';
import type { Event, EventProfile, EventProfilePost } from '../../types';
import type { ServerEventProfile, ServerEventProfilePost, ServerEventRequest } from '../../types/api';

const logger = createLogger('useEventProfiles');

/**
 * Простой ограничитель параллельности для запросов профилей событий.
 *
 * Зачем: на экране ленты одновременно монтируются десятки EventCard, и каждая
 * карточка сама запрашивает свой профиль (`/events/:id/profile`), если его ещё
 * нет в контексте. Без ограничения это превращается в одновременный залп из
 * 40-60 параллельных HTTP-запросов при каждом открытии ленты — браузер и сервер
 * захлёбываются, и из-за этого вся лента "тормозит" и долго прогружается.
 *
 * Решение: пропускаем не более N запросов профилей одновременно, остальные
 * становятся в очередь и выполняются по мере освобождения слотов. Поведение
 * и данные не меняются — меняется только то, как быстро/плавно всё это летит.
 */
const PROFILE_FETCH_CONCURRENCY = 4;

/**
 * Дедупликация, кэш и отступление при 429.
 *
 * Ограничитель ниже сдерживает ОДНОВРЕМЕННОСТЬ (4 запроса), но не частоту:
 * при нескольких десятках событий запросы всё равно уходят пачкой и упираются
 * в серверный лимит (@nestjs/throttler, 100 запросов в минуту) — в логах
 * появлялись подряд идущие 429 на /events/<id>/profile, причём одни и те же
 * id повторялись, потому что дедупликации не было вовсе.
 *
 * Здесь три меры:
 *  - один запрос на eventId одновременно (остальные ждут тот же промис);
 *  - уже загруженный профиль не перезапрашивается заданное время;
 *  - после 429 запросы не отправляются вообще до истечения паузы, иначе
 *    приложение продолжает долбить лимит и не даёт ему восстановиться.
 */
const PROFILE_CACHE_TTL_MS = 60_000;
const RATE_LIMIT_COOLDOWN_MS = 30_000;

const _inFlightProfiles = new Map<string, Promise<EventProfile | null>>();
const _lastProfileFetchAt = new Map<string, number>();
let _rateLimitedUntil = 0;
const _fetchState = { active: 0, queue: [] as Array<() => void> };

function runWithProfileFetchLimit<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      _fetchState.active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          _fetchState.active--;
          const next = _fetchState.queue.shift();
          if (next) next();
        });
    };

    if (_fetchState.active < PROFILE_FETCH_CONCURRENCY) {
      run();
    } else {
      _fetchState.queue.push(run);
    }
  });
}

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
  fetchEventProfiles: (eventIds: string[], force?: boolean) => Promise<void>;
  createEventProfile: (eventId: string) => Promise<void>;
  addEventProfilePost: (eventId: string, post: Omit<EventProfilePost, 'id' | 'eventId' | 'createdAt'>) => Promise<EventProfilePost | null>;
  updateEventProfile: (eventId: string, updates: Partial<EventProfile>) => Promise<void>;
  updateEventProfilePost: (eventId: string, postId: string, updates: Partial<EventProfilePost>) => Promise<void>;
  deleteEventProfilePost: (eventId: string, postId: string) => Promise<void>;
  canEditEventProfile: (eventId: string, userId: string) => boolean;
  addPostComment: (eventId: string, postId: string, comment: Omit<import('../../types').PostComment, 'id' | 'postId' | 'createdAt'>) => Promise<void>;
}

/** id участников из ответа сервера: там либо строки, либо строки-связки. */
function participantIdsOf(list: any): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((p: any) => (typeof p === 'string' ? p : p?.userId || p?.user?.id))
    .filter(Boolean) as string[];
}

/**
 * Ответ сервера -> клиентская модель профиля события.
 *
 * Вынесено из doFetchEventProfile, чтобы этим же кодом разбирался и пакетный
 * ответ /event-profiles/batch. Иначе разбор пришлось бы держать в двух местах,
 * а он нетривиальный: дедупликация постов, нормализация ссылок на медиа,
 * подстановка полей события там, где профиль их не хранит.
 */
function mapServerProfileToClient(
  response: ServerEventProfile,
  eventId: string,
  event: any,
  // normalizeMediaUrl приходит в хук пропом, а не импортом, поэтому функции
  // его надо передать явно.
  normalizeMediaUrl: (input?: string | null) => string | undefined,
): EventProfile {
  return {
  id: response.id || `profile-${eventId}`,
  eventId,
  name: (response.name || event?.title || (response.event as any)?.name || '') as string,
  description: (response.description || event?.description || (response.event as any)?.description || '') as string,
  date: (response.date || event?.date || (response.event as any)?.date || '') as string,
  time: (response.time || event?.time || (response.event as any)?.time || '') as string,
  location: (response.location || event?.location || (response.event as any)?.location || '') as string,
  participants: participantIdsOf(response.participants),
  // Вышедшие из события — сервер отдаёт их только своим (см. EventProfile).
  formerParticipants: participantIdsOf((response as any).formerParticipants),
  organizerId: (event?.organizerId || response.organizerId || (response.event as any)?.organizerId || '') as string,
  isCompleted: response.isCompleted || false,
  hiddenParameters: (response.hiddenParameters || {}) as Record<string, boolean>,
  posts: (() => {
    // Дедупликация постов по ID перед маппингом
    const postsMap = new Map<string, ServerEventProfilePost>();
    (response.posts || []).forEach((post: ServerEventProfilePost) => {
      if (post.id && !postsMap.has(post.id)) {
        postsMap.set(post.id, post);
      } else if (post.id) {
        logger.warn(`Обнаружен дубликат поста с ID ${post.id} в ответе сервера`);
      }
    });
    return Array.from(postsMap.values()).map((post: ServerEventProfilePost) => ({
      id: post.id,
      eventId,
      authorId: (post.authorId || post.author?.id || '') as string,
      content: post.content,
      photoUrl: normalizeMediaUrl(post.photoUrl),
      photoUrls: post.photoUrls && Array.isArray(post.photoUrls) 
        ? post.photoUrls.map(url => normalizeMediaUrl(url))
        : undefined,
      captions: post.captions && Array.isArray(post.captions) 
        ? post.captions 
        : undefined,
    // Лайки и комментарии приходят с сервера, но в клиентскую модель
    // не переносились — из-за этого после перезахода в приложение
    // они пропадали.
    likes: Array.isArray((post as any).likes) ? ((post as any).likes as string[]) : [],
    comments: Array.isArray((post as any).comments) ? (post as any).comments : [],
    createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
    }));
  })(),
  createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
  avatar: normalizeMediaUrl(response.avatar) || normalizeMediaUrl(event?.mediaUrl) || normalizeMediaUrl((response.event as any)?.mediaUrl),
};
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

    // Сервер ответил 429 — выдерживаем паузу, не отправляя новых запросов.
    if (Date.now() < _rateLimitedUntil) {
      logger.debug(`Пропускаем профиль ${eventId}: действует пауза после 429`);
      return null;
    }

    // Тот же профиль уже грузится — ждём тот же запрос, а не шлём второй.
    const inFlight = _inFlightProfiles.get(eventId);
    if (inFlight) return inFlight;

    // Недавно загружали — данные ещё свежие.
    const lastAt = _lastProfileFetchAt.get(eventId);
    if (lastAt && Date.now() - lastAt < PROFILE_CACHE_TTL_MS) {
      return eventProfiles.find(profile => profile.eventId === eventId) ?? null;
    }

    const request = doFetchEventProfile(eventId, actualToken);
    _inFlightProfiles.set(eventId, request);
    try {
      return await request;
    } finally {
      _inFlightProfiles.delete(eventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventProfiles]);

  /**
   * Профили сразу для набора событий — ОДНИМ запросом.
   *
   * Экраны профиля и мемориса запрашивали профиль каждого прошедшего события
   * отдельно: на боевых данных это под сотню параллельных запросов при каждом
   * открытии экрана. Они упирались в ограничитель частоты, отдавали 429 и
   * оставляли экраны пустыми, а главный поток — занятым.
   *
   * Отметки в _lastProfileFetchAt проставляем и для событий, у которых профиля
   * не оказалось: иначе поштучный загрузчик тут же пошёл бы добирать их по
   * одному и мы вернулись бы к тому же шквалу.
   */
  const fetchEventProfiles = useCallback(async (eventIds: string[], force = false): Promise<void> => {
    const actualToken = currentAccessTokenRef.current;
    if (!actualToken || !eventIds.length) return;
    if (Date.now() < _rateLimitedUntil) return;

    // Свежие пропускаем — как и в поштучной загрузке. Кроме случая, когда
    // обновление запросил сам пользователь (потянул ленту вниз): тогда кэш
    // на минуту только мешал бы.
    const stale = force
      ? eventIds
      : eventIds.filter(id => {
          const lastAt = _lastProfileFetchAt.get(id);
          return !lastAt || Date.now() - lastAt >= PROFILE_CACHE_TTL_MS;
        });
    if (!stale.length) return;

    // Сервер ограничивает список 200 идентификаторами — режем на части.
    const CHUNK = 100;
    for (let i = 0; i < stale.length; i += CHUNK) {
      const chunk = stale.slice(i, i + CHUNK);
      try {
        const response = await apiRequest(
          `/event-profiles/batch?ids=${encodeURIComponent(chunk.join(','))}`,
          { method: 'GET' },
          actualToken,
        ) as ServerEventProfile[] | null;

        const list = Array.isArray(response) ? response : [];
        logger.info(`Пакетная загрузка профилей: запрошено ${chunk.length}, получено ${list.length}`);

        const mapped = list
          .map(item => {
            const eventId = (item as any).eventId as string;
            if (!eventId) return null;
            const event = events.find(e => e.id === eventId);
            return mapServerProfileToClient(item, eventId, event, normalizeMediaUrl);
          })
          .filter(Boolean) as EventProfile[];

        if (mapped.length) {
          // Одно обновление состояния на всю пачку, а не по разу на профиль.
          setEventProfiles(prev => {
            const byEventId = new Map(prev.map(profile => [profile.eventId, profile]));
            mapped.forEach(profile => byEventId.set(profile.eventId, profile));
            return Array.from(byEventId.values());
          });
        }

        const now = Date.now();
        chunk.forEach(id => _lastProfileFetchAt.set(id, now));
      } catch (error: any) {
        if (error?.status === 429) {
          _rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          logger.warn('Пакетная загрузка профилей: 429, выдерживаем паузу');
          return;
        }
        logger.warn('Пакетная загрузка профилей не удалась', error);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, normalizeMediaUrl, setEventProfiles]);

  const doFetchEventProfile = useCallback(async (eventId: string, actualToken: string): Promise<EventProfile | null> => {
    try {
      logger.info(`Загружаем профиль для события ${eventId}`);
      const response = await runWithProfileFetchLimit(() => apiRequest(
        `/events/${eventId}/profile`,
        { method: 'GET' },
        actualToken,
      )) as ServerEventProfile | null;

      logger.debug(`Ответ сервера для события ${eventId}:`, response ? 'найден' : 'не найден (null)');
      
      const event = events.find(e => e.id === eventId);
      
      // ВСЕ события должны иметь профиль
      if (!response && event) {
        logger.debug(`Профиль не найден для события ${eventId}, но это нормально - может быть временная проблема`);
        return null;
      }
      
      if (response) {
        const mappedProfile = mapServerProfileToClient(response, eventId, event, normalizeMediaUrl);
        
        logger.info(`✅ Профиль загружен для события ${eventId}, постов: ${mappedProfile.posts?.length || 0}, участников: ${mappedProfile.participants.length}`);

        setEventProfiles(prev => {
          const exists = prev.find(p => p.eventId === eventId);
          if (exists) {
            // КРИТИЧЕСКИ ВАЖНО: При обновлении профиля ПОЛНОСТЬЮ ЗАМЕНЯЕМ список постов
            // Сервер всегда возвращает полный актуальный список постов, поэтому мы должны его использовать
            // НЕ добавляем посты из локального состояния - это приводит к дублированию
            
            // Дополнительная проверка: дедупликация постов по ID перед заменой
            const postsMap = new Map<string, typeof mappedProfile.posts[0]>();
            mappedProfile.posts.forEach(post => {
              if (post.id && !postsMap.has(post.id)) {
                postsMap.set(post.id, post);
              } else if (post.id) {
                logger.warn(`Обнаружен дубликат поста с ID ${post.id} в mappedProfile для события ${eventId}`);
              }
            });
            const deduplicatedPosts = Array.from(postsMap.values());
            
            if (deduplicatedPosts.length !== mappedProfile.posts.length) {
              logger.warn(`Дедупликация постов: было ${mappedProfile.posts.length}, стало ${deduplicatedPosts.length} для события ${eventId}`);
            }
            
            const finalProfile = { ...mappedProfile, posts: deduplicatedPosts };
            logger.debug(`Обновляем существующий профиль для события ${eventId}, постов было: ${exists.posts.length}, постов стало: ${finalProfile.posts.length}`);
            // Заменяем весь профиль полностью - используем только данные с сервера
            return prev.map(p => p.eventId === eventId ? finalProfile : p);
          }
          logger.debug(`Добавляем новый профиль для события ${eventId}, всего профилей: ${prev.length + 1}`);
          return [...prev, mappedProfile];
        });

        _lastProfileFetchAt.set(eventId, Date.now());
        return mappedProfile;
      }
      
      // Если сервер возвращает null - это нормально, может быть временная проблема
      logger.debug(`Профиль не найден для события ${eventId}`);
      _lastProfileFetchAt.set(eventId, Date.now());
      return null;
    } catch (error) {
      // Обрабатываем различные типы ошибок
      if (error instanceof ApiError) {
        // 404 - профиль не найден (это нормально, может быть временная проблема)
        if (error.status === 404) {
          logger.debug(`Профиль не найден (404) для события ${eventId}`);
          return null;
        }
        // 403/500 - пользователь не имеет доступа или временная проблема сервера
        if (error.status === 403 || error.status === 500) {
          return null;
        }
        // 429 — упёрлись в лимит запросов. Замолкаем на паузу: продолжать
        // слать запросы бессмысленно, они всё равно вернут 429 и не дадут
        // счётчику лимита восстановиться.
        if (error.status === 429) {
          _rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          logger.warn(`Лимит запросов исчерпан (429), пауза ${RATE_LIMIT_COOLDOWN_MS / 1000}с`);
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
          participants: participantIdsOf(response.participants),
          formerParticipants: participantIdsOf((response as any).formerParticipants),
          organizerId: event.organizerId,
          isCompleted: response.isCompleted || false,
          hiddenParameters: (response.hiddenParameters || {}) as Record<string, boolean>,
          posts: (response.posts || []).map((post: ServerEventProfilePost) => ({
            id: post.id,
            eventId,
            authorId: (post.authorId || post.author?.id || '') as string,
            content: post.content,
            photoUrl: post.photoUrl,
            // Лайки и комментарии приходят с сервера, но в клиентскую модель
            // не переносились — из-за этого после перезахода в приложение
            // они пропадали.
            likes: Array.isArray((post as any).likes) ? ((post as any).likes as string[]) : [],
            comments: Array.isArray((post as any).comments) ? (post as any).comments : [],
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

  // Защита от множественных одновременных вызовов для одного поста
  const addingPosts = useRef<Set<string>>(new Set());
  
  const addEventProfilePost = useCallback(async (eventId: string, post: Omit<EventProfilePost, 'id' | 'eventId' | 'createdAt'>) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot add post: no access');
      return;
    }

    // Создаем уникальный ключ для этого запроса (по eventId + content/photoUrl)
    const postKey = `${eventId}-${post.content || ''}-${post.photoUrl || ''}-${JSON.stringify(post.photoUrls || [])}`;
    
    // Проверяем, не добавляется ли уже такой пост
    if (addingPosts.current.has(postKey)) {
      logger.warn(`Пост уже добавляется для ключа ${postKey}, пропускаем дублирующий запрос`);
      return null;
    }
    
    addingPosts.current.add(postKey);

    try {
      // Убеждаемся, что профиль существует перед добавлением поста
      const existingProfile = eventProfiles.find(p => p.eventId === eventId);
      if (!existingProfile) {
        // Пытаемся создать профиль, если его нет
        await createEventProfile(eventId);
      }

      // Если photoUrl - локальный URI (file://) или File объект (веб), загружаем через FormData
      let response: ServerEventProfilePost | null = null;
      const isFileObject = Platform.OS === 'web' && post.photoUrl && typeof post.photoUrl === 'object' && 'name' in (post.photoUrl as any);
      const isLocalUri = post.photoUrl && typeof post.photoUrl === 'string' && (post.photoUrl.startsWith('file://') || post.photoUrl.startsWith('content://'));
      
      if (isFileObject || isLocalUri) {
        // Загружаем фото через FormData
        const formData = new FormData();
        
        if (isFileObject) {
          // На вебе используем File объект напрямую
          formData.append('file', post.photoUrl as any);
        } else if (isLocalUri) {
          // Для мобильных платформ используем URI
          const filename = (post.photoUrl as string).split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          
          formData.append('file', {
            uri: post.photoUrl,
            name: filename,
            type: type,
          } as any);
        }
        
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
        // ВАЖНО: если есть photoUrls, это карусель - отправляем их вместо photoUrl
        const requestBody: any = {
          content: post.content,
        };
        
        if (post.photoUrls && Array.isArray(post.photoUrls) && post.photoUrls.length > 0) {
          // Карусель: отправляем photoUrls и captions
          requestBody.photoUrls = post.photoUrls;
          if (post.captions && Array.isArray(post.captions)) {
            requestBody.captions = post.captions;
          }
        } else if (post.photoUrl) {
          // Одно фото: отправляем photoUrl
          requestBody.photoUrl = post.photoUrl;
        }
        
        response = await apiRequest(
          `/events/${eventId}/profile/posts`,
          {
            method: 'POST',
            body: JSON.stringify(requestBody),
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
          authorId: (response.authorId || response.author?.id || currentUserId || '') as string,
          content: response.content,
          photoUrl: normalizeMediaUrl(response.photoUrl),
          // Извлекаем photoUrls и captions из ответа сервера
          photoUrls: response.photoUrls && Array.isArray(response.photoUrls) 
            ? response.photoUrls.map(url => normalizeMediaUrl(url))
            : undefined,
          captions: response.captions && Array.isArray(response.captions) 
            ? response.captions 
            : undefined,
          createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
        };
        
        logger.debug('Создан EventProfilePost:', {
          id: newPost.id,
          hasPhotoUrl: !!newPost.photoUrl,
          hasPhotoUrls: !!newPost.photoUrls,
          photoUrlsLength: Array.isArray(newPost.photoUrls) ? newPost.photoUrls.length : 0,
        });

        setEventProfiles(prev => {
          // КРИТИЧЕСКИ ВАЖНО: Дедупликация перед добавлением поста
          // Сначала дедуплицируем все существующие посты
          const existingProfile = prev.find(p => p.eventId === eventId);
          if (existingProfile) {
            const existingPostsMap = new Map<string, typeof existingProfile.posts[0]>();
            existingProfile.posts.forEach(post => {
              if (post.id && !existingPostsMap.has(post.id)) {
                existingPostsMap.set(post.id, post);
              }
            });
            const deduplicatedExistingPosts = Array.from(existingPostsMap.values());
            
            // Проверяем, нет ли уже такого поста (по ID)
            const postExists = deduplicatedExistingPosts.some(p => p.id === newPost.id);
            if (postExists) {
              logger.warn(`Пост ${newPost.id} уже существует в профиле ${eventId}, пропускаем добавление. Всего постов: ${deduplicatedExistingPosts.length}`);
              // Если были дубликаты, обновляем профиль с дедуплицированными постами
              if (deduplicatedExistingPosts.length !== existingProfile.posts.length) {
                logger.warn(`Обнаружены дубликаты в профиле ${eventId}: было ${existingProfile.posts.length}, стало ${deduplicatedExistingPosts.length}`);
                return prev.map(p => p.eventId === eventId ? { ...p, posts: deduplicatedExistingPosts } : p);
              }
              return prev;
            }
            
            logger.debug(`Добавляем новый пост ${newPost.id} в профиль ${eventId}, постов было: ${deduplicatedExistingPosts.length}`);
            return prev.map(p => p.eventId === eventId ? { ...p, posts: [newPost, ...deduplicatedExistingPosts] } : p);
          }
          return prev;
        });
        
        addingPosts.current.delete(postKey);
        return newPost;
      }
      
      addingPosts.current.delete(postKey);
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
              // ВАЖНО: если есть photoUrls, это карусель - отправляем их вместо photoUrl
              const requestBody: any = {
                content: post.content,
              };
              
              if (post.photoUrls && Array.isArray(post.photoUrls) && post.photoUrls.length > 0) {
                // Карусель: отправляем photoUrls и captions
                requestBody.photoUrls = post.photoUrls;
                if (post.captions && Array.isArray(post.captions)) {
                  requestBody.captions = post.captions;
                }
              } else if (post.photoUrl) {
                // Одно фото: отправляем photoUrl
                requestBody.photoUrl = post.photoUrl;
              }
              
              retryResponse = await apiRequest(
                `/events/${eventId}/profile/posts`,
                {
                  method: 'POST',
                  body: JSON.stringify(requestBody),
                },
                actualToken,
              );
            }
            
            const response = retryResponse as ServerEventProfilePost;
            if (response) {
              const newPost: EventProfilePost = {
                id: response.id,
                eventId,
                authorId: (response.authorId || response.author?.id || currentUserId || '') as string,
                content: response.content,
                photoUrl: normalizeMediaUrl(response.photoUrl),
                // Извлекаем photoUrls и captions из ответа сервера
                photoUrls: response.photoUrls && Array.isArray(response.photoUrls) 
                  ? response.photoUrls.map(url => normalizeMediaUrl(url))
                  : undefined,
                captions: response.captions && Array.isArray(response.captions) 
                  ? response.captions 
                  : undefined,
                createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
              };
              setEventProfiles(prev => {
                // КРИТИЧЕСКИ ВАЖНО: Дедупликация перед добавлением поста (retry)
                const existingProfile = prev.find(p => p.eventId === eventId);
                if (existingProfile) {
                  const existingPostsMap = new Map<string, typeof existingProfile.posts[0]>();
                  existingProfile.posts.forEach(post => {
                    if (post.id && !existingPostsMap.has(post.id)) {
                      existingPostsMap.set(post.id, post);
                    }
                  });
                  const deduplicatedExistingPosts = Array.from(existingPostsMap.values());
                  
                  const postExists = deduplicatedExistingPosts.some(p => p.id === newPost.id);
                  if (postExists) {
                    logger.warn(`Пост ${newPost.id} уже существует в профиле ${eventId} (retry), пропускаем добавление. Всего постов: ${deduplicatedExistingPosts.length}`);
                    if (deduplicatedExistingPosts.length !== existingProfile.posts.length) {
                      logger.warn(`Обнаружены дубликаты в профиле ${eventId} (retry): было ${existingProfile.posts.length}, стало ${deduplicatedExistingPosts.length}`);
                      return prev.map(p => p.eventId === eventId ? { ...p, posts: deduplicatedExistingPosts } : p);
                    }
                    return prev;
                  }
                  
                  logger.debug(`Добавляем новый пост ${newPost.id} в профиль ${eventId} (retry), постов было: ${deduplicatedExistingPosts.length}`);
                  return prev.map(p => p.eventId === eventId ? { ...p, posts: [newPost, ...deduplicatedExistingPosts] } : p);
                }
                return prev;
              });
              addingPosts.current.delete(postKey);
              return newPost;
            }
            
            return null;
          } catch (retryError) {
            logger.error('Failed to add event profile post after profile creation', retryError);
            // Пробрасываем ошибку дальше
            throw retryError;
          }
        } else {
          // Другие ошибки ApiError (не 404)
          logger.error('Failed to add event profile post', error.status, error.message);
          addingPosts.current.delete(postKey);
          // Пробрасываем ошибку дальше для обработки в вызывающем коде
          throw error;
        }
      } else {
        // Ошибки, которые не являются ApiError
        logger.error('Failed to add event profile post', error);
        addingPosts.current.delete(postKey);
        // Пробрасываем ошибку дальше
        throw error;
      }
    } finally {
      // Удаляем ключ в любом случае, даже если произошла ошибка
      addingPosts.current.delete(postKey);
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
          description: ((response.description ?? updates.description) || '') as string,
          date: response.date || updates.date || '',
          time: response.time || updates.time || '',
          location: ((response.location ?? updates.location) || '') as string,
          participants: participantIdsOf(response.participants),
          formerParticipants: participantIdsOf((response as any).formerParticipants),
          organizerId: updates.organizerId || '',
          isCompleted: (response.isCompleted ?? updates.isCompleted) ?? false,
          hiddenParameters: (response.hiddenParameters || updates.hiddenParameters || {}) as Record<string, boolean>,
          posts: (response.posts || []).map((post: any) => ({
            id: post.id,
            eventId,
            authorId: (post.authorId || post.author?.id || '') as string,
            content: post.content,
            photoUrl: normalizeMediaUrl(post.photoUrl),
            // Лайки и комментарии приходят с сервера, но в клиентскую модель
            // не переносились — из-за этого после перезахода в приложение
            // они пропадали.
            likes: Array.isArray((post as any).likes) ? ((post as any).likes as string[]) : [],
            comments: Array.isArray((post as any).comments) ? (post as any).comments : [],
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
                description: ((response.description ?? updates.description) || '') as string,
                date: response.date || updates.date || '',
                time: response.time || updates.time || '',
                location: ((response.location ?? updates.location) || '') as string,
                participants: participantIdsOf(response.participants),
                formerParticipants: participantIdsOf((response as any).formerParticipants),
                organizerId: updates.organizerId || '',
                isCompleted: (response.isCompleted ?? updates.isCompleted) ?? false,
                posts: (response.posts || []).map((post: any) => ({
                  id: post.id,
                  eventId,
                  authorId: (post.authorId || post.author?.id || '') as string,
                  content: post.content,
                  photoUrl: normalizeMediaUrl(post.photoUrl),
            // Лайки и комментарии приходят с сервера, но в клиентскую модель
            // не переносились — из-за этого после перезахода в приложение
            // они пропадали.
            likes: Array.isArray((post as any).likes) ? ((post as any).likes as string[]) : [],
            comments: Array.isArray((post as any).comments) ? (post as any).comments : [],
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
      setEventProfiles(prev => prev.map(profile => {
        if (profile.eventId === eventId) {
          const filteredPosts = profile.posts.filter(post => post.id !== postId);
          logger.debug(`Удален пост ${postId} из профиля ${eventId}, постов было: ${profile.posts.length}, стало: ${filteredPosts.length}`);
          return { 
            ...profile, 
            posts: filteredPosts
          };
        }
        return profile;
      }));

      // Также удаляем из сохраненных, если был сохранен
      if (removeSavedMemoryPost) {
        removeSavedMemoryPost(eventId, postId);
      }

      // КРИТИЧЕСКИ ВАЖНО: НЕ вызываем fetchEventProfile после удаления поста
      // Это может привести к дублированию постов из-за race condition
      // Удаление уже обработано локально через setEventProfiles
      // Для синхронизации с другими пользователями используется WebSocket
      logger.debug('Post deleted locally, WebSocket will sync with other users');
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
    fetchEventProfiles,
    createEventProfile,
    addEventProfilePost,
    updateEventProfile,
    updateEventProfilePost,
    deleteEventProfilePost,
    canEditEventProfile,
    addPostComment,
  };
};

