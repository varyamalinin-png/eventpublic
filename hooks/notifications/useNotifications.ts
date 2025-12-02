import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { apiRequest, ApiError } from '../../services/api';
import type { Notification } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('Notifications');

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadNotificationsCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}

export function useNotifications(
  accessToken: string | null,
  currentUserId: string | null,
  handleUnauthorizedError: (error: unknown) => Promise<boolean>
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const currentAccessTokenRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Обновляем refs при изменении токена или userId через useEffect для избежания побочных эффектов во время рендера
  useEffect(() => {
    currentAccessTokenRef.current = accessToken;
    currentUserIdRef.current = currentUserId;
  }, [accessToken, currentUserId]);

  const refreshNotifications = useCallback(async () => {
    // Используем актуальный токен из ref
    const actualToken = currentAccessTokenRef.current;
    const actualUserId = currentUserIdRef.current;
    
    if (!actualToken || !actualUserId) return;
    
    try {
      const response = await apiRequest(
        '/notifications?includeRead=true',
        { method: 'GET' },
        actualToken,
      );
      
      if (Array.isArray(response)) {
        const mappedNotifications: Notification[] = response.map((n: any) => ({
          id: n.id,
          userId: n.userId,
          type: n.type,
          payload: n.payload || {},
          readAt: n.readAt ? new Date(n.readAt) : null,
          createdAt: new Date(n.createdAt),
        }));
        
        const unreadCount = mappedNotifications.filter(n => !n.readAt).length;
        logger.debug(`Загружено уведомлений: ${mappedNotifications.length}, непрочитанных: ${unreadCount}`);
        
        setNotifications(mappedNotifications);
      }
    } catch (error) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      logger.warn('Failed to load notifications', error);
    }
  }, [handleUnauthorizedError]);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    const actualToken = currentAccessTokenRef.current;
    if (!actualToken) return;
    
    try {
      await apiRequest(
        `/notifications/${notificationId}/read`,
        { method: 'PATCH' },
        actualToken,
      );
      
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, readAt: new Date() } : n
        )
      );
    } catch (error) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      logger.warn('Failed to mark notification as read', error);
    }
  }, [handleUnauthorizedError]);

  const markAllNotificationsAsRead = useCallback(async () => {
    const actualToken = currentAccessTokenRef.current;
    if (!actualToken) return;
    
    try {
      logger.debug('Отмечаем все уведомления как прочитанные на сервере...');
      await apiRequest(
        '/notifications/read-all',
        { method: 'PATCH' },
        actualToken,
      );
      
      const now = new Date();
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, readAt: n.readAt || now }));
        const unreadCount = updated.filter(n => !n.readAt).length;
        logger.debug(`Все уведомления помечены как прочитанные, осталось непрочитанных: ${unreadCount}`);
        return updated;
      });
      
      // Перезагружаем уведомления с сервера для синхронизации
      setTimeout(() => {
        refreshNotifications().catch(error => {
          logger.warn('Не удалось перезагрузить уведомления после пометки всех как прочитанных:', error);
        });
      }, 500);
    } catch (error) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      logger.warn('Failed to mark all notifications as read', error);
    }
  }, [handleUnauthorizedError, refreshNotifications]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    const actualToken = currentAccessTokenRef.current;
    if (!actualToken) return;
    
    try {
      await apiRequest(
        `/notifications/${notificationId}`,
        { method: 'DELETE' },
        actualToken,
      );
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      logger.warn('Failed to delete notification', error);
    }
  }, [handleUnauthorizedError]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(n => !n.readAt).length;
  }, [notifications]);

  return {
    notifications,
    unreadNotificationsCount,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    setNotifications,
  };
}

