import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../services/api';
import { createLogger } from '../utils/logger';
import { getActiveChatId } from '../utils/activeChat';
import { openUserProfile } from '../utils/openUserProfile';

const logger = createLogger('Push');

/**
 * Пуш-уведомления.
 *
 * Токен берём НАТИВНЫЙ (getDevicePushTokenAsync), а не Expo-шный: пуши шлёт
 * наш собственный сервер прямо в APNs (см. server/src/notifications/apns.service.ts).
 * Expo-токен потребовал бы заведённого EAS-проекта и загрузки ключа Apple в
 * сервис Expo — при том, что сборки делаются локально в Xcode.
 *
 * Разрешение спрашиваем не при первом запуске, а после входа: у системного
 * диалога одна попытка на установку, и просить его у человека, который ещё
 * не знает, что за приложение перед ним, — верный способ получить «нет».
 */
export function usePushNotifications() {
  const { accessToken, user } = useAuth();
  const { language } = useLanguage();
  const registeredForRef = useRef<string | null>(null);
  // Для перехода по тапу: слушатель ставится один раз, а id нужен актуальный.
  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = user?.id ?? null;

  // Регистрация токена
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!accessToken || !user?.id) return;
    // Один раз на аккаунт: токен устройства не меняется между рендерами.
    if (registeredForRef.current === user.id) return;
    registeredForRef.current = user.id;

    (async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          const asked = await Notifications.requestPermissionsAsync();
          status = asked.status;
        }
        if (status !== 'granted') {
          logger.debug('Разрешение на уведомления не выдано');
          return;
        }

        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        await apiRequest(
          '/users/me/push-token',
          {
            method: 'POST',
            body: JSON.stringify({
              token: devicePushToken.data,
              platform: Platform.OS,
              language,
            }),
          },
          accessToken,
        );
        logger.debug('Токен устройства зарегистрирован');
      } catch (error) {
        // Отсутствие пушей не повод ломать вход — просто логируем.
        logger.warn('Не удалось зарегистрировать токен устройства', error);
        registeredForRef.current = null;
      }
    })();
  }, [accessToken, user?.id, language]);

  // Переход по тапу на уведомление
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // Свои поля сервер кладёт в корень payload рядом с aps; expo отдаёт их
        // то в content.data, то только в trigger.payload — берём из обоих.
        const content: any = response.notification.request.content.data || {};
        const payload: any = (response.notification.request.trigger as any)?.payload || {};
        const type = content.type ?? payload.type;
        const chatId = content.chatId ?? payload.chatId;
        const eventId = content.eventId ?? payload.eventId;
        const postId = content.postId ?? payload.postId;
        const actorId = content.actorId ?? payload.actorId;
        try {
          if (type === 'MESSAGE' && chatId) {
            // Пуш о сообщении — сразу в переписку, а не в общий список.
            router.push(`/inbox/${chatId}`);
          } else if ((type === 'EVENT_POST_LIKED' || type === 'EVENT_POST_COMMENTED') && eventId && postId) {
            // Лайк или комментарий — к самой публикации.
            router.push(`/memory-post/${eventId}/${postId}`);
          } else if (type === 'FRIEND_REQUEST_ACCEPTED' && actorId) {
            openUserProfile(actorId, currentUserIdRef.current);
          } else if (eventId) {
            router.push(`/event-profile/${eventId}`);
          } else {
            router.push('/inbox');
          }
        } catch (error) {
          logger.warn('Не удалось открыть экран по уведомлению', error);
        }
      },
    );

    return () => subscription.remove();
  }, []);
}

/**
 * Как показывать уведомление, когда приложение открыто.
 *
 * Вызывается на уровне модуля один раз — expo-notifications хранит обработчик
 * глобально, а не по компоненту.
 */
/**
 * Сообщение из чата, который сейчас открыт, баннером не показываем — человек
 * и так видит его в переписке. Свои поля (type, chatId) сервер кладёт в корень
 * payload рядом с aps; expo отдаёт их то в content.data, то только в
 * trigger.payload — смотрим оба места.
 */
function isMessageForActiveChat(notification: Notifications.Notification): boolean {
  const activeChatId = getActiveChatId();
  if (!activeChatId) return false;
  const data: any = notification.request.content.data || {};
  const payload: any = (notification.request.trigger as any)?.payload || {};
  const type = data.type ?? payload.type;
  const chatId = data.chatId ?? payload.chatId;
  return type === 'MESSAGE' && chatId === activeChatId;
}

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    if (isMessageForActiveChat(notification)) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});
