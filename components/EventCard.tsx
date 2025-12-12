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
  onLayout?: (height: number) => void; // колбэк для передачи высоты карточки
  viewerUserId?: string; // ID участника, через профиль которого смотрят событие (для третьих лиц)
  context?: 'explore' | 'memories' | 'other_profile' | 'own_profile';
  tags?: string[]; // Метки (теги) события
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
  onLayout,
  viewerUserId,
  context = 'explore', // По умолчанию контекст explore
  tags = [],
}: EventCardProps) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const [tagsVisible, setTagsVisible] = useState(true); // Состояние для видимости меток в memories
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
    deleteEvent,
    removeParticipantFromEvent,
    eventRequests,
    respondToEventRequest,
    getChatsForUser,
    getFriendsList,
    sendEventToChats,
    createPersonalChat,
    saveEvent,
    removeSavedEvent,
    isEventSaved,
    rejectInvitation,
    updateEventProfile
  } = useEvents();
  
  // Получаем событие из контекста
  const event = useMemo(() => events.find(e => e.id === id), [events, id]);
  
  // Загружаем из профиля события при монтировании
  const eventProfile = useMemo(() => {
    const foundEvent = events.find(e => e.id === id);
    return foundEvent ? getEventProfile(id) : null;
  }, [events, id, getEventProfile]);
  
  const [showParticipants, setShowParticipants] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showEventActionsModal, setShowEventActionsModal] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [selectedShareChats, setSelectedShareChats] = useState<string[]>([]);
  const [showRecurringDatesModal, setShowRecurringDatesModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  // Состояние для режима редактирования видимости параметров (только для прошедших событий в меморис)
  const [isEditingParameterVisibility, setIsEditingParameterVisibility] = useState(false);
  const [hiddenParameters, setHiddenParameters] = useState<Record<string, boolean>>(
    (eventProfile as any)?.hiddenParameters || {}
  );
  
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
  
  const { t, language } = useLanguage();
  
  // Отладочная информация для тегов
  const allTags = tags && tags.length > 0 ? tags : (event?.tags && event.tags.length > 0 ? event.tags : []);
  if (allTags.length > 0 && (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production')) {
    logger.debug(`Tags for event ${id}:`, { allTags, tagsProp: tags, eventTags: event?.tags });
  }
  
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
  
  // Функция для получения текста кнопки сохранения
  const getSaveButtonLabel = () => {
    return isEventSaved(id) ? t.events.removeFromSaved : t.events.save;
  };
  
  // Определяем список действий для меню трех точек
  const getEventActions = () => {
    if (!event) return [];
    
    const actions: Array<{ id: string; label: string; action?: () => void; isClickable?: boolean }> = [];
    
    // ЛЕНТЫ EXPLORE (GLOB/FRIENDS)
    if (context === 'explore') {
      if (isPast) {
        // Прошедшее время - не может быть в explore
        return [];
      }
      
      // Предстоящее время
      // 🎯 ПРИОРИТЕТ 1: Приглашение (invited)
      if (relationship === 'invited') {
        actions.push({ id: 'accept_invite', label: t.events.acceptInvitation, isClickable: true });
        actions.push({ id: 'cancel_invite', label: t.events.cancelInvitation, isClickable: true });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 2: В ожидании (waiting)
      else if (relationship === 'waiting') {
        actions.push({ id: 'view_requests', label: t.events.viewRequests });
        actions.push({ id: 'cancel_request', label: t.events.cancelRequest });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
      }
      // ПРИОРИТЕТ 3: Участник (accepted) - не может быть в explore (скрыто)
      else if (relationship === 'accepted') {
        return [];
      }
      // ПРИОРИТЕТ 4: Организатор (organizer)
        else if (relationship === 'organizer') {
          actions.push({ id: 'change_parameters', label: t.events.changeParameters, isClickable: true });
        if (participantsCount <= 2) {
            actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true });
            actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
        } else {
            actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true });
            actions.push({ id: 'cancel_organizer_participation', label: t.events.cancelParticipation, isClickable: true });
        }
        // Действие "продлить" для регулярных событий
        if (event.isRecurring) {
          actions.push({ id: 'extend_recurring', label: t.events.extendRecurring || 'Продлить', isClickable: true });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
      }
      // ПРИОРИТЕТ 5: Не член (non_member)
      else if (relationship === 'non_member') {
        actions.push({ id: 'schedule', label: t.events.schedule });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 6: Отклонен (rejected) - не показываем действия
      else if (relationship === 'rejected') {
        return [];
      }
    }
    
    // ПРОФИЛЬ ДРУГОГО ЧЕЛОВЕКА
    else if (context === 'other_profile') {
      if (isPast) {
        // Прошедшее время (раздел Memories) - БЕЗ КНОПОК ПО СВАЙПУ
        if (relationship === 'accepted') {
          // Я участник
          actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility });
          actions.push({ id: 'change_photo', label: t.events.changePhoto, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        } else if (relationship === 'organizer') {
          // Я организатор
          actions.push({ id: 'hide_parameters', label: 'Скрыть параметры', isClickable: true });
          actions.push({ id: 'change_visibility', label: 'Изменить видимость' });
          actions.push({ id: 'change_photo', label: 'Изменить фото для себя', isClickable: true });
          actions.push({ id: 'share', label: 'Поделиться', isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        } else {
          // Я не член
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        }
      } else {
        // Предстоящее время
        // 🎯 ПРИОРИТЕТ 1: Приглашение (invited)
        if (relationship === 'invited') {
          actions.push({ id: 'accept_invite', label: t.events.acceptInvitation, isClickable: true });
          actions.push({ id: 'cancel_invite', label: t.events.cancelInvitation, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        }
        // ПРИОРИТЕТ 2: В ожидании (waiting)
        else if (relationship === 'waiting') {
          actions.push({ id: 'view_requests', label: t.events.viewRequests });
          actions.push({ id: 'cancel_request', label: t.events.cancelRequest });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        }
        // ПРИОРИТЕТ 3: Участник (accepted)
        else if (relationship === 'accepted') {
          actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        }
        // ПРИОРИТЕТ 4: Организатор (organizer)
        else if (relationship === 'organizer') {
          actions.push({ id: 'change_parameters', label: t.events.changeParameters, isClickable: true });
          if (participantsCount <= 2) {
            actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
          } else {
            actions.push({ id: 'cancel_organizer_participation', label: t.events.cancelParticipation, isClickable: true });
          }
          actions.push({ id: 'remove_participant', label: t.events.removeParticipant, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        }
        // ПРИОРИТЕТ 5: Не член (non_member)
        else if (relationship === 'non_member') {
          actions.push({ id: 'schedule', label: t.events.schedule });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
          actions.push({ id: 'report', label: t.events.report, isClickable: true });
        }
        // ПРИОРИТЕТ 6: Отклонен (rejected) - не показываем действия
        else if (relationship === 'rejected') {
          return [];
        }
      }
    }
    
    // МОЙ ПРОФИЛЬ
    else if (context === 'own_profile') {
      if (isPast) {
        // Прошедшее время (раздел Memories) - БЕЗ КНОПОК ПО СВАЙПУ
        if (relationship === 'accepted') {
          // Раздел Участник
          actions.push({ id: 'hide_parameters', label: 'Скрыть параметры', isClickable: true });
          actions.push({ id: 'change_photo', label: 'Изменить фото для себя', isClickable: true });
          actions.push({ id: 'change_visibility', label: 'Изменить видимость' });
          actions.push({ id: 'delete_event', label: t.events.deleteEvent || 'Удалить', isClickable: true });
          actions.push({ id: 'share', label: 'Поделиться', isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        } else if (relationship === 'organizer') {
          // Раздел Организатор
          actions.push({ id: 'hide_parameters', label: 'Скрыть параметры', isClickable: true });
          actions.push({ id: 'change_photo', label: 'Изменить фото для себя', isClickable: true });
          actions.push({ id: 'change_visibility', label: 'Изменить видимость' });
          actions.push({ id: 'delete_event', label: t.events.deleteEvent || 'Удалить', isClickable: true });
          actions.push({ id: 'share', label: 'Поделиться', isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        }
      } else {
        // Предстоящее время
        // Раздел Участник
        if (relationship === 'accepted') {
          actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation });
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        }
        // Раздел Организатор
        else if (relationship === 'organizer') {
          actions.push({ id: 'change_parameters', label: t.events.changeParameters, isClickable: true });
          if (participantsCount <= 2) {
            actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
          } else {
            actions.push({ id: 'cancel_organizer_participation', label: t.events.cancelParticipation, isClickable: true });
          }
          actions.push({ id: 'change_visibility', label: t.events.changeVisibility, isClickable: true });
          actions.push({ id: 'share', label: t.events.share, isClickable: true });
          actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
        }
      }
    }
    
    // РАЗДЕЛ MEMORIES (прошедшие события)
    else if (context === 'memories') {
      if (isPast) {
        // Прошедшее время в разделе Memories
        actions.push({ 
          id: 'toggle_tags', 
          label: tagsVisible ? (t.events.hideTags || 'Скрыть метки') : (t.events.showTags || 'Показать метки'), 
          isClickable: true 
        });
        // Удалить событие (только если я организатор или участник)
        if (relationship === 'organizer' || relationship === 'accepted') {
          actions.push({ 
            id: 'delete_event', 
            label: t.events.deleteEvent || 'Удалить', 
            isClickable: true 
          });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: getSaveButtonLabel(), isClickable: true });
      }
    }
    
    return actions;
  };
  
  const eventActions = getEventActions();
  
  // Определяем, нужно ли показывать три точки (если есть хотя бы одно действие)
  // В режиме редактирования видимости параметров показываем кнопку "Сохранить" вместо трех точек
  const shouldShowThreeDots = eventActions.length > 0 && variant === 'default' && !isEditingParameterVisibility;
  const shouldShowSaveButton = isEditingParameterVisibility && variant === 'default' && isPast;
  
  // Определяем какие кнопки показывать в зависимости от контекста, роли и статуса
  const getSwipeButtons = () => {
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
        if (participantsCount <= 2) {
          // Отменить событие (красная кнопка)
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
          // Отменить участие (красная кнопка)
          return {
            primary: {
              type: 'cancel_organizer_participation',
              label: t.events.cancelParticipation,
              color: '#FF3B30',
              icon: '✕'
            },
            secondary: null
          };
        }
      } else if (context === 'other_profile') {
        // В профиле другого человека (раздел участник) - две кнопки
        // Первая: отменить событие или отменить участие (в зависимости от количества)
        // Вторая: удалить участника
        const primaryButton = participantsCount <= 2
          ? {
              type: 'cancel_event',
              label: t.events.cancelEvent,
              color: '#FF3B30',
              icon: '✕'
            }
          : {
              type: 'cancel_organizer_participation',
              label: t.events.cancelParticipation,
              color: '#FF3B30',
              icon: '✕'
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
        if (participantsCount <= 2) {
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
              type: 'cancel_organizer_participation',
              label: t.events.cancelParticipation,
              color: '#FF3B30',
              icon: '✕'
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
  const handleChangePhotoFromModal = () => {
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
  };


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
  if (variant !== 'default' || !showSwipeAction) {
    // console.log('🟢 Rendering miniature card:', { variant, showSwipeAction, id, title });
    return (
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
              const photoHeightPercent = hiddenParamsCount > 0 
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
                      {allTags.length > 0 && tagsVisible && (
                        <View style={styles.tagsContainerOverlay}>
                          {allTags.map((tag, index) => (
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
                      <Text style={styles.title} numberOfLines={1}>
                        {title || 'Название события'}
                      </Text>
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
                      {allTags.length > 0 && tagsVisible && (
                        <View style={styles.tagsContainerOverlay}>
                          {allTags.map((tag, index) => (
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
                      <Text style={styles.title} numberOfLines={1}>
                        {title || 'Название события'}
                      </Text>
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
      <Modal
        visible={showEventActionsModal}
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
              {(currentUserId ? getChatsForUser(currentUserId) : [])
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
                  const existingChat = currentUserId ? getChatsForUser(currentUserId).find(
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
                          setSelectedShareChats(prev => [...prev.filter(id => id !== friendKey), targetChatId]);
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
              <Text style={styles.shareModalTitle}>{t.events.selectDate || 'Выберите дату'}</Text>
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
                        <Text style={styles.recurringDatesSectionTitle}>{t.events.upcomingDates || 'Предстоящие даты'}</Text>
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
                                  if (currentUserId) {
                                    await sendEventRequest(id, currentUserId);
                                    Alert.alert(t.common.success || 'Успешно', t.events.requestSent || 'Запрос отправлен');
                                  }
                                } catch (error) {
                                  logger.error('Failed to send event request', error);
                                  Alert.alert(t.common.error || 'Ошибка', t.events.failedToSendRequest || 'Не удалось отправить запрос');
                                }
                              }}
                              disabled={isScheduled}
                            >
                              <Text style={styles.recurringDateText}>{formattedDate}</Text>
                              <Text style={styles.recurringDateTime}>{time}</Text>
                              {isScheduled ? (
                                <Text style={styles.recurringDateStatus}>⏱ {t.events.requestPending || 'Запрос отправлен'}</Text>
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
                                Alert.alert(t.common.success || 'Успешно', t.events.allRequestsSent || 'Запросы на все даты отправлены');
                                setShowRecurringDatesModal(false);
                              } catch (error) {
                                logger.error('Failed to send all event requests', error);
                                Alert.alert(t.common.error || 'Ошибка', t.events.failedToSendRequests || 'Не удалось отправить запросы');
                              }
                            }}
                          >
                            <Text style={styles.scheduleAllButtonText}>
                              {t.events.scheduleAllDates || 'Запланировать все даты'} ({futureDates.length})
                            </Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    
                    {/* Прошедшие даты (опционально, для информации) */}
                    {pastDates.length > 0 && (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production') && (
                      <>
                        <Text style={[styles.recurringDatesSectionTitle, { opacity: 0.5, marginTop: 20 }]}>
                          {t.events.pastDates || 'Прошедшие даты'} ({pastDates.length})
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

const styles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  swipeButtonContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -30 }],
    zIndex: 1,
    alignItems: 'center',
  },
  swipeButtonContainerWithSecondary: {
    transform: [{ translateY: -60 }], // Смещаем вверх, если две кнопки
  },
  swipeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 10, // Отступ между кнопками
  },
  swipeButtonSecondary: {
    marginBottom: 0, // Для нижней кнопки отступ не нужен
  },
  swipeButtonIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  swipeButtonLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  goButtonContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -30 }],
    zIndex: 1,
  },
  goButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  goButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 0,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'visible', // Аватарка теперь снаружи карточки
    minHeight: 350, // Минимальная высота для лучшего отображения контента
  },
  organizerAvatarContainer: {
    position: 'absolute',
    top: -15, // Слегка выходим за пределы карточки вверх
    right: -15, // Слегка выходим за пределы карточки вправо
    zIndex: 10,
  },
  organizerAvatar: {
    width: 80, // Уменьшаем в 1.5 раза: 120 / 1.5 = 80
    height: 80,
    borderRadius: 40,
    borderWidth: 0, // Убираем белую рамку
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  horizontalLayout: {
    flexDirection: 'row',
    paddingTop: 40,
    paddingBottom: 15,
    paddingLeft: 140, // Отступ для фото слева
    position: 'relative',
  },
  verticalLayout: {
    flexDirection: 'column',
    paddingTop: 170,
    paddingBottom: 15,
    position: 'relative',
  },
  mediaContainerHorizontal: {
    width: 120,
    height: '100%',
    marginRight: 12,
    borderRadius: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  mediaContainerVertical: {
    width: '100%',
    height: 160,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  mediaImageHorizontal: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaImageVertical: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 18,
    marginBottom: 8,
  },
  parametersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  parameterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  parameterEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  parameterText: {
    fontSize: 12,
    color: '#DDDDDD',
    fontWeight: '500',
  },
  participantsAvatars: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  participantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
  },
  participantAvatarContainer: {
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  participantName: {
    fontSize: 10,
    color: '#AAAAAA',
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 60,
  },
  moreParticipants: {
    fontSize: 12,
    color: '#AAAAAA',
    alignSelf: 'center',
    marginLeft: 4,
  },
  // Стили для мини-аватаров участников в параметрах
  participantsParameterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  participantsMiniAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  participantMiniAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 0.5,
    borderColor: '#FFFFFF',
  },
  participantMoreMini: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantMoreMiniText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  participantsCountText: {
    fontSize: 12,
    color: '#DDDDDD',
    fontWeight: '500',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  // Миниатюрные варианты для профилей
  miniatureCard1: {
    width: '100%', // Ширина задается динамически через родительский View
    height: 110, // Фиксированная высота
    borderRadius: 12,
    overflow: 'visible', // Изменяем на visible для больших аватарок
    position: 'relative',
    backgroundColor: '#2a2a2a',
    marginBottom: 10,
    marginTop: 5,
  },
  miniatureCard2: {
    width: 100, // Уменьшил с 140 до 100 для трех колонок
    height: 100, // Уменьшил с 140 до 100 для трех колонок
    borderRadius: 12,
    overflow: 'visible', // Изменяем на visible для больших аватарок
    position: 'relative',
    backgroundColor: '#2a2a2a',
    marginBottom: 10,
    marginTop: 5,
  },
  chatPreview: {
    width: '100%',
    minWidth: 200,
    height: 100,
    minHeight: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  chatPreviewTitleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  chatPreviewTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Стили для фонового изображения мини-карточки
  miniatureBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12, // Скругление углов как у карточки
    overflow: 'hidden', // Обрезаем содержимое по скругленным углам
  },
  miniatureBackgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 12, // Скругление углов изображения
  },
  miniatureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12, // Скругление углов как у карточки
  },
  miniaturePlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniaturePlayIcon: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  // Аватарка организатора для мини-карточки
  miniatureOrganizerAvatarContainer: {
    position: 'absolute',
    top: -8, // Слегка выходим за пределы мини-карточки вверх
    right: -8, // Слегка выходим за пределы мини-карточки вправо
    zIndex: 10,
  },
  miniatureOrganizerAvatar: {
    width: 32, // Уменьшил с 48 до 32 пропорционально
    height: 32,
    borderRadius: 16,
    borderWidth: 0, // Убираем белую рамку
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  // Участники для мини-карточки
  miniatureParticipantsContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  miniatureParticipantAvatar: {
    width: 18, // Одинаковый размер с обычной карточкой
    height: 18,
    borderRadius: 9,
    borderWidth: 0.5, // Более тонкая обводка
    borderColor: '#FFFFFF',
  },
  miniatureMoreParticipants: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniatureMoreText: {
    color: '#FFFFFF',
    fontSize: 8, // Меньший шрифт для "+n" на мини-карточке
    fontWeight: 'bold',
  },
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
  },
  eventActionsButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
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
});