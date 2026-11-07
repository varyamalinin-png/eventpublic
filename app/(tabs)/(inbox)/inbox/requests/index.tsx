import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import TopBar from '../../../../../components/TopBar';
import RequestsList from '../../../../../components/RequestsList';
import RequestItem from '../../../../../components/RequestItem';
import NotificationItem from '../../../../../components/NotificationItem';
import { useEvents } from '../../../../../context/EventsContext';
import { openUserProfile } from '../../../../../utils/openUserProfile';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../../../context/AuthContext';
import { useLanguage } from '../../../../../context/LanguageContext';
import { createLogger } from '../../../../../utils/logger';
import { TabBarSpacer } from '../../../../../constants/DesignSystem';
import { apiRequest } from '../../../../../services/api';

const logger = createLogger('RequestsTab');

/** Сколько уведомлений держим на экране до первого доскролла. */
const NOTIFICATIONS_PAGE = 15;

type RequestsTabProps = {
  /** Какую подвкладку открыть, когда экран показан внутри инбокса. */
  initialTab?: 'incoming' | 'outgoing';
};

/**
 * Свежие сверху. Дата у самой записи списка не хранится — берём её из
 * исходной заявки (в друзья или на событие) по совпадению id.
 */
function sortByCreatedAtDesc<T extends { id: string }>(
  items: T[],
  friendRequests: Array<{ id: string; createdAt?: Date | string }>,
  eventRequests: Array<{ id: string; createdAt?: Date | string }>,
): T[] {
  const timeOf = (id: string) => {
    const source =
      friendRequests.find(r => r.id === id) || eventRequests.find(r => r.id === id);
    if (!source?.createdAt) return 0;
    const date = source.createdAt instanceof Date ? source.createdAt : new Date(source.createdAt);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };
  return [...items].sort((a, b) => timeOf(b.id) - timeOf(a.id));
}

