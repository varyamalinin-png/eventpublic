import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import EventCard from '../../components/EventCard';
import TopBar from '../../components/TopBar';
import { useEvents, Event } from '../../context/EventsContext';
import { formatUsername } from '../../utils/username';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('Profile');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const { events, eventProfiles, getOrganizerStats, isEventUpcoming, isEventPast, isUserOrganizer, isUserAttendee, isUserEventMember, getUserData, getUserRequestStatus, fetchEventProfile } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [organizerStats, setOrganizerStats] = useState<{ complaints: number; friends: number } | null>(null);

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
  
  const participatedEvents = useMemo(() => {
    if (!currentUserId) return [];
    return events.filter(event => {
      // Исключаем отклоненные события
      const userStatus = getUserRequestStatus(event, currentUserId);
      if (userStatus === 'rejected') return false;
      return isEventUpcoming(event) && isUserAttendee(event, currentUserId);
    });
  }, [events, currentUserId, isEventUpcoming, isUserAttendee, getUserRequestStatus]);

  // Для подсчета параметров: все события (текущие и прошлые)
  // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий проверяем через eventProfiles, чтобы учесть удаление
  const allOrganizedEvents = useMemo(() => {
    if (!currentUserId) return [];
    const filtered = events.filter(event => {
      // Для текущих событий - проверяем обычным способом
      if (isEventUpcoming(event)) {
        return isUserOrganizer(event, currentUserId);
      }
      
      // Для прошедших событий - проверяем через профиль
      if (isEventPast(event)) {
        const profile = eventProfiles.find(p => p.eventId === event.id);
        if (profile) {
          // Проверяем, есть ли пользователь в participants И является ли он организатором
          const isParticipant = profile.participants.includes(currentUserId);
          const isOrganizer = event.organizerId === currentUserId;
          return isParticipant && isOrganizer;
        }
        // Если профиля нет - не считаем (пользователь был удален)
        return false;
      }
      
      return isUserOrganizer(event, currentUserId);
    });
    
    logger.debug('allOrganizedEvents: отфильтровано', { filtered: filtered.length, total: events.length });
    
    return filtered;
  }, [events, eventProfiles, currentUserId, isUserOrganizer, isEventUpcoming, isEventPast]);
  
  const allParticipatedEvents = useMemo(() => {
    if (!currentUserId) return [];
    const filtered = events.filter(event => {
      // Для текущих событий - проверяем обычным способом
      if (isEventUpcoming(event)) {
        return isUserAttendee(event, currentUserId);
      }
      
      // Для прошедших событий - проверяем через профиль
      if (isEventPast(event)) {
        const profile = eventProfiles.find(p => p.eventId === event.id);
        if (profile) {
          // Проверяем, есть ли пользователь в participants И НЕ является ли он организатором
          const isParticipant = profile.participants.includes(currentUserId);
          const isNotOrganizer = event.organizerId !== currentUserId;
          return isParticipant && isNotOrganizer;
        }
        // Если профиля нет - не считаем (пользователь был удален)
        return false;
      }
      
      return isUserAttendee(event, currentUserId);
    });
    
    logger.debug('allParticipatedEvents: отфильтровано', { filtered: filtered.length, total: events.length });
    
    return filtered;
  }, [events, eventProfiles, currentUserId, isUserAttendee, isEventUpcoming, isEventPast]);
  
  // Общее количество всех событий пользователя (организовал + участвовал, без дублей)
  const allUserEvents = useMemo(() => {
    if (!currentUserId) return [];
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
  // КРИТИЧЕСКИ ВАЖНО: Проверяем через eventProfiles, чтобы удаление работало правильно
  const pastEvents = useMemo(() => {
    if (!currentUserId) return [];
    const filtered = events.filter(event => {
      if (!isEventPast(event)) return false;
      
      // Проверяем через профиль события - если пользователь удален из профиля, событие не показывается
      const profile = eventProfiles.find(p => p.eventId === event.id);
      if (profile) {
        // Если есть профиль - проверяем, есть ли пользователь в participants
        // Если пользователь удален (participants не включает currentUserId) - не показываем событие
        const isParticipant = profile.participants.includes(currentUserId);
        logger.debug(`pastEvents: событие ${event.id}, профиль найден`, { isParticipant });
        return isParticipant;
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Если профиля нет - НЕ показываем событие
      // Это предотвращает показ событий, где пользователь был удален, но профиль еще не загружен
      // Профиль должен быть загружен через useFocusEffect или fetchEventProfile
      // Если профиль не найден, значит либо он еще не создан, либо пользователь был удален
      logger.debug(`pastEvents: событие ${event.id}, профиль НЕ найден - НЕ показываем событие (безопасный fallback)`);
      return false;
    });
    
    logger.debug('pastEvents: отфильтровано', { filtered: filtered.length, totalPast: events.filter(e => isEventPast(e)).length });
    
    return filtered.sort((a, b) => {
      // Сортируем по дате+времени события: самое последнее прошедшее первым
      const dateA = new Date(a.date + 'T' + a.time + ':00').getTime();
      const dateB = new Date(b.date + 'T' + b.time + ':00').getTime();
      return dateB - dateA; // Убывание: последнее первым
    });
  }, [events, eventProfiles, currentUserId, isEventPast, isUserEventMember]);
  
  // Загружаем профили для прошедших событий при открытии профиля
  useFocusEffect(
    useCallback(() => {
      if (!currentUserId || !fetchEventProfile) return;
      
      const loadProfilesForPastEvents = async () => {
        const pastEvents = events.filter(event => isEventPast(event));
        logger.debug('Загружаем профили для прошедших событий', { count: pastEvents.length });
        
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
    }, [currentUserId, events, eventProfiles, isEventPast, fetchEventProfile])
  );

  // Обработка открытия по параметру eventId
  useEffect(() => {
    if (params.eventId) {
      const event = events.find(e => e.id === params.eventId);
      if (event) {
        setSelectedEvent(event);
        setShowEventFeed(true);
        
        // Прокручиваем к событию после небольшой задержки
        setTimeout(() => {
          const eventsCollection = pastEvents.find(e => e.id === params.eventId) ? pastEvents : userEvents;
          const eventIndex = eventsCollection.findIndex(e => e.id === params.eventId);
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
            const totalContentHeight = eventsCollection.length * totalItemHeight - marginBottom + 20; // 20 - paddingBottom
            const maxScrollY = Math.max(0, totalContentHeight - screenHeight);
            
            scrollToY = Math.max(0, Math.min(scrollToY, maxScrollY));
            
            logger.debug('Scrolling to center event from URL', { scrollToY });
            scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
          }
        }, 200);
      }
    } else if (params.eventId === undefined && showEventFeed) {
      // Если параметр eventId удален из URL, закрываем ленту
      setShowEventFeed(false);
    }
  }, [params.eventId, events, userEvents, pastEvents]);
  
  // Функция поиска для профиля
  const handleProfileSearch = (query: string) => {
    setSearchQuery(query);
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


  // Фильтрация событий по поиску
  const filteredEvents = searchUserEvents(userEvents, searchQuery);

  const handleMemoryPress = (eventId: string) => {
    const event = pastEvents.find(e => e.id === eventId);
    if (event) {
      router.setParams({ eventId: event.id });
      setSelectedEvent(event);
      setShowEventFeed(true);
      
      // Прокручиваем к нужному событию после рендера
      setTimeout(() => {
        const eventIndex = pastEvents.findIndex(e => e.id === eventId);
        if (eventIndex !== -1 && scrollViewRef.current) {
          const cardHeight = 400;
          const marginBottom = 20;
          const totalItemHeight = cardHeight + marginBottom;
          const scrollPosition = eventIndex * totalItemHeight;
          
          scrollViewRef.current.scrollTo({
            y: scrollPosition,
            animated: true
          });
        }
      }, 100);
    }
  };

  const handleMiniaturePress = (event: Event) => {
    logger.debug('handleMiniaturePress вызван для события', { eventId: event.id, eventTitle: event.title, showEventFeedBefore: showEventFeed });
    
    // Устанавливаем eventId в URL чтобы useEffect не закрывал ленту
    router.setParams({ eventId: event.id });
    
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

  // Отладочная информация при каждом рендере
  useEffect(() => {
    logger.debug('useEffect showEventFeed', { showEventFeed });
  }, [showEventFeed]);
  
  // Определяем какую коллекцию событий показывать в ленте
  // УПРОЩЕННАЯ ЛОГИКА: Если selectedEvent прошедшее - показываем pastEvents, иначе userEvents
  const eventsToShow = useMemo(() => {
    if (selectedEvent && isEventPast(selectedEvent)) {
      // Если открыто прошедшее событие - показываем прошедшие события (Memories)
      return pastEvents;
    }
    // Иначе показываем обычные события пользователя
    return userEvents;
  }, [selectedEvent, pastEvents, userEvents, isEventPast]);

  // КРИТИЧЕСКИ ВАЖНО: Все ранние возвраты должны быть ПОСЛЕ всех хуков
  // Исправление: проверяем только authUser, getUserData всегда возвращает объект с дефолтными значениями
  if (!authUser || !currentUserId) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Загрузка профиля...</Text>
        </View>
      </View>
    );
  }
  
  // Если userData все еще null (не должно происходить, но на всякий случай)
  if (!userData) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Ошибка загрузки данных профиля</Text>
        </View>
      </View>
    );
  }

  // Если показываем ленту события
  if (showEventFeed) {
    logger.debug('Rendering event feed', { eventsCount: eventsToShow.length, eventIds: eventsToShow.map(e => e.id).join(', ') });
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backToProfile}
          onPress={() => {
            setShowEventFeed(false);
            setSelectedEvent(null);
            // Очищаем URL параметры если они есть
            if (params.eventId) {
              router.setParams({ eventId: undefined });
            }
            // Переходим на общую страницу профиля (таб)
            router.push('/(tabs)/profile');
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
                context="own_profile"
                mediaUrl={event.mediaUrl}
                mediaType={event.mediaType}
                mediaAspectRatio={event.mediaAspectRatio}
                participantsList={event.participantsList}
                participantsData={event.participantsData}
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
        searchPlaceholder={t.profile.searchPlaceholderMy}
        onSearchChange={handleProfileSearch}
        searchQuery={searchQuery}
        showCalendar={true}
        showMap={true}
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
        {/* Аватарка и кнопка настроек */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
            <Image 
              source={{ uri: userData.avatar }} 
              style={styles.profileAvatar}
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
        
        {/* Юзернейм */}
        <Text style={styles.username}>{formatUsername(userData.username)}</Text>
        
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
            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/all-events/${currentUserId}`)}>
              <Text style={styles.statNumber}>{allUserEvents.length}</Text>
              <Text style={styles.statLabel}>{t.profile.statsEvents}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push('/friends-list')}>
              <Text style={styles.statNumber}>{organizerStats?.friends ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsFriends}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-complaints')}>
              <Text style={styles.statNumber}>{organizerStats?.complaints ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsComplaints}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Второй ряд - всегда видимый */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/organized-events/${currentUserId}`)}>
              <Text style={styles.statNumber}>{allOrganizedEvents.length}</Text>
              <Text style={styles.statLabel}>{t.profile.statsOrganized}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push(`/participated-events/${currentUserId}`)}>
              <Text style={styles.statNumber}>{allParticipatedEvents.length}</Text>
              <Text style={styles.statLabel}>{t.profile.statsParticipated}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push('/passport-verification')}>
              <Text style={styles.statNumber}>✓</Text>
              <Text style={styles.statLabel}>{t.profile.statsVerified}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
          <Text style={styles.sectionTitle}>{t.profile.organizer}</Text>
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
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>{t.profile.noOrganizedEvents}</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>{t.profile.participant}</Text>
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
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>{t.profile.noParticipatedEvents}</Text>
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
  memoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    backgroundColor: '#121212',
    width: '100%',
    margin: 0,
    paddingHorizontal: 20,
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
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    flexGrow: 1, // Позволяет контенту растягиваться на всю доступную высоту
    paddingBottom: 100, // Минимальный отступ снизу
  },
  eventCardWrapper: {
    marginBottom: 15,
  },
  lastEventCard: {
    marginBottom: 200, // Значительно увеличиваем отступ после последнего элемента для лучшей видимости
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
});
