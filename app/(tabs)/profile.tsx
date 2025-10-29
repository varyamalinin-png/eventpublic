import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import EventCard from '../../components/EventCard';
import MemoryMiniCard from '../../components/MemoryMiniCard';
import MemoryPost from '../../components/MemoryPost';
import TopBar from '../../components/TopBar';
import { useEvents, Event } from '../../context/EventsContext';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const { events, getOrganizerStats, getFriendsList, getEventProfile, createEventProfile, eventProfiles } = useEvents();
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSecondRow, setShowSecondRow] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Получаем события для формирования userEvents
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const organizedEvents = events.filter(event => 
    event.organizerId === 'own-profile-1' && new Date(event.date) >= today
  );
  
  const participatedEvents = events.filter(event => 
    event.participantsList?.includes('https://randomuser.me/api/portraits/women/68.jpg') &&
    new Date(event.date) >= today
  );
  
  // Все события пользователя для ленты БЕЗ архивных событий
  const userEvents = [...organizedEvents, ...participatedEvents].filter((event, index, self) => 
    index === self.findIndex(e => e.id === event.id)
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
          const eventIndex = userEvents.findIndex(e => e.id === params.eventId);
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
            
            console.log('Scrolling to center event from URL, scrollToY:', scrollToY);
            scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
          }
        }, 200);
      }
    } else if (params.eventId === undefined && showEventFeed) {
      // Если параметр eventId удален из URL, закрываем ленту
      setShowEventFeed(false);
    }
  }, [params.eventId, events, userEvents]);
  
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

  const archivedEvents = events.filter(event => {
    // Простая логика: если в названии есть "архив" или дата в прошлом
    const isArchived = event.title.toLowerCase().includes('архив') || 
                      event.date.includes('прошло') ||
                      event.date.includes('завершено');
    return isArchived;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Получаем все меморис посты (посты, которые пользователь добавил в свой профиль)
  // Memory Posts могут быть только прошедших событий (дата события <= сегодня)
  const memoryPosts = eventProfiles
    .flatMap(profile => {
      const profileDate = new Date(profile.date);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      // Проверяем, что дата события прошедшая (меньше или равна сегодня)
      const isPastDate = profileDate <= todayDate;
      
      if (isPastDate) {
        return profile.posts.filter(post => post.showInProfile);
      }
      return [];
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Все события пользователя для ленты в том же порядке что и в профиле
  // Сначала организованные, потом участник, потом архив
  // При дубликатах приоритет у последнего раздела
  const allEvents = [...organizedEvents, ...participatedEvents, ...archivedEvents];

  // Фильтрация событий по поиску
  const filteredEvents = searchUserEvents(userEvents, searchQuery);

  const handleMemoryPress = (postId: string) => {
    // Создаем комбинированную ленту: события + memories
    const combinedFeed = [...userEvents, ...memoryPosts.map(post => ({ ...post, type: 'memory' }))];
    const memoryIndex = combinedFeed.findIndex(item => item.id === postId && (item as any).type === 'memory');
    
    setSelectedEvent({ ...memoryPosts.find(p => p.id === postId)!, type: 'memory' } as any);
    setShowEventFeed(true);
    
    // Прокручиваем к нужному memory посту после рендера
    setTimeout(() => {
      if (memoryIndex !== -1 && scrollViewRef.current) {
        const cardHeight = 400; // высота карточки
        const marginBottom = 20; // отступ снизу
        const totalItemHeight = cardHeight + marginBottom;
        const scrollPosition = memoryIndex * totalItemHeight;
        
        scrollViewRef.current.scrollTo({
          y: scrollPosition,
          animated: true
        });
      }
    }, 100);
  };

  const handleMiniaturePress = (event: Event) => {
    console.log('🔵 handleMiniaturePress вызван для события:', event.id, event.title);
    console.log('🔵 showEventFeed до:', showEventFeed);
    
    // Устанавливаем eventId в URL чтобы useEffect не закрывал ленту
    router.setParams({ eventId: event.id });
    
    setSelectedEvent(event);
    setShowEventFeed(true);
    
    console.log('🔵 showEventFeed установлено в true');
    
    // Отладочная информация
    console.log('Clicked event:', event.id, event.title);
    console.log('Total events in feed:', userEvents.length);
    console.log('Event index:', userEvents.findIndex(e => e.id === event.id));
    
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
        
        console.log('Scrolling to center event, scrollToY:', scrollToY);
        scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
      }
    }, 200);
  };

  // Отладочная информация при каждом рендере
  useEffect(() => {
    console.log('🟡 useEffect showEventFeed:', showEventFeed);
  }, [showEventFeed]);
  
  // Если показываем ленту события
  console.log('🔴 Render ProfileScreen, showEventFeed:', showEventFeed);
  
  if (showEventFeed) {
    console.log('🔴 Rendering event feed with', userEvents.length, 'events');
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
          }}
        >
          <Text style={styles.backText}>← Назад к профилю</Text>
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
          {userEvents.map((event, index) => (
            <View 
              key={event.id} 
              style={[
                styles.eventCardWrapper,
                index === userEvents.length - 1 && styles.lastEventCard
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
              />
            </View>
          ))}
          
          {/* Memory посты */}
          {memoryPosts.map((post, index) => (
            <View 
              key={`memory-${post.id}`} 
              style={[
                styles.eventCardWrapper,
                index === memoryPosts.length - 1 && styles.lastEventCard
              ]}
            >
              <MemoryPost post={post} />
            </View>
          ))}
          
          {/* Индикатор конца ленты */}
          <View style={styles.endIndicator}>
            <Text style={styles.endIndicatorText}>Конец ленты</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        searchPlaceholder="Поиск моих событий..."
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
        {/* Аватарка */}
        <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
          <Image 
            source={{ uri: 'https://randomuser.me/api/portraits/women/68.jpg' }} 
            style={styles.profileAvatar}
          />
        </TouchableOpacity>
        
        {/* Юзернейм */}
        <Text style={styles.username}>@anna_k</Text>
        
        {/* Имя и возраст */}
        <Text style={styles.nameAndAge}>Анна К., 24 года</Text>
        
        {/* Статистика */}
        <View style={styles.statsContainer}>
          {/* Первый ряд */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-events')}>
              <Text style={styles.statNumber}>{getOrganizerStats('own-profile-1').totalEvents}</Text>
              <Text style={styles.statLabel}>Событий</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push('/friends-list')}>
              <Text style={styles.statNumber}>{getOrganizerStats('own-profile-1').friends}</Text>
              <Text style={styles.statLabel}>Друзей</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-complaints')}>
              <Text style={styles.statNumber}>{getOrganizerStats('own-profile-1').complaints}</Text>
              <Text style={styles.statLabel}>Жалоб</Text>
            </TouchableOpacity>
          </View>
          
          {/* Микрострелочка */}
          <TouchableOpacity 
            style={styles.expandButton} 
            onPress={() => setShowSecondRow(!showSecondRow)}
          >
            <Text style={[styles.expandIcon, showSecondRow && styles.expandIconRotated]}>▼</Text>
          </TouchableOpacity>
          
          {/* Второй ряд (раскрывается динамически) */}
          {showSecondRow && (
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-organized-events')}>
                <Text style={styles.statNumber}>{organizedEvents.length}</Text>
                <Text style={styles.statLabel}>Организовал</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-participated-events')}>
                <Text style={styles.statNumber}>{participatedEvents.length}</Text>
                <Text style={styles.statLabel}>Участвовал</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statItem} onPress={() => router.push('/passport-verification')}>
                <Text style={styles.statNumber}>✓</Text>
                <Text style={styles.statLabel}>Подтвержден</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Результаты поиска или обычные разделы */}
      {searchQuery ? (
        <View style={styles.searchResults}>
          <Text style={styles.searchResultsTitle}>Результаты поиска</Text>
          <View style={styles.eventsContainer}>
            {filteredEvents.length > 0 ? (
              filteredEvents.map(event => (
                <EventCard
                  key={event.id}
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
              ))
            ) : (
              <Text style={styles.emptyText}>События не найдены</Text>
            )}
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>Организатор</Text>
          <View style={styles.eventsContainer}>
            {organizedEvents.length > 0 ? (
              organizedEvents.map(event => (
                <EventCard
                  key={event.id}
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
              ))
            ) : (
              <Text style={styles.emptyText}>Вы пока не организовали ни одного события</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>Участник</Text>
          <View style={styles.eventsContainer}>
            {participatedEvents.length > 0 ? (
              participatedEvents.map(event => (
                <EventCard
                  key={event.id}
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
              ))
            ) : (
              <Text style={styles.emptyText}>Вы пока не участвуете ни в одном событии</Text>
            )}
          </View>

          <Text style={styles.memoriesTitle}>Memories</Text>
          <View style={styles.memoriesContainer}>
              {memoryPosts.length > 0 ? (
                memoryPosts.map(post => (
                  <MemoryMiniCard 
                    key={post.id} 
                    post={post} 
                    onPress={() => handleMemoryPress(post.id)}
                  />
                ))
              ) : (
              <Text style={styles.emptyText}>Memories пуст</Text>
            )}
          </View>
        </View>
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
              source={{ uri: 'https://randomuser.me/api/portraits/women/68.jpg' }} 
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
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
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
    marginBottom: 20,
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
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 50,
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  expandIcon: {
    fontSize: 12,
    color: '#999',
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '180deg' }],
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
  eventsContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
    padding: 0,
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
    flexGrow: 1, // Позволяет контенту растягиваться на всю доступную высоту
    paddingBottom: 100, // Минимальный отступ снизу
  },
  eventCardWrapper: {
    marginBottom: 15,
  },
  lastEventCard: {
    marginBottom: 200, // Значительно увеличиваем отступ после последнего элемента для лучшей видимости
  },
  endIndicator: {
    paddingVertical: 50,
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  endIndicatorText: {
    fontSize: 16,
    color: '#666666',
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
});