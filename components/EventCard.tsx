import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, Modal, ScrollView, Alert, InteractionManager, TextInput, Platform, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useRef, useEffect, useCallback, useMemo, memo, createElement } from 'react';
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
import { LazyImage } from './ui/LazyImage';
import { useEventCardActions } from '../hooks/events/useEventCardActions';
import EventCardActionsModal from './EventCard/EventCardActionsModal';
import EventCardMiniature from './EventCard/EventCardMiniature';
import { AppIcon, AppIconName } from './ui/AppIcon';
import { Palette, Radius } from '../constants/DesignSystem';

const logger = createLogger('EventCard');

/** Реальное фото пользователя; пусто / заглушки из API → data-URI SVG. */
const SWIPE_ICON_MAP: Record<string, AppIconName> = {
  '✓': 'check',
  '✕': 'close',
  '🗑️': 'trash',
  // Эмодзи часов выглядело инородно среди line-иконок — берём Feather clock
  '⏱': 'clock',
  '⏳': 'clock',
};

function renderCheckbox(checked: boolean | string | null | undefined) {
  return checked ? (
    <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center' }}>
      <AppIcon name="check" size={12} color="#1a0d00" />
    </View>
  ) : (
    <View style={{ width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: Palette.line }} />
  );
}

function renderSwipeIcon(glyph: string | undefined, color: string = '#f4f4f5') {
  if (!glyph) return null;
  const name = SWIPE_ICON_MAP[glyph];
  if (name) return <AppIcon name={name} size={22} color={color} />;
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

function organizerAvatarUri(uri: string | undefined): string | null {
  const u = (uri ?? '').trim();
  if (!u || u === 'null' || u === 'undefined') return null;
  if (!/^https?:\/\//i.test(u)) return null;
  if (u.includes('cdn.jsdelivr.net/gh/identicons')) return null;
  if (u.includes('ui-avatars.com')) return null;
  return u;
}

/** Серый круг с силуэтом — работает в TG/VK WebView, где emoji/Text могут не рисоваться. */
const ORGANIZER_AVATAR_PLACEHOLDER_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="69" height="69" viewBox="0 0 69 69">' +
    '<circle cx="34.5" cy="34.5" r="33" fill="#5a5a5a"/>' +
    '<circle cx="34.5" cy="26.5" r="9.5" fill="#c4c4c4"/>' +
    '<ellipse cx="34.5" cy="52" rx="15" ry="11" fill="#c4c4c4"/>' +
    '</svg>',
)}`;

/** Серый плейсхолдер 16:9 для обложек событий. */
const EVENT_MEDIA_PLACEHOLDER_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="608" viewBox="0 0 1080 608">' +
    '<defs>' +
      '<linearGradient id="g" x1="0" x2="1" y1="0" y2="1">' +
        '<stop offset="0" stop-color="#2a2a2a"/>' +
        '<stop offset="1" stop-color="#141414"/>' +
      '</linearGradient>' +
    '</defs>' +
    '<rect width="1080" height="608" rx="24" ry="24" fill="url(#g)"/>' +
    '<circle cx="540" cy="260" r="72" fill="#3a3a3a"/>' +
    '<circle cx="540" cy="235" r="28" fill="#8e8e8e"/>' +
    '<path d="M470 358c18-46 51-68 70-68s52 22 70 68" fill="#8e8e8e"/>' +
    '<text x="540" y="456" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="34" fill="#9a9a9a">no cover</text>' +
  '</svg>',
)}`;

const organizerAvatarButtonStyles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

