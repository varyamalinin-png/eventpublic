import { useState, useCallback, useEffect, useRef } from 'react';
import { apiRequest, ApiError, API_BASE_URL } from '../../services/api';
import type { EventFolder, CreateEventFolderDto, UpdateEventFolderDto } from '../../types/EventFolder';
import { createLogger } from '../../utils/logger';
import * as FileSystem from 'expo-file-system/legacy';

const logger = createLogger('EventFolders');

export interface UseEventFoldersParams {
  accessToken: string | null;
  currentUserId: string | null;
  refreshToken: string | null;
  handleUnauthorizedError: (error: unknown) => Promise<boolean>;
  refreshSession: (refreshToken: string) => Promise<void>;
}

export interface UseEventFoldersReturn {
  folders: EventFolder[];
  loading: boolean;
  error: string | null;
  createFolder: (data: CreateEventFolderDto) => Promise<EventFolder | null>;
  updateFolder: (folderId: string, data: UpdateEventFolderDto) => Promise<EventFolder | null>;
  deleteFolder: (folderId: string) => Promise<void>;
  addEventToFolder: (folderId: string, eventId: string) => Promise<void>;
  removeEventFromFolder: (folderId: string, eventId: string) => Promise<void>;
  getFolderById: (folderId: string) => Promise<EventFolder | null>;
  refreshFolders: () => Promise<void>;
}

export function useEventFolders({
  accessToken,
  currentUserId,
  refreshToken,
  handleUnauthorizedError,
  refreshSession,
}: UseEventFoldersParams): UseEventFoldersReturn {
  const [folders, setFolders] = useState<EventFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRetryCount = useRef(0);

  const refreshFolders = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken || !currentUserId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/event-folders', {
        method: 'GET',
        signal,
      }, accessToken);

      if (signal?.aborted) return;
      refreshRetryCount.current = 0;
      setFolders(Array.isArray(response) ? response : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (signal?.aborted) return;
      if (err instanceof ApiError) {
        if (err.status === 401 && refreshRetryCount.current < 2) {
          refreshRetryCount.current++;
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return refreshFolders(signal);
          }
        }
        setError(err.message);
      } else {
        setError('Failed to load folders');
        logger.error('Failed to refresh folders:', err);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [accessToken, currentUserId, refreshToken, handleUnauthorizedError, refreshSession]);

  useEffect(() => {
    const controller = new AbortController();
    refreshFolders(controller.signal);
    return () => controller.abort();
  }, [refreshFolders]);

  const createFolder = useCallback(async (data: CreateEventFolderDto): Promise<EventFolder | null> => {
    if (!accessToken || !currentUserId) {
      logger.error('Not authenticated', { accessToken: !!accessToken, currentUserId: !!currentUserId });
      throw new Error('Not authenticated');
    }

    try {
      logger.debug('Creating folder', { name: data.name, hasDescription: !!data.description, hasCoverPhoto: !!data.coverPhoto });
      
      // Если нет файла, отправляем JSON через apiRequest
      // Если есть файл, используем FormData через прямой fetch
      if (!data.coverPhoto) {
        logger.debug('No cover photo, sending JSON request');
        const response = await apiRequest('/event-folders', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            description: data.description,
          }),
        }, accessToken);

        logger.debug('Folder created successfully', { response });
        const newFolder = response as EventFolder;
        setFolders(prev => [newFolder, ...prev]);
        return newFolder;
      }

      // Если есть файл, используем FormData
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.description) {
        formData.append('description', data.description);
      }

      let photoUri: string;
      let photoType: string;
      let photoName: string;

      if (data.coverPhoto instanceof File) {
        // Web File object
        formData.append('coverPhoto', data.coverPhoto);
      } else if (typeof data.coverPhoto === 'object' && 'uri' in data.coverPhoto) {
        // Проверяем, есть ли File объект в coverPhoto (для веба)
        const coverPhotoWithFile = data.coverPhoto as any;
        if (coverPhotoWithFile.file instanceof File) {
          // На вебе используем сохраненный File объект
          formData.append('coverPhoto', coverPhotoWithFile.file);
        } else {
          // React Native file object
          photoUri = data.coverPhoto.uri;
          photoType = data.coverPhoto.type || 'image/jpeg';
          photoName = data.coverPhoto.name || 'cover.jpg';

          // КРИТИЧЕСКИ ВАЖНО: В React Native НЕ используем new File()
          // FormData принимает объект с uri, name, type напрямую
          // В React Native FormData принимает объект с uri, name, type
          formData.append('coverPhoto', {
            uri: photoUri,
            name: photoName,
            type: photoType,
          } as any);
        }
      } else {
        throw new Error('Invalid cover photo format');
      }

      logger.debug('Sending FormData request to /event-folders');
      
      // Используем прямой fetch для FormData, как в других местах кода (settings.tsx, useEventProfiles.ts)
      // Это необходимо для правильной работы с FormData в React Native
      const uploadResponse = await fetch(`${API_BASE_URL}/event-folders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
          : 'Failed to create folder';
        throw new ApiError(errorMessage, uploadResponse.status, errorBody);
      }

      const response = await uploadResponse.json();
      logger.debug('Folder created successfully', { response });
      const newFolder = response as EventFolder;
      setFolders(prev => [newFolder, ...prev]);
      return newFolder;
    } catch (err) {
      if (err instanceof ApiError) {
        logger.error('API error creating folder', { status: err.status, message: err.message });
        if (err.status === 401) {
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return createFolder(data);
          }
        }
        throw err;
      }
      logger.error('Failed to create folder:', err);
      throw err;
    }
  }, [accessToken, currentUserId, refreshToken, handleUnauthorizedError, refreshSession]);

  const updateFolder = useCallback(async (folderId: string, data: UpdateEventFolderDto): Promise<EventFolder | null> => {
    if (!accessToken || !currentUserId) {
      throw new Error('Not authenticated');
    }

    try {
      // Если нет файла, отправляем JSON через apiRequest
      // Если есть файл, используем FormData через прямой fetch
      if (!data.coverPhoto) {
        logger.debug('No cover photo, sending JSON update request');
        const response = await apiRequest(`/event-folders/${folderId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: data.name,
            description: data.description,
          }),
        }, accessToken);

        const updatedFolder = response as EventFolder;
        setFolders(prev => prev.map(f => f.id === folderId ? updatedFolder : f));
        return updatedFolder;
      }

      // Если есть файл, используем FormData
      const formData = new FormData();

      if (data.name) {
        formData.append('name', data.name);
      }
      if (data.description !== undefined) {
        formData.append('description', data.description || '');
      }

      let photoUri: string;
      let photoType: string;
      let photoName: string;

      if (data.coverPhoto instanceof File) {
        formData.append('coverPhoto', data.coverPhoto);
      } else if (typeof data.coverPhoto === 'object' && 'uri' in data.coverPhoto) {
        photoUri = data.coverPhoto.uri;
        photoType = data.coverPhoto.type || 'image/jpeg';
        photoName = data.coverPhoto.name || 'cover.jpg';

        // КРИТИЧЕСКИ ВАЖНО: В React Native НЕ используем new File()
        // FormData принимает объект с uri, name, type напрямую
        // Проверку существования файла можно сделать через FileSystem.getInfoAsync, но для простоты пропускаем
        formData.append('coverPhoto', {
          uri: photoUri,
          name: photoName,
          type: photoType,
        } as any);
      } else {
        throw new Error('Invalid cover photo format');
      }

      logger.debug('Sending FormData update request to /event-folders/' + folderId);
      
      // Используем прямой fetch для FormData, как в других местах кода
      const uploadResponse = await fetch(`${API_BASE_URL}/event-folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
          : 'Failed to update folder';
        throw new ApiError(errorMessage, uploadResponse.status, errorBody);
      }

      const response = await uploadResponse.json();
      const updatedFolder = response as EventFolder;
      setFolders(prev => prev.map(f => f.id === folderId ? updatedFolder : f));
      return updatedFolder;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return updateFolder(folderId, data);
          }
        }
        throw err;
      }
      logger.error('Failed to update folder:', err);
      throw err;
    }
  }, [accessToken, currentUserId, refreshToken, handleUnauthorizedError, refreshSession]);

  const deleteFolder = useCallback(async (folderId: string): Promise<void> => {
    if (!accessToken || !currentUserId) {
      throw new Error('Not authenticated');
    }

    try {
      await apiRequest(`/event-folders/${folderId}`, {
        method: 'DELETE',
      }, accessToken);

      setFolders(prev => prev.filter(f => f.id !== folderId));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return deleteFolder(folderId);
          }
        }
        throw err;
      }
      logger.error('Failed to delete folder:', err);
      throw err;
    }
  }, [accessToken, currentUserId, refreshToken, handleUnauthorizedError, refreshSession]);

  const addEventToFolder = useCallback(async (folderId: string, eventId: string): Promise<void> => {
    if (!accessToken || !currentUserId) {
      throw new Error('Not authenticated');
    }

    try {
      await apiRequest(`/event-folders/${folderId}/events/${eventId}`, {
        method: 'POST',
      }, accessToken);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return addEventToFolder(folderId, eventId);
          }
        }
        throw err;
      }
      logger.error('Failed to add event to folder:', err);
      throw err;
    }
  }, [accessToken, currentUserId, refreshToken, handleUnauthorizedError, refreshSession, refreshFolders]);

  const removeEventFromFolder = useCallback(async (folderId: string, eventId: string): Promise<void> => {
    if (!accessToken || !currentUserId) {
      throw new Error('Not authenticated');
    }

    try {
      await apiRequest(`/event-folders/${folderId}/events/${eventId}`, {
        method: 'DELETE',
      }, accessToken);

      // Обновляем папку в списке
      await refreshFolders();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return removeEventFromFolder(folderId, eventId);
          }
        }
        throw err;
      }
      logger.error('Failed to remove event from folder:', err);
      throw err;
    }
  }, [accessToken, currentUserId, refreshToken, handleUnauthorizedError, refreshSession, refreshFolders]);

  const getFolderById = useCallback(async (folderId: string): Promise<EventFolder | null> => {
    logger.debug('getFolderById called', { folderId, hasAccessToken: !!accessToken, hasCurrentUserId: !!currentUserId });
    
    if (!accessToken || !currentUserId) {
      logger.error('getFolderById: Not authenticated', { hasAccessToken: !!accessToken, hasCurrentUserId: !!currentUserId });
      throw new Error('Not authenticated');
    }

    try {
      logger.debug('getFolderById: Making API request', { endpoint: `/event-folders/${folderId}` });
      const response = await apiRequest(`/event-folders/${folderId}`, {
        method: 'GET',
      }, accessToken);

      logger.debug('getFolderById: API response received', { 
        hasResponse: !!response,
        folderId: (response as any)?.id,
        folderName: (response as any)?.name
      });
      return response as EventFolder;
    } catch (err) {
      logger.error('getFolderById: API error', { 
        error: err instanceof Error ? err.message : String(err),
        status: err instanceof ApiError ? err.status : undefined,
        folderId 
      });
      
      if (err instanceof ApiError) {
        if (err.status === 401) {
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return getFolderById(folderId);
          }
        }
        if (err.status === 404) {
          logger.warn('getFolderById: Folder not found (404)', { folderId });
          return null;
        }
        throw err;
      }
      logger.error('Failed to get folder:', err);
      throw err;
    }
  }, [accessToken, currentUserId, refreshToken, handleUnauthorizedError, refreshSession]);

  return {
    folders,
    loading,
    error,
    createFolder,
    updateFolder,
    deleteFolder,
    addEventToFolder,
    removeEventFromFolder,
    getFolderById,
    refreshFolders,
  };
}
