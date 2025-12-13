import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, Modal, ScrollView, Alert, InteractionManager, TextInput } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import ParticipantsModal from './ParticipantsModal';
import ComplaintForm from './ComplaintForm';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { formatRecurringEventDate } from '../utils/dateHelpers';
import { createLogger } from '../utils/logger';
import { getAllRecurringDates } from '../utils/recurringEventUtils';
import { eventCardStyles } from './EventCard/EventCard.styles';
import { useEventCardActions } from '../hooks/events/useEventCardActions';
import EventCardActionsModal from './EventCard/EventCardActionsModal';
import EventCardMiniature from './EventCard/EventCardMiniature';

const logger = createLogger('EventCard');

type EventCardProps = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  displayDate?: string; // для корректного отображения даты
  location: string;
  price: string;
  participants: number;
  maxParticipants: number;
  organizerAvatar: string;
  organizerId: string;
  variant?: 'default' | 'miniature_1' | 'miniature_2' | 'chat_preview';
  mediaUrl?: string;
  originalMediaUrl?: string; // Оригинальное фото для попапа
  mediaType?: 'image' | 'video';
  mediaAspectRatio?: number; // соотношение сторон медиа (ширина/высота)
  participantsList?: string[]; // список URL аватарок участников (для обратной совместимости)
  participantsData?: Array<{ avatar: string; userId: string; name?: string }>; // расширенные данные участников
  showSwipeAction?: boolean; // показывать ли свайп-действие
  showOrganizerAvatar?: boolean; // показывать ли аватарку организатора
  onMiniaturePress?: () => void; // кастомный обработчик клика для мини-карточек
  onLongPress?: () => void; // обработчик долгого нажатия
  onLayout?: (height: number) => void; // колбэк для передачи высоты карточки
  viewerUserId?: string; // ID участника, через профиль которого смотрят событие (для третьих лиц)
  context?: 'explore' | 'memories' | 'other_profile' | 'own_profile' | 'folder'; // folder - событие внутри папки
  tags?: string[]; // Метки (теги) события
  folderId?: string; // ID папки, в которой находится событие (если есть)
};

export default function EventCard({
  id,
  title,
  description,
  date,
  time,
  displayDate,
  location,
  price,
  participants,
  maxParticipants,
  organizerAvatar,
  organizerId,
  variant = 'default',
  mediaUrl,
  originalMediaUrl,
  mediaType = 'image',
  mediaAspectRatio = 1,
  participantsList = [],
  participantsData = [],
  showSwipeAction = true,
  showOrganizerAvatar = true,
  onMiniaturePress,
  onLongPress,
  onLayout,
  viewerUserId,
  context = 'explore', // По умолчанию контекст explore
  tags = [],
  folderId,
}: EventCardProps) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  // Теги всегда видимы, кроме контекста memories (там есть переключатель)
  const [tagsVisible, setTagsVisible] = useState<boolean>(true); // Состояние для видимости меток в memories
  const { 
    updateEvent, 
    getUserData, 
    sendEventRequest, 
    getEventParticipants,
    getEventProfile,
    isUserEventMember,
    isEventPast,
    getEventPhotoForUser,
    setPersonalEventPhoto,
    getUserRequestStatus,
    getUserRelationship,
    isUserOrganizer,
    cancelEventRequest,
    cancelEventParticipation,
    events,
    cancelEvent,
    cancelOrganizerParticipation,
    transferOrganizerRole,
    deleteEvent,
    removeParticipantFromEvent,
    eventRequests,
    respondToEventRequest,
    getChatsForUser,
    getChat,
    getFriendsList,
    eventFolders,
    removeEventFromFolder,
    addEventToFolder,
    sendEventToChats,
    createPersonalChat,
    saveEvent,
    removeSavedEvent,
    isEventSaved,
    rejectInvitation,
    updateEventProfile,
    eventProfiles,
    fetchEventProfile
  } = useEvents();
  
  // Получаем событие из контекста
<<<<<<< HEAD
  const event = useMemo(() => events.find(e => e.id === id), [events, id]);
  
  // Загружаем из профиля события при монтировании
  const eventProfile = useMemo(() => {
    const foundEvent = events.find(e => e.id === id);
    return foundEvent ? getEventProfile(id) : null;
  }, [events, id, getEventProfile]);
=======
  const event = useMemo(() => {
    return events.find(e => e.id === id);
  }, [events, id]);
  
  // Получаем профиль события из контекста (более надежно, чем getEventProfile)
  const eventProfile = useMemo(() => {
    return eventProfiles.find(p => p.eventId === id) || null;
  }, [eventProfiles, id]);
  
  // Загружаем профиль события автоматически, если его нет
  // НЕ загружаем профиль для preview-событий (они временные и не имеют профиля на сервере)
  const loadingProfileRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Загружаем профиль только если:
    // 1. Событие существует
    // 2. Профиль еще не загружен
    // 3. fetchEventProfile доступен
    // 4. Профиль еще не загружается
    // 5. Это НЕ preview-событие (временное событие)
    const isPreviewEvent = id && (id.includes('-temp') || id.startsWith('preview-'));
    if (event && !eventProfile && fetchEventProfile && id && !loadingProfileRef.current.has(id) && !isPreviewEvent) {
      loadingProfileRef.current.add(id);
      fetchEventProfile(id)
        .then((profile: any) => {
          if (profile) {
            logger.debug(`[EventCard] Профиль загружен для события ${id}`, { postsCount: profile.posts?.length || 0 });
          }
          loadingProfileRef.current.delete(id);
        })
        .catch((error: any) => {
          logger.error(`[EventCard] Ошибка загрузки профиля для события ${id}:`, error);
          loadingProfileRef.current.delete(id);
        });
    }
  }, [event, eventProfile, fetchEventProfile, id]);
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
  
  const [showParticipants, setShowParticipants] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showEventActionsModal, setShowEventActionsModal] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddToFolderModal, setShowAddToFolderModal] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [selectedShareChats, setSelectedShareChats] = useState<string[]>([]);
  const [showRecurringDatesModal, setShowRecurringDatesModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTransferOrganizerModal, setShowTransferOrganizerModal] = useState(false);
  const [selectedNewOrganizerId, setSelectedNewOrganizerId] = useState<string | null>(null);
  // Состояние для режима редактирования видимости параметров (только для прошедших событий в меморис)
  const [isEditingParameterVisibility, setIsEditingParameterVisibility] = useState(false);
<<<<<<< HEAD
  const [hiddenParameters, setHiddenParameters] = useState<Record<string, boolean>>(
    (eventProfile as any)?.hiddenParameters || {}
  );
=======
  const initialHiddenParameters = useMemo(() => (eventProfile as any)?.hiddenParameters || {}, [eventProfile]);
  const [hiddenParameters, setHiddenParameters] = useState<Record<string, boolean>>(initialHiddenParameters);
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
  
  // Синхронизируем скрытые параметры при изменении профиля события
  useEffect(() => {
    if (eventProfile && (eventProfile as any).hiddenParameters) {
      setHiddenParameters((eventProfile as any).hiddenParameters);
    }
  }, [eventProfile]);
  const translateX = useRef(new Animated.Value(0)).current;
  const [isJoined, setIsJoined] = useState(false);
  const [showSwipeButtons, setShowSwipeButtons] = useState(false);
  const swipeX = useRef(0); // Отслеживаем текущее значение свайпа
<<<<<<< HEAD
  
=======
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
  const { t, language } = useLanguage();
  
  // Отладочная информация для тегов
  const allTags = tags && tags.length > 0 ? tags : (event?.tags && event.tags.length > 0 ? event.tags : []);
