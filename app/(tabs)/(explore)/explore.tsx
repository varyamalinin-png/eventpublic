import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Animated, PanResponder, Dimensions, Image, Platform, RefreshControl, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Link, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRefresh } from '../../../hooks/useRefresh';
import { SkeletonFeed } from '../../../components/SkeletonCard';
import * as Location from 'expo-location';
import EventCard from '../../../components/EventCard';
import OrganizerCard from '../../../components/OrganizerCard';
import TopBar from '../../../components/TopBar';
import { AppIcon } from '../../../components/ui/AppIcon';
import { useEvents, Event, User } from '../../../context/EventsContext';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatUsername, normalizeUsername } from '../../../utils/username';
import { apiRequest } from '../../../services/api';
import EventFiltersPanel from '../../../components/EventFiltersPanel';
import { matchesFilters, countActiveFilters, getTagLabels, GENDER_FILTER_TAGS, isGenderTag, type FilterOptions } from '../../../utils/eventSearchFilters';
import { matchesSearchQuery } from '../../../utils/searchMatch';
import { openUserProfile } from '../../../utils/openUserProfile';
import { useTabPress } from '../../../hooks/useTabPress';

// FilterOptions переехал в utils/eventSearchFilters — он общий с картой.

interface EventFolder {
  id: string;
  name: string;
  eventIds: string[];
}

// Первая пачка и размер батча виртуализации FlatList
const PAGE_SIZE = 12;

/**
 * Настройки отрисовки списка.
 *
 * PAGE_SIZE использовался и как размер пачки для FlatList: двенадцать тяжёлых
 * карточек за один заход — это блокирующее обновление на полсекунды, ровно то,
 * на что ругался VirtualizedList («large list that is slow to update»).
 * Разбиваем мельче: суммарно работы столько же, но она не встаёт поперёк
 * прокрутки одним куском.
 */
const RENDER_BATCH = 4;
const RENDER_WINDOW = 5;

/** Общий объект-заглушка: новый литерал на каждый рендер сводил memo на нет. */
const EMPTY_ORGANIZER_STATS = {
  totalEvents: 0,
  organizedEvents: 0,
  participatedEvents: 0,
  complaints: 0,
  friends: 0,
};

// Одна ссылка на пустой список меток: `|| []` создавал новый массив
// на каждый рендер и сбрасывал memo у EventCard
const EMPTY_TAGS: string[] = [];

// Пользователь вводит дату как ДД.ММ.ГГГГ (или ДД.ММ.ГГ), а event.date хранится
// в ISO. Возвращаем ISO, чтобы сравнивать строки напрямую; на неполном вводе —
// undefined, тогда граница диапазона просто не применяется.
// parseDateInput переехал в utils/eventSearchFilters — он общий с картой.

export default function ExploreScreen() {
  // Обработка ошибок для веба
  if (typeof window !== 'undefined') {
    try {
      // Проверяем доступность необходимых API
    } catch (error) {
      console.error('ExploreScreen initialization error:', error);
    }
  }

  const { t } = useLanguage();
  // Подписи меток одной таблицей — её же получает общая панель фильтров,
  // чтобы на карте и в ленте метки назывались одинаково.
  const tagLabelsMap = useMemo(() => getTagLabels(t), [t]);
  const getTagLabel = useCallback(
    (tag: string): string => tagLabelsMap[tag] || tag,
    [tagLabelsMap],
  );
  const [activeTab, setActiveTab] = useState<'GLOB' | 'FRIENDS'>('GLOB');
  const [searchQuery, setSearchQuery] = useState('');
  const [eventHeights, setEventHeights] = useState<{[key: string]: number}>({});
  const handleEventLayout = useCallback((eventId: string, height: number) => {
    // Без сравнения каждый layout писал в state и перерисовывал всю ленту,
    // что вызывало новый layout — петля
    setEventHeights(prev => (prev[eventId] === height ? prev : { ...prev, [eventId]: height }));
  }, []);

  // EventCard обёрнут в memo, но инлайновая стрелка в onLayout давала новую
  // ссылку на каждый рендер ленты и сводила мемоизацию на нет. Держим по одному
  // стабильному колбэку на событие.
  /**
   * Высоты читаем через ref, а не из зависимостей renderItem.
   *
   * eventHeights стоял в списке зависимостей renderGlobItem: каждая карточка,
   * попадая на экран, сообщала свою высоту, объект менялся, менялась ссылка на
   * renderItem — и FlatList перерисовывал ВСЕ смонтированные ячейки. При
   * прокрутке это происходило непрерывно, отсюда и «large list that is slow to
   * update» с обновлением на полсекунды.
   *
   * Высота нужна только колонке организатора, а она скрыта за краем экрана,
   * пока панель не открыли. Открытие меняет showOrganizers — на этом рендере
   * свежие высоты из ref и подхватываются.
   */
  const eventHeightsRef = useRef<{[key: string]: number}>({});
  eventHeightsRef.current = eventHeights;

  const layoutHandlers = useRef<Map<string, (height: number) => void>>(new Map());
  const getLayoutHandler = useCallback((eventId: string) => {
    let handler = layoutHandlers.current.get(eventId);
    if (!handler) {
      handler = (height: number) => handleEventLayout(eventId, height);
      layoutHandlers.current.set(eventId, handler);
    }
    return handler;
  }, [handleEventLayout]);
  
  // Состояния для свайпа и ленты организаторов
  const [showOrganizers, setShowOrganizers] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const eventsScrollViewRef = useRef<FlatList<Event>>(null);
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
  const navigation = useNavigation();

  // Повторный тап по уже активному табу должен возвращать на «домашнее»
  // состояние экрана — раньше ничего не происходило, лента просто оставалась
  // там, где её оставили. React Navigation сама вызывает popToTop только для
  // экранов-стеков; explore — плоский экран, поэтому скролл-к-началу нужно
  // навешивать вручную через 'tabPress'.
  useTabPress(() => {
    // «Домашнее» состояние раздела — начало ленты ГЛОБ, а не просто верх
    // текущей вкладки: раньше повторный тап оставлял открытой вкладку
    // «Друзья» и сдвинутую полосу организаторов.
    setActiveTab('GLOB');
    setShowOrganizers(false);
    translateX.setValue(0);
    eventsScrollViewRef.current?.scrollToOffset({ offset: 0, animated: true });
    organizersScrollViewRef.current?.scrollTo({ y: 0, animated: true });
  });

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
      syncEventsFromServer: async () => {},
    };
    authContext = { user: null };
  }
  
  const { events, getUserData, getOrganizerStats, getFriendsForEvents, userFolders, createUserFolder, getGlobalEvents, isUserEventMember, eventProfiles, fetchEventProfile, syncEventsFromServer, initialSyncing, initialSyncFailed } = eventsContext;
  const { user: authUser } = authContext;
  const accessToken = (authContext as any).accessToken ?? null;
  const currentUserId = authUser?.id ?? null;

  useEffect(() => {
  }, [accessToken, currentUserId]);

  // Отслеживаем количество событий для прокрутки к началу при появлении новых
  const prevEventsCountRef = useRef<number>(0);
  // Если первая синхронизация не состоялась, повторяем её при возвращении на
  // ленту. Иначе пустое состояние могло пережить обновление сессии и остаться
  // пустым до ручного перезапуска приложения.
  const lastEmptyFeedSyncAtRef = useRef(0);
  
  // Состояния для фильтрации
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});
  
  // Счётчик активных фильтров — из общего модуля, чтобы на карте и в ленте
  // число совпадало.
  const getActiveFiltersCount = () => countActiveFilters(filters);
  
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
    if (!Array.isArray(eventsList)) {
      console.warn('[Explore] searchEvents received non-array:', eventsList);
      return [];
    }
    if (!query.trim()) return eventsList;
    
    return eventsList.filter(event => {
      if (!event) return false;
      try {
        // Слова запроса ищутся по отдельности и в любом порядке: «йога пикник»
        // находит то же, что «пикник йога» (см. utils/searchMatch). Раньше
        // запрос сравнивался с каждым полем одной строкой целиком.
        let organizerName = '';
        let organizerUsername = '';
        try {
          const organizerData = getUserData(event.organizerId);
          organizerName = organizerData?.name || '';
          organizerUsername = organizerData?.username || '';
        } catch (error) {
          // Игнорируем ошибки получения данных организатора
        }
        const participantNames = Array.isArray(event.participantsData)
          ? event.participantsData.map(participant => participant?.name)
          : [];

        return matchesSearchQuery(
          [
            event.title,
            event.description,
            event.location,
            event.displayDate, // формат «15 мая»
            event.time,
            event.price,
            organizerName,
            organizerUsername,
            ...participantNames,
            ...(Array.isArray(event.tags) ? event.tags : []),
          ],
          query,
        );
      } catch (error) {
        console.error('[Explore] Error in searchEvents for event:', event.id, error);
        return false;
      }
    });
  };

  // Получаем организаторов в том же порядке, что и события.
  // ВАЖНО: НЕ вызываем getOrganizerStats здесь — это триггерит /complaints/count для каждого
  // организатора (2-3с на запрос) и вызывает каскадные ре-рендеры через setOrganizerStatsCache.
  // Статистика грузится лениво внутри OrganizerCard при открытии панели.
  const getOrganizersForEvents = (eventsList: Event[]) => {
    try {
      if (!eventsList || !Array.isArray(eventsList)) {
        return [];
      }
      if (!Array.isArray(events)) {
        console.warn('[Explore] events is not an array in getOrganizersForEvents');
        return [];
      }
      return eventsList
        .filter(event => event && event.organizerId && event.id)
        .map(event => {
          try {
            const userData = getUserData(event.organizerId);
            const stats = getOrganizerStats(event.organizerId);
            // Вычисляем sharedEvents если это не текущий пользователь
            const sharedEvents = currentUserId && currentUserId !== event.organizerId
              ? events.filter(e => e && isUserEventMember(e, currentUserId) && isUserEventMember(e, event.organizerId)).length
              : undefined;
            return {
              eventId: event.id, // Добавляем ID события для связи
              organizerId: event.organizerId,
              ...userData,
              stats: {
                ...stats,
                sharedEvents
              }
            };
          } catch (error) {
            console.error('[Explore] Error processing organizer for event:', event.id, error);
            return null;
          }
        })
        .filter(Boolean) as any[];
    } catch (error) {
      console.error('[Explore] Error in getOrganizersForEvents:', error);
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

  const rawScreenW = Dimensions.get('window').width;
  const SCREEN_W = Platform.OS === 'web' ? Math.min(rawScreenW, 500) : rawScreenW;
  // На узких экранах (или совсем маленьких вьюпортах) фиксированные 300 не влезают —
  // панель организатора вылезает за край. Ограничиваем шириной экрана с отступом.
  const ORGANIZER_WIDTH = Math.min(300, SCREEN_W - 20);
  const ROW_WIDTH = SCREEN_W + ORGANIZER_WIDTH;

  // Горизонтальный сдвиг «лента организаторов ↔ лента событий».
  // Раньше он висел на общей обёртке шириной SCREEN_W + ORGANIZER_WIDTH, а
  // внутри неё лежал FlatList той же ширины — и RefreshControl, который
  // центрует спиннер по ширине СВОЕГО скролла, показывал кружок по центру
  // объединённой ленты, а не по центру видимой части экрана.
  // Теперь FlatList ровно по ширине вьюпорта, а сдвигается каждая строка.
  const laneShift = useMemo(
    () => ({ transform: [{ translateX: Animated.subtract(translateX, ORGANIZER_WIDTH) }] }),
    [translateX, ORGANIZER_WIDTH],
  );

  // Получаем все уникальные метки из событий
  const allAvailableTags = useMemo(() => {
    try {
      if (!Array.isArray(events)) {
        return [];
      }
      const tagsSet = new Set<string>();
      events.forEach(event => {
        if (!event) return;
        if (event.tags && Array.isArray(event.tags)) {
          event.tags.forEach(tag => {
            // Метки пола добавляются ниже одним видом: иначе «women only» и
            // «women_only» стояли бы в списке двумя одинаковыми пунктами.
            if (tag && typeof tag === 'string' && !isGenderTag(tag)) {
              tagsSet.add(tag);
            }
          });
        }
      });
      // «Только женщины / только мужчины» — первыми и всегда, даже если таких
      // событий сейчас нет (см. GENDER_FILTER_TAGS).
      return [...GENDER_FILTER_TAGS, ...Array.from(tagsSet).sort()];
    } catch (error) {
      console.error('[Explore] Error calculating allAvailableTags:', error);
      return [];
    }
  }, [events]);

  // Функция фильтрации событий
  // Правила фильтрации — ОБЩИЕ с картой (utils/eventSearchFilters).
  // Раньше они были расписаны прямо здесь, и карта повторить их не могла.
  const filterEvents = (eventsList: any[]) => {
    if (!Array.isArray(eventsList)) {
      console.warn('[Explore] filterEvents received non-array:', eventsList);
      return [];
    }
    return eventsList.filter(event => matchesFilters(event, filters, getUserData));
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
  const baseGlobEvents = useMemo(() => {
    try {
      return Array.isArray(futureEvents) ? futureEvents : [];
    } catch (error) {
      console.error('[Explore] Error in baseGlobEvents:', error);
      return [];
    }
  }, [futureEvents]);
  const baseFriendsEvents = useMemo(() => {
    try {
      const friendsEvents = getFriendsForEvents();
      return Array.isArray(friendsEvents) ? friendsEvents : [];
    } catch (error) {
      console.error('[Explore] Error getting friends events:', error);
      return [];
    }
  }, [getFriendsForEvents]);
  
  // Применяем фильтры и поиск с мемоизацией
  const globEvents = useMemo(() => {
    try {
      // Используем getGlobalEvents() для GLOB - только события, на которые еще не откликался
      const globalEvents = getGlobalEvents();
      if (!Array.isArray(globalEvents)) {
        console.warn('[Explore] getGlobalEvents returned non-array:', globalEvents);
        return [];
      }
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
    } catch (error) {
      console.error('[Explore] Error in globEvents calculation:', error);
      return [];
    }
  }, [getGlobalEvents, filters, searchQuery, userCoords]);
  
  // Прокручиваем к началу при появлении нового события организатора
  useEffect(() => {
    if (globEvents.length > prevEventsCountRef.current && eventsScrollViewRef.current && activeTab === 'GLOB') {
      // Небольшая задержка для рендеринга
      setTimeout(() => {
        eventsScrollViewRef.current?.scrollToOffset({ offset: 0, animated: true });
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

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId || initialSyncing || events.length > 0) return;

      const now = Date.now();
      // На пустом аккаунте не запускаем запрос при каждом render/focus.
      if (now - lastEmptyFeedSyncAtRef.current < 15_000) return;
      lastEmptyFeedSyncAtRef.current = now;

      syncEventsFromServer().catch(error => {
        console.warn('[Explore] Retry of empty feed sync failed:', error);
      });
    }, [currentUserId, events.length, initialSyncing, syncEventsFromServer])
  );
  
  const friendsEvents = useMemo(() => {
    try {
      if (!Array.isArray(baseFriendsEvents)) {
        console.warn('[Explore] baseFriendsEvents is not an array:', baseFriendsEvents);
        return [];
      }
      const filtered = filterEvents(baseFriendsEvents);
      return searchEvents(filtered, searchQuery);
    } catch (error) {
      console.error('[Explore] Error in friendsEvents calculation:', error);
      return [];
    }
  }, [baseFriendsEvents, filters, searchQuery]);
  
  // События для выбранной папки (FRIENDS) с мемоизацией
  const folderEvents = useMemo(() => {
    try {
      if (!Array.isArray(friendsEvents)) {
        return [];
      }
      if (!selectedFolder) {
        return friendsEvents;
      }
      const selectedFolderData = folders.find(f => f.id === selectedFolder);
      if (!selectedFolderData || !Array.isArray(selectedFolderData.eventIds)) {
        return friendsEvents;
      }
      return friendsEvents.filter(event => 
        event && event.id && selectedFolderData.eventIds.includes(event.id)
      );
    } catch (error) {
      console.error('[Explore] Error in folderEvents calculation:', error);
      return [];
    }
  }, [selectedFolder, friendsEvents, folders]);

  // Получаем события для текущего таба (те же что отображаются)
  const getCurrentTabEvents = (): Event[] => {
    try {
      if (activeTab === 'GLOB') {
        return Array.isArray(globEvents) ? globEvents : [];
      } else {
        return Array.isArray(folderEvents) ? folderEvents : [];
      }
    } catch (error) {
      console.error('[Explore] Error in getCurrentTabEvents:', error);
      return [];
    }
  };

  // Мемоизируем вычисления чтобы избежать лишних ререндеров
  const currentEvents = useMemo(() => {
    try {
      return getCurrentTabEvents();
    } catch (error) {
      console.error('[Explore] Error in currentEvents calculation:', error);
      return [];
    }
  }, [activeTab, globEvents, folderEvents]);

  const organizersForCurrentEvents = useMemo(() => {
    try {
      if (!Array.isArray(currentEvents)) {
        return [];
      }
      return getOrganizersForEvents(currentEvents);
    } catch (error) {
      console.error('[Explore] Error in organizersForCurrentEvents calculation:', error);
      return [];
    }
    // getOrganizerStats намеренно исключён — см. getOrganizersForEvents
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvents, getUserData, currentUserId, events, isUserEventMember]);

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
  const removeFilter = (filterType: keyof FilterOptions | 'participantsRange' | 'organizerAgeRange' | 'dateRange', value?: string) => {
    if (filterType === 'selectedTags' && value) {
      const currentTags = filters.selectedTags || [];
      const newTags = currentTags.filter(item => item !== value);
      setFilters({ ...filters, selectedTags: newTags.length > 0 ? newTags : undefined });
    } else if (filterType === 'participantsRange') {
      // Удаляем оба фильтра участников
      setFilters({ ...filters, participantsMin: undefined, participantsMax: undefined });
    } else if (filterType === 'dateRange') {
      setFilters({ ...filters, dateFrom: undefined, dateTo: undefined });
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
    if (filters.dateFrom || filters.dateTo) {
      const rangeText = filters.dateFrom && filters.dateTo
        ? `${filters.dateFrom} — ${filters.dateTo}`
        : filters.dateFrom ? `${t.explore.from} ${filters.dateFrom}` : `${t.createEvent.to} ${filters.dateTo}`;
      applied.push({ type: 'dateRange' as any, label: t.explore.filterLabelDate, value: rangeText });
    }
    if (filters.placeType) {
      applied.push({
        type: 'placeType',
        label: t.explore.filterLabelPlace,
        value: filters.placeType === 'online' ? t.explore.placeOnline : t.explore.placeOffline,
      });
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };

  const handleFolderPress = (folderId: string | null, index?: number) => {
    // Перемещение папок временно отключено
    if (draggedIndex !== null && index !== undefined && index !== draggedIndex) {
      // Сбрасываем выбор
      setDraggedIndex(null);
      // Вибрация
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } else {
      // Обычный выбор папки
      setSelectedFolder(folderId);
    }
  };

  // Лента виртуализирована: строка списка ушла в renderItem, шапка — в
  // ListHeaderComponent. Обе функции стабильны, иначе FlatList пересоздаёт ячейки.
  const renderGlobItem = useCallback(({ item: event }: { item: Event }) => {
    const org = organizersForCurrentEvents?.find(o => o.eventId === event.id);
    return (
        <Animated.View key={event.id} style={[{ flexDirection: 'row', width: SCREEN_W + ORGANIZER_WIDTH }, laneShift]}>
          <View style={{ width: ORGANIZER_WIDTH, paddingHorizontal: 8 }}>
            <OrganizerCard
              organizerId={event.organizerId}
              name={org?.name || ''}
              age={org?.age || ''}
              username={org?.username || ''}
              avatar={org?.avatar || event.organizerAvatar || ''}
              bio={org?.bio || ''}
              geoPosition={org?.geoPosition || ''}
              stats={org?.stats || EMPTY_ORGANIZER_STATS}
              correspondingEventId={event.id}
              eventHeight={eventHeightsRef.current[event.id]}
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
              onLayout={getLayoutHandler(event.id)}
            />
            {showOrganizers && (
              // Пока видна панель организатора, тап по карточке события просто
              // закрывает панель (вместо перехода внутрь события) — не нужно
              // повторять свайп-жест, чтобы вернуть карточку на место.
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
                  setShowOrganizers(false);
                }}
              />
            )}
          </View>
        </Animated.View>
    );
  }, [SCREEN_W, ORGANIZER_WIDTH, laneShift, currentUserId, getLayoutHandler, organizersForCurrentEvents, showOrganizers]);

  const renderFolderItem = useCallback(({ item: event }: { item: Event }) => (
    // Контейнер ленты шире экрана на колонку организаторов и сдвинут влево:
    // без этой обёртки карточка растягивалась на всю ширину строки и уезжала за край
    <Animated.View style={[{ width: SCREEN_W, paddingHorizontal: 20, marginLeft: ORGANIZER_WIDTH }, laneShift]}>
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
          tags={event.tags || EMPTY_TAGS}
          onLayout={getLayoutHandler(event.id)}
        />
    </Animated.View>
  ), [SCREEN_W, ORGANIZER_WIDTH, laneShift, getLayoutHandler, showOrganizers]);

  const listHeader = (
    <>
    {/* Табы — ряд с организаторским spacer слева */}
    <Animated.View style={[{ flexDirection: 'row', width: SCREEN_W + ORGANIZER_WIDTH }, laneShift]}>
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
          setShowOrganizers(false);
          translateX.setValue(0);
        }}
        {...(Platform.OS === 'web' ? { dataSet: { active: activeTab === 'FRIENDS' ? 'true' : 'false' } } : {})}
      >
        <Text style={[styles.tabText, activeTab === 'FRIENDS' && styles.activeTabText]}>{t.explore.friendsTab}</Text>
      </TouchableOpacity>

    </View>
    </Animated.View>

    {/* Папки для FRIENDS - перемещены внутрь ScrollView */}
    {activeTab === 'FRIENDS' && (
      // Папки друзей живут в колонке СОБЫТИЙ, а не организаторов: без
      // marginLeft/сдвига полосы строка прилипала к левому краю ленты и
      // визуально уезжала в раздел организаторов.
      <Animated.View style={[styles.foldersContainer, { width: SCREEN_W, marginLeft: ORGANIZER_WIDTH }, laneShift]}>
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
            {/* Иконка вместо текстового «+» — глиф сидел в круге не по центру */}
            <AppIcon name="plus" size={14} color="rgba(244,244,245,0.55)" />
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    )}
    </>
  );

  // Контейнер ленты сдвинут влево на ширину колонки организаторов,
  // поэтому пустое состояние надо вернуть обратно — иначе уезжает за экран
  // laneShift обязателен: без него блок стоит в колонке организаторов и
  // визуально уезжает вбок — ровно та же история, что была с папками друзей.
  // Пока идёт первая синхронизация, показываем скелетон, а не «Событий нет»:
  // раньше при запуске лента на секунду выглядела пустой.
  // Синхронизация провалилась по сети — говорим об этом прямо. Раньше лента
  // показывала «событий нет»: телефон подключён, баннер офлайна молчит, а
  // данные не пришли — и это выглядело как пустой аккаунт.
  const listEmpty = initialSyncFailed && events.length === 0 ? (
      <View style={{ width: SCREEN_W, paddingHorizontal: 20, marginLeft: ORGANIZER_WIDTH, alignItems: 'center', paddingTop: 60 }}>
        <AppIcon name="pin" size={48} color="rgba(244,244,245,0.25)" />
        <Text style={[styles.emptyText, { marginTop: 12 }]}>{t.common.loadFailedTitle}</Text>
        <Text style={{ fontSize: 14, color: 'rgba(244,244,245,0.5)', textAlign: 'center', lineHeight: 20 }}>
          {t.common.loadFailedHint}
        </Text>
      </View>
  ) : initialSyncing && events.length === 0 ? (
      <Animated.View style={[{ width: SCREEN_W, paddingHorizontal: 20, marginLeft: ORGANIZER_WIDTH }, laneShift]}>
        <SkeletonFeed count={3} />
      </Animated.View>
  ) : activeTab === 'GLOB' ? (
      <Animated.View style={[styles.emptyState, { width: SCREEN_W, paddingHorizontal: 20, marginLeft: ORGANIZER_WIDTH }, laneShift]}>
        <Text style={styles.emptyText}>{t.empty.noEvents}</Text>
        <Text style={styles.emptySubtext}>{t.empty.noEventsSubtext}</Text>
      </Animated.View>
  ) : (
      <Animated.View style={[styles.emptyState, { width: SCREEN_W, paddingHorizontal: 20, marginLeft: ORGANIZER_WIDTH }, laneShift]}>
        <Text style={styles.emptyText}>{t.empty.noFriendsEvents}</Text>
        <Text style={styles.emptySubtext}>{t.empty.noFriendsEventsSubtext}</Text>
      </Animated.View>
  );


  // Запасной экран рисуем ПОСЛЕ всех хуков: выход из компонента посреди
  // списка хуков — это «Rendered fewer hooks than expected» на первом же
  // повторном рендере.
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
            {Array.isArray(searchUsers) && searchUsers.map((user) => {
              if (!user || !user.id) {
                console.warn('[Explore] Invalid user in searchUsers:', user);
                return null;
              }
              return (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userSearchItem}
                  onPress={() => openUserProfile(user.id, currentUserId)}
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
              );
            }).filter(Boolean)}
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
                  {filter.type === 'selectedTags' ? getTagLabel(filter.value as string) : `${filter.label.replace(/:\s*$/, '')}: ${filter.value}`}
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

      {/* Панель фильтров — ОБЩАЯ с картой (components/EventFiltersPanel).
          Раньше разметка жила прямо здесь, и повторить фильтры на карте
          можно было только копированием. Копии расходятся: так уже вышло
          с сеткой профиля. Теперь поля, отступы и поведение — одни. */}
      {showFilters && (
        <EventFiltersPanel
          filters={filters}
          onChange={setFilters}
          onApply={() => setShowFilters(false)}
          onClear={clearFilters}
          availableTags={allAvailableTags}
          tagLabels={tagLabelsMap}
        />
      )}


      {/* Контент — единая широкая лента, сдвигается горизонтально */}
      <View style={{ flex: 1, overflow: 'hidden' }} {...panResponder.panHandlers}>
      <View style={{ flex: 1, width: SCREEN_W }}>
      <FlatList
        ref={eventsScrollViewRef}
        data={activeTab === 'GLOB' ? globEvents : folderEvents}
        keyExtractor={(item) => item.id}
        renderItem={activeTab === 'GLOB' ? renderGlobItem : renderFolderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={{ paddingBottom: 100 }}
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8D32" />}
        initialNumToRender={RENDER_BATCH}
        maxToRenderPerBatch={RENDER_BATCH}
        updateCellsBatchingPeriod={80}
        windowSize={RENDER_WINDOW}
      />
      </View>
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

