import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { apiRequest, ApiError, API_BASE_URL } from '../../services/api';
import type { Event, EventProfile, EventRequest, Chat } from '../../types';
import type { CreateEventInput } from '../../context/EventsContext';
import type { ServerUser, ServerEvent } from '../../types/api';
import { createLogger } from '../../utils/logger';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

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
  markEventAsDeleted?: (eventId: string) => void; // Функция для пометки события как удаленного
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
  transferOrganizerRole: (eventId: string, newOrganizerId: string) => Promise<void>;
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
  markEventAsDeleted,
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
        // КРИТИЧЕСКИ ВАЖНО: Создаем дату в локальном часовом поясе, а не UTC
        // input.date - это строка в формате YYYY-MM-DD
        // input.time - это строка в формате HH:MM (локальное время)
        // Создаем Date объект, который интерпретирует время как локальное, а не UTC
        const [year, month, day] = input.date.split('-').map(Number);
        const [hours, minutes] = input.time.split(':').map(Number);
        const start = new Date(year, month - 1, day, hours, minutes || 0, 0, 0);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

        // Upload media file if it's a local URI or File object (for web)
        let finalMediaUrl = input.mediaUrl;
        let finalOriginalMediaUrl = input.originalMediaUrl;
        
        logger.debug('📸 Проверка медиа для события:');
        logger.debug('input.mediaUrl:', input.mediaUrl);
        logger.debug('input.originalMediaUrl:', input.originalMediaUrl);
        logger.debug('input.mediaType:', input.mediaType);
        logger.debug('isHttpUrl(mediaUrl):', isHttpUrl(input.mediaUrl));
        logger.debug('isHttpUrl(originalMediaUrl):', isHttpUrl(input.originalMediaUrl));
        
        // КРИТИЧЕСКИ ВАЖНО: На вебе файл уже должен быть загружен в create.tsx
        // Если это HTTP URL на вебе - используем его
        // Если это data URL на вебе - пропускаем загрузку (она уже была в create.tsx)
        
        // Загружаем обрезанное фото (mediaUrl) для мобильного приложения
        if (input.mediaUrl && !isHttpUrl(input.mediaUrl) && Platform.OS !== 'web') {
          logger.info('📤 Начинаем загрузку локального медиа (mediaUrl)...');
          try {
            let imageUri = input.mediaUrl;
            
            // Сжимаем изображение перед загрузкой, если это изображение
            // КРИТИЧЕСКИ ВАЖНО: Проверяем доступность ImageManipulator и FileSystem перед использованием
            if (input.mediaType === 'image' && ImageManipulator && FileSystem && typeof ImageManipulator.manipulateAsync === 'function') {
              try {
                // Проверяем размер файла
                const fileInfo = await FileSystem.getInfoAsync(input.mediaUrl);
                const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
                const fileSizeMB = fileSize / (1024 * 1024);
                
                logger.debug('📤 Размер исходного файла:', { sizeMB: fileSizeMB.toFixed(2), sizeBytes: fileSize });
                
                // Определяем параметры сжатия в зависимости от размера
                let targetWidth = 1200;
                let compressQuality = 0.8;
                
                if (fileSizeMB > 10) {
                  // Очень большие файлы (>10 МБ) - агрессивное сжатие
                  targetWidth = 800;
                  compressQuality = 0.5;
                } else if (fileSizeMB > 5) {
                  // Большие файлы (5-10 МБ)
                  targetWidth = 1000;
                  compressQuality = 0.6;
                } else if (fileSizeMB > 2) {
                  // Средние файлы (2-5 МБ)
                  targetWidth = 1200;
                  compressQuality = 0.7;
                }
                
                let manipResult = await ImageManipulator.manipulateAsync(
                  input.mediaUrl,
                  [{ resize: { width: targetWidth } }],
                  { compress: compressQuality, format: ImageManipulator.SaveFormat.JPEG }
                );
                
                // Проверяем размер после сжатия и повторяем, если нужно
                let compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
                let compressedSize = compressedInfo.exists && 'size' in compressedInfo ? compressedInfo.size : 0;
                let compressedSizeMB = compressedSize / (1024 * 1024);
                
                // Итеративное сжатие до достижения размера < 2 МБ
                const MAX_SIZE_MB = 2;
                let iterations = 0;
                while (compressedSizeMB > MAX_SIZE_MB && iterations < 5) {
                  iterations++;
                  logger.debug(`📤 Файл все еще большой (${compressedSizeMB.toFixed(2)} МБ), повторное сжатие #${iterations}`);
                  
                  targetWidth = Math.max(400, Math.floor(targetWidth * 0.7));
                  compressQuality = Math.max(0.2, compressQuality - 0.15);
                  
                  manipResult = await ImageManipulator.manipulateAsync(
                    manipResult.uri,
                    [{ resize: { width: targetWidth } }],
                    { compress: compressQuality, format: ImageManipulator.SaveFormat.JPEG }
                  );
                  
                  compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
                  compressedSize = compressedInfo.exists && 'size' in compressedInfo ? compressedInfo.size : 0;
                  compressedSizeMB = compressedSize / (1024 * 1024);
                }
                
                // Финальное агрессивное сжатие, если нужно
                if (compressedSizeMB > MAX_SIZE_MB) {
                  logger.warn(`⚠️ Файл все еще большой (${compressedSizeMB.toFixed(2)} МБ), применяю финальное агрессивное сжатие`);
                  manipResult = await ImageManipulator.manipulateAsync(
                    manipResult.uri,
                    [{ resize: { width: 800 } }],
                    { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG }
                  );
                  compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
                  compressedSize = compressedInfo.exists && 'size' in compressedInfo ? compressedInfo.size : 0;
                  compressedSizeMB = compressedSize / (1024 * 1024);
                }
                
                imageUri = manipResult.uri;
                logger.debug('📤 Изображение сжато:', { 
                  original: input.mediaUrl, 
                  compressed: imageUri,
                  originalSizeMB: fileSizeMB.toFixed(2),
                  compressedSizeMB: compressedSizeMB.toFixed(2)
                });
              } catch (compressError) {
                logger.warn('⚠️ Не удалось сжать изображение, используем оригинал:', compressError);
                // Продолжаем с оригинальным изображением
              }
            }
            
            // КРИТИЧЕСКИ ВАЖНО: Проверяем, что файл существует перед загрузкой
            try {
              const finalFileInfo = await FileSystem.getInfoAsync(imageUri);
              if (!finalFileInfo.exists) {
                logger.error('❌ Файл не существует по пути:', imageUri);
                throw new Error('File not found');
              }
              logger.debug('✅ Файл существует, размер:', finalFileInfo.size, 'байт');
            } catch (fileCheckError: any) {
              logger.error('❌ Ошибка проверки файла:', fileCheckError?.message || fileCheckError);
              throw new Error(`File check failed: ${fileCheckError?.message || 'Unknown error'}`);
            }

            const formData = new FormData();
            const fileName = imageUri.split('/').pop() || 'image.jpg';
            const fileType = input.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
            
            // КРИТИЧЕСКИ ВАЖНО: В React Native FormData принимает объект с uri, name, type
            // uri должен быть абсолютным путем к файлу (file://...)
            formData.append('file', {
              uri: imageUri,
              name: fileName,
              type: fileType,
            } as any);

            logger.debug('📤 Загрузка медиа события:', { 
              fileName, 
              fileType, 
              uri: imageUri,
              originalUri: input.mediaUrl 
            });
            
            const uploadResponse = await fetch(`${API_BASE_URL}/events/media`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${actualToken}`,
                // НЕ устанавливаем Content-Type - React Native сделает это автоматически для FormData
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
            
            // КРИТИЧЕСКИ ВАЖНО: Добавляем retry при "Network request failed"
            if (uploadError?.message === 'Network request failed' || uploadError?.message?.includes('Network')) {
              logger.warn('⚠️ Network request failed, attempting retry in 2 seconds...');
              try {
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Повторная попытка загрузки
                const retryFormData = new FormData();
                retryFormData.append('file', {
                  uri: imageUri,
                  name: fileName,
                  type: fileType,
                } as any);
                
                const retryUploadResponse = await fetch(`${API_BASE_URL}/events/media`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${actualToken}`,
                  },
                  body: retryFormData,
                });
                
                if (retryUploadResponse.ok) {
                  const retryData = await retryUploadResponse.json();
                  finalMediaUrl = retryData.url || retryData.mediaUrl || retryData.publicUrl;
                  logger.info('✅ Медиа загружено успешно после retry:', finalMediaUrl);
                } else {
                  const retryText = await retryUploadResponse.text();
                  logger.error('❌ Ошибка повторной загрузки медиа после retry:', retryUploadResponse.status, retryText);
                  finalMediaUrl = undefined;
                }
              } catch (retryError: any) {
                logger.error('❌ Ошибка при retry загрузки медиа:', retryError?.message || retryError);
                finalMediaUrl = undefined;
              }
            } else {
              finalMediaUrl = undefined;
            }
          }
        }

        // Загружаем оригинальное фото (originalMediaUrl)
        // КРИТИЧЕСКИ ВАЖНО: На вебе файл уже должен быть загружен в create.tsx
        // Если это data URL на вебе - пропускаем загрузку здесь (она уже была в create.tsx)
        if (input.originalMediaUrl && !isHttpUrl(input.originalMediaUrl) && Platform.OS !== 'web') {
          logger.info('📤 Начинаем загрузку локального медиа (originalMediaUrl)...');
          try {
            let imageUri = input.originalMediaUrl;
            
            // Сжимаем изображение перед загрузкой, если это изображение
            // КРИТИЧЕСКИ ВАЖНО: Проверяем доступность ImageManipulator и FileSystem перед использованием
            if (input.mediaType === 'image' && ImageManipulator && FileSystem && typeof ImageManipulator.manipulateAsync === 'function') {
              try {
                // Проверяем размер файла
                const fileInfo = await FileSystem.getInfoAsync(input.originalMediaUrl);
                const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
                const fileSizeMB = fileSize / (1024 * 1024);
                
                logger.debug('📤 Размер исходного файла (originalMediaUrl):', { sizeMB: fileSizeMB.toFixed(2), sizeBytes: fileSize });
                
                // Определяем параметры сжатия в зависимости от размера
                let targetWidth = 1200;
                let compressQuality = 0.6;
                
                if (fileSizeMB > 15) {
                  // Очень большие файлы (>15 МБ) - максимально агрессивное сжатие
                  targetWidth = 800;
                  compressQuality = 0.4;
                } else if (fileSizeMB > 10) {
                  // Большие файлы (10-15 МБ) - агрессивное сжатие
                  targetWidth = 1000;
                  compressQuality = 0.5;
                } else if (fileSizeMB > 5) {
                  // Средние файлы (5-10 МБ)
                  targetWidth = 1200;
                  compressQuality = 0.6;
                } else if (fileSizeMB > 2) {
                  // Небольшие файлы (2-5 МБ)
                  targetWidth = 1400;
                  compressQuality = 0.7;
                }
                
                let manipResult = await ImageManipulator.manipulateAsync(
                  input.originalMediaUrl,
                  [{ resize: { width: targetWidth } }],
                  { compress: compressQuality, format: ImageManipulator.SaveFormat.JPEG }
                );
                
                // Проверяем размер после сжатия и повторяем, если нужно
                let compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
                let compressedSize = compressedInfo.exists && 'size' in compressedInfo ? compressedInfo.size : 0;
                let compressedSizeMB = compressedSize / (1024 * 1024);
                
                // Итеративное сжатие до достижения размера < 2 МБ (критически важно для избежания 413)
                let iterations = 0;
                const MAX_SIZE_MB = 2; // Максимальный размер файла 2 МБ
                while (compressedSizeMB > MAX_SIZE_MB && iterations < 5) {
                  iterations++;
                  logger.debug(`📤 Файл все еще большой (${compressedSizeMB.toFixed(2)} МБ), повторное сжатие #${iterations}`);
                  
                  // Более агрессивное уменьшение параметров
                  targetWidth = Math.max(400, Math.floor(targetWidth * 0.7)); // Уменьшаем на 30%
                  compressQuality = Math.max(0.2, compressQuality - 0.15); // Уменьшаем качество на 15%
                  
                  manipResult = await ImageManipulator.manipulateAsync(
                    manipResult.uri,
                    [{ resize: { width: targetWidth } }],
                    { compress: compressQuality, format: ImageManipulator.SaveFormat.JPEG }
                  );
                  
                  compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
                  compressedSize = compressedInfo.exists && 'size' in compressedInfo ? compressedInfo.size : 0;
                  compressedSizeMB = compressedSize / (1024 * 1024);
                }
                
                // Если файл все еще больше 2 МБ после всех итераций - финальное агрессивное сжатие
                if (compressedSizeMB > MAX_SIZE_MB) {
                  logger.warn(`⚠️ Файл все еще большой (${compressedSizeMB.toFixed(2)} МБ) после ${iterations} итераций, применяю финальное агрессивное сжатие`);
                  manipResult = await ImageManipulator.manipulateAsync(
                    manipResult.uri,
                    [{ resize: { width: 800 } }],
                    { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG }
                  );
                  compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
                  compressedSize = compressedInfo.exists && 'size' in compressedInfo ? compressedInfo.size : 0;
                  compressedSizeMB = compressedSize / (1024 * 1024);
                  logger.debug(`📤 Финальный размер после агрессивного сжатия: ${compressedSizeMB.toFixed(2)} МБ`);
                }
                
                imageUri = manipResult.uri;
                logger.debug('📤 Оригинальное изображение сжато:', { 
                  original: input.originalMediaUrl, 
                  compressed: imageUri,
                  originalSizeMB: fileSizeMB.toFixed(2),
                  compressedSizeMB: compressedSizeMB.toFixed(2),
                  iterations
                });
              } catch (compressError) {
                logger.warn('⚠️ Не удалось сжать оригинальное изображение, пробуем более агрессивное сжатие:', compressError);
                // Пробуем еще более агрессивное сжатие при ошибке
                try {
                  const fallbackResult = await ImageManipulator.manipulateAsync(
                    input.originalMediaUrl,
                    [{ resize: { width: 800 } }],
                    { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG }
                  );
                  imageUri = fallbackResult.uri;
                  logger.debug('📤 Оригинальное изображение сжато (fallback):', { original: input.originalMediaUrl, compressed: imageUri });
                } catch (fallbackError) {
                  logger.error('❌ Не удалось сжать оригинальное изображение даже с fallback:', fallbackError);
                  // Продолжаем с оригинальным изображением, но это может привести к ошибке 413
                }
              }
            }
            
            // КРИТИЧЕСКИ ВАЖНО: Проверяем, что файл существует перед загрузкой
            try {
              const finalFileInfo = await FileSystem.getInfoAsync(imageUri);
              if (!finalFileInfo.exists) {
                logger.error('❌ Файл не существует по пути:', imageUri);
                throw new Error('File not found');
              }
              logger.debug('✅ Файл существует, размер:', finalFileInfo.size, 'байт');
            } catch (fileCheckError: any) {
              logger.error('❌ Ошибка проверки файла:', fileCheckError?.message || fileCheckError);
              throw new Error(`File check failed: ${fileCheckError?.message || 'Unknown error'}`);
            }

            const formData = new FormData();
            const fileName = imageUri.split('/').pop() || 'image.jpg';
            const fileType = input.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
            
            // КРИТИЧЕСКИ ВАЖНО: В React Native FormData принимает объект с uri, name, type
            // uri должен быть абсолютным путем к файлу (file://...)
            formData.append('file', {
              uri: imageUri,
              name: fileName,
              type: fileType,
            } as any);

            logger.debug('📤 Загрузка оригинального медиа события:', { 
              fileName, 
              fileType, 
              uri: imageUri, 
              originalUri: input.originalMediaUrl 
            });
            
            const uploadResponse = await fetch(`${API_BASE_URL}/events/media`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${actualToken}`,
                // НЕ устанавливаем Content-Type - React Native сделает это автоматически для FormData
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
            const errorMessage = uploadError?.message || String(uploadError);
            logger.error('❌ Исключение при загрузке оригинального медиа:', errorMessage);
            
            // Если это "Network request failed", это может быть проблема с доступом к серверу
            if (errorMessage.includes('Network request failed') || errorMessage.includes('network')) {
              logger.error('❌ Сетевая ошибка при загрузке медиа - проверьте доступность сервера:', API_BASE_URL);
              logger.error('❌ Возможные причины: сервер недоступен, проблемы с сетью, неправильный URL файла');
            }
            
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

        // Поле для массового события - КРИТИЧЕСКИ ВАЖНО
        // Отправляем только если значение явно установлено (true или false), но не undefined или null
        if (input.isMassEvent !== undefined && input.isMassEvent !== null) {
          payload.isMassEvent = Boolean(input.isMassEvent);
        }

        logger.debug('Creating event with payload:', JSON.stringify(payload, null, 2));
        logger.info('📤 Отправка запроса POST /events на сервер...', {
          hasTitle: !!payload.title,
          hasMediaUrl: !!payload.mediaUrl,
          hasOriginalMediaUrl: !!payload.originalMediaUrl,
          tokenPresent: !!actualToken
        });

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
          logger.info('✅ Получен ответ от сервера при создании события:', { hasResponse: !!response, eventId: response?.id });
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
            logger.error('❌ Ошибка при создании события:', {
              error: error instanceof Error ? error.message : String(error),
              status: error instanceof ApiError ? error.status : 'unknown',
              response: error instanceof ApiError ? error.response : undefined
            });
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
            createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
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
            createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
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

        // КРИТИЧЕСКИ ВАЖНО: Удаляем preview-event-temp и временные события ПЕРЕД добавлением нового события
        // Это предотвращает дублирование - если событие уже есть (например, через syncEventsFromServer), заменяем его
        setEvents(prev => {
          const filtered = prev.filter(event => 
            !event.id.includes('-temp') && 
            !event.id.startsWith('preview-')
          );
          // Если событие с таким ID уже есть - заменяем его, иначе добавляем в начало
          const existingIndex = filtered.findIndex(e => e.id === mapped.id);
          if (existingIndex >= 0) {
            const updated = [...filtered];
            updated[existingIndex] = mapped;
            return updated;
          }
          return [mapped, ...filtered];
        });

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

        // КРИТИЧЕСКИ ВАЖНО: После создания события синхронизируем с сервером, чтобы убедиться, что событие сохранено
        // НО: на вебе нужно дождаться завершения синхронизации перед тем, как компонент размонтируется
        try {
          if (syncEventsFromServer) {
            logger.info('🔄 Syncing events from server after event creation...');
            const syncPromise = syncEventsFromServer();
            
            // На вебе ждем завершения синхронизации с таймаутом
            if (typeof window !== 'undefined') {
              try {
                await Promise.race([
                  syncPromise,
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 10000))
                ]);
                logger.info('✅ Events synced successfully after event creation');
              } catch (syncError) {
                logger.warn('⚠️ Sync timeout or error after event creation, but event was created on server', syncError);
                // Все равно продолжаем, так как событие уже создано на сервере
              }
            } else {
              // На мобильных просто ждем
              await syncPromise;
              logger.info('✅ Events synced successfully after event creation');
            }
          }
        } catch (error) {
          logger.warn('⚠️ Failed to sync events after event creation', error);
          // Не бросаем ошибку, так как событие уже добавлено в локальное состояние
          // И событие уже создано на сервере (видно по 201 статусу)
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
      syncEventsFromServer,
    ],
  );

  const updateEvent = useCallback(async (id: string, updates: Partial<Event>) => {
    // Для временных событий (preview) обновляем только локально, без API-запроса
    if (id.includes('-temp') || id.startsWith('preview-')) {
      setEvents(prev => {
        const existingEvent = prev.find(e => e.id === id);
        if (existingEvent) {
          // Проверяем, действительно ли событие изменилось
          const hasChanges = Object.keys(updates).some(key => {
            const updateValue = (updates as any)[key];
            const existingValue = (existingEvent as any)[key];
            // Сравниваем значения, учитывая массивы и объекты
            if (Array.isArray(updateValue) && Array.isArray(existingValue)) {
              return JSON.stringify(updateValue) !== JSON.stringify(existingValue);
            }
            return updateValue !== existingValue;
          });
          
          // Обновляем только если есть реальные изменения
          if (hasChanges) {
            return prev.map(event => 
              event.id === id ? { ...event, ...updates } : event
            );
          }
          // Нет изменений - возвращаем тот же массив (не вызываем перерендер)
          return prev;
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
        // КРИТИЧЕСКИ ВАЖНО: Создаем дату в локальном часовом поясе, а не UTC
        const [year, month, day] = updates.date.split('-').map(Number);
        const [hours, minutes] = updates.time.split(':').map(Number);
        const start = new Date(year, month - 1, day, hours, minutes || 0, 0, 0);
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
      // КРИТИЧЕСКИ ВАЖНО: Создаем дату в локальном часовом поясе
      const [year, month, day] = eventToDelete.date.split('-').map(Number);
      const [hours, minutes] = eventToDelete.time.split(':').map(Number);
      const eventDate = new Date(year, month - 1, day, hours, minutes || 0, 0, 0);
      isPastEvent = new Date().getTime() > eventDate.getTime();
    }
    
    logger.info(`🗑️ Удаляем событие ${id} (${isPastEvent ? 'прошедшее' : 'будущее'})`);
    
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    // КРИТИЧЕСКИ ВАЖНО: Проверяем, является ли пользователь организатором
    // Если да - вызываем полное удаление события, если нет - удаление участия
    const isOrganizer = eventToDelete?.organizerId === actualUserId;
    
    let serverSuccess = false;
    let eventDeleted = false;
    
    if (actualToken && actualUserId) {
      try {
        // КРИТИЧЕСКИ ВАЖНО: Проверка на временные события - не делаем запрос к серверу
        if (id.includes('-temp') || id.startsWith('preview-')) {
          logger.debug('Temporary event, skipping deletion on server:', id);
          return;
        }
        
        // Если пользователь организатор - вызываем полное удаление события
        if (isOrganizer) {
          logger.info(`Пользователь является организатором - вызываем полное удаление события`);
          await apiRequest(`/events/${id}`, { method: 'DELETE' }, actualToken);
          logger.info(`✅ Событие полностью удалено с сервера (организатор)`);
          serverSuccess = true;
          eventDeleted = true;
        } else {
          // Если не организатор - вызываем удаление участия
          logger.info(`Пользователь не является организатором - вызываем удаление участия`);
          const response = await apiRequest(`/events/${id}/participation`, { method: 'DELETE' }, actualToken);
          logger.info(`✅ Участие удалено на сервере для события ${id}`, response);
          serverSuccess = true;
          
          // Проверяем, было ли событие полностью удалено (последний участник)
          if (response?.eventDeleted) {
            logger.info(`✅ Событие полностью удалено с сервера (был последний участник)`);
            eventDeleted = true;
          }
        }
      } catch (error) {
        // Обрабатываем ошибки удаления
        if (error instanceof ApiError) {
          // Если событие не найдено на сервере - это может быть нормально (уже удалено)
          if (error.status === 404 || error.message?.includes('not found') || error.message?.includes('Event not found')) {
            logger.warn(`⚠️ Событие ${id} не найдено на сервере, считаем удаление успешным`);
            serverSuccess = true;
            eventDeleted = true;
          } 
          // Для организатора ошибка "Only organizer can delete event" означает, что событие уже удалено или нет прав
          else if (error.status === 403 && error.message?.includes('Only organizer can delete event')) {
            logger.warn(`⚠️ Нет прав на удаление события ${id} (возможно, уже удалено)`);
            // Если пользователь организатор по локальным данным, но сервер говорит, что нет прав - событие уже удалено
            if (isOrganizer) {
              serverSuccess = true;
              eventDeleted = true;
            }
          }
          // Для прошедших событий ошибка "Membership not found" может быть нормальной (только для не-организаторов)
          else if (error.status === 400 && error.message?.includes('Membership not found') && !isOrganizer) {
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
            // Если это ошибка для организатора - все равно считаем событие удаленным из локального состояния
            if (isOrganizer) {
              logger.warn(`Ошибка при удалении события организатором, но удаляем из локального состояния`);
              serverSuccess = true;
              eventDeleted = true;
            }
          }
        } else {
          logger.warn(`Неизвестная ошибка при удалении на сервере для события ${id}:`, error);
          // Если это ошибка для организатора - все равно считаем событие удаленным из локального состояния
          if (isOrganizer) {
            logger.warn(`Неизвестная ошибка при удалении события организатором, но удаляем из локального состояния`);
            serverSuccess = true;
            eventDeleted = true;
          }
        }
      }
    }
    
    // КРИТИЧЕСКИ ВАЖНО: Если событие полностью удалено - удаляем из всех локальных состояний
    if (eventDeleted) {
      logger.info(`Событие полностью удалено - убираем из локального состояния`);
      
      // КРИТИЧЕСКИ ВАЖНО: Сохраняем ID удаленного события, чтобы не вернуть его при синхронизации
      const deletedEventId = id;
      
      // Помечаем событие как удаленное, чтобы оно не вернулось при синхронизации
      if (markEventAsDeleted) {
        markEventAsDeleted(deletedEventId);
      }
      
      setEvents(prev => prev.filter(e => e.id !== deletedEventId));
      setEventProfiles(prev => prev.filter(p => p.eventId !== deletedEventId));
      setEventRequests(prev => prev.filter(req => req.eventId !== deletedEventId));
      setChats(prev => prev.filter(c => c.eventId !== deletedEventId));
      
      // КРИТИЧЕСКИ ВАЖНО: Синхронизируем с сервером после удаления, но фильтруем удаленное событие
      // Это особенно важно для прошедших событий, которые могут быть загружены при следующей синхронизации
      if (syncEventsFromServer) {
        try {
          logger.info(`Синхронизируем события с сервером после удаления...`);
          await syncEventsFromServer();
          
          // КРИТИЧЕСКИ ВАЖНО: После синхронизации еще раз проверяем и удаляем событие, если оно вернулось
          // Это защита от race condition, когда синхронизация происходит до того, как сервер обработал удаление
          setEvents(prev => {
            const stillExists = prev.find(e => e.id === deletedEventId);
            if (stillExists) {
              logger.warn(`⚠️ Удаленное событие ${deletedEventId} вернулось после синхронизации, удаляем снова`);
              return prev.filter(e => e.id !== deletedEventId);
            }
            return prev;
          });
          
          setEventProfiles(prev => {
            const stillExists = prev.find(p => p.eventId === deletedEventId);
            if (stillExists) {
              logger.warn(`⚠️ Профиль удаленного события ${deletedEventId} вернулся после синхронизации, удаляем снова`);
              return prev.filter(p => p.eventId !== deletedEventId);
            }
            return prev;
          });
          
          logger.info(`✅ Синхронизация завершена, событие должно быть удалено`);
        } catch (syncError) {
          logger.warn(`Ошибка при синхронизации после удаления события, но событие уже удалено из локального состояния:`, syncError);
        }
      }
      
      return;
    }

    // Если удаление на сервере успешно, но событие не удалено полностью - обновляем локальное состояние
    if (serverSuccess) {
      logger.info(`Удаление на сервере успешно - обновляем локальное состояние`);
      
      // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий проверяем, остался ли пользователь участником/организатором
      // Если нет - удаляем событие из локального состояния, чтобы оно не попало в счетчики
      if (isPastEvent) {
        logger.info(`Прошедшее событие - проверяем, остался ли пользователь участником/организатором`);
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
              
              // КРИТИЧЕСКИ ВАЖНО: Проверяем, является ли пользователь еще участником или организатором
              const event = events.find(e => e.id === id);
              const isStillOrganizer = event?.organizerId === actualUserId;
              const isStillParticipant = updatedProfile.participants.includes(actualUserId || '');
              
              // Если пользователь больше не является ни организатором, ни участником - удаляем событие из локального состояния
              // Это нужно, чтобы событие не попало в счетчики профиля
              if (!isStillOrganizer && !isStillParticipant) {
                logger.info(`Пользователь больше не является ни организатором, ни участником - удаляем событие из локального состояния`);
                setEvents(prev => prev.filter(e => e.id !== id));
                setEventProfiles(prev => prev.filter(p => p.eventId !== id));
                setEventRequests(prev => prev.filter(req => req.eventId !== id));
                setChats(prev => prev.filter(c => c.eventId !== id));
                
                // Синхронизируем с сервером после удаления
                if (syncEventsFromServer) {
                  try {
                    await syncEventsFromServer();
                  } catch (syncError) {
                    logger.warn(`Ошибка при синхронизации после удаления события:`, syncError);
                  }
                }
                
                return;
              }
              
              // Пользователь все еще участник или организатор - оставляем событие, но обновляем запросы
              setEventRequests(prev => prev.filter(req => 
                !(req.eventId === id && req.status === 'accepted' && 
                  (req.fromUserId === actualUserId || req.toUserId === actualUserId))
              ));
            } else {
              // Профиль не найден - возможно событие удалено полностью, удаляем из локального состояния
              logger.warn(`Профиль не найден для события ${id} - удаляем событие из локального состояния`);
              setEvents(prev => prev.filter(e => e.id !== id));
              setEventProfiles(prev => prev.filter(p => p.eventId !== id));
              setEventRequests(prev => prev.filter(req => req.eventId !== id));
              setChats(prev => prev.filter(c => c.eventId !== id));
              return;
            }
          } catch (error) {
            logger.warn(`Не удалось обновить профиль с сервера:`, error);
            // При ошибке проверяем текущее состояние события
            const event = events.find(e => e.id === id);
            const isStillOrganizer = event?.organizerId === actualUserId;
            const isStillParticipant = event?.participantsList?.includes(actualUserId || '') || 
                                      event?.participantsData?.some((p: any) => {
                                        const pUserId = p.userId || p.id;
                                        return pUserId === actualUserId;
                                      });
            
            // Если пользователь больше не является ни организатором, ни участником - удаляем событие
            if (!isStillOrganizer && !isStillParticipant) {
              logger.info(`Пользователь больше не является участником (по локальным данным) - удаляем событие из локального состояния`);
              setEvents(prev => prev.filter(e => e.id !== id));
              setEventProfiles(prev => prev.filter(p => p.eventId !== id));
              setEventRequests(prev => prev.filter(req => req.eventId !== id));
              setChats(prev => prev.filter(c => c.eventId !== id));
              
              // Синхронизируем с сервером после удаления
              if (syncEventsFromServer) {
                try {
                  await syncEventsFromServer();
                } catch (syncError) {
                  logger.warn(`Ошибка при синхронизации после удаления события:`, syncError);
                }
              }
              
              return;
            }
          }
        }
        // КРИТИЧЕСКИ ВАЖНО: Удаляем чат события полностью, если пользователь больше не является членом события
        // Проверяем, является ли пользователь еще членом события после удаления
        const updatedEvent = events.find(e => e.id === id);
        const isStillMember = updatedEvent && (
          updatedEvent.organizerId === actualUserId ||
          updatedEvent.participantsList?.includes(actualUserId || '') ||
          updatedEvent.participantsData?.some((p: any) => {
            const pUserId = p.userId || p.id;
            return pUserId === actualUserId;
          })
        );
        
        if (!isStillMember) {
          // Пользователь больше не является членом события - удаляем чат полностью
          setChats(prev => prev.filter(chat => !(chat.eventId === id && chat.type === 'event')));
          logger.info('✅ Чат события удален, так как пользователь больше не является членом события:', { eventId: id, userId: actualUserId });
        } else {
          // Пользователь все еще член события - только удаляем из списка участников чата и обновляем счетчик
          setChats(prev => prev.map(chat => {
            if (chat.eventId === id && chat.participants?.includes(actualUserId || '')) {
              const updatedParticipants = chat.participants.filter((pid: string) => pid !== actualUserId);
              return {
                ...chat,
                participants: updatedParticipants
              };
            }
            return chat;
          }));
          logger.info('✅ Пользователь удален из участников чата, счетчик обновлен:', { eventId: id, userId: actualUserId });
        }
        return;
      } else {
        // Для будущих событий удаляем полностью
        logger.info(`Будущее событие - удаляем полностью из локального состояния`);
        setEvents(prev => prev.filter(e => e.id !== id));
        setEventRequests(prev => prev.filter(req => req.eventId !== id));
        setEventProfiles(prev => prev.filter(p => p.eventId !== id));
        setChats(prev => prev.filter(c => c.eventId !== id));
        return;
      }
    }

    // Если удаление на сервере не удалось - делаем локальное удаление (fallback)
    logger.warn(`Удаление на сервере не удалось, делаем локальное удаление`);
    setEvents(prev => prev.filter(e => e.id !== id));
    setEventProfiles(prev => prev.filter(p => p.eventId !== id));
    setEventRequests(prev => prev.filter(req => req.eventId !== id));
    setChats(prev => prev.filter(c => c.eventId !== id));
    
    // Синхронизируем с сервером после локального удаления
    if (syncEventsFromServer) {
      try {
        await syncEventsFromServer();
      } catch (syncError) {
        logger.warn(`Ошибка при синхронизации после локального удаления события:`, syncError);
      }
    }
  }, [accessToken, currentUserId, events, eventProfiles, isEventPast, fetchEventProfile, syncEventsFromServer, setEvents, setEventProfiles, setEventRequests, setChats]);

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
    
    if (participantsCount === 1) {
      // Организатор единственный участник - полная отмена события
      try {
        await apiRequest(
          `/events/${eventId}`,
          { method: 'DELETE' },
          actualToken,
        );
        
        // КРИТИЧЕСКИ ВАЖНО: Сразу удаляем событие из локального состояния
        // Это нужно для немедленного обновления UI, особенно счетчиков в шапке профиля
        // При отмене события (DELETE /events/:id) событие полностью удаляется с сервера,
        // поэтому мы должны удалить его из всех локальных состояний
        
        // КРИТИЧЕСКИ ВАЖНО: Помечаем событие как удаленное, чтобы оно не вернулось при синхронизации
        if (markEventAsDeleted) {
          markEventAsDeleted(eventId);
        }
        
        setEvents(prev => prev.filter(e => e.id !== eventId));
        setEventProfiles(prev => prev.filter(p => p.eventId !== eventId));
        setEventRequests(prev => prev.filter(req => req.eventId !== eventId));
        setChats(prev => prev.filter(c => c.eventId !== eventId));
        
        // Синхронизируем с сервером для обновления остальных данных
        if (syncEventsFromServer) {
          await syncEventsFromServer();
          
          // КРИТИЧЕСКИ ВАЖНО: После синхронизации еще раз проверяем и удаляем событие, если оно вернулось
          setEvents(prev => {
            const stillExists = prev.find(e => e.id === eventId);
            if (stillExists) {
              logger.warn(`⚠️ Отмененное событие ${eventId} вернулось после синхронизации, удаляем снова`);
              return prev.filter(e => e.id !== eventId);
            }
            return prev;
          });
          
          setEventProfiles(prev => {
            const stillExists = prev.find(p => p.eventId === eventId);
            if (stillExists) {
              logger.warn(`⚠️ Профиль отмененного события ${eventId} вернулся после синхронизации, удаляем снова`);
              return prev.filter(p => p.eventId !== eventId);
            }
            return prev;
          });
        }
        logger.info('✅ Событие отменено и удалено из локального состояния:', eventId);
      } catch (error) {
        logger.error('❌ Ошибка при отмене события:', error);
        throw error;
      }
    } else {
      // Организатор не единственный участник - показываем попап для передачи роли
      // Это обрабатывается в EventCard через модальное окно
      logger.warn('Cannot cancel event with multiple participants, use transfer organizer role instead');
      throw new Error('Для отмены участия передайте роль организатора другому участнику');
    }
  }, [accessToken, currentUserId, events, getEventParticipants, syncEventsFromServer, refreshPendingJoinRequests]);

  const transferOrganizerRole = useCallback(async (eventId: string, newOrganizerId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    if (!actualToken || !actualUserId) {
      logger.warn('Cannot transfer organizer role: no access');
      throw new Error('Необходима авторизация');
    }

    // Проверяем, что пользователь является организатором события
    const event = events.find(e => e.id === eventId);
    if (!event) {
      logger.warn('Cannot transfer organizer role: event not found', eventId);
      throw new Error('Событие не найдено');
    }

    if (event.organizerId !== actualUserId) {
      logger.warn('Cannot transfer organizer role: user is not organizer', {
        eventId,
        organizerId: event.organizerId,
        currentUserId: actualUserId
      });
      throw new Error('Только организатор события может передать роль');
    }

    try {
      const response = await apiRequest(
        `/events/${eventId}/transfer-organizer`,
        {
          method: 'POST',
          body: JSON.stringify({ newOrganizerId }),
        },
        actualToken,
      );
      
      logger.info('✅ Роль организатора передана:', { eventId, newOrganizerId });
      
      // МГНОВЕННОЕ ОБНОВЛЕНИЕ UI - обновляем состояние локально до синхронизации с сервером
      setEvents(prev => {
        // Удаляем событие из списка для старого организатора (actualUserId)
        // Старый организатор больше не должен видеть это событие в своем профиле
        const filtered = prev.filter(e => {
          if (e.id === eventId && e.organizerId === actualUserId) {
            // Удаляем событие для старого организатора
            return false;
          }
          return true;
        });
        
        // Обновляем organizerId события для нового организатора
        return filtered.map(e => {
          if (e.id === eventId) {
            return {
              ...e,
              organizerId: newOrganizerId,
            };
          }
          return e;
        });
      });
      
      // Обновляем профиль события - удаляем старого организатора из участников
      setEventProfiles(prev => prev.map(profile => {
        if (profile.eventId === eventId) {
          return {
            ...profile,
            participants: profile.participants.filter(pId => pId !== actualUserId),
          };
        }
        return profile;
      }));
      
      // Удаляем запросы на участие для старого организатора
      setEventRequests(prev => prev.filter(req => 
        !(req.eventId === eventId && (req.fromUserId === actualUserId || req.toUserId === actualUserId))
      ));
      
      // Удаляем чаты события для старого организатора
      setChats(prev => prev.filter(chat => 
        !(chat.eventId === eventId && chat.participants.includes(actualUserId))
      ));
      
      // Синхронизируем с сервером для обновления данных
      if (syncEventsFromServer) {
        await syncEventsFromServer();
      }
      if (refreshPendingJoinRequests) {
        await refreshPendingJoinRequests();
      }
    } catch (error) {
      logger.error('❌ Ошибка при передаче роли организатора:', error);
      throw error;
    }
  }, [accessToken, currentUserId, events, syncEventsFromServer, refreshPendingJoinRequests]);

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
    // cancelOrganizerParticipation больше не используется - вместо этого используется transferOrganizerRole
    // Оставляем для обратной совместимости, но перенаправляем на transferOrganizerRole
    logger.warn('cancelOrganizerParticipation is deprecated, use transferOrganizerRole instead');
    throw new Error('Используйте передачу роли организатора вместо отмены участия');

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
    transferOrganizerRole,
    removeParticipantFromEvent,
  };
}

