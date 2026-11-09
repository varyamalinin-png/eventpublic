import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useStableItemHandler } from '../../../hooks/useStableItemHandler';
import { View, Text, ScrollView, FlatList, StyleSheet, Image, TouchableOpacity, Modal, Dimensions, TextInput, Alert, Platform, RefreshControl, Animated, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRefresh } from '../../../hooks/useRefresh';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useFocusEffect, useRouter as useExpoRouter, useNavigation } from 'expo-router';
import { matchesSearchQuery } from '../../../utils/searchMatch';
import { useSafeRouter } from '../../../utils/safeRouter';
import EventCard from '../../../components/EventCard';
import TopBar from '../../../components/TopBar';
import { useEvents, Event } from '../../../context/EventsContext';
import { formatUsername, formatNameAndAge } from '../../../utils/username';
import { useAuth } from '../../../context/AuthContext';
import { useTabPress } from '../../../hooks/useTabPress';
import { apiRequest } from '../../../services/api';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { cacheKey, writeQueryCache } from '../../../utils/queryCache';
import { useLanguage } from '../../../context/LanguageContext';
import { createLogger } from '../../../utils/logger';
import { AppIcon } from '../../../components/ui/AppIcon';
import { Palette } from '../../../constants/DesignSystem';
import FolderCard from '../../../components/FolderCard';
import ProfileEventsGrid from '../../../components/ProfileEventsGrid';
import type { EventFolder } from '../../../types/EventFolder';
import AddToFolderModal from '../../../components/AddToFolderModal';
import CreateFolderModal from '../../../components/CreateFolderModal';
import { getEventDateTime } from '../../../utils/eventHelpers';
import { eventSortTime, folderSortTime } from '../../../utils/profileSort';
import { collectFolderEventIds } from '../../../utils/folderEventIds';
import MemoryVisibilityBadge, { eventVisibilityBadgeKind } from '../../../components/MemoryVisibilityBadge';
import { profileStyles } from '../../../styles/profile.styles';
import { sizedImage } from '../../../utils/imageSize';

const logger = createLogger('Profile');

/** Счётчики Organized/Participated в шапке профиля временно скрыты.
 *  Вернуть их можно, переключив этот флаг в true — разметка сохранена. */
const SHOW_ORG_PART = false;

// eventSortTime/folderSortTime переехали в utils/profileSort — их же
// использует профиль другого пользователя. Реэкспорт оставлен для
// существующих импортов из этого файла.
export { eventSortTime, folderSortTime } from '../../../utils/profileSort';

const getContainerWidth = () => {
  try {
    const screenWidth = Dimensions.get('window').width;
    if (Platform?.OS === 'web') {
      return Math.min(screenWidth, 500);
    }
    return screenWidth;
  } catch {
    return 390;
  }
};
const SCREEN_WIDTH = getContainerWidth();

/**
 * Высоты элементов ленты профиля.
 *
 * Обе карточки детерминированы: у события изображение занимает всю карточку
 * с aspectRatio 3/4 (подписи лежат поверх градиентом), у папки — 16:9 от
 * ширины экрана с абсолютным оверлеем. Поэтому высоту можно посчитать, а не
 * измерять, и дать FlatList точный getItemLayout.
 *
 * Без него прокрутка к выбранной карточке шла через scrollToIndex, который у
 * списка с плавающими высотами промахивается, а запасной путь считал позицию
 * по «средней высоте элемента» — отсюда «по центру совсем другая карточка».
 */
const FEED_H_PADDING = 12;                                   // feedContentContainer.paddingHorizontal
const FEED_CARD_W = SCREEN_WIDTH - FEED_H_PADDING * 2;
const FEED_ITEM_GAP = 15;                                    // marginBottom обёртки
// Обе карточки несут СВОЙ нижний отступ вдобавок к отступу обёртки:
// EventCard.swipeContainer — 12, FolderCard.feedContainer — 15. Первый здесь
// не учитывался, и getItemLayout недосчитывал по 12px на каждой карточке
// события. Само по себе это незаметно, но список после первой раскладки
// доводит позицию по getItemLayout — и накопленная разница разом дёргала
// ленту вверх через секунду после открытия.
const FEED_EVENT_CARD_MARGIN = 12;                           // EventCard.swipeContainer
const FEED_FOLDER_CARD_MARGIN = FEED_ITEM_GAP;               // FolderCard.feedContainer
const FEED_EVENT_BLOCK_H = Math.round((FEED_CARD_W * 4) / 3) + FEED_EVENT_CARD_MARGIN;
const FEED_FOLDER_BLOCK_H = Math.round((SCREEN_WIDTH * 9) / 16) + FEED_FOLDER_CARD_MARGIN;
const FEED_EVENT_H = FEED_EVENT_BLOCK_H + FEED_ITEM_GAP;
const FEED_FOLDER_H = FEED_FOLDER_BLOCK_H + FEED_ITEM_GAP;
const feedItemHeight = (item: { type: 'folder' | 'event' }) =>
  item.type === 'folder' ? FEED_FOLDER_H : FEED_EVENT_H;

export default function ProfileScreen() {
  const router = useSafeRouter();
  const expoRouter = useExpoRouter(); // Обычный роутер для кликов в шапке
  const navigation = useNavigation();
  const profileScrollViewRef = useRef<ScrollView>(null);

  // Повторный тап по уже активному табу «Профиль» должен возвращать к началу
  // ленты, а не оставлять всё как есть на той позиции скролла, где забыли.
  useTabPress(() => {
    profileScrollViewRef.current?.scrollTo({ y: 0, animated: true });
  });
  const params = useLocalSearchParams<{ eventId?: string }>();
  const { events, eventProfiles, getOrganizerStats, isEventUpcoming, isEventPast, isUserOrganizer, isUserAttendee, isUserEventMember, getUserData, getUserRequestStatus, eventFolders, createEventFolder, deleteEvent, addEventToFolder, fetchEventProfile, fetchEventProfiles, refreshEventFolders, friends, syncFriendsFromServer, memoryVisibility, refreshMemoryVisibility } = useEvents();
  const { user: authUser, accessToken, loading: authLoading, initializing: authInitializing } = useAuth();
  const { t } = useLanguage();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<EventFolder | null>(null);
  const [eventHeights, setEventHeights] = useState<Record<string, number>>({});
  const { refreshing, onRefresh } = useRefresh();
  const [initialFeedIndex, setInitialFeedIndex] = useState(0);
  const feedListRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [organizerStats, setOrganizerStats] = useState<{ complaints: number; friends: number } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showAddToFolderModal, setShowAddToFolderModal] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [showComplaintsToast, setShowComplaintsToast] = useState(false);
  const complaintsToastOpacity = useRef(new Animated.Value(0)).current;

  // Страница /my-complaints временно заморожена: вместо перехода показываем
  // мигающий тост "в разработке" (переход намеренно отключён, не баг).
  const handleComplaintsPress = useCallback(() => {
    setShowComplaintsToast(true);
    Animated.sequence([
      Animated.timing(complaintsToastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(complaintsToastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowComplaintsToast(false));
  }, [complaintsToastOpacity]);

  const currentUserId = authUser?.id;
  const userData = currentUserId ? getUserData(currentUserId) : null;

  // Загружаем статистику при монтировании и обновлении
  useEffect(() => {
    if (currentUserId) {
      const stats = getOrganizerStats(currentUserId);
      setOrganizerStats({ complaints: stats.complaints, friends: stats.friends });
    }
  }, [currentUserId, getOrganizerStats]);
  
  // Мемоизируем все вычисления событий, чтобы избежать бесконечных перерендеров
  const organizedEvents = useMemo(() => {
    if (!currentUserId) return [];
    return events.filter(event => {
      // Исключаем отклоненные события
      const userStatus = getUserRequestStatus(event, currentUserId);
      if (userStatus === 'rejected') return false;
      return isEventUpcoming(event) && isUserOrganizer(event, currentUserId);
    });
  }, [events, currentUserId, isEventUpcoming, isUserOrganizer, getUserRequestStatus]);
  
  // КРИТИЧЕСКИ ВАЖНО: В разделе "Участник" показываем ТОЛЬКО предстоящие события
  // Прошедшие события будут только в параметрах шапки профиля
  const participatedEvents = useMemo(() => {
    if (!currentUserId) return [];
    return events.filter(event => {
      // Исключаем отклоненные события
      const userStatus = getUserRequestStatus(event, currentUserId);
      if (userStatus === 'rejected') {
        return false;
      }
      
      // ТОЛЬКО предстоящие события
      if (!isEventUpcoming(event)) {
        return false;
      }
      
      // Проверяем, что пользователь является участником (не организатором)
      return isUserAttendee(event, currentUserId);
    });
  }, [events, currentUserId, isEventUpcoming, isUserAttendee, getUserRequestStatus]);

  // Для подсчета параметров: все события (текущие и прошлые)
  // Используем те же признаки для всех событий
  /**
   * Участник ли пользователь — ТОЛЬКО по данным, приходящим вместе с самим
   * событием (`participantsData` — принятые участники, у каждого есть userId).
   *
   * Иначе счётчик в шапке профиля меняется на глазах: context.isUserAttendee
   * при промахе по participantsData уходит в две асинхронные проверки —
   * сравнение с `getUserData(...).avatar` (аватарки подгружаются отдельно) и
   * getAcceptedParticipants (заявки приходят своим запросом). По мере их
   * загрузки события одно за другим начинают считаться, и число растёт.
   *
   * Прошлая попытка это починить сравнивала `participantsList` с userId, но
   * participantsList — это список АВАТАРОК (см. mapServerEventToClient),
   * поэтому сравнение всегда было ложным: число стало стабильным, но
   * заниженным — прошедшие события с участием просто не считались.
   *
   * Фолбэк на context.isUserAttendee остаётся для событий без
   * participantsData (созданные локально, ещё не синхронизированные).
   */
  const isParticipantByEventData = useCallback((event: Event, userId: string): boolean => {
    if (event.organizerId === userId) return false; // организатор не участник
    if (!Array.isArray(event.participantsData)) return isUserAttendee(event, userId);
    return event.participantsData.some(participant => participant?.userId === userId);
  }, [isUserAttendee]);

  const allOrganizedEvents = useMemo(() => {
    if (!currentUserId) return [];
    const filtered = events.filter(event => {
      // КРИТИЧЕСКИ ВАЖНО: НЕ исключаем события, где currentUserId является организатором
      // rejected статус применяется только для участников, не для организаторов
      // Если пользователь организатор - событие должно показываться независимо от rejected статуса
      const isOrganizer = event.organizerId === currentUserId;
      if (!isOrganizer) {
        // Если не организатор - проверяем rejected статус
        const userStatus = getUserRequestStatus(event, currentUserId);
        if (userStatus === 'rejected') {
          logger.debug('allOrganizedEvents: событие отклонено', { eventId: event.id });
          return false;
        }
      }
      
      // Для текущих событий - проверяем обычным способом
      if (isEventUpcoming(event)) {
        return isUserOrganizer(event, currentUserId);
      }
      
      /**
       * Прошедшее событие, из которого организатор вышел, в счётчик не идёт.
       *
       * Роль организатора остаётся записанной за человеком и после выхода
       * (никому её не передавали), поэтому одной проверки «я организатор»
       * мало: событие пропадало из сетки, а счётчик в шапке не двигался.
       * Состав знает профиль события — сервер вычёркивает из него вышедших.
       *
       * Профиль загружается асинхронно, поэтому проверка устроена так, что
       * она может только УБРАТЬ событие из счёта, но не добавить: пока
       * профиля нет, считаем как раньше. Расти на глазах счётчик не будет —
       * именно от этого eventProfiles когда-то и убрали из зависимостей.
       */
      if (isEventPast(event)) {
        if (!isUserOrganizer(event, currentUserId)) return false;
        const profile = eventProfiles.find(p => p.eventId === event.id);
        if (!profile) return true;
        return profile.participants.includes(currentUserId);
      }
      
      return isUserOrganizer(event, currentUserId);
    });
    
    logger.debug('allOrganizedEvents: отфильтровано', { filtered: filtered.length, total: events.length });
    
    return filtered;
  }, [events, eventProfiles, currentUserId, isUserOrganizer, isEventUpcoming, isEventPast, getUserRequestStatus]);
  
  const allParticipatedEvents = useMemo(() => {
    if (!currentUserId) return [];
    const filtered = events.filter(event => {
      // Для прошедших событий проверяем участие через eventProfiles
      // ВСЕ события имеют профиль - проверяем участие через профиль
      if (isEventPast(event)) {
        // Организатор не считается участником
        if (isUserOrganizer(event, currentUserId)) {
          return false;
        }
        
        return isParticipantByEventData(event, currentUserId);
      }
      
      // Проверки на «отклонён» здесь больше нет: participantsData содержит
      // только ПРИНЯТЫХ участников, так что отклонённый в него не попадёт.
      // А getUserRequestStatus читает заявки, которые приходят отдельным
      // запросом, — то есть возвращал бы счётчик к прежнему поведению
      // «меняется на глазах», только в другую сторону.
      return isParticipantByEventData(event, currentUserId);
    });
    
    logger.debug('allParticipatedEvents: отфильтровано', { filtered: filtered.length, total: events.length });
    
    return filtered;
    // eventProfiles ВНЕ зависимостей: подсчёт больше не смотрит в профили, а
    // их асинхронная загрузка и вызывала пересчёт (счётчик «рос» на глазах).
  }, [events, currentUserId, isParticipantByEventData, isUserOrganizer, isEventPast]);
  
  // Общее количество всех событий пользователя (организовал + участвовал, без дублей)
  // КРИТИЧЕСКИ ВАЖНО: Используем те же события, что показываются в списке (userEvents + pastEvents)
  const allUserEvents = useMemo(() => {
    if (!currentUserId) return [];
    // Используем те же события, что и в списке - это гарантирует совпадение параметра и списка
    const allEvents = [...allOrganizedEvents, ...allParticipatedEvents];
    // Убираем дубликаты
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    );
    
    logger.debug('allUserEvents', { organized: allOrganizedEvents.length, participated: allParticipatedEvents.length, total: uniqueEvents.length });
    
    return uniqueEvents;
  }, [allOrganizedEvents, allParticipatedEvents]);
  
  // Все события пользователя для ленты БЕЗ архивных событий
  const userEvents = useMemo(() => 
    [...organizedEvents, ...participatedEvents].filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    ),
    [organizedEvents, participatedEvents]
  );

  // Проверяем является ли событие прошедшим
  // МЕМОРИ: прошедшее && я_член_события (организатор или принятый участник)
  // Получаем все eventId, которые находятся в папках
  const eventsInFolders = useMemo(
    // Та же утилита теперь и в чужом профиле — там этой фильтрации не было
    // вовсе, и событие стояло в сетке дважды: в папке и рядом с ней.
    () => collectFolderEventIds(eventFolders),
    [eventFolders],
  );

  // КРИТИЧЕСКИ ВАЖНО: Используем ту же логику фильтрации, что и в allOrganizedEvents/allParticipatedEvents
  // ИСКЛЮЧАЕМ события, которые находятся в папках
  const pastEvents = useMemo(() => {
    if (!currentUserId) return [];
    
    // Логируем все события для отладки
    logger.debug('pastEvents: начало фильтрации', { 
      totalEvents: events.length,
      currentUserId,
      eventsInFoldersCount: eventsInFolders.size,
      eventsForUser: events.filter(e => e.organizerId === currentUserId).map(e => ({ id: e.id, title: e.title }))
    });
    
    const filtered = events.filter(event => {
      const isPast = isEventPast(event);
      
      // Логируем все прошедшие события для отладки
      if (event.organizerId === currentUserId) {
        logger.debug(`pastEvents: проверка события "${event.title}" (${event.id})`, { 
          isPast,
          date: event.date,
          time: event.time,
          organizerId: event.organizerId,
          currentUserId,
          eventDateTime: event.date && event.time ? new Date(event.date + 'T' + event.time + ':00').toISOString() : 'нет даты',
          now: new Date().toISOString()
        });
      }
      
      if (!isPast) {
        return false;
      }
      
      // ИСКЛЮЧАЕМ события, которые находятся в папках
      if (eventsInFolders.has(event.id)) {
        logger.debug('pastEvents: событие в папке, исключаем из ленты', { eventId: event.id, title: event.title });
        return false;
      }
      
      /**
       * Состав прошедшего события решает его профиль.
       *
       * participants приходит с сервера уже без тех, кто вышел, и организатор
       * в нём тоже есть (недостающие строки сервер дописывает сам —
       * EventProfilesService.getProfile). Поэтому отдельной ветки «я
       * организатор — показываем всегда» здесь нет: роль остаётся записанной
       * за человеком и после выхода, и из-за неё событие не исчезало из
       * собственных «меморис» — нажал «удалить», а карточка на месте.
       *
       * Пометку formerParticipants для этого использовать нельзя: сервер
       * отдаёт её только участникам события, а вышедший уже не участник.
       */
      const profile = eventProfiles.find(p => p.eventId === event.id);
      if (!profile) {
        // Профиль ещё не загружен — ведём себя как раньше: своё событие
        // показываем, чужое участие подтвердить нечем.
        return isUserOrganizer(event, currentUserId);
      }
      const isParticipantInProfile = profile.participants.includes(currentUserId);
      if (!isParticipantInProfile) {
        logger.debug('pastEvents: пользователь не в participants профиля', { eventId: event.id, title: event.title });
        return false;
      }
      return true;
    });
    
    const rpInFiltered = filtered.find(e => e.id === 'a54d08f4-b9b1-427d-9d2a-e2590dfe7485' || e.title === 'рп');
    logger.debug('pastEvents: отфильтровано', { 
      filtered: filtered.length, 
      totalPast: events.filter(e => isEventPast(e)).length,
      rpInFiltered: !!rpInFiltered,
      filteredEvents: filtered.map(e => ({ id: e.id, title: e.title, organizerId: e.organizerId }))
    });
    
    return filtered.sort((a, b) => {
      // Сортируем по дате+времени события: самое последнее прошедшее первым
      const dateA = new Date(a.date + 'T' + a.time + ':00').getTime();
      const dateB = new Date(b.date + 'T' + b.time + ':00').getTime();
      return dateB - dateA; // Убывание: последнее первым
    });
  }, [events, eventProfiles, currentUserId, isEventPast, isUserOrganizer, eventsInFolders]);
  
  // Объединяем все события для параметра "всего событий" - ВСЕ события, включая те, что в папках
  // Для счетчиков нужно показывать ВСЕ события пользователя, а не только те, что видны в списке
  const allUserEventsForStats = useMemo(() => {
    if (!currentUserId) return [];
    // Используем allOrganizedEvents и allParticipatedEvents, которые включают ВСЕ события (включая в папках)
    const allEvents = [...allOrganizedEvents, ...allParticipatedEvents];
    // Убираем дубликаты
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    );
    
    logger.debug('allUserEventsForStats', { 
      allOrganizedEvents: allOrganizedEvents.length, 
      allParticipatedEvents: allParticipatedEvents.length, 
      total: uniqueEvents.length 
    });
    
    return uniqueEvents;
  }, [allOrganizedEvents, allParticipatedEvents]);
  
  /**
   * Профили прошедших событий — ОДНИМ запросом на все.
   *
   * Здесь стояло два загрузчика, и каждый дёргал профиль отдельным запросом на
   * каждое событие. На боевых данных (75 прошедших событий) открытие профиля
   * выстреливало под сотню параллельных запросов: они упирались в ограничитель
   * частоты, отдавали 429 и оставляли экран пустым.
   *
   * Дедупликация, кэш на минуту и пауза после 429 живут внутри
   * fetchEventProfiles, поэтому ref со списком уже запрошенных id больше не
   * нужен — как и второй загрузчик.
   */
  const loadProfilesForPastEvents = useCallback(async () => {
    if (!currentUserId || !fetchEventProfiles || events.length === 0) return;
    const pastEventIds = events.filter(event => isEventPast(event)).map(event => event.id);
    if (!pastEventIds.length) return;
    try {
      await fetchEventProfiles(pastEventIds);
    } catch (error) {
      logger.warn('Не удалось загрузить профили прошедших событий', error);
    }
  }, [currentUserId, events, isEventPast, fetchEventProfiles]);

  useEffect(() => { loadProfilesForPastEvents(); }, [loadProfilesForPastEvents]);

  useFocusEffect(useCallback(() => { loadProfilesForPastEvents(); }, [loadProfilesForPastEvents]));

  // Личная видимость прошедших событий — по ней рисуются значки на сетке.
  const refreshMemoryVisibilityRef = useRef(refreshMemoryVisibility);
  refreshMemoryVisibilityRef.current = refreshMemoryVisibility;
  useFocusEffect(
    useCallback(() => {
      refreshMemoryVisibilityRef.current?.().catch(() => undefined);
    }, []),
  );

  /**
   * Число друзей берём с сервера, тем же полем, что и в чужом профиле, и через
   * тот же кэш: при открытии вкладки сразу стоит прошлое значение, а не ноль,
   * который потом на глазах меняется на двойку.
   *
   * Считать его по локальному состоянию оказалось ненадёжно: заявку принимают
   * на другом экране, а список друзей приходит фоновой синхронизацией, которая
   * может не успеть или молча упасть — и в профиле оставался ноль при трёх
   * реальных друзьях.
   */
  const { data: me, refresh: loadFriendsCount } = useCachedQuery<{ friendsCount?: number }>(
    authUser?.id && accessToken ? cacheKey(authUser.id, 'profile', authUser.id) : null,
    () => apiRequest('/users/me', {}, accessToken as string),
    { auto: false },
  );
  const serverFriendsCount =
    typeof me?.friendsCount === 'number' ? me.friendsCount : null;

  // Свой список друзей тоже прогреваем заранее — переход по счётчику должен
  // открывать готовый список, а не пустой экран с запросом.
  useFocusEffect(
    useCallback(() => {
      if (!authUser?.id || !accessToken) return;
      apiRequest(`/friends/user/${authUser.id}`, {}, accessToken)
        .then(data => {
          if (Array.isArray(data)) {
            writeQueryCache(cacheKey(authUser.id, 'friends', authUser.id), data);
          }
        })
        .catch(() => undefined);
    }, [authUser?.id, accessToken]),
  );

  /**
   * Список друзей перечитываем при каждом открытии вкладки.
   *
   * Заявку принимают на другом экране (в уведомлениях), и с постабными стеками
   * профиль всё это время остаётся смонтированным. Счётчик обновлялся только
   * тем, что прилетало в состояние по ходу дела, — и легко оставался нулём.
   */
  /**
   * Функции держим в ref, а список зависимостей оставляем пустым.
   *
   * syncFriendsFromServer завязан на обработчик 401, тот — на refresh-токен, а
   * токен меняется при каждом обновлении сессии. Со ссылкой в зависимостях
   * эффект перезапускался на каждый такой круг: запрос → 401 → обновление
   * токена → новая ссылка → запрос. В прогоне это дало 96 одинаковых запросов
   * к /friends подряд.
   */
  const syncFriendsRef = useRef(syncFriendsFromServer);
  syncFriendsRef.current = syncFriendsFromServer;
  const loadFriendsCountRef = useRef(loadFriendsCount);
  loadFriendsCountRef.current = loadFriendsCount;

  useFocusEffect(
    useCallback(() => {
      syncFriendsRef.current?.().catch(() => undefined);
      loadFriendsCountRef.current();
    }, []),
  );

  // Функция поиска для профиля
  const handleProfileSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Поиск событий пользователя
  const searchUserEvents = (eventsList: Event[], query: string) => {
    if (!query.trim()) return eventsList;
    
    // Слова запроса — в любом порядке (utils/searchMatch).
    return eventsList.filter(event =>
      matchesSearchQuery(
        [
          event.title,
          event.description,
          event.location,
          event.displayDate, // формат «15 мая»
          event.time,
          ...(event.participantsData ?? []).map(participant => participant.name),
        ],
        query,
      ),
    );
  };


  // Фильтрация событий по поиску
  const filteredEvents = searchUserEvents(userEvents, searchQuery);

  const handleMemoryPress = (eventId: string) => {
    logger.debug('handleMemoryPress вызван для события', { eventId });
    const event = pastEvents.find(e => e.id === eventId);
    if (event) {
      // Сохраняем время клика для предотвращения закрытия ленты
      if (typeof window !== 'undefined') {
        (window as any).lastEventClickTime = Date.now();
        (window as any).lastSetParamsTime = Date.now();
      }
      
      // КРИТИЧЕСКИ ВАЖНО: На вебе не используем router.setParams, только локальное состояние
      // Устанавливаем eventId в URL чтобы useEffect не закрывал ленту (только для мобильного)
      if (Platform.OS !== 'web' && router && typeof router.setParams === 'function') {
        try {
          router.setParams({ eventId: event.id as any });
          logger.debug('router.setParams вызван в handleMemoryPress для события', { eventId: event.id });
        } catch (error) {
          logger.warn('Failed to set params in handleMemoryPress:', error);
        }
      }
      
      setSelectedEvent(event);
      setSelectedFolder(null);
      setShowEventFeed(true);
      
      logger.debug('showEventFeed установлено в true в handleMemoryPress');
      
      // Прокручиваем к нужному событию после рендера
      setTimeout(() => {
        // Создаем временный массив items для поиска индекса
        const tempItems: Array<{ type: 'folder' | 'event'; data: EventFolder | Event }> = [];
        if (eventFolders && eventFolders.length > 0) {
          eventFolders.forEach((folder: EventFolder) => {
            tempItems.push({ type: 'folder', data: folder });
          });
        }
        pastEvents.forEach((e: Event) => {
          tempItems.push({ type: 'event', data: e });
        });
        
        const itemIndex = tempItems.findIndex(item => item.type === 'event' && (item.data as Event).id === eventId);
        if (itemIndex !== -1 && scrollViewRef.current) {
          const cardHeight = 400;
          const marginBottom = 15;
          const totalItemHeight = cardHeight + marginBottom;
          const scrollPosition = itemIndex * totalItemHeight;
          
          scrollViewRef.current.scrollTo({
            y: scrollPosition,
            animated: true
          });
        }
      }, 100);
    }
  };

  // Обработчики для режима select
  const handleCreateFolder = useCallback(async () => {
    logger.debug('handleCreateFolder called', { 
      selectedEventIds: Array.from(selectedEventIds), 
      selectedCount: selectedEventIds.size,
      eventFoldersCount: eventFolders?.length || 0,
      hasEventFolders: eventFolders && eventFolders.length > 0
    });
    
    if (selectedEventIds.size === 0) {
      Alert.alert(t.common.error, t.profile.selectAtLeastOneEvent);
      return;
    }
    // Если есть папки, показываем попап выбора папки, иначе создаем новую
    if (eventFolders && eventFolders.length > 0) {
      logger.debug('Opening add to folder modal');
      setShowAddToFolderModal(true);
    } else {
      logger.debug('Opening create folder modal');
      setShowCreateFolderModal(true);
    }
  }, [selectedEventIds, eventFolders]);

  const handleDeleteSelectedEvents = useCallback(async () => {
    if (selectedEventIds.size === 0) {
      Alert.alert(t.common.error, t.profile.selectAtLeastOneEvent);
      return;
    }

    Alert.alert(
      t.profile.deleteEventsQuestion,
      t.profile.confirmDeleteEvents
        .replace('{count}', String(selectedEventIds.size))
        .replace('{word}', selectedEventIds.size === 1 ? t.events.eventWord : t.profile.eventsWordPlural),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              for (const eventId of selectedEventIds) {
                await deleteEvent(eventId);
              }
              setSelectMode(false);
              setSelectedEventIds(new Set());
            } catch (error) {
              Alert.alert(t.common.error, t.profile.failedToDeleteEvents);
            }
          },
        },
      ]
    );
  }, [selectedEventIds, deleteEvent]);

  const handleCancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedEventIds(new Set());
  }, []);

  const handleCreateFolderSubmit = useCallback(async (name: string, description?: string, coverPhoto?: { uri: string; type: string; name: string }) => {
    if (!name.trim()) {
      Alert.alert(t.common.error, t.profile.enterFolderName);
      return;
    }

    try {
      logger.debug('Creating folder', { name: name.trim(), description: description?.trim(), hasCoverPhoto: !!coverPhoto, selectedEventIds: Array.from(selectedEventIds) });
      const folder = await createEventFolder(name.trim(), description?.trim(), coverPhoto);
      logger.debug('Folder created', { folder });
      if (folder) {
        // Добавляем выбранные события в папку
        for (const eventId of selectedEventIds) {
          try {
            logger.debug('Adding event to folder', { folderId: folder.id, eventId });
            await addEventToFolder(folder.id, eventId);
            logger.debug('Event added to folder', { folderId: folder.id, eventId });
          } catch (error) {
            logger.error(`Failed to add event ${eventId} to folder:`, error);
          }
        }
        await refreshEventFolders();
        setShowCreateFolderModal(false);
        setSelectMode(false);
        setSelectedEventIds(new Set());
        Alert.alert(t.common.success, t.messages.folderCreated);
      } else {
        logger.error('Folder creation returned null');
        Alert.alert(t.common.error, t.profile.folderCreateFailed);
      }
    } catch (error) {
      logger.error('Failed to create folder:', error);
      const errorMessage = error instanceof Error ? error.message : t.events.unknownError;
      Alert.alert(t.common.error, `${t.profile.createFolderFailed}: ${errorMessage}`);
    }
  }, [selectedEventIds, createEventFolder, addEventToFolder]);

  const handleMiniaturePress = useCallback((event: Event) => {
    logger.debug('MINIATURE TAP', { id: event.id, title: event.title, isPast: isEventPast(event) });
    setSelectedEvent(event);
    setShowEventFeed(true);
  }, [isEventPast]);

  // Стабильная ссылка вместо новой стрелки на каждый рендер сетки
  const getFilteredPress = useStableItemHandler(filteredEvents, handleMiniaturePress);

  // Только прошедшее событие можно добавить в папку
  const pastEventIds = useMemo(() => new Set(pastEvents.map((e: Event) => e.id)), [pastEvents]);

  // Сетка собирается из трёх независимых списков — искать событие по id надо во
  // всех, иначе обработчик молча не найдёт его и ничего не сделает
  const gridEvents = useMemo(() => {
    const byId = new Map<string, Event>();
    for (const e of [...organizedEvents, ...participatedEvents, ...pastEvents]) byId.set(e.id, e);
    return Array.from(byId.values());
  }, [organizedEvents, participatedEvents, pastEvents]);

  // Сетка профиля: инлайновые стрелки в onMiniaturePress/onLongPress давали новую
  // ссылку на каждый рендер и отключали memo у всех карточек. Обработчики читаются
  // из рефа в момент вызова, поэтому selectMode и pastEventIds всегда свежие.
  const getGridPress = useStableItemHandler(gridEvents, (event: Event) => {
    if (!selectMode) {
      handleMiniaturePress(event);
      return;
    }
    if (!pastEventIds.has(event.id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(event.id)) next.delete(event.id);
      else next.add(event.id);
      return next;
    });
  });

  const getGridLongPress = useStableItemHandler(gridEvents, (event: Event) => {
    if (!pastEventIds.has(event.id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectMode(true);
    setSelectedEventIds(new Set([event.id]));
  });

  // Определяем какую коллекцию событий и папок показывать в ленте
  // Выход из ленты профиля. Раньше это жило только в onPress кнопки
  // «Back to profile»; вынесено, чтобы тем же путём выходил и свайп.
  const closeEventFeed = useCallback(() => {
    setShowEventFeed(false);
    setSelectedEvent(null);
    setSelectedFolder(null);
    if (params.eventId && Platform.OS !== 'web' && router.setParams && typeof router.setParams === 'function') {
      try {
        router.setParams({ eventId: undefined });
      } catch (error) {
        logger.warn('Failed to clear params:', error);
      }
    }
    // Никакой навигации здесь быть не должно: лента — это состояние ВНУТРИ
    // экрана профиля, и setShowEventFeed(false) выше уже возвращает к нему.
    // Дополнительный router.push на тот же маршрут давал вторую отрисовку —
    // профиль «мелькал два раза» при нажатии «Back to profile».
  }, [params.eventId]);

  // Тап по иконке профиля в таб-баре возвращает к сетке.
  //
  // Лента — это состояние ВНУТРИ экрана профиля, а не отдельный маршрут,
  // поэтому штатное «повторный тап по активному табу выкидывает стек к корню»
  // здесь не срабатывало: стек и так был на корне, и с ленты было не уйти.
  // Слушаем tabPress у родительского навигатора (таб-бар) — сетка это
  // состояние профиля по умолчанию, к нему иконка и должна возвращать.
  useEffect(() => {
    // На вебе навигатора нет, getParent может отсутствовать — см. useTabPress.
    const parent =
      typeof (navigation as any).getParent === 'function' ? navigation.getParent() : null;
    if (!parent) return;
    const unsubscribe = (parent as any).addListener('tabPress', () => {
      closeEventFeed();
    });
    return unsubscribe;
  }, [navigation, closeEventFeed]);

  // Свайп вправо закрывает ленту: лента — это состояние ВНУТРИ экрана, а не
  // отдельный маршрут, поэтому системный жест «назад» тут не работал и уйти
  // можно было только кнопкой.
  const feedSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        // Реагируем только на явно горизонтальный жест вправо, иначе
        // перехватывали бы вертикальную прокрутку ленты.
        onMoveShouldSetPanResponder: (_e, g) =>
          g.dx > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_e, g) => {
          if (g.dx > 60) closeEventFeed();
        },
      }),
    [closeEventFeed],
  );

  // Если выбрана папка или прошедшее событие - показываем Memories (папки + pastEvents)
  // Иначе показываем обычные события пользователя
  const itemsToShow = useMemo(() => {
    if (selectedFolder || (selectedEvent && isEventPast(selectedEvent))) {
      // Показываем Memories: папки + прошедшие события
      const items: Array<{ type: 'folder' | 'event'; data: EventFolder | Event }> = [];
      
      // Добавляем папки
      if (eventFolders && eventFolders.length > 0) {
        eventFolders.forEach((folder: EventFolder) => {
          items.push({ type: 'folder', data: folder });
        });
      }
      
      // Добавляем прошедшие события
      pastEvents.forEach((event: Event) => {
        items.push({ type: 'event', data: event });
      });
      
      // Та же сортировка, что и в сетке Memories (см. eventSortTime/folderSortTime):
      // раньше здесь папка сортировалась по дате СОЗДАНИЯ, а в сетке — по её
      // самому свежему событию, поэтому порядок в сетке и в ленте расходился.
      items.sort((a, b) => {
        const dateA = a.type === 'folder'
          ? folderSortTime(a.data as EventFolder)
          : eventSortTime(a.data as Event);
        const dateB = b.type === 'folder'
          ? folderSortTime(b.data as EventFolder)
          : eventSortTime(b.data as Event);
        return dateB - dateA;
      });
      // Выбранную карточку НЕ поднимаем наверх: порядок остаётся
      // хронологическим, а лента просто открывается на нужном событии
      // (см. эффект прокрутки ниже) — чтобы можно было листать вверх к более
      // свежим и вниз к более старым.
      return items;
    }
    // Сплошная лента: upcoming (organizer + participant) + folders + past events
    const allItems: Array<{ type: 'folder' | 'event'; data: EventFolder | Event }> = [];

    // Upcoming events
    userEvents.forEach(event => {
      allItems.push({ type: 'event', data: event });
    });

    // Folders
    if (eventFolders && Array.isArray(eventFolders)) {
      eventFolders.forEach((folder: EventFolder) => {
        allItems.push({ type: 'folder', data: folder });
      });
    }

    // Past events (not in folders)
    pastEvents.forEach((event: Event) => {
      allItems.push({ type: 'event', data: event });
    });

    // Хронология ТА ЖЕ, что в сетке профиля.
    // Раньше здесь сортировки не было вовсе — элементы шли в порядке
    // добавления (сначала предстоящие, потом все папки, потом все прошедшие),
    // а в сетке раздел Memories отсортирован по свежести. Отсюда и расходился
    // порядок событий и папок между сеткой и лентой.
    const sortKeyOf = (item: { type: 'folder' | 'event'; data: EventFolder | Event }) =>
      item.type === 'folder'
        ? folderSortTime(item.data as EventFolder)
        : eventSortTime(item.data as Event);

    const upcomingPart = allItems.filter(
      item => item.type === 'event' && !isEventPast(item.data as Event),
    );
    const memoriesPart = allItems
      .filter(item => !(item.type === 'event' && !isEventPast(item.data as Event)))
      .sort((a, b) => sortKeyOf(b) - sortKeyOf(a));

    return [...upcomingPart, ...memoriesPart];
  }, [selectedFolder, selectedEvent, pastEvents, userEvents, isEventPast, eventFolders]);


  // Индекс выбранной карточки в ленте — для initialScrollIndex у списка.
  const selectedFeedIndex = useMemo(() => {
    if (!selectedEvent) return -1;
    return itemsToShow.findIndex(
      item => item.type === 'event' && (item.data as Event).id === selectedEvent.id,
    );
  }, [itemsToShow, selectedEvent]);

  // Дополнительной прокрутки здесь НЕТ намеренно.
  //
  // Список открывается ровно на нужном элементе через initialScrollIndex, а
  // getItemLayout даёт точные смещения. Прежняя «доводка» через scrollToIndex
  // срабатывала уже после первой раскладки и дёргала ленту вверх: карточка
  // на секунду стояла правильно, а потом наполовину уезжала вниз.

  // КРИТИЧЕСКИ ВАЖНО: Все ранние возвраты должны быть ПОСЛЕ всех хуков
  useEffect(() => {
    // Ждём окончания восстановления сессии. Раньше проверялся только loading,
    // который во время бутстрапа остаётся false — на вебе это уводило на /login
    // сразу после перехода, а затем логин перекидывал на explore.
    if (!authUser && !authLoading && !authInitializing) {
      router.replace('/(auth)/login?mode=register' as any);
    }
  }, [authUser, authLoading, authInitializing]);

  if (!authUser || !currentUserId) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{(authLoading || authInitializing) ? t.common.loading : ''}</Text>
        </View>
      </View>
    );
  }
  
  // Если userData все еще null (не должно происходить, но на всякий случай)
  if (!userData) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t.profile.loadError}</Text>
        </View>
      </View>
    );
  }

  /**
   * Лента события/папки — слоем ПОВЕРХ профиля, а не вместо него.
   *
   * Раньше здесь был ранний return: пока открыта лента, ScrollView профиля
   * размонтировался, и по «назад» профиль собирался заново — с самого верха.
   * Открыл событие из Memories внизу профиля, вернулся — и листай обратно.
   * Под слоем профиль остаётся смонтированным и помнит, где был.
   */
  const eventFeedOverlay = showEventFeed ? (
      <View
        style={[styles.container, StyleSheet.absoluteFillObject, { zIndex: 20, elevation: 20 }]}
        {...feedSwipeResponder.panHandlers}
      >
        <TouchableOpacity 
          style={styles.backToProfile}
          onPress={closeEventFeed}
        >
          <Text style={styles.backText}>{t.profile.backToProfile}</Text>
        </TouchableOpacity>
        <FlatList
          ref={feedListRef}
          // Точные смещения: высоты карточек вычислимы (см. FEED_EVENT_H /
          // FEED_FOLDER_H). Без getItemLayout список не знал, где что лежит,
          // и прокрутка к дальней карточке промахивалась.
          getItemLayout={(data, index) => {
            let offset = 0;
            for (let i = 0; i < index; i++) {
              offset += feedItemHeight((data as typeof itemsToShow)[i]);
            }
            const length = feedItemHeight((data as typeof itemsToShow)[index]);
            return { length, offset, index };
          }}
          // Лента сразу открывается на выбранной карточке, а не показывает
          // своё начало с последующим «перекидыванием».
          initialScrollIndex={selectedFeedIndex > 0 ? selectedFeedIndex : undefined}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              feedListRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: false,
              });
            }, 50);
          }}
          data={itemsToShow}
          keyExtractor={(item) => item.type === 'folder' ? `folder-${(item.data as EventFolder).id}` : (item.data as Event).id}
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={true}
          renderItem={({ item, index }) => {
            if (item.type === 'folder') {
              const folder = item.data as EventFolder;
              return (
                <View
                  style={[styles.feedItemWrapper, { height: FEED_FOLDER_BLOCK_H }]}
                  pointerEvents="box-none"
                >
                  <FolderCard
                    folder={folder}
                    onPress={() => router.push(`/event-folder/${folder.id}`)}
                    variant="feed"
                  />
                </View>
              );
            }
            const event = item.data as Event;
            return (
              <View style={[styles.eventCardWrapper, { height: FEED_EVENT_BLOCK_H }]}>
                <EventCard
                  id={event.id}
                  title={event.title}
                  description={event.description}
                  date={event.date}
                  time={event.time}
                  displayDate={event.displayDate}
                  location={event.location}
                  price={event.price}
                  participants={event.participants}
                  maxParticipants={event.maxParticipants}
                  organizerAvatar={event.organizerAvatar}
                  organizerId={event.organizerId}
                  variant="default"
                  showSwipeAction={true}
                  // Это лента своего профиля: при context="explore" для участника
                  // кнопок нет вовсе, поэтому «Отменить участие» не появлялась
                  context="own_profile"
                  mediaUrl={event.mediaUrl}
                  mediaType={event.mediaType}
                  mediaAspectRatio={event.mediaAspectRatio}
                  participantsList={event.participantsList}
                  participantsData={event.participantsData}
                />
              </View>
            );
          }}
        />

        {/* Панель действий в режиме select */}
        {selectMode && (
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSelect}>
              <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
              onPress={handleDeleteSelectedEvents}
              disabled={selectedEventIds.size === 0}
            >
              <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>
                {t.common.delete} ({selectedEventIds.size})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
              onPress={handleCreateFolder}
              disabled={selectedEventIds.size === 0}
            >
              <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>
                {t.folder.createTitle} ({selectedEventIds.size})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Модальное окно создания папки */}
      </View>
  ) : null;

  return (
    <View style={styles.container}>
      <TopBar
        searchPlaceholder={t.profile.searchPlaceholderMy}
        onSearchChange={handleProfileSearch}
        searchQuery={searchQuery}
        showCalendar={true}
        showMap={true}
        onSettingsPress={Platform.OS === 'web' ? undefined : () => {
          logger.debug('Navigating to settings');
          try {
            router.push('/settings');
          } catch (error) {
            logger.error('Error navigating to settings:', error);
          }
        }}
      />

      {showComplaintsToast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.complaintsToast, { opacity: complaintsToastOpacity }]}
        >
          <Text style={styles.complaintsToastText}>{t.profile.complaintsInDevelopment}</Text>
        </Animated.View>
      )}

      <View style={{ flex: 1 }}>
      <ScrollView
        ref={profileScrollViewRef}
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8D32" />}
        contentContainerStyle={[
          styles.scrollContentContainer,
          selectMode && { paddingBottom: 200 } // Дополнительный отступ когда активен режим выбора
        ]}
      >
        {/* Информация о пользователе */}
        <View style={styles.userProfileContainer}>
        {/* Аватарка и кнопка настроек */}
        {Platform.OS === 'web' ? (
          // Веб: аватарка по центру, минималистичный карандаш справа от неё
          <View style={styles.avatarContainerWeb}>
            <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
              <Image 
                source={{ uri: sizedImage(userData.avatar, 100) }} 
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingsButtonWeb}
              onPress={() => {
                logger.debug('Navigating to settings');
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.location.href = '/settings';
                } else {
                  try {
                    router.push('/settings');
                  } catch (error) {
                    logger.error('Error navigating to settings:', error);
                  }
                }
              }}
            >
              <AppIcon name="edit" size={16} color={Palette.text} />
            </TouchableOpacity>
          </View>
        ) : (
          // Мобильные платформы: настройки переехали в TopBar (в ряд с calendar/map),
          // раньше шестерёнка лежала прямо на аватарке отдельным оверлеем
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
              <Image
                source={{ uri: sizedImage(userData.avatar, 100) }}
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Юзернейм */}
        <Text style={styles.username}>{formatUsername(userData.username)}</Text>
        
        {/* Имя и возраст */}
        <Text style={styles.nameAndAge}>{formatNameAndAge(userData.name, userData.age, t.events.yearsOld)}</Text>
        
        {/* О себе — длинные био сворачиваем, чтобы не ломать вёрстку (см. OrganizerCard) */}
        {!!userData.bio && (
          bioExpanded ? (
            <TouchableOpacity onPress={() => setBioExpanded(false)} activeOpacity={0.7}>
              <Text style={styles.bio}>{userData.bio}</Text>
              <Text style={styles.bioMore}>{t.common.showLess}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setBioExpanded(true)} activeOpacity={0.7}>
              <Text style={styles.bio} numberOfLines={3}>{userData.bio}</Text>
              {userData.bio.length > 80 && (
                <Text style={styles.bioMore}>{t.common.showMore}</Text>
              )}
            </TouchableOpacity>
          )
        )}
        
        {/* Статистика - все сразу без раскрытия */}
        <View style={styles.statsContainer}>
          {/* Первый ряд */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => {
              try {
                expoRouter.push(`/all-events/${currentUserId}`);
              } catch (error) {
                logger.error('Failed to navigate to all-events:', error);
              }
            }}>
              <Text style={styles.statNumber}>{allUserEventsForStats.length}</Text>
              <Text style={styles.statLabel}>{t.profile.statsEvents}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => {
              try {
                expoRouter.push('/friends-list');
              } catch (error) {
                logger.error('Failed to navigate to friends-list:', error);
              }
            }}>
              {/* Считаем по локальному списку друзей, а не по мемоизированной
                  статистике: список обновляется сразу после принятия заявки,
                  и счётчик перестаёт «отставать» до перезахода в приложение. */}
              <Text style={styles.statNumber}>{serverFriendsCount ?? friends?.length ?? organizerStats?.friends ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsFriends}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={handleComplaintsPress}>
              <Text style={styles.statNumber}>{organizerStats?.complaints ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsComplaints}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Второй ряд скрыт: счётчики Organized/Participated временно не показываем.
              Код сохранён — при необходимости достаточно вернуть SHOW_ORG_PART в true. */}
          {SHOW_ORG_PART && (
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => {
                try {
                  expoRouter.push(`/organized-events/${currentUserId}`);
                } catch (error) {
                  logger.error('Failed to navigate to organized-events:', error);
                }
              }}>
                <Text style={styles.statNumber}>{allOrganizedEvents.length}</Text>
                <Text style={styles.statLabel}>{t.profile.statsOrganized}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.statItem} onPress={() => {
                try {
                  expoRouter.push(`/participated-events/${currentUserId}`);
                } catch (error) {
                  logger.error('Failed to navigate to participated-events:', error);
                }
              }}>
                <Text style={styles.statNumber}>{allParticipatedEvents.length}</Text>
                <Text style={styles.statLabel}>{t.profile.statsParticipated}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Результаты поиска или обычные разделы */}
      {searchQuery ? (
        <View style={styles.searchResults}>
          <Text style={styles.searchResultsTitle}>{t.profile.searchResults}</Text>
          <View style={styles.eventsContainer}>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event, index) => {
                const gap = 8; // Отступ между карточками
                const isLastInRow = (index + 1) % 3 === 0;
                
                return (
                  <View
                    key={event.id}
                    style={[
                      { 
                        width: Platform.OS === 'web' ? '31%' : (SCREEN_WIDTH - 40 - 16) / 3,
                        flexBasis: Platform.OS === 'web' ? '31%' : (SCREEN_WIDTH - 40 - 16) / 3,
                        flexShrink: 0,
                        flexGrow: 0,
                        maxWidth: Platform.OS === 'web' ? '31%' : (SCREEN_WIDTH - 40 - 16) / 3,
                      },
                      !isLastInRow && { marginRight: gap },
                      { marginBottom: gap }
                    ]}
                  >
                    <EventCard
                      id={event.id}
                      title={event.title}
                      description={event.description}
                      date={event.date}
                      time={event.time}
                      displayDate={event.displayDate}
                      location={event.location}
                      price={event.price}
                      participants={event.participants}
                      maxParticipants={event.maxParticipants}
                      organizerAvatar={event.organizerAvatar}
                      organizerId={event.organizerId}
                      variant="miniature_1"
                      showSwipeAction={false}
                      showOrganizerAvatar={false}
                      mediaUrl={event.mediaUrl}
                      mediaType={event.mediaType}
                      mediaAspectRatio={event.mediaAspectRatio}
                      participantsList={event.participantsList}
                      participantsData={event.participantsData}
                      onMiniaturePress={getFilteredPress(event.id)}
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>{t.profile.eventsNotFound}</Text>
            )}
          </View>
        </View>
      ) : (
        <>
          {/* Сетка разбита на секции как в чужом профиле.
              Папки живут только в Memories; в папку можно класть
              только прошедшие события, поэтому чекбокс есть лишь у них. */}
          {(() => {
            // Раскладка вынесена в общий компонент ProfileEventsGrid —
            // тот же используется в профиле другого пользователя, чтобы
            // сетки этих двух экранов больше не расходились.
            type GridItem = { type: 'event' | 'folder'; data: any; sortKey?: number };

            const renderGrid = (items: GridItem[]) => (
              <ProfileEventsGrid
                items={items as any}
                emptyText={t.empty.noEvents}
                emptyTextStyle={styles.emptyText}
                screenWidth={SCREEN_WIDTH}
                onFolderPress={(folder) => router.push(`/event-folder/${folder.id}`)}
                onEventPress={(event) => getGridPress(event.id)}
                onEventLongPress={(event) => getGridLongPress(event.id)}
                renderEventOverlay={(event) => {
                  if (!selectMode) {
                    /**
                     * Значок видимости. Два источника, вид один:
                     *  - личная настройка прошедшего события («видно только
                     *    мне» в трёх точках);
                     *  - видимость самого события, выбранная при создании.
                     * Для человека это одно и то же состояние, поэтому и
                     * значок одинаковый; личная настройка приоритетнее.
                     */
                    const kind =
                      memoryVisibility?.[event.id] ?? eventVisibilityBadgeKind(event);
                    return kind ? <MemoryVisibilityBadge kind={kind} /> : null;
                  }
                  const isSelected = selectedEventIds.has(event.id);
                  const selectable = pastEventIds.has(event.id);
                  if (!selectable) {
                    // Недоступные для выбора — приглушаем, но без чекбокса
                    return (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)' }} pointerEvents="none" />
                    );
                  }
                  return (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, borderWidth: isSelected ? 3 : 0, borderColor: '#FF8D32', backgroundColor: isSelected ? 'transparent' : 'rgba(0,0,0,0.45)' }} pointerEvents="none">
                      <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: isSelected ? '#FF8D32' : 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: isSelected ? 0 : 1, borderColor: 'rgba(255,255,255,0.4)' }}>
                        {isSelected && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
                      </View>
                    </View>
                  );
                }}
              />
            );

            const organizerItems: GridItem[] = organizedEvents.map((e: Event) => ({ type: 'event', data: e }));
            const participantItems: GridItem[] = participatedEvents
              .filter((e: Event) => !organizedEvents.find((o: Event) => o.id === e.id))
              .map((e: Event) => ({ type: 'event', data: e }));
            // Папка встаёт в сетке по своему самому свежему событию —
            // как актуальное в сторис. Добавили недавнее событие — папка
            // поднялась наверх; добавили старое — осталась ниже.
            const timeOf = eventSortTime;
            const folderTime = folderSortTime;

            const memoriesItems: GridItem[] = [
              ...pastEvents.map((e: Event) => ({ type: 'event' as const, data: e, sortKey: timeOf(e) })),
              ...((eventFolders?.length > 0)
                ? eventFolders.map((f: EventFolder) => ({ type: 'folder' as const, data: f, sortKey: folderTime(f) }))
                : []),
            ].sort((a, b) => b.sortKey - a.sortKey);

            return (
              <>
                <Text style={styles.sectionTitle}>{t.profile.sectionTitleOrganizer}</Text>
                {renderGrid(organizerItems)}

                <Text style={styles.sectionTitle}>{t.profile.sectionTitleParticipant}</Text>
                {renderGrid(participantItems)}

                <Text style={styles.memoriesTitle}>{t.profile.memories}</Text>
                {renderGrid(memoriesItems)}
              </>
            );
          })()}


        </>
      )}
      </ScrollView>
      </View>

      {/* Панель действий в режиме select - в основном профиле */}
      {!showEventFeed && selectMode && (
        <View style={styles.actionBar} pointerEvents="auto">
          {(() => {
            logger.debug('Rendering action bar', { 
              selectMode, 
              showEventFeed, 
              selectedCount: selectedEventIds.size,
              hasEventFolders: eventFolders && Array.isArray(eventFolders) && eventFolders.length > 0
            });
            return null;
          })()}
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSelect}>
            <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
            onPress={handleDeleteSelectedEvents}
            disabled={selectedEventIds.size === 0}
          >
            <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>
              {t.common.delete} ({selectedEventIds.size})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
            onPress={handleCreateFolder}
            disabled={selectedEventIds.size === 0}
          >
            <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit>
              {eventFolders && Array.isArray(eventFolders) && eventFolders.length > 0 ? t.profile.toFolder : t.profile.createFolderAction} ({selectedEventIds.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Модальное окно создания папки */}
      <CreateFolderModal
        visible={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onSubmit={handleCreateFolderSubmit}
      />

      {/* Модальное окно выбора папки для перемещения событий */}
      <AddToFolderModal
        visible={showAddToFolderModal}
        eventIds={Array.from(selectedEventIds)}
        onClose={() => {
          setShowAddToFolderModal(false);
          setSelectedFolderIds(new Set());
        }}
        onCreateNewFolder={() => {
          setShowAddToFolderModal(false);
          setTimeout(() => setShowCreateFolderModal(true), 300);
        }}
        onSubmit={async (folderIds: string[]) => {
          try {
            const errors: string[] = [];
            for (const folderId of folderIds) {
              for (const eventId of Array.from(selectedEventIds)) {
                try {
                  await addEventToFolder(folderId, eventId);
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : t.events.unknownError;
                  logger.error(`Failed to add event ${eventId} to folder ${folderId}:`, error);
                  errors.push(errorMessage);
                }
              }
            }

            if (errors.length > 0) {
              Alert.alert(t.profile.partialError, `${t.profile.someEventsNotAdded}\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`);
            } else {
              Alert.alert(
                t.common.done,
                t.profile.eventsAddedToFolders
                  .replace('{count}', String(folderIds.length))
                  .replace('{word}', folderIds.length === 1 ? t.profile.folderWordOne : t.profile.folderWordMany),
              );
            }
            await refreshEventFolders();
            setShowAddToFolderModal(false);
            setSelectMode(false);
            setSelectedEventIds(new Set());
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t.profile.failedToAddEventsToFolder;
            logger.error('Failed to add events to folders:', error);
            Alert.alert(t.common.error, errorMessage);
          }
        }}
      />

      {/* Модальное окно для аватарки */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <TouchableOpacity 
          style={styles.avatarModalOverlay}
          activeOpacity={1}
          onPress={() => setShowAvatarModal(false)}
        >
          <View style={styles.avatarModalContent}>
            {/* Аватарка во весь экран. 100 сюда попало при массовой замене на
                уменьшенные варианты — это ширина кружка в шапке, а не в модалке.
                Просим полный размер, иначе картинка мылит. */}
            <Image
              source={{ uri: sizedImage(userData.avatar, 320) }}
              style={styles.avatarModalImage}
              resizeMode="cover"
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {eventFeedOverlay}
    </View>
  );
}

const styles = profileStyles;
