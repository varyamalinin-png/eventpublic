import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Animated, PanResponder, Dimensions, Image, Platform, RefreshControl } from 'react-native';
import { Link, useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRefresh } from '../../hooks/useRefresh';
import { SkeletonFeed } from '../../components/SkeletonCard';
import * as Location from 'expo-location';
import EventCard from '../../components/EventCard';
import OrganizerCard from '../../components/OrganizerCard';
import TopBar from '../../components/TopBar';
import { useEvents, Event, User } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatUsername, normalizeUsername } from '../../utils/username';
import { apiRequest } from '../../services/api';

interface FilterOptions {
  participantsMin?: number;
  participantsMax?: number;
  timeHoursMax?: number; // через сколько часов максимально
  priceMax?: number;
  organizerAgeMin?: number;
  organizerAgeMax?: number;
  selectedTags?: string[]; // Выбранные метки для фильтрации
}

interface EventFolder {
  id: string;
  name: string;
  eventIds: string[];
}

// Количество событий, подгружаемых за один раз (прогрессивный рендеринг)
const PAGE_SIZE = 12;

export default function ExploreScreen() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'GLOB' | 'FRIENDS'>('GLOB');
  const [searchQuery, setSearchQuery] = useState('');
  // Прогрессивный рендеринг: начинаем с PAGE_SIZE событий, добавляем при скролле к концу
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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
  const { refreshing, onRefresh } = useRefresh();
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          setUserCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
        }
      } catch {}
    })();
  }, []);
  const organizersScrollViewRef = useRef<ScrollView>(null);
  
  const router = useRouter();
  
  // ВЕБ-ПРОВЕРКИ: Безопасное получение контекстов с обработкой ошибок
  let eventsContext, authContext;
  try {
    eventsContext = useEvents();
    authContext = useAuth();
  } catch (error) {
    console.error('[Explore] Error getting contexts:', error);
    if (typeof window !== 'undefined' && Platform.OS === 'web') {
      console.error('[Explore] Context initialization failed on web');
    }
    // Fallback значения
    const defaultUser: User = {
      id: '',
      name: '',
      username: '',
      avatar: '',
      age: '',
      bio: '',
      geoPosition: '',
    };
    eventsContext = {
      events: [],
      getUserData: () => defaultUser,
      getOrganizerStats: () => ({ totalEvents: 0, organizedEvents: 0, participatedEvents: 0, complaints: 0, friends: 0 }),
      getFriendsForEvents: () => [],
      userFolders: [],
      createUserFolder: async () => {},
      getGlobalEvents: () => [],
      isUserEventMember: () => false,
      eventProfiles: [],
      fetchEventProfile: async () => null,
    };
    authContext = { user: null };
  }
  
  const { events, getUserData, getOrganizerStats, getFriendsForEvents, userFolders, createUserFolder, getGlobalEvents, isUserEventMember, eventProfiles, fetchEventProfile } = eventsContext;
  const { user: authUser } = authContext;
  const accessToken = (authContext as any).accessToken ?? null;
  const currentUserId = authUser?.id ?? null;

  useEffect(() => {
  }, [accessToken, currentUserId]);

  // Отслеживаем количество событий для прокрутки к началу при появлении новых
  const prevEventsCountRef = useRef<number>(0);
  
  // Состояния для фильтрации
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  
  // Функция для подсчета активных фильтров
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.participantsMin !== undefined && filters.participantsMin > 0) count++;
    if (filters.participantsMax !== undefined && filters.participantsMax > 0) count++;
    if (filters.timeHoursMax !== undefined && filters.timeHoursMax > 0) count++;
    if (filters.priceMax !== undefined && filters.priceMax > 0) count++;
    if (filters.organizerAgeMin !== undefined && filters.organizerAgeMin > 0) count++;
    if (filters.organizerAgeMax !== undefined && filters.organizerAgeMax > 0) count++;
    if (filters.selectedTags && filters.selectedTags.length > 0) count++;
    return count;
  };
  
  // Состояния для папок событий (FRIENDS) - синхронизируем с userFolders из контекста
  const folders: EventFolder[] = useMemo(() => {
    try {
      if (!Array.isArray(userFolders)) {
        console.warn('[Explore] userFolders is not an array:', userFolders);
        return [];
      }
      if (!Array.isArray(events)) {
        console.warn('[Explore] events is not an array in folders calculation:', events);
        return [];
      }
      return userFolders.map(folder => {
        if (!folder || !folder.id || !Array.isArray(folder.userIds)) {
          console.warn('[Explore] Invalid folder:', folder);
          return null;
        }
        // Получаем все события организаторов из этой папки
        const eventIds = events
          .filter(event => event && event.organizerId && folder.userIds.includes(event.organizerId))
          .map(event => event.id);
        
        return {
          id: folder.id,
          name: folder.name || 'Unnamed',
          eventIds
        };
      }).filter((f): f is EventFolder => f !== null);
    } catch (error) {
      console.error('[Explore] Error calculating folders:', error);
      return [];
    }
  }, [userFolders, events]);
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
  const knownUserIds = useMemo(() => {
    const ids = new Set<string>();
    events.forEach(event => {
      ids.add(event.organizerId);
      event.participantsData?.forEach(participant => {
        if (participant.userId) {
          ids.add(participant.userId);
        }
      });
    });
    userFolders.forEach(folder => {
      folder.userIds.forEach(id => ids.add(id));
    });
    if (currentUserId) {
      ids.add(currentUserId);
    }
    return Array.from(ids);
  }, [events, userFolders, currentUserId]);

  const searchUsers = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = normalizeUsername(searchQuery);
    if (query.length < 2) return [];

    const results: User[] = [];

    for (const userId of knownUserIds) {
      try {
        const userData = getUserData(userId);
        if (!userData || !userData.username) continue;
        const userUsername = normalizeUsername(userData.username);

        if (userUsername.startsWith(query)) {
          results.push({
            id: userId,
            ...userData,
          });
        }
      } catch (error) {
        console.warn('[Explore] Error getting user data for search:', userId, error);
      }
    }

    return results.slice(0, 20);
  }, [searchQuery, knownUserIds, getUserData]);

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
      try {
        const organizerData = getUserData(event.organizerId);
        if (organizerData?.name?.toLowerCase().includes(lowerQuery) ||
            organizerData?.username?.toLowerCase().includes(lowerQuery)) return true;
      } catch (error) {
        // Игнорируем ошибки получения данных организатора
      }
      
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

  // Получаем организаторов в том же порядке, что и события.
  // ВАЖНО: НЕ вызываем getOrganizerStats здесь — это триггерит /complaints/count для каждого
  // организатора (2-3с на запрос) и вызывает каскадные ре-рендеры через setOrganizerStatsCache.
  // Статистика грузится лениво внутри OrganizerCard при открытии панели.
  const getOrganizersForEvents = (eventsList: Event[]) => {
    if (!eventsList || !Array.isArray(eventsList)) {
      return [];
    }
    return eventsList
      .filter(event => event && event.organizerId && event.id)
      .map(event => {
        try {
          const userData = getUserData(event.organizerId);
          if (!userData) return null;
          // Вычисляем sharedEvents если это не текущий пользователь
          const sharedEvents = currentUserId && currentUserId !== event.organizerId
            ? events.filter(e => isUserEventMember(e, currentUserId) && isUserEventMember(e, event.organizerId)).length
            : undefined;
          return {
            eventId: event.id,
            organizerId: event.organizerId,
            name: userData.name,
            username: userData.username,
            avatar: userData.avatar,
            age: userData.age,
            bio: userData.bio,
            geoPosition: userData.geoPosition,
            // Плейсхолдер — реальные данные грузит OrganizerCard сам
            stats: {
              totalEvents: 0, organizedEvents: 0, participatedEvents: 0,
              complaints: 0, friends: 0, sharedEvents
            }
          };
        } catch (error) {
          console.error('[Explore] Error getting organizer data:', event.organizerId, error);
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  };


  // PanResponder для свайпа вправо
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gs) =>
      Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 15,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 15,
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0 && !showOrganizers) {
        translateX.setValue(Math.min(gs.dx, ORGANIZER_WIDTH));
      } else if (gs.dx < 0 && showOrganizers) {
        translateX.setValue(Math.max(ORGANIZER_WIDTH + gs.dx, 0));
      }
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 100 && !showOrganizers) {
        Animated.spring(translateX, { toValue: ORGANIZER_WIDTH, useNativeDriver: false }).start();
        setShowOrganizers(true);
      } else if (gs.dx < -100 && showOrganizers) {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
        setShowOrganizers(false);
      } else {
        Animated.spring(translateX, { toValue: showOrganizers ? ORGANIZER_WIDTH : 0, useNativeDriver: false }).start();
      }
    },
  });

  const ORGANIZER_WIDTH = 300;
  const rawScreenW = Dimensions.get('window').width;
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawScreenW, 500) : rawScreenW;
  const ROW_WIDTH = SCREEN_W + ORGANIZER_WIDTH;

  // Получаем все уникальные метки из событий
  const allAvailableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    events.forEach(event => {
      if (event.tags && Array.isArray(event.tags)) {
        event.tags.forEach(tag => {
          if (tag && typeof tag === 'string') {
            tagsSet.add(tag);
          }
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [events]);

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
        try {
          const organizerData = getUserData(event.organizerId);
          if (!organizerData || !organizerData.age) return true; // Пропускаем если нет данных
          // Извлекаем числовой возраст из строки типа "28 лет" или "24 года"
          const ageMatch = organizerData.age.match(/(\d+)/);
          const orgAge = ageMatch ? parseInt(ageMatch[1]) : 0;
          
          if (filters.organizerAgeMin && orgAge < filters.organizerAgeMin) return false;
          if (filters.organizerAgeMax && orgAge > filters.organizerAgeMax) return false;
        } catch (error) {
          console.error('[Explore] Error filtering by organizer age:', error);
          return true; // Пропускаем если ошибка
        }
      }
      
      // Фильтр по меткам (тегам)
      if (filters.selectedTags && filters.selectedTags.length > 0) {
        const eventTags = event.tags || [];
        // Проверяем, что событие содержит хотя бы одну из выбранных меток
        const hasSelectedTag = filters.selectedTags.some(selectedTag => 
          eventTags.some((eventTag: string) => 
            eventTag.toLowerCase() === selectedTag.toLowerCase()
          )
        );
        if (!hasSelectedTag) return false;
      }
      
      return true;
    });
  };

  // Мемоизируем фильтрацию событий
  const futureEvents = useMemo(() => {
    try {
      if (!Array.isArray(events)) {
        return [];
      }
      return events.filter(event => {
        if (!event || !event.title) return false;
        const titleLower = event.title.toLowerCase();
        return !titleLower.includes('архив') && !titleLower.includes('(архив)');
      });
    } catch (error) {
      console.error('[Explore] Error filtering future events:', error);
      return [];
    }
  }, [events]);
  
  // Базовые события для табов
  const baseGlobEvents = futureEvents;
  const baseFriendsEvents = useMemo(() => getFriendsForEvents(), [getFriendsForEvents]);
  
  // Применяем фильтры и поиск с мемоизацией
  const globEvents = useMemo(() => {
    const globalEvents = getGlobalEvents();
    const filtered = filterEvents(globalEvents);
    let result = searchEvents(filtered, searchQuery);
    // Sort by distance if user location available (Haversine formula for accurate geo-distance)
    if (userCoords && !searchQuery) {
      const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      result = [...result].sort((a, b) => {
        const distA = a.latitude && a.longitude
          ? haversineDistance(userCoords.lat, userCoords.lon, a.latitude, a.longitude) : 999;
        const distB = b.latitude && b.longitude
          ? haversineDistance(userCoords.lat, userCoords.lon, b.latitude, b.longitude) : 999;
        return distA - distB;
      });
    }
    return result;
  }, [getGlobalEvents, filters, searchQuery, userCoords]);
  
  // Прокручиваем к началу при появлении нового события организатора
  useEffect(() => {
    if (globEvents.length > prevEventsCountRef.current && eventsScrollViewRef.current && activeTab === 'GLOB') {
      // Небольшая задержка для рендеринга
      setTimeout(() => {
        eventsScrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 300);
    }
    prevEventsCountRef.current = globEvents.length;
  }, [globEvents.length, activeTab]);
  
  // Прокручиваем к началу при переходе на вкладку explore после создания события
  useFocusEffect(
    useMemo(() => {
      return () => {
        // При потере фокуса сохраняем количество событий
        prevEventsCountRef.current = globEvents.length;
      };
    }, [globEvents.length])
  );
  
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
    // getOrganizerStats намеренно исключён — см. getOrganizersForEvents
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentEvents, getUserData, currentUserId, events, isUserEventMember]
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

  // Функции для удаления отдельных фильтров
  const removeFilter = (filterType: keyof FilterOptions | 'participantsRange' | 'organizerAgeRange', value?: string) => {
    if (filterType === 'selectedTags' && value) {
      const currentTags = filters.selectedTags || [];
      const newTags = currentTags.filter(t => t !== value);
      setFilters({ ...filters, selectedTags: newTags.length > 0 ? newTags : undefined });
    } else if (filterType === 'participantsRange') {
      // Удаляем оба фильтра участников
      setFilters({ ...filters, participantsMin: undefined, participantsMax: undefined });
    } else if (filterType === 'organizerAgeRange') {
      // Удаляем оба фильтра возраста организатора
      setFilters({ ...filters, organizerAgeMin: undefined, organizerAgeMax: undefined });
    } else {
      setFilters({ ...filters, [filterType as keyof FilterOptions]: undefined });
    }
  };

  // Получаем примененные фильтры для отображения
  const getAppliedFilters = () => {
    const applied: Array<{ type: keyof FilterOptions | 'participantsRange'; label: string; value: string | number }> = [];
    
    // Участники - показываем как диапазон
    if ((filters.participantsMin !== undefined && filters.participantsMin > 0) || 
        (filters.participantsMax !== undefined && filters.participantsMax > 0)) {
      const min = filters.participantsMin || 0;
      const max = filters.participantsMax || '∞';
      const rangeText = max === '∞' ? `≥${min}` : min === 0 ? `≤${max}` : `${min}-${max}`;
      applied.push({ type: 'participantsRange' as any, label: t.explore.filterLabelParticipants || 'Participants', value: rangeText });
    }
    
    // Возраст организатора - показываем как диапазон
    if ((filters.organizerAgeMin !== undefined && filters.organizerAgeMin > 0) || 
        (filters.organizerAgeMax !== undefined && filters.organizerAgeMax > 0)) {
      const min = filters.organizerAgeMin || 0;
      const max = filters.organizerAgeMax || '∞';
      const rangeText = max === '∞' ? `≥${min}` : min === 0 ? `≤${max}` : `${min}-${max}`;
      applied.push({ type: 'organizerAgeRange' as any, label: t.explore.filterLabelOrganizerAge || 'Organizer age', value: rangeText });
    }
    
    if (filters.timeHoursMax !== undefined && filters.timeHoursMax > 0) {
      applied.push({ type: 'timeHoursMax', label: t.explore.filterLabelTime || 'Time', value: `${filters.timeHoursMax}h` });
    }
    if (filters.priceMax !== undefined && filters.priceMax > 0) {
      applied.push({ type: 'priceMax', label: t.explore.filterLabelPrice || 'Price', value: `≤${filters.priceMax}₽` });
    }
    if (filters.selectedTags && filters.selectedTags.length > 0) {
      filters.selectedTags.forEach(tag => {
        applied.push({ type: 'selectedTags', label: tag, value: tag });
      });
    }
    
    return applied;
  };

  // Функции для папок
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleFolderPress = (folderId: string | null, index?: number) => {
    // Перемещение папок временно отключено
    if (draggedIndex !== null && index !== undefined && index !== draggedIndex) {
      // Сбрасываем выбор
      setDraggedIndex(null);
      // Вибрация
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      // Обычный выбор папки
      setSelectedFolder(folderId);
    }
  };

  // ВЕБ-ПРОВЕРКИ: Fallback UI если контексты не загрузились
  if (!eventsContext || !authContext) {
    if (typeof window !== 'undefined' && Platform.OS === 'web') {
      console.error('[Explore] Contexts not available, showing fallback');
    }
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <SkeletonFeed count={3} />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Статичная верхняя панель - поиск и карта */}
      <TopBar
        searchPlaceholder={t.explore.searchEventsAndPeople || 'Search events and people...'}
        onSearchChange={handleExploreSearch}
        searchQuery={searchQuery}
        showCalendar={true}
        showMap={true}
        exploreTab={activeTab}
        onFilterPress={() => setShowFilters(!showFilters)}
        activeFiltersCount={getActiveFiltersCount()}
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

      {/* Примененные фильтры - между поиском и табами */}
      {getAppliedFilters().length > 0 && (
        <View style={styles.appliedFiltersContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.appliedFiltersScrollContent}
          >
            {getAppliedFilters().map((filter, index) => (
              <View key={`${filter.type}-${index}`} style={styles.appliedFilterTag}>
                <Text style={styles.appliedFilterText}>
                  {filter.type === 'selectedTags' ? ({ 'age_18_plus': '18+', 'age_21_plus': '21+', 'women_only': 'women only', 'men_only': 'men only', 'recurring': 'recurring', 'starting_soon': 'starting soon', 'массовое': 'массовое' }[filter.value as string] || filter.value) : `${filter.label}: ${filter.value}`}
                </Text>
                <TouchableOpacity
                  style={styles.removeFilterButton}
                  onPress={() => removeFilter(filter.type, typeof filter.value === 'string' ? filter.value : undefined)}
                >
                  <Text style={styles.removeFilterIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Панель фильтров */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filtersTitle}>{t.explore.filters}</Text>
          
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>{t.explore.filterLabelParticipants}</Text>
            <View style={styles.filterInputs}>
              <TextInput
                style={styles.filterInput}
                placeholder={t.explore.from}
                keyboardType="numeric"
                value={filters.participantsMin?.toString() || ''}
                onChangeText={(text) => setFilters({...filters, participantsMin: parseInt(text) || undefined})}
              />
              <TextInput
                style={styles.filterInput}
                placeholder={t.createEvent.to || 'To'}
                keyboardType="numeric"
                value={filters.participantsMax?.toString() || ''}
                onChangeText={(text) => setFilters({...filters, participantsMax: parseInt(text) || undefined})}
              />
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>{t.explore.filterLabelTime || 'Time (hours until event):'}</Text>
            <TextInput
              style={styles.filterInputWide}
              placeholder={t.explore.maximum || 'Maximum'}
              keyboardType="numeric"
              value={filters.timeHoursMax?.toString() || ''}
              onChangeText={(text) => setFilters({...filters, timeHoursMax: parseInt(text) || undefined})}
            />
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>{t.explore.filterLabelPrice || 'Price (max rub.):'}</Text>
            <TextInput
              style={styles.filterInputWide}
              placeholder={t.explore.maximum || 'Maximum'}
              keyboardType="numeric"
              value={filters.priceMax?.toString() || ''}
              onChangeText={(text) => setFilters({...filters, priceMax: parseInt(text) || undefined})}
            />
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>{t.explore.filterLabelOrganizerAge || 'Organizer age:'}</Text>
            <View style={styles.filterInputs}>
              <TextInput
                style={styles.filterInput}
                placeholder={t.explore.from || 'From'}
                keyboardType="numeric"
                value={filters.organizerAgeMin?.toString() || ''}
                onChangeText={(text) => setFilters({...filters, organizerAgeMin: parseInt(text) || undefined})}
              />
              <TextInput
                style={styles.filterInput}
                placeholder={t.createEvent.to || 'To'}
                keyboardType="numeric"
                value={filters.organizerAgeMax?.toString() || ''}
                onChangeText={(text) => setFilters({...filters, organizerAgeMax: parseInt(text) || undefined})}
              />
            </View>
          </View>

          {/* Фильтр по меткам (тегам) */}
          {allAvailableTags.length > 0 && (
            <View style={styles.filterRowTags}>
              <Text style={styles.filterLabel}>{'Tags'}</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.tagsContainer}
                contentContainerStyle={styles.tagsContent}
              >
                {allAvailableTags.map(tag => {
                  const isSelected = filters.selectedTags?.includes(tag) || false;
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.tagButton,
                        isSelected && styles.tagButtonSelected
                      ]}
                      onPress={() => {
                        const currentTags = filters.selectedTags || [];
                        const newTags = isSelected
                          ? currentTags.filter(t => t !== tag)
                          : [...currentTags, tag];
                        setFilters({ ...filters, selectedTags: newTags.length > 0 ? newTags : undefined });
                      }}
                    >
                      <Text style={[
                        styles.tagButtonText,
                        isSelected && styles.tagButtonTextSelected
                      ]}>
                        {{ 'age_18_plus': '18+', 'age_21_plus': '21+', 'age_16_plus': '16+', 'women_only': 'women only', 'men_only': 'men only', 'recurring': 'recurring', 'starting_soon': 'starting soon', 'массовое': 'массовое', 'регулярное': 'recurring' }[tag] || tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>{t.explore.clearFilters || 'Clear'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyFiltersButton} onPress={() => setShowFilters(false)}>
              <Text style={styles.applyFiltersText}>{t.explore.applyFilters || 'Apply'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      {/* Контент — единая широкая лента, сдвигается горизонтально */}
      <View style={{ flex: 1, overflow: 'hidden' }} {...panResponder.panHandlers}>
      <Animated.View style={{ flex: 1, width: SCREEN_W + ORGANIZER_WIDTH, transform: [{ translateX: Animated.subtract(translateX, new Animated.Value(ORGANIZER_WIDTH)) }] }}>
      <ScrollView
        ref={eventsScrollViewRef}
        contentContainerStyle={{ paddingBottom: 24 }}
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8D32" />}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          if (contentSize.height - contentOffset.y - layoutMeasurement.height >= 1500) return;
          // Условие выше истинно на всей последней тысяче пикселей, а onScroll летит
          // ~10 раз в секунду — без потолка по длине списка счётчик рос бы бесконечно
          const total = (activeTab === 'GLOB' ? globEvents : folderEvents).length;
          setVisibleCount(prev => (prev >= total ? prev : Math.min(prev + PAGE_SIZE, total)));
        }}
        scrollEventThrottle={100}
      >
        {/* Табы — ряд с организаторским spacer слева */}
        <View style={{ flexDirection: 'row', width: SCREEN_W + ORGANIZER_WIDTH }}>
          <View style={{ width: ORGANIZER_WIDTH, paddingHorizontal: 8 }}>
            <View style={styles.tabsBar}>
              <View style={[styles.tab, styles.activeTab]}>
                <Text style={[styles.tabText, styles.activeTabText]}>{t.explore.organizers}</Text>
              </View>
            </View>
          </View>
        <View style={[styles.tabsBar, { width: SCREEN_W, paddingHorizontal: 20 }]} {...(Platform.OS === 'web' ? { nativeID: 'explore-tabs-bar', dataSet: { exploreTabsBar: 'true' } } : {})}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'GLOB' && styles.activeTab]}
            onPress={() => {
              setActiveTab('GLOB');
              setVisibleCount(PAGE_SIZE);
              setShowOrganizers(false);
              translateX.setValue(0);
            }}
            {...(Platform.OS === 'web' ? { dataSet: { active: activeTab === 'GLOB' ? 'true' : 'false' } } : {})}
          >
            <Text style={[styles.tabText, activeTab === 'GLOB' && styles.activeTabText]}>GLOB</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'FRIENDS' && styles.activeTab]}
            onPress={() => {
              setActiveTab('FRIENDS');
              setVisibleCount(PAGE_SIZE);
              setShowOrganizers(false);
              translateX.setValue(0);
            }}
            {...(Platform.OS === 'web' ? { dataSet: { active: activeTab === 'FRIENDS' ? 'true' : 'false' } } : {})}
          >
            <Text style={[styles.tabText, activeTab === 'FRIENDS' && styles.activeTabText]}>FRIENDS</Text>
          </TouchableOpacity>

        </View>
        </View>

        {/* Папки для FRIENDS - перемещены внутрь ScrollView */}
        {activeTab === 'FRIENDS' && (
          <View style={styles.foldersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.foldersScroll}>
              <TouchableOpacity 
                style={[styles.folderItem, selectedFolder === null && styles.selectedFolder]}
                onPress={() => handleFolderPress(null)}
              >
                <Text style={[styles.folderText, selectedFolder === null && styles.selectedFolderText]}>
                  {t.settings.profileVisibility.all}
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

        {activeTab === 'GLOB' ? (
          globEvents.length > 0 ? (
            globEvents.slice(0, visibleCount).map((event) => {
              const org = organizersForCurrentEvents?.find(o => o.eventId === event.id);
              return (
                <View key={event.id} style={{ flexDirection: 'row', width: SCREEN_W + ORGANIZER_WIDTH }}>
                  <View style={{ width: ORGANIZER_WIDTH, paddingHorizontal: 8 }}>
                    <OrganizerCard
                      organizerId={event.organizerId}
                      name={org?.name || ''}
                      age={org?.age || ''}
                      username={org?.username || ''}
                      avatar={org?.avatar || event.organizerAvatar || ''}
                      bio={org?.bio || ''}
                      geoPosition={org?.geoPosition || ''}
                      stats={org?.stats || { totalEvents: 0, organizedEvents: 0, participatedEvents: 0, complaints: 0, friends: 0 }}
                      correspondingEventId={event.id}
                      eventHeight={eventHeights[event.id]}
                      currentUserId={currentUserId}
                    />
                  </View>
                  <View style={{ width: SCREEN_W, paddingHorizontal: 20 }}>
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
                      // Пока открыта лента организаторов, свайп карточки выключен:
                      // иначе она перехватывала жест закрытия панели и наезжала
                      // на карточку организатора
                      showSwipeAction={!showOrganizers}
                      mediaUrl={event.mediaUrl}
                      mediaType={event.mediaType}
                      mediaAspectRatio={event.mediaAspectRatio}
                      participantsList={event.participantsList}
                      participantsData={event.participantsData}
                      context="explore"
                      tags={event.tags}
                      onLayout={(height) => handleEventLayout(event.id, height)}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <View style={[styles.emptyState, { width: SCREEN_W, paddingHorizontal: 20 }]}>
              <Text style={styles.emptyText}>{t.empty.noEvents}</Text>
              <Text style={styles.emptySubtext}>{t.empty.noEventsSubtext}</Text>
            </View>
          )
        ) : (
          folderEvents.length > 0 ? (
            folderEvents.slice(0, visibleCount).map((event) => (
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
              showSwipeAction={!showOrganizers}
                mediaUrl={event.mediaUrl}
                mediaType={event.mediaType}
                mediaAspectRatio={event.mediaAspectRatio}
                participantsList={event.participantsList}
                participantsData={event.participantsData}
                context="explore"
                tags={event.tags || []}
                onLayout={(height) => handleEventLayout(event.id, height)}
              />
            ))
          ) : (
            <View style={[styles.emptyState, { width: SCREEN_W, paddingHorizontal: 20 }]}>
              <Text style={styles.emptyText}>{t.empty.noFriendsEvents}</Text>
              <Text style={styles.emptySubtext}>{t.empty.noFriendsEventsSubtext}</Text>
            </View>
          )
        )}
      </ScrollView>
      </Animated.View>
      </View>

      {/* Модальное окно создания папки */}
      <Modal
        visible={showCreateFolder}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCreateFolder(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.explore.createFolder}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t.explore.createFolder || t.chat.folderName}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus={true}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowCreateFolder(false)}
              >
                <Text style={styles.modalCancelText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalCreateButton}
                onPress={createFolder}
              >
                <Text style={styles.modalCreateText}>{t.chat.create}</Text>
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
    backgroundColor: '#0a0a0c',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  swipeableContent: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    flex: 1,
    marginRight: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#f4f4f5',
    marginLeft: 8,
  },
  searchIcon: {
    fontSize: 18,
    color: 'rgba(244,244,245,0.55)',
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
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#f4f4f5',
  },
  tabText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#f4f4f5',
    fontSize: 18,
  },
  eventsContainer: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 24,
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
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  // Стили для фильтров
  filtersPanel: {
    backgroundColor: '#141417',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  filtersTitle: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterRowTags: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#f4f4f5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  filterInputWide: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#f4f4f5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  clearFiltersText: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 14,
  },
  applyFiltersButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#FF8D32',
    borderRadius: 10,
  },
  applyFiltersText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '600',
  },
  // Стили для меток (тегов)
  tagsContainer: {
    flex: 1,
    maxHeight: 50,
  },
  tagsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
    marginBottom: 4,
  },
  tagButtonSelected: {
    backgroundColor: '#FF8D32',
    borderColor: '#FF8D32',
  },
  tagButtonText: {
    color: '#CCC',
    fontSize: 13,
  },
  tagButtonTextSelected: {
    color: '#0A0A0A',
    fontWeight: '600',
  },
  // Стили для папок
  usersSearchResults: {
    backgroundColor: '#141417',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  userSearchUsername: {
    fontSize: 12,
    color: '#f4f4f5',
    textAlign: 'center',
    maxWidth: 70,
  },
  // Стили для примененных фильтров
  appliedFiltersContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  appliedFiltersScrollContent: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  appliedFilterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,141,50,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,141,50,0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  appliedFilterText: {
    color: '#FF8D32',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  removeFilterButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFilterIcon: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  foldersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addFolderButtonSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    alignSelf: 'center',
  },
  addFolderIconSmall: {
    color: 'rgba(244,244,245,0.5)',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedFolder: {
    backgroundColor: '#FF8D32',
    borderColor: '#FF8D32',
  },
  folderText: {
    color: '#CCC',
    fontSize: 14,
  },
  selectedFolderText: {
    color: '#0A0A0A',
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
    backgroundColor: '#141417',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 20,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#f4f4f5',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 14,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    flex: 1,
    marginRight: 10,
  },
  modalCancelText: {
    color: 'rgba(244,244,245,0.65)',
    fontSize: 16,
    textAlign: 'center',
  },
  modalCreateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FF8D32',
    borderRadius: 12,
    flex: 1,
  },
  modalCreateText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