function OrganizerAvatarButton({
  remoteUri,
  onPress,
  style,
  imageNativeId,
}: {
  remoteUri: string | null;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  imageNativeId: string;
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [remoteUri]);

  const uri = remoteUri && !loadFailed ? remoteUri : ORGANIZER_AVATAR_PLACEHOLDER_URI;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <View style={[style, organizerAvatarButtonStyles.frame]}>
        <Image
          nativeID={imageNativeId}
          source={{ uri }}
          style={organizerAvatarButtonStyles.image}
          resizeMode="cover"
          onError={() => {
            if (remoteUri) setLoadFailed(true);
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

function useImageFallbackUri(primaryUri: string | undefined, fallbackUri: string) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [primaryUri]);

  return {
    uri: !primaryUri || failed ? fallbackUri : primaryUri,
    onError: () => setFailed(true),
  };
}

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

function EventCard({
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

  const event = useMemo(() => {
    return events.find(e => e.id === id);
  }, [events, id]);
  
  // Получаем профиль события из контекста (более надежно, чем getEventProfile)
  const eventProfile = useMemo(() => {
    return eventProfiles.find(p => p.eventId === id) || null;
  }, [eventProfiles, id]);
  
  // Загружаем профиль события автоматически, если его нет.
  // НЕ загружаем профиль для preview-событий (они временные и не имеют профиля на сервере).
  // НЕ загружаем в контексте explore/other_profile — в ленте может быть 20+ карточек,
  // и каждая порождала бы отдельный HTTP-запрос (N+1). Профиль загрузится,
  // когда пользователь откроет страницу события.
  const loadingProfileRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // В explore и other_profile карточек на экране много — не грузим профили по одному.
    if (context === 'explore' || context === 'other_profile') return;

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
  }, [event, eventProfile, fetchEventProfile, id, context]);
  
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
  // Состояние разворачивания описания
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const initialHiddenParameters = useMemo(() => (eventProfile as any)?.hiddenParameters || {}, [eventProfile]);
  const [hiddenParameters, setHiddenParameters] = useState<Record<string, boolean>>(initialHiddenParameters);
  
  // Синхронизируем скрытые параметры при изменении профиля события
  useEffect(() => {
    if (eventProfile && (eventProfile as any).hiddenParameters) {
      setHiddenParameters((eventProfile as any).hiddenParameters);
    }
  }, [eventProfile]);
  const translateX = useRef(new Animated.Value(0)).current;
  // Bounce animation for save/bookmark action (Task 2a)
  const saveScaleAnim = useRef(new Animated.Value(1)).current;
  const animateSaveBounce = useCallback(() => {
    Animated.sequence([
      Animated.spring(saveScaleAnim, { toValue: 1.3, useNativeDriver: true, speed: 50 }),
      Animated.spring(saveScaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
  }, [saveScaleAnim]);
  const [isJoined, setIsJoined] = useState(false);
  const [showSwipeButtons, setShowSwipeButtons] = useState(false);
  const swipeX = useRef(0); // Отслеживаем текущее значение свайпа
  
  const { t, language } = useLanguage();
  
  // Отладочная информация для тегов
  const allTags = tags && tags.length > 0 ? tags : (event?.tags && event.tags.length > 0 ? event.tags : []);

  
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
          color: Palette.danger,
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
          color: Palette.success,
          icon: '✓'
        },
        secondary: {
          type: 'cancel_invite',
          label: t.events.cancelInvitation,
          color: Palette.danger,
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
              color: Palette.danger,
              icon: '✕'
            },
            secondary: null
          };
        } else {
          // Отменить событие (красная кнопка) - при нажатии покажется попап с transfer organizer role
          return {
            primary: {
              type: 'cancel_event',
              label: t.events.cancelEvent,
              color: Palette.danger,
              icon: '✕'
            },
            secondary: null
          };
        }
      } else if (context === 'other_profile') {
        // В профиле другого человека (раздел участник) - две кнопки
        // Первая: отменить событие или передать роль (в зависимости от количества участников)
        // Вторая: удалить участника
        // Всегда показываем кнопку "Отменить событие" - при нажатии покажется попап с transfer organizer role
        const primaryButton = {
              type: 'cancel_event',
              label: t.events.cancelEvent,
              color: Palette.danger,
              icon: '✕'
            };
        
        return {
          primary: primaryButton,
          secondary: {
              type: 'remove_participant',
            label: t.events.removeParticipant,
            color: Palette.danger,
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
              color: Palette.danger,
              icon: '✕'
            },
            secondary: null
          };
        } else {
          // Отменить событие (красная кнопка) - при нажатии покажется попап с transfer organizer role
          return {
            primary: {
              type: 'cancel_event',
              label: t.events.cancelEvent,
              color: Palette.danger,
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
          color: Palette.danger,
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
            color: Palette.danger,
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
            color: Palette.success,
            icon: '✓'
          },
          secondary: {
            type: 'cancel_participation',
            label: 'Отменить участие',
            color: Palette.danger,
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
            color: '#FF8D32',
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

  const { width: windowWidth } = useWindowDimensions();
  const eventMedia = useImageFallbackUri(displayMediaUrl, EVENT_MEDIA_PLACEHOLDER_URI);
  
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

  // Обработка отмены события с поддержкой веба
  const handleCancelEvent = useCallback(async (eventId: string) => {
    try {
      logger.info('Отмена события:', eventId);
      await cancelEvent(eventId);
      
      // На вебе показываем сообщение через console, так как Alert может не работать
      if (Platform.OS === 'web') {
        // На вебе можно обновить страницу или показать уведомление
        if (typeof window !== 'undefined') {
          // Опционально: можно добавить toast-уведомление
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else {
        Alert.alert('Событие отменено', 'Событие было успешно отменено');
      }
    } catch (error: any) {
      logger.error('Ошибка при отмене события:', error);
      const errorMessage = error?.message || 'Не удалось отменить событие';
      
      if (Platform.OS === 'web') {
        console.error('Ошибка отмены события:', errorMessage);
        alert(`Ошибка: ${errorMessage}`);
      } else {
        Alert.alert('Ошибка', errorMessage);
      }
    }
  }, [cancelEvent]);

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
        handleCancelEvent(id);
        setShowEventActionsModal(false);
      }
    } else if (actionId === 'view_requests') {
      router.push('/(tabs)/inbox');
      setShowEventActionsModal(false);
    } else if (actionId === 'go_to_chat') {
      const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === id && c.type === 'event');
      if (eventChat) {
        router.push(`/(tabs)/inbox/${eventChat.id}`);
        setShowEventActionsModal(false);
      } else {
        Alert.alert('Ошибка', 'Чат события не найден');
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
      animateSaveBounce();
      if (isEventSaved(id)) {
        removeSavedEvent(id);
        Alert.alert('Готово', 'Событие удалено из сохраненных');
      } else {
        saveEvent(id, event);
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
      // На вебе используем window.confirm, на мобильных - Alert.alert
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(t.events.deleteEventConfirm || 'Вы уверены, что хотите удалить это событие?');
        if (confirmed) {
          (async () => {
            try {
              const event = events.find(e => e.id === id);
              if (event && isEventPast(event)) {
                logger.debug(`Отменяем участие в прошедшем событии ${id} (событие остается для других участников)`);
                if (currentUserId) {
                  await cancelEventParticipation(id, currentUserId);
                }
                setShowEventActionsModal(false);
                // Обновляем страницу на вебе после удаления
                if (typeof window !== 'undefined') {
                  setTimeout(() => {
                    window.location.reload();
                  }, 500);
                }
              } else {
                await deleteEvent(id);
                setShowEventActionsModal(false);
                // Обновляем страницу на вебе после удаления
                if (typeof window !== 'undefined') {
                  setTimeout(() => {
                    window.location.reload();
                  }, 500);
                }
              }
            } catch (error) {
              logger.error('Error deleting event:', error);
              alert(t.events.deleteError || 'Не удалось удалить событие');
            }
          })();
        } else {
          setShowEventActionsModal(false);
        }
      } else {
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
      }
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
    handleCancelEvent,
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
        // Отмена события - если участников больше 1, показываем попап с transfer organizer role
        const participantsCount = getEventParticipants(id).length;
        if (participantsCount > 1) {
          setShowTransferOrganizerModal(true);
          setShowSwipeButtons(false);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          // Если участник только организатор, просто отменяем событие
          handleCancelEvent(id);
          setShowSwipeButtons(false);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
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

  // Для веба: обработка touch и mouse событий
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDragging = useRef(false);
  const lastMoveX = useRef<number | null>(null);
  const lastMoveTime = useRef<number | null>(null);
  const mouseDown = useRef(false);

  const handleWebTouchStart = useCallback((e: any) => {
    if (!shouldShowSwipeButtons || Platform.OS !== 'web') return;
    const touch = e.touches?.[0] || e;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    lastMoveX.current = touch.clientX;
    lastMoveTime.current = Date.now();
    isDragging.current = false;
    if (!e.touches) {
      // Это mouse событие
      mouseDown.current = true;
    }
  }, [shouldShowSwipeButtons]);

  const handleWebTouchMove = useCallback((e: any) => {
    if (!shouldShowSwipeButtons || Platform.OS !== 'web' || touchStartX.current === null) return;
    
    // Для mouse событий проверяем, что кнопка мыши нажата
    if (!e.touches && (!mouseDown.current || e.buttons === 0)) return;
    
    const touch = e.touches?.[0] || e;
    const deltaX = touch.clientX - (touchStartX.current || 0);
    const deltaY = Math.abs((touch.clientY || 0) - (touchStartY.current || 0));
    
    // Проверяем, что это горизонтальный свайп, а не вертикальный скролл
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault?.();
      e.stopPropagation?.();
      isDragging.current = true;
      
      // Обновляем позицию только для свайпа влево
      if (deltaX < 0) {
        swipeX.current = deltaX;
        translateX.setValue(deltaX);
        
        // Показываем кнопки если свайпнуто влево более чем на 50px
        if (deltaX < -50) {
          setShowSwipeButtons(true);
        } else {
          setShowSwipeButtons(false);
        }
      }
    }
    
    if (isDragging.current) {
      lastMoveX.current = touch.clientX;
      lastMoveTime.current = Date.now();
    }
  }, [shouldShowSwipeButtons, translateX]);

  const handleWebTouchEnd = useCallback((e: any) => {
    if (!shouldShowSwipeButtons || Platform.OS !== 'web') {
      touchStartX.current = null;
      touchStartY.current = null;
      mouseDown.current = false;
      return;
    }

    if (touchStartX.current === null) {
      mouseDown.current = false;
      return;
    }

    const touch = e.changedTouches?.[0] || e;
    const deltaX = (touch.clientX || lastMoveX.current || 0) - (touchStartX.current || 0);
    const now = Date.now();
    const timeDelta = lastMoveTime.current ? now - lastMoveTime.current : 0;
    const velocityX = timeDelta > 0 && lastMoveX.current !== null 
      ? ((touch.clientX || lastMoveX.current) - lastMoveX.current) / timeDelta * 1000 
      : 0;

    // Если свайп влево на достаточное расстояние
    if (deltaX < -100 || (deltaX < -50 && velocityX < -500)) {
      setShowSwipeButtons(true);
      // Вычисляем смещение в зависимости от количества кнопок
      const offset = swipeButtons.secondary ? -240 : -120;
      Animated.spring(translateX, {
        toValue: offset,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    } else {
      // Возвращаем карточку в исходное положение
      setShowSwipeButtons(false);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    }

    touchStartX.current = null;
    touchStartY.current = null;
    lastMoveX.current = null;
    lastMoveTime.current = null;
    isDragging.current = false;
    mouseDown.current = false;
  }, [shouldShowSwipeButtons, translateX, swipeButtons]);

  // Текущее «зафиксированное» положение карточки: 0 либо offset открытых кнопок.
  // Раньше translationX писался в translateX напрямую, без учёта этого сдвига —
  // поэтому свайп вправо уводил карточку правее нуля, и она ложилась поверх
  // ленты организаторов вместо того, чтобы закрыть кнопки.
  const swipeBase = useRef(0);

  const swipeMinOffset = () => (swipeButtons.secondary ? -240 : -120);

  // Если свайп выключили (например, открылась лента организаторов), карточка
  // не должна остаться сдвинутой — возвращаем её на место и убираем кнопки
  useEffect(() => {
    if (shouldShowSwipeButtons) return;
    swipeBase.current = 0;
    swipeX.current = 0;
    setShowSwipeButtons(false);
    translateX.setValue(0);
  }, [shouldShowSwipeButtons, translateX]);

  const onGestureEvent = Platform.OS === 'web' ? undefined : (event: { nativeEvent: { translationX: number } }) => {
    if (!shouldShowSwipeButtons) return;
    const tx = event.nativeEvent.translationX;
    // Карточка ходит только влево от нуля и не дальше offset кнопок
    const next = Math.min(0, Math.max(swipeMinOffset(), swipeBase.current + tx));
    swipeX.current = next;
    translateX.setValue(next);
    setShowSwipeButtons(next < -20);
  };

  const onHandlerStateChange = Platform.OS === 'web' ? undefined : (event: { nativeEvent: { state: number; translationX: number; velocityX: number } }) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      const offset = swipeMinOffset();
      const current = Math.min(0, Math.max(offset, swipeBase.current + translationX));
      // Открываем, если утащили влево дальше половины хода или резким жестом;
      // во всех остальных случаях — закрываем
      const shouldOpen = shouldShowSwipeButtons &&
        (current <= offset / 2 || (translationX < -50 && velocityX < -500));
      const target = shouldOpen ? offset : 0;

      swipeBase.current = target;
      setShowSwipeButtons(shouldOpen);
      Animated.spring(translateX, {
        toValue: target,
        useNativeDriver: false,
      }).start();
    }
  };

  // Для миниатюрных вариантов не показываем свайп
  if (variant !== 'default') {
    return (

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
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.swipeButton, styles.swipeButtonSecondary]}
                onPress={handleSecondaryButtonPress}
              >
                {renderSwipeIcon(swipeButtons.secondary.icon, swipeButtons.secondary.color)}
              </TouchableOpacity>
              {swipeButtons.secondary.label && (
                <Text style={styles.swipeButtonLabel} numberOfLines={2}>{swipeButtons.secondary.label}</Text>
              )}
            </View>
          )}
          
          {/* Первая кнопка (верхняя) */}
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.swipeButton}
              onPress={handlePrimaryButtonPress}
            >
              {renderSwipeIcon(swipeButtons.primary.icon, swipeButtons.primary.color)}
            </TouchableOpacity>
            {swipeButtons.primary.label && (
              <Text style={styles.swipeButtonLabel} numberOfLines={2}>{swipeButtons.primary.label}</Text>
            )}
          </View>
        </View>
      )}

      {/* Карточка с жестом свайпа */}
      {(() => {
        const cardContent = (
          <>
            {/* Метка "Вас пригласили" - показывается только если пользователь приглашен */}
            {isInvited && variant === 'default' && (
              <View style={styles.invitedLabel}>
                <Text style={styles.invitedLabelText}>Вас пригласили</Text>
              </View>
            )}

            {/* Card layout: Full-bleed image card with gradient overlay (Airbnb-style) — universal for all contexts */}
          {(() => {
              // === UNIVERSAL CARD: Full-bleed image with gradient overlay ===
              const organizerData = getUserData(organizerId);
                const exploreAvatarUrl = organizerAvatarUri(organizerData.avatar);
                const dateText = (() => {
                  const targetEvent = event || events.find(e => e.id === id);
                  return (targetEvent?.isRecurring)
                    ? formatRecurringEventDate(targetEvent, language || 'ru')
                    : (displayDate || date || '');
                })();
                const TAG_LABELS: Record<string, string> = {
                  'age_18_plus': '18+',
                  'age_21_plus': '21+',
                  'age_16_plus': '16+',
                  'women_only': 'women only',
                  'men_only': 'men only',
                  'recurring': 'recurring',
                  'starting_soon': 'starting soon',
                  'массовое': 'массовое',
                  'регулярное': 'recurring',
                };

                return (
                  <TouchableOpacity
                    nativeID={`event-card-hero-${id}`}
                    style={[exploreStyles.exploreCardContainer]}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      const url = viewerUserId
                        ? `/event-profile/${id}?viewerUserId=${viewerUserId}`
                        : `/event-profile/${id}`;
                      router.push(url);
                    }}
                    activeOpacity={0.9}
                  >
                    {/* Image area wrapper — fixed height so absolute children position relative to image */}
                    <View style={{ aspectRatio: 3/4, position: 'relative', overflow: 'hidden', width: '100%' }}>
                      {/* Full-bleed image — web: raw div bypasses RNW CSS class ordering bug */}
                      {Platform.OS === 'web'
                        ? createElement('div', {
                            style: {
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundImage: `url("${eventMedia.uri}")`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            },
                          })
                        : <LazyImage
                            source={{ uri: eventMedia.uri }}
                            style={exploreStyles.exploreImage}
                            onError={eventMedia.onError}
                          />
                      }

                      {/* Organizer avatar + name — top-left */}
                      <TouchableOpacity
                        style={[exploreStyles.exploreOrganizerContainer, { position: 'absolute' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (currentUserId === organizerId) {
                            router.push('/(tabs)/profile');
                          } else {
                            router.push(`/profile/${organizerId}`);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: exploreAvatarUrl || ORGANIZER_AVATAR_PLACEHOLDER_URI }}
                          style={exploreStyles.exploreOrganizerAvatar}
                        />
                        <Text style={exploreStyles.exploreOrganizerName} numberOfLines={1}>
                          {organizerData.name || organizerData.username || ''}
                        </Text>
                      </TouchableOpacity>

                      {/* Tags/badges + participants — top-right */}
                      <View style={[exploreStyles.exploreTagsContainer, { position: 'absolute' }]}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setShowParticipantsModal(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.participantsBadge}>
                            <View style={styles.participantsMiniAvatarsCard}>
                              {displayParticipants.slice(0, 3).map((p, index) => (
                                <Image
                                  key={p.userId}
                                  source={{ uri: p.avatar || ORGANIZER_AVATAR_PLACEHOLDER_URI }}
                                  style={[styles.participantMiniAvatarCard, { marginLeft: index > 0 ? -5 : 0 }]}
                                />
                              ))}
                              {participantsCount > 3 && (
                                <View style={[styles.participantMiniAvatarCard, styles.participantMoreMiniCard, { marginLeft: -5 }]}>
                                  <Text style={styles.participantMoreMiniCardText}>+{participantsCount - 3}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.participantsBadgeText}>
                              {participantsCount}{maxParticipants > 0 ? `/${maxParticipants}` : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        {finalTags.map((tag, index) => (
                          <View key={index} style={styles.tagBadge}>
                            <Text style={styles.tagText}>{TAG_LABELS[tag] || tag}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Invited label */}
                      {isInvited && (
                        <View style={[exploreStyles.exploreInvitedLabel, { position: 'absolute' }]}>
                          <Text style={styles.invitedLabelText}>Вас пригласили</Text>
                        </View>
                      )}

                      {/* Video play button */}
                      {mediaType === 'video' && (
                        <View style={[styles.playButton, { position: 'absolute' }]}>
                          <Text style={styles.playIcon}>▶️</Text>
                        </View>
                      )}

                      {/* Gradient overlay at bottom */}
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.75)']}
                        style={exploreStyles.exploreGradient}
                      >
                        {/* Title */}
                        <Text style={exploreStyles.exploreTitle} numberOfLines={2}>
                          {title || 'Название события'}
                        </Text>

                        {/* Date + Location row */}
                        <View style={exploreStyles.exploreInfoRow}>
                          {dateText ? (
                            <View style={exploreStyles.exploreInfoItem}>
                              <AppIcon name="calendar" size={12} color="rgba(255,255,255,0.8)" />
                              <Text style={exploreStyles.exploreInfoText} numberOfLines={1}>{dateText}</Text>
                            </View>
                          ) : null}
                          {time ? (
                            <View style={exploreStyles.exploreInfoItem}>
                              <AppIcon name="clock" size={12} color="rgba(255,255,255,0.8)" />
                              <Text style={exploreStyles.exploreInfoText}>{time}</Text>
                            </View>
                          ) : null}
                          <View style={exploreStyles.exploreInfoItem}>
                            <AppIcon name="pin" size={12} color="rgba(255,255,255,0.8)" />
                            <Text style={exploreStyles.exploreInfoText} numberOfLines={1}>
                              {isOnlineEvent ? 'Онлайн' : (location || 'Место')}
                            </Text>
                          </View>
                        </View>
                        {description ? (
                          <View style={{ marginTop: 8 }}>
                            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18 }} numberOfLines={descriptionExpanded ? undefined : 2}>
                              {description}
                            </Text>
                            {description.length > 80 && (
                              <TouchableOpacity onPress={(e) => { e.stopPropagation(); setDescriptionExpanded(!descriptionExpanded); }} activeOpacity={0.7}>
                                <Text style={{ fontSize: 13, color: '#FF8D32', fontWeight: '600', marginTop: 4 }}>
                                  {descriptionExpanded ? 'Свернуть' : 'Ещё'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : null}
                      </LinearGradient>

                    </View>
                  </TouchableOpacity>
                );
            })()}
          
            {/* Три точки для действий с событием.
                Позиция bottom:15 right:15 = нижний правый угол карточки,
                не пересекается с медиа-изображением (top:0 h:208) и аватаркой (top-right).
                Работает на всех платформах. */}
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
                <AppIcon name="more" size={18} color={Palette.text} />
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
          </>
        );

        if (Platform.OS === 'web') {
          return (
            <Animated.View
              style={[
                styles.card,
                { transform: [{ translateX }] },
                { cursor: 'grab', userSelect: 'none' as any }
              ]}
              onLayout={(event) => {
                if (onLayout) {
                  onLayout(event.nativeEvent.layout.height);
                }
              }}
              onTouchStart={handleWebTouchStart}
              onTouchMove={handleWebTouchMove}
              onTouchEnd={handleWebTouchEnd}
              onMouseDown={(e: any) => {
                e.preventDefault();
                handleWebTouchStart(e);
              }}
              onMouseMove={(e: any) => {
                if (mouseDown.current) {
                  e.preventDefault();
                  handleWebTouchMove(e);
                }
              }}
              onMouseUp={(e: any) => {
                if (mouseDown.current) {
                  e.preventDefault();
                  handleWebTouchEnd(e);
                }
              }}
              onMouseLeave={(e: any) => {
                if (mouseDown.current) {
                  handleWebTouchEnd(e);
                }
              }}
            >
              {cardContent}
            </Animated.View>
          );
        } else {
          return (
            <PanGestureHandler
              onGestureEvent={onGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
              shouldCancelWhenOutside={true}
              // Карточка забирает только свайп влево (кнопки действий).
              // Свайп вправо раньше тоже перехватывался, но ничего не делал —
              // карточка просто уезжала и возвращалась, а жест не доходил до
              // ленты организаторов. Теперь правое направление уходит наверх.
              // Пока кнопки закрыты — карточка берёт только свайп влево, а правый
              // отдаёт ленте организаторов. Когда кнопки открыты, правый свайп
              // должен закрывать их, иначе он уводил в ленту, а карточка
              // оставалась сдвинутой и накладывалась поверх.
              activeOffsetX={showSwipeButtons ? [-10, 10] : -10}
              failOffsetX={showSwipeButtons ? undefined : 10}
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
                {cardContent}
              </Animated.View>
            </PanGestureHandler>
          );
        }
      })()}

      {/* Organizer avatar is now always rendered inside the card */}

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
        actions={eventActions}
        onClose={() => setShowEventActionsModal(false)}
        onActionPress={handleActionPressWithPhoto}
      />

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
                <AppIcon name="close" size={18} color={Palette.textDim} />
              </TouchableOpacity>
            </View>
            
            {/* Копировать ссылку */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
              onPress={async () => {
                const url = `https://iwent.ru/event-profile/${id}`;
                try {
                  const { Share, Platform } = require('react-native');
                  if (Platform.OS === 'web') {
                    await navigator.clipboard.writeText(url);
                  } else {
                    await Share.share({ message: url, url });
                  }
                } catch {}
              }}
            >
              <AppIcon name="link" size={18} color={Palette.accent} />
              <Text style={{ color: '#f4f4f5', fontSize: 15, fontWeight: '500' }}>Поделиться ссылкой</Text>
            </TouchableOpacity>

            {/* Поле поиска */}
            <TextInput
              style={styles.shareModalSearchInput}
              placeholder={t.events.searchChatsAndFriends}
              placeholderTextColor="rgba(244,244,245,0.35)"
              value={shareSearchQuery}
              onChangeText={setShareSearchQuery}
            />
            
            {/* Список чатов и друзей */}
            <ScrollView style={styles.shareModalScrollView}>
              {/* Чаты */}
              <Text style={styles.shareModalSectionTitle}>Чаты</Text>

              {getChatsForUser(currentUserId || '')
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
                                return otherParticipant ? getUserData(otherParticipant)?.avatar : '';
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
                    {renderCheckbox(selectedShareChats.includes(chat.id))}
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
                      {renderCheckbox(isSelected)}
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
                <AppIcon name="close" size={18} color={Palette.textDim} />
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
                      {(isEventInFolder || isSelected) ? (
                        <AppIcon name="check" size={16} color={Palette.accent} />
                      ) : (
                        <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: Palette.line }} />
                      )}
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
                <AppIcon name="close" size={18} color={Palette.textDim} />
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

                                  await sendEventRequest(id, currentUserId);
                                  Alert.alert(t.common.success || 'Успешно', (t.events as any).requestSent || 'Запрос отправлен');
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
                <AppIcon name="close" size={18} color={Palette.textDim} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.transferOrganizerDescription}>
              Выберите участника, которому хотите передать роль организатора. После передачи вы выйдете из события, а новый организатор будет управлять им.
            </Text>
            
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
                        source={{ uri: participantData?.avatar || '' }}
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
                      {renderCheckbox(isSelected)}
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
                    setShowTransferOrganizerModal(false);
                    setSelectedNewOrganizerId(null);
                    
                    // На вебе обновляем страницу после передачи роли
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    }
                    
                    // После успешной передачи роли данные обновятся через syncEventsFromServer
                    // Событие автоматически исчезнет из календаря и списка участников
                  } else {
                    const errorMsg = 'Функция передачи роли не доступна';
                    if (Platform.OS === 'web') {
                      console.error(errorMsg);
                      alert(`Ошибка: ${errorMsg}`);
                    } else {
                      Alert.alert('Ошибка', errorMsg);
                    }
                  }
                } catch (error: any) {
                  logger.error('Failed to transfer organizer role', error);
                  const errorMessage = error?.message || error?.body?.message || 'Не удалось передать роль организатора';
                  if (Platform.OS === 'web') {
                    console.error('Ошибка передачи роли организатора:', errorMessage);
                    alert(`Ошибка: ${errorMessage}`);
                  } else {
                    Alert.alert('Ошибка', errorMessage);
                  }
                }
              }}
              disabled={!selectedNewOrganizerId}
            >
              <Text style={styles.shareModalSendButtonText}>
                Передать роль и выйти из события
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
              <AppIcon name="close" size={22} color="#fff" />
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