<<<<<<< HEAD
  if (allTags.length > 0 && (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production')) {
    logger.debug(`Tags for event ${id}:`, { allTags, tagsProp: tags, eventTags: event?.tags });
  }
=======
  
  // Явно добавляем метку "массовое" если событие массовое, но тег отсутствует
  // Проверяем как из контекста (event?.isMassEvent), так и из тегов
  const hasMassEvent = event?.isMassEvent || false;
  const hasMassEventTag = allTags.some(t => 
    t.toLowerCase().includes('массовое') || 
    t.toLowerCase().includes('mass')
  );
  
  // Если событие массовое, но тег отсутствует - добавляем его
  // Это важно для preview-событий, где событие может быть не в контексте
  const finalTags = hasMassEvent && !hasMassEventTag 
    ? [...allTags, 'массовое']
    : allTags;
  
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
  
  // Используем новую функцию getUserRelationship для определения отношений
  const relationship = event && currentUserId ? getUserRelationship(event, currentUserId) : 'non_member';
  const userRole = event && currentUserId ? getUserRequestStatus(event, currentUserId) : 'not_requested';
  const isOrganizer = relationship === 'organizer';
  const isMember = event && currentUserId ? isUserEventMember(event, currentUserId) : false;
  const eventParticipants = event ? getEventParticipants(id) : [];
  const participantsCount = eventParticipants.length;
  
  // Проверяем, приглашен ли пользователь на событие (для обратной совместимости)
  const inviteRequest = event ? eventRequests.find(req => 
    req.eventId === event.id &&
    req.type === 'invite' &&
    req.status === 'pending' &&
    (req.toUserId === currentUserId || req.userId === currentUserId)
  ) : null;
  const isInvited = relationship === 'invited';
  
  // Определяем, нужно ли показывать свайп-кнопки (не показываем в Memories)
  const shouldShowSwipeButtons = context !== 'memories' && showSwipeAction && variant === 'default';
  
  // Определяем время события (предстоящее/прошедшее)
  const isPast = event ? isEventPast(event) : false;
  
  // Используем хук для получения списка действий
  const eventActions = useEventCardActions({
    event,
    context,
    relationship,
    isPast,
    participantsCount,
    isEventSaved,
    eventId: id,
    tagsVisible,
    hasEventFolders: eventFolders && Array.isArray(eventFolders) && eventFolders.length > 0,
    folderId,
  });
  
  // Определяем, нужно ли показывать три точки (если есть хотя бы одно действие)
  // В режиме редактирования видимости параметров показываем кнопку "Сохранить" вместо трех точек
  const shouldShowThreeDots = eventActions.length > 0 && variant === 'default' && !isEditingParameterVisibility;
  const shouldShowSaveButton = isEditingParameterVisibility && variant === 'default' && isPast;
  
  // Определяем какие кнопки показывать в зависимости от контекста, роли и статуса
  const getSwipeButtons = () => {
    // Если событие в папке и прошедшее - показываем кнопку "удалить из папки"
    if (context === 'folder' && folderId && isPast) {
      return {
        primary: {
          type: 'remove_from_folder',
          label: 'Удалить из папки',
          color: '#FF3B30',
          icon: '🗑️'
        },
        secondary: null
      };
    }
    
    // Если событие прошедшее - не показываем кнопки
    if (!shouldShowSwipeButtons || !event || isEventPast(event)) return { primary: null, secondary: null };
    
    // 🎯 ПРИОРИТЕТ 1: Приглашение (invited) - высший приоритет
    if (relationship === 'invited' && (context === 'explore' || context === 'other_profile')) {
      return {
        primary: {
          type: 'accept_invite',
          label: t.events.acceptInvitation,
          color: '#34C759',
          icon: '✓'
        },
        secondary: {
          type: 'cancel_invite',
          label: t.events.cancelInvitation,
          color: '#FF3B30',
          icon: '✕'
        }
      };
    }
    
    // ПРИОРИТЕТ 2: Организатор
    if (relationship === 'organizer') {
      if (context === 'explore') {
        if (participantsCount === 1) {
          // Отменить событие (красная кнопка) - организатор единственный участник
          return {
            primary: {
              type: 'cancel_event',
              label: t.events.cancelEvent,
              color: '#FF3B30',
              icon: '✕'
            },
            secondary: null
          };
        } else {
          // Передать роль организатора (красная кнопка)
          return {
            primary: {
              type: 'transfer_organizer_role',
              label: t.events.transferOrganizerRole || 'Передать роль организатора',
              color: '#FF3B30',
              icon: '👤'
            },
            secondary: null
          };
        }
      } else if (context === 'other_profile') {
        // В профиле другого человека (раздел участник) - две кнопки
        // Первая: отменить событие или передать роль (в зависимости от количества участников)
        // Вторая: удалить участника
        const primaryButton = participantsCount === 1
          ? {
              type: 'cancel_event',
              label: t.events.cancelEvent,
              color: '#FF3B30',
              icon: '✕'
            }
          : {
              type: 'transfer_organizer_role',
              label: t.events.transferOrganizerRole || 'Передать роль организатора',
              color: '#FF3B30',
              icon: '👤'
            };
        
        return {
          primary: primaryButton,
          secondary: {
              type: 'remove_participant',
            label: t.events.removeParticipant,
            color: '#FF3B30',
            icon: '✕'
          }
        };
      } else if (context === 'own_profile') {
        // В своем профиле - одна кнопка в зависимости от количества участников
        if (participantsCount === 1) {
          return {
            primary: {
              type: 'cancel_event',
              label: t.events.cancelEvent,
              color: '#FF3B30',
              icon: '✕'
            },
            secondary: null
          };
        } else {
          return {
            primary: {
              type: 'transfer_organizer_role',
              label: t.events.transferOrganizerRole || 'Передать роль организатора',
              color: '#FF3B30',
              icon: '👤'
            },
            secondary: null
          };
        }
      }
    }
    
    // ПРИОРИТЕТ 3: В ожидании (waiting)
    if (relationship === 'waiting' && (context === 'explore' || context === 'other_profile')) {
      return {
        primary: {
          type: 'view_requests',
          label: '',
          color: '#FF9500',
          icon: '⏱'
        },
        secondary: {
          type: 'cancel_request',
          label: 'Отменить запрос',
          color: '#FF3B30',
          icon: '✕'
        }
      };
    }
    
    // ПРИОРИТЕТ 4: Участник (accepted)
    if (relationship === 'accepted') {
      // Статус "принят" или пользователь является участником (но не организатором)
      // В explore - карточка должна быть скрыта (обрабатывается фильтрацией)
      // В своем профиле показываем кнопку "Отменить участие" для всех участников
      if (context === 'own_profile') {
        return {
          primary: {
            type: 'cancel_participation',
            label: 'Отменить участие',
            color: '#FF3B30',
            icon: '✕'
          },
          secondary: null
        };
      } else if (context === 'other_profile') {
        // В профиле другого человека показываем две кнопки
        return {
          primary: {
            type: 'accepted',
            label: 'Вы уже участвуете',
            color: '#34C759',
            icon: '✓'
          },
          secondary: {
            type: 'cancel_participation',
            label: 'Отменить участие',
            color: '#FF3B30',
            icon: '✕'
          }
        };
      }
      // В explore accepted события не должны показываться (фильтрация)
      // Но если все же попадут сюда - не показываем кнопки
      if (context === 'explore') {
        return { primary: null, secondary: null };
      }
    }
    
    // ПРИОРИТЕТ 5: Отклонен (rejected) - не показываем кнопки (карточка не должна отображаться)
    if (relationship === 'rejected') {
      return { primary: null, secondary: null };
    }
    
    // ПРИОРИТЕТ 6: Не член (non_member) - показываем кнопку GO
    if (relationship === 'non_member' && (context === 'explore' || context === 'other_profile')) {
      // Проверяем, что нет pending запроса от этого пользователя
      const hasPendingRequest = eventRequests.some(req => 
        req.eventId === event.id && 
        (req.fromUserId === currentUserId || req.userId === currentUserId) &&
        req.status === 'pending' &&
        req.type === 'join'
      );
      
      if (!hasPendingRequest) {
        return {
          primary: {
            type: 'go',
            label: 'GO',
            color: '#8B5CF6',
            icon: '' // Убираем дублирование, оставляем только label
          },
          secondary: null
        };
      }
    }
    
    return { primary: null, secondary: null };
  };
  
  const swipeButtons = getSwipeButtons();
  
  // Получаем фото с учетом персонализации
  // viewerUserId передается из props, если карточка просматривается через профиль участника
  // ВАЖНО: Если mediaUrl передан напрямую через props, используем его (для карточек событий)
  // Иначе используем getEventPhotoForUser для персонализированных фото (для прошедших событий)
  const displayMediaUrl = mediaUrl || (event ? getEventPhotoForUser(id, currentUserId || '', viewerUserId) : undefined) || (event?.mediaUrl) || organizerAvatar;
  
  // Определяем формат медиа: если соотношение > 1.5, то это горизонтальный формат
  const isWideFormat = mediaAspectRatio > 1.5;
  
  const handlePricePress = () => {
    // Переход на страницу платежки (пока заглушка)
    logger.debug('Переход на страницу платежки');
  };
  
  const handleDatePress = () => {
    // Переход в календарь на дату и час события
    if (!event) return;
    
    // Для регулярных событий показываем модальное окно со списком дат
    if (event.isRecurring) {
      setShowRecurringDatesModal(true);
      return;
    }
    
    const viewerId = currentUserId;
    const isMember = viewerId ? isUserEventMember(event, viewerId) : false;
    
    // Формируем ISO дату-время для перехода
    const isoDateTime = `${date}T${time}:00`;
    
    if (isMember) {
      // Если я член события - обычный переход в календарь
      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=week`);
    } else if (isInvited && inviteRequest) {
      // Если я приглашен - preview режим с кнопкой "Принять приглашение"
      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}&inviteId=${inviteRequest.id}`);
    } else {
      // Если я НЕ член - preview режим с кнопкой "Запланировать"
      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}`);
    }
  };
  
  const handleTimePress = () => {
    // Переход в календарь на день и час события
    if (!event) return;
    
    const viewerId = currentUserId;
    const isMember = viewerId ? isUserEventMember(event, viewerId) : false;
    
    // Формируем ISO дату-время для перехода
    const isoDateTime = `${date}T${time}:00`;
    
    if (isMember) {
      // Если я член события - обычный переход в календарь
      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=week`);
    } else if (isInvited && inviteRequest) {
      // Если я приглашен - preview режим с кнопкой "Принять приглашение"
      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}&inviteId=${inviteRequest.id}`);
    } else {
      // Если я НЕ член - preview режим с кнопкой "Запланировать"
      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}`);
    }
  };
  
  const handleLocationPress = () => {
    // Переход на карту с отмеченной точкой события
    // Для онлайн-событий (без coordinates) не открываем карту
    if (event?.coordinates) {
      router.push(`/map?eventId=${id}`);
    }
  };
  
  // Проверяем, является ли событие онлайн (нет coordinates)
  const isOnlineEvent = !event?.coordinates;
  
  const handleParticipantsPress = () => {
    setShowParticipantsModal(true);
  };

  // Функция для переключения видимости параметра
  const toggleParameterVisibility = (parameterName: string) => {
    // Нельзя скрывать title (наименование события)
    if (parameterName === 'title') {
      return;
    }
    setHiddenParameters(prev => ({
      ...prev,
      [parameterName]: !prev[parameterName]
    }));
  };

  // Функция для рендеринга параметра с оверлеем (в режиме редактирования)
  const renderParameterWithOverlay = (
    parameterName: string,
    parameterContent: React.ReactNode,
    isHidden: boolean
  ) => {
    // Если параметр скрыт и мы не в режиме редактирования - не показываем его
    if (isHidden && !isEditingParameterVisibility) {
      return null;
    }

    if (!isEditingParameterVisibility) {
      // В обычном режиме просто возвращаем контент (если не скрыт)
      return parameterContent;
    }

    // В режиме редактирования оборачиваем в оверлей (параметры всегда показываются с оверлеем)
    return (
      <View style={styles.parameterWrapper}>
        {parameterContent}
        <TouchableOpacity
          style={[styles.parameterOverlay, isHidden && styles.parameterOverlayHidden]}
          onPress={() => toggleParameterVisibility(parameterName)}
          activeOpacity={0.7}
        >
          <Text style={styles.eyeIcon}>{isHidden ? '👁️‍🗨️' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleParticipantPress = (userId: string) => {
    if (currentUserId === userId) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/profile/${userId}`);
    }
  };

  // Обработчик действий из модального окна
  const handleActionPress = useCallback((actionId: string) => {
    if (actionId === 'share') {
      setSelectedShareChats([]);
      setShareSearchQuery('');
      setShowShareModal(true);
      setShowEventActionsModal(false);
    } else if (actionId === 'change_photo') {
      handleChangePhotoFromModal();
    } else if (actionId === 'accept_invite') {
      const isoDateTime = `${date}T${time}:00`;
      const inviteId = inviteRequest?.id;
      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}${inviteId ? `&inviteId=${inviteId}` : ''}`);
      setShowEventActionsModal(false);
    } else if (actionId === 'cancel_invite') {
      if (inviteRequest) {
        rejectInvitation(inviteRequest.id).catch(error => {
          logger.error('Ошибка при отклонении приглашения:', error);
          Alert.alert(t.common.error, t.events.failedToDeclineInvitation || 'Failed to decline invitation');
        });
      }
      setShowEventActionsModal(false);
    } else if (actionId === 'cancel_request') {
      if (currentUserId) {
        cancelEventRequest(id, currentUserId);
      }
      setShowEventActionsModal(false);
    } else if (actionId === 'cancel_participation') {
      if (currentUserId) {
        cancelEventParticipation(id, currentUserId);
      }
      setShowEventActionsModal(false);
    } else if (actionId === 'cancel_event') {
      // Если участников больше 1, показываем попап с transfer organizer role
      if (participantsCount > 1) {
        setShowTransferOrganizerModal(true);
        setShowEventActionsModal(false);
      } else {
        // Если участник только организатор, просто отменяем событие
        cancelEvent(id);
        setShowEventActionsModal(false);
      }
    } else if (actionId === 'transfer_organizer_role') {
      setShowTransferOrganizerModal(true);
      setShowEventActionsModal(false);
    } else if (actionId === 'view_requests') {
      router.push('/(tabs)/inbox');
      setShowEventActionsModal(false);
    } else if (actionId === 'go_to_chat') {
      const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === id && c.type === 'event');
      if (eventChat) {
        router.push(`/(tabs)/inbox/${eventChat.id}`);
        setShowEventActionsModal(false);
      }
    } else if (actionId === 'schedule') {
      if (event?.isRecurring) {
        setShowRecurringDatesModal(true);
        setShowEventActionsModal(false);
      } else {
        const isoDateTime = `${date}T${time}:00`;
        router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}`);
        setShowEventActionsModal(false);
      }
    } else if (actionId === 'extend_recurring') {
      setShowEventActionsModal(false);
      router.push(`/(tabs)/create?eventId=${id}`);
    } else if (actionId === 'change_parameters') {
      router.push(`/create?eventId=${id}`);
      setShowEventActionsModal(false);
    } else if (actionId === 'remove_participant') {
      if (viewerUserId) {
        removeParticipantFromEvent(id, viewerUserId);
      }
      setShowEventActionsModal(false);
    } else if (actionId === 'hide_parameters') {
      setIsEditingParameterVisibility(true);
      setShowEventActionsModal(false);
    } else if (actionId === 'save') {
      if (isEventSaved(id)) {
        removeSavedEvent(id);
        Alert.alert('Готово', 'Событие удалено из сохраненных');
      } else {
        saveEvent(id);
        Alert.alert('Готово', 'Событие сохранено');
      }
      setShowEventActionsModal(false);
    } else if (actionId === 'report') {
      setShowEventActionsModal(false);
      setShowComplaintForm(true);
    } else if (actionId === 'toggle_tags') {
      setTagsVisible(!tagsVisible);
      setShowEventActionsModal(false);
    } else if (actionId === 'remove_from_folder') {
      if (folderId) {
        Alert.alert(
          'Удалить из папки',
          'Вы уверены, что хотите удалить это событие из папки?',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Удалить',
              style: 'destructive',
              onPress: async () => {
                try {
                  await removeEventFromFolder(folderId, id);
                  Alert.alert('Готово', 'Событие удалено из папки');
                } catch (error) {
                  Alert.alert('Ошибка', 'Не удалось удалить событие из папки');
                }
              },
            },
          ]
        );
      }
      setShowEventActionsModal(false);
    } else if (actionId === 'add_to_folder') {
      setShowAddToFolderModal(true);
      setShowEventActionsModal(false);
    } else if (actionId === 'delete_event') {
      Alert.alert(
        t.events.deleteEvent || 'Удалить событие',
        t.events.deleteEventConfirm || 'Вы уверены, что хотите удалить это событие?',
        [
          {
            text: t.common.cancel || 'Отмена',
            style: 'cancel',
            onPress: () => setShowEventActionsModal(false),
          },
          {
            text: t.events.deleteEvent || 'Удалить',
            style: 'destructive',
            onPress: async () => {
              try {
                const event = events.find(e => e.id === id);
                if (event && isEventPast(event)) {
                  logger.debug(`Отменяем участие в прошедшем событии ${id} (событие остается для других участников)`);
                  if (currentUserId) {
                    await cancelEventParticipation(id, currentUserId);
                  }
                  setShowEventActionsModal(false);
                } else {
                  await deleteEvent(id);
                  setShowEventActionsModal(false);
                }
              } catch (error) {
                logger.error('Error deleting event:', error);
                Alert.alert(t.common.error || 'Ошибка', (t.events as any).deleteError || 'Не удалось удалить событие');
              }
            },
          },
        ]
      );
    } else {
      setShowEventActionsModal(false);
    }
  }, [
    id,
    date,
    time,
    inviteRequest,
    currentUserId,
    event,
    viewerUserId,
    folderId,
    tagsVisible,
    router,
    t,
    events,
    isEventPast,
    isEventSaved,
    cancelEventRequest,
    cancelEventParticipation,
    cancelEvent,
    removeParticipantFromEvent,
    rejectInvitation,
    removeEventFromFolder,
    deleteEvent,
    saveEvent,
    removeSavedEvent,
    getChatsForUser,
    setTagsVisible,
    setIsEditingParameterVisibility,
    setShowEventActionsModal,
    setShowShareModal,
    setShowComplaintForm,
    setShowAddToFolderModal,
    setShowTransferOrganizerModal,
    setShowRecurringDatesModal,
    setSelectedShareChats,
    setShareSearchQuery,
  ]);

  // Обработка изменения фото события (обернута в useCallback для стабильности)
  const handleChangeEventPhoto = useCallback(async () => {
    logger.debug('handleChangeEventPhoto вызван - открываем галерею');
    
    try {
      // Проверяем разрешения
      const hasPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      logger.debug('Результат разрешений:', hasPermission);
      
      if (hasPermission.status !== 'granted') {
        Alert.alert('Ошибка', 'Нет доступа к галерее');
        return;
      }

      logger.debug('Открываем галерею...');
      // Открываем галерею с таймаутом для диагностики
      const pickerPromise = ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      logger.debug('Промис галереи создан, ждём результат...');
      
      // Добавляем таймаут для диагностики
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Таймаут ожидания галереи (10 секунд)'));
        }, 10000);
      });
      
      const result = await Promise.race([pickerPromise, timeoutPromise]) as ImagePicker.ImagePickerResult | null;
      
      logger.debug('Галерея вернула результат:', { hasResult: !!result, canceled: result?.canceled });

      if (result && !result.canceled && result.assets && result.assets[0] && currentUserId) {
        logger.debug('Сохраняем фото:', result.assets[0].uri);
        setPersonalEventPhoto(id, currentUserId, result.assets[0].uri);
        Alert.alert('Успешно', 'Фото события изменено');
      } else {
        logger.debug('Выбор фото отменен пользователем');
      }
    } catch (error) {
      logger.error('Ошибка при выборе фото:', error);
      Alert.alert('Ошибка', `Не удалось открыть галерею: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }, [id, currentUserId, setPersonalEventPhoto]);

  // Обработчик нажатия на "Изменить фото для себя" в модальном окне
  const handleChangePhotoFromModal = useCallback(() => {
    logger.debug('Кнопка "Изменить фото для себя" нажата, закрываем модальное окно');
    // Закрываем модальное окно
    setShowEventActionsModal(false);
    // Используем InteractionManager для гарантии, что модальное окно полностью закрылось
    InteractionManager.runAfterInteractions(() => {
      // Увеличиваем задержку до 800ms для полной гарантии закрытия модального окна
      setTimeout(() => {
        logger.debug('Открываем галерею после закрытия модального окна (задержка 800ms)');
        handleChangeEventPhoto().catch(error => {
          logger.error('Ошибка при открытии галереи:', error);
          Alert.alert('Ошибка', `Не удалось открыть галерею: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        });
      }, 800);
    });
  }, [handleChangeEventPhoto, setShowEventActionsModal]);

  // Обновляем handleActionPress чтобы использовать handleChangePhotoFromModal
  const handleActionPressWithPhoto = useCallback((actionId: string) => {
    if (actionId === 'change_photo') {
      handleChangePhotoFromModal();
    } else {
      handleActionPress(actionId);
    }
  }, [handleChangePhotoFromModal, handleActionPress]);


  // Получаем список участников - это драйвер для отображения везде
  // Используем getEventParticipants как единый источник истины
  const participantIds = getEventParticipants(id);
  
  // Подготавливаем данные участников для отображения мини-аватарок
  // Всегда используем getEventParticipants как источник, независимо от props
  const displayParticipants = participantIds.map(userId => {
    const userData = getUserData(userId);
    return {
      avatar: userData.avatar,
      userId,
      name: userData.name || userData.username
    };
  });

  // Обработчики для разных типов кнопок
  const handlePrimaryButtonPress = () => {
    if (!swipeButtons.primary) return;
    
    switch (swipeButtons.primary.type) {
      case 'remove_from_folder':
        // Удаление события из папки
        if (folderId) {
          Alert.alert(
            'Удалить из папки',
            'Удалить это событие из папки?',
            [
              { 
                text: 'Отмена', 
                style: 'cancel',
                onPress: () => {
                  setShowSwipeButtons(false);
                  Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                  }).start();
                }
              },
              {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                  try {
                    if (!folderId) return;
                    await removeEventFromFolder(folderId, id);
                    // Если это было последнее событие, папка будет автоматически удалена на сервере
                    // Обновление состояния произойдет через refreshFolders в контексте
                    Alert.alert('Готово', 'Событие удалено из папки');
                  } catch (error: any) {
                    // Если папка не найдена (404), значит она была автоматически удалена
                    if (error?.status === 404 || error?.message?.includes('404')) {
                      Alert.alert('Папка удалена', 'Папка была удалена, так как в ней не осталось событий');
                    } else {
                      Alert.alert('Ошибка', 'Не удалось удалить событие из папки');
                    }
                  } finally {
                    setShowSwipeButtons(false);
                    Animated.spring(translateX, {
                      toValue: 0,
                      useNativeDriver: true,
                    }).start();
                  }
                },
              },
            ]
          );
          return;
        }
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
      case 'go':
        // Для регулярных событий показываем модальное окно со списком дат
        if (event?.isRecurring) {
          setShowRecurringDatesModal(true);
          setShowSwipeButtons(false);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          // Переходим в календарь в режиме предпросмотра
          const isoDateTime = `${date}T${time}:00`;
          router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}`);
        }
        break;
        
      case 'view_requests':
        // Переход на страницу "мои запросы"
        router.push('/(tabs)/inbox');
        break;
        
      case 'cancel_request':
        // Отмена запроса
        if (currentUserId) {
          cancelEventRequest(id, currentUserId);
        }
        // Возвращаем карточку на место
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
        
      case 'cancel_participation':
        // Отмена участия
        if (currentUserId) {
          cancelEventParticipation(id, currentUserId);
        }
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
        
      case 'cancel_event':
        // Отмена события
        cancelEvent(id);
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
        
      case 'cancel_organizer_participation':
        // Отмена участия организатора
        cancelOrganizerParticipation(id);
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
        
      case 'accepted':
        // Кнопка "уже участвуете" - ничего не делаем
        break;
        
      case 'accept_invite':
        // Раньше принимали сразу. Возвращаем старый UX:
        // переходим в календарь в режим preview с кнопкой "Принять приглашение".
        {
          const isoDateTime = `${date}T${time}:00`;
          const inviteId = inviteRequest?.id;
          router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}${inviteId ? `&inviteId=${inviteId}` : ''}`);
        }
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
    }
  };
  
  const handleSecondaryButtonPress = () => {
    if (!swipeButtons.secondary) return;
    
    switch (swipeButtons.secondary.type) {
      case 'cancel_request':
        if (currentUserId) {
          cancelEventRequest(id, currentUserId);
        }
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
        
      case 'cancel_participation':
        if (currentUserId) {
          cancelEventParticipation(id, currentUserId);
        }
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
        
      case 'cancel_organizer_participation':
        cancelOrganizerParticipation(id);
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
        
      case 'remove_participant':
        // Удаляем участника из события (viewerUserId - это ID участника, чей профиль мы просматриваем)
        if (viewerUserId) {
          removeParticipantFromEvent(id, viewerUserId);
        }
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
        
      case 'cancel_invite':
        // Отклонение приглашения (invited → rejected)
        if (inviteRequest) {
          rejectInvitation(inviteRequest.id).catch(error => {
                          logger.error('Ошибка при отклонении приглашения:', error);
            Alert.alert(t.common.error, t.events.failedToDeclineInvitation || 'Failed to decline invitation');
          });
        }
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        break;
    }
  };
  
  const handleGoPress = () => {
    // Переходим в календарь в режиме предпросмотра на точную дату+время события
    // Передаем ISO-время для автоскролла к нужному часу в week view
    const isoDateTime = `${date}T${time}:00`;
    router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}`);
  };
  
  const handleScheduleEvent = () => {
    // Отправляем заявку на участие в событии (старая логика - сохраняем для совместимости)
    if (!currentUserId) {
      router.push('/(auth)');
      return;
    }
    if (organizerId !== currentUserId) {
      // Если пользователь не организатор - отправляем заявку
      if (currentUserId) {
        sendEventRequest(id, currentUserId);
      }
      setIsJoined(true);
    } else {
      // Если пользователь организатор - добавляем в событие напрямую
      if (currentUserId) {
        updateEvent(id, {
          participants: participants + 1,
          participantsList: [...participantsList, getUserData(currentUserId)?.avatar || ''],
        });
      }
      setIsJoined(true);
    }
    
    // Анимация возврата карточки
    setShowSwipeButtons(false);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    
    // Переходим в календарь
    setTimeout(() => {
      router.push('/calendar');
    }, 300);
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { 
      useNativeDriver: true,
      listener: (event: { nativeEvent: { translationX: number } }) => {
        // Отслеживаем текущее значение свайпа для обновления видимости кнопки
        swipeX.current = event.nativeEvent.translationX;
        // Показываем кнопки если свайпнуто влево более чем на 50px
        if (event.nativeEvent.translationX < -50 && shouldShowSwipeButtons) {
          setShowSwipeButtons(true);
        } else {
          setShowSwipeButtons(false);
        }
      }
    }
  );

  const onHandlerStateChange = (event: { nativeEvent: { state: number; translationX: number; velocityX: number } }) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      // Если свайп влево на достаточное расстояние
      if (shouldShowSwipeButtons && (translationX < -100 || (translationX < -50 && velocityX < -500))) {
        setShowSwipeButtons(true);
        // Вычисляем смещение в зависимости от количества кнопок
        const offset = swipeButtons.secondary ? -240 : -120;
        Animated.spring(translateX, {
          toValue: offset,
          useNativeDriver: true,
        }).start();
      } else {
        // Возвращаем карточку в исходное положение
        setShowSwipeButtons(false);
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Для миниатюрных вариантов не показываем свайп
  if (variant !== 'default') {
    return (
<<<<<<< HEAD
      <TouchableOpacity onPress={() => {
        logger.debug('Miniature card clicked', { hasOnMiniaturePress: !!onMiniaturePress, variant });
        if (onMiniaturePress) {
          logger.debug('Calling onMiniaturePress');
          onMiniaturePress();
        } else {
          logger.debug('No onMiniaturePress handler');
          // Для мини-карточек навигация не нужна - они просто открывают модальное окно
        }
      }}>
        <View style={[
          variant === 'miniature_1' && styles.miniatureCard1,
          variant === 'miniature_2' && styles.miniatureCard2,
          variant === 'chat_preview' && styles.chatPreview
        ]}>
          {/* Фоновое изображение события */}
          {(() => {
            const miniPhoto = event ? (getEventPhotoForUser(id, currentUserId || '', viewerUserId) || event.mediaUrl || organizerAvatar) : (mediaUrl || organizerAvatar);
            // logger.debug('Mini photo:', { miniPhoto, hasEvent: !!event, mediaUrl, variant });
            if (!miniPhoto) {
              logger.debug('No mini photo available, using fallback background');
              return (
                <View style={[styles.miniatureBackgroundContainer, { backgroundColor: '#2a2a2a' }]} />
              );
            }
            return (
              <View style={styles.miniatureBackgroundContainer}>
                <Image 
                  source={{ uri: miniPhoto }} 
                  style={styles.miniatureBackgroundImage}
                  onError={(error) => {
                    // Silently handle image loading errors - fallback background will be shown
                    // Only log in development if needed
                    if (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production') {
                      const errorMsg = error?.nativeEvent?.error || 'Unknown error';
                      logger.warn('Error loading mini photo', { error: errorMsg, url: miniPhoto });
                    }
                  }}
                />
                {mediaType === 'video' && (
                  <View style={styles.miniaturePlayButton}>
                    <Text style={styles.miniaturePlayIcon}>▶️</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Аватарка организатора в правом верхнем углу */}
          {showOrganizerAvatar && (() => {
            const organizerData = getUserData(organizerId);
            return (
              <View style={styles.miniatureOrganizerAvatarContainer}>
                <TouchableOpacity
                  onPress={() => {
                    if (currentUserId === organizerId) {
                      router.push('/(tabs)/profile');
                    } else {
                      router.push(`/profile/${organizerId}`);
                    }
                  }}
                >
                  <Image 
                    source={{ uri: organizerData.avatar }} 
                    style={styles.miniatureOrganizerAvatar} 
                  />
                </TouchableOpacity>
              </View>
            );
          })()}


          {/* Участники в правом нижнем углу - используем displayParticipants из getEventParticipants */}
          {displayParticipants && displayParticipants.length > 0 && (
            <View style={styles.miniatureParticipantsContainer}>
              {displayParticipants.slice(0, 3).map((participant, index) => (
                <Image 
                  key={participant.userId || index}
                  source={{ uri: participant.avatar }} 
                  style={[
                    styles.miniatureParticipantAvatar,
                    { marginLeft: index > 0 ? -8 : 0 }
                  ]} 
                />
              ))}
              {displayParticipants.length > 3 && (
                <View style={[styles.miniatureParticipantAvatar, styles.miniatureMoreParticipants]}>
                  <Text style={styles.miniatureMoreText}>+{displayParticipants.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
=======
      <EventCardMiniature
        id={id}
        title={title}
        organizerId={organizerId}
        organizerAvatar={organizerAvatar}
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        variant={variant}
        showOrganizerAvatar={showOrganizerAvatar}
        onMiniaturePress={onMiniaturePress}
        onLongPress={onLongPress}
        participantsData={displayParticipants}
        viewerUserId={viewerUserId}
      />
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
    );
  }

  // Для обычных карточек с свайп-действием
  return (
    <View style={styles.swipeContainer}>
      {/* Кнопки действий - показываются при свайпе */}
      {showSwipeButtons && swipeButtons.primary && (
        <View style={[
          styles.swipeButtonContainer,
          swipeButtons.secondary && styles.swipeButtonContainerWithSecondary
        ]}>
          {/* Вторая кнопка (нижняя) */}
          {swipeButtons.secondary && (
            <TouchableOpacity 
              style={[
                styles.swipeButton,
                styles.swipeButtonSecondary,
                { backgroundColor: swipeButtons.secondary.color }
              ]} 
              onPress={handleSecondaryButtonPress}
            >
              <Text style={styles.swipeButtonIcon}>{swipeButtons.secondary.icon}</Text>
              {swipeButtons.secondary.label && (
                <Text style={styles.swipeButtonLabel}>{swipeButtons.secondary.label}</Text>
              )}
            </TouchableOpacity>
          )}
          
          {/* Первая кнопка (верхняя) */}
          <TouchableOpacity 
            style={[
              styles.swipeButton,
              { backgroundColor: swipeButtons.primary.color }
            ]} 
            onPress={handlePrimaryButtonPress}
          >
            {swipeButtons.primary.icon && (
              <Text style={styles.swipeButtonIcon}>{swipeButtons.primary.icon}</Text>
            )}
            {swipeButtons.primary.label && (
              <Text style={styles.swipeButtonLabel}>{swipeButtons.primary.label}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Карточка с жестом свайпа */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        shouldCancelWhenOutside={true}
        activeOffsetX={[-10, 10]}
      >
        <Animated.View 
          style={[
            styles.card,
            { transform: [{ translateX }] }
          ]}
          onLayout={(event) => {
            if (onLayout) {
              onLayout(event.nativeEvent.layout.height);
            }
          }}
        >
          {/* Метка "Вас пригласили" - показывается только если пользователь приглашен */}
          {isInvited && variant === 'default' && (
            <View style={styles.invitedLabel}>
              <Text style={styles.invitedLabelText}>Вас пригласили</Text>
            </View>
          )}

          {/* Адаптивная структура в зависимости от формата медиа */}
          {isWideFormat ? (
            /* Горизонтальный формат: медиа слева, контент справа */
            (() => {
              // Вычисляем количество скрытых параметров (без title)
              const hiddenParamsCount = Object.entries(hiddenParameters)
                .filter(([key, value]) => key !== 'title' && value === true).length;
              const photoHeightPercent: string = hiddenParamsCount > 0 
                ? `${100 + (hiddenParamsCount * 10)}%` 
                : '100%';
              
              return (
                <View style={styles.horizontalLayout}>
                  {displayMediaUrl && (
                    <TouchableOpacity 
                      style={[
                        styles.mediaContainerHorizontal,
                        { height: photoHeightPercent as any }
                      ]}
                      onPress={() => {
                        const originalUrl = originalMediaUrl || event?.originalMediaUrl || displayMediaUrl;
                        if (originalUrl) {
                          setShowImageModal(true);
                        }
                      }}
                      activeOpacity={0.9}
                    >
                      <Image 
                        source={{ uri: displayMediaUrl }} 
                        style={styles.mediaImageHorizontal} 
                      />
                      {/* Метки (теги) - поверх фото сверху слева */}
                      {finalTags.length > 0 && (context !== 'memories' || tagsVisible) && (
                        <View style={styles.tagsContainerOverlay}>
                          {finalTags.map((tag, index) => (
                            <View key={index} style={styles.tagBadge}>
                              <Text style={styles.tagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {mediaType === 'video' && (
                        <View style={styles.playButton}>
                          <Text style={styles.playIcon}>▶️</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  
                  <View style={styles.contentContainer}>
                    {/* Название события - всегда видимо, нельзя скрыть */}
                    <TouchableOpacity onPress={() => {
                      const url = viewerUserId 
                        ? `/event-profile/${id}?viewerUserId=${viewerUserId}`
                        : `/event-profile/${id}`;
                      router.push(url);
                    }} style={styles.titleContainer}>
                      <View style={styles.titleWithPostsContainer}>
                        <Text style={styles.title} numberOfLines={1}>
                          {title || 'Название события'}
                        </Text>
                        {(() => {
                          const postsCount = eventProfile?.posts?.length || 0;
                          return (
                            <Text style={styles.postsCount}>
                              {postsCount} {postsCount === 1 ? 'post' : 'posts'}
                            </Text>
                          );
                        })()}
                      </View>
                    </TouchableOpacity>
                    
                    {renderParameterWithOverlay('description', (
                      <Text style={styles.description} numberOfLines={3}>
                        {description || 'Описание события'}
                      </Text>
                    ), hiddenParameters.description)}
                    
                    {/* Параметры */}
                    <View style={styles.parametersContainer}>
                      {renderParameterWithOverlay('price', (
                        <TouchableOpacity onPress={handlePricePress} style={styles.parameterItem}>
                          <Text style={styles.parameterEmoji}>💰</Text>
                          <Text style={styles.parameterText}>{price || '0₽'}</Text>
                        </TouchableOpacity>
                      ), hiddenParameters.price)}
                      
                      {renderParameterWithOverlay('date', (
                        <TouchableOpacity onPress={handleDatePress} style={styles.parameterItem}>
                          <Text style={styles.parameterEmoji}>📅</Text>
                          <Text style={styles.parameterText}>
                            {(() => {
                              const targetEvent = event || events.find(e => e.id === id);
                              return (targetEvent?.isRecurring)
                                ? formatRecurringEventDate(targetEvent, language || 'ru')
                                : (displayDate || date || 'Дата');
                            })()}
                          </Text>
                        </TouchableOpacity>
                      ), hiddenParameters.date)}
                      
                      {renderParameterWithOverlay('time', (
                        <TouchableOpacity onPress={handleTimePress} style={styles.parameterItem}>
                          <Text style={styles.parameterEmoji}>🕐</Text>
                          <Text style={styles.parameterText}>{time || 'Время'}</Text>
                        </TouchableOpacity>
                      ), hiddenParameters.time)}
                      
                      {renderParameterWithOverlay('location', (
                        isOnlineEvent ? (
                          <View style={styles.parameterItem}>
                            <Text style={styles.parameterEmoji}>📍</Text>
                            <Text style={styles.parameterText} numberOfLines={1}>Онлайн</Text>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={handleLocationPress} style={styles.parameterItem}>
                            <Text style={styles.parameterEmoji}>📍</Text>
                            <Text style={styles.parameterText} numberOfLines={1}>{location || 'Место'}</Text>
                          </TouchableOpacity>
                        )
                      ), hiddenParameters.location)}
                      
                      {renderParameterWithOverlay('participants', (
                        <TouchableOpacity onPress={handleParticipantsPress} style={styles.participantsParameterItem}>
                          <View style={styles.participantsMiniAvatars}>
                            {displayParticipants.slice(0, 3).map((participant, index) => (
                              <Image 
                                key={index}
                                source={{ uri: participant.avatar }} 
                                style={[
                                  styles.participantMiniAvatar,
                                  { marginLeft: index > 0 ? -6 : 0 }
                                ]} 
                              />
                            ))}
                            {displayParticipants.length > 3 && (
                              <View style={[styles.participantMiniAvatar, styles.participantMoreMini]}>
                                <Text style={styles.participantMoreMiniText}>+{displayParticipants.length - 3}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.participantsCountText}>{displayParticipants.length}/{maxParticipants}</Text>
                        </TouchableOpacity>
                      ), hiddenParameters.participants)}
                    </View>
                    
                    {/* Динамические аватарки участников */}
                    {showParticipants && displayParticipants.length > 0 && (
                      <View style={styles.participantsAvatars}>
                        {displayParticipants.slice(0, 5).map((participant, index) => (
                          <TouchableOpacity 
                            key={index}
                            onPress={() => handleParticipantPress(participant.userId)}
                            style={styles.participantAvatarContainer}
                          >
                            <Image 
                              source={{ uri: participant.avatar }} 
                              style={styles.participantAvatar} 
                            />
                            {participant.name && (
                              <Text style={styles.participantName}>{participant.name}</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                        {displayParticipants.length > 5 && (
                          <Text style={styles.moreParticipants}>+{displayParticipants.length - 5}</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })()
          ) : (
            /* Вертикальный формат: медиа сверху, контент снизу */
            (() => {
              // Вычисляем количество скрытых параметров (без title)
              const hiddenParamsCount = Object.entries(hiddenParameters)
                .filter(([key, value]) => key !== 'title' && value === true).length;
              const photoHeight = 160 + (hiddenParamsCount * 20);
              const contentPaddingTop = photoHeight; // Контент начинается сразу после фото
              
              return (
                <View style={[styles.verticalLayout, { paddingTop: contentPaddingTop }]}>
                  {displayMediaUrl && (
                    <TouchableOpacity 
                      style={[
                        styles.mediaContainerVertical,
                        { height: photoHeight }
                      ]}
                      onPress={() => {
                        const originalUrl = originalMediaUrl || event?.originalMediaUrl || displayMediaUrl;
                        if (originalUrl) {
                          setShowImageModal(true);
                        }
                      }}
                      activeOpacity={0.9}
                    >
                      <Image 
                        source={{ uri: displayMediaUrl }} 
                        style={styles.mediaImageVertical} 
                      />
                      {/* Метки (теги) - поверх фото сверху слева */}
                      {finalTags.length > 0 && (context !== 'memories' || tagsVisible) && (
                        <View style={styles.tagsContainerOverlay}>
                          {finalTags.map((tag, index) => (
                            <View key={index} style={styles.tagBadge}>
                              <Text style={styles.tagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {mediaType === 'video' && (
                        <View style={styles.playButton}>
                          <Text style={styles.playIcon}>▶️</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  
                  <View style={styles.contentContainer}>
                    {/* Название события - всегда видимо, нельзя скрыть */}
                    <TouchableOpacity onPress={() => {
                      const url = viewerUserId 
                        ? `/event-profile/${id}?viewerUserId=${viewerUserId}`
                        : `/event-profile/${id}`;
                      router.push(url);
                    }} style={styles.titleContainer}>
                      <View style={styles.titleWithPostsContainer}>
                        <Text style={styles.title} numberOfLines={1}>
                          {title || 'Название события'}
                        </Text>
                        {(() => {
                          const postsCount = eventProfile?.posts?.length || 0;
                          return (
                            <Text style={styles.postsCount}>
                              {postsCount} {postsCount === 1 ? 'post' : 'posts'}
                            </Text>
                          );
                        })()}
                      </View>
                    </TouchableOpacity>
                    
                    {renderParameterWithOverlay('description', (
                      <Text style={styles.description} numberOfLines={2}>
                        {description || 'Описание события'}
                      </Text>
                    ), hiddenParameters.description)}

                    {/* Параметры */}
                    <View style={styles.parametersContainer}>
                      {renderParameterWithOverlay('price', (
                        <TouchableOpacity onPress={handlePricePress} style={styles.parameterItem}>
                          <Text style={styles.parameterEmoji}>💰</Text>
                          <Text style={styles.parameterText}>{price || '0₽'}</Text>
                        </TouchableOpacity>
                      ), hiddenParameters.price)}
                      
                      {renderParameterWithOverlay('date', (
                        <TouchableOpacity onPress={handleDatePress} style={styles.parameterItem}>
                          <Text style={styles.parameterEmoji}>📅</Text>
                          <Text style={styles.parameterText}>
                            {(() => {
                              const targetEvent = event || events.find(e => e.id === id);
                              return (targetEvent?.isRecurring)
                                ? formatRecurringEventDate(targetEvent, language || 'ru')
                                : (displayDate || date || 'Дата');
                            })()}
                          </Text>
                        </TouchableOpacity>
                      ), hiddenParameters.date)}
                      
                      {renderParameterWithOverlay('time', (
                        <TouchableOpacity onPress={handleTimePress} style={styles.parameterItem}>
                          <Text style={styles.parameterEmoji}>🕐</Text>
                          <Text style={styles.parameterText}>{time || 'Время'}</Text>
                        </TouchableOpacity>
                      ), hiddenParameters.time)}
                      
                      {renderParameterWithOverlay('location', (
                        isOnlineEvent ? (
                          <View style={styles.parameterItem}>
                            <Text style={styles.parameterEmoji}>📍</Text>
                            <Text style={styles.parameterText} numberOfLines={1}>Онлайн</Text>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={handleLocationPress} style={styles.parameterItem}>
                            <Text style={styles.parameterEmoji}>📍</Text>
                            <Text style={styles.parameterText} numberOfLines={1}>{location || 'Место'}</Text>
                          </TouchableOpacity>
                        )
                      ), hiddenParameters.location)}
                      
                      {renderParameterWithOverlay('participants', (
                        <TouchableOpacity onPress={handleParticipantsPress} style={styles.participantsParameterItem}>
                          <View style={styles.participantsMiniAvatars}>
                            {displayParticipants.slice(0, 3).map((participant, index) => (
                              <Image 
                                key={index}
                                source={{ uri: participant.avatar }} 
                                style={[
                                  styles.participantMiniAvatar,
                                  { marginLeft: index > 0 ? -6 : 0 }
                                ]} 
                              />
                            ))}
                            {displayParticipants.length > 3 && (
                              <View style={[styles.participantMiniAvatar, styles.participantMoreMini]}>
                                <Text style={styles.participantMoreMiniText}>+{displayParticipants.length - 3}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.participantsCountText}>{displayParticipants.length}/{maxParticipants}</Text>
                        </TouchableOpacity>
                      ), hiddenParameters.participants)}
                    </View>
                    
                    {/* Динамические аватарки участников */}
                    {showParticipants && displayParticipants.length > 0 && (
                      <View style={styles.participantsAvatars}>
                        {displayParticipants.slice(0, 5).map((participant, index) => (
                          <TouchableOpacity 
                            key={index}
                            onPress={() => handleParticipantPress(participant.userId)}
                            style={styles.participantAvatarContainer}
                          >
                            <Image 
                              source={{ uri: participant.avatar }} 
                              style={styles.participantAvatar} 
                            />
                            {participant.name && (
                              <Text style={styles.participantName}>{participant.name}</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                        {displayParticipants.length > 5 && (
                          <Text style={styles.moreParticipants}>+{displayParticipants.length - 5}</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })()
          )}
          
          {/* Три точки для действий с событием - в правом нижнем углу карточки */}
          {shouldShowThreeDots && (
            <TouchableOpacity 
              style={styles.eventActionsButton}
              onPress={(e) => {
                e.stopPropagation();
                logger.debug('Три точки нажаты, открываем модальное окно');
                setShowEventActionsModal(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.eventActionsButtonText}>⋯</Text>
            </TouchableOpacity>
          )}
          
          {/* Кнопка "Сохранить" в режиме редактирования видимости параметров */}
          {shouldShowSaveButton && (
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={async (e) => {
                e.stopPropagation();
                // Выходим из режима редактирования
                setIsEditingParameterVisibility(false);
                // Сохраняем скрытые параметры в профиль события
                if (event && updateEventProfile) {
                  try {
                    await updateEventProfile(id, {
                      hiddenParameters: hiddenParameters
                    });
                  } catch (error) {
                    logger.error('Failed to save hidden parameters:', error);
                  }
                }
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.saveButtonText}>{t.common.save}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </PanGestureHandler>
      
      {/* Аватарка организатора в правом верхнем углу - вынесена за пределы карточки */}
      {showOrganizerAvatar && (() => {
        const organizerData = getUserData(organizerId);
        return (
          <View style={styles.organizerAvatarContainer}>
            <TouchableOpacity
              onPress={() => {
                if (currentUserId === organizerId) {
                  router.push('/(tabs)/profile');
                } else {
                  router.push(`/profile/${organizerId}`);
                }
              }}
            >
              <Image 
                source={{ uri: organizerData.avatar }} 
                style={styles.organizerAvatar} 
                />
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Модальное окно с участниками */}
      <ParticipantsModal
        visible={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        eventId={id}
      />

      {/* Форма жалобы */}
      <ComplaintForm
        visible={showComplaintForm}
        onClose={() => setShowComplaintForm(false)}
        type="EVENT"
        reportedEventId={id}
      />

      {/* Модальное окно действий с событием */}
      <EventCardActionsModal
        visible={showEventActionsModal}
<<<<<<< HEAD
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEventActionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowEventActionsModal(false)}
          />
          <View style={styles.actionsModalContainer}>
            <View style={styles.actionsModalHeader}>
              <Text style={styles.actionsModalTitle}>{t.common.actions}</Text>
              <TouchableOpacity onPress={() => setShowEventActionsModal(false)}>
                <Text style={styles.actionsModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.actionsModalScroll} bounces={false}>
              {eventActions.map((action, index) => (
                <TouchableOpacity 
                  key={action.id}
                  style={[
                    styles.actionItem,
                    index === eventActions.length - 1 && styles.actionItemLast
                  ]}
                  onPress={() => {
                    if (action.id === 'share') {
                      // Открываем модальное окно для выбора чатов
                      setSelectedShareChats([]);
                      setShareSearchQuery('');
                      setShowShareModal(true);
                      setShowEventActionsModal(false);
                    } else if (action.isClickable && action.id === 'change_photo') {
                      handleChangePhotoFromModal();
                    } else if (action.isClickable && action.id === 'accept_invite') {
                      // Переход в календарь в режим preview с кнопкой "Принять приглашение"
                      const isoDateTime = `${date}T${time}:00`;
                      const inviteId = inviteRequest?.id;
                      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}${inviteId ? `&inviteId=${inviteId}` : ''}`);
                      setShowEventActionsModal(false);
                    } else if (action.isClickable && action.id === 'cancel_invite') {
                      // Отклонение приглашения (invited → rejected)
                      if (inviteRequest) {
                        rejectInvitation(inviteRequest.id).catch(error => {
                          logger.error('Ошибка при отклонении приглашения:', error);
                          Alert.alert(t.common.error, t.events.failedToDeclineInvitation || 'Failed to decline invitation');
                        });
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_request') {
                      // Отмена запроса (waiting → non_member)
                      if (currentUserId) {
                        cancelEventRequest(id, currentUserId);
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_participation') {
                      // Отмена участия (accepted → non_member)
                      if (currentUserId) {
                        cancelEventParticipation(id, currentUserId);
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_event') {
                      // Отмена события (organizer, ≤2 участников)
                      cancelEvent(id);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_organizer_participation') {
                      // Отмена участия организатора (organizer, >2 участников)
                      cancelOrganizerParticipation(id);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'view_requests') {
                      // Переход в "Мои запросы"
                      router.push('/(tabs)/inbox');
                      setShowEventActionsModal(false);
                    } else if (action.id === 'schedule') {
                      // Для регулярных событий показываем модальное окно со списком дат
                      if (event?.isRecurring) {
                        setShowRecurringDatesModal(true);
                        setShowEventActionsModal(false);
                      } else {
                        // Переход в календарь для планирования
                        const isoDateTime = `${date}T${time}:00`;
                        router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${id}`);
                        setShowEventActionsModal(false);
                      }
                    } else if (action.id === 'extend_recurring') {
                      // Продление регулярного события - переход на страницу создания с редактированием дат
                      setShowEventActionsModal(false);
                      router.push(`/(tabs)/create?eventId=${id}`);
                    } else if (action.id === 'change_parameters') {
                      // Изменение параметров события (для организатора)
                      router.push(`/create?eventId=${id}`);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'remove_participant') {
                      // Удаление участника (для организатора)
                      if (viewerUserId) {
                        removeParticipantFromEvent(id, viewerUserId);
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'hide_parameters') {
                      // Вход в режим редактирования видимости параметров
                      setIsEditingParameterVisibility(true);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'save') {
                      // Сохранение/удаление события из сохраненных
                      if (isEventSaved(id)) {
                        removeSavedEvent(id);
                        Alert.alert('Готово', 'Событие удалено из сохраненных');
                      } else {
                        saveEvent(id);
                        Alert.alert('Готово', 'Событие сохранено');
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'report') {
                      // Открываем форму жалобы
                      setShowEventActionsModal(false);
                      setShowComplaintForm(true);
                    } else if (action.id === 'toggle_tags') {
                      // Переключение видимости меток
                      setTagsVisible(!tagsVisible);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'delete_event') {
                      // Удаление события
                      Alert.alert(
                        t.events.deleteEvent || 'Удалить событие',
                        t.events.deleteEventConfirm || 'Вы уверены, что хотите удалить это событие?',
                        [
                          {
                            text: t.common.cancel || 'Отмена',
                            style: 'cancel',
                            onPress: () => setShowEventActionsModal(false),
                          },
                          {
                            text: t.events.deleteEvent || 'Удалить',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const event = events.find(e => e.id === id);
                                if (event && isEventPast(event)) {
                                  // Для прошедших событий (Memories) удаляем локально без API
                                  // Событие удаляется только для текущего пользователя
                                  // Для остальных участников карточка и профиль события остаются
                                  logger.debug(`Удаляем прошедшее событие ${id} локально (только для текущего пользователя)`);
                                  await deleteEvent(id);
                                  setShowEventActionsModal(false);
                                } else {
                                  // Для будущих событий удаляем полностью через API
                                  await deleteEvent(id);
                                  setShowEventActionsModal(false);
                                }
                              } catch (error) {
                                logger.error('Error deleting event:', error);
                                Alert.alert(t.common.error || 'Ошибка', t.events.deleteError || 'Не удалось удалить событие');
                              }
                            },
                          },
                        ]
                      );
                    } else {
                      // Для остальных действий пока просто закрываем модальное окно
                      setShowEventActionsModal(false);
                    }
                  }}
                  activeOpacity={action.isClickable ? 0.7 : 1}
                  disabled={!action.isClickable}
                >
                  <Text style={[
                    styles.actionItemText,
                    !action.isClickable && styles.actionItemTextDisabled
                  ]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
=======
        actions={eventActions}
        onClose={() => setShowEventActionsModal(false)}
        onActionPress={handleActionPressWithPhoto}
      />
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)

      {/* Модальное окно для выбора чатов и друзей для отправки события */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.shareModalOverlay}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>{t.events.shareEvent}</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Text style={styles.shareModalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Поле поиска */}
            <TextInput
              style={styles.shareModalSearchInput}
              placeholder={t.events.searchChatsAndFriends}
              placeholderTextColor="#999"
              value={shareSearchQuery}
              onChangeText={setShareSearchQuery}
            />
            
            {/* Список чатов и друзей */}
            <ScrollView style={styles.shareModalScrollView}>
              {/* Чаты */}
              <Text style={styles.shareModalSectionTitle}>Чаты</Text>
<<<<<<< HEAD
              {(currentUserId ? getChatsForUser(currentUserId) : [])
=======
              {getChatsForUser(currentUserId || '')
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
                .filter(chat => 
                  chat.name.toLowerCase().includes(shareSearchQuery.toLowerCase())
                )
                .map(chat => (
                  <TouchableOpacity
                    key={chat.id}
                    style={styles.shareModalItem}
                    onPress={() => {
                      const isSelected = selectedShareChats.includes(chat.id);
                      if (isSelected) {
                        setSelectedShareChats(prev => prev.filter(id => id !== chat.id));
                      } else {
                        setSelectedShareChats(prev => [...prev, chat.id]);
                      }
                    }}
                  >
                    <Image
                      source={{ 
                        uri: chat.avatar || (
                          chat.type === 'event' 
                            ? events.find(e => e.id === chat.eventId)?.mediaUrl 
                            : (() => {
                                // Для личных чатов: находим аватарку другого участника (не текущего пользователя)
                                const otherParticipant = chat.participants.find(p => p !== currentUserId);
                                return otherParticipant ? getUserData(otherParticipant)?.avatar : 'https://randomuser.me/api/portraits/women/22.jpg';
                              })()
                        ) 
                      }}
                      style={styles.shareModalAvatar}
                    />
                    <View style={styles.shareModalItemInfo}>
                      <Text style={styles.shareModalItemName}>{chat.name}</Text>
                      <Text style={styles.shareModalItemSubtext}>
                        {chat.type === 'event' ? 'Чат события' : 'Личный чат'}
                      </Text>
                    </View>
                    <Text style={styles.shareModalCheckbox}>
                      {selectedShareChats.includes(chat.id) ? '☑' : '☐'}
                    </Text>
                  </TouchableOpacity>
                ))}
              
              {/* Друзья (создаем личные чаты) */}
              <Text style={styles.shareModalSectionTitle}>Друзья</Text>
              {getFriendsList()
                .filter(friend => 
                  friend.name.toLowerCase().includes(shareSearchQuery.toLowerCase()) ||
                  friend.username.toLowerCase().includes(shareSearchQuery.toLowerCase())
                )
                .map(friend => {
                  // Находим существующий личный чат
<<<<<<< HEAD
                  const existingChat = currentUserId ? getChatsForUser(currentUserId).find(
=======
                  const existingChat = getChatsForUser(currentUserId || '').find(
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
                    chat => chat.type === 'personal' && chat.participants.includes(friend.id)
                  ) : undefined;
                  const chatId = existingChat ? existingChat.id : null;
                  // Используем friend.id как ключ для отслеживания выбранных друзей
                  const friendKey = `friend_${friend.id}`;
                  const isSelected = selectedShareChats.includes(friendKey) || (chatId && selectedShareChats.includes(chatId));
                  
                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={styles.shareModalItem}
                      onPress={async () => {
                        let targetChatId = chatId;
                        // Если чата нет, создаем его
                        if (!targetChatId) {
                          try {
                            targetChatId = await createPersonalChat(friend.id);
                          } catch (error) {
                            logger.error('Failed to create personal chat', error);
                            return; // Не продолжаем, если не удалось создать чат
                          }
                        }
                        
                        // Используем chatId для выбора, но также отслеживаем через friendKey
                        const isCurrentlySelected = selectedShareChats.includes(targetChatId) || selectedShareChats.includes(friendKey);
                        
                        if (isCurrentlySelected) {
                          // Удаляем и chatId, и friendKey на случай, если были добавлены оба
                          setSelectedShareChats(prev => prev.filter(id => id !== targetChatId && id !== friendKey));
                        } else {
                          // Добавляем chatId (удаляем friendKey, если он был)
                          if (targetChatId) {
                            setSelectedShareChats(prev => [...prev.filter(id => id !== friendKey), targetChatId]);
                          }
                        }
                      }}
                    >
                      <Image
                        source={{ uri: friend.avatar }}
                        style={styles.shareModalAvatar}
                      />
                      <View style={styles.shareModalItemInfo}>
                        <Text style={styles.shareModalItemName}>{friend.name}</Text>
                        <Text style={styles.shareModalItemSubtext}>@{friend.username}</Text>
                      </View>
                      <Text style={styles.shareModalCheckbox}>
                        {isSelected ? '☑' : '☐'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
            
            {/* Кнопка отправки */}
            <TouchableOpacity
              style={[
                styles.shareModalSendButton,
                selectedShareChats.filter(chatId => !chatId.startsWith('friend_')).length === 0 && styles.shareModalSendButtonDisabled
              ]}
              onPress={() => {
                // Фильтруем только валидные chatId (не friendKey)
                const validChatIds = selectedShareChats.filter(chatId => !chatId.startsWith('friend_'));
                if (validChatIds.length > 0) {
                  sendEventToChats(id, validChatIds);
                  setShowShareModal(false);
                  setSelectedShareChats([]);
                  setShareSearchQuery('');
                }
              }}
              disabled={selectedShareChats.filter(chatId => !chatId.startsWith('friend_')).length === 0}
            >
              <Text style={styles.shareModalSendButtonText}>
                Отправить ({selectedShareChats.filter(chatId => !chatId.startsWith('friend_')).length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно для добавления события в папку */}
      <Modal
        visible={showAddToFolderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAddToFolderModal(false);
          setSelectedFolderIds(new Set());
        }}
      >
        <View style={styles.shareModalOverlay}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>Добавить в папку</Text>
              <TouchableOpacity onPress={() => {
                setShowAddToFolderModal(false);
                setSelectedFolderIds(new Set());
              }}>
                <Text style={styles.shareModalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Список папок */}
            <ScrollView style={styles.shareModalScrollView}>
              {eventFolders && Array.isArray(eventFolders) && eventFolders.length > 0 ? (
                eventFolders.map((folder: any) => {
                  const isSelected = selectedFolderIds.has(folder.id);
                  // Проверяем, не находится ли уже событие в этой папке
                  const isEventInFolder = folder.events?.some((e: any) => e.id === id) || false;
                  
                  return (
                    <TouchableOpacity
                      key={folder.id}
                      style={[
                        styles.shareModalItem,
                        isEventInFolder && styles.shareModalItemDisabled
                      ]}
                      onPress={() => {
                        if (!isEventInFolder) {
                          const newSelected = new Set(selectedFolderIds);
                          if (newSelected.has(folder.id)) {
                            newSelected.delete(folder.id);
                          } else {
                            newSelected.add(folder.id);
                          }
                          setSelectedFolderIds(newSelected);
                        }
                      }}
                      disabled={isEventInFolder}
                    >
                      <Image
                        source={{ 
                          uri: folder.coverPhotoUrl || folder.events?.[0]?.mediaUrl || 'https://via.placeholder.com/40'
                        }}
                        style={styles.shareModalAvatar}
                      />
                      <View style={styles.shareModalItemInfo}>
                        <Text style={styles.shareModalItemName}>{folder.name}</Text>
                        <Text style={styles.shareModalItemSubtext}>
                          {folder.eventCount || folder.events?.length || 0} {folder.eventCount === 1 || folder.events?.length === 1 ? 'событие' : 'событий'}
                          {isEventInFolder && ' • Уже в папке'}
                        </Text>
                      </View>
                      <Text style={styles.shareModalCheckbox}>
                        {isEventInFolder ? '✓' : (isSelected ? '☑' : '☐')}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.shareModalEmptyText}>У вас пока нет папок</Text>
              )}
            </ScrollView>
            
            {/* Кнопка подтверждения */}
            <TouchableOpacity
              style={[
                styles.shareModalSendButton,
                selectedFolderIds.size === 0 && styles.shareModalSendButtonDisabled
              ]}
              onPress={async () => {
                if (selectedFolderIds.size > 0) {
                  try {
                    for (const folderId of selectedFolderIds) {
                      await addEventToFolder(folderId, id);
                    }
                    Alert.alert('Готово', `Событие добавлено в ${selectedFolderIds.size} ${selectedFolderIds.size === 1 ? 'папку' : 'папок'}`);
                    setShowAddToFolderModal(false);
                    setSelectedFolderIds(new Set());
                  } catch (error) {
                    Alert.alert('Ошибка', 'Не удалось добавить событие в папку');
                  }
                }
              }}
              disabled={selectedFolderIds.size === 0}
            >
              <Text style={styles.shareModalSendButtonText}>
                Добавить ({selectedFolderIds.size})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно для выбора дат регулярного события */}
      <Modal
        visible={showRecurringDatesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRecurringDatesModal(false)}
      >
        <View style={styles.shareModalOverlay}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>{(t.events as any).selectDate || 'Выберите дату'}</Text>
              <TouchableOpacity
                onPress={() => setShowRecurringDatesModal(false)}
              >
                <Text style={styles.shareModalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.shareModalList}>
              {event && event.isRecurring && (() => {
                const allDates = getAllRecurringDates(event);
                const futureDates = allDates.filter(d => !d.isPast);
                const pastDates = allDates.filter(d => d.isPast);
                
                return (
                  <>
                    {/* Будущие даты */}
                    {futureDates.length > 0 && (
                      <>
                        <Text style={styles.recurringDatesSectionTitle}>{(t.events as any).upcomingDates || 'Предстоящие даты'}</Text>
                        {futureDates.map((dateItem, index) => {
                          const dateObj = new Date(dateItem.date);
                          const day = dateObj.getDate().toString().padStart(2, '0');
                          const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                          const year = dateObj.getFullYear().toString().substring(2);
                          const formattedDate = `${day}.${month}.${year}`;
                          const isScheduled = eventRequests.some(req => 
                            req.eventId === id && 
                            req.status === 'pending' &&
                            req.type === 'join' &&
                            req.fromUserId === currentUserId
                          );
                          
                          return (
                            <TouchableOpacity
                              key={`future-${index}`}
                              style={styles.recurringDateItem}
                              onPress={async () => {
                                if (!currentUserId) {
                                  router.push('/(auth)');
                                  return;
                                }
                                try {
<<<<<<< HEAD
                                  if (currentUserId) {
                                    await sendEventRequest(id, currentUserId);
                                    Alert.alert(t.common.success || 'Успешно', t.events.requestSent || 'Запрос отправлен');
                                  }
=======
                                  await sendEventRequest(id, currentUserId);
                                  Alert.alert(t.common.success || 'Успешно', (t.events as any).requestSent || 'Запрос отправлен');
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
                                } catch (error) {
                                  logger.error('Failed to send event request', error);
                                  Alert.alert(t.common.error || 'Ошибка', (t.events as any).failedToSendRequest || 'Не удалось отправить запрос');
                                }
                              }}
                              disabled={isScheduled}
                            >
                              <Text style={styles.recurringDateText}>{formattedDate}</Text>
                              <Text style={styles.recurringDateTime}>{time}</Text>
                              {isScheduled ? (
                                <Text style={styles.recurringDateStatus}>⏱ {(t.events as any).requestPending || 'Запрос отправлен'}</Text>
                              ) : (
                                <Text style={styles.recurringDateButton}>{t.events.schedule || 'Запланировать'}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                        
                        {/* Кнопка "Запланировать все даты" */}
                        {futureDates.length > 1 && (
                          <TouchableOpacity
                            style={[styles.recurringDateItem, styles.scheduleAllButton]}
                            onPress={async () => {
                              if (!currentUserId) {
                                router.push('/(auth)');
                                return;
                              }
                              try {
                                // Отправляем запросы на все будущие даты
                                for (const dateItem of futureDates) {
                                  try {
                                    if (currentUserId) {
                                      await sendEventRequest(id, currentUserId);
                                    }
                                  } catch (error) {
                                    logger.warn(`Failed to send request for date ${dateItem.date}`, error);
                                  }
                                }
                                Alert.alert(t.common.success || 'Успешно', (t.events as any).allRequestsSent || 'Запросы на все даты отправлены');
                                setShowRecurringDatesModal(false);
                              } catch (error) {
                                logger.error('Failed to send all event requests', error);
                                Alert.alert(t.common.error || 'Ошибка', (t.events as any).failedToSendRequests || 'Не удалось отправить запросы');
                              }
                            }}
                          >
                            <Text style={styles.scheduleAllButtonText}>
                              {(t.events as any).scheduleAllDates || 'Запланировать все даты'} ({futureDates.length})
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    
                    {/* Прошедшие даты (опционально, для информации) */}
                    {pastDates.length > 0 && (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production') && (
                      <>
                        <Text style={[styles.recurringDatesSectionTitle, { opacity: 0.5, marginTop: 20 } as any]}>
                          {(t.events as any).pastDates || 'Прошедшие даты'} ({pastDates.length})
                        </Text>
                      </>
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Модальное окно для передачи роли организатора */}
      <Modal
        visible={showTransferOrganizerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTransferOrganizerModal(false)}
      >
        <View style={styles.shareModalOverlay}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>Передать роль организатора</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTransferOrganizerModal(false);
                  setSelectedNewOrganizerId(null);
                }}
              >
                <Text style={styles.shareModalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.transferOrganizerDescription}>
              Выберите участника, которому хотите передать роль организатора. После передачи вы больше не будете организатором этого события.
            </Text>
            
            {/* Кнопка для отмены события без передачи роли */}
            <TouchableOpacity
              style={[styles.shareModalSendButton, styles.cancelEventButton]}
              onPress={() => {
                Alert.alert(
                  t.events.cancelEvent || 'Отменить событие',
                  'Вы уверены, что хотите отменить это событие?',
                  [
                    {
                      text: t.common.cancel || 'Отмена',
                      style: 'cancel'
                    },
                    {
                      text: t.events.cancelEvent || 'Отменить',
                      style: 'destructive',
                      onPress: () => {
                        cancelEvent(id);
                        setShowTransferOrganizerModal(false);
                        setSelectedNewOrganizerId(null);
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.shareModalSendButtonText}>
                {t.events.cancelEvent || 'Отменить событие'}
              </Text>
            </TouchableOpacity>
            
            <ScrollView style={styles.shareModalList}>
              {(() => {
                // Получаем список участников (исключая текущего организатора)
                const participants = getEventParticipants ? getEventParticipants(id) : [];
                const otherParticipants = participants.filter(pId => pId !== organizerId && pId !== currentUserId);
                
                if (otherParticipants.length === 0) {
                  return (
                    <View style={styles.emptyParticipantsContainer}>
                      <Text style={styles.emptyParticipantsText}>
                        Нет других участников для передачи роли
                      </Text>
                    </View>
                  );
                }
                
                return otherParticipants.map((participantId) => {
                  const participantData = getUserData(participantId);
                  const isSelected = selectedNewOrganizerId === participantId;
                  
                  return (
                    <TouchableOpacity
                      key={participantId}
                      style={[
                        styles.shareModalItem,
                        isSelected && styles.shareModalItemSelected
                      ]}
                      onPress={() => setSelectedNewOrganizerId(participantId)}
                    >
                      <Image
                        source={{ uri: participantData?.avatar || 'https://randomuser.me/api/portraits/women/68.jpg' }}
                        style={styles.shareModalAvatar}
                      />
                      <View style={styles.shareModalItemInfo}>
                        <Text style={styles.shareModalItemName}>
                          {participantData?.name || participantData?.username || 'Пользователь'}
                        </Text>
                        {participantData?.username && participantData.username !== participantData?.name && (
                          <Text style={styles.shareModalItemSubtext}>
                            @{participantData.username}
                          </Text>
                        )}
                      </View>
                      <View style={styles.shareModalCheckbox}>
                        <Text style={styles.shareModalCheckboxText}>{isSelected ? '☑' : '☐'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
            
            <TouchableOpacity
              style={[
                styles.shareModalSendButton,
                !selectedNewOrganizerId && styles.shareModalSendButtonDisabled
              ]}
              onPress={async () => {
                if (!selectedNewOrganizerId) return;
                
                try {
                  // Вызываем функцию передачи роли организатора
                  if (transferOrganizerRole) {
                    await transferOrganizerRole(id, selectedNewOrganizerId);
                    Alert.alert(
                      'Успешно',
                      'Роль организатора успешно передана',
                      [
                        {
                          text: 'OK',
                          onPress: () => {
                            setShowTransferOrganizerModal(false);
                            setSelectedNewOrganizerId(null);
                          }
                        }
                      ]
                    );
                  } else {
                    Alert.alert('Ошибка', 'Функция передачи роли не доступна');
                  }
                } catch (error) {
                  logger.error('Failed to transfer organizer role', error);
                  Alert.alert('Ошибка', 'Не удалось передать роль организатора');
                }
              }}
              disabled={!selectedNewOrganizerId}
            >
              <Text style={styles.shareModalSendButtonText}>
                Передать роль
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно для просмотра оригинального фото */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <TouchableOpacity 
          style={styles.imageModalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageModal(false)}
        >
          <View style={styles.imageModalContent}>
            <TouchableOpacity 
              style={styles.imageModalCloseButton}
              onPress={() => setShowImageModal(false)}
            >
              <Text style={styles.imageModalCloseText}>✕</Text>
            </TouchableOpacity>
            {(() => {
              const originalUrl = originalMediaUrl || event?.originalMediaUrl || displayMediaUrl;
              return originalUrl ? (
                <Image 
                  source={{ uri: originalUrl }} 
                  style={styles.imageModalImage}
                  resizeMode="contain"
                />
              ) : null;
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// Используем стили из отдельного файла и добавляем стили для модальных окон
const styles = {
  ...eventCardStyles,
  ...StyleSheet.create({
  // Стили для модального окна участников
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '90%',
    maxHeight: '70%',
    padding: 20,
  },
  modalScrollView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  participantsList: {
    maxHeight: 400,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  participantModalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantModalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  participantUsername: {
    fontSize: 14,
    color: '#666666',
  },
  // Стили для трех точек и модального окна действий
  eventActionsButton: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 10,
    padding: 8,
  },
  eventActionsButtonText: {
    fontSize: 20,
    color: '#999999',
    fontWeight: 'bold',
  },
  actionsModalContent: {
    // legacy (no longer used)
    backgroundColor: '#1a1a1a',
  },
  actionsModalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '88%',
    maxHeight: '60%',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  actionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionsModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsModalClose: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionsModalScroll: {
    maxHeight: '100%',
  },
  actionItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionItemText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  actionItemTextDisabled: {
    color: '#888',
    opacity: 0.6,
  },
  // Метка "Вас пригласили"
  invitedLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 20,
  },
  invitedLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  // Стили для модального окна "Поделиться"
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  shareModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  shareModalCloseButton: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  shareModalSearchInput: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#2a2a2a',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  shareModalScrollView: {
    maxHeight: 400,
  },
  shareModalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  transferOrganizerDescription: {
    color: '#DDD',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  emptyParticipantsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyParticipantsText: {
    color: '#999',
    fontSize: 14,
  },
  shareModalItemSelected: {
    backgroundColor: '#2A2A2A',
    borderColor: '#8B5CF6',
    borderWidth: 2,
  },
  shareModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  shareModalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  shareModalItemInfo: {
    flex: 1,
  },
  shareModalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shareModalItemSubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  shareModalCheckbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalCheckboxText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  shareModalSendButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  shareModalSendButtonDisabled: {
    backgroundColor: '#333333',
    opacity: 0.5,
  },
  shareModalSendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelEventButton: {
    backgroundColor: '#FF3B30',
    marginBottom: 12,
  },
  shareModalEmptyText: {
    color: '#999999',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  shareModalItemDisabled: {
    opacity: 0.5,
  },
  shareModalList: {
    maxHeight: 400,
  },
  recurringDatesSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    marginTop: 16,
    marginBottom: 8,
  },
  recurringDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 8,
  },
  recurringDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  recurringDateTime: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 12,
  },
  recurringDateButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    marginLeft: 12,
  },
  recurringDateStatus: {
    fontSize: 12,
    color: '#FF9500',
    marginLeft: 12,
  },
  scheduleAllButton: {
    backgroundColor: '#8B5CF6',
    marginTop: 16,
  },
  scheduleAllButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  imageModalImage: {
    width: '100%',
    height: '100%',
  },
  saveButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  parameterWrapper: {
    position: 'relative',
  },
  parameterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  parameterOverlayHidden: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  eyeIcon: {
    fontSize: 24,
  },
  titleContainer: {
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  titleWithPostsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postsCount: {
    fontSize: 11,
    color: '#AAAAAA',
    fontStyle: 'italic',
  },
  hiddenElement: {
    display: 'none',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  tagsContainerOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 10,
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#2A1A3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  tagText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  }),
};