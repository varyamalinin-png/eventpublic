import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useState, useMemo, useEffect, useRef } from 'react';
import { PinchGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

interface MonthData {
  month: number;
  year: number;
  days: DayData[];
}

interface DayData {
  day: number;
  date: Date;
  events: any[];
  memories?: any[]; // Memory Posts для этого дня
}

interface HourSlot {
  hour: number;
  events: any[];
}

export default function CalendarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { 
    events, 
    eventProfiles, 
    getMyEventParticipationStatus, 
    sendEventRequest,
    getMyCalendarEvents,
    getUserCalendarEvents,
    getGlobalEvents
  } = useEvents();
  const [selectedDate, setSelectedDate] = useState(() => {
    // Используем текущую дату в реальном времени
    return new Date();
  });
  
  // Получаем userId из параметров (если не указан - текущий пользователь)
  const calendarUserId = params.userId as string | undefined;
  const previewEventId = params.eventId as string | undefined; // ID события для предпросмотра
  const [calendarMode, setCalendarMode] = useState<'week' | 'month' | 'preview'>(() => {
    // Если в параметрах указан mode=week или mode=preview
    const mode = params.mode as string;
    if (mode === 'week' || mode === 'preview') {
      return mode as 'week' | 'preview';
    }
    return 'month';
  });
  const scale = useRef(new Animated.Value(1)).current;
  const [touchedCellDate, setTouchedCellDate] = useState<Date | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const weekScrollViewRef = useRef<ScrollView>(null);

  // Инициализируем дату из параметров и режим календаря
  useEffect(() => {
    if (params.date) {
      const date = new Date(params.date as string);
      setSelectedDate(date);
    }
    if (params.mode === 'week' || params.mode === 'preview') {
      setCalendarMode(params.mode as 'week' | 'preview');
      // Скроллим к нужному времени после загрузки
      setTimeout(() => {
        if (weekScrollViewRef.current && params.date) {
          const date = new Date(params.date as string);
          const hour = date.getHours() || 8; // Если время не указано, начинаем с 8:00
          const hourIndex = Math.max(0, hour - 8); // Индекс часа в списке (0 = 8:00, 14 = 22:00)
          const scrollPosition = hourIndex * 70; // Примерная высота слота часа (70px)
          weekScrollViewRef.current.scrollTo({
            y: scrollPosition,
            animated: true
          });
        }
      }, 300);
    }
  }, [params.date, params.mode]);

  // Автоматически скроллим к текущему месяцу при загрузке календаря
  useEffect(() => {
    if (scrollViewRef.current && calendarMode === 'month') {
      // Устанавливаем selectedDate на текущую дату, если она не была установлена из params
      if (!params.date) {
        setSelectedDate(new Date());
      }
      
      // Текущий месяц имеет индекс 12 в массиве (потому что мы начинаем с i = -12 в цикле)
      // i = -12 -> index 0, i = -11 -> index 1, ..., i = 0 -> index 12
      const currentMonthIndex = 12;
      // Более точная высота месяца с учетом реальных размеров
      // Заголовок: 60px, недели: 7 недель по 110px
      const monthHeight = 60 + (6 * 110); // 720px
      // Смещаемся на +2 месяца (август -> сентябрь -> октябрь)
      // Добавляем небольшой сдвиг для размещения месяца сверху экрана
      const scrollToPosition = (currentMonthIndex + 2) * monthHeight + (height * 0.3);
      
      console.log('Прокрутка календаря к текущему месяцу:', {
        currentMonthIndex,
        monthHeight,
        scrollToPosition,
        height,
        calculatedMonth: Math.floor(scrollToPosition / monthHeight)
      });
      
      // Увеличиваем таймаут для надежности
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: scrollToPosition,
          animated: false
        });
      }, 500);
    }
  }, [calendarMode, params.date]);
  
  // Получаем события пользователя через новые функции
  const userEvents = useMemo(() => {
    if (!calendarUserId) {
      // Мой календарь
      const myEvents = getMyCalendarEvents();
      
      // Добавляем pending события (которые показываются в предпросмотре)
      // Исключаем declined события
      const pendingEvents = events.filter(event => {
        const status = getMyEventParticipationStatus(event.id);
        return status === 'pending';
      });
      
      // Объединяем мои события с pending, исключаем declined
      const allEvents = [...myEvents, ...pendingEvents];
      return allEvents.filter(event => {
        const status = getMyEventParticipationStatus(event.id);
        return status !== 'rejected'; // Скрываем declined/rejected события
      });
    } else {
      // Календарь другого пользователя
      return getUserCalendarEvents(calendarUserId);
    }
  }, [events, calendarUserId, getMyCalendarEvents, getUserCalendarEvents, getMyEventParticipationStatus]);
  
  // Событие для предпросмотра (если передано через GO)
  const previewEvent = useMemo(() => {
    if (previewEventId && calendarMode === 'preview') {
      return events.find(e => e.id === previewEventId);
    }
    return null;
  }, [previewEventId, events, calendarMode]);

  // Проверяем, прошедшее ли событие
  const isPastEvent = (event: any): boolean => {
    // Сравниваем даты как строки в формате YYYY-MM-DD
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
    
    return event.date < todayStr;
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

  // Получаем Memory Posts (посты в профилях событий)
  // Это используется для отображения постов в недельном виде
  const memoryPosts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const userId = calendarUserId || 'own-profile-1';
    
    return eventProfiles
      .flatMap(profile => {
        const profileDate = new Date(profile.date);
        // Проверяем, что дата события прошедшая (меньше или равна сегодня)
        if (profileDate <= today) {
          // Фильтруем посты этого пользователя с showInProfile
          return profile.posts.filter(post => post.authorId === userId && post.showInProfile);
        }
        return [];
      });
  }, [eventProfiles, calendarUserId]);

  // Группируем события по датам
  const eventsByDate = useMemo(() => {
    const grouped: { [key: string]: typeof userEvents } = {};
    
    userEvents.forEach(event => {
      // Используем дату события напрямую в формате YYYY-MM-DD
      const dateKey = event.date;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    return grouped;
  }, [userEvents]);

  // Группируем Memory Posts по датам события
  const memoriesByDate = useMemo(() => {
    const grouped: { [key: string]: typeof memoryPosts } = {};
    const userId = calendarUserId || 'own-profile-1';
    
    // Находим все профили событий, где есть посты этого пользователя
    const profilesWithUserPosts = eventProfiles.filter(profile => {
      return profile.posts.some(post => post.authorId === userId && post.showInProfile);
    });
    
    // Группируем профили по дате (не по постам!)
    profilesWithUserPosts.forEach(profile => {
      const dateKey = profile.date;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      // Добавляем последний пост из профиля (неважно чей автор) для фото кружочка
      if (profile.posts.length > 0) {
        const sortedPosts = [...profile.posts].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        grouped[dateKey].push(sortedPosts[0]); // Последний пост (самый новый)
      }
    });
    
    return grouped;
  }, [eventProfiles, calendarUserId]);

  // Группируем события по датам и времени
  const getEventsForDay = (date: Date) => {
    // Форматируем дату в локальное время без часового пояса
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    return userEvents.filter(event => {
      return event.date === dateKey;
    });
  };

  // Получаем события для часа (включая профили событий из Memory Posts, pending запросы и preview)
  const getEventsForHour = (date: Date, hour: number): any[] => {
    // Форматируем дату в локальное время без часового пояса
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    const result: any[] = [];
    
    // Добавляем обычные события
    const dayEvents = getEventsForDay(date);
    dayEvents.forEach(event => {
      const eventHour = parseInt(event.time.split(':')[0]);
      if (eventHour === hour) {
        result.push(event);
      }
    });
    
    // Добавляем preview событие (если передано через GO)
    if (previewEvent && previewEvent.date === dateKey) {
      const eventHour = parseInt(previewEvent.time.split(':')[0]);
      if (eventHour === hour) {
        const status = getMyEventParticipationStatus(previewEvent.id);
        // Добавляем только если еще нет запроса
        if (!status) {
          result.push({
            ...previewEvent,
            isPreview: true,
            needsConfirmation: true
          });
        }
      }
    }
    
    // Добавляем события из pending запросов (когда я отправил запрос, но еще не принят)
    // Это нужно чтобы показать предварительное размещение в календаре
    const currentUserId = 'own-profile-1';
    events.forEach(event => {
      if (event.date === dateKey) {
        const eventHour = parseInt(event.time.split(':')[0]);
        if (eventHour === hour) {
          const status = getMyEventParticipationStatus(event.id);
          // Добавляем событие если есть pending запрос и пользователь еще не участвует
          if (status === 'pending' && !dayEvents.find(e => e.id === event.id)) {
            result.push({
              ...event,
              isPending: true,
              participationStatus: 'pending'
            });
          }
        }
      }
    });
    
    // Добавляем профили событий (Event Profiles) из Memory Posts
    eventProfiles.forEach(profile => {
      if (profile.date === dateKey) {
        const eventHour = parseInt(profile.time.split(':')[0]);
        if (eventHour === hour) {
          // Проверяем, есть ли посты этого пользователя в этом профиле
          const userId = calendarUserId || 'own-profile-1';
          const hasUserPosts = profile.posts.some(post => post.authorId === userId && post.showInProfile);
          
          // Добавляем только если есть посты этого пользователя
          if (hasUserPosts) {
            // Создаем объект события из профиля для отображения
            result.push({
              ...profile,
              id: profile.eventId,
              title: profile.name,
              time: profile.time,
              isEventProfile: true
            });
          }
        }
      }
    });
    
    return result;
  };

  // Создаем слоты времени (8:00 - 22:00)
  const hourSlots: HourSlot[] = useMemo(() => {
    const slots: HourSlot[] = [];
    for (let hour = 8; hour <= 22; hour++) {
      const hourEvents = getEventsForHour(selectedDate, hour);
      slots.push({ hour, events: hourEvents });
    }
    return slots;
  }, [selectedDate, userEvents, events, previewEvent, getMyEventParticipationStatus]);

  const getDayName = (date: Date) => {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[date.getDay()];
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
          events: eventsByDate[dateKey] || [],
          memories: memoriesByDate[dateKey] || []
        });
      }
      
      monthsArray.push({
        month,
        year,
        days
      });
    }
    
    return monthsArray;
  }, [eventsByDate, memoriesByDate]);

  const getMonthName = (month: number) => {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[month];
  };

  const renderMonth = (monthData: MonthData) => {
    const monthName = getMonthName(monthData.month);
    const cellWidth = (width - 40) / 7;

    const weeks: DayData[][] = [];
    for (let i = 0; i < monthData.days.length; i += 7) {
      weeks.push(monthData.days.slice(i, i + 7));
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
              <Text style={styles.weekDayHeaderText}>{['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dayIndex]}</Text>
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
                  dayData.memories && dayData.memories.length > 0 ? (
                    <TouchableOpacity 
                      style={styles.eventCircleContainer}
                      onPress={() => {
                        // Устанавливаем touchedCellDate для правильного переключения в week view
                        setTouchedCellDate(dayData.date);
                        // Memory Posts ведут на аккаунт события
                        const profile = eventProfiles.find(ep => ep.posts.some(p => p.id === dayData.memories![0].id));
                        if (profile) {
                          router.push(`/event-profile/${profile.eventId}`);
                        }
                      }}
                    >
                      <Image
                        source={{ uri: dayData.memories[0].content }}
                        style={styles.eventPhotoCircle}
                      />
                      <View style={styles.dayNumberBadgeButton}>
                        <Text style={styles.dayNumberBadge}>{dayData.day}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : dayData.events.length > 0 ? (
                    <TouchableOpacity 
                      style={[
                        styles.eventCircleContainer,
                        isPastEvent(dayData.events[0]) && styles.pastEventCircle
                      ]}
                      onPress={() => {
                        // Устанавливаем touchedCellDate для правильного переключения в week view
                        setTouchedCellDate(dayData.date);
                        
                        if (isPastEvent(dayData.events[0])) {
                          // Прошедшее событие -> аккаунт события
                          router.push(`/event-profile/${dayData.events[0].id}`);
                        } else {
                          // Будущее событие -> карточка события
                          // TODO: Переход к конкретной карточке события в ленте
                          router.back();
                        }
                      }}
                    >
                      <Image
                        source={{ uri: dayData.events[0].mediaUrl || dayData.events[0].organizerAvatar }}
                        style={styles.eventPhotoCircle}
                      />
                      <View style={styles.dayNumberBadgeButton}>
                        <Text style={styles.dayNumberBadge}>{dayData.day}</Text>
                      </View>
                      {dayData.events.length > 1 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>+{dayData.events.length - 1}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.emptyDayNumber}>{dayData.day}</Text>
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
        {/* Заголовок с месяцем и кнопкой добавления */}
        <View style={styles.weekHeader}>
          <Text style={styles.weekMonthName}>{monthName}</Text>
          <TouchableOpacity
            style={styles.addEventButton}
            onPress={() => router.push('/create')}
          >
            <Text style={styles.addEventButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Неделя сверху */}
        <View style={styles.weekContainer}>
          {weekDays.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.weekDay,
                isToday(day) && styles.todayWeekDay,
                selectedDate.toDateString() === day.toDateString() && styles.selectedWeekDay
              ]}
              onPress={() => setSelectedDate(day)}
            >
              <Text style={styles.weekDayName}>{getDayName(day)}</Text>
              <Text style={styles.weekDayNumber}>{getMonthDay(day)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* День по часам внизу */}
        <ScrollView ref={weekScrollViewRef} style={styles.dayView}>
          {hourSlots.map((slot, index) => (
            <View key={index} style={styles.hourSlot}>
              <Text style={styles.hourLabel}>{slot.hour}:00</Text>
              <View style={styles.eventsContainer}>
                {slot.events.map((event, eventIndex) => {
                  const participationStatus = event.isPending 
                    ? 'pending' 
                    : event.isPreview && event.needsConfirmation
                    ? 'preview'
                    : getMyEventParticipationStatus(event.id);
                  
                  // Для preview событий (через GO) показываем интерфейс подтверждения
                  if (event.isPreview && event.needsConfirmation && !participationStatus) {
                    return (
                      <View key={eventIndex} style={[styles.eventItem, styles.previewEventItem]}>
                        <View style={styles.pendingEventBox}>
                          <Text style={styles.pendingEventTime}>
                            [{event.time.split(':')[0]}:{event.time.split(':')[1]}]
                          </Text>
                          <View style={styles.pendingEventContent}>
                            <Text style={styles.pendingEventTitle}>{event.title}</Text>
                            <Text style={styles.pendingEventDetails}>
                              🕐 {event.time} - {event.endTime || '00:00'}
                            </Text>
                            <Text style={styles.pendingEventDetails}>
                              📍 {event.location}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.confirmButton}
                          onPress={() => {
                            // Создаем запрос на участие
                            sendEventRequest(event.id, 'own-profile-1');
                            // Обновляем статус, чтобы кнопка исчезла
                            // После этого событие появится как pending
                          }}
                        >
                          <Text style={styles.confirmButtonText}>✅ Подтвердить запрос</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  
                  // Для pending событий показываем интерфейс с статусом
                  if (event.isPending || participationStatus === 'pending') {
                    return (
                      <View key={eventIndex} style={[styles.eventItem, styles.pendingEventItem]}>
                        <View style={styles.pendingEventBox}>
                          <Text style={styles.pendingEventTime}>
                            [{event.time.split(':')[0]}:{event.time.split(':')[1]}]
                          </Text>
                          <View style={styles.pendingEventContent}>
                            <Text style={styles.pendingEventTitle}>{event.title}</Text>
                            <Text style={styles.pendingEventDetails}>
                              🕐 {event.time} - {event.endTime || '00:00'}
                            </Text>
                            <Text style={styles.pendingEventDetails}>
                              📍 {event.location}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusText}>⏳ В ожидании</Text>
                        </View>
                      </View>
                    );
                  }
                  
                  // Для принятых событий - обычное отображение
                  if (participationStatus === 'accepted') {
                    return (
                      <TouchableOpacity
                        key={eventIndex}
                        style={styles.eventItem}
                        onPress={() => {
                          if (isPastEvent(event) || event.isEventProfile) {
                            router.push(`/event-profile/${event.id}`);
                          } else {
                            router.back();
                          }
                        }}
                      >
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventLocation}>{event.location}</Text>
                      </TouchableOpacity>
                    );
                  }
                  
                  // Для отклоненных - не показываем (declined события скрыты)
                  if (participationStatus === 'rejected') {
                    return null;
                  }
                  
                  // Для обычных событий (без статуса или других статусов)
                  return (
                    <TouchableOpacity
                      key={eventIndex}
                      style={styles.eventItem}
                      onPress={() => {
                        if (isPastEvent(event) || event.isEventProfile) {
                          router.push(`/event-profile/${event.id}`);
                        } else {
                          router.back();
                        }
                      }}
                    >
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventLocation}>{event.location}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
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
          {calendarMode === 'week' || calendarMode === 'preview' ? renderWeekView() : renderMonthView()}
        </Animated.View>
      </PinchGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
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
    paddingTop: 10,
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
  },
  todayWeekDay: {
    backgroundColor: '#1E1E1E',
  },
  selectedWeekDay: {
    backgroundColor: '#007AFF',
  },
  weekDayName: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  weekDayNumber: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
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
  pendingEventItem: {
    opacity: 0.7,
    backgroundColor: '#1A1A1A',
  },
  previewEventItem: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderStyle: 'solid',
  },
  pendingEventBox: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#444',
    borderStyle: 'dashed',
  },
  pendingEventTime: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  pendingEventContent: {
    marginLeft: 8,
  },
  pendingEventTitle: {
    color: '#CCC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  pendingEventDetails: {
    color: '#999',
    fontSize: 13,
    marginBottom: 4,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#FFA500',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
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
    paddingVertical: 30,
    paddingBottom: 60,
    minHeight: height,
  },
  monthHeader: {
    marginBottom: 30,
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
    marginBottom: 20,
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
    marginBottom: 20,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  eventCircleContainer: {
    alignItems: 'center',
  },
  pastEventCircle: {
    opacity: 0.5,
  },
  eventPhotoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
    bottom: 4,
    left: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyDayNumber: {
    color: '#444444',
    fontSize: 14,
    fontWeight: '600',
  },
});
