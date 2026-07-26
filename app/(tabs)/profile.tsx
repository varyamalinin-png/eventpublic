import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, StyleSheet, Image, TouchableOpacity, Modal, Dimensions, TextInput, Alert, Platform, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRefresh } from '../../hooks/useRefresh';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useFocusEffect, useRouter as useExpoRouter } from 'expo-router';
import { useSafeRouter } from '../../utils/safeRouter';
import EventCard from '../../components/EventCard';
import TopBar from '../../components/TopBar';
import { useEvents, Event } from '../../context/EventsContext';
import { formatUsername } from '../../utils/username';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { createLogger } from '../../utils/logger';
import { AppIcon } from '../../components/ui/AppIcon';
import { Palette } from '../../constants/DesignSystem';
import FolderCard from '../../components/FolderCard';
import type { EventFolder } from '../../types/EventFolder';
import AddToFolderModal from '../../components/AddToFolderModal';
import CreateFolderModal from '../../components/CreateFolderModal';
import { getEventDateTime } from '../../utils/eventHelpers';

const logger = createLogger('Profile');

/** Счётчики Organized/Participated в шапке профиля временно скрыты.
 *  Вернуть их можно, переключив этот флаг в true — разметка сохранена. */
const SHOW_ORG_PART = false;

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

export default function ProfileScreen() {
  const router = useSafeRouter();
  const expoRouter = useExpoRouter(); // Обычный роутер для кликов в шапке
  const params = useLocalSearchParams<{ eventId?: string }>();
  const { events, eventProfiles, getOrganizerStats, isEventUpcoming, isEventPast, isUserOrganizer, isUserAttendee, isUserEventMember, getUserData, getUserRequestStatus, eventFolders, createEventFolder, deleteEvent, addEventToFolder, fetchEventProfile, refreshEventFolders } = useEvents();
  const { user: authUser, loading: authLoading } = useAuth();
  const { t } = useLanguage();
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
      
      // Для прошедших событий - используем те же признаки, что и для предстоящих
      // КРИТИЧЕСКИ ВАЖНО: Если пользователь удалил свое участие, событие должно быть удалено из events
      // (это обрабатывается в deleteEvent), поэтому если событие осталось в events, значит пользователь все еще организатор
      if (isEventPast(event)) {
        return isUserOrganizer(event, currentUserId);
      }
      
      return isUserOrganizer(event, currentUserId);
    });
    
    logger.debug('allOrganizedEvents: отфильтровано', { filtered: filtered.length, total: events.length });
    
    return filtered;
  }, [events, currentUserId, isUserOrganizer, isEventUpcoming, isEventPast, getUserRequestStatus]);
  
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
        
        // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий проверяем участие через eventProfiles
        const profile = eventProfiles.find(p => p.eventId === event.id);
        if (!profile) {
          // Профиль должен существовать для всех событий
          return false;
        }
        
        // Проверяем, что пользователь в списке участников профиля
        const isParticipantInProfile = profile.participants.includes(currentUserId);
        if (!isParticipantInProfile) {
          // Пользователь не в списке участников профиля - не считаем событие
          return false;
        }
        
        return true;
      }
      
      // Для предстоящих событий - исключаем отклоненные/отмененные события
      const userStatus = getUserRequestStatus(event, currentUserId);
      if (userStatus === 'rejected') {
        logger.debug('allParticipatedEvents: событие отклонено', { eventId: event.id });
        return false;
      }
      
      // Для текущих событий - проверяем обычным способом
      if (isEventUpcoming(event)) {
        return isUserAttendee(event, currentUserId);
      }
      
      return isUserAttendee(event, currentUserId);
    });
    
    logger.debug('allParticipatedEvents: отфильтровано', { filtered: filtered.length, total: events.length });
    
    return filtered;
  }, [events, eventProfiles, currentUserId, isUserAttendee, isUserOrganizer, isEventUpcoming, isEventPast, getUserRequestStatus]);
  
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
  const eventsInFolders = useMemo(() => {
    const eventIds = new Set<string>();
    if (eventFolders && Array.isArray(eventFolders)) {
      eventFolders.forEach(folder => {
        if (folder.events && Array.isArray(folder.events)) {
          folder.events.forEach(eventItem => {
            const event = (eventItem as any).event || eventItem;
            if (event && event.id) {
              eventIds.add(event.id);
            }
          });
        }
      });
    }
    return eventIds;
  }, [eventFolders]);

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
      
      // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий используем ту же логику, что и для счетчиков (allParticipatedEvents):
      // организатор — всегда показываем; участник — показываем, если он в profile.participants.
      // Иначе у участников прошедшие события исчезают из профиля (isUserEventMember для прошлых событий может быть false).
      if (isUserOrganizer(event, currentUserId)) {
        return true;
      }
      const profile = eventProfiles.find(p => p.eventId === event.id);
      if (!profile) {
        // Профиль не загружен — для участника не показываем (организатор уже отфильтрован выше)
        logger.debug('pastEvents: профиль не найден для события участника', { eventId: event.id, title: event.title });
        return false;
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
  
  // Загружаем профили для прошедших событий при открытии профиля
  // КРИТИЧЕСКИ ВАЖНО: Загружаем профили СРАЗУ при монтировании, а не асинхронно
  // Это нужно, чтобы карточки событий загружались сразу, а не в реальном времени
  useEffect(() => {
    if (!currentUserId || !fetchEventProfile) return;
    
    const loadProfilesForPastEvents = async () => {
      const pastEventsToLoad = events.filter(event => isEventPast(event));
      // Убираем избыточное логирование - оставляем только при необходимости
      // logger.debug('Загружаем профили для прошедших событий в профиле (useEffect)', { count: pastEventsToLoad.length, currentUserId });
      
      // Загружаем все профили параллельно для быстрой загрузки
      const loadPromises = pastEventsToLoad.map(async (event) => {
        const existingProfile = eventProfiles.find(p => p.eventId === event.id);
        if (!existingProfile) {
          try {
            await fetchEventProfile(event.id);
            // Убираем избыточное логирование для каждого события
          } catch (error) {
            logger.warn(`Не удалось загрузить профиль для события ${event.id}:`, error);
          }
        }
      });
      
      // Ждем загрузки всех профилей
      await Promise.all(loadPromises);
      // Убираем избыточное логирование
      // logger.debug('Все профили для прошедших событий загружены');
    };
    
    loadProfilesForPastEvents();
  }, [currentUserId, events.length, isEventPast, fetchEventProfile]); // Убрали eventProfiles из зависимостей, чтобы не вызывать повторно
  
  // Дополнительная загрузка при фокусе на экране (на случай, если события изменились)
  const loadProfilesForPastEvents = useCallback(async () => {
    if (!currentUserId || !fetchEventProfile || events.length === 0) return;
    const pastEventsToLoad = events.filter(event => isEventPast(event));
    for (const event of pastEventsToLoad) {
      if (!eventProfiles.find(p => p.eventId === event.id)) {
        try { await fetchEventProfile(event.id); } catch {}
      }
    }
  }, [currentUserId, events, eventProfiles, isEventPast, fetchEventProfile]);

  useEffect(() => { loadProfilesForPastEvents(); }, [loadProfilesForPastEvents]);

  useFocusEffect(useCallback(() => { loadProfilesForPastEvents(); }, [loadProfilesForPastEvents]));

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
      Alert.alert('Ошибка', 'Выберите хотя бы одно событие');
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
      Alert.alert('Ошибка', 'Выберите хотя бы одно событие');
      return;
    }

    Alert.alert(
      'Удалить события?',
      `Вы уверены, что хотите удалить ${selectedEventIds.size} ${selectedEventIds.size === 1 ? 'событие' : 'событий'}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const eventId of selectedEventIds) {
                await deleteEvent(eventId);
              }
              setSelectMode(false);
              setSelectedEventIds(new Set());
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить события');
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
      Alert.alert('Ошибка', 'Введите название папки');
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
        Alert.alert('Успешно', 'Папка создана');
      } else {
        logger.error('Folder creation returned null');
        Alert.alert('Ошибка', 'Не удалось создать папку. Попробуйте еще раз.');
      }
    } catch (error) {
      logger.error('Failed to create folder:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert('Ошибка', `Не удалось создать папку: ${errorMessage}`);
    }
  }, [selectedEventIds, createEventFolder, addEventToFolder]);

  const handleMiniaturePress = useCallback((event: Event) => {
    logger.debug('MINIATURE TAP', { id: event.id, title: event.title, isPast: isEventPast(event) });
    setSelectedEvent(event);
    setShowEventFeed(true);
  }, [isEventPast]);

  // Отладочная информация при каждом рендере (убрано для уменьшения логов)
  // useEffect(() => {
  //   logger.debug('useEffect showEventFeed', { showEventFeed });
  // }, [showEventFeed]);
  
  // Определяем какую коллекцию событий и папок показывать в ленте
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
      
      items.sort((a, b) => {
        const dateA = a.type === 'folder'
          ? new Date((a.data as EventFolder).createdAt).getTime()
          : new Date((a.data as Event).date + 'T' + (a.data as Event).time + ':00').getTime();
        const dateB = b.type === 'folder'
          ? new Date((b.data as EventFolder).createdAt).getTime()
          : new Date((b.data as Event).date + 'T' + (b.data as Event).time + ':00').getTime();
        return dateB - dateA;
      });
      if (selectedEvent) {
        const selected = items.filter(item => item.type === 'event' && (item.data as Event).id === selectedEvent.id);
        const rest = items.filter(item => !(item.type === 'event' && (item.data as Event).id === selectedEvent.id));
        if (selected.length > 0) return [...selected, ...rest];
      }
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

    if (selectedEvent) {
      const selected = allItems.filter(item => item.type === 'event' && (item.data as Event).id === selectedEvent.id);
      const rest = allItems.filter(item => !(item.type === 'event' && (item.data as Event).id === selectedEvent.id));
      if (selected.length > 0) return [...selected, ...rest];
    }
    return allItems;
  }, [selectedFolder, selectedEvent, pastEvents, userEvents, isEventPast, eventFolders]);

  // КРИТИЧЕСКИ ВАЖНО: Все ранние возвраты должны быть ПОСЛЕ всех хуков
  useEffect(() => {
    if (!authUser && !authLoading) {
      router.replace('/(auth)/login' as any);
    }
  }, [authUser, authLoading]);

  if (!authUser || !currentUserId) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{authLoading ? 'Загрузка профиля...' : ''}</Text>
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

  // Если показываем ленту события/папки
  if (showEventFeed) {
    logger.debug('Rendering event feed', { itemsCount: itemsToShow.length });
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backToProfile}
          onPress={() => {
            setShowEventFeed(false);
            setSelectedEvent(null);
            setSelectedFolder(null);
            // КРИТИЧЕСКИ ВАЖНО: На вебе не используем router.setParams, только локальное состояние
            // Очищаем URL параметры если они есть (только для мобильного)
            if (params.eventId && Platform.OS !== 'web' && router.setParams && typeof router.setParams === 'function') {
              try {
                router.setParams({ eventId: undefined });
              } catch (error) {
                logger.warn('Failed to clear params:', error);
              }
            }
            // Переходим на общую страницу профиля (таб)
            router.push('/(tabs)/profile');
          }}
        >
          <Text style={styles.backText}>{t.profile.backToProfile}</Text>
        </TouchableOpacity>
        <FlatList
          ref={feedListRef}
          data={itemsToShow}
          keyExtractor={(item) => item.type === 'folder' ? `folder-${(item.data as EventFolder).id}` : (item.data as Event).id}
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={true}
          renderItem={({ item, index }) => {
            if (item.type === 'folder') {
              const folder = item.data as EventFolder;
              return (
                <View style={styles.feedItemWrapper} pointerEvents="box-none">
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
              <View style={styles.eventCardWrapper}>
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
                  context="explore"
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
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
              onPress={handleDeleteSelectedEvents}
              disabled={selectedEventIds.size === 0}
            >
              <Text style={styles.actionButtonText}>
                Удалить ({selectedEventIds.size})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
              onPress={handleCreateFolder}
              disabled={selectedEventIds.size === 0}
            >
              <Text style={styles.actionButtonText}>
                Создать папку ({selectedEventIds.size})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Модальное окно создания папки */}
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

      <View style={{ flex: 1 }}>
      <ScrollView
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
          // Мобильные платформы: старый вариант с иконкой поверх аватарки
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
              <Image 
                source={{ uri: userData.avatar }} 
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
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
          </View>
        )}
        
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
              <Text style={styles.statNumber}>{organizerStats?.friends ?? 0}</Text>
              <Text style={styles.statLabel}>{t.profile.statsFriends}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.statItem} onPress={() => {
              try {
                expoRouter.push('/my-complaints');
              } catch (error) {
                logger.error('Failed to navigate to my-complaints:', error);
              }
            }}>
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
          {/* Сетка разбита на секции как в чужом профиле.
              Папки живут только в Memories; в папку можно класть
              только прошедшие события, поэтому чекбокс есть лишь у них. */}
          {(() => {
            // Те же значения, что в профиле другого пользователя:
            // gap 8 и боковые отступы 20 — раскладка одна на оба экрана
            const GAP = 8;
            const PADDING = 20;
            const containerW = SCREEN_WIDTH - PADDING * 2;
            const CARD_W = Math.floor((containerW - GAP * 2) / 3);
            const FOLDER_W = CARD_W * 2 + GAP;

            // sortKey — время самого свежего события (у папки — максимум по её событиям)
            type GridItem = { type: 'event' | 'folder'; data: any; sortKey?: number };

            // Раскладка по рядам: 3 слота в ряду, папка занимает 2
            const buildRows = (items: GridItem[]) => {
              const rows: GridItem[][] = [];
              let currentRow: GridItem[] = [];
              let slotsUsed = 0;
              items.forEach(item => {
                const slots = item.type === 'folder' ? 2 : 1;
                if (slotsUsed + slots > 3) {
                  rows.push(currentRow);
                  currentRow = [];
                  slotsUsed = 0;
                }
                currentRow.push(item);
                slotsUsed += slots;
                if (slotsUsed >= 3) {
                  rows.push(currentRow);
                  currentRow = [];
                  slotsUsed = 0;
                }
              });
              if (currentRow.length > 0) rows.push(currentRow);
              return rows;
            };

            // Только прошедшее событие можно добавить в папку
            const pastEventIds = new Set(pastEvents.map((e: Event) => e.id));

            const renderGrid = (items: GridItem[]) => {
              if (items.length === 0) {
                return <Text style={styles.emptyText}>{t.empty.noEvents}</Text>;
              }
              return (
                <View style={{ paddingHorizontal: PADDING }}>
                  {buildRows(items).map((row, rowIdx) => (
                    <View key={rowIdx} style={{ flexDirection: 'row', marginBottom: GAP }}>
                      {row.map((item, colIdx) => {
                        const isFolder = item.type === 'folder';
                        const w = isFolder ? FOLDER_W : CARD_W;
                        const ml = colIdx > 0 ? GAP : 0;

                        if (isFolder) {
                          const folder = item.data as EventFolder;
                          return (
                            <View key={`f-${folder.id}`} style={{ width: w, height: CARD_W, marginLeft: ml, borderRadius: 14, overflow: 'hidden' }} pointerEvents="box-none">
                              <FolderCard folder={folder} onPress={() => router.push(`/event-folder/${folder.id}`)} variant="profile" />
                            </View>
                          );
                        }

                        const event = item.data as Event;
                        const isSelected = selectedEventIds.has(event.id);
                        const selectable = pastEventIds.has(event.id);

                        return (
                          <View key={event.id} style={{ width: w, height: CARD_W, marginLeft: ml, borderRadius: 14, overflow: 'hidden' }}>
                            <EventCard
                              id={event.id} title={event.title} description={event.description}
                              date={event.date} time={event.time} location={event.location}
                              price={event.price} participants={event.participants}
                              maxParticipants={event.maxParticipants}
                              organizerAvatar={event.organizerAvatar} organizerId={event.organizerId}
                              variant="miniature_1" showSwipeAction={false} showOrganizerAvatar={false}
                              mediaUrl={event.mediaUrl} mediaType={event.mediaType}
                              mediaAspectRatio={event.mediaAspectRatio}
                              participantsList={event.participantsList}
                              participantsData={event.participantsData}
                              onMiniaturePress={() => {
                                if (selectMode) {
                                  // Текущие и будущие события в папку не добавляются
                                  if (!selectable) return;
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setSelectedEventIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(event.id)) next.delete(event.id);
                                    else next.add(event.id);
                                    return next;
                                  });
                                } else {
                                  handleMiniaturePress(event);
                                }
                              }}
                              onLongPress={() => {
                                if (!selectable) return;
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setSelectMode(true);
                                setSelectedEventIds(new Set([event.id]));
                              }}
                            />
                            {selectMode && selectable && (
                              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, borderWidth: isSelected ? 3 : 0, borderColor: '#FF8D32', backgroundColor: isSelected ? 'transparent' : 'rgba(0,0,0,0.45)' }} pointerEvents="none">
                                <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: isSelected ? '#FF8D32' : 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: isSelected ? 0 : 1, borderColor: 'rgba(255,255,255,0.4)' }}>
                                  {isSelected && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
                                </View>
                              </View>
                            )}
                            {/* Недоступные для выбора — приглушаем, но без чекбокса */}
                            {selectMode && !selectable && (
                              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)' }} pointerEvents="none" />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            };

            const organizerItems: GridItem[] = organizedEvents.map((e: Event) => ({ type: 'event', data: e }));
            const participantItems: GridItem[] = participatedEvents
              .filter((e: Event) => !organizedEvents.find((o: Event) => o.id === e.id))
              .map((e: Event) => ({ type: 'event', data: e }));
            // Папка встаёт в сетке по своему самому свежему событию —
            // как актуальное в сторис. Добавили недавнее событие — папка
            // поднялась наверх; добавили старое — осталась ниже.
            const timeOf = (e: Event) => {
              try {
                return getEventDateTime(e).getTime();
              } catch {
                return 0;
              }
            };
            const folderTime = (f: EventFolder) => {
              // Элементы папки приходят как event либо как обёртка { event }
              const inFolder: Event[] = Array.isArray(f.events)
                ? f.events
                    .map((item: any) => (item?.event || item) as Event)
                    .filter((e: Event) => e && e.id)
                : [];
              if (inFolder.length > 0) {
                const times = inFolder.map(timeOf).filter(n => n > 0);
                if (times.length > 0) return Math.max(...times);
              }
              const fallback = f.duration?.end || f.updatedAt || f.createdAt;
              const parsed = fallback ? new Date(fallback).getTime() : 0;
              return Number.isFinite(parsed) ? parsed : 0;
            };

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
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
            onPress={handleDeleteSelectedEvents}
            disabled={selectedEventIds.size === 0}
          >
            <Text style={styles.actionButtonText}>
              Удалить ({selectedEventIds.size})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
            onPress={handleCreateFolder}
            disabled={selectedEventIds.size === 0}
          >
            <Text style={styles.actionButtonText}>
              {eventFolders && Array.isArray(eventFolders) && eventFolders.length > 0 ? 'В папку' : 'Создать папку'} ({selectedEventIds.size})
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
                  const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
                  logger.error(`Failed to add event ${eventId} to folder ${folderId}:`, error);
                  errors.push(errorMessage);
                }
              }
            }

            if (errors.length > 0) {
              Alert.alert('Частичная ошибка', `Некоторые события не удалось добавить:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`);
            } else {
              Alert.alert('Готово', `События добавлены в ${folderIds.length} ${folderIds.length === 1 ? 'папку' : 'папок'}`);
            }
            await refreshEventFolders();
            setShowAddToFolderModal(false);
            setSelectMode(false);
            setSelectedEventIds(new Set());
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Не удалось добавить события в папку';
            logger.error('Failed to add events to folders:', error);
            Alert.alert('Ошибка', errorMessage);
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
    backgroundColor: '#0a0a0c',
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
  avatarContainerWeb: {
    position: 'relative',
    alignItems: 'center',
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
    position: 'absolute',
    top: 36,
    left: 100,
    width: 32,
    height: 32,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#16161a',
    backgroundColor: '#1c1c20',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    color: 'rgba(244,244,245,0.65)',
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 28,
    lineHeight: 20,
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
    paddingHorizontal: 16,
    gap: 8,
  },
  // Без подложки и рамки — шапка своего профиля выглядит так же, как чужого
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
    fontWeight: '700',
    color: '#f4f4f5',
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  // Устаревшие стили, больше не используются
  eventsContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: '100%', // Ensure it takes full width of its parent for flexWrap to work
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
  emptyText: {
    fontSize: 16,
    color: 'rgba(244,244,245,0.35)',
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
    flexGrow: 1, // Позволяет контенту растягиваться на всю доступную высоту
    paddingBottom: 100, // Минимальный отступ снизу
  },
  feedItemWrapper: {
    marginBottom: 15,
  },
  eventCardWrapper: {
    marginBottom: 15,
  },
  lastEventCard: {
    marginBottom: 200, // Значительно увеличиваем отступ после последнего элемента для лучшей видимости
  },
  lastFeedItem: {
    marginBottom: 200,
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
  // Стили для режима select
  selectableCardWrapper: {
    position: 'relative',
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f4f4f5',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF8D32',
    borderColor: '#FF8D32',
  },
  checkmark: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Панель действий в режиме select
  actionBar: {
    position: 'absolute',
    bottom: 90,
    left: 12,
    right: 12,
    backgroundColor: '#1c1c20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 10000,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FF8D32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.5,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
  },
});
