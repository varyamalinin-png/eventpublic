import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Image, Modal, Alert, Platform, ActivityIndicator, InteractionManager, type ImageStyle, type ViewStyle } from 'react-native';
import { calendarStyles } from '../styles/calendar.styles';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PinchGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { ApiError } from '../services/api';
import { createLogger } from '../utils/logger';
import { AppIcon } from '../components/ui/AppIcon';

const logger = createLogger('Calendar');

const { width, height } = Dimensions.get('window');

// Календарь по умолчанию открывается на текущий месяц,
// но общий диапазон месяцев начинается примерно за год до текущей даты
const now = new Date();
const DEFAULT_CALENDAR_OPEN = new Date(now.getFullYear(), now.getMonth(), 1);
const CALENDAR_START = new Date(now.getFullYear() - 1, now.getMonth(), 1);

interface MonthData {
  month: number;
  year: number;
  days: DayData[];
}

import type { Event } from '../context/EventsContext';

interface DayData {
  day: number;
  date: Date;
  events: Event[];
}

interface HourSlot {
  hour: number;
  events: Event[];
}

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useLanguage();
  const { 
    events, 
    eventProfiles,
    eventRequests,
    getMyEventParticipationStatus,
    sendEventRequest,
    isUserEventMember,
    isEventUpcoming,
    isEventPast,
    getEventPhotoForUser,
    respondToEventRequest,
    removeEventRequestById,
    getUserRelationship,
    getUserData
  } = useEvents();
  const { user: authUser } = useAuth();
  const calendarUserId = params.userId as string | undefined;
  const currentUserId = authUser?.id ?? null;

  // Функция для получения фото события с учетом персональных фото
  // Для третьих лиц: используется viewerUserId (профиль участника, через который смотрят)
  const getEventPhoto = useCallback(
    (eventId: string, viewerUserId?: string): string | undefined => {
      const userId = calendarUserId ?? currentUserId ?? '';
      return getEventPhotoForUser(eventId, userId, viewerUserId || calendarUserId);
    },
    [calendarUserId, currentUserId, getEventPhotoForUser],
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date(DEFAULT_CALENDAR_OPEN.getTime()));
  
  // Получаем userId из параметров (если не указан - текущий пользователь)
  const previewEventId = params.eventId as string | undefined; // ID события для предпросмотра
  const inviteId = params.inviteId as string | undefined; // ID приглашения для принятия
  const [calendarMode, setCalendarMode] = useState<'week' | 'month' | 'preview'>(() => {
    const mode = params.mode as string;
    if (mode === 'week' || mode === 'preview') {
      return mode as 'week' | 'preview';
    }
    return 'month';
  }); // 'week' | 'month' | 'preview'
  const scale = useRef(new Animated.Value(1)).current;
  const [touchedCellDate, setTouchedCellDate] = useState<Date | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const weekScrollViewRef = useRef<ScrollView>(null);
  const [showDayEventsModal, setShowDayEventsModal] = useState(false);
  const [modalEvents, setModalEvents] = useState<any[]>([]);
  const [readyToRender, setReadyToRender] = useState(Platform.OS === 'web');

  const openDayEventsModal = (date: Date) => {
    const dayEvents = getEventsForDay(date);
    if (dayEvents.length > 1) {
      // Сортируем события по времени дня
      const sorted = [...dayEvents].sort((a, b) => {
        const timeA = a.time ? parseInt(a.time.split(':')[0]) * 60 + parseInt(a.time.split(':')[1]) : 0;
        const timeB = b.time ? parseInt(b.time.split(':')[0]) * 60 + parseInt(b.time.split(':')[1]) : 0;
        return timeA - timeB;
      });
      setModalEvents(sorted);
      setShowDayEventsModal(true);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = InteractionManager.runAfterInteractions(() => setReadyToRender(true));
    return () => handle.cancel();
  }, []);

  // Инициализируем дату из параметров
  useEffect(() => {
    if (params.date) {
      const raw = params.date as string;
      const decoded = (() => {
        try { return decodeURIComponent(raw); } catch { return raw; }
      })();
      const date = new Date(decoded || raw);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
      }
    }
  }, [params.date]);

  // Инициализация режима/даты из параметров и автоскролл в week view (только в week/preview, не в month)
  useEffect(() => {
    if (params.date) {
      const date = new Date(params.date as string);
      setSelectedDate(date);
    }
    const isWeekOrPreview = params.mode === 'week' || params.mode === 'preview';
    if (!isWeekOrPreview) return;

    setCalendarMode(params.mode as 'week' | 'preview');

    const scrollToEventTime = (attempt: number = 1) => {
        if (!params.date) return;
        
        const date = new Date(params.date as string);
        const hour = date.getHours() || 0;
        const hourIndex = Math.max(0, hour);
        // Высота строки часа: paddingVertical (15*2) + borderBottom (1) + content (~40) ≈ 70px
        const hourHeight = 70;
        // Высота заголовка недели (weekHeader) + недели (weekContainer) ≈ 200px
        const headerHeight = Platform.OS === 'web' ? 200 : 200;
        const viewportHeight = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.innerHeight : 800) : height;
        // Прокручиваем так, чтобы час был виден в центре видимой области ScrollView
        // Учитываем высоту заголовка и недели
        const scrollPosition = Math.max(0, hourIndex * hourHeight - (viewportHeight - headerHeight) / 2 + hourHeight / 2);
        
        // Стандартный способ через React Native ScrollView
        if (weekScrollViewRef.current) {
          try {
            weekScrollViewRef.current.scrollTo({ 
              y: scrollPosition, 
              animated: attempt === 1 && Platform.OS !== 'web' 
            });
          } catch (e) {
            logger.warn(`[Calendar] Error scrolling via ScrollView (attempt ${attempt}):`, e);
          }
        }
        
        // Для веб-версии используем прямое обращение к DOM
        if (Platform.OS === 'web') {
          try {
            // Сначала пытаемся получить элемент через ref
            let scrollElement: HTMLElement | null = null;
            
            // Метод 1: через getScrollableNode
            if (weekScrollViewRef.current) {
              const node = (weekScrollViewRef.current as any)?.getScrollableNode?.();
              if (node) scrollElement = node;
            }
            
            // Метод 2: через _component
            if (!scrollElement && weekScrollViewRef.current) {
              const component = (weekScrollViewRef.current as any)?._component;
              if (component) {
                const node = component.getScrollableNode?.();
                if (node) scrollElement = node;
              }
            }
            
            // Метод 3: через data-testid
            if (!scrollElement) {
              scrollElement = document.querySelector('[data-testid="week-scroll-view"]') as HTMLElement;
            }
            
            // Метод 4: ищем все прокручиваемые div элементы
            if (!scrollElement) {
              const divs = Array.from(document.querySelectorAll('div'));
              for (const div of divs) {
                const style = window.getComputedStyle(div);
                if ((style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') &&
                    div.scrollHeight > div.clientHeight) {
                  scrollElement = div;
                  break;
                }
              }
            }
            
            // Прокручиваем найденный элемент (без smooth, чтобы не было видимого дёргания)
            if (scrollElement) {
              scrollElement.scrollTop = scrollPosition;
            } else {
              logger.warn(`[Calendar] ScrollView element not found (attempt ${attempt})`);
              
              // Последняя попытка: ищем через все возможные селекторы
              if (attempt >= 3) {
                const allDivs = Array.from(document.querySelectorAll('div'));
                for (const div of allDivs) {
                  const rect = div.getBoundingClientRect();
                  const style = window.getComputedStyle(div);
                  // Ищем div, который содержит список часов и может прокручиваться
                  if (div.textContent?.includes('00:00') && div.scrollHeight > div.clientHeight) {
                    (div as HTMLElement).scrollTop = scrollPosition;
                    logger.debug(`[Calendar] Found scrollable div via content search, scrolled to: ${scrollPosition}`);
                    break;
                  }
                }
              }
            }
          } catch (e) {
            logger.warn(`[Calendar] Error scrolling via DOM (attempt ${attempt}):`, e);
          }
        }
      };
      
      // Первая попытка через 300ms
      const timeout1 = setTimeout(() => scrollToEventTime(1), 300);
      
      // Дополнительные попытки для веб-версии
      const timeouts: NodeJS.Timeout[] = [timeout1];
      if (Platform.OS === 'web') {
        timeouts.push(setTimeout(() => scrollToEventTime(2), 600));
        timeouts.push(setTimeout(() => scrollToEventTime(3), 1200));
        timeouts.push(setTimeout(() => scrollToEventTime(4), 2000));
      }
      
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [params.date, params.mode]);

  // На вебе в month view фиксируем скролл окна/body, чтобы не было дёргания при открытии
  useEffect(() => {
    if (Platform.OS !== 'web' || calendarMode !== 'month') return;
    const reset = () => {
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };
    reset();
    const t = setTimeout(reset, 50);
    return () => clearTimeout(t);
  }, [calendarMode]);

  // КАЛЕНДАРЬ: я_член_события (показываем все события, где я член - организатор или принятый участник)
  // КРИТИЧЕСКИ ВАЖНО: Для прошедших событий проверяем через eventProfiles, чтобы учесть удаление
  const userEvents = useMemo(() => {
    const userId = calendarUserId ?? currentUserId;
    if (!userId) return [];

    const filtered = events.filter(event => {
      // Проверяем отношения пользователя к событию
      const relationship = getUserRelationship(event, userId);
      
      // Включаем события, где пользователь:
      // - организатор (organizer)
      // - участник (accepted)
      // - в ожидании (waiting) - запланировал событие
      // - приглашен (invited)
      if (relationship === 'organizer' || relationship === 'accepted' || relationship === 'waiting' || relationship === 'invited') {
        return true;
      }
      
      // Для прошедших событий: организатор или участник по profile.participants (единый принцип с профилем)
      if (isEventPast(event)) {
        if (event.organizerId === userId) return true;
        const profile = eventProfiles.find(p => p.eventId === event.id);
        return profile ? profile.participants.includes(userId) : false;
      }
      
      return false;
    });
    
    // Убираем дубликаты по id - оставляем только первое вхождение каждого события
    const seen = new Set<string>();
    return filtered.filter(event => {
      if (seen.has(event.id)) {
        return false;
      }
      seen.add(event.id);
      return true;
    });
  }, [events, eventProfiles, calendarUserId, currentUserId, getUserRelationship, isEventPast]);

  // Проверяем, прошедшее ли событие (с учётом времени)
  const isPastEvent = (event: any): boolean => {
    if (!event?.date || !event?.time) return false;
    const [hh, mm] = event.time.split(':').map((v: string) => parseInt(v, 10));
    const eventDateTime = new Date(event.date + 'T' + `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
    return new Date().getTime() > eventDateTime.getTime();
  };

  // Получаем неделю для выбранной даты
  const getWeekDays = () => {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = useMemo(() => getWeekDays(), [selectedDate]);

  // Проверка, соответствует ли дата регулярному событию
  const matchesRecurringEvent = useCallback((event: any, date: Date): boolean => {
    if (!event.isRecurring) return false;
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = date.getDay(); // 0 = воскресенье, 1 = понедельник, ...
    
    switch (event.recurringType) {
      case 'daily':
        // Каждый день начиная с даты события (или текущей даты, если событие уже началось)
        if (event.date) {
          const eventDate = new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          const checkDate = new Date(date);
          checkDate.setHours(0, 0, 0, 0);
          return checkDate >= eventDate;
        }
        return true;
        
      case 'weekly':
        // Каждый день недели начиная с даты события
        if (event.recurringDays && event.recurringDays.length > 0) {
          // Проверяем, что дата >= даты начала события
          if (event.date) {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            const checkDate = new Date(date);
            checkDate.setHours(0, 0, 0, 0);
            if (checkDate < eventDate) {
              return false;
            }
          }
          return event.recurringDays.includes(dayOfWeek);
        }
        return false;
        
      case 'monthly':
        // Каждый день месяца начиная с даты события
        if (event.recurringDayOfMonth) {
          // Проверяем, что дата >= даты начала события
          if (event.date) {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            const checkDate = new Date(date);
            checkDate.setHours(0, 0, 0, 0);
            if (checkDate < eventDate) {
              return false;
            }
          }
          return day === event.recurringDayOfMonth;
        }
        return false;
        
      case 'custom':
        // Только выбранные даты
        if (event.recurringCustomDates && event.recurringCustomDates.length > 0) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return event.recurringCustomDates.includes(dateStr);
        }
        return false;
        
      default:
        return false;
    }
  }, []);

  // Группируем события по датам (с учетом регулярных событий)
  const eventsByDate = useMemo(() => {
    const grouped: { [key: string]: typeof userEvents } = {};
    
    // Генерируем даты для отображения (3 месяца вперед и назад)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - 3);
    const endDate = new Date(today);
    endDate.setMonth(today.getMonth() + 3);
    
    userEvents.forEach(event => {
      if (!event.isRecurring) {
        // Обычное событие - используем дату события напрямую
        const dateKey = event.date;
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
      } else {
        // Регулярное событие - добавляем на все соответствующие даты
        // Для custom дат - добавляем все выбранные даты, даже если они вне диапазона
        if (event.recurringType === 'custom' && event.recurringCustomDates && event.recurringCustomDates.length > 0) {
          event.recurringCustomDates.forEach(dateStr => {
            if (!grouped[dateStr]) {
              grouped[dateStr] = [];
            }
            if (!grouped[dateStr].find(e => e.id === event.id)) {
              grouped[dateStr].push(event);
            }
          });
        } else {
          // Для daily, weekly, monthly - проверяем все даты в диапазоне
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            if (matchesRecurringEvent(event, currentDate)) {
              const year = currentDate.getFullYear();
              const month = String(currentDate.getMonth() + 1).padStart(2, '0');
              const day = String(currentDate.getDate()).padStart(2, '0');
              const dateKey = `${year}-${month}-${day}`;
              
              if (!grouped[dateKey]) {
                grouped[dateKey] = [];
              }
              // Проверяем, не добавлено ли уже это событие на эту дату
              if (!grouped[dateKey].find(e => e.id === event.id)) {
                grouped[dateKey].push(event);
              }
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }
    });
    
    return grouped;
  }, [userEvents, matchesRecurringEvent]);

  const previewEvent = useMemo(() => {
    if (previewEventId && calendarMode === 'preview') {
      return events.find(e => e.id === previewEventId);
    }
    return null;
  }, [previewEventId, events, calendarMode]);


  // Pending события по датам (для индикации в month view)
  const pendingByDate = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};
    events.forEach(ev => {
      const status = getMyEventParticipationStatus(ev.id);
      if (status === 'pending') {
        const dateKey = ev.date;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(ev);
      }
    });
    // Также учитываем previewEvent как pending-представление дня
    if (previewEvent) {
      const dateKey = previewEvent.date;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      if (!grouped[dateKey].find(e => e.id === previewEvent.id)) {
        grouped[dateKey].push({ ...previewEvent, isPreview: true });
      }
    }
    return grouped;
  }, [events, previewEvent, getMyEventParticipationStatus, eventRequests]);

  // (ч/б отключен) предзагрузка не требуется


  // Если есть previewEvent, убеждаемся, что выбран правильный день и проскроллим к часу
  useEffect(() => {
    if (calendarMode === 'preview' && previewEvent) {
      // Выставляем выбранную дату на дату события
      const [y, m, d] = previewEvent.date.split('-').map(n => parseInt(n, 10));
      const [hh, mm] = previewEvent.time.split(':').map(n => parseInt(n, 10));
      const dt = new Date(y, (m - 1), d, hh || 0, mm || 0, 0, 0);
      setSelectedDate(dt);
      // Скроллим к нужному часу после рендера
      setTimeout(() => {
        if (weekScrollViewRef.current) {
          const hourIndex = Math.max(0, hh || 0);
          const scrollPosition = hourIndex * 70;
          weekScrollViewRef.current.scrollTo({ y: scrollPosition, animated: true });
        }
      }, 300);
    }
  }, [calendarMode, previewEvent]);

  // Группируем события по датам и времени
  const getEventsForDay = useCallback((date: Date) => {
    // Форматируем дату в локальное время без часового пояса
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    return userEvents.filter(event => {
      // Обычные события - проверяем точное совпадение даты
      if (!event.isRecurring) {
        return event.date === dateKey;
      }
      
      // Регулярные события - проверяем соответствие паттерну
      return matchesRecurringEvent(event, date);
    });
  }, [userEvents, matchesRecurringEvent]);

  // Получаем события для часа (включая профили событий, pending и preview)
  const getEventsForHour = useCallback((date: Date, hour: number): any[] => {
    // Форматируем дату в локальное время без часового пояса
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    const result: any[] = [];
    const addedEventIds = new Set<string>();
    
    // Получаем события дня один раз
    const dayEvents = getEventsForDay(date);
    // СНАЧАЛА добавляем preview событие (если передано через GO)
    // Это приоритетно, чтобы оно показывалось с кнопкой
    // НО только если статус еще не waiting (запрос уже отправлен)
    if (previewEvent && previewEvent.date === dateKey) {
      const eventHour = parseInt(previewEvent.time.split(':')[0]);
      if (eventHour === hour) {
        const status = getMyEventParticipationStatus(previewEvent.id);
        // Проверяем статус через getUserRelationship для правильного определения waiting
        const relationship = getUserRelationship(previewEvent, currentUserId ?? '');
        // Проверяем, не является ли событие уже обычным событием (пользователь уже участник)
        const isAlreadyMember = currentUserId ? isUserEventMember(previewEvent, currentUserId) : false;
        // Если статус уже waiting - не показываем как preview, оно будет показано в pending секции
        const isWaiting = relationship === 'waiting';
        // Если есть inviteId, всегда показываем кнопку подтверждения (если еще не участник и не waiting)
        const shouldShowConfirmation = inviteId ? !isAlreadyMember && !isWaiting : (!status && !isAlreadyMember && !isWaiting);
        if (shouldShowConfirmation) {
          result.push({
            ...previewEvent,
            isPreview: true,
            needsConfirmation: true
          });
          addedEventIds.add(previewEvent.id);
        }
      }
    }
    
    // Затем обрабатываем обычные события дня
    dayEvents.forEach(event => {
      const eventHour = parseInt(event.time.split(':')[0]);
      if (eventHour === hour) {
        // Пропускаем, если событие уже добавлено (например, как preview)
        if (addedEventIds.has(event.id)) {
          return;
        }
        
        // Проверяем статус через getUserRelationship для правильного различения состояний
        const relationship = getUserRelationship(event, currentUserId ?? '');
        
        // ПРИОРИТЕТ 1: Если это waiting (пользователь отправил запрос на участие) - показываем с оранжевым значком
        // КРИТИЧЕСКИ ВАЖНО: Добавляем waiting события из dayEvents, а не пропускаем их!
        if (relationship === 'waiting') {
          result.push({ ...event, isPending: true, participationStatus: 'pending', relationshipType: 'waiting' });
          addedEventIds.add(event.id);
          return; // Важно: возвращаемся, чтобы не проверять дальше
        }
        
        // ПРИОРИТЕТ 2: Если это приглашение (invited) - показываем как preview с кнопкой
        if (relationship === 'invited') {
          result.push({
            ...event,
            isPreview: true,
            needsConfirmation: true
          });
          addedEventIds.add(event.id);
          return; // Пропускаем добавление как обычное событие
        }
        
        // ПРИОРИТЕТ 3: Обычные события (accepted, organizer) - НЕ включаем non_member
        // non_member события не должны показываться в календаре
        if (relationship === 'accepted' || relationship === 'organizer') {
          result.push(event);
          addedEventIds.add(event.id);
        }
      }
    });
    
    // КРИТИЧЕСКИ ВАЖНО: Проверяем ВСЕ события (не только userEvents) на наличие приглашений и pending запросов
    // Это нужно, потому что invited/waiting события могут не попадать в userEvents после присоединения
    // Проверяем СНАЧАЛА waiting, ПОТОМ invited, чтобы события со статусом waiting не терялись
    events.forEach(event => {
      // Для регулярных событий проверяем через matchesRecurringEvent
      const matchesDate = event.isRecurring 
        ? matchesRecurringEvent(event, date)
        : event.date === dateKey;
      
      if (matchesDate) {
        const eventHour = parseInt(event.time.split(':')[0]);
        if (eventHour === hour && !addedEventIds.has(event.id)) {
          // Пропускаем, если это preview событие (уже добавлено выше)
          if (previewEvent && event.id === previewEvent.id) {
            return;
          }
          
          // Проверяем статус через getUserRelationship для правильного различения состояний
          const relationship = getUserRelationship(event, currentUserId ?? '');
          
          // ОТЛАДКА: Логируем для событий, которые могут быть waiting
          if (currentUserId && eventRequests.some(req => req.eventId === event.id && req.type === 'join' && req.fromUserId === currentUserId)) {
          }
          
          // ПРИОРИТЕТ 1: Если это waiting (пользователь отправил запрос на участие) - показываем с оранжевым значком
          // Это должно быть ПЕРЕД проверкой invited, чтобы события не терялись после присоединения
          if (relationship === 'waiting') {
            result.push({ ...event, isPending: true, participationStatus: 'pending', relationshipType: 'waiting' });
            addedEventIds.add(event.id);
            return; // Важно: возвращаемся, чтобы не проверять дальше
          }
          
          // ПРИОРИТЕТ 2: Если это приглашение (invited) - показываем как preview с кнопкой
          if (relationship === 'invited') {
            result.push({
              ...event,
              isPreview: true,
              needsConfirmation: true
            });
            addedEventIds.add(event.id);
          }
        }
      }
    });

    
    return result;
  }, [getEventsForDay, previewEvent, events, eventRequests, getMyEventParticipationStatus, inviteId, currentUserId, isUserEventMember, getUserRelationship]);

  // Создаем слоты времени (0:00 - 23:00) - полная версия часов
  const hourSlots: HourSlot[] = useMemo(() => {
    const slots: HourSlot[] = [];
    for (let hour = 0; hour <= 23; hour++) {
      const hourEvents = getEventsForHour(selectedDate, hour);
      slots.push({ hour, events: hourEvents });
    }
    return slots;
  }, [selectedDate, getEventsForHour, eventRequests]); // Добавляем eventRequests для обновления при изменении статуса запросов

  const getDayName = (date: Date) => {
    return t.calendar.weekDays[date.getDay()];
  };

  const getMonthDay = (date: Date) => {
    return date.getDate();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Генерируем месяцы для month view: первый месяц в списке — текущий (индекс 0), затем будущие, затем прошлые.
  // Так при открытии календаря scrollTop=0 сразу показывает нужный месяц — без программного скролла и дёрганий.
  const months: MonthData[] = useMemo(() => {
    const monthsArray: MonthData[] = [];
    const start = new Date(CALENDAR_START.getTime());
    const buildMonth = (i: number) => {
      const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const firstDayWeekday = new Date(year, month, 1).getDay();
      const days: DayData[] = [];
      for (let j = 0; j < firstDayWeekday; j++) {
        days.push({ day: 0, date: new Date(), events: [] });
      }
      for (let day = 1; day <= lastDay; day++) {
        const currentDate = new Date(year, month, day);
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        days.push({ day, date: currentDate, events: eventsByDate[dateKey] || [] });
      }
      return { month, year, days };
    };
    // Генерируем диапазон месяцев начиная примерно за год до текущей даты
    // (например, если сейчас март 2026, то начнётся с марта 2025).
    for (let i = 0; i <= 60; i++) {
      monthsArray.push(buildMonth(i));
    }
    return monthsArray;
  }, [eventsByDate]);

  const getMonthName = (month: number) => {
    return t.calendar.months[month];
  };

  const renderMonth = (monthData: MonthData) => {
    const monthName = getMonthName(monthData.month);
    // Для веб-версии используем ограниченную ширину контейнера (500px), для мобильных - полную ширину экрана
    const getContainerWidth = () => {
      if (Platform.OS === 'web') {
        return Math.min(width, 500);
      }
      return width;
    };
    const containerWidth = getContainerWidth();
    // Для веб-версии учитываем padding (20px с каждой стороны = 40px)
    // Для мобильных padding уже учтен в width
    const padding = Platform.OS === 'web' ? 40 : 40;
    const cellWidth = (containerWidth - padding) / 7;

    const weeks: DayData[][] = [];
    // Правильно разбиваем дни на недели, заполняя последнюю неделю пустыми днями если нужно
    for (let i = 0; i < monthData.days.length; i += 7) {
      const week = monthData.days.slice(i, i + 7);
      // Если неделя неполная, дополняем пустыми днями
      while (week.length < 7) {
        week.push({
          day: 0,
          date: new Date(),
          events: []
        });
      }
      weeks.push(week);
    }

    return (
      <View key={`${monthData.year}-${monthData.month}`} style={styles.monthContainer}>
        <View style={styles.monthHeader}>
          <Text style={styles.monthTitle}>
            {monthName} {monthData.year}
          </Text>
        </View>

        <View style={styles.weekDaysHeader}>
          {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => (
            <View key={`weekday-${dayIndex}`} style={[styles.weekDayHeaderCell, { width: cellWidth }]}>
              <Text style={styles.weekDayHeaderText}>{t.calendar.weekDays[dayIndex]}</Text>
            </View>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((dayData, dayIndex) => {
              const dateKeyStr = dayData.day > 0
                ? `${dayData.date.getFullYear()}-${String(dayData.date.getMonth() + 1).padStart(2, '0')}-${String(dayData.date.getDate()).padStart(2, '0')}`
                : '';
              return (
              <TouchableOpacity 
                key={`day-${dayIndex}`} 
                style={[styles.dayCell, { width: cellWidth }]}
                onPress={() => {
                  if (dayData.day > 0) {
                    setTouchedCellDate(dayData.date);
                    setSelectedDate(dayData.date);
                    if (Platform.OS === 'web' || (typeof window !== 'undefined')) setCalendarMode('week');
                  }
                }}
                {...(Platform.OS === 'web' && dateKeyStr ? { dataSet: { calendarDay: dateKeyStr } } : {})}
              >
                {dayData.day > 0 && (
                  dayData.events.length > 0 ? (
                    <TouchableOpacity 
                      style={[
                        styles.eventCircleContainer,
                        isPastEvent(dayData.events[0]) && styles.pastEventCircle
                      ]}
                      onPress={() => {
                        setTouchedCellDate(dayData.date);
                        setSelectedDate(dayData.date);
                        if (Platform.OS === 'web' || typeof window !== 'undefined') setCalendarMode('week');
                        // Если несколько событий — открываем модалку со списком
                        if (dayData.events.length > 1) {
                          openDayEventsModal(dayData.date);
                          return;
                        }
                        // Одно событие — переход на аккаунт события
                        router.push(`/event-profile/${dayData.events[0].id}`);
                      }}
                    >
                      <Image
                        source={{ uri: getEventPhoto(dayData.events[0].id) || '' }}
                        style={styles.eventPhotoCircle as ImageStyle}
                      />
                      {(() => {
                        const dateKeyStr = `${dayData.date.getFullYear()}-${String(dayData.date.getMonth()+1).padStart(2,'0')}-${String(dayData.date.getDate()).padStart(2,'0')}`;
                        const hasPending = !!(pendingByDate[dateKeyStr] && pendingByDate[dateKeyStr].length > 0);
                        return hasPending ? (
                          <View pointerEvents="none" style={styles.pendingBWOverlay} />
                        ) : null;
                      })()}
                      {/* Дата по центру кружочка (как в недельной раскладке) */}
                      <View style={styles.dayNumberCentered}>
                        <Text style={styles.dayNumberCenteredText}>{dayData.day}</Text>
                      </View>
                      {dayData.events.length > 1 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>+{dayData.events.length - 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    // Если есть pending/preview на этот день — показываем фото с затемняющим оверлеем
                    (() => {
                      const dateKeyStr = `${dayData.date.getFullYear()}-${String(dayData.date.getMonth()+1).padStart(2,'0')}-${String(dayData.date.getDate()).padStart(2,'0')}`;
                      const dayPending = pendingByDate[dateKeyStr];
                      // Проверяем, не показывается ли это событие уже как обычное событие
                      const existingInEvents = dayData.events.length > 0;
                      if (dayPending && dayPending.length > 0 && !existingInEvents) {
                        const ev = dayPending[0];
                        const src = getEventPhoto(ev.id) || '';
                        return (
                          <TouchableOpacity 
                            style={[styles.eventCircleContainer]}
                            onPress={() => {
                              setTouchedCellDate(dayData.date);
                              router.push(`/event-profile/${ev.id}`);
                            }}
                          >
                            <Image source={{ uri: src }} style={styles.eventPhotoCircle as ImageStyle} />
                            <View pointerEvents="none" style={styles.pendingBWOverlay} />
                            {/* Дата по центру кружочка (как в недельной раскладке) */}
                            <View style={styles.dayNumberCentered}>
                              <Text style={styles.dayNumberCenteredText}>{dayData.day}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      }
                      return (<Text style={styles.emptyDayNumber}>{dayData.day}</Text>);
                    })()
                  )
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // Высота каждого месяца своя (зависит от числа недель), поэтому нельзя
  // экстраполировать смещение по высоте одного месяца — копим реальные
  // высоты и считаем точную сумму до текущего месяца.
  const monthHeightsRef = useRef<number[]>([]);
  const hasScrolledRef = useRef(false);

  const currentMonthIndex = useMemo(() => {
    if (!months.length) return 0;
    const cy = DEFAULT_CALENDAR_OPEN.getFullYear();
    const cm = DEFAULT_CALENDAR_OPEN.getMonth();
    const first = months[0];
    return (cy - first.year) * 12 + (cm - first.month);
  }, [months]);

  const handleMonthLayout = useCallback((e: any, index: number) => {
    if (hasScrolledRef.current || currentMonthIndex <= 0) return;
    monthHeightsRef.current[index] = e.nativeEvent.layout.height;

    if (index < currentMonthIndex - 1) return;
    for (let i = 0; i < currentMonthIndex; i++) {
      if (!monthHeightsRef.current[i]) return; // ещё не все высоты собраны
    }

    hasScrolledRef.current = true;
    const offset = monthHeightsRef.current.slice(0, currentMonthIndex).reduce((sum, h) => sum + h, 0);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, 50);
  }, [currentMonthIndex]);

  const renderMonthView = () => {
    return (
      <ScrollView
        ref={scrollViewRef}
        nativeID="calendar-month-scroll"
        testID="calendar-month-scroll"
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {months.map((monthData, idx) => (
          <View key={`${monthData.year}-${monthData.month}`} onLayout={(e) => handleMonthLayout(e, idx)}>
            {renderMonth(monthData)}
          </View>
        ))}
      </ScrollView>
    );
  };

  // Scroll handled by onLayout in renderMonthView

  const renderWeekView = () => {
    const monthName = getMonthName(selectedDate.getMonth());
    
    return (
      <>
        {/* Заголовок с месяцем */}
        <View style={styles.weekHeader}>
          <Text style={styles.weekMonthName}>{monthName}</Text>
        </View>

        {/* Неделя сверху */}
        <View style={styles.weekContainer}>
          {weekDays.map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const dateKeyStr = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
            const dayPending = pendingByDate[dateKeyStr] || [];
            // Объединяем события и pending, убирая дубликаты
            const allDayEventsMap = new Map();
            dayEvents.forEach(e => allDayEventsMap.set(e.id, e));
            dayPending.forEach(e => {
              if (!allDayEventsMap.has(e.id)) {
                allDayEventsMap.set(e.id, e);
              }
            });
            const allDayEvents = Array.from(allDayEventsMap.values());
            const isSelected = selectedDate.toDateString() === day.toDateString();
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDay,
                  isSelected ? styles.selectedWeekDayBright : styles.unselectedWeekDayDimmed
                ]}
                onPress={() => setSelectedDate(day)}
              >
                {/* Наименование дня недели - абсолютно позиционировано сверху */}
                <Text style={[styles.weekDayName, !isSelected && styles.dimmedText]}>{getDayName(day)}</Text>
                
                {/* Кружочек события как фон под датой */}
                {allDayEvents.length > 0 && (
                  <View style={styles.weekDayEventsContainer}>
                    {allDayEvents.length === 1 ? (
                      // Одно событие - кружочек как фон за датой
                      <TouchableOpacity
                        style={styles.weekEventCircleContainer}
                        onPress={(e) => {
                          e.stopPropagation();
                          const event = allDayEvents[0];
                          setSelectedDate(day);
                          router.push(`/event-profile/${event.id}`);
                        }}
                      >
                        <Image
                          source={{ uri: getEventPhoto(allDayEvents[0].id) || '' }}
                          style={styles.weekEventCircle as ImageStyle}
                        />
                        {(() => {
                          const event = allDayEvents[0];
                          const status = getMyEventParticipationStatus(event.id);
                          const isPending = status === 'pending' || dayPending.find(e => e.id === event.id);
                          return isPending ? <View style={styles.weekPendingOverlay} pointerEvents="none" /> : null;
                        })()}
                      </TouchableOpacity>
                    ) : (
                      // Несколько событий - кружочек с меткой "+n"
                      <TouchableOpacity
                        style={styles.weekEventCircleContainer}
                        onPress={(e) => {
                          e.stopPropagation();
                          // В недельной раскладке просто переключаем день, без поп-апа
                          setSelectedDate(day);
                        }}
                      >
                        <Image
                          source={{ uri: getEventPhoto(allDayEvents[0].id) || '' }}
                          style={styles.weekEventCircle as ImageStyle}
                        />
                        {(() => {
                          const event = allDayEvents[0];
                          const status = getMyEventParticipationStatus(event.id);
                          const isPending = status === 'pending' || dayPending.find(e => e.id === event.id);
                          return isPending ? <View style={styles.weekPendingOverlay} pointerEvents="none" /> : null;
                        })()}
                        <View style={styles.weekCountBadge}>
                          <Text style={styles.weekCountText}>+{allDayEvents.length - 1}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                
                {/* Дата - всегда на одной линии, независимо от наличия событий */}
                <View style={styles.weekDayNumberCentered}>
                  <Text style={[styles.weekDayNumberCenteredText, !isSelected && styles.dimmedText]}>
                    {getMonthDay(day)}
                  </Text>
                </View>
                
              </TouchableOpacity>
            );
          })}
        </View>

        {/* День по часам внизу */}
        <ScrollView 
          ref={weekScrollViewRef} 
          style={styles.dayView}
          data-testid="week-scroll-view"
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
        >
          {hourSlots.map((slot, index) => {
            // Форматируем дату и время для передачи в create
            const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
            const timeStr = `${String(slot.hour).padStart(2, '0')}:00`;
            
            return (
              <View key={index} style={styles.hourSlot}>
                <TouchableOpacity
                  onPress={() => {
                    router.push(`/create?date=${dateStr}&time=${timeStr}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.hourLabel}>{String(slot.hour).padStart(2, '0')}:00</Text>
                </TouchableOpacity>
                <View style={styles.eventsContainer}>
                {slot.events.map((event, eventIndex) => {
                  const participationStatus = getMyEventParticipationStatus(event.id);
                  
                  // Определяем relationship один раз для всех проверок
                  const relationship = getUserRelationship(event, currentUserId ?? '');

                  // Preview (GO) — показать подтверждение
                  // Показываем кнопку если: это preview событие с needsConfirmation
                  // И (нет статуса участия ИЛИ это приглашение - invited)
                  // НО НЕ показываем, если статус уже waiting (запрос уже отправлен)
                  const isPreviewWithButton = (event as any).needsConfirmation === true || (event as any).isPreview === true;
                  const hasNoStatus = !participationStatus;
                  const isInvited = relationship === 'invited';
                  const isWaiting = relationship === 'waiting';
                  const hasInviteId = inviteId && participationStatus !== 'accepted';
                  // Показываем кнопку если это preview событие И (нет статуса ИЛИ есть приглашение)
                  // НО НЕ показываем, если пользователь уже является участником ИЛИ статус уже waiting
                  const isAlreadyMember = currentUserId ? isUserEventMember(event, currentUserId) : false;
                  const shouldShowPreviewButton = isPreviewWithButton && !isAlreadyMember && !isWaiting && (hasNoStatus || hasInviteId || isInvited);
                  
                  if (shouldShowPreviewButton) {
                    return (
                      <View key={eventIndex} style={[styles.eventItem, styles.previewEventItem]}>
                        {/* Визуально как обычное событие */}
                        <TouchableOpacity
                          onPress={() => router.push(`/event-profile/${event.id}`)}
                        >
                          <View style={styles.eventItemContent}>
                            {getEventPhoto(event.id) && (
                              <Image
                                source={{ uri: getEventPhoto(event.id) || '' }}
                                style={styles.eventPhotoCircle as ImageStyle}
                                onError={(e) => {
                                  logger.debug('Error loading event photo:', e.nativeEvent.error);
                                }}
                              />
                            )}
                            <View style={styles.eventTextContainer}>
                              <Text style={styles.eventTitle}>{event.title}</Text>
                              <Text style={styles.eventLocation}>{event.location}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                        {/* Кнопка подтверждения внизу */}
                        <TouchableOpacity
                          style={styles.confirmButton}
                          activeOpacity={0.7}
                          onPress={async () => {
                            try {
                              // Находим приглашение для этого события
                              const inviteRequest = eventRequests.find(req => 
                                req.eventId === event.id &&
                                req.type === 'invite' &&
                                req.toUserId === currentUserId &&
                                req.status === 'pending'
                              );
                              
                              // Если есть inviteId в параметрах - используем его
                              const requestIdToUse = inviteId || inviteRequest?.id;
                              
                              if (requestIdToUse) {
                                // Принимаем приглашение
                                const request = eventRequests.find(req => req.id === requestIdToUse);
                                const isAlreadyMember = currentUserId ? isUserEventMember(event, currentUserId) : false;
                                
                                // Если еще не участник - принимаем приглашение
                                if (request && currentUserId && !isAlreadyMember) {
                                  // Принимаем приглашение
                                  await respondToEventRequest(requestIdToUse, true);
                                  
                                  // Синхронизация событий происходит автоматически через WebSocket
                                  // Не нужно вызывать syncEventsFromServer вручную
                                  
                                  // КРИТИЧЕСКИ ВАЖНО: Удаляем запрос из списка сразу после принятия
                                  // Это нужно, чтобы кнопка "принять приглашение" исчезла
                                  // removeEventRequestById уже обновляет состояние eventRequests
                                  if (request.type === 'invite') {
                                    removeEventRequestById(requestIdToUse);
                                  }
                                }
                              } else {
                                // Если нет приглашения - отправляем запрос на участие
                                if (!currentUserId) {
                                  router.push('/(auth)');
                                  return;
                                }
                                
                                // Проверяем, является ли организатор бизнес-аккаунтом и требуется ли оплата
                                const organizerData = getUserData(event.organizerId);
                                const isBusinessAccount = organizerData?.accountType === 'business';
                                const isPaidEvent = event.price && event.price !== t.createEvent.free && event.price.toLowerCase() !== 'free';
                                
                                // Если это бизнес-аккаунт и событие платное - открываем страницу платежей
                                if (isBusinessAccount && isPaidEvent) {
                                  router.push(`/payment?eventId=${event.id}&type=event_participation`);
                                  return;
                                }
                                
                                // Отправляем запрос на участие (планирование)
                                // Для бизнес-аккаунтов запрос автоматически принимается в sendEventRequest
                                try {
                                  await sendEventRequest(event.id, currentUserId);
                                  // КРИТИЧЕСКИ ВАЖНО: После отправки запроса событие должно остаться в календаре
                                  // со статусом "waiting" (ожидание подтверждения от организатора)
                                  // Событие будет показано в pending секции с оранжевым значком ожидания
                                  // НЕ удаляем событие из календаря - оно должно остаться видимым
                                  
                                  // Даем время на обновление состояния запросов и пересчет зависимостей
                                  // Используем более длительную задержку для гарантии обновления всех зависимостей
                                  await new Promise(resolve => setTimeout(resolve, 500));
                                  
                                  // Принудительно обновляем календарь, чтобы событие появилось со статусом waiting
                                  // Это нужно, потому что React может не пересчитать useMemo сразу после обновления eventRequests
                                  
                                  // Для бизнес-аккаунтов показываем сообщение об успешном присоединении
                                  if (isBusinessAccount) {
                                    Alert.alert(
                                      t.common.success,
                                      t.events.joinedEvent,
                                      [{ text: 'OK' }]
                                    );
                                  }
                                } catch (error: any) {
                                  // Обрабатываем ошибку "Already requested or member" - это нормальная ситуация
                                  // Состояние запросов уже обновлено в useEventRequests, просто игнорируем ошибку
                                  if (error instanceof ApiError) {
                                    const errorMessage = error.message?.toLowerCase() || '';
                                    if (errorMessage.includes('already requested') || 
                                        errorMessage.includes('already member') || 
                                        errorMessage.includes('already a member')) {
                                      // Пользователь уже отправил запрос или является участником
                                      // Состояние уже обновлено в useEventRequests, просто игнорируем
                                      logger.debug('User already requested or is a member, state already updated');
                                      return;
                                    }
                                  }
                                  // Для других ошибок логируем, но не прерываем выполнение
                                  logger.error('Error sending event request:', error);
                                }
                              }
                            } catch (error) {
                              logger.error('Error handling event request:', error);
                              // Не показываем ошибку пользователю для "already requested"
                            }
                          }}
                        >
                          <Text style={styles.confirmButtonText}>
                            {(inviteId || eventRequests.find(req => 
                              req.eventId === event.id &&
                              req.type === 'invite' &&
                              req.toUserId === currentUserId &&
                              req.status === 'pending'
                            )) ? t.calendar.acceptInvitation : t.calendar.schedule}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  // Waiting — пользователь отправил запрос на участие (type: 'join')
                  // Показываем с оранжевым значком часов и фото события
                  if (relationship === 'waiting') {
                    const photoUrl = getEventPhoto(event.id);
                    return (
                      <View key={eventIndex} style={styles.eventItem}>
                        <View style={styles.eventItemContent}>
                          {photoUrl ? (
                            <Image
                              source={{ uri: photoUrl }}
                              style={styles.eventPhotoCircle as ImageStyle}
                              onError={(e) => {
                                logger.debug('Error loading event photo:', e.nativeEvent.error);
                              }}
                            />
                          ) : (
                            <View style={[styles.eventPhotoCircle, { backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' }]}>
                              <AppIcon name="calendar" size={20} color="#f4f4f5" />
                            </View>
                          )}
                          <View style={styles.eventTextContainer}>
                            <TouchableOpacity
                              onPress={() => router.push(`/event-profile/${event.id}`)}
                            >
                              <Text style={styles.eventTitle}>{event.title}</Text>
                            </TouchableOpacity>
                            <Text style={styles.eventLocation}>{event.location}</Text>
                          </View>
                          <View style={styles.inboxStatusBadgePending}>
                            <Text style={styles.inboxStatusIcon}>⏱</Text>
                          </View>
                        </View>
                      </View>
                    );
                  }
                  
                  // Invited — пользователя пригласили (type: 'invite')
                  // Должно показываться как preview с кнопкой выше, но на всякий случай проверяем
                  if (relationship === 'invited') {
                    // Если это invited, но не preview - возможно нужно показать как preview
                    // Но обычно это обрабатывается выше через previewEvent или в dayEvents
                    return null; // Не показываем здесь, должно быть preview выше
                  }

                  // Нормальные события
                  const photoUrl = getEventPhoto(event.id);
                  return (
                    <TouchableOpacity
                      key={eventIndex}
                      style={styles.eventItem}
                      onPress={() => {
                        router.push(`/event-profile/${event.id}`);
                      }}
                    >
                      <View style={styles.eventItemContent}>
                        {photoUrl ? (
                          <Image
                            source={{ uri: photoUrl }}
                            style={styles.eventPhotoCircle as ImageStyle}
                            onError={(e) => {
                              logger.debug('Error loading event photo:', e.nativeEvent.error);
                            }}
                          />
                        ) : (
                          <View style={[styles.eventPhotoCircle, { backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' }]}>
                            <AppIcon name="calendar" size={20} color="#f4f4f5" />
                          </View>
                        )}
                        <View style={styles.eventTextContainer}>
                          <Text 
                            style={styles.eventTitle}
                            onPress={(e) => {
                              e.stopPropagation();
                              router.push(`/event-profile/${event.id}`);
                            }}
                          >
                            {event.title}
                          </Text>
                          <Text style={styles.eventLocation}>{event.location}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            );
          })}
        </ScrollView>
      </>
    );
  };

  if (!readyToRender) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF8D32" />
        <Text style={{ color: 'rgba(244,244,245,0.55)', marginTop: 12, fontSize: 14 }}>{t?.common?.loading ?? t.common.loading}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <PinchGestureHandler
        onGestureEvent={(event) => {
          const newScale = event.nativeEvent.scale;
          if (newScale < 0.8) {
            setCalendarMode('month');
          } else if (newScale > 1.2) {
            setCalendarMode('week');
            // Если была выбрана дата в month view, переключаемся на эту дату
            if (touchedCellDate) {
              setSelectedDate(touchedCellDate);
              setTouchedCellDate(null);
            }
          }
        }}
        onHandlerStateChange={(event) => {
          if (event.nativeEvent.oldState === 4) {
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: Platform.OS !== 'web',
            }).start();
          }
        }}
      >
        <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
          {(calendarMode === 'week' || calendarMode === 'preview') ? renderWeekView() : renderMonthView()}
        </Animated.View>
      </PinchGestureHandler>

      {/* Возврат на предыдущий экран — поверх обоих режимов календаря */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          try {
            router.back();
          } catch (error) {
            logger.error('Failed to go back from calendar:', error);
          }
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={t.common.back}
      >
        <AppIcon name="chevronLeft" size={24} color="#f4f4f5" />
      </TouchableOpacity>

      {/* Модалка списка событий дня */}
      <Modal
        visible={showDayEventsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDayEventsModal(false)}
      >
        <View style={styles.modalOverlayAbsolute}>
          <View style={styles.dayEventsModal}>
            <Text style={styles.dayEventsTitle}>{t.calendar.dayEvents}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {modalEvents.map((ev, idx) => (
                <TouchableOpacity
                  key={`${ev.id}-${idx}`}
                  style={styles.dayEventRow}
                  onPress={() => {
                    setShowDayEventsModal(false);
                    // Переходим на аккаунт события
                    router.push(`/event-profile/${ev.id}`);
                  }}
                >
                  <Image source={{ uri: getEventPhoto(ev.id) || '' }} style={styles.dayEventThumb as ImageStyle} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayEventTitle} numberOfLines={1}>{ev.title}</Text>
                    <Text style={styles.dayEventMeta} numberOfLines={1}>{ev.time} • {ev.location}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowDayEventsModal(false)}>
              <Text style={styles.closeModalText}>{t.calendar.close}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = calendarStyles;
