import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, TextInput, Modal, Dimensions } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import EventCard from '../../components/EventCard';
import MemoryMiniCard from '../../components/MemoryMiniCard';
import TopBar from '../../components/TopBar';
import ComplaintForm from '../../components/ComplaintForm';
import { useEvents, Event } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OtherProfile');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OtherProfileScreen() {
  const { id, eventId } = useLocalSearchParams();
  const router = useRouter();
  const { events, getUserData: contextGetUserData, getOrganizerStats, getFriendsList, getEventProfile, createEventProfile, eventProfiles, sendFriendRequest, removeFriend, isFriend, userFolders, addUserToFolder, removeUserFromFolder, createPersonalChat, getChatsForUser, isUserParticipant, isEventUpcoming, isEventPast, isUserOrganizer, isUserAttendee, isUserEventMember, friendRequests, respondToFriendRequest, getUserRequestStatus, fetchEventProfile } = useEvents();
  const { user: authUser } = useAuth();
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
  
  const rawUserId = Array.isArray(id) ? id[0] : id;
  const currentUserId = authUser?.id ?? null;
  const userId = rawUserId ?? currentUserId ?? 'organizer-1';
  const userData = contextGetUserData(userId);

  // Загружаем статистику при монтировании и обновлении
  useEffect(() => {
    if (userId) {
      const stats = getOrganizerStats(userId);
      setOrganizerStats({ complaints: stats.complaints, friends: stats.friends });
    }
  }, [userId, getOrganizerStats, userFriendsMap]); // Добавлено userFriendsMap в зависимости
  
  // Проверяем, есть ли входящий запрос в друзья от этого пользователя
  const incomingFriendRequest = friendRequests.find(
    req => req.fromUserId === userId && 
           req.toUserId === currentUserId && 
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
  const allOrganizedEvents = events.filter(event => 
    isUserOrganizer(event, userId)
  );
  
  const allParticipatedEvents = events.filter(event => 
    isUserAttendee(event, userId)
  );
  
  const allUserEvents = events.filter(event => 
    isUserEventMember(event, userId)
  );

  // МЕМОРИ: прошедшее && я_член_события (организатор или принятый участник)
  // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий проверяем через eventProfiles,
  // чтобы правильно учитывать удаление пользователя из профиля события
  const pastEvents = events.filter(event => {
    if (!isEventPast(event)) return false;
    
    // Проверяем через профиль события - если пользователь удален из профиля, событие не показывается
    const profile = eventProfiles.find(p => p.eventId === event.id);
    if (profile) {
      // Если есть профиль - проверяем, есть ли пользователь в participants
      // Если пользователь удален (participants не включает userId) - не показываем событие
      const isParticipant = profile.participants.includes(userId);
      return isParticipant;
    }
    
    // КРИТИЧЕСКИ ВАЖНО: Если профиля нет - НЕ показываем событие
    // Это предотвращает показ событий, где пользователь был удален, но профиль еще не загружен
    // Профиль должен быть загружен через useFocusEffect или fetchEventProfile
    // Если профиль не найден, значит либо он еще не создан, либо пользователь был удален
    return false;
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
  useFocusEffect(
    useCallback(() => {
      if (!fetchEventProfile) return;
      
      const loadProfilesForPastEvents = async () => {
        const pastEvents = events.filter(event => isEventPast(event));
        logger.debug('Загружаем профили для прошедших событий в профиле другого пользователя', { count: pastEvents.length, userId });
        
        for (const event of pastEvents) {
          const existingProfile = eventProfiles.find(p => p.eventId === event.id);
          if (!existingProfile) {
            try {
              await fetchEventProfile(event.id);
            } catch (error) {
              logger.warn(`Не удалось загрузить профиль для события ${event.id}:`, error);
            }
          }
        }
      };
      
      loadProfilesForPastEvents();
    }, [events, eventProfiles, isEventPast, fetchEventProfile, userId])
  );
  
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
    
    // Устанавливаем eventId в URL чтобы useEffect не закрывал ленту
    router.setParams({ eventId: event.id as any });
    
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
            // Очищаем URL параметры если они есть
            if (eventId) {
              router.setParams({ eventId: undefined as any });
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

  return (
    <View style={styles.container}>
      <TopBar
        searchPlaceholder={t.profile.searchPlaceholderUser}
        onSearchChange={handleProfileSearch}
        searchQuery={searchQuery}
        showCalendar={true}
        showMap={true}
        userId={userId}
      />

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
        scrollEventThrottle={16}
        removeClippedSubviews={false}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* Информация о пользователе */}
        <View style={styles.userProfileContainer}>
        {/* Аватарка и кнопка настроек (только для собственного профиля) */}
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
              onPress={() => router.push('/settings')}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowProfileActionsModal(true)}
            >
              <Text style={styles.actionButtonText}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
        
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
          
          {/* Второй ряд - всегда видимый */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/organized-events/${userId}`)}>
              <Text style={styles.statNumber}>{allOrganizedEvents.length}</Text>
              <Text style={styles.statLabel}>{t.profile.statsOrganized}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/participated-events/${userId}`)}>
              <Text style={styles.statNumber}>{allParticipatedEvents.length}</Text>
              <Text style={styles.statLabel}>{t.profile.statsParticipated}</Text>
            </TouchableOpacity>
            
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
            <Text style={styles.actionButtonText}>💬</Text>
          </TouchableOpacity>
        )}
        {currentUserId && userId !== currentUserId && (
          <>
            {isFriend(userId) ? (
              <TouchableOpacity 
                style={[styles.actionButton, styles.removeFriendButton]}
                onPress={() => removeFriend(userId)}
              >
                <Text style={styles.actionButtonText}>✕</Text>
              </TouchableOpacity>
            ) : incomingFriendRequest ? (
              <TouchableOpacity 
                style={[styles.actionButton, styles.acceptFriendButton]}
                onPress={handleAcceptFriendRequest}
              >
                <Text style={styles.acceptFriendButtonText}>{t.profile.acceptFriendRequest}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.actionButton, styles.addFriendButton]}
                onPress={() => sendFriendRequest(userId)}
              >
                <Text style={styles.actionButtonText}>➕</Text>
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
                const containerPadding = 40; // 20px с каждой стороны
                const gap = 15; // Отступ между карточками
                const availableWidth = SCREEN_WIDTH - containerPadding;
                const cardWidth = (availableWidth - gap * 2) / 3; // 3 колонки с 2 промежутками
                const isLastInRow = (index + 1) % 3 === 0;
                
                return (
                  <View
                    key={event.id}
                    style={[
                      { width: cardWidth },
                      !isLastInRow && { marginRight: gap }
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
                // Рассчитываем ширину карточки для трех колонок
                const containerPadding = 40; // 20px с каждой стороны
                const gap = 15; // Отступ между карточками
                const availableWidth = SCREEN_WIDTH - containerPadding;
                const cardWidth = (availableWidth - gap * 2) / 3; // 3 колонки с 2 промежутками
                const isLastInRow = (index + 1) % 3 === 0;
                
                return (
                  <View
                    key={event.id}
                    style={[
                      { width: cardWidth },
                      !isLastInRow && { marginRight: gap }
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
                // Рассчитываем ширину карточки для трех колонок
                const containerPadding = 40; // 20px с каждой стороны
                const gap = 15; // Отступ между карточками
                const availableWidth = SCREEN_WIDTH - containerPadding;
                const cardWidth = (availableWidth - gap * 2) / 3; // 3 колонки с 2 промежутками
                const isLastInRow = (index + 1) % 3 === 0;
                
                return (
                  <View
                    key={event.id}
                    style={[
                      { width: cardWidth },
                      !isLastInRow && { marginRight: gap }
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
            {pastEvents.length > 0 ? (
              pastEvents.map((event, index) => {
                // Рассчитываем ширину карточки для трех колонок
                const containerPadding = 40; // 20px с каждой стороны
                const gap = 15; // Отступ между карточками
                const availableWidth = SCREEN_WIDTH - containerPadding;
                const cardWidth = (availableWidth - gap * 2) / 3; // 3 колонки с 2 промежутками
                const isLastInRow = (index + 1) % 3 === 0;
                
                return (
                  <View
                    key={event.id}
                    style={[
                      { width: cardWidth },
                      !isLastInRow && { marginRight: gap }
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
                      context="memories"
                      onMiniaturePress={() => handleMemoryPress(event.id)}
                      viewerUserId={userId}
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>{t.profile.memoriesEmpty}</Text>
            )}
          </View>
        </>
      )}
      </ScrollView>

      {/* Модальное окно выбора папки */}
      <Modal
        visible={showFolderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFolderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.profile.manageFolders}</Text>
            <Text style={styles.modalSubtitle}>{t.profile.selectFoldersForUser || 'Select folders for user'} {userData.name}</Text>
            
            <ScrollView style={styles.folderList}>
              {userFolders.map(folder => (
                <TouchableOpacity
                  key={folder.id}
                  style={styles.folderOption}
                  onPress={() => handleFolderToggle(folder.id)}
                >
                  <View style={styles.folderCheckbox}>
                    <Text style={styles.checkboxIcon}>
                      {selectedFolders.includes(folder.id) ? '✓' : ''}
                    </Text>
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
                <Text style={styles.actionsModalClose}>✕</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContainer: {
    flex: 1,
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
    backgroundColor: '#121212',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  searchIcon: {
    fontSize: 16,
    color: '#999',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
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
    backgroundColor: '#333',
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
  settingsButton: {
    position: 'absolute',
    top: 0,
    right: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121212',
  },
  settingsIcon: {
    fontSize: 18,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 5,
  },
  nameAndAge: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#CCC',
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
    color: '#FFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
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
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  addFriendButton: {
    backgroundColor: '#007AFF',
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
    color: '#FFF',
    fontWeight: '600',
  },
  removeFriendButton: {
    backgroundColor: '#666',
  },
  actionButtonText: {
    fontSize: 20,
    color: '#FFF',
  },
  // Результаты поиска
  searchResults: {
    flex: 1,
  },
  searchResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  // Обычные разделы
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  // Устаревшие стили, больше не используются
  eventsContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
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
    color: '#FFF',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  memoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    backgroundColor: '#121212',
    width: '100%',
    margin: 0,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 20,
  },
  archivedEventWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  goToEventButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  goToEventText: {
    color: '#FFF',
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
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  feedContainer: {
    flex: 1,
  },
  feedContentContainer: {
    paddingHorizontal: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  folderList: {
    maxHeight: 300,
  },
  folderOption: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#999',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxIcon: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  folderName: {
    color: '#FFF',
    fontSize: 16,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  cancelButtonModal: {
    marginRight: 10,
    backgroundColor: '#333',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
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
    backgroundColor: '#1A1A1A',
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
    borderBottomColor: '#333',
  },
  actionsModalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionsModalClose: {
    color: '#999',
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionsModalScroll: {
    maxHeight: 400,
  },
  actionItem: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionItemText: {
    color: '#FFF',
    fontSize: 16,
  },
});