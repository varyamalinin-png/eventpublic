import { useState, useCallback, useEffect } from 'react';
import { apiRequest, ApiError, API_BASE_URL } from '../../services/api';
import type { EventFolder, CreateEventFolderDto, UpdateEventFolderDto } from '../../types/EventFolder';
import { createLogger } from '../../utils/logger';
import { File } from 'expo-file-system';

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

  const refreshFolders = useCallback(async () => {
    if (!accessToken || !currentUserId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/event-folders', {
        method: 'GET',
      }, accessToken);

      setFolders(Array.isArray(response) ? response : []);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return refreshFolders();
          }
        }
        setError(err.message);
      } else {
        setError('Failed to load folders');
        logger.error('Failed to refresh folders:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentUserId, refreshToken, handleUnauthorizedError, refreshSession]);

  useEffect(() => {
    refreshFolders();
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
        // React Native file object
        photoUri = data.coverPhoto.uri;
        photoType = data.coverPhoto.type || 'image/jpeg';
        photoName = data.coverPhoto.name || 'cover.jpg';

        // Для React Native проверяем существование файла
        const file = new File(photoUri);
        if (!file.exists) {
          throw new Error('Photo file not found');
        }

        // В React Native FormData принимает объект с uri, name, type
        formData.append('coverPhoto', {
          uri: photoUri,
          name: photoName,
          type: photoType,
        } as any);
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

        // Проверяем существование файла
        const file = new File(photoUri);
        if (!file.exists) {
          throw new Error('Photo file not found');
        }

        // В React Native FormData принимает объект с uri, name, type
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

      // Обновляем папку в списке
      await refreshFolders();
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
    if (!accessToken || !currentUserId) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await apiRequest(`/event-folders/${folderId}`, {
        method: 'GET',
      }, accessToken);

      return response as EventFolder;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          const handled = await handleUnauthorizedError(err);
          if (handled && refreshToken) {
            await refreshSession(refreshToken);
            return getFolderById(folderId);
          }
        }
        if (err.status === 404) {
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
