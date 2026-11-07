import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, TextInput, Modal, Dimensions, Platform, PanResponder, Alert, Animated } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '../utils/safeRouter';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStableItemHandler } from '../hooks/useStableItemHandler';
import { useFocusEffect } from 'expo-router';
import EventCard from '../components/EventCard';
import MemoryMiniCard from '../components/MemoryMiniCard';
import TopBar from '../components/TopBar';
import ComplaintForm from '../components/ComplaintForm';
import { useEvents, Event } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { cacheKey, writeQueryCache } from '../utils/queryCache';
import { useLanguage } from '../context/LanguageContext';
import { createLogger } from '../utils/logger';
import { matchesSearchQuery } from '../utils/searchMatch';
import type { EventFolder } from '../types/EventFolder';
import { apiRequest } from '../services/api';
import { AppIcon } from '../components/ui/AppIcon';
import EventShareModal from '../components/EventShareModal';
import { Palette } from '../constants/DesignSystem';
import { formatNameAndAge } from '../utils/username';
import ProfileEventsGrid from '../components/ProfileEventsGrid';
import { eventSortTime, folderSortTime } from '../utils/profileSort';
import { collectFolderEventIds } from '../utils/folderEventIds';
import { sizedImage } from '../utils/imageSize';

const logger = createLogger('OtherProfile');

/** Счётчики Organized/Participated временно скрыты — как в своём профиле
 *  и в карточке организатора. Вернуть: переключить в true. */
const SHOW_ORG_PART = false;

// Для веб-версии используем ограниченную ширину контейнера (500px), для мобильных - полную ширину экрана
const getContainerWidth = () => {
  const screenWidth = Dimensions.get('window').width;
  if (Platform.OS === 'web') {
    return Math.min(screenWidth, 500);
  }
  return screenWidth;
};
const SCREEN_WIDTH = getContainerWidth();