export default function RequestsTab({ initialTab }: RequestsTabProps = {}) {
  const router = useRouter();
  const { t } = useLanguage();
  const { 
    friendRequests, 
    eventRequests, 
    respondToFriendRequest, 
    respondToEventRequest, 
    events, 
    getMyEventRequests, 
    getEventOrganizer, 
    isEventUpcoming, 
    isUserOrganizer, 
    isUserEventMember, 
    getUserRequestStatus, 
    getUserFriendsList,
    getUserData,
    notifications,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    syncEventsFromServer,
    syncFriendRequestsFromServer,
  } = useEvents();
  const { user: authUser, accessToken } = useAuth();
  // Вкладку можно задать при переходе: ?tab=outgoing открывает «Исходящие».
  // Раньше пункт «Мои запросы» вёл просто на /inbox — то есть в общий список
  // чатов, а не на исходящие запросы.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  // initialTab приходит, когда экран показан ВНУТРИ инбокса: там параметры
  // маршрута принадлежат /inbox, а не этому экрану.
  const startTab = initialTab ?? (tab === 'outgoing' ? 'outgoing' : undefined);
  const [showMyRequests, setShowMyRequests] = useState(startTab === 'outgoing');

  useEffect(() => {
    if (startTab === 'outgoing') setShowMyRequests(true);
    if (tab === 'incoming') setShowMyRequests(false);
  }, [startTab, tab]);

  /**
   * Лента рисуется порциями.
   *
   * Список лежит в ScrollView и раскрывается через .map() — то есть КАЖДАЯ
   * строка монтируется сразу, вместе с аватаркой и обложкой события. Пока
   * уведомлений было десяток, это не мешало; на сотне это две сотни картинок,
   * которые декодируются разом, и экран начинает заметно тормозить.
   *
   * Виртуализация тут не подходит: под лентой на том же экране ещё два списка,
   * а вложенный FlatList внутри ScrollView как раз и ломает виртуализацию.
   * Поэтому просто держим на экране первые PAGE строк и добавляем следующие,
   * когда человек доскроллил до низа.
   */
  const [visibleCount, setVisibleCount] = useState(NOTIFICATIONS_PAGE);

  // Повторный тап по разделу — к началу списка.
  const notificationsScrollRef = useRef<ScrollView>(null);
  useScrollToTop(notificationsScrollRef);

  useEffect(() => { setVisibleCount(NOTIFICATIONS_PAGE); }, [showMyRequests]);
  const currentUserId = authUser?.id ?? null;

  const hasVisitedIncomingRef = useRef(false);
  const visibleNotificationsRef = useRef<Set<string>>(new Set());

  // Загружаем уведомления при монтировании
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  /**
   * Уведомления во «Входящих».
   *
   * В списке типов не хватало FRIEND_REQUEST и EVENT_ORGANIZER_TRANSFERRED —
   * такие уведомления приходили с сервера, но на экран не попадали вовсе.
   * Именно поэтому заявка в друзья нигде не показывалась.
   *
   * Сортировка: свежие сверху. Порядок с сервера не гарантирован, а без явной
   * сортировки уведомление четырёхминутной давности оказывалось ниже
   * трёхнедельного.
   */
  const eventNotifications = useMemo(() => {
    const VISIBLE_TYPES = [
      'EVENT_CANCELLED',
      'EVENT_UPDATED',
      'EVENT_PARTICIPANT_JOINED',
      'EVENT_PARTICIPANT_LEFT',
      'EVENT_POST_ADDED',
      'EVENT_JOIN_REQUEST',
      'EVENT_REQUEST_ACCEPTED',
      'EVENT_ORGANIZER_TRANSFERRED',
      'FRIEND_REQUEST',
      'EVENT_INVITE',
      'FRIEND_REQUEST_ACCEPTED',
      'EVENT_INVITE_DECLINED',
      'EVENT_POST_LIKED',
      'EVENT_POST_COMMENTED',
    ];
    const time = (value: any) => {
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };
    return notifications
      .filter(n => VISIBLE_TYPES.includes(n.type))
      .sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }, [notifications]);

  // Отмечаем уведомления как прочитанные при выходе со страницы
  /**
   * Заявки перечитываем при каждом открытии раздела.
   *
   * Кнопки «принять/отклонить» на уведомлении привязаны к ЖИВОЙ заявке, а
   * список заявок наполнялся только при старте приложения. Заявка, пришедшая
   * позже, доезжала до ленты уведомлением (сокет), но самой заявки в списке не
   * было — и строка оставалась с одним крестиком. Со стороны это выглядело как
   * «кнопки пропали»: уведомление есть, ответить нечем.
   *
   * Функции держим в ref: они меняют ссылку при каждом обновлении сессии, и в
   * зависимостях превращали бы эффект в цикл запросов.
   */
  const syncRequestsRef = useRef(syncFriendRequestsFromServer);
  syncRequestsRef.current = syncFriendRequestsFromServer;
  const syncEventsRef = useRef(syncEventsFromServer);
  syncEventsRef.current = syncEventsFromServer;
  // И сами уведомления: они приходят сокетом, но пропущенное событие (фон, обрыв
  // связи) означало, что новая строка не появится до перезапуска приложения.
  const refreshNotificationsRef = useRef(refreshNotifications);
  refreshNotificationsRef.current = refreshNotifications;

  // Потянуть список вниз — то же обновление, что и при входе на экран.
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        syncRequestsRef.current?.().catch(() => undefined),
        syncEventsRef.current?.().catch(() => undefined),
        refreshNotificationsRef.current?.().catch(() => undefined),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      syncRequestsRef.current?.().catch(() => undefined);
      // События тянем ради членств: заявки на участие живут в них.
      syncEventsRef.current?.().catch(() => undefined);
      refreshNotificationsRef.current?.().catch(() => undefined);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      // При входе на страницу отмечаем, что пользователь зашел на вкладку "Входящие"
      if (!showMyRequests) {
        hasVisitedIncomingRef.current = true;
      }
      visibleNotificationsRef.current.clear();
      
      return () => {
        // При выходе со страницы отмечаем все непрочитанные уведомления как прочитанные
        // если пользователь был на вкладке "Входящие"
        if (hasVisitedIncomingRef.current && !showMyRequests) {
          const unreadNotifications = eventNotifications.filter(n => !n.readAt);
          if (unreadNotifications.length > 0) {
            logger.debug('Marking notifications as read on tab exit', { count: unreadNotifications.length });
            // Используем markAllNotificationsAsRead для более эффективной обработки
            markAllNotificationsAsRead();
          }
        }
      };
    }, [showMyRequests, eventNotifications, markAllNotificationsAsRead])
  );

  // Обработка запросов
  const handleAcceptRequest = (requestId: string) => {
    // Находим тип запроса
    const friendReq = friendRequests.find(req => req.id === requestId);
    const eventReq = eventRequests.find(req => req.id === requestId);
    
    if (friendReq) {
      respondToFriendRequest(requestId, true);
    } else if (eventReq) {
      // Для приглашений (invite) — НЕ принимаем сразу.
      // Открываем календарь в режиме preview, подтверждение внутри календаря.
      if (eventReq.type === 'invite') {
        const event = events.find(e => e.id === eventReq.eventId);
        if (event) {
          const isoDateTime = `${event.date}T${event.time}:00`;
          router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${event.id}&inviteId=${requestId}`);
          return;
        }
        // если событие не найдено, на всякий случай просто откроем календарь
        router.push('/calendar');
      } else {
        // Для обычных запросов - просто принимаем
        respondToEventRequest(requestId, true);
      }
    }
  };

  const handleDeclineRequest = (requestId: string) => {
    const friendReq = friendRequests.find(req => req.id === requestId);
    const eventReq = eventRequests.find(req => req.id === requestId);
    
    if (friendReq) {
      respondToFriendRequest(requestId, false);
    } else if (eventReq) {
      respondToEventRequest(requestId, false);
    }
  };

  // Обработка клика по мини-карточке запроса
  const handleRequestPress = (request: any) => {
    if (request.type === 'event' && request.eventId) {
      // Переходим в аккаунт события
      router.push(`/event-profile/${request.eventId}`);
    } else if (request.type === 'friend' && request.userId) {
      // Переход в профиль пользователя
      openUserProfile(request.userId, currentUserId);
    }
  };

  // ВХОДЯЩИЕ ЗАПРОСЫ: 
  // 1. Запросы в друзья (ко мне)
  // 2. Приглашения на события (где меня пригласили)
  // 3. Запросы на участие в МОИХ событиях (где пользователь хочет присоединиться)
  const incomingRequests = useMemo(() => {
    if (!currentUserId) return [];
    
    logger.debug('incomingRequests: начинаем фильтрацию', { userId: currentUserId, totalRequests: eventRequests.length, invitesCount: eventRequests.filter(req => req.type === 'invite').length, incomingInvitesCount: eventRequests.filter(req => req.type === 'invite' && req.toUserId === currentUserId).length });
    
    const requests: Array<{
      id: string;
      type: 'event' | 'friend';
      eventId?: string;
      userId?: string;
      isInvite?: boolean;
    }> = [];
    
    // Запросы в друзья (к текущему пользователю)
    friendRequests
      .filter(req => req.toUserId === currentUserId && req.status === 'pending')
      .forEach(req => {
        requests.push({
          id: req.id,
          type: 'friend' as const,
          userId: req.fromUserId,
        });
      });
    
    // ВХОДЯЩИЕ приглашения на события (где МЕНЯ пригласили)
    // Показываем только pending приглашения (accepted уже обработаны, rejected не показываем)
    eventRequests
      .filter(req => req.status === 'pending' && req.type === 'invite' && req.toUserId === currentUserId)
      .forEach(req => {
        const event = events.find(e => e.id === req.eventId);
        if (!event) {
          logger.warn('Событие не найдено для приглашения', { eventId: req.eventId });
          return;
        }
        
        // Проверка: приглашать может ТОЛЬКО организатор события
        if (req.fromUserId !== event.organizerId) {
          logger.warn('Приглашение от не-организатора', { fromUserId: req.fromUserId, organizerId: event.organizerId });
          return;
        }
        
        // Проверка: приглашать может ТОЛЬКО тот, у кого я в списке друзей
        const organizerFriends = getUserFriendsList(req.fromUserId);
        const amIInOrganizerFriends = organizerFriends.some(f => f.id === currentUserId);
        if (!amIInOrganizerFriends) {
          logger.warn('Организатор не в списке друзей', { organizerId: req.fromUserId, currentUserId });
          return;
        }
        
        // Проверка: НЕ показываем приглашение, если от того же пользователя есть pending friend request
        const hasPendingFriendRequest = friendRequests.some(fr => 
          fr.status === 'pending' &&
          ((fr.fromUserId === req.fromUserId && fr.toUserId === currentUserId) ||
           (fr.fromUserId === currentUserId && fr.toUserId === req.fromUserId))
        );
        if (hasPendingFriendRequest) {
          logger.debug('Есть pending friend request, скрываем приглашение');
          return;
        }
        
        // Проверка: организатор не может быть приглашен на свое же событие
        if (isUserOrganizer(event, currentUserId)) {
          logger.debug('Пользователь является организатором события');
          return;
        }
        
        // Проверка: нельзя приглашать, если я уже член события
        if (isUserEventMember(event, currentUserId)) {
          logger.debug('Пользователь уже является членом события');
          return;
        }
        
        logger.debug('Добавляем входящее приглашение', { id: req.id, eventId: req.eventId, fromUserId: req.fromUserId });
        requests.push({
          id: req.id,
          type: 'event' as const,
          eventId: req.eventId,
          userId: req.fromUserId,
          isInvite: true,
        });
      });
    
    logger.debug('incomingRequests: после фильтрации приглашений', { addedInvites: requests.filter(r => r.type === 'event' && r.isInvite).length });
    
    // ВХОДЯЩИЕ запросы на участие в МОИХ событиях
    // Для бизнес-аккаунтов показываем accepted запросы как уведомления о присоединении
    eventRequests
      .filter(req => {
        const event = events.find(e => e.id === req.eventId);
        if (!event || !isEventUpcoming(event) || !isUserOrganizer(event, currentUserId)) {
          return false;
        }
        
        const organizerData = getUserData(event.organizerId);
        const isBusinessAccount = organizerData?.accountType === 'business';
        
        // Для бизнес-аккаунтов показываем accepted запросы, для обычных - только pending
        if (isBusinessAccount) {
          return (req.status === 'accepted' || req.status === 'pending') && (!req.type || req.type === 'join');
        } else {
          return req.status === 'pending' && (!req.type || req.type === 'join');
        }
      })
      .forEach(req => {
        const event = events.find(e => e.id === req.eventId);
        if (!event) return;
        
        const requesterUserId = req.userId;
        if (requesterUserId === event.organizerId) {
          return;
        }
        
        const organizerData = getUserData(event.organizerId);
        const isBusinessAccount = organizerData?.accountType === 'business';
        
        requests.push({
          id: req.id,
          type: 'event' as const,
          eventId: req.eventId,
          userId: requesterUserId,
          status: req.status, // Передаем статус для отображения
          isBusinessAccount: isBusinessAccount, // Флаг для бизнес-аккаунта
        } as any);
      });
    
    logger.debug('incomingRequests: итоговое количество запросов', { total: requests.length, invites: requests.filter(r => r.type === 'event' && r.isInvite).length });
    // Свежие сверху — порядок с сервера не гарантирован.
    return sortByCreatedAtDesc(requests, friendRequests, eventRequests);
  }, [friendRequests, eventRequests, events, isEventUpcoming, isUserOrganizer, isUserEventMember, getUserFriendsList, getUserData, currentUserId]);

  /**
   * Заявки, для которых уведомления НЕТ.
   *
   * На экране два списка подряд: лента уведомлений и список заявок. Пока
   * сервер не заводил уведомлений на заявки в друзья и приглашения, они
   * жили только во втором списке — отсюда и ощущение, что «уведомления о
   * приглашении были раньше». Теперь уведомления есть у всех типов, и без
   * этой проверки одна заявка выводилась бы двумя строками сразу.
   */
  const requestsWithoutNotification = useMemo(() => {
    const notifiedFriendActors = new Set(
      notifications
        .filter(n => n.type === 'FRIEND_REQUEST')
        .map(n => (n.payload as any)?.actorId)
        .filter(Boolean),
    );
    const notifiedEventKeys = new Set(
      notifications
        .filter(n => n.type === 'EVENT_JOIN_REQUEST' || n.type === 'EVENT_INVITE')
        .map(n => `${(n.payload as any)?.eventId}|${(n.payload as any)?.actorId}`),
    );

    return incomingRequests.filter(req => {
      if (req.type === 'friend') return !notifiedFriendActors.has(req.userId);
      return !notifiedEventKeys.has(`${req.eventId}|${req.userId}`);
    });
  }, [incomingRequests, notifications]);

  /**
   * Одна общая лента: уведомления и заявки вперемешку, свежие сверху.
   *
   * Раньше это были два списка подряд — сначала ВСЕ уведомления и только под
   * ними заявки, у которых своего уведомления нет. При сотне уведомлений
   * заявка оказывалась под всей лентой, хотя пришла минуту назад: чтобы
   * ответить, надо было доскроллить до самого низа. Теперь порядок один — по
   * времени, и постраничная подгрузка считает уже общий список.
   */
  const incomingFeed = useMemo(() => {
    const time = (value: any) => {
      if (!value) return 0;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };
    // Дата у строки заявки не хранится — берём её из самой заявки по id.
    const createdAtOf = (requestId: string) =>
      (friendRequests.find(r => r.id === requestId) ||
        eventRequests.find(r => r.id === requestId))?.createdAt;

    type FeedItem =
      | { kind: 'notification'; key: string; at: number; notification: any }
      | { kind: 'request'; key: string; at: number; request: any; createdAt?: Date | string };

    const items: FeedItem[] = eventNotifications.map(notification => ({
      kind: 'notification' as const,
      key: `n:${notification.id}`,
      at: time(notification.createdAt),
      notification,
    }));

    requestsWithoutNotification.forEach(request => {
      const createdAt = createdAtOf(request.id);
      items.push({
        kind: 'request' as const,
        key: `r:${request.id}`,
        at: time(createdAt),
        request,
        createdAt,
      });
    });

    return items.sort((a, b) => b.at - a.at);
  }, [eventNotifications, requestsWithoutNotification, friendRequests, eventRequests]);

  /** Доскроллили почти до низа — показываем следующую порцию общего списка. */
  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const nearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 600;
    if (nearBottom) {
      setVisibleCount(current =>
        current < incomingFeed.length ? current + NOTIFICATIONS_PAGE : current,
      );
    }
  }, [incomingFeed.length]);

  // МОИ ЗАПРОСЫ
  const outgoingRequests = useMemo(() => {
    if (!currentUserId) return [];
    const requests: Array<{
      id: string;
      type: 'event' | 'friend';
      eventId?: string;
      userId?: string;
      status?: 'pending' | 'accepted' | 'rejected';
      isInvite?: boolean;
    }> = [];
    
    // Запросы в друзья (от текущего пользователя)
    friendRequests
      .filter(req => req.fromUserId === currentUserId && req.status !== 'rejected')
      .forEach(req => {
        requests.push({
          id: req.id,
          type: 'friend' as const,
          userId: req.toUserId,
          status: req.status,
        });
      });
    
    // Исходящие запросы на события и приглашения
    const myEventRequests = getMyEventRequests();
    myEventRequests.forEach(req => {
      const event = events.find(e => e.id === req.eventId);
      if (!event) {
        return;
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Для приглашений (type: 'invite')
      // В исходящие попадают только приглашения, где Я - отправитель (fromUserId === currentUserId)
      // Входящие приглашения (где Я - получатель, toUserId === currentUserId) уже обрабатываются в incomingRequests
      if (req.type === 'invite' && req.fromUserId === currentUserId) {
        // Показываем все статусы для исходящих приглашений (pending, accepted, rejected)
        // Но отклоненные (rejected) не показываем, так как они должны исчезнуть
        if (req.status !== 'rejected') {
          requests.push({
            id: req.id,
            type: 'event' as const,
            eventId: req.eventId,
            userId: req.toUserId,
            status: req.status,
            isInvite: true,
          });
        }
      } 
      // Для обычных запросов на участие (join)
      else if (req.type === 'join' || !req.type) {
        if (isEventUpcoming(event) && !isUserOrganizer(event, currentUserId)) {
          const requestStatus = getUserRequestStatus(event, currentUserId);
          if (requestStatus === 'pending' || requestStatus === 'accepted') {
            requests.push({
              id: req.id,
              type: 'event' as const,
              eventId: req.eventId,
              userId: event.organizerId,
              status: req.status,
              isInvite: false,
            });
          }
        }
      }
    });
    
    // Свежие сверху — порядок с сервера не гарантирован.
    return sortByCreatedAtDesc(requests, friendRequests, eventRequests);
  }, [friendRequests, eventRequests, getMyEventRequests, events, isEventUpcoming, isUserOrganizer, getUserRequestStatus, currentUserId]);

  /**
   * Одна строка ленты — уведомление.
   *
   * Часть уведомлений — это заявки, на которые надо ОТВЕТИТЬ. Отдельного
   * списка заявок на экране нет: всё, что видит пользователь, — лента.
   * Поэтому «принять/отклонить» живут прямо на уведомлении и появляются
   * только пока заявка действительно висит в ожидании.
   */
  const renderNotification = (notification: any) => {
    const payload: any = notification.payload || {};
    let onAccept: (() => void) | undefined;
    let onDecline: (() => void) | undefined;

    /**
     * Кнопки привязаны к ЖИВОЙ заявке, а не к самому уведомлению.
     * Уведомление остаётся в ленте навсегда, а отвечать можно, только пока
     * заявка висит в ожидании: у старых строк (заявку давно приняли или
     * отклонили) кнопок нет — иначе «принять» вело бы в никуда.
     */
    const bind = (requestId?: string) => {
      if (!requestId) return;
      onAccept = () => handleAcceptRequest(requestId);
      onDecline = () => handleDeclineRequest(requestId);
    };

    if (notification.type === 'EVENT_JOIN_REQUEST') {
      bind(eventRequests.find(req =>
        req.eventId === payload.eventId &&
        (req.userId === payload.actorId || req.fromUserId === payload.actorId) &&
        req.status === 'pending' &&
        (!req.type || req.type === 'join'),
      )?.id);
    } else if (notification.type === 'EVENT_INVITE') {
      // Приглашение принимают за себя: важен не автор, а событие.
      bind(eventRequests.find(req =>
        req.eventId === payload.eventId &&
        (req.toUserId === currentUserId || req.userId === currentUserId) &&
        req.status === 'pending' &&
        req.type === 'invite',
      )?.id);
    } else if (notification.type === 'FRIEND_REQUEST') {
      bind(friendRequests.find(req =>
        req.fromUserId === payload.actorId &&
        req.toUserId === currentUserId &&
        req.status === 'pending',
      )?.id);
    }
    // У EVENT_ORGANIZER_TRANSFERRED кнопок нет намеренно: роль переходит
    // сразу, и уведомление лишь сообщает об этом.

    return (
      <NotificationItem
        key={notification.id}
        notification={notification}
        onPress={() => markNotificationAsRead(notification.id)}
        onDelete={() => deleteNotification(notification.id)}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Переключатель входящие/исходящие */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleButton, !showMyRequests && styles.toggleButtonActive]}
          onPress={() => setShowMyRequests(false)}
        >
          <Text style={[styles.toggleText, !showMyRequests && styles.toggleTextActive]}>
            {t.inbox.incoming || 'Incoming'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toggleButton, showMyRequests && styles.toggleButtonActive]}
          onPress={() => setShowMyRequests(true)}
        >
          <Text style={[styles.toggleText, showMyRequests && styles.toggleTextActive]}>
            {t.inbox.outgoing || 'Outgoing'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={notificationsScrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: TabBarSpacer }}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={handlePullRefresh} tintColor="#FF8D32" />
        }
      >
        {!showMyRequests ? (
          // ВХОДЯЩИЕ ЗАПРОСЫ И УВЕДОМЛЕНИЯ - все вместе без разделения
          <View style={styles.section}>
            {/* Уведомления и заявки идут одним списком — свежие сверху. */}
            {incomingFeed.slice(0, visibleCount).map(item =>
              item.kind === 'notification' ? (
                renderNotification(item.notification)
              ) : (
                <RequestItem
                  key={item.key}
                  id={item.request.id}
                  type={item.request.type}
                  eventId={item.request.eventId}
                  userId={item.request.userId}
                  status={item.request.status}
                  isInvite={item.request.isInvite}
                  isBusinessAccount={item.request.isBusinessAccount}
                  createdAt={item.createdAt}
                  onAccept={handleAcceptRequest}
                  onDecline={handleDeclineRequest}
                  onPress={() => handleRequestPress(item.request)}
                />
              ),
            )}

            {incomingFeed.length === 0 && (
              <Text style={styles.emptyText}>{t.inbox.noIncomingRequests || 'No incoming requests'}</Text>
            )}
          </View>
        ) : (
          // МОИ ЗАПРОСЫ
          <View style={styles.section}>
            {outgoingRequests.length > 0 ? (
              <RequestsList
                requests={outgoingRequests.map(req => {
                  // Находим оригинальный запрос для получения createdAt
                  const friendReq = friendRequests.find(fr => fr.id === req.id);
                  const eventReq = eventRequests.find(er => er.id === req.id);
                  const originalRequest = friendReq || eventReq;
                  
                  return {
                    id: req.id,
                    type: req.type,
                    eventId: req.eventId,
                    userId: req.userId,
                    status: req.status,
                    isInvite: req.isInvite,
                    createdAt: originalRequest?.createdAt,
                  };
                })
                // Свежие запросы сверху. Раньше сортировки не было вообще:
                // список шёл в порядке сборки (сначала все заявки в друзья,
                // потом события), из-за чего только что отправленный запрос
                // оказывался в самом низу.
                .sort((a, b) => {
                  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return tb - ta;
                })}
                isOutgoing={true}
                onRequestPress={handleRequestPress}
              />
            ) : (
              <Text style={styles.emptyText}>{t.inbox.noOutgoingRequests || 'No outgoing requests'}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#FF8D32',
    borderColor: '#FF8D32',
    shadowColor: '#FF8D32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  toggleText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14.5,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#1a0d00',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingTop: 4,
    paddingBottom: 20,
  },
  sectionTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 15,
    paddingHorizontal: 16,
  },
  subsectionTitle: {
    color: 'rgba(244,244,245,0.45)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  notificationsSection: {
    marginBottom: 10,
  },
  requestsSection: {
    marginTop: 10,
  },
  emptyText: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 14.5,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
    lineHeight: 21,
  },
});