// Мемоизируем компонент — не перерисовывается при изменении родительского state,
// если собственные props не изменились (визуальная скорость экрана explore)
export default memo(EventCard);

// Styles for explore full-bleed card variant (Airbnb Experiences style)
const exploreStyles = StyleSheet.create({
  exploreCardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center' as const,
    position: 'relative',
    backgroundColor: '#141417',
  },
  exploreImage: {
    resizeMode: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  exploreGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  exploreTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 6,
  },
  exploreInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  exploreInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exploreInfoText: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  exploreOrganizerContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    paddingRight: 10,
    paddingVertical: 3,
    paddingLeft: 3,
    zIndex: 10,
    maxWidth: '60%',
  },
  exploreOrganizerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  exploreOrganizerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flexShrink: 1,
  },
  exploreTagsContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 10,
    maxWidth: '35%',
    justifyContent: 'flex-end',
  },
  exploreInvitedLabel: {
    position: 'absolute',
    top: 44,
    left: 10,
    backgroundColor: '#FF8D32',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  exploreSaveBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

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
    backgroundColor: '#141417',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    width: '90%',
    maxWidth: 460,
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
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f4f5',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#f4f4f5',
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
    color: '#f4f4f5',
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
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(20, 20, 24, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  eventActionsButtonText: {
    fontSize: 20,
    color: Palette.text,
    fontWeight: 'bold',
  },
  actionsModalContent: {
    // legacy (no longer used)
    backgroundColor: '#141417',
  },
  actionsModalContainer: {
    backgroundColor: '#141417',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
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
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  actionsModalTitle: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsModalClose: {
    color: '#f4f4f5',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionsModalScroll: {
    maxHeight: '100%',
  },
  actionItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionItemText: {
    color: '#f4f4f5',
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
    backgroundColor: '#FF8D32',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 20,
  },
  invitedLabelText: {
    color: '#0A0A0A',
    fontSize: 11,
    fontWeight: '600',
  },
  // Стили для модального окна "Поделиться"
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  shareModalContent: {
    backgroundColor: '#141417',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 500,
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
    color: '#f4f4f5',
  },
  shareModalCloseButton: {
    fontSize: 24,
    color: '#f4f4f5',
    fontWeight: 'bold',
  },
  shareModalSearchInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#f4f4f5',
    marginBottom: 16,
  },
  shareModalScrollView: {
    maxHeight: 400,
  },
  shareModalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(244,244,245,0.55)',
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
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
  },
  shareModalItemSelected: {
    backgroundColor: 'rgba(255,141,50,0.10)',
    borderColor: '#FF8D32',
    borderWidth: 1,
  },
  shareModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
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
    color: '#f4f4f5',
  },
  shareModalItemSubtext: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
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
    color: '#f4f4f5',
  },
  shareModalSendButton: {
    backgroundColor: '#FF8D32',
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
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelEventButton: {
    backgroundColor: '#FF3B30',
    marginBottom: 12,
  },
  shareModalEmptyText: {
    color: 'rgba(244,244,245,0.55)',
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
    color: '#FF8D32',
    marginTop: 16,
    marginBottom: 8,
  },
  recurringDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    marginBottom: 8,
  },
  recurringDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f4f4f5',
    flex: 1,
  },
  recurringDateTime: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
    marginLeft: 12,
  },
  recurringDateButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8D32',
    marginLeft: 12,
  },
  recurringDateStatus: {
    fontSize: 12,
    color: '#FF9500',
    marginLeft: 12,
  },
  scheduleAllButton: {
    backgroundColor: '#FF8D32',
    marginTop: 16,
  },
  scheduleAllButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0A0A0A',
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
    color: '#f4f4f5',
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
    backgroundColor: '#FF8D32',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  saveButtonText: {
    color: '#0A0A0A',
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    maxWidth: '95%',
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f4f4f5',
    flexShrink: 1,
  },
  titleWithPostsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  postsCount: {
    fontSize: 11,
    color: 'rgba(244,244,245,0.55)',
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
    backgroundColor: 'rgba(26, 26, 26, 0.65)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  tagText: {
    fontSize: 12,
    color: '#f4f4f5',
    fontWeight: '500',
  },
  participantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  participantsBadgeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  participantsMiniAvatarsCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantMiniAvatarCard: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  participantMoreMiniCard: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantMoreMiniCardText: {
    color: '#f4f4f5',
    fontSize: 7,
    fontWeight: 'bold',
  },
  }),
};