import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Modal, Dimensions, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import EventCard from '../../components/EventCard';
import TopBar from '../../components/TopBar';
import { useEvents, Event } from '../../context/EventsContext';
import { formatUsername } from '../../utils/username';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { createLogger } from '../../utils/logger';
import FolderCard from '../../components/FolderCard';
import type { EventFolder } from '../../types/EventFolder';
import AddToFolderModal from '../../components/AddToFolderModal';
import CreateFolderModal from '../../components/CreateFolderModal';

const logger = createLogger('Profile');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const { events, eventProfiles, getOrganizerStats, isEventUpcoming, isEventPast, isUserOrganizer, isUserAttendee, isUserEventMember, getUserData, getUserRequestStatus, eventFolders, createEventFolder, deleteEvent, addEventToFolder } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<EventFolder | null>(null);
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
      
      // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий проверяем участие через eventProfiles
      // ВСЕ события имеют профиль - проверяем участие через профиль
      const profile = eventProfiles.find(p => p.eventId === event.id);
      if (!profile) {
        // Профиль должен существовать для всех событий
        logger.debug('pastEvents: профиль не найден для события', { eventId: event.id, title: event.title });
        return false;
      }
      
      // Проверяем, что пользователь в списке участников профиля
      const isParticipantInProfile = profile.participants.includes(currentUserId);
      if (!isParticipantInProfile) {
        // Пользователь не в списке участников профиля - не показываем событие
        logger.debug('pastEvents: пользователь не в списке участников профиля', { eventId: event.id, title: event.title });
        return false;
      }
      
      // Пользователь в списке участников профиля - показываем событие
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
  }, [events, eventProfiles, currentUserId, isEventPast, getUserRequestStatus, isUserEventMember, eventsInFolders]);
  
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
  
  // Примечание: Профили событий загружаются автоматически при открытии event-profile/[id] для отображения меморис постов
  // Для фильтрации событий они больше не нужны - используем те же признаки, что и для предстоящих событий

  // Обработка открытия по параметру eventId
  useEffect(() => {
    if (params.eventId) {
      const event = events.find(e => e.id === params.eventId);
      if (event) {
        setSelectedEvent(event);
        setSelectedFolder(null);
        setShowEventFeed(true);
        
        // Прокручиваем к событию после небольшой задержки
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
          
          const itemIndex = tempItems.findIndex(item => item.type === 'event' && (item.data as Event).id === params.eventId);
          if (itemIndex !== -1 && scrollViewRef.current) {
            // Более точный расчет высоты карточки + отступы
            const cardHeight = 400; // высота карточки
            const marginBottom = 15; // отступ снизу
            const totalItemHeight = cardHeight + marginBottom;
            
            // Высота экрана (примерная)
            const screenHeight = 800;
            // Позиция карточки от начала контента
            const cardPosition = itemIndex * totalItemHeight;
            
            // Рассчитываем позицию прокрутки так, чтобы карточка была по центру экрана
            const centerOffset = (screenHeight - cardHeight) / 2;
            let scrollToY = cardPosition - centerOffset;
            
            // Ограничиваем прокрутку границами контента
            const totalContentHeight = tempItems.length * totalItemHeight - marginBottom + 20; // 20 - paddingBottom
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
      setSelectedEvent(null);
      setSelectedFolder(null);
    }
  }, [params.eventId, events, pastEvents, eventFolders]);
  
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
      setSelectedFolder(null);
      setShowEventFeed(true);
      
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
      
      // Сортируем по дате: сначала самые новые (папки и события вместе по дате)
      return items.sort((a, b) => {
        let dateA: number;
        let dateB: number;
        
        if (a.type === 'folder') {
          const folder = a.data as EventFolder;
          // Для папки используем дату создания или дату последнего события
          dateA = new Date(folder.createdAt).getTime();
        } else {
          const event = a.data as Event;
          dateA = new Date(event.date + 'T' + event.time + ':00').getTime();
        }
        
        if (b.type === 'folder') {
          const folder = b.data as EventFolder;
          dateB = new Date(folder.createdAt).getTime();
        } else {
          const event = b.data as Event;
          dateB = new Date(event.date + 'T' + event.time + ':00').getTime();
        }
        
        // Сортируем по убыванию (самые новые первыми)
        return dateB - dateA;
      });
    }
    // Иначе показываем обычные события пользователя
    return userEvents.map(event => ({ type: 'event' as const, data: event }));
  }, [selectedFolder, selectedEvent, pastEvents, userEvents, isEventPast, eventFolders]);

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
          {/* Папки и события Memories */}
          {itemsToShow.map((item, index) => {
            if (item.type === 'folder') {
              const folder = item.data as EventFolder;
              return (
                <View 
                  key={`folder-${folder.id}`} 
                  style={[
                    styles.feedItemWrapper,
                    index === itemsToShow.length - 1 && styles.lastFeedItem
                  ]}
                >
                  <FolderCard
                    folder={folder}
                    onPress={() => router.push(`/event-folder/${folder.id}`)}
                    variant="feed"
                  />
                </View>
              );
            } else {
              const event = item.data as Event;
              return (
                <View 
                  key={event.id} 
                  style={[
                    styles.eventCardWrapper,
                    index === itemsToShow.length - 1 && styles.lastEventCard
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
              );
            }
          })}
          
        </ScrollView>

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
        contentContainerStyle={[
          styles.scrollContentContainer,
          selectMode && { paddingBottom: 200 } // Дополнительный отступ когда активен режим выбора
        ]}
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
              <Text style={styles.statNumber}>{allUserEventsForStats.length}</Text>
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
            {(() => {
              // Объединяем папки и события в один массив для правильного позиционирования
              const containerPadding = 40;
              const gap = 15;
              const availableWidth = SCREEN_WIDTH - containerPadding;
              const singleCardWidth = (availableWidth - gap * 2) / 3;
              const folderWidth = singleCardWidth * 2 + gap;
              
              const items: Array<{ type: 'folder' | 'event'; data: EventFolder | Event; index: number }> = [];
              
              // Добавляем папки
              if (eventFolders && eventFolders.length > 0) {
                eventFolders.forEach((folder: EventFolder) => {
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
                        { width: folderWidth },
                        { marginRight: gap }
                      ]}
                    >
                      <FolderCard
                        folder={folder}
                        onPress={() => {
                          setSelectedFolder(folder);
                          setSelectedEvent(null);
                          setShowEventFeed(true);
                          
                          // Прокручиваем к папке после рендера
                          setTimeout(() => {
                            // Создаем временный массив items для поиска индекса
                            const tempItems: Array<{ type: 'folder' | 'event'; data: EventFolder | Event }> = [];
                            if (eventFolders && eventFolders.length > 0) {
                              eventFolders.forEach((f: EventFolder) => {
                                tempItems.push({ type: 'folder', data: f });
                              });
                            }
                            pastEvents.forEach((e: Event) => {
                              tempItems.push({ type: 'event', data: e });
                            });
                            
                            const itemIndex = tempItems.findIndex(item => item.type === 'folder' && (item.data as EventFolder).id === folder.id);
                            if (itemIndex !== -1 && scrollViewRef.current) {
                              const folderHeight = 250; // Примерная высота папки в feed варианте
                              const marginBottom = 15;
                              const totalItemHeight = folderHeight + marginBottom;
                              const scrollPosition = itemIndex * totalItemHeight;
                              
                              scrollViewRef.current.scrollTo({
                                y: scrollPosition,
                                animated: true
                              });
                            }
                          }, 100);
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
                        { width: singleCardWidth },
                        !isLastInRow && { marginRight: gap }
                      ]}
                    >
                      <View style={selectMode ? styles.selectableCardWrapper : undefined}>
                        {selectMode && isEventPast(event) && (
                          <TouchableOpacity
                            style={[
                              styles.checkbox,
                              selectedEventIds.has(event.id) && styles.checkboxChecked
                            ]}
                            onPress={() => {
                              const newSelected = new Set(selectedEventIds);
                              if (newSelected.has(event.id)) {
                                newSelected.delete(event.id);
                              } else {
                                newSelected.add(event.id);
                              }
                              setSelectedEventIds(newSelected);
                            }}
                          >
                            {selectedEventIds.has(event.id) && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </TouchableOpacity>
                        )}
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
                          onMiniaturePress={() => {
                            if (selectMode) {
                              const newSelected = new Set(selectedEventIds);
                              if (newSelected.has(event.id)) {
                                newSelected.delete(event.id);
                              } else {
                                newSelected.add(event.id);
                              }
                              setSelectedEventIds(newSelected);
                            } else {
                              handleMemoryPress(event.id);
                            }
                          }}
                          onLongPress={() => {
                            // Режим select доступен только для прошедших событий
                            if (!selectMode && isEventPast(event)) {
                              logger.debug('Long press detected, entering select mode', { 
                                eventId: event.id, 
                                isPast: isEventPast(event),
                                currentSelectMode: selectMode 
                              });
                              setSelectMode(true);
                              setSelectedEventIds(new Set([event.id]));
                              logger.debug('Select mode activated', { 
                                selectModeAfter: true,
                                selectedCount: 1 
                              });
                            } else {
                              logger.debug('Long press ignored', { 
                                eventId: event.id,
                                isPast: isEventPast(event),
                                currentSelectMode: selectMode
                              });
                            }
                          }}
                        />
                      </View>
                    </View>
                  );
                  
                  // После события переходим на следующую позицию
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
      <Modal
        visible={showCreateFolderModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCreateFolderModal(false)}
      >
        <CreateFolderModal
          onClose={() => setShowCreateFolderModal(false)}
          onSubmit={handleCreateFolderSubmit}
        />
      </Modal>

      {/* Модальное окно выбора папки для перемещения событий */}
      <Modal
        visible={showAddToFolderModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddToFolderModal(false)}
      >
        <AddToFolderModal
          eventIds={Array.from(selectedEventIds)}
          onClose={() => {
            setShowAddToFolderModal(false);
            setSelectedFolderIds(new Set());
          }}
          onCreateNewFolder={() => {
            setShowAddToFolderModal(false);
            setShowCreateFolderModal(true);
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
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Панель действий в режиме select
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingBottom: 34, // Отступ для безопасной зоны внизу
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 1000,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonDisabled: {
    backgroundColor: '#333333',
    opacity: 0.5,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