export default function OtherProfileScreen() {
  // from — раздел, из которого открыт профиль: нижняя панель должна
  // подсвечивать его, а не Profile (это чужой аккаунт, не свой)
  const { id, eventId, from } = useLocalSearchParams();
  const router = useSafeRouter();
  const { events, eventProfiles, getUserData: contextGetUserData, fetchUserById, getOrganizerStats, getFriendsList, getEventProfile, createEventProfile, fetchEventProfile, sendFriendRequest, removeFriend, isFriend, userFolders, addUserToFolder, removeUserFromFolder, createPersonalChat, getChatsForUser, isUserParticipant, isEventUpcoming, isEventPast, isUserOrganizer, isUserAttendee, isUserEventMember, friendRequests, respondToFriendRequest, getUserRequestStatus, getUserFriendsList, messageFolders, addChatsToMessageFolder, removeChatFromMessageFolder, syncFriendRequestsFromServer } = useEvents();
  const { user: authUser, accessToken } = useAuth();
  const { t } = useLanguage();
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMessageFolderModal, setShowMessageFolderModal] = useState(false);
  const [messageFolderChatId, setMessageFolderChatId] = useState<string | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [showProfileActionsModal, setShowProfileActionsModal] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [organizerStats, setOrganizerStats] = useState<{ complaints: number; friends: number } | null>(null);

  /**
   * Плашка «в разработке» на счётчике жалоб — такая же, как в своём профиле.
   * Страница жалоб пока заморожена, и тап без всякой реакции читается как
   * поломка; здесь его вообще не было.
   */
  const [showComplaintsToast, setShowComplaintsToast] = useState(false);
  const complaintsToastOpacity = useRef(new Animated.Value(0)).current;
  const handleComplaintsPress = useCallback(() => {
    setShowComplaintsToast(true);
    Animated.sequence([
      Animated.timing(complaintsToastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(complaintsToastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowComplaintsToast(false));
  }, [complaintsToastOpacity]);
  const [userEventFolders, setUserEventFolders] = useState<EventFolder[]>([]);
  const [hiddenMemoryIds, setHiddenMemoryIds] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState(false);
  
  const rawUserId = Array.isArray(id) ? id[0] : id;
  const currentUserId = authUser?.id ?? null;
  const userId = rawUserId ?? currentUserId ?? 'organizer-1';
  const userData = contextGetUserData(userId);

  // Свой профиль на этом экране открываться не должен — для него есть таб
  // профиля со своими папками и настройками. Если сюда всё же попали (старая
  // ссылка, диплинк), убираем экран ИЗ СВОЕГО стека и только потом
  // переключаем таб.
  //
  // Раньше здесь был просто router.replace на таб профиля. С постабными
  // стеками (CLAUDE.md §1.1) экран при этом ОСТАВАЛСЯ смонтированным в стеке
  // раздела, и каждое возвращение в раздел заново выкидывало на профиль —
  // со стороны это выглядело как «профиль открылся восемь раз подряд».
  const ownProfileRedirected = useRef(false);
  useEffect(() => {
    if (ownProfileRedirected.current) return;
    if (!rawUserId || !currentUserId || rawUserId !== currentUserId) return;
    ownProfileRedirected.current = true;
    // На вебе стека разделов нет, а router.back() — это история браузера, и
    // возврат срабатывает асинхронно: он может выполниться ПОСЛЕ push и
    // унести на предыдущую страницу (например, на создание события). Поэтому
    // здесь просто подменяем адрес, без возврата.
    if (Platform.OS === 'web') {
      router.replace('/profile');
      return;
    }
    if (router.canGoBack()) router.back();
    router.push('/profile');
  }, [rawUserId, currentUserId, router]);

  /**
   * Полный профиль с сервера — он же единственный источник правды про дружбу.
   *
   * Из списков друзей/участников приходят только id/имя/username/аватар, так
   * что возраст и «о себе» без этого запроса не показать. А ещё сервер отдаёт
   * friendshipStatus и friendsCount: раньше экран собирал их сам из трёх
   * локальных списков и постоянно ошибался — показывал «+» тому, кто уже в
   * друзьях, а после «принять» снова «+», потому что список друзей отставал.
   */
  /**
   * Ответ кэшируется, поэтому уже открывавшийся профиль рисуется сразу — с
   * правильной кнопкой и правильным счётчиком, — а запрос уходит фоном и молча
   * обновляет данные, если они изменились. Раньше экран каждый раз начинал с
   * состояния, собранного из локальных списков, и у человека, который УЖЕ в
   * друзьях, на долю секунды мелькал «+».
   */
  const { data: serverProfile, refresh: reloadServerProfile } = useCachedQuery<{
    friendshipStatus?: 'none' | 'friends' | 'outgoing' | 'incoming';
    friendsCount?: number;
    friendRequestId?: string | null;
    /** Блокировка в любую сторону: контент скрыт у обоих. */
    isBlocked?: boolean;
    /** Заблокировал я — значит я же могу и снять. */
    blockedByMe?: boolean;
  }>(
    rawUserId ? cacheKey(currentUserId, 'profile', rawUserId) : null,
    () => fetchUserById(userId, { force: true }),
    { auto: false },
  );

  // Загружаем статистику при монтировании и обновлении
  useEffect(() => {
    if (userId) {
      const stats = getOrganizerStats(userId);
      setOrganizerStats({ complaints: stats.complaints, friends: stats.friends });
    }
  }, [userId, getOrganizerStats]); // getOrganizerStats уже зависит от userFriendsMap внутри
  
  /**
   * Заявки в друзья перечитываем при каждом открытии чужого профиля.
   *
   * Иначе список берётся из того, что было загружено при старте приложения
   * или прилетело сокетом: если заявку прислали, пока приложение было
   * закрыто или без сети, кнопка показывала обычный «+» вместо «принять».
   */
  const syncRequestsRef = useRef(syncFriendRequestsFromServer);
  syncRequestsRef.current = syncFriendRequestsFromServer;
  const reloadProfileRef = useRef(reloadServerProfile);
  reloadProfileRef.current = reloadServerProfile;

  useFocusEffect(
    useCallback(() => {
      // Через ref: обе функции меняют ссылку при каждом обновлении сессии,
      // и в зависимостях они превращали эффект в цикл запросов.
      syncRequestsRef.current?.().catch(() => undefined);
      reloadProfileRef.current();
      // Пока человек читает профиль, тянем и список его друзей: к моменту
      // нажатия на счётчик список уже в кэше и открывается без ожидания.
      if (rawUserId && accessToken) {
        apiRequest(`/friends/user/${rawUserId}`, {}, accessToken)
          .then(data => {
            if (Array.isArray(data)) {
              writeQueryCache(cacheKey(currentUserId, 'friends', rawUserId), data);
            }
          })
          .catch(() => undefined);
      }
    }, [rawUserId, accessToken, currentUserId]),
  );

  // Проверяем, есть ли входящий запрос в друзья от этого пользователя
  const incomingFriendRequest = friendRequests.find(
    req => req.fromUserId === userId &&
           req.toUserId === currentUserId &&
           req.status === 'pending'
  );

  // Проверяем, есть ли исходящий запрос (мы уже отправили)
  const outgoingFriendRequest = friendRequests.find(
    req => req.fromUserId === currentUserId &&
           req.toUserId === userId &&
           req.status === 'pending'
  );
  
  /**
   * Что показывать на кнопке.
   *
   * Ответ сервера главнее: локальные списки друзей и заявок обновляются
   * асинхронно и в разном порядке, и именно из-за этого кнопка «прыгала».
   * Пока ответа нет (первое открытие, нет сети) — падаем на локальные данные,
   * чтобы экран не выглядел пустым.
   */
  const serverStatus = serverProfile?.friendshipStatus;
  const isFriendNow = serverStatus ? serverStatus === 'friends' : isFriend(userId);
  const hasIncomingRequest = serverStatus
    ? serverStatus === 'incoming'
    : Boolean(incomingFriendRequest);
  const hasOutgoingRequest = serverStatus
    ? serverStatus === 'outgoing'
    : Boolean(outgoingFriendRequest);

  // Обработчик принятия запроса в друзья
  const handleAcceptFriendRequest = async () => {
    const requestId = serverProfile?.friendRequestId ?? incomingFriendRequest?.id;
    if (!requestId) return;
    await respondToFriendRequest(requestId, true);
    await reloadServerProfile();
  };

  const handleSendFriendRequest = async () => {
    await sendFriendRequest(userId);
    await reloadServerProfile();
  };

  // Имя для диалогов подтверждения.
  const displayName = userData?.name || userData?.username || '';

  /**
   * Удаление из друзей — только после подтверждения.
   *
   * Кнопка — крестик рядом с «написать», промахнуться по нему легко, а друг
   * удалялся с первого касания.
   */
  const handleRemoveFriend = () => {
    Alert.alert(
      t.profile.removeFriendTitle,
      t.profile.removeFriendConfirm.replace('{name}', displayName),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.profile.removeFriendAction,
          style: 'destructive',
          onPress: async () => {
            await removeFriend(userId);
            await reloadServerProfile();
          },
        },
      ],
    );
  };

  /**
   * Отозвать свою заявку в друзья.
   *
   * Раньше на месте кнопки стояли неактивные часы: отправленную по ошибке
   * заявку вернуть было нельзя. Сервер отзывает её тем же DELETE /friends/:id
   * и заодно убирает уведомление о ней у адресата.
   */
  const handleCancelFriendRequest = () => {
    Alert.alert(
      t.profile.cancelFriendRequestTitle,
      t.profile.cancelFriendRequestConfirm.replace('{name}', displayName),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.profile.cancelFriendRequestAction,
          style: 'destructive',
          onPress: async () => {
            await removeFriend(userId);
            await reloadServerProfile();
          },
        },
      ],
    );
  };

  // Инициализируем выбранные папки при открытии модального окна
  useEffect(() => {
    if (showFolderModal) {
      // Получаем папки, в которых уже есть этот пользователь
      const currentFolders = userFolders
        .filter(folder => folder.userIds.includes(userId))
        .map(folder => folder.id);
      setSelectedFolders(currentFolders);
    }
  }, [showFolderModal, userId, userFolders]);
  
  // Функция поиска для профиля
  const handleProfileSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Функция для открытия личного чата
  const handleMessagePress = async () => {
    try {
      // Создаем или находим личный чат с пользователем
      const chatId = await createPersonalChat(userId);
      // Переходим к чату
      router.push(`/(tabs)/inbox/${chatId}`);
    } catch (error) {
      logger.error('Failed to create personal chat', error);
    }
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
  
  // ОРГАНИЗАТОР: предстоящее && я_организатор (для наблюдаемого пользователя) - для отображения в профиле
  const organizedEvents = events.filter(event => {
    // Статус ЗРИТЕЛЯ тут больше не проверяется. Отмена своего участия
    // проставляет мне синтетическую заявку 'rejected' (чтобы событие не
    // возвращалось в мою ленту) — и по ней событие пропадало из профиля
    // ОРГАНИЗАТОРА, хотя к его собственным событиям моё участие отношения
    // не имеет.
    return isEventUpcoming(event) && isUserOrganizer(event, userId);
  });
  
  // УЧАСТНИК: предстоящее && я_участник (именно участник, не организатор) - для отображения в профиле
  const participatedEvents = events.filter(event => {
    // Участие ВЛАДЕЛЬЦА профиля не зависит от того, отменил ли своё участие
    // зритель, — проверка статуса зрителя убрана (см. organizedEvents выше).
    const result = isEventUpcoming(event) && isUserAttendee(event, userId);
    if (result) {
      logger.debug('Event is in participatedEvents', { eventId: event.id, eventTitle: event.title, userId });
    }
    return result;
  });

  // Для подсчета параметров: все события (текущие и прошлые)
  // Единый принцип: для прошедших — организатор или profile.participants
  const allOrganizedEvents = events.filter(event =>
    isUserOrganizer(event, userId)
  );

  const allParticipatedEvents = events.filter(event => {
    if (isEventPast(event)) {
      if (isUserOrganizer(event, userId)) return false;
      const profile = eventProfiles.find(p => p.eventId === event.id);
      if (!profile) return false;
      return profile.participants.includes(userId);
    }
    return isUserAttendee(event, userId);
  });

  const allUserEvents = [...allOrganizedEvents, ...allParticipatedEvents].filter(
    (event, index, self) => self.findIndex(e => e.id === event.id) === index
  );

  /**
   * id событий, разложенных по папкам этого пользователя.
   *
   * Событие, убранное в папку, из общей сетки уходит — папка и есть его
   * место. В своём профиле так было всегда (eventsInFolders в profile.tsx), а
   * здесь фильтрации не было вовсе, и карточка стояла дважды: и в папке, и
   * рядом с ней.
   */
  const foldedEventIds = useMemo(
    () => collectFolderEventIds(userEventFolders),
    [userEventFolders],
  );

  // МЕМОРИ: прошедшее && (организатор ИЛИ участник по profile.participants)
  const pastEvents = events.filter(event => {
    if (!isEventPast(event)) return false;
    if (foldedEventIds.has(event.id)) return false;
    // Спрятано настройкой видимости самого владельца профиля.
    if (hiddenMemoryIds.has(event.id)) return false;
    /**
     * Состав прошедшего события решает его профиль: participants приходит с
     * сервера уже без вышедших, и организатор в нём тоже есть.
     *
     * Пометка formerParticipants для этого не годится — сервер отдаёт её
     * только участникам события, а чужому зрителю профиля не отдаёт вовсе.
     */
    const profile = eventProfiles.find(p => p.eventId === event.id);
    if (!profile) return isUserOrganizer(event, userId);
    return profile.participants.includes(userId);
  }).sort((a, b) => {
    // Сортируем по дате+времени события: самое последнее прошедшее первым
    const dateA = new Date(a.date + 'T' + a.time + ':00').getTime();
    const dateB = new Date(b.date + 'T' + b.time + ':00').getTime();
    return dateB - dateA; // Убывание: последнее первым
  });

  // Все события пользователя для ленты (предстоящие: организатор + участник)
  const userEvents = [...organizedEvents, ...participatedEvents].filter((event, index, self) => 
    index === self.findIndex(e => e.id === event.id)
  );
  
  // Загружаем профили для прошедших событий при открытии профиля
  // Это нужно, чтобы правильно определить, какие события показывать в разделе "меморис"
  // Используем ref для отслеживания уже загруженных профилей
  const loadedProfilesRef = useRef<Set<string>>(new Set());
  
  const loadProfilesForPastEvents = useCallback(async () => {
    if (!fetchEventProfile || events.length === 0) return;
    const pastEvents = events.filter(event => isEventPast(event));
    for (const event of pastEvents) {
      if (loadedProfilesRef.current.has(event.id)) continue;
      // Помечаем ДО запроса, а не после успеха. Иначе при ошибке (например,
      // сервер ответил 429 при всплеске) отметка не ставилась, и следующий
      // прогон снова слал запрос по тому же событию — так набегала лавина.
      loadedProfilesRef.current.add(event.id);
      try {
        await fetchEventProfile(event.id);
      } catch {}
    }
  }, [events, isEventPast, fetchEventProfile]);

  useEffect(() => { loadProfilesForPastEvents(); }, [loadProfilesForPastEvents]);
  useFocusEffect(useCallback(() => { loadProfilesForPastEvents(); }, [loadProfilesForPastEvents]));

  /**
   * Что этот человек спрятал у себя в «меморис».
   *
   * Видимость прошедшего события — личная настройка его профиля: «только мне»
   * или «только друзьям». Решение принимает сервер (он знает, друзья ли мы),
   * сюда приезжает уже готовый список того, что показывать нельзя.
   */
  useEffect(() => {
    let cancelled = false;
    const loadHiddenMemories = async () => {
      if (!userId || !accessToken) return;
      try {
        const response = await apiRequest(`/events/memory-visibility/${userId}`, {}, accessToken);
        const hidden = Array.isArray(response?.hiddenEventIds) ? response.hiddenEventIds : [];
        if (!cancelled) setHiddenMemoryIds(new Set(hidden));
      } catch (error) {
        logger.warn('Не удалось загрузить видимость прошедших событий', error);
      }
    };
    loadHiddenMemories();
    return () => {
      cancelled = true;
    };
  }, [userId, accessToken]);

  // Загружаем папки просматриваемого пользователя
  useEffect(() => {
    const loadUserFolders = async () => {
      logger.debug('loadUserFolders called', { 
        userId, 
        currentUserId, 
        hasAccessToken: !!accessToken,
        userIdsMatch: userId === currentUserId
      });
      
      if (!userId) {
        logger.warn('loadUserFolders: нет userId');
        return;
      }
      
      if (!accessToken) {
        logger.warn('loadUserFolders: нет accessToken');
        return;
      }

      // Не загружаем папки для текущего пользователя (они уже загружены через EventsContext)
      if (userId === currentUserId) {
        logger.debug('loadUserFolders: пропускаем загрузку для текущего пользователя');
        return;
      }

      setLoadingFolders(true);
      try {
        logger.debug('Загружаем папки пользователя', { userId, endpoint: `/event-folders/user/${userId}` });
        const response = await apiRequest(`/event-folders/user/${userId}`, {
          method: 'GET',
        }, accessToken);

        logger.debug('Ответ API для папок пользователя', { 
          userId, 
          responseType: typeof response,
          isArray: Array.isArray(response),
          foldersCount: Array.isArray(response) ? response.length : 0,
          responsePreview: Array.isArray(response) ? response.map((f: any) => ({ id: f.id, name: f.name })) : response
        });
        
        setUserEventFolders(Array.isArray(response) ? response : []);
      } catch (error: any) {
        logger.error('Ошибка загрузки папок пользователя:', { 
          error: error?.message || error,
          status: error?.status,
          userId 
        });
        setUserEventFolders([]);
      } finally {
        setLoadingFolders(false);
      }
    };

    loadUserFolders();
  }, [userId, currentUserId, accessToken]);
  
  // useEffect для автоматического открытия ленты при наличии eventId в URL (как в my-events.tsx)
  useEffect(() => {
    const eventIdValue = Array.isArray(eventId) ? eventId[0] : eventId;
    if (eventIdValue && userEvents.length > 0) {
      const targetEvent = userEvents.find(e => e.id === eventIdValue);
      if (targetEvent && !showEventFeed) {
        logger.debug('useEffect: Найден eventId в URL, открываем ленту', { eventId: eventIdValue });
        // Прокрутка не нужна: выбранное событие встаёт первым в eventsToShow
        setSelectedEvent(targetEvent);
        setShowEventFeed(true);
      }
    }
  }, [eventId, userEvents]);

  // Фильтрация событий по поиску
  const filteredEvents = searchUserEvents(userEvents, searchQuery);

  // Получаем общие события: где и я и он члены события
  const sharedEvents = events.filter(event => 
    currentUserId && isUserEventMember(event, currentUserId) && isUserEventMember(event, userId)
  );

  /**
   * Блокировка пользователя.
   *
   * Требование App Store (Guideline 1.2) для приложений с лентой и личной
   * перепиской. Действует в обе стороны: события и профили исчезают друг у
   * друга из лент и поиска, писать и звать на события нельзя, дружба и
   * висящие заявки снимаются на сервере.
   */
  const isBlockedProfile = !!serverProfile?.isBlocked;
  const blockedByMe = !!serverProfile?.blockedByMe;

  const handleToggleBlock = () => {
    if (!accessToken || !userId) return;
    const wasBlocked = blockedByMe;
    Alert.alert(
      wasBlocked ? t.profile.unblockTitle : t.profile.blockTitle,
      wasBlocked ? t.profile.unblockConfirm : t.profile.blockConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: wasBlocked ? t.profile.unblock : t.profile.block,
          style: wasBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await apiRequest(
                `/users/${userId}/block`,
                { method: wasBlocked ? 'DELETE' : 'POST' },
                accessToken,
              );
              await reloadServerProfile();
              if (!wasBlocked) {
                // Заблокировали — на его профиле больше делать нечего.
                router.back();
              }
            } catch (error) {
              logger.error('Не удалось изменить блокировку', error);
              Alert.alert(t.common.error, t.profile.blockFailed);
            }
          },
        },
      ],
    );
  };

  const handleMemoryPress = (eventId: string) => {
    // Находим событие в pastEvents
    const memoryEvent = pastEvents.find(e => e.id === eventId);
    if (!memoryEvent) return;
    
    // Прокрутка не нужна: выбранное событие встаёт первым в eventsToShow
    setSelectedEvent(memoryEvent);
    setShowEventFeed(true);
  };

  const handleMiniaturePress = useCallback((event: Event) => {
    logger.debug('handleMiniaturePress вызван для события', { eventId: event.id, eventTitle: event.title, showEventFeedBefore: showEventFeed });
    
    // КРИТИЧЕСКИ ВАЖНО: На вебе не используем router.setParams, только локальное состояние
    // Устанавливаем eventId в URL чтобы useEffect не закрывал ленту (только для мобильного)
    if (Platform.OS !== 'web' && router && typeof router.setParams === 'function') {
      try {
        router.setParams({ eventId: event.id as any });
      } catch (error) {
        logger.warn('Failed to set params:', error);
      }
    }
    
    setSelectedEvent(event);
    setShowEventFeed(true);

    // Прокрутки здесь больше нет: выбранное событие переставляется в начало
    // ленты (см. eventsToShow), поэтому она открывается сразу на нужной
    // карточке — без задержки и «подкрута».
  }, [router]);

  // Стабильные ссылки на секцию — инлайновая стрелка сбрасывала memo
  // у всех карточек сетки при каждом рендере профиля
  const getFilteredPress = useStableItemHandler(filteredEvents, handleMiniaturePress);
  const getOrganizedPress = useStableItemHandler(organizedEvents, handleMiniaturePress);
  const getParticipatedPress = useStableItemHandler(participatedEvents, handleMiniaturePress);

  const handleFolderToggle = (folderId: string) => {
    setSelectedFolders(prev => 
      prev.includes(folderId) 
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  const handleSaveFolders = () => {
    // Получаем текущие папки пользователя
    const currentFolderIds = userFolders
      .filter(folder => folder.userIds.includes(userId))
      .map(folder => folder.id);

    // Удаляем из папок, которые были выбраны, но теперь не выбраны
    currentFolderIds.forEach(folderId => {
      if (!selectedFolders.includes(folderId)) {
        removeUserFromFolder(userId, folderId);
      }
    });

    // Добавляем в папки, которые теперь выбраны, но раньше не были
    selectedFolders.forEach(folderId => {
      if (!currentFolderIds.includes(folderId)) {
        addUserToFolder(userId, folderId);
      }
    });

    setShowFolderModal(false);
    setSelectedFolders([]);
  };

  // Выход из ленты профиля — общий для кнопки и для свайпа.
  const closeEventFeed = useCallback(() => {
    setShowEventFeed(false);
    setSelectedEvent(null);
    if (eventId && Platform.OS !== 'web' && router && typeof router.setParams === 'function') {
      try {
        router.setParams({ eventId: undefined as any });
      } catch (error) {
        logger.warn('Failed to clear params:', error);
      }
    }
    // Переход на маршрут профиля убран: лента — состояние внутри экрана,
    // и повторная навигация давала вторую отрисовку (профиль мелькал дважды).
  }, [eventId, router]);

  // Свайп вправо закрывает ленту: это состояние ВНУТРИ экрана, а не отдельный
  // маршрут, поэтому системный жест «назад» здесь не срабатывал.
  const feedSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          g.dx > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_e, g) => {
          if (g.dx > 60) closeEventFeed();
        },
      }),
    [closeEventFeed],
  );

  // Определяем какую коллекцию событий показывать в ленте
  const eventsToShow = useMemo(() => {
    const base = selectedEvent && pastEvents.find(e => e.id === selectedEvent.id)
      ? pastEvents
      : userEvents;

    // Порядок оставляем хронологическим: выбранную карточку НЕ поднимаем
    // наверх (так было раньше), а лента открывается на ней за счёт прокрутки
    // ниже — чтобы можно было листать и к более свежим, и к более старым.
    return base;
  }, [selectedEvent, pastEvents, userEvents]);

  // Позиции карточек в ленте меряем по факту (onLayout) — прикидочные
  // константы высоты раньше давали промах мимо нужного события.
  const feedItemOffsets = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!showEventFeed || !selectedEvent) return;
    const timer = setTimeout(() => {
      const y = feedItemOffsets.current[selectedEvent.id];
      if (typeof y === 'number' && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: Math.max(0, y - 80), animated: false });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [showEventFeed, selectedEvent, eventsToShow]);

  /**
   * Лента события — слоем ПОВЕРХ профиля, а не вместо него (как и в своём
   * профиле): при раннем return профиль размонтировался и по «назад»
   * открывался с самого верха, а не там, откуда перешли.
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
        <ScrollView 
          ref={scrollViewRef} 
          style={styles.feedContainer}
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={true}
          bounces={true}
          alwaysBounceVertical={true}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
        >
          {/* События пользователя */}
          {eventsToShow.map((event, index) => (
            <View 
              key={event.id} 
              style={[
                styles.eventCardWrapper,
                index === eventsToShow.length - 1 && styles.lastEventCard
              ]}
              // Запоминаем реальную позицию карточки, чтобы открыть ленту
              // ровно на выбранном событии (см. эффект прокрутки выше).
              onLayout={(e) => {
                feedItemOffsets.current[event.id] = e.nativeEvent.layout.y;
              }}
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
                variant="default"
                showSwipeAction={true}
                mediaUrl={event.mediaUrl}
                mediaType={event.mediaType}
                mediaAspectRatio={event.mediaAspectRatio}
                participantsList={event.participantsList}
                participantsData={event.participantsData}
                context="other_profile"
                viewerUserId={userId}
              />
            </View>
          ))}
        </ScrollView>
      </View>
  ) : null;

  const isWeb = Platform.OS === 'web';
  const containerStyle = isWeb ? [styles.container, styles.containerWeb] : styles.container;

  /**
   * Свой профиль этим экраном не рисуем НИКОГДА.
   *
   * Эффект выше уводит на таб профиля, но сам экран при этом остаётся в
   * стеке раздела (постабные стеки его не размонтируют) — и в инбоксе
   * висела устаревшая версия своего профиля: с шестерёнкой у аватарки и без
   * папок. Пустой экран вместо неё убирает это разом для всех точек входа,
   * а не для конкретной ссылки.
   */
  if (rawUserId && currentUserId && rawUserId === currentUserId) {
    return <View style={styles.container} />;
  }


  return (
    <View style={containerStyle}>
      {showComplaintsToast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.complaintsToast, { opacity: complaintsToastOpacity }]}
        >
          <Text style={styles.complaintsToastText}>{t.profile.complaintsInDevelopment}</Text>
        </Animated.View>
      )}
      <TopBar
        searchPlaceholder={t.profile.searchPlaceholderUser}
        onSearchChange={handleProfileSearch}
        searchQuery={searchQuery}
        showCalendar={true}
        showMap={true}
        userId={userId}
      />

      <View style={isWeb ? styles.scrollWrapperWeb : { flex: 1 }}>
      <ScrollView 
        style={isWeb ? styles.scrollContainerWeb : styles.scrollContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* Информация о пользователе */}
        <View style={styles.userProfileContainer}>
        {/* Аватарка и кнопка настроек */}
        {currentUserId && userId === currentUserId && isWeb ? (
          // Веб-версия собственного профиля: аватарка и минималистичный карандаш справа
          <View style={styles.avatarRowWeb}>
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
          // Мобильная версия собственного профиля и просмотр чужого профиля
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
              <Image 
                source={{ uri: sizedImage(userData.avatar, 100) }} 
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
            {/* Троеточие переехало в ряд действий ниже (к чату и «добавить
                в друзья») — под аватаркой оно висело отдельной третьей
                «линией» и ломало центровку шапки. */}
            {currentUserId && userId === currentUserId && (
              <TouchableOpacity 
                style={styles.settingsButton}
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
                <AppIcon name="settings" size={18} color={Palette.text} />
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Юзернейм */}
        <Text style={styles.username}>{userData.username}</Text>
        
        {/* Имя и возраст */}
        <Text style={styles.nameAndAge}>{formatNameAndAge(userData.name, userData.age, t.events.yearsOld)}</Text>
        
        {/* О себе */}
        {userData.bio && (
          <Text style={styles.bio}>{userData.bio}</Text>
        )}
        
        {/* Статистика - все сразу без раскрытия */}
        <View style={styles.statsContainer}>
          {/* Первый ряд */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/all-events/${userId}`)}>
              <Text style={styles.statNumber}>{allUserEvents.length}</Text>
              <Text style={styles.statLabel}>{t.profile.statsEvents}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/friends-list/${userId}`)}>
              <Text style={styles.statNumber}>{serverProfile?.friendsCount ?? organizerStats?.friends ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsFriends}</Text>
            </TouchableOpacity>
            
            {/* Своей страницы «чужие жалобы против X» не существует и не должно:
                это модерационные данные, а /my-complaints — МОИ поданные жалобы.
                Но молчаливое отсутствие реакции на тап выглядит поломкой, поэтому
                показываем ту же плашку «в разработке», что и в своём профиле. */}
            <TouchableOpacity style={styles.statItem} onPress={handleComplaintsPress}>
              <Text style={styles.statNumber}>{organizerStats?.complaints ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsComplaints}</Text>
            </TouchableOpacity>

            {/* "Shared" в первом ряду, а не в отдельном втором — тот почти
                всегда пустой (Organized/Participated скрыты SHOW_ORG_PART)
                и просто занимал лишнюю строку. Тот же фикс, что и в
                OrganizerCard. */}
            {currentUserId && userId !== currentUserId && (
              <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/shared-events/${userId}`)}>
                <Text style={styles.statNumber}>{sharedEvents.length}</Text>
                <Text style={styles.statLabel}>{t.profile.statsShared}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Organized/Participated скрыты флагом SHOW_ORG_PART, разметка сохранена */}
          {SHOW_ORG_PART && (
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/organized-events/${userId}`)}>
                <Text style={styles.statNumber}>{organizedEvents.length + pastEvents.filter(e => isUserOrganizer(e, userId)).length}</Text>
                <Text style={styles.statLabel}>{t.profile.statsOrganized}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/participated-events/${userId}`)}>
                <Text style={styles.statNumber}>{allParticipatedEvents.length}</Text>
                <Text style={styles.statLabel}>{t.profile.statsParticipated}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Кнопки действий */}
      <View style={styles.actionButtons}>
        {currentUserId && userId !== currentUserId && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleMessagePress}
          >
            <AppIcon name="message" size={16} color={Palette.text} />
          </TouchableOpacity>
        )}
        {currentUserId && userId !== currentUserId && (
          <>
            {!serverProfile ? (
              // Первое в жизни открытие этого профиля: данных ещё нет совсем.
              // Показывать заведомо неточную кнопку, чтобы через мгновение её
              // сменить, — хуже, чем занять место пустым блоком того же размера.
              <View style={[styles.actionButton, { opacity: 0 }]} />
            ) : isFriendNow ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.removeFriendButton]}
                onPress={handleRemoveFriend}
              >
                <AppIcon name="close" size={15} color={Palette.text} />
              </TouchableOpacity>
            ) : hasIncomingRequest ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptFriendButton]}
                onPress={handleAcceptFriendRequest}
              >
                <Text style={styles.acceptFriendButtonText}>{t.profile.acceptFriendRequest}</Text>
              </TouchableOpacity>
            ) : hasOutgoingRequest ? (
              <TouchableOpacity
                style={[styles.actionButton, { opacity: 0.6 }]}
                onPress={handleCancelFriendRequest}
                accessibilityLabel={t.profile.cancelFriendRequestTitle}
              >
                <AppIcon name="clock" size={15} color={Palette.textDim} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.addFriendButton]}
                onPress={handleSendFriendRequest}
              >
                <AppIcon name="plus" size={16} color={Palette.text} />
              </TouchableOpacity>
            )}
            {isFriendNow && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setShowFolderModal(true)}
              >
                <AppIcon name="folder" size={16} color={Palette.text} />
              </TouchableOpacity>
            )}
            {/* Действия с профилем — раньше эта кнопка стояла под аватаркой */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowProfileActionsModal(true)}
            >
              <AppIcon name="more" size={18} color={Palette.text} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Результаты поиска или обычные разделы */}
      {searchQuery ? (
        <View style={styles.searchResults}>
          <Text style={styles.searchResultsTitle}>{t.profile.searchResults}</Text>
        <View style={styles.eventsContainer}>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event, index) => {
                // Рассчитываем ширину карточки для трех колонок
                const containerPadding = 40; // 20px с каждой стороны (paddingHorizontal: 20)
                const gap = 8; // Отступ между карточками (уменьшен для лучшего размещения)
                const availableWidth = SCREEN_WIDTH - containerPadding;
                const cardWidth = (availableWidth - gap * 2) / 3; // 3 колонки с 2 промежутками
                const isLastInRow = (index + 1) % 3 === 0;
                
                return (
                  <View
                    key={event.id}
                    style={[
                      { 
                        width: cardWidth,
                        maxWidth: cardWidth,
                        minWidth: cardWidth,
                        flexBasis: cardWidth,
                        flexShrink: 0,
                        flexGrow: 0,
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
          <Text style={styles.sectionTitle}>{t.profile.sectionTitleOrganizer}</Text>
          <View style={styles.eventsContainer}>
            {organizedEvents.length > 0 ? (
              organizedEvents.map((event, index) => {
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
                        // Квадратная ячейка с обрезкой — ровно как в своём профиле.
                        // Без фиксированной высоты строку растягивало содержимое
                        // карточки, из-за чего в чужом профиле промежутки между
                        // рядами были заметно шире, чем в своём.
                        height: (SCREEN_WIDTH - 40 - 16) / 3,
                        borderRadius: 14,
                        overflow: 'hidden',
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
                      onMiniaturePress={getOrganizedPress(event.id)}
                      viewerUserId={userId}
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>{t.profile.userNoOrganizedEvents}</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>{t.profile.sectionTitleParticipant}</Text>
          <View style={styles.eventsContainer}>
            {participatedEvents.length > 0 ? (
              participatedEvents.map((event, index) => {
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
                        // Квадратная ячейка с обрезкой — ровно как в своём профиле.
                        // Без фиксированной высоты строку растягивало содержимое
                        // карточки, из-за чего в чужом профиле промежутки между
                        // рядами были заметно шире, чем в своём.
                        height: (SCREEN_WIDTH - 40 - 16) / 3,
                        borderRadius: 14,
                        overflow: 'hidden',
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
                      // В разделе «Участник» аватарка организатора не нужна —
                      // в своём профиле её нет, а здесь она ещё и добавляла
                      // высоту карточке и разъезжала сетку.
                      showOrganizerAvatar={false}
                      mediaUrl={event.mediaUrl}
                      mediaType={event.mediaType}
                      mediaAspectRatio={event.mediaAspectRatio}
                      participantsList={event.participantsList}
                      participantsData={event.participantsData}
                      onMiniaturePress={getParticipatedPress(event.id)}
                      viewerUserId={userId}
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>{t.profile.userNoParticipatedEvents}</Text>
            )}
          </View>

          <Text style={styles.memoriesTitle}>{t.profile.memories}</Text>
          {/* Сетка теперь общая со своим профилем (ProfileEventsGrid).
              Раньше здесь была отдельная реализация, где папка занимала
              2 колонки из 3, — из-за неё папки в чужом профиле выглядели
              короче, чем в своём. */}
          {/* Обёртки styles.memoriesContainer здесь больше нет: у неё был свой
              paddingHorizontal: 20, а ProfileEventsGrid задаёт такой же отступ
              сам — вместе получалось 40, ряд не помещался в оставшуюся ширину
              и весь раздел уезжал вправо. В своём профиле обёртки нет вовсе. */}
          <ProfileEventsGrid
              items={[
                ...userEventFolders.map((f: EventFolder) => ({ type: 'folder' as const, data: f, sortKey: folderSortTime(f) })),
                ...pastEvents.map((e: Event) => ({ type: 'event' as const, data: e, sortKey: eventSortTime(e) })),
              ].sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))}
              emptyText={t.profile.memoriesEmpty}
              emptyTextStyle={styles.emptyText}
              screenWidth={SCREEN_WIDTH}
              context="memories"
              viewerUserId={userId}
              onFolderPress={(folder) => router.push(`/event-folder/${folder.id}`)}
            onEventPress={(event) => () => handleMemoryPress(event.id)}
          />
        </>
      )}
      </ScrollView>
      </View>

      {/* Модальное окно выбора папки */}
      <Modal
        visible={showFolderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFolderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.profile.manageFolders}</Text>
            <Text style={styles.modalSubtitle}>{t.profile.selectFoldersForUser || 'Select folders for user'} {userData.name}</Text>
            
            <ScrollView style={styles.folderList}>
              {userFolders.map(folder => (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.folderOption}
                  onPress={() => handleFolderToggle(folder.id)}
                >
                  <View style={[styles.folderCheckbox, selectedFolders.includes(folder.id) && { backgroundColor: Palette.accent, borderColor: Palette.accent }]}>
                    {selectedFolders.includes(folder.id) && <AppIcon name="check" size={12} color="#1a0d00" />}
                  </View>
                  <Text style={styles.folderName}>{folder.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButtonModal]}
                onPress={() => {
                  setShowFolderModal(false);
                  setSelectedFolders([]);
                }}
              >
                <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveFolders}
              >
                <Text style={styles.saveButtonText}>{t.common.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно выбора папки сообщений для чата с этим пользователем */}
      <Modal
        visible={showMessageFolderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowMessageFolderModal(false);
          setMessageFolderChatId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.folder.selectFolder}</Text>
            <Text style={styles.modalSubtitle}>{t.profile.selectFoldersForUser || 'Select folders for user'} {userData.name}</Text>

            <ScrollView style={styles.folderList}>
              {messageFolders.filter(folder => folder.type === 'custom').map(folder => {
                const isInFolder = !!messageFolderChatId && (folder.chatIds?.includes(messageFolderChatId) || false);
                return (
                  <TouchableOpacity
                    key={folder.id}
                    style={styles.folderOption}
                    onPress={async () => {
                      if (!messageFolderChatId) return;
                      try {
                        if (isInFolder) {
                          await removeChatFromMessageFolder(folder.id, messageFolderChatId);
                        } else {
                          await addChatsToMessageFolder(folder.id, [messageFolderChatId]);
                        }
                      } catch (error) {
                        console.error('Failed to update message folder:', error);
                      }
                    }}
                  >
                    <View style={[styles.folderCheckbox, isInFolder && { backgroundColor: Palette.accent, borderColor: Palette.accent }]}>
                      {isInFolder && <AppIcon name="check" size={12} color="#1a0d00" />}
                    </View>
                    <Text style={styles.folderName}>{folder.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {messageFolders.filter(folder => folder.type === 'custom').length === 0 && (
                <Text style={styles.folderName}>{t.inbox.noCustomFolders}</Text>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { flex: 1 }]}
                onPress={() => {
                  setShowMessageFolderModal(false);
                  setMessageFolderChatId(null);
                }}
              >
                <Text style={styles.saveButtonText}>{t.common.done}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Модальное окно действий профиля */}
      {/* Поделиться профилем — та же модалка, что у карточки события:
          список чатов, поиск и копирование ссылки. */}
      <EventShareModal
        profileUserId={userId}
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      <Modal
        visible={showProfileActionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProfileActionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowProfileActionsModal(false)}
          />
          <View style={styles.actionsModalContainer}>
            <View style={styles.actionsModalHeader}>
              <Text style={styles.actionsModalTitle}>{t.profile.actions}</Text>
              <TouchableOpacity onPress={() => setShowProfileActionsModal(false)}>
                <AppIcon name="close" size={18} color={Palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.actionsModalScroll} bounces={false}>
              {/* Меню оставлено из двух пунктов: «Поделиться» и «Пожаловаться».
                  Добавление в папки событий и сообщений отсюда убрано — папка
                  наполняется только по дружбе, и пункт вводил в заблуждение.
                  Добавление в папку событий осталось отдельной кнопкой-папкой
                  рядом с действиями, она видна когда вы уже друзья. */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  setShowProfileActionsModal(false);
                  setShowShareModal(true);
                }}
              >
                <Text style={styles.actionItemText}>{t.profile.shareProfile || 'Share profile'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => {
                  setShowProfileActionsModal(false);
                  setShowComplaintForm(true);
                }}
              >
                <Text style={styles.actionItemText}>{t.profile.report}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemLast]}
                onPress={() => {
                  setShowProfileActionsModal(false);
                  handleToggleBlock();
                }}
              >
                <Text style={[styles.actionItemText, !blockedByMe && styles.actionItemDanger]}>
                  {blockedByMe ? t.profile.unblock : t.profile.block}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Форма жалобы */}
      <ComplaintForm
        visible={showComplaintForm}
        onClose={() => setShowComplaintForm(false)}
        type="USER"
        reportedUserId={userId}
      />

      {eventFeedOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  // Плашка «в разработке» на счётчике жалоб — те же размеры, что в своём профиле.
  complaintsToast: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    zIndex: 20,
    backgroundColor: 'rgba(28,28,32,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  complaintsToastText: {
    color: '#f4f4f5',
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  containerWeb: {
    flex: undefined,
    minHeight: '100vh' as any,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContainerWeb: {
    flex: undefined,
  },
  scrollWrapperWeb: {
    flex: undefined,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  // Строка поиска
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    backgroundColor: '#0a0a0c',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  searchIcon: {
    fontSize: 16,
    color: 'rgba(244,244,245,0.55)',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#f4f4f5',
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mapIcon: {
    fontSize: 20,
  },
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarIcon: {
    fontSize: 20,
  },
  // Информация о пользователе
  userProfileContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  settingsButtonWeb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIconWeb: {
    fontSize: 16,
    color: '#f4f4f5',
  },
  settingsButton: {
    position: 'absolute',
    top: 0,
    right: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0c',
  },
  settingsIcon: {
    fontSize: 18,
  },
  // Значения совпадают со своим профилем (styles/profile.styles.ts):
  // раньше шапки двух экранов отличались размером и отступами.
  username: {
    fontSize: 21,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  nameAndAge: {
    fontSize: 14.5,
    color: 'rgba(244,244,245,0.5)',
    marginBottom: 10,
    fontWeight: '500',
  },
  bio: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.7)',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statsContainer: {
    alignItems: 'center',
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f4f4f5',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(244,244,245,0.55)',
    marginTop: 2,
    textAlign: 'center',
  },
  // Кнопки действий
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // gap вместо разнобоя отступов у отдельных кнопок — ряд ровно по центру
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  addFriendButton: {
    backgroundColor: '#FF8D32',
  },
  acceptFriendButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 160,
    width: undefined, // Переопределяем width из actionButton
    height: undefined, // Переопределяем height из actionButton
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptFriendButtonText: {
    fontSize: 14,
    color: '#f4f4f5',
    fontWeight: '600',
  },
  removeFriendButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actionButtonText: {
    fontSize: 20,
    color: '#f4f4f5',
  },
  // Результаты поиска
  searchResults: {
    flex: 1,
  },
  searchResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  // Обычные разделы
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  eventsContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%',
  },
  eventCard: {
    width: 110, // Фиксированная ширина для трех колонок
    height: 110, // Фиксированная высота для трех колонок
    backgroundColor: '#3D3B3B',
    borderRadius: 12,
    marginBottom: 15,
  },
  memoriesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  memoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    backgroundColor: '#0a0a0c',
    width: '100%',
    margin: 0,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(244,244,245,0.35)',
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 20,
  },
  archivedEventWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  goToEventButton: {
    backgroundColor: '#FF8D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  goToEventText: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: '600',
  },
  // Лента событий
  backToProfile: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  backText: {
    color: '#FF8D32',
    fontSize: 16,
    fontWeight: '600',
  },
  feedContainer: {
    flex: 1,
  },
  feedContentContainer: {
    paddingHorizontal: 12, // Соответствует marginHorizontal в MemoryPost
    paddingTop: 10,
    paddingBottom: 200,
  },
  eventCardWrapper: {
    marginBottom: 20,
    width: '100%',
  },
  lastEventCard: {
    marginBottom: 200, // Значительно увеличиваем отступ после последнего элемента для лучшей видимости
  },
  // Модальные окна
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#18181e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 22,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: 'rgba(244,244,245,0.5)',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 18,
  },
  folderList: {
    maxHeight: 320,
  },
  folderOption: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  folderCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    marginRight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkboxIcon: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: 'bold',
  },
  folderName: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 15,
  },
  cancelButtonModal: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  saveButton: {
    backgroundColor: '#FF8D32',
  },
  saveButtonText: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  cancelButtonText: {
    color: 'rgba(244,244,245,0.6)',
    fontSize: 15,
    fontWeight: '500',
  },
  // Модальное окно аватарки
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalContent: {
    // Квадрат, а не произвольный прямоугольник — чтобы borderRadius ниже
    // давал ровный круг, как у маленькой аватарки, а не скруглённый овал.
    width: '85%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },
  actionsModalContainer: {
    backgroundColor: '#141417',
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
    alignSelf: 'center',
  },
  actionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  actionsModalTitle: {
    color: '#f4f4f5',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionsModalClose: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionsModalScroll: {
    maxHeight: 400,
  },
  actionItem: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionItemDanger: {
    color: Palette.danger,
  },
  actionItemText: {
    color: '#f4f4f5',
    fontSize: 16,
  },
});