import { useState, useCallback, useRef, useEffect } from 'react';
import type { UserFolder } from '../../types/User';
import type { Event } from '../../types';
import type { ServerUser, ServerUserFolder } from '../../types/api';
import { apiRequest, ApiError } from '../../services/api';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useUserFolders');

export interface UseUserFoldersParams {
  accessToken: string | null;
  currentUserId: string | null;
  events: Event[];
  applyServerUserDataToState: (user: ServerUser) => void;
  handleUnauthorizedError: (error: unknown) => Promise<boolean>;
}

export interface UseUserFoldersReturn {
  userFolders: UserFolder[];
  setUserFolders: React.Dispatch<React.SetStateAction<UserFolder[]>>;
  syncUserFoldersFromServer: () => Promise<void>;
  addUserToFolder: (userId: string, folderId: string) => Promise<void>;
  removeUserFromFolder: (userId: string, folderId: string) => Promise<void>;
  createUserFolder: (name: string) => Promise<void>;
  deleteUserFolder: (folderId: string) => Promise<void>;
  getEventsByUserFolder: (folderId: string) => Event[];
}

export const useUserFolders = ({
  accessToken,
  currentUserId,
  events,
  applyServerUserDataToState,
  handleUnauthorizedError,
}: UseUserFoldersParams): UseUserFoldersReturn => {
  const [userFolders, setUserFolders] = useState<UserFolder[]>([]);
  const currentAccessTokenRef = useRef<string | null>(accessToken);
  const currentUserIdRef = useRef<string | null>(currentUserId);

  // Обновляем refs при изменении токена и userId через useEffect
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
    currentUserIdRef.current = currentUserId;
  }, [accessToken, currentUserId]);

  // Синхронизация папок пользователей с сервера
  const syncUserFoldersFromServer = useCallback(async () => {
    // Используем актуальный токен из ref
    const actualToken = currentAccessTokenRef.current;
    if (!actualToken) return;
    
    try {
      const response = await apiRequest('/user-folders', {}, actualToken);
      if (Array.isArray(response)) {
        // Применяем данные пользователей из папок
        response.forEach((folder: ServerUserFolder) => {
          const userIds = folder.userIds || [];
          if (Array.isArray(userIds)) {
            userIds.forEach((item) => {
              if (typeof item === 'object' && item !== null && 'user' in item && item.user) {
                applyServerUserDataToState(item.user as ServerUser);
              }
            });
          }
        });
        // Маппим папки пользователей
        const mapped = response.map((folder: ServerUserFolder): UserFolder => ({
          id: folder.id || '',
          name: folder.name || '',
          userIds: (Array.isArray(folder.userIds) ? folder.userIds : []).map((item) => {
            if (typeof item === 'string') return item;
            return (item as { userId?: string; user?: { id?: string } }).userId || (item as { user?: { id?: string } }).user?.id;
          }).filter(Boolean) as string[],
        }));
        setUserFolders(mapped);
      }
    } catch (error) {
      // Проверяем только 401/403 - другие ошибки (500, 404 и т.д.) не должны вызывать logout
      // Важно: НЕ вызываем handleUnauthorizedError для ошибок 500, так как это может привести к logout
      if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403) {
          // Только для 401/403 вызываем handleUnauthorizedError
          if (await handleUnauthorizedError(error)) {
            return;
          }
        } else {
          // Для всех остальных ошибок (500, 404 и т.д.) просто логируем
          logger.warn(`Failed to load user folders: ${error.status} ${error.message}`);
          // НЕ очищаем userFolders при ошибке - сохраняем текущее состояние
          // НЕ вызываем logout - это не ошибка авторизации
        }
      } else {
        // Для не-ApiError ошибок просто логируем
        logger.warn('Failed to load user folders (non-API error):', error);
      }
    }
  }, [applyServerUserDataToState, handleUnauthorizedError]);

  // Добавить пользователя в папку
  const addUserToFolder = useCallback(async (userId: string, folderId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      // Fallback: обновляем локально
      setUserFolders(prev => prev.map(folder => 
        folder.id === folderId 
          ? { ...folder, userIds: [...folder.userIds.filter(id => id !== userId), userId] }
          : folder
      ));
      return;
    }

    try {
      await apiRequest(
        `/user-folders/${folderId}/users/${userId}`,
        { method: 'POST' },
        actualToken,
      );
      // Синхронизируем папки после успешного добавления (игнорируем ошибки синхронизации)
      try {
        await syncUserFoldersFromServer();
      } catch (syncError) {
        logger.warn('Failed to sync user folders after add, but operation succeeded', syncError);
      }
    } catch (error) {
      logger.error('Failed to add user to folder', error);
      // Fallback: обновляем локально при ошибке
      setUserFolders(prev => prev.map(folder => 
        folder.id === folderId 
          ? { ...folder, userIds: [...folder.userIds.filter(id => id !== userId), userId] }
          : folder
      ));
    }
  }, [accessToken, currentUserId, syncUserFoldersFromServer]);

  // Удалить пользователя из папки
  const removeUserFromFolder = useCallback(async (userId: string, folderId: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      // Fallback: обновляем локально
      setUserFolders(prev => prev.map(folder => 
        folder.id === folderId 
          ? { ...folder, userIds: folder.userIds.filter(id => id !== userId) }
          : folder
      ));
      return;
    }

    try {
      await apiRequest(
        `/user-folders/${folderId}/users/${userId}`,
        { method: 'DELETE' },
        actualToken,
      );
      // Синхронизируем папки после успешного удаления (игнорируем ошибки синхронизации)
      try {
        await syncUserFoldersFromServer();
      } catch (syncError) {
        logger.warn('Failed to sync user folders after remove, but operation succeeded', syncError);
      }
    } catch (error) {
      logger.error('Failed to remove user from folder', error);
      // Fallback: обновляем локально при ошибке
      setUserFolders(prev => prev.map(folder => 
        folder.id === folderId 
          ? { ...folder, userIds: folder.userIds.filter(id => id !== userId) }
          : folder
      ));
    }
  }, [syncUserFoldersFromServer]);

  // Создать папку пользователя
  const createUserFolder = useCallback(async (name: string) => {
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    if (!actualToken || !actualUserId) {
      // Fallback: создаем локально
      const newFolder: UserFolder = {
        id: Date.now().toString(),
        name: name.trim(),
        userIds: []
      };
      setUserFolders(prev => [...prev, newFolder]);
      return;
    }

    try {
      const response = await apiRequest(
        '/user-folders',
        {
          method: 'POST',
          body: JSON.stringify({ name: name.trim() }),
        },
        actualToken,
      );

      if (response) {
        const newFolder: UserFolder = {
          id: response.id,
          name: response.name,
          userIds: (response.userIds || []).map((item: any) => item.userId || item.user?.id).filter(Boolean),
        };
        setUserFolders(prev => [...prev, newFolder]);
      }
    } catch (error) {
      logger.error('Failed to create user folder', error);
      // Fallback: создаем локально при ошибке
      const newFolder: UserFolder = {
        id: Date.now().toString(),
        name: name.trim(),
        userIds: []
      };
      setUserFolders(prev => [...prev, newFolder]);
    }
  }, [accessToken, currentUserId]);

  // Удалить папку пользователя
  const deleteUserFolder = useCallback(async (folderId: string) => {
    if (!accessToken || !currentUserId) {
      // Fallback: удаляем локально
      setUserFolders(prev => prev.filter(folder => folder.id !== folderId));
      return;
    }

    try {
      await apiRequest(
        `/user-folders/${folderId}`,
        { method: 'DELETE' },
        actualToken,
      );
      // Синхронизируем папки после успешного удаления (игнорируем ошибки синхронизации)
      try {
        await syncUserFoldersFromServer();
      } catch (syncError) {
        logger.warn('Failed to sync user folders after delete, but operation succeeded', syncError);
      }
    } catch (error) {
      logger.error('Failed to delete user folder', error);
      // Fallback: удаляем локально при ошибке
      setUserFolders(prev => prev.filter(folder => folder.id !== folderId));
    }
  }, [accessToken, currentUserId, syncUserFoldersFromServer]);

  // Получить события по папке пользователя
  const getEventsByUserFolder = useCallback((folderId: string): Event[] => {
    const folder = userFolders.find(f => f.id === folderId);
    if (!folder) return [];
    
    return events.filter(event => 
      folder.userIds.includes(event.organizerId)
    );
  }, [userFolders, events]);

  return {
    userFolders,
    setUserFolders,
    syncUserFoldersFromServer,
    addUserToFolder,
    removeUserFromFolder,
    createUserFolder,
    deleteUserFolder,
    getEventsByUserFolder,
  };
};

