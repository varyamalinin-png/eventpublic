import { useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Animated, PanResponder, Dimensions, Image } from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import EventCard from '../../components/EventCard';
import OrganizerCard from '../../components/OrganizerCard';
import TopBar from '../../components/TopBar';
import { useEvents, Event, User } from '../../context/EventsContext';
import { formatUsername, normalizeUsername } from '../../utils/username';

interface FilterOptions {
  participantsMin?: number;
  participantsMax?: number;
  timeHoursMax?: number; // через сколько часов максимально
  priceMax?: number;
  organizerAgeMin?: number;
  organizerAgeMax?: number;
}

interface EventFolder {
  id: string;
  name: string;
  eventIds: string[];
}

export default function ExploreScreen() {
  const [activeTab, setActiveTab] = useState<'GLOB' | 'FRIENDS'>('GLOB');
  const [searchQuery, setSearchQuery] = useState('');
  const [eventHeights, setEventHeights] = useState<{[key: string]: number}>({});
  const handleEventLayout = (eventId: string, height: number) => {
    setEventHeights(prev => ({
      ...prev,
      [eventId]: height
    }));
  };
  
  // Состояния для свайпа и ленты организаторов
  const [showOrganizers, setShowOrganizers] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const eventsScrollViewRef = useRef<ScrollView>(null);
  const organizersScrollViewRef = useRef<ScrollView>(null);
  const [eventsScrollY, setEventsScrollY] = useState(0);
  const [organizersScrollY, setOrganizersScrollY] = useState(0);
  const isSyncingRef = useRef(false);
  
  const router = useRouter();
  const { events, getUserData, getOrganizerStats, getFriendsForEvents, userFolders, createUserFolder, getGlobalEvents } = useEvents();
  
  // Состояния для фильтрации
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  
  // Состояния для папок событий (FRIENDS) - синхронизируем с userFolders из контекста
  const folders: EventFolder[] = userFolders.map(folder => {
    // Получаем все события организаторов из этой папки
    const eventIds = events
      .filter(event => folder.userIds.includes(event.organizerId))
      .map(event => event.id);
    
    return {
      id: folder.id,
      name: folder.name,
      eventIds
    };
  });
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Состояния для календаря
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'timeline'>('month');

  // Функция поиска для explore
  const handleExploreSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Поиск пользователей по username
  const searchUsers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = normalizeUsername(searchQuery);
    if (query.length < 2) return []; // Минимум 2 символа для поиска
    
    // Список всех известных userId
    const allUserIds = [
      'own-profile-1',
      'organizer-1', 'organizer-2', 'organizer-3', 'organizer-4', 'organizer-5',
      'organizer-6', 'organizer-7', 'organizer-8', 'organizer-9', 'organizer-10',
      'organizer-11', 'organizer-12', 'organizer-13', 'organizer-14', 'organizer-15',
      'organizer-16', 'organizer-17', 'organizer-18', 'organizer-19', 'organizer-20',
      'organizer-21'
    ];
    
    const results: User[] = [];
    
    for (const userId of allUserIds) {
      const userData = getUserData(userId);
      const userUsername = normalizeUsername(userData.username);
      
      // Поиск по началу username
      if (userUsername.startsWith(query)) {
        results.push({
          id: userId,
          ...userData
        });
      }
    }
    
    // Ограничиваем результаты 20 пользователями
    return results.slice(0, 20);
  }, [searchQuery, getUserData]);

  // Расширенная фильтрация событий для explore
  const searchEvents = (eventsList: Event[], query: string) => {
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
      
      // Поиск по цене
      if (event.price.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по организатору
      const organizerData = getUserData(event.organizerId);
      if (organizerData.name.toLowerCase().includes(lowerQuery) ||
          organizerData.username.toLowerCase().includes(lowerQuery)) return true;
      
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

  // Получаем организаторов в том же порядке, что и события
  const getOrganizersForEvents = (eventsList: Event[]) => {
    if (!eventsList || !Array.isArray(eventsList)) {
      return [];
    }
    return eventsList
      .filter(event => event && event.organizerId && event.id)
      .map(event => {
        const userData = getUserData(event.organizerId);
        const stats = getOrganizerStats(event.organizerId);
        return {
          eventId: event.id, // Добавляем ID события для связи
          organizerId: event.organizerId,
          ...userData,
          stats
        };
      });
  };


  // PanResponder для свайпа вправо
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return (gestureState.dx > 20 && !showOrganizers) || (Math.abs(gestureState.dx) > 20 && showOrganizers);
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dx > 0) {
        // Свайп вправо - показываем организаторов
        const maxTranslate = 350; // Максимальное смещение
        const translateValue = Math.min(gestureState.dx, maxTranslate);
        translateX.setValue(translateValue);
      } else if (gestureState.dx < 0 && showOrganizers) {
        // Свайп влево при открытых организаторах
        const currentValue = showOrganizers ? 350 : 0;
        const translateValue = Math.max(currentValue + gestureState.dx, 0);
        translateX.setValue(translateValue);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > 150 && !showOrganizers) {
        // Показываем организаторов
        Animated.spring(translateX, {
          toValue: 350,
          useNativeDriver: true,
        }).start();
        setShowOrganizers(true);
      } else if (gestureState.dx < -150 && showOrganizers) {
        // Скрываем организаторов
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        setShowOrganizers(false);
        setActiveTab('GLOB'); // Возвращаем на GLOB при скрытии
      } else if (showOrganizers) {
        // Возвращаем в исходное положение
        Animated.spring(translateX, {
          toValue: 350,
          useNativeDriver: true,
        }).start();
      } else {
        // Возвращаем в исходное положение
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  // Функции синхронизации скролла - ОБНОВЛЕНО для точной синхронизации
  const EVENT_CARD_HEIGHT = 350; // Высота карточки события для синхронизации скролла
  const ORGANIZER_CARD_HEIGHT = 350; // ТОЧНО ТА ЖЕ высота карточки организатора

  const syncScrollToOrganizers = (scrollY: number) => {
    if (!isSyncingRef.current && organizersScrollViewRef.current && Math.abs(scrollY - eventsScrollY) > 20) {
      isSyncingRef.current = true;
      organizersScrollViewRef.current.scrollTo({ y: scrollY, animated: false });
      setEventsScrollY(scrollY);
      setTimeout(() => { isSyncingRef.current = false; }, 100);
    }
  };

  const syncScrollToEvents = (scrollY: number) => {
    if (!isSyncingRef.current && eventsScrollViewRef.current && Math.abs(scrollY - organizersScrollY) > 20) {
      isSyncingRef.current = true;
      eventsScrollViewRef.current.scrollTo({ y: scrollY, animated: false });
      setOrganizersScrollY(scrollY);
      setTimeout(() => { isSyncingRef.current = false; }, 100);
    }
  };

  // Функция фильтрации событий
  const filterEvents = (eventsList: any[]) => {
    return eventsList.filter(event => {
      // Фильтр по количеству участников
      if (filters.participantsMin && event.participants < filters.participantsMin) return false;
      if (filters.participantsMax && event.participants > filters.participantsMax) return false;
      
      // Фильтр по времени (через сколько часов)
      if (filters.timeHoursMax) {
        const eventDateTime = new Date(`${event.date}T${event.time}`);
        const hoursUntilEvent = (eventDateTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);
        if (hoursUntilEvent > filters.timeHoursMax) return false;
      }
      
      // Фильтр по цене
      if (filters.priceMax) {
        const price = event.price.replace(/[^\d]/g, '');
        const priceValue = parseInt(price) || 0;
        if (priceValue > filters.priceMax) return false;
      }
      
      // Фильтр по возрасту организатора
      if (filters.organizerAgeMin || filters.organizerAgeMax) {
        const organizerData = getUserData(event.organizerId);
        // Извлекаем числовой возраст из строки типа "28 лет" или "24 года"
        const ageMatch = organizerData.age.match(/(\d+)/);
        const orgAge = ageMatch ? parseInt(ageMatch[1]) : 0;
        
        if (filters.organizerAgeMin && orgAge < filters.organizerAgeMin) return false;
        if (filters.organizerAgeMax && orgAge > filters.organizerAgeMax) return false;
      }
      
      return true;
    });
  };

  // Мемоизируем фильтрацию событий
  const futureEvents = useMemo(() => 
    events.filter(event => 
      !event.title.toLowerCase().includes('архив') && 
      !event.title.toLowerCase().includes('(архив)')
    ),
    [events]
  );
  
  // Базовые события для табов
  const baseGlobEvents = futureEvents;
  const baseFriendsEvents = useMemo(() => getFriendsForEvents(), [getFriendsForEvents]);
  
  // Применяем фильтры и поиск с мемоизацией
  const globEvents = useMemo(() => {
    // Используем getGlobalEvents() для GLOB - только события, на которые еще не откликался
    const globalEvents = getGlobalEvents();
    const filtered = filterEvents(globalEvents);
    return searchEvents(filtered, searchQuery);
  }, [getGlobalEvents, filters, searchQuery]);
  
  const friendsEvents = useMemo(() => {
    const filtered = filterEvents(baseFriendsEvents);
    return searchEvents(filtered, searchQuery);
  }, [baseFriendsEvents, filters, searchQuery]);
  
  // События для выбранной папки (FRIENDS) с мемоизацией
  const folderEvents = useMemo(() => 
    selectedFolder 
      ? friendsEvents.filter(event => folders.find(f => f.id === selectedFolder)?.eventIds.includes(event.id))
      : friendsEvents,
    [selectedFolder, friendsEvents, folders]
  );

  // Получаем события для текущего таба (те же что отображаются)
  const getCurrentTabEvents = (): Event[] => {
    if (activeTab === 'GLOB') {
      return globEvents || [];
    } else {
      return folderEvents || [];
    }
  };

  // Мемоизируем вычисления чтобы избежать лишних ререндеров
  const currentEvents = useMemo(() => getCurrentTabEvents(), [activeTab, globEvents, folderEvents]);
  const organizersForCurrentEvents = useMemo(() => 
    getOrganizersForEvents(currentEvents), 
    [currentEvents, getUserData, getOrganizerStats]
  );

  // Функции для работы с папками
  const createFolder = () => {
    if (newFolderName.trim()) {
      createUserFolder(newFolderName.trim());
      setNewFolderName('');
      setShowCreateFolder(false);
    }
  };

  const clearFilters = () => {
    setFilters({});
  };

  // Функции для папок
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleFolderPress = (folderId: string | null, index?: number) => {
    // Перемещение папок временно отключено
    if (draggedIndex !== null && index !== undefined && index !== draggedIndex) {
      // Сбрасываем выбор
      setDraggedIndex(null);
      // Вибрация
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Обычный выбор папки
      setSelectedFolder(folderId);
    }
  };

  return (
    <View style={styles.container}>
      {/* Лента организаторов (слева) */}
      <Animated.View 
        style={[
          styles.organizersContainer,
          { transform: [{ translateX: translateX.interpolate({
            inputRange: [0, 350],
            outputRange: [-350, 0],
            extrapolate: 'clamp'
          }) }] }
        ]}
      >
        {/* Заголовок "Организаторы" на том же уровне что и табы GLOB/FRIENDS */}
        <View style={styles.organizersTitleBar}>
          <View style={[
            styles.organizerTab, 
            showOrganizers && styles.activeTab
          ]}>
            <Text style={[
              styles.tabText,
              showOrganizers && styles.activeTabText
            ]}>Организаторы</Text>
          </View>
        </View>
        
        <ScrollView 
          ref={organizersScrollViewRef}
          contentContainerStyle={styles.organizersScrollContent}
          onScroll={(event) => {
            const scrollY = event.nativeEvent.contentOffset.y;
            syncScrollToEvents(scrollY);
          }}
          scrollEventThrottle={16}
        >
          {organizersForCurrentEvents && organizersForCurrentEvents.length > 0 ? organizersForCurrentEvents.map((organizer, index) => {
            const correspondingEvent = currentEvents && currentEvents[index];
            const eventHeight = correspondingEvent ? eventHeights[correspondingEvent.id] : undefined;
            return (
              <OrganizerCard
                key={`${organizer.eventId}-${organizer.organizerId}`}
                organizerId={organizer.organizerId}
                name={organizer.name}
                age={organizer.age}
                username={organizer.username}
                avatar={organizer.avatar}
                bio={organizer.bio}
                geoPosition={organizer.geoPosition}
                stats={organizer.stats}
                correspondingEventId={organizer.eventId}
                eventHeight={eventHeight}
              />
            );
          }) : null}
        </ScrollView>
      </Animated.View>

      {/* Статичная верхняя панель - поиск и карта */}
      <TopBar
        searchPlaceholder="Поиск событий и людей..."
        onSearchChange={handleExploreSearch}
        searchQuery={searchQuery}
        showCalendar={true}
        showMap={true}
        exploreTab={activeTab}
      />

      {/* Результаты поиска пользователей - появляется динамически между TopBar и табами */}
      {searchUsers.length > 0 && (
        <View style={styles.usersSearchResults}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.usersSearchScrollContent}
          >
            {searchUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userSearchItem}
                onPress={() => router.push(`/profile/${user.id}`)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: user.avatar }}
                  style={styles.userSearchAvatar}
                />
                <Text style={styles.userSearchUsername} numberOfLines={1}>
                  {formatUsername(user.username)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Панель фильтров */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filtersTitle}>Фильтры</Text>
          
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Участники:</Text>
            <View style={styles.filterInputs}>
              <TextInput
                style={styles.filterInput}
                placeholder="От"
                keyboardType="numeric"
                value={filters.participantsMin?.toString() || ''}
                onChangeText={(text) => setFilters({...filters, participantsMin: parseInt(text) || undefined})}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="До"
                keyboardType="numeric"
                value={filters.participantsMax?.toString() || ''}
                onChangeText={(text) => setFilters({...filters, participantsMax: parseInt(text) || undefined})}
              />
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Время (часов до события):</Text>
            <TextInput
              style={styles.filterInputWide}
              placeholder="Максимум"
              keyboardType="numeric"
              value={filters.timeHoursMax?.toString() || ''}
              onChangeText={(text) => setFilters({...filters, timeHoursMax: parseInt(text) || undefined})}
            />
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Цена (максимум руб.):</Text>
            <TextInput
              style={styles.filterInputWide}
              placeholder="Максимум"
              keyboardType="numeric"
              value={filters.priceMax?.toString() || ''}
              onChangeText={(text) => setFilters({...filters, priceMax: parseInt(text) || undefined})}
            />
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Возраст организатора:</Text>
            <View style={styles.filterInputs}>
              <TextInput
                style={styles.filterInput}
                placeholder="От"
                keyboardType="numeric"
                value={filters.organizerAgeMin?.toString() || ''}
                onChangeText={(text) => setFilters({...filters, organizerAgeMin: parseInt(text) || undefined})}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="До"
                keyboardType="numeric"
                value={filters.organizerAgeMax?.toString() || ''}
                onChangeText={(text) => setFilters({...filters, organizerAgeMax: parseInt(text) || undefined})}
              />
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Очистить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyFiltersButton} onPress={() => setShowFilters(false)}>
              <Text style={styles.applyFiltersText}>Применить</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      {/* Контент лент - свайпаемая часть */}
      <Animated.View 
        style={[
          styles.swipeableContent,
          { transform: [{ translateX: translateX }] }
        ]}
        {...panResponder.panHandlers}
      >
      {/* Панель с табами GLOB/FRIENDS - теперь часть свайпаемого контента */}
      <View style={styles.tabsBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'GLOB' && styles.activeTab]}
          onPress={() => {
            setActiveTab('GLOB');
            setShowOrganizers(false);
            translateX.setValue(0);
          }}
        >
          {activeTab === 'GLOB' && (
            <TouchableOpacity 
              style={styles.filterButtonSmall}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={styles.filterIconSmall}>⚙️</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.tabText, activeTab === 'GLOB' && styles.activeTabText]}>GLOB</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'FRIENDS' && styles.activeTab]}
          onPress={() => {
            setActiveTab('FRIENDS');
            setShowOrganizers(false);
            translateX.setValue(0);
          }}
        >
          {activeTab === 'FRIENDS' && (
            <TouchableOpacity 
              style={styles.filterButtonSmall}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={styles.filterIconSmall}>⚙️</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.tabText, activeTab === 'FRIENDS' && styles.activeTabText]}>FRIENDS</Text>
        </TouchableOpacity>

      </View>

      {/* Папки для FRIENDS - перемещены ниже табов */}
      {activeTab === 'FRIENDS' && (
        <View style={styles.foldersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.foldersScroll}>
            <TouchableOpacity 
              style={[styles.folderItem, selectedFolder === null && styles.selectedFolder]}
              onPress={() => handleFolderPress(null)}
            >
              <Text style={[styles.folderText, selectedFolder === null && styles.selectedFolderText]}>
                Все
              </Text>
            </TouchableOpacity>
            
            {folders.map((folder, index) => (
              <TouchableOpacity
                key={folder.id}
                style={[
                  styles.folderItem, 
                  selectedFolder === folder.id && styles.selectedFolder,
                  draggedIndex === index && styles.draggedFolder
                ]}
                onPress={() => handleFolderPress(folder.id, index)}
                onLongPress={() => handleDragStart(index)}
              >
                <Text style={[styles.folderText, selectedFolder === folder.id && styles.selectedFolderText]}>
                  {folder.name}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Кнопка добавления папки */}
            <TouchableOpacity 
              style={styles.addFolderButtonSmall}
              onPress={() => setShowCreateFolder(true)}
            >
              <Text style={styles.addFolderIconSmall}>+</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <ScrollView 
        ref={eventsScrollViewRef}
        contentContainerStyle={styles.eventsContainer}
        onScroll={(event) => {
          const scrollY = event.nativeEvent.contentOffset.y;
          syncScrollToOrganizers(scrollY);
        }}
        scrollEventThrottle={16}
      >
        {activeTab === 'GLOB' ? (
          globEvents.length > 0 ? (
            globEvents.map((event) => (
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
              variant="default"
                mediaUrl={event.mediaUrl}
                mediaType={event.mediaType}
                mediaAspectRatio={event.mediaAspectRatio}
                participantsList={event.participantsList}
                participantsData={event.participantsData}
                context="explore"
                onLayout={(height) => handleEventLayout(event.id, height)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Пока нет событий</Text>
              <Text style={styles.emptySubtext}>Создайте первое событие!</Text>
            </View>
          )
        ) : (
          folderEvents.length > 0 ? (
            folderEvents.map((event) => (
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
              variant="default"
                mediaUrl={event.mediaUrl}
                mediaType={event.mediaType}
                mediaAspectRatio={event.mediaAspectRatio}
                participantsList={event.participantsList}
                participantsData={event.participantsData}
                context="explore"
                onLayout={(height) => handleEventLayout(event.id, height)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Нет событий с друзьями</Text>
              <Text style={styles.emptySubtext}>Пригласите друзей на события!</Text>
            </View>
          )
        )}
      </ScrollView>
      </Animated.View>

      {/* Модальное окно создания папки */}
      <Modal
        visible={showCreateFolder}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateFolder(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Создать папку</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Название папки"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus={true}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowCreateFolder(false)}
              >
                <Text style={styles.modalCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalCreateButton}
                onPress={createFolder}
              >
                <Text style={styles.modalCreateText}>Создать</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  organizersContainer: {
    position: 'absolute',
    left: 0,
    top: 130, // Увеличиваем чтобы точно избежать перекрытия строки поиска
    width: 350,
    bottom: 0, // Используем bottom вместо height для правильного позиционирования
    backgroundColor: '#121212',
    zIndex: 1,
  },
  organizersTitleBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
    // Убираем paddingTop чтобы выровнять с tabsBar на одной высоте
    justifyContent: 'center',
    alignItems: 'center',
  },
  organizersTitleText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '500',
  },
  organizersScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 0, // Убираем отступ сверху для выравнивания с событиями
    paddingBottom: 100,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#121212',
  },
  swipeableContent: {
    flex: 1,
    backgroundColor: '#121212',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    flex: 1,
    marginRight: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    marginLeft: 8,
  },
  searchIcon: {
    fontSize: 18,
    color: '#999',
  },
  mapButton: {
    padding: 8,
  },
  mapIcon: {
    fontSize: 24,
  },
  tabsBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  organizerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  filterButtonSmall: {
    position: 'absolute',
    left: 0,
    padding: 4,
    opacity: 0.8,
  },
  filterIconSmall: {
    fontSize: 16,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066CC',
  },
  tabText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFF',
    fontSize: 18,
  },
  eventsContainer: {
    paddingHorizontal: 20,
    paddingTop: 0, // Убираем компенсацию - теперь структура одинаковая в обеих лентах
    paddingBottom: 20,
  },
  eventCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#3D3B3B',
    borderRadius: 12,
    marginBottom: 15,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  // Стили для фильтров
  filtersPanel: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filtersTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    color: '#CCC',
    fontSize: 14,
    width: 120,
    marginRight: 10,
  },
  filterInputs: {
    flexDirection: 'row',
    flex: 1,
  },
  filterInput: {
    backgroundColor: '#333',
    color: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  filterInputWide: {
    backgroundColor: '#333',
    color: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 14,
    flex: 1,
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
  },
  clearFiltersButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#666',
  },
  clearFiltersText: {
    color: '#666',
    fontSize: 14,
  },
  applyFiltersButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 6,
  },
  applyFiltersText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Стили для папок
  usersSearchResults: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  usersSearchScrollContent: {
    paddingHorizontal: 20,
    paddingRight: 20,
  },
  userSearchItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 70,
  },
  userSearchAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    backgroundColor: '#333',
  },
  userSearchUsername: {
    fontSize: 12,
    color: '#FFF',
    textAlign: 'center',
    maxWidth: 70,
  },
  foldersContainer: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  addFolderButtonSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
  addFolderIconSmall: {
    color: '#999',
    fontSize: 16,
    fontWeight: 'normal',
  },
  draggedFolder: {
    opacity: 0.7,
    transform: [{ scale: 1.05 }],
    zIndex: 1000,
  },
  foldersScroll: {
    flexDirection: 'row',
  },
  folderItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedFolder: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  folderText: {
    color: '#CCC',
    fontSize: 14,
  },
  selectedFolderText: {
    color: '#FFF',
    fontWeight: '600',
  },
  // Стили для модального окна
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#333',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    flex: 1,
    marginRight: 10,
  },
  modalCancelText: {
    color: '#CCC',
    fontSize: 16,
    textAlign: 'center',
  },
  modalCreateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    flex: 1,
  },
  modalCreateText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});