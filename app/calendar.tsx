import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Image, Modal, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PinchGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { ApiError } from '../services/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('Calendar');

const { width, height } = Dimensions.get('window');

interface MonthData {
  month: number;
  year: number;
  days: DayData[];
}

import type { Event } from '../../context/EventsContext';

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
  const [selectedDate, setSelectedDate] = useState(() => {
    // Используем текущую дату в реальном времени
    return new Date();
  });
  
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

  // Инициализация режима/даты из параметров и автоскролл в week view
  useEffect(() => {
    if (params.date) {
      const date = new Date(params.date as string);
      setSelectedDate(date);
    }
    if (params.mode === 'week' || params.mode === 'preview') {
      setCalendarMode(params.mode as 'week' | 'preview');
      setTimeout(() => {
        if (weekScrollViewRef.current && params.date) {
          const date = new Date(params.date as string);
          const hour = date.getHours() || 0;
          const hourIndex = Math.max(0, hour);
          const scrollPosition = hourIndex * 70; // примерная высота строки часа
          weekScrollViewRef.current.scrollTo({ y: scrollPosition, animated: true });
        }
      }, 300);
    }
  }, [params.date, params.mode]);

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
      
      // Для прошедших событий - дополнительно проверяем через профиль
      if (isEventPast(event)) {
        const profile = eventProfiles.find(p => p.eventId === event.id);
        if (profile) {
          // Проверяем, есть ли пользователь в participants
          return profile.participants.includes(userId);
        }
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
    if (previewEvent && previewEvent.date === dateKey) {
      const eventHour = parseInt(previewEvent.time.split(':')[0]);
      if (eventHour === hour) {
        const status = getMyEventParticipationStatus(previewEvent.id);
        // Проверяем, не является ли событие уже обычным событием (пользователь уже участник)
        const isAlreadyMember = currentUserId ? isUserEventMember(previewEvent, currentUserId) : false;
        // Если есть inviteId, всегда показываем кнопку подтверждения (если еще не участник)
        const shouldShowConfirmation = inviteId ? !isAlreadyMember : (!status && !isAlreadyMember);
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
        
        // Если это приглашение (invited) - показываем как preview с кнопкой
        if (relationship === 'invited') {
          result.push({
            ...event,
            isPreview: true,
            needsConfirmation: true
          });
          addedEventIds.add(event.id);
          return; // Пропускаем добавление как обычное событие
        }
        
        // Если это waiting - не добавляем здесь, добавим в pending секции ниже
        if (relationship === 'waiting') {
          return; // Пропускаем, добавим в pending секции
        }
        
        // Обычные события (accepted, organizer) - НЕ включаем non_member
        // non_member события не должны показываться в календаре
        if (relationship === 'accepted' || relationship === 'organizer') {
          result.push(event);
          addedEventIds.add(event.id);
        }
      }
    });
    
    // Также проверяем ВСЕ события (не только userEvents) на наличие приглашений
    // Это нужно, потому что invited события могут не попадать в userEvents
    events.forEach(event => {
      // Для регулярных событий проверяем через matchesRecurringEvent
      const matchesDate = event.isRecurring 
        ? matchesRecurringEvent(event, date)
        : event.date === dateKey;
      
      if (matchesDate) {
        const eventHour = parseInt(event.time.split(':')[0]);
        if (eventHour === hour && !addedEventIds.has(event.id)) {
          const relationship = getUserRelationship(event, currentUserId ?? '');
          
          // Если это приглашение (invited) - показываем как preview с кнопкой
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

    // Добавляем pending запросы для визуализации
    // Различаем два состояния:
    // 1. waiting - пользователь отправил запрос на участие (type: 'join') - показываем с оранжевым значком
    // 2. invited - пользователя пригласили (type: 'invite') - НЕ добавляем здесь, показываем как preview выше
    events.forEach(evt => {
      // Для регулярных событий проверяем через matchesRecurringEvent
      const matchesDate = evt.isRecurring 
        ? matchesRecurringEvent(evt, date)
        : evt.date === dateKey;
      
      if (matchesDate) {
        const eventHour = parseInt(evt.time.split(':')[0]);
        if (eventHour === hour) {
          // Пропускаем, если событие уже добавлено
          if (addedEventIds.has(evt.id)) {
            return;
          }
          // Пропускаем, если это preview событие (уже добавлено выше)
          if (previewEvent && evt.id === previewEvent.id) {
            return;
          }
          
          // Проверяем статус через getUserRelationship для правильного различения состояний
          const relationship = getUserRelationship(evt, currentUserId ?? '');
          
          // Добавляем только если это waiting (пользователь отправил запрос на участие)
          // invited события НЕ добавляем здесь - они показываются как preview выше
          if (relationship === 'waiting') {
            result.push({ ...evt, isPending: true, participationStatus: 'pending', relationshipType: 'waiting' });
            addedEventIds.add(evt.id);
          }
        }
      }
    });

    
    return result;
  }, [getEventsForDay, previewEvent, events, getMyEventParticipationStatus, inviteId, currentUserId, isUserEventMember, getUserRelationship]);

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

  // Генерируем месяцы для month view
  const months: MonthData[] = useMemo(() => {
    const monthsArray: MonthData[] = [];
    const today = new Date(); // Текущая дата
    
    for (let i = -12; i <= 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      const lastDay = new Date(year, month + 1, 0).getDate();
      const firstDayWeekday = new Date(year, month, 1).getDay();
      
      const days: DayData[] = [];
      
      // Пустые дни в начале месяца
      for (let j = 0; j < firstDayWeekday; j++) {
        days.push({
          day: 0,
          date: new Date(),
          events: []
        });
      }
      
      // Дни месяца
      for (let day = 1; day <= lastDay; day++) {
        const currentDate = new Date(year, month, day);
        // Форматируем дату в локальное время без часового пояса
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        days.push({
          day,
          date: currentDate,
          events: eventsByDate[dateKey] || []
        });
      }
      
      monthsArray.push({
        month,
        year,
        days
      });
    }
    
    return monthsArray;
  }, [eventsByDate]);

  // Автоматически скроллим к текущему месяцу при загрузке календаря
  useEffect(() => {
    if (scrollViewRef.current && calendarMode === 'month' && months.length > 0) {
      // Устанавливаем selectedDate на текущую дату, если она не была установлена из params
      if (!params.date && !params.mode) {
        setSelectedDate(new Date());
      }

      // Вычисляем индекс текущего месяца в массиве months
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      let currentMonthIndex = -1;
      for (let i = 0; i < months.length; i++) {
        if (months[i].year === currentYear && months[i].month === currentMonth) {
          currentMonthIndex = i;
          break;
        }
      }

      if (currentMonthIndex === -1) {
        currentMonthIndex = 12; // Индекс текущего месяца (i=0 означает i=-12, i=12 означает текущий месяц)
      }

      // Вычисляем приблизительную высоту одного месяца с учетом компактных размеров
      const monthHeaderHeight = 50;
      const weekDaysHeaderHeight = 30;
      const weekRowHeight = 80;
      const estimatedWeeks = 6;
      const monthHeight = monthHeaderHeight + weekDaysHeaderHeight + estimatedWeeks * weekRowHeight + 60;

      // Прокручиваем к текущему месяцу, центрируя его на экране
      const scrollToPosition = currentMonthIndex * monthHeight - height / 2 + monthHeight / 2;

      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: Math.max(0, scrollToPosition),
            animated: true,
          });
        }
      }, 500);
    }
  }, [calendarMode, months, params.date, params.mode, height]);

  const getMonthName = (month: number) => {
    return t.calendar.months[month];
  };

  const renderMonth = (monthData: MonthData) => {
    const monthName = getMonthName(monthData.month);
    const cellWidth = (width - 40) / 7;

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
            {week.map((dayData, dayIndex) => (
              <TouchableOpacity 
                key={`day-${dayIndex}`} 
                style={[styles.dayCell, { width: cellWidth }]}
                onPress={() => {
                  if (dayData.day > 0) {
                    setTouchedCellDate(dayData.date);
                  }
                }}
              >
                {dayData.day > 0 && (
                  dayData.events.length > 0 ? (
                    <TouchableOpacity 
                      style={[
                        styles.eventCircleContainer,
                        isPastEvent(dayData.events[0]) && styles.pastEventCircle
                      ]}
                      onPress={() => {
                        // Если несколько событий — открываем модалку со списком
                        if (dayData.events.length > 1) {
                          openDayEventsModal(dayData.date);
                          return;
                        }
                        // Одно событие — переход на аккаунт события
                        setTouchedCellDate(dayData.date);
                        router.push(`/event-profile/${dayData.events[0].id}`);
                      }}
                    >
                      <Image
                        source={{ uri: getEventPhoto(dayData.events[0].id) || 'https://via.placeholder.com/50' }}
                        style={styles.eventPhotoCircle}
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
                        const src = getEventPhoto(ev.id) || 'https://via.placeholder.com/80';
                        return (
                          <TouchableOpacity 
                            style={[styles.eventCircleContainer]}
                            onPress={() => {
                              setTouchedCellDate(dayData.date);
                              router.push(`/event-profile/${ev.id}`);
                            }}
                          >
                            <Image source={{ uri: src }} style={styles.eventPhotoCircle} />
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
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderMonthView = () => {
    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {months.map(monthData => renderMonth(monthData))}
      </ScrollView>
    );
  };

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
                          source={{ uri: getEventPhoto(allDayEvents[0].id) || 'https://via.placeholder.com/50' }}
                          style={styles.weekEventCircle}
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
                          source={{ uri: getEventPhoto(allDayEvents[0].id) || 'https://via.placeholder.com/50' }}
                          style={styles.weekEventCircle}
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
        <ScrollView ref={weekScrollViewRef} style={styles.dayView}>
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
                  const isPreviewWithButton = (event as any).needsConfirmation === true || (event as any).isPreview === true;
                  const hasNoStatus = !participationStatus;
                  const isInvited = relationship === 'invited';
                  const hasInviteId = inviteId && participationStatus !== 'accepted';
                  const shouldShowPreviewButton = isPreviewWithButton && (hasNoStatus || hasInviteId || isInvited);
                  
                  if (shouldShowPreviewButton) {
                    return (
                      <View key={eventIndex} style={[styles.eventItem, styles.previewEventItem]}>
                        {/* Визуально как обычное событие */}
                        <TouchableOpacity
                          onPress={() => router.push(`/event-profile/${event.id}`)}
                        >
                          <Text style={styles.eventTitle}>{event.title}</Text>
                        </TouchableOpacity>
                        <Text style={styles.eventLocation}>{event.location}</Text>
                        {/* Кнопка подтверждения внизу */}
                        <TouchableOpacity
                          style={styles.confirmButton}
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
                                  
                                  // Удаляем запрос из списка после принятия в календаре
                                  setTimeout(() => {
                                    if (request.type === 'invite') {
                                      // Удаляем запрос по его ID
                                      removeEventRequestById(requestIdToUse);
                                    }
                                  }, 500);
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
                                const isPaidEvent = event.price && event.price !== 'Бесплатно' && event.price.toLowerCase() !== 'free';
                                
                                // Если это бизнес-аккаунт и событие платное - открываем страницу платежей
                                if (isBusinessAccount && isPaidEvent) {
                                  router.push(`/payment?eventId=${event.id}&type=event_participation`);
                                  return;
                                }
                                
                                // Отправляем запрос на участие (планирование)
                                // Для бизнес-аккаунтов запрос автоматически принимается в sendEventRequest
                                try {
                                  await sendEventRequest(event.id, currentUserId);
                                  // Даем время на обновление состояния запросов
                                  await new Promise(resolve => setTimeout(resolve, 500));
                                  // Принудительно обновляем состояние для немедленного отображения
                                  // Событие должно появиться со статусом waiting
                                  
                                  // Для бизнес-аккаунтов показываем сообщение об успешном присоединении
                                  if (isBusinessAccount) {
                                    Alert.alert(
                                      'Успешно',
                                      'Вы присоединились к событию!',
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
                    return (
                      <View key={eventIndex} style={styles.eventItem}>
                        <View style={styles.eventItemContent}>
                          {getEventPhoto(event.id) && (
                            <Image
                              source={{ uri: getEventPhoto(event.id) || 'https://via.placeholder.com/50' }}
                              style={styles.eventPhotoCircle}
                            />
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
                  return (
                    <TouchableOpacity
                      key={eventIndex}
                      style={styles.eventItem}
                      onPress={() => {
                        router.push(`/event-profile/${event.id}`);
                      }}
                    >
                      <View style={styles.eventItemContent}>
                        {getEventPhoto(event.id) && (
                          <Image
                            source={{ uri: getEventPhoto(event.id) || 'https://via.placeholder.com/50' }}
                            style={styles.eventPhotoCircle}
                          />
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
              useNativeDriver: true,
            }).start();
          }
        }}
      >
        <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
          {(calendarMode === 'week' || calendarMode === 'preview') ? renderWeekView() : renderMonthView()}
        </Animated.View>
      </PinchGestureHandler>
      
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
                  <Image source={{ uri: getEventPhoto(ev.id) || 'https://via.placeholder.com/80' }} style={styles.dayEventThumb} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  previewCtaContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  previewCtaButton: {
    backgroundColor: '#34C759',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  previewCtaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  weekMonthName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  addEventButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addEventButtonText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  weekContainer: {
    flexDirection: 'row',
    paddingTop: 5,
    paddingHorizontal: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    position: 'relative',
    minHeight: 90,
  },
  selectedWeekDayBright: {
    // Выбранный день без фона, но яркий
  },
  unselectedWeekDayDimmed: {
    // Невыбранные дни затемнены через оверлей (убрали, больше не используется)
  },
  dimmedText: {
    opacity: 0.5,
  },
  weekDayEventsContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    top: 35,
    left: 0,
    right: 0,
  },
  weekEventCircleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  weekEventCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  weekPendingOverlay: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  weekCountBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCountText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  weekDayName: {
    color: '#999',
    fontSize: 12,
    position: 'absolute',
    top: 5,
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 10,
  },
  weekDayNumber: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  weekDayNumberCentered: {
    position: 'absolute',
    top: 35,
    left: 0,
    right: 0,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  weekDayNumberCenteredText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dayView: {
    flex: 1,
  },
  hourSlot: {
    flexDirection: 'row',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  hourLabel: {
    color: '#999',
    fontSize: 14,
    width: 60,
    fontWeight: '600',
  },
  eventsContainer: {
    flex: 1,
  },
  eventItem: {
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  eventItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventTextContainer: {
    flex: 1,
  },
  previewEventItem: {
    borderWidth: 1,
    borderColor: '#8B5CF6',
    backgroundColor: '#1B1236',
  },
  eventTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  eventLocation: {
    color: '#999',
    fontSize: 14,
  },
  placeholderText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  // Стили для month view
  scrollView: {
    flex: 1,
  },
  monthContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  monthHeader: {
    marginBottom: 15,
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  weekDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekDayHeaderCell: {
    alignItems: 'center',
  },
  weekDayHeaderText: {
    color: '#999999',
    fontSize: 12,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  eventCircleContainer: {
    alignItems: 'center',
  },
  pastEventCircle: {
    opacity: 0.5,
  },
  eventPhotoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  dayNumberBadgeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  dayNumberBadge: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  dayNumberCentered: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  dayNumberCenteredText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyDayNumber: {
    color: '#444444',
    fontSize: 14,
    fontWeight: '600',
  },
  // Наложение для имитации ч/б на pending события в месячной раскладке
  pendingBWOverlay: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  // Статус ожидания как в инбоксе (оранжевый бейдж)
  inboxStatusBadgePending: {
    backgroundColor: '#FF9500',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inboxStatusIcon: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Кнопка Подтвердить (обводка, светлый текст)
  confirmButton: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Модалка списка событий дня
  modalOverlayAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayEventsModal: {
    width: '90%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
  },
  dayEventsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  dayEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayEventThumb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    overflow: 'hidden',
  },
  dayEventTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayEventMeta: {
    color: '#999',
    fontSize: 12,
  },
  closeModalBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
  },
  closeModalText: {
    color: '#FFF',
    fontSize: 14,
  },
});
