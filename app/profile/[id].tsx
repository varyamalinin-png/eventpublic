import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, TextInput, Modal, Dimensions, Platform } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '../../utils/safeRouter';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import EventCard from '../../components/EventCard';
import MemoryMiniCard from '../../components/MemoryMiniCard';
import TopBar from '../../components/TopBar';
import MiniTabBar from '../../components/MiniTabBar';
import ComplaintForm from '../../components/ComplaintForm';
import { useEvents, Event } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { createLogger } from '../../utils/logger';
import FolderCard from '../../components/FolderCard';
import type { EventFolder } from '../../types/EventFolder';
import { apiRequest } from '../../services/api';
import { AppIcon } from '../../components/ui/AppIcon';
import { Palette } from '../../constants/DesignSystem';

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
  const { events, eventProfiles, getUserData: contextGetUserData, getOrganizerStats, getFriendsList, getEventProfile, createEventProfile, fetchEventProfile, sendFriendRequest, removeFriend, isFriend, userFolders, addUserToFolder, removeUserFromFolder, createPersonalChat, getChatsForUser, isUserParticipant, isEventUpcoming, isEventPast, isUserOrganizer, isUserAttendee, isUserEventMember, friendRequests, respondToFriendRequest, getUserRequestStatus, getUserFriendsList } = useEvents();
  const { user: authUser, accessToken } = useAuth();
  const { t } = useLanguage();
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [showProfileActionsModal, setShowProfileActionsModal] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [organizerStats, setOrganizerStats] = useState<{ complaints: number; friends: number } | null>(null);
  const [userEventFolders, setUserEventFolders] = useState<EventFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  
  const rawUserId = Array.isArray(id) ? id[0] : id;
  const currentUserId = authUser?.id ?? null;
  const userId = rawUserId ?? currentUserId ?? 'organizer-1';
  const userData = contextGetUserData(userId);

  // Перенаправляем на свой профиль, если открывается профиль текущего пользователя
  useEffect(() => {
    if (rawUserId && currentUserId && rawUserId === currentUserId) {
      router.replace('/(tabs)/profile');
    }
  }, [rawUserId, currentUserId, router]);

  // Загружаем статистику при монтировании и обновлении
  useEffect(() => {
    if (userId) {
      const stats = getOrganizerStats(userId);
      setOrganizerStats({ complaints: stats.complaints, friends: stats.friends });
    }
  }, [userId, getOrganizerStats]); // getOrganizerStats уже зависит от userFriendsMap внутри
  
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
  
  // Обработчик принятия запроса в друзья
  const handleAcceptFriendRequest = () => {
    if (incomingFriendRequest) {
      respondToFriendRequest(incomingFriendRequest.id, true);
    }
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
    
    const lowerQuery = query.toLowerCase();
    return eventsList.filter(event => {
      // Поиск по названию события
      if (event.title.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по описанию
      if (event.description.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по локации
      if (event.location.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по дате (формат "15 мая")
      if (event.displayDate.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по времени
      if (event.time.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по участникам
      if (event.participantsData) {
        const participantMatch = event.participantsData.some(participant => 
          participant.name?.toLowerCase().includes(lowerQuery)
        );
        if (participantMatch) return true;
      }
      
      return false;
    });
  };
  
  // ОРГАНИЗАТОР: предстоящее && я_организатор (для наблюдаемого пользователя) - для отображения в профиле
  const organizedEvents = events.filter(event => {
    const viewerId = currentUserId;
    // Исключаем отклоненные события (для текущего пользователя)
    const userStatus = viewerId ? getUserRequestStatus(event, viewerId) : null;
    if (userStatus === 'rejected') return false;
    return isEventUpcoming(event) && isUserOrganizer(event, userId);
  });
  
  // УЧАСТНИК: предстоящее && я_участник (именно участник, не организатор) - для отображения в профиле
  const participatedEvents = events.filter(event => {
    // Исключаем отклоненные события (для текущего пользователя)
    const userStatus = currentUserId ? getUserRequestStatus(event, currentUserId) : null;
    if (userStatus === 'rejected') return false;
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

  // МЕМОРИ: прошедшее && (организатор ИЛИ участник по profile.participants)
  const pastEvents = events.filter(event => {
    if (!isEventPast(event)) return false;
    if (isUserOrganizer(event, userId)) return true;
    const profile = eventProfiles.find(p => p.eventId === event.id);
    if (!profile) return false;
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
      try {
        await fetchEventProfile(event.id);
        loadedProfilesRef.current.add(event.id);
      } catch {}
    }
  }, [events, isEventPast, fetchEventProfile]);

  useEffect(() => { loadProfilesForPastEvents(); }, [loadProfilesForPastEvents]);
  useFocusEffect(useCallback(() => { loadProfilesForPastEvents(); }, [loadProfilesForPastEvents]));

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
        setSelectedEvent(targetEvent);
        setShowEventFeed(true);
        
        // Прокручиваем к нужному событию
        setTimeout(() => {
          const eventIndex = userEvents.findIndex(e => e.id === eventIdValue);
          if (eventIndex !== -1 && scrollViewRef.current) {
            const cardHeight = 400;
            const marginBottom = 20;
            const totalItemHeight = cardHeight + marginBottom;
            const screenHeight = 800;
            const cardPosition = eventIndex * totalItemHeight;
            const centerOffset = (screenHeight - cardHeight) / 2;
            let scrollToY = cardPosition - centerOffset;
            const totalContentHeight = userEvents.length * totalItemHeight - marginBottom + 20;
            const maxScrollY = Math.max(0, totalContentHeight - screenHeight);
            scrollToY = Math.max(0, Math.min(scrollToY, maxScrollY));
            
            scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
          }
        }, 200);
      }
    }
  }, [eventId, userEvents]);

  // Фильтрация событий по поиску
  const filteredEvents = searchUserEvents(userEvents, searchQuery);

  // Получаем общие события: где и я и он члены события
  const sharedEvents = events.filter(event => 
    currentUserId && isUserEventMember(event, currentUserId) && isUserEventMember(event, userId)
  );

  const handleMemoryPress = (eventId: string) => {
    // Находим событие в pastEvents
    const memoryEvent = pastEvents.find(e => e.id === eventId);
    if (!memoryEvent) return;
    
    setSelectedEvent(memoryEvent);
    setShowEventFeed(true);
    
    // Прокручиваем к нужному событию после рендера
    setTimeout(() => {
      const eventIndex = pastEvents.findIndex(e => e.id === eventId);
      if (eventIndex !== -1 && scrollViewRef.current) {
        const cardHeight = 400; // высота карточки
        const marginBottom = 20; // отступ снизу
        const totalItemHeight = cardHeight + marginBottom;
        const scrollPosition = eventIndex * totalItemHeight;
        
        scrollViewRef.current.scrollTo({
          y: scrollPosition,
          animated: true
        });
      }
    }, 100);
  };

  const handleMiniaturePress = (event: Event) => {
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
    
    logger.debug('showEventFeed установлено в true');
    
    // Отладочная информация
    logger.debug('Clicked event', { eventId: event.id, eventTitle: event.title, totalEvents: userEvents.length, eventIndex: userEvents.findIndex(e => e.id === event.id) });
    
    // Прокручиваем к нужному событию после рендера
    setTimeout(() => {
      const eventIndex = userEvents.findIndex(e => e.id === event.id);
      if (eventIndex !== -1 && scrollViewRef.current) {
        // Более точный расчет высоты карточки + отступы
        const cardHeight = 400; // высота карточки
        const marginBottom = 20; // отступ снизу
        const totalItemHeight = cardHeight + marginBottom;
        
        // Высота экрана (примерная)
        const screenHeight = 800;
        // Позиция карточки от начала контента
        const cardPosition = eventIndex * totalItemHeight;
        
        // Рассчитываем позицию прокрутки так, чтобы карточка была по центру экрана
        const centerOffset = (screenHeight - cardHeight) / 2;
        let scrollToY = cardPosition - centerOffset;
        
        // Ограничиваем прокрутку границами контента
        const totalContentHeight = userEvents.length * totalItemHeight - marginBottom + 20; // 20 - paddingBottom
        const maxScrollY = Math.max(0, totalContentHeight - screenHeight);
        
        scrollToY = Math.max(0, Math.min(scrollToY, maxScrollY));
        
        logger.debug('Scrolling to center event', { scrollToY });
        scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
      }
    }, 200);
  };

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

  // Определяем какую коллекцию событий показывать в ленте
  const eventsToShow = selectedEvent && pastEvents.find(e => e.id === selectedEvent.id) 
    ? pastEvents 
    : userEvents;

  // Если показываем ленту события
  if (showEventFeed) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backToProfile}
          onPress={() => {
            setShowEventFeed(false);
            setSelectedEvent(null);
            // КРИТИЧЕСКИ ВАЖНО: На вебе не используем router.setParams, только локальное состояние
            // Очищаем URL параметры если они есть (только для мобильного)
            if (eventId && Platform.OS !== 'web' && router && typeof router.setParams === 'function') {
              try {
                router.setParams({ eventId: undefined as any });
              } catch (error) {
                logger.warn('Failed to clear params:', error);
              }
            }
            // Если это свой профиль, переходим на таб профиля, иначе остаемся на странице профиля
            if (currentUserId && userId === currentUserId) {
              router.push('/(tabs)/profile');
            }
          }}
        >
          <Text style={styles.backText}>← {t.profile.backToProfile}</Text>
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
    );
  }

  const isWeb = Platform.OS === 'web';
  const containerStyle = isWeb ? [styles.container, styles.containerWeb] : styles.container;

  return (
    <View style={containerStyle}>
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
                source={{ uri: userData.avatar }} 
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
                source={{ uri: userData.avatar }} 
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
            {currentUserId && userId === currentUserId ? (
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
            ) : (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setShowProfileActionsModal(true)}
              >
                <AppIcon name="more" size={18} color={Palette.text} />
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Юзернейм */}
        <Text style={styles.username}>{userData.username}</Text>
        
        {/* Имя и возраст */}
        <Text style={styles.nameAndAge}>{userData.name}, {userData.age}</Text>
        
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
              <Text style={styles.statNumber}>{organizerStats?.friends ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsFriends}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/my-complaints/${userId}`)}>
              <Text style={styles.statNumber}>{organizerStats?.complaints ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsComplaints}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Второй ряд: Organized/Participated скрыты флагом SHOW_ORG_PART,
              разметка сохранена */}
          <View style={styles.statsRow}>
            {SHOW_ORG_PART && (
              <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/organized-events/${userId}`)}>
                <Text style={styles.statNumber}>{organizedEvents.length + pastEvents.filter(e => isUserOrganizer(e, userId)).length}</Text>
                <Text style={styles.statLabel}>{t.profile.statsOrganized}</Text>
              </TouchableOpacity>
            )}

            {SHOW_ORG_PART && (
              <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/participated-events/${userId}`)}>
                <Text style={styles.statNumber}>{allParticipatedEvents.length}</Text>
                <Text style={styles.statLabel}>{t.profile.statsParticipated}</Text>
              </TouchableOpacity>
            )}
            
            {currentUserId && userId !== currentUserId && (
              <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/shared-events/${userId}`)}>
                <Text style={styles.statNumber}>{sharedEvents.length}</Text>
                <Text style={styles.statLabel}>{t.profile.statsShared}</Text>
              </TouchableOpacity>
            )}
          </View>
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
            {isFriend(userId) ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.removeFriendButton]}
                onPress={() => removeFriend(userId)}
              >
                <AppIcon name="close" size={15} color={Palette.text} />
              </TouchableOpacity>
            ) : incomingFriendRequest ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptFriendButton]}
                onPress={handleAcceptFriendRequest}
              >
                <Text style={styles.acceptFriendButtonText}>{t.profile.acceptFriendRequest}</Text>
              </TouchableOpacity>
            ) : outgoingFriendRequest ? (
              <View style={[styles.actionButton, { opacity: 0.5 }]}>
                <AppIcon name="clock" size={15} color={Palette.textDim} />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.addFriendButton]}
                onPress={() => sendFriendRequest(userId)}
              >
                <AppIcon name="plus" size={16} color={Palette.text} />
              </TouchableOpacity>
            )}
            {isFriend(userId) && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setShowFolderModal(true)}
              >
                <Text style={styles.actionButtonText}>⋮</Text>
              </TouchableOpacity>
            )}
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
                      onMiniaturePress={() => handleMiniaturePress(event)}
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
                      onMiniaturePress={() => handleMiniaturePress(event)}
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
                      mediaUrl={event.mediaUrl}
                      mediaType={event.mediaType}
                      mediaAspectRatio={event.mediaAspectRatio}
                      participantsList={event.participantsList}
                      participantsData={event.participantsData}
                      onMiniaturePress={() => handleMiniaturePress(event)}
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
          <View style={styles.memoriesContainer}>
            {(() => {
              // Объединяем папки и события в один массив для правильного позиционирования
              const gap = 8; // Отступ между карточками (уменьшен для лучшего размещения)
              const containerPadding = 20; // Отступ контейнера с каждой стороны
              
              // Для веба используем процентную ширину, для мобильных - пиксели
              // Ширина одной карточки (1 колонка из 3)
              const singleCardWidth = Platform.OS === 'web' 
                ? 'calc((100% - 16px) / 3)' // 100% минус 2 gap (8px каждый), делим на 3
                : (SCREEN_WIDTH - containerPadding * 2 - gap * 2) / 3;
              
              // Ширина папки (2 колонки из 3) = 2 карточки + 1 отступ между ними
              const folderWidth = Platform.OS === 'web'
                ? 'calc((100% - 16px) / 3 * 2 + 8px)' // 2 колонки + 1 gap
                : ((SCREEN_WIDTH - containerPadding * 2 - gap * 2) / 3) * 2 + gap;
              
              const items: Array<{ type: 'folder' | 'event'; data: EventFolder | Event; index: number }> = [];
              
              // Добавляем папки
              if (userEventFolders && userEventFolders.length > 0) {
                userEventFolders.forEach((folder: EventFolder) => {
                  items.push({ type: 'folder', data: folder, index: items.length });
                });
              }
              
              // Добавляем события
              if (pastEvents.length > 0) {
                pastEvents.forEach((event: Event) => {
                  items.push({ type: 'event', data: event, index: items.length });
                });
              }
              
              if (items.length === 0) {
                return <Text style={styles.emptyText}>{t.profile.memoriesEmpty}</Text>;
              }
              
              // Рендерим элементы с правильным позиционированием
              let currentPosition = 0; // Текущая позиция в сетке (0, 1, 2 - три колонки)
              const renderedItems: React.ReactNode[] = [];
              
              items.forEach((item, itemIndex) => {
                if (item.type === 'folder') {
                  const folder = item.data as EventFolder;
                  // Папка занимает 2 места (позиции 0 и 1)
                  // Если текущая позиция не 0, пропускаем до следующей строки
                  if (currentPosition !== 0) {
                    // Пропускаем оставшиеся позиции в текущей строке
                    while (currentPosition < 3) {
                      currentPosition++;
                    }
                    currentPosition = 0; // Переходим на новую строку
                  }
                  
                  // Теперь currentPosition === 0, можем отобразить папку
                  renderedItems.push(
                    <View
                      key={`folder-${folder.id}`}
                      style={[
                        { 
                          width: folderWidth,
                          flexBasis: folderWidth,
                          flexShrink: 0,
                          flexGrow: 0,
                          maxWidth: folderWidth,
                        },
                        { marginRight: gap },
                        { marginBottom: gap }
                      ]}
                      pointerEvents="box-none"
                    >
                      <FolderCard
                        folder={folder}
                        onPress={() => {
                          router.push(`/event-folder/${folder.id}`);
                        }}
                        variant="profile"
                      />
                    </View>
                  );
                  // После папки следующая позиция - 2 (3-й квадрант)
                  currentPosition = 2;
                } else {
                  const event = item.data as Event;
                  const isLastInRow = currentPosition === 2;
                  
                  renderedItems.push(
                    <View
                      key={event.id}
                      style={[
                        { 
                          width: singleCardWidth,
                          flexBasis: singleCardWidth,
                          flexShrink: 0,
                          flexGrow: 0,
                          maxWidth: singleCardWidth,
                        },
                        !isLastInRow && { marginRight: gap },
                        { marginBottom: gap }
                      ]}
                      pointerEvents="box-none"
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
                        context="memories"
                        onMiniaturePress={() => handleMemoryPress(event.id)}
                        viewerUserId={userId}
                      />
                    </View>
                  );
                  // Переходим к следующей позиции
                  currentPosition = (currentPosition + 1) % 3;
                }
              });
              
              return renderedItems;
            })()}
          </View>
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
            <Image 
              source={{ uri: userData.avatar }} 
              style={styles.avatarModalImage}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Модальное окно действий профиля */}
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
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => {
                  setShowProfileActionsModal(false);
                  setShowFolderModal(true);
                }}
              >
                <Text style={styles.actionItemText}>{t.profile.addToEventsFolder || 'Add to events folder'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={async () => {
                  try {
                    const chatId = await createPersonalChat(userId);
                    router.push(`/(tabs)/inbox/${chatId}`);
                    setShowProfileActionsModal(false);
                  } catch (error) {
                    console.error('Failed to create chat:', error);
                    setShowProfileActionsModal(false);
                  }
                }}
              >
                <Text style={styles.actionItemText}>{t.profile.addToMessagesFolder || 'Add to messages folder'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionItem, styles.actionItemLast]}
                onPress={() => {
                  setShowProfileActionsModal(false);
                  setShowComplaintForm(true);
                }}
              >
                <Text style={styles.actionItemText}>{t.profile.report}</Text>
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
      <MiniTabBar activeTab={typeof from === 'string' ? from : 'explore'} />
    </View>
  );
}

const styles = StyleSheet.create({
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
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 5,
  },
  nameAndAge: {
    fontSize: 16,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 8,
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
    width: '90%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
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
  actionItemText: {
    color: '#f4f4f5',
    fontSize: 16,
  },
});