import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Image, Platform, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEvents, Event } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { suggestAddresses, geocodeAddress } from '../../utils/yandexGeocoder';
import { getSelectedLocation, clearSelectedLocation } from '../select-location';
import EventCard from '../../components/EventCard';
import { createLogger } from '../../utils/logger';
import { createEventStyles } from './create.styles';

const logger = createLogger('CreateEvent');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EventFormData {
  title: string;
  description: string;
  date: Date;
  time: Date;
  location: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  price: string;
  maxParticipants: string;
  mediaUrl: string; // Обрезанное фото для карточки
  originalMediaUrl: string; // Оригинальное фото для профиля
  mediaType: 'image' | 'video';
  selectedImage: string | null;
  // Новые поля для системы приглашений и фильтров
  ageRestriction?: {
    min: number;
    max: number;
  };
  genderRestriction?: string[];
  visibility?: {
    type: 'all' | 'friends' | 'all_except_friends' | 'all_except_excluded' | 'only_me' | 'me_and_excluded';
    excludedUsers?: string[];
  };
  invitedUsers?: string[];
  // Поля для таргета (только для бизнес-аккаунтов)
  targeting?: {
    enabled: boolean;
    reach?: number; // Необходимый охват
    responses?: number; // Необходимое кол-во откликов
  };
  // Поля для регулярных событий
  isRecurring?: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurringDays?: number[]; // Для weekly: дни недели (0=воскресенье, 1=понедельник, ...)
  recurringDayOfMonth?: number; // Для monthly: день месяца
  recurringCustomDates?: Date[]; // Для custom: выбранные даты
  // Поле для массового события
  isMassEvent?: boolean;
  // Метки (теги) события
  tags?: string[]; // Массив меток
}

export default function CreateEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { createEvent, updateEvent, deleteEvent, events, getFriendsList, eventRequests, user: eventsAuthUser } = useEvents() as any;
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRecurringOptions, setShowRecurringOptions] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [selectedCustomDates, setSelectedCustomDates] = useState<Date[]>([]);
  const [showWeekdayPicker, setShowWeekdayPicker] = useState(false);
  const [showMonthDayPicker, setShowMonthDayPicker] = useState(false);
  const [showMassEventTooltip, setShowMassEventTooltip] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [defaultImageUrl, setDefaultImageUrl] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(() => {
    // Проверяем параметры при инициализации
    return params.paymentCompleted === 'true';
  });
  const [paymentData, setPaymentData] = useState<{
    placementPrice: number;
    targetingPrice: number;
    targeting?: any;
  } | null>(() => {
    // Инициализируем данные оплаты из параметров
    if (params.paymentCompleted === 'true' && params.formData) {
      try {
        return {
          placementPrice: params.placementPrice ? parseFloat(params.placementPrice as string) : 0,
          targetingPrice: params.targetingPrice ? parseFloat(params.targetingPrice as string) : 0,
          targeting: params.targeting ? JSON.parse(params.targeting as string) : undefined,
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  // Состояния для модальных окон приглашений и исключений
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showExcludeModal, setShowExcludeModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [excludeSearchQuery, setExcludeSearchQuery] = useState('');
  const [selectedInviteUsers, setSelectedInviteUsers] = useState<string[]>([]);
  const [selectedExcludeUsers, setSelectedExcludeUsers] = useState<string[]>([]);
  
  // Парсим дату и время из параметров если они переданы
  const getInitialDate = () => {
    if (params.date) {
      const dateStr = params.date as string;
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  };
  
  const getInitialTime = () => {
    if (params.time) {
      const timeStr = params.time as string;
      const [hour, minute] = timeStr.split(':').map(Number);
      const date = getInitialDate();
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute || 0);
    }
    return new Date();
  };
  
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    date: getInitialDate(),
    time: getInitialTime(),
    location: '',
    price: '',
    maxParticipants: '',
    mediaUrl: '',
    originalMediaUrl: '',
    mediaType: 'image',
    selectedImage: null,
    // Инициализация новых полей
    ageRestriction: undefined,
    genderRestriction: undefined,
    visibility: {
      type: 'all',
      excludedUsers: []
    },
    invitedUsers: [],
    targeting: {
      enabled: false,
      reach: undefined,
      responses: undefined,
    },
    isRecurring: false,
    recurringType: undefined,
    recurringDays: undefined,
    recurringDayOfMonth: undefined,
    recurringCustomDates: undefined,
    isMassEvent: false,
    tags: [],
  });

  // Генерация автоматических меток
  const generateAutomaticTags = () => {
    const tags: string[] = [];
    
    // "women only" - если выбрано gender restriction только женщины
    if (formData.genderRestriction && formData.genderRestriction.length === 1 && formData.genderRestriction[0] === 'female') {
      tags.push('women only');
    }
    
    // "18+" - если выбран age restriction с минимальным возрастом >= 18
    if (formData.ageRestriction && formData.ageRestriction.min >= 18) {
      tags.push('18+');
    }
    
    // "через n мин" - если до начала события менее 2 часов
    if (!formData.isRecurring && formData.date && formData.time) {
      const eventDateTime = new Date(formData.date);
      const [hours, minutes] = formData.time.toTimeString().split(':').map(Number);
      eventDateTime.setHours(hours, minutes || 0, 0, 0);
      const now = new Date();
      const diffMs = eventDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours > 0 && diffHours < 2) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        tags.push(`через ${diffMinutes} мин`);
      }
    }
    
    // "Регулярное" - если событие регулярное
    if (formData.isRecurring) {
      tags.push('Регулярное');
    }
    
    return tags;
  };

  // Сброс формы к значениям по умолчанию (для быстрого создания следующей карточки)
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: getInitialDate(),
      time: getInitialTime(),
      location: '',
      price: '',
      maxParticipants: '',
      mediaUrl: '',
      originalMediaUrl: '',
      mediaType: 'image',
      selectedImage: null,
      ageRestriction: undefined,
      genderRestriction: undefined,
      visibility: {
        type: 'all',
        excludedUsers: [],
      },
      invitedUsers: [],
      coordinates: undefined,
      targeting: {
        enabled: false,
        reach: undefined,
        responses: undefined,
      },
      isRecurring: false,
      recurringType: undefined,
      recurringDays: undefined,
      recurringDayOfMonth: undefined,
      recurringCustomDates: undefined,
      isMassEvent: false,
      tags: [],
    });
    setShowSuggestions(false);
    setAddressSuggestions([]);
    setSelectedInviteUsers([]);
    setSelectedExcludeUsers([]);
    setInviteSearchQuery('');
    setExcludeSearchQuery('');
    setCurrentStep(1);
    setIsEditMode(false);
    setEditingEventId(null);
  };

  // Режим редактирования: инициализация один раз на конкретный eventId
  const editInitRef = React.useRef<string | null>(null);
  const prefillRef = React.useRef<string | null>(null);
  const eventIdFromParams = (params.eventId as string | undefined) ?? undefined;

  // 1) Включаем edit-mode ОДИН раз при смене eventId
  useEffect(() => {
    if (eventIdFromParams && editInitRef.current !== eventIdFromParams) {
      editInitRef.current = eventIdFromParams;
      setIsEditMode(true);
      setEditingEventId(eventIdFromParams);
      setCurrentStep(1);
    }
    if (!eventIdFromParams) {
      // Выключаем edit-mode, если параметр пропал
      editInitRef.current = null;
      prefillRef.current = null;
      setIsEditMode(false);
      setEditingEventId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdFromParams]);

  // 2) Префилл формы: только когда есть событие и ещё не префиллено для этого eventId
  useEffect(() => {
    if (!isEditMode || !editingEventId) return;
    if (prefillRef.current === editingEventId) return;
    const ev = events.find((e: Event) => e.id === editingEventId);
    if (!ev) return;

    prefillRef.current = editingEventId;
    const parsedDate = ev.date
      ? new Date(ev.date)
      : ev.startTime
      ? new Date(ev.startTime)
      : getInitialDate();
    const parsedTime = ev.time
      ? (() => {
          const [hh, mm] = ev.time.split(':').map((v: string) => parseInt(v, 10));
          const d = new Date(parsedDate);
          d.setHours(hh || 0, mm || 0, 0, 0);
          return d;
        })()
      : ev.startTime
      ? new Date(ev.startTime)
      : getInitialTime();
    // Собираем приглашенных (pending invites, отправленных организатором) для префилла
    const pendingInvitedUserIds: string[] = eventRequests
      ? eventRequests
          .filter((req: any) => 
            req.eventId === editingEventId &&
            req.type === 'invite' &&
            req.status === 'pending' &&
            (req.fromUserId === ev.organizerId)
          )
          .map((req: any) => req.toUserId)
      : [];

    setFormData(prev => ({
      ...prev,
      title: ev.title || '',
      description: ev.description || '',
      date: parsedDate,
      time: parsedTime,
      location: ev.location || '',
      coordinates: ev.latitude && ev.longitude ? { latitude: ev.latitude, longitude: ev.longitude } : prev.coordinates,
      price: ev.price || '',
      maxParticipants: ev.maxParticipants ? String(ev.maxParticipants) : prev.maxParticipants,
      mediaUrl: ev.mediaUrl || '',
      originalMediaUrl: (ev as any).originalMediaUrl || ev.mediaUrl || '',
      mediaType: (ev.mediaType as any) || prev.mediaType,
      selectedImage: ev.mediaUrl || null,
      invitedUsers: pendingInvitedUserIds,
      isRecurring: (ev as any).isRecurring || false,
      recurringType: (ev as any).recurringType || undefined,
      recurringDays: (ev as any).recurringDays || undefined,
      recurringDayOfMonth: (ev as any).recurringDayOfMonth || undefined,
      recurringCustomDates: (ev as any).recurringCustomDates ? (ev as any).recurringCustomDates.map((d: string) => new Date(d)) : undefined,
      isMassEvent: (ev as any).isMassEvent || false,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editingEventId, events]);

  // Состояния для автодополнения адресов
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{
    name: string;
    description: string;
    coordinates: { latitude: number; longitude: number };
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const currentUserId = authUser?.id ?? null;

  const steps = [
    { number: 1, title: t.createEvent.steps.basicInfo },
    { number: 2, title: t.createEvent.steps.participants },
    { number: 3, title: t.createEvent.steps.media },
    { number: 4, title: t.createEvent.steps.preview }
  ];

  // Функция генерации дефолтного изображения
  const generateDefaultImage = React.useCallback(async (title: string, description: string): Promise<string> => {
    // Используем placeholder API для генерации изображения на основе текста
    const prompt = `${title}. ${description}`.substring(0, 100);
    // Используем placeholder service (можно заменить на реальный API)
    const encodedPrompt = encodeURIComponent(prompt);
    // TODO: Заменить на реальный API для генерации изображений
    return `https://via.placeholder.com/800x600/8B5CF6/FFFFFF?text=${encodedPrompt}`;
  }, []);

  // Генерируем дефолтное изображение, если нет медиа
  useEffect(() => {
    const previewMediaUrl = formData.selectedImage || formData.mediaUrl;
    if (!previewMediaUrl && formData.title && !defaultImageUrl && currentStep === 4) {
      generateDefaultImage(formData.title, formData.description).then(url => {
        setDefaultImageUrl(url);
      });
    } else if (previewMediaUrl && defaultImageUrl) {
      // Сбрасываем дефолтное изображение, если пользователь добавил свое
      setDefaultImageUrl(null);
    }
  }, [formData.title, formData.description, formData.selectedImage, formData.mediaUrl, currentStep, defaultImageUrl, generateDefaultImage]);

  // Функции форматирования дат - определяем ДО использования в useMemo
  const formatDateForAPI = useCallback((date: Date | undefined) => {
    if (!date) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  }, []);

  const formatTime = useCallback((date: Date | undefined) => {
    if (!date) return '12:00';
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatDisplayDate = useCallback((date: Date | undefined) => {
    if (!date) return new Date().toLocaleDateString('ru-RU');
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  }, []);

  // Создаем preview-событие через useMemo для синхронного доступа
  const previewEventData = useMemo(() => {
    // ВСЕГДА создаем preview данные, даже если currentStep !== 4 (для отладки)
    // Но возвращаем null только если явно не на шаге 4
    if (currentStep !== 4) {
      return null;
    }
    
    
    try {
      const previewMediaUrl = formData.selectedImage || formData.mediaUrl;
      const previewEventId = 'preview-event-temp';
      const finalMediaUrl = previewMediaUrl || defaultImageUrl || undefined;
      
      // Безопасное форматирование даты - проверяем что date существует
      if (!formData.date) {
        console.warn('[CreateEvent] formData.date is missing, using current date');
      }
      const eventDate = formData.date ? formatDateForAPI(formData.date) : formatDateForAPI(new Date());
      const eventTime = formData.time ? formatTime(formData.time) : formatTime(new Date());
      const eventDisplayDate = formData.date ? formatDisplayDate(formData.date) : formatDisplayDate(new Date());
      
      // Определяем location - используем formData.location если есть, иначе проверяем coordinates
      let location = formData.location;
      if (!location) {
        location = formData.coordinates ? 'Место проведения' : 'Онлайн';
      }
      
      const previewData = {
        id: previewEventId,
        title: formData.title || t.createEvent.defaultEventTitle || 'Новое событие',
        description: formData.description || t.createEvent.defaultEventDescription || 'Описание события',
        date: eventDate,
        time: eventTime,
        displayDate: eventDisplayDate,
        displayTime: eventTime,
        location: location,
        price: formData.price || t.createEvent.defaultPrice || '0',
        participants: 0,
        maxParticipants: parseInt(String(formData.maxParticipants)) || 10,
        organizerAvatar: authUser?.avatarUrl || 'https://randomuser.me/api/portraits/women/68.jpg',
        organizerId: currentUserId || 'preview-organizer',
        mediaUrl: finalMediaUrl,
        originalMediaUrl: formData.originalMediaUrl || finalMediaUrl,
        mediaType: formData.mediaType || 'image',
        mediaAspectRatio: finalMediaUrl ? 1.33 : 1,
        participantsList: [],
        participantsData: [],
        createdAt: new Date(),
        isRecurring: formData.isRecurring || false,
        recurringType: formData.recurringType || null,
        recurringDays: formData.recurringDays || [],
        recurringDayOfMonth: formData.recurringDayOfMonth || null,
        recurringCustomDates: formData.recurringCustomDates?.map(d => formatDateForAPI(d)) || [],
        isMassEvent: formData.isMassEvent || false,
        // Генерируем теги для preview - включая автоматические
        tags: (() => {
          const autoTags: string[] = [];
          const customTags = formData.tags || [];
          
          // "массовое" - если событие массовое
          if (formData.isMassEvent) {
            autoTags.push('массовое');
          }
          
          // "18+" - если выбран age restriction с минимальным возрастом >= 18
          if (formData.ageRestriction && formData.ageRestriction.min >= 18) {
            autoTags.push('18+');
          }
          
          // "women only" - если выбрано gender restriction только женщины
          if (formData.genderRestriction && formData.genderRestriction.length === 1 && formData.genderRestriction[0] === 'female') {
            autoTags.push('women only');
          }
          
          // "Регулярное" - если событие регулярное
          if (formData.isRecurring) {
            autoTags.push('Регулярное');
          }
          
          return [...autoTags, ...customTags];
        })(),
      } as Event;
      
      
      return previewData;
    } catch (error) {
      console.error('[CreateEvent] Error creating preview event data:', error);
      // Возвращаем минимальный объект вместо null, чтобы превью не было пустым
      return {
        id: 'preview-event-temp',
        title: formData.title || 'Новое событие',
        description: formData.description || '',
        date: formatDateForAPI(formData.date || new Date()),
        time: formatTime(formData.time || new Date()),
        displayDate: formatDisplayDate(formData.date || new Date()),
        displayTime: formatTime(formData.time || new Date()),
        location: formData.location || 'Место проведения',
        price: formData.price || '0',
        participants: 0,
        maxParticipants: parseInt(String(formData.maxParticipants)) || 10,
        organizerAvatar: authUser?.avatarUrl || '',
        organizerId: currentUserId || '',
        mediaUrl: formData.mediaUrl,
        originalMediaUrl: formData.originalMediaUrl,
        mediaType: formData.mediaType || 'image',
        mediaAspectRatio: 1.33,
        participantsList: [],
        participantsData: [],
        createdAt: new Date(),
        isRecurring: false,
        isMassEvent: formData.isMassEvent || false,
        // Генерируем теги для preview даже в fallback случае
        tags: (() => {
          const autoTags: string[] = [];
          if (formData.isMassEvent) {
            autoTags.push('массовое');
          }
          if (formData.ageRestriction && formData.ageRestriction.min >= 18) {
            autoTags.push('18+');
          }
          if (formData.genderRestriction && formData.genderRestriction.length === 1 && formData.genderRestriction[0] === 'female') {
            autoTags.push('women only');
          }
          return [...autoTags, ...(formData.tags || [])];
        })(),
      } as Event;
    }
  }, [
    currentStep, 
    formData.title,
    formData.description,
    formData.date,
    formData.time,
    formData.location,
    formData.price,
    formData.maxParticipants,
    formData.selectedImage,
    formData.mediaUrl,
    formData.originalMediaUrl,
    formData.mediaType,
    formData.isRecurring,
    formData.recurringType,
    formData.recurringDays,
    formData.recurringDayOfMonth,
    formData.recurringCustomDates,
    formData.isMassEvent,
    formData.tags,
    formData.ageRestriction,
    formData.genderRestriction,
    formData.coordinates,
    defaultImageUrl, 
    authUser?.avatarUrl, 
    currentUserId, 
    t, 
    formatDateForAPI, 
    formatTime, 
    formatDisplayDate
  ]);

  // Добавляем preview-событие в контекст СРАЗУ при переходе на шаг 4
  // Используем useRef для отслеживания, было ли событие уже добавлено
  const previewEventAddedRef = React.useRef<string | null>(null);
  
  // Добавляем preview-событие в контекст СРАЗУ при переходе на шаг 4
  React.useLayoutEffect(() => {
    if (currentStep === 4 && previewEventData) {
      // Проверяем, не добавляли ли мы уже это событие
      const eventKey = `${previewEventData.id}-${previewEventData.title}-${previewEventData.date}`;
      if (previewEventAddedRef.current === eventKey) {
        // Событие уже добавлено, пропускаем
        return;
      }
      
      try {
        // Добавляем событие в контекст (updateEvent сам проверит, нужно ли обновлять)
        updateEvent(previewEventData.id, previewEventData);
        previewEventAddedRef.current = eventKey;
      } catch (error) {
        console.error('[CreateEvent] ❌ Error updating preview event:', error);
      }
    } else if (currentStep !== 4) {
      // Удаляем временное событие при выходе из шага превью
      previewEventAddedRef.current = null;
      try {
        deleteEvent('preview-event-temp');
      } catch (error) {
        console.error('[CreateEvent] Error deleting preview event:', error);
      }
    }
    // Используем только currentStep и previewEventData?.id для зависимостей
    // updateEvent и deleteEvent убраны из зависимостей, так как они стабильны из контекста
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, previewEventData?.id]);

  // Проверяем выбранное место каждые 500мс
  useEffect(() => {
    const interval = setInterval(() => {
      const selectedLocation = getSelectedLocation();
      if (selectedLocation) {
        logger.debug('Found selected location', selectedLocation);
        setFormData(prev => ({
          ...prev,
          location: selectedLocation.address,
          coordinates: {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude
          }
        }));
        clearSelectedLocation();
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Обработка изменения адреса с автодополнением
  const handleLocationChange = async (value: string) => {
    setFormData(prev => ({ ...prev, location: value }));
    
    if (value.length >= 2) {
      const suggestions = await suggestAddresses(value);
      setAddressSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: typeof addressSuggestions[0]) => {
    logger.debug('Selecting suggestion', { description: suggestion.description, coordinates: suggestion.coordinates });
    
    // Используем координаты из подсказки, они уже есть
    const newCoordinates = {
      latitude: suggestion.coordinates.latitude,
      longitude: suggestion.coordinates.longitude
    };
    
    logger.debug('Setting coordinates', newCoordinates);
    
    setFormData(prev => ({
      ...prev,
      location: suggestion.description,
      coordinates: newCoordinates
    }));
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const handleInputChange = (field: keyof EventFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setFormData(prev => ({ ...prev, time: selectedTime }));
    }
  };

  // Функции форматирования дат - определяем ДО использования в useMemo
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.common.error, t.messages.noGalleryAccess);
      return false;
    }
    return true;
  };


  const pickImage = async () => {
    try {
      logger.debug('Начинаем выбор изображения...');
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        logger.warn('Нет разрешения на доступ к медиатеке');
        return;
      }

      // Сначала получаем оригинальное фото (без обрезки)
      logger.debug('Открываем галерею для выбора оригинального фото...');
      const originalResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1.0,
      });

      if (originalResult.canceled) {
        logger.debug('Пользователь отменил выбор оригинального фото');
        return;
      }

      if (!originalResult.assets[0]) {
        logger.warn('Нет выбранного фото в assets');
        return;
      }

      const originalAsset = originalResult.assets[0];
      const originalUri = originalAsset.uri;
      logger.debug('Оригинальное фото выбрано', { uri: originalUri });

      // Используем оригинальное фото для карточки (без обрезки)
      setFormData(prev => ({ 
        ...prev, 
        selectedImage: originalUri,
        originalMediaUrl: originalUri,
        mediaUrl: originalUri, // Используем оригинальное фото для карточки
        mediaType: 'image'
      }));
      logger.debug('Оригинальное фото установлено в formData для карточки и профиля');

      // Проверяем, что данные действительно установлены
      setTimeout(() => {
        setFormData(prev => {
          logger.debug('Проверка formData после установки фото', {
            mediaUrl: prev.mediaUrl ? 'SET' : 'NOT SET',
            originalMediaUrl: prev.originalMediaUrl ? 'SET' : 'NOT SET',
            mediaType: prev.mediaType,
            selectedImage: prev.selectedImage ? 'SET' : 'NOT SET'
          });
          return prev;
        });
      }, 100);
    } catch (error: any) {
      logger.error('Ошибка при выборе изображения:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать изображение. Попробуйте еще раз.');
    }
  };

  const pickVideo = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos',
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData(prev => ({ 
        ...prev, 
        selectedImage: result.assets[0].uri,
        mediaUrl: result.assets[0].uri,
        mediaType: 'video'
      }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.common.error, t.messages.noCameraAccess);
      return;
    }

    // Сначала получаем оригинальное фото (без обрезки)
    const originalResult = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1.0,
    });

    if (originalResult.canceled || !originalResult.assets[0]) return;

    const originalUri = originalResult.assets[0].uri;

    // Используем оригинальное фото для карточки (без обрезки)
    setFormData(prev => ({ 
      ...prev, 
      selectedImage: originalUri,
      originalMediaUrl: originalUri,
      mediaUrl: originalUri, // Используем оригинальное фото для карточки
      mediaType: 'image'
    }));
    logger.debug('Оригинальное фото установлено в formData для карточки и профиля');

    // Старая логика обрезки удалена - используем оригинальное фото
    // Используем оригинальное фото для обоих (карточка и профиль)
    setFormData(prev => ({ 
      ...prev, 
      selectedImage: originalUri,
      mediaUrl: originalUri,
      originalMediaUrl: originalUri,
      mediaType: 'image'
    }));
  };

  const takeVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.common.error, t.messages.noCameraAccess);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'videos',
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData(prev => ({ 
        ...prev, 
        selectedImage: result.assets[0].uri,
        mediaUrl: result.assets[0].uri,
        mediaType: 'video'
      }));
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ 
      ...prev, 
      selectedImage: null,
      mediaUrl: '',
      originalMediaUrl: ''
    }));
  };

  const showMediaOptions = () => {
    Alert.alert(
      'Добавить медиа',
      'Выберите тип медиа и источник:',
      [
        { text: '📷 Фото из галереи', onPress: pickImage },
        { text: '🎥 Видео из галереи', onPress: pickVideo },
        { text: '📸 Сделать фото', onPress: takePhoto },
        { text: '🎬 Снять видео', onPress: takeVideo },
        { text: 'Отмена', style: 'cancel' }
      ]
    );
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLocationSelect = () => {
    // Переход на карту для выбора места
    router.push('/select-location');
  };

  // Расчет стоимости таргета
  const calculateTargetingPrice = (reach: number, responses: number): number => {
    // Формула: базовая стоимость за охват + стоимость за отклик
    const basePricePerReach = 0.1; // 10 копеек за показ
    const pricePerResponse = 5; // 5 рублей за отклик
    return Math.round(reach * basePricePerReach + responses * pricePerResponse);
  };

  // Расчет стоимости размещения события для бизнес-аккаунта
  const calculateEventPlacementPrice = (): number => {
    // Базовая стоимость размещения события
    return 100; // 100 рублей за размещение
  };


  const handleSubmit = async () => {
    if (!formData.title || !formData.description || !formData.location) {
      Alert.alert(t.createEvent.error, t.createEvent.fillRequiredFields);
      return;
    }

    // Предупреждаем, если фото не выбрано (но не блокируем создание)
    if (!formData.mediaUrl) {
      logger.warn('Предупреждение: фото не выбрано, событие будет создано без фото');
      // Можно показать предупреждение пользователю, но не блокировать создание
      // Alert.alert('Предупреждение', 'Событие будет создано без фото. Вы уверены?');
    }

    if (!currentUserId) {
      Alert.alert('Требуется вход', 'Авторизуйтесь, чтобы создавать события.', [
        { text: 'OK', onPress: () => router.push('/(auth)') },
      ]);
      return;
    }

    // Проверка на бизнес-аккаунт для массовых событий (>100 человек)
    const maxParticipants = parseInt(formData.maxParticipants, 10) || 10;
    const isBusinessAccount = authUser?.accountType === 'business';
    
    if (maxParticipants > 100 && !isBusinessAccount) {
      Alert.alert(
        'Массовые события недоступны',
        'Для создания событий с более чем 100 участниками требуется бизнес-аккаунт. Пожалуйста, зарегистрируйте бизнес-аккаунт.',
        [
          { text: 'OK' },
        ]
      );
      return;
    }

    // Для бизнес-аккаунтов требуется оплата размещения события
    if (isBusinessAccount && !paymentCompleted) {
      const placementPrice = calculateEventPlacementPrice();
      const targetingPrice = formData.targeting?.enabled && formData.targeting?.reach && formData.targeting?.responses
        ? calculateTargetingPrice(formData.targeting.reach, formData.targeting.responses)
        : 0;
      const totalPrice = placementPrice + targetingPrice;

      // Показываем модальное окно оплаты
      Alert.alert(
        'Оплата размещения события',
        `Размещение события: ${placementPrice} ₽\n${targetingPrice > 0 ? `Таргетинг: ${targetingPrice} ₽\n` : ''}Итого: ${totalPrice} ₽\n\nПерейти к оплате?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Оплатить',
            onPress: async () => {
              // Сохраняем данные формы для использования после оплаты
              // Открываем страницу оплаты
              router.push({
                pathname: '/payment',
                params: {
                  eventId: 'new',
                  type: 'event_placement',
                  placementPrice: placementPrice.toString(),
                  targetingPrice: targetingPrice.toString(),
                  totalPrice: totalPrice.toString(),
                  targeting: formData.targeting ? JSON.stringify(formData.targeting) : undefined,
                  formData: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
        date: formatDateForAPI(formData.date),
        time: formatTime(formData.time),
        // Используем formData.location если есть, иначе определяем по coordinates
        location: formData.location || (formData.coordinates ? 'Место проведения' : 'Онлайн'),
                    price: formData.price,
                    maxParticipants: maxParticipants,
                    mediaUrl: formData.mediaUrl,
                    originalMediaUrl: formData.originalMediaUrl,
                    mediaType: formData.mediaType,
                    coordinates: formData.coordinates,
                    ageRestriction: formData.ageRestriction,
                    genderRestriction: formData.genderRestriction,
                    visibility: formData.visibility,
                    invitedUsers: formData.invitedUsers,
                  }),
                }
              });
            }
          }
        ]
      );
      return;
    }

    const mediaAspectRatio = formData.mediaUrl ? 1.33 : undefined;

    // Логируем данные формы перед отправкой
    logger.debug('Подготовка к отправке события', { mediaUrl: formData.mediaUrl ? 'SET' : 'NOT SET', originalMediaUrl: formData.originalMediaUrl ? 'SET' : 'NOT SET', mediaType: formData.mediaType, hasMedia: !!formData.mediaUrl });

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        date: formatDateForAPI(formData.date),
        time: formatTime(formData.time),
        // Используем formData.location если есть, иначе определяем по coordinates
        location: formData.location || (formData.coordinates ? 'Место проведения' : 'Онлайн'),
        price: formData.price || 'Бесплатно',
        maxParticipants: maxParticipants,
        mediaUrl: formData.mediaUrl || undefined,
        originalMediaUrl: formData.originalMediaUrl || undefined,
        mediaType: formData.mediaType,
        mediaAspectRatio,
        coordinates: formData.coordinates,
        ageRestriction: formData.ageRestriction,
        genderRestriction: formData.genderRestriction,
        visibility: formData.visibility,
        invitedUsers: formData.invitedUsers || [],
        targeting: formData.targeting, // Добавляем данные таргета для бизнес-аккаунтов
        // Поля для регулярных событий
        isRecurring: formData.isRecurring || false,
        recurringType: formData.recurringType,
        recurringDays: formData.recurringDays,
        recurringDayOfMonth: formData.recurringDayOfMonth,
        recurringCustomDates: formData.recurringCustomDates?.map(d => formatDateForAPI(d)),
        // Поле для массового события
        isMassEvent: formData.isMassEvent || false,
        // Метки (теги) - только пользовательские (автоматические генерируются на сервере)
        tags: formData.tags || [],
      };

      logger.debug('Payload для создания события', { ...payload, mediaUrl: payload.mediaUrl ? 'SET' : 'NOT SET', originalMediaUrl: payload.originalMediaUrl ? 'SET' : 'NOT SET' });

      if (isEditMode && editingEventId) {
        // Режим редактирования: вызываем updateEvent
        await updateEvent(editingEventId, {
          title: payload.title,
          description: payload.description,
          location: payload.location,
          price: payload.price,
          maxParticipants: payload.maxParticipants as any,
          mediaUrl: payload.mediaUrl,
          mediaType: payload.mediaType as any,
          date: payload.date,
          time: payload.time,
          isRecurring: payload.isRecurring,
          recurringType: payload.recurringType,
          recurringDays: payload.recurringDays,
          recurringDayOfMonth: payload.recurringDayOfMonth,
          recurringCustomDates: payload.recurringCustomDates,
          isMassEvent: payload.isMassEvent,
          tags: payload.tags,
        } as any);
        Alert.alert('Сохранено', 'Изменения сохранены.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        // Создание нового события
        await createEvent(payload);
        // КРИТИЧЕСКИ ВАЖНО: Удаляем preview-событие после успешного создания реального события
        try {
          deleteEvent('preview-event-temp');
        } catch (error) {
          logger.warn('Failed to delete preview event after creation', error);
        }
        Alert.alert(
          t.createEvent.success,
          t.createEvent.eventCreated,
          [
            { text: t.createEvent.goToFeed, onPress: () => router.push('/(tabs)/explore') },
            { text: t.createEvent.createAnother, onPress: () => resetForm() },
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      logger.error('Failed to create event', error);
      Alert.alert(t.createEvent.error, isEditMode ? t.createEvent.failedToSave : t.createEvent.failedToCreate);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.label}>{t.createEvent.eventRequired}</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(value) => handleInputChange('title', value)}
              placeholder={t.createEvent.exampleEventTitle}
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{t.createEvent.description}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder={t.createEvent.eventDescriptionPlaceholder}
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />

            {/* Чекбокс "Регулярное" */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkboxOption}
                onPress={() => {
                  const newIsRecurring = !formData.isRecurring;
                  setFormData(prev => ({
                    ...prev,
                    isRecurring: newIsRecurring,
                    recurringType: newIsRecurring ? undefined : undefined,
                    recurringDays: undefined,
                    recurringDayOfMonth: undefined,
                    recurringCustomDates: undefined,
                  }));
                  if (newIsRecurring) {
                    setShowRecurringOptions(true);
                  }
                }}
              >
                <Text style={styles.checkboxText}>
                  {formData.isRecurring ? '☑' : '☐'} {t.createEvent.recurring || 'Recurring'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Чекбокс "Массовое событие" */}
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkboxOption}
                onPress={() => {
                  setFormData(prev => ({
                    ...prev,
                    isMassEvent: !prev.isMassEvent,
                  }));
                }}
              >
                <Text style={styles.checkboxText}>
                  {formData.isMassEvent ? '☑' : '☐'} Массовое событие
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tooltipButton}
                onPress={() => setShowMassEventTooltip(!showMassEventTooltip)}
              >
                <Text style={styles.tooltipIcon}>❓</Text>
              </TouchableOpacity>
            </View>

            {/* Подсказка для массового события */}
            {showMassEventTooltip && (
              <View style={styles.tooltipContainer}>
                <Text style={styles.tooltipText}>
                  Участники будут добавляться автоматически без вашего подтверждения. Событие получит метку "массовое".
                </Text>
              </View>
            )}

            {/* Поле даты - скрывается если регулярное */}
            {!formData.isRecurring && (
              <>
                <Text style={styles.label}>{t.createEvent.date} *</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateTimeButtonText}>
                    {formatDate(formData.date)}
                  </Text>
                  <Text style={styles.dateTimeButtonIcon}>📅</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Варианты регулярности */}
            {formData.isRecurring && (
              <View style={styles.recurringContainer}>
                <Text style={styles.label}>{t.createEvent.recurringEventHeld || 'Event is held every...'}</Text>
                
                <TouchableOpacity
                  style={[styles.recurringOption, formData.recurringType === 'daily' && styles.recurringOptionActive]}
                  onPress={() => {
                    setFormData(prev => ({
                      ...prev,
                      recurringType: 'daily',
                      recurringDays: undefined,
                      recurringDayOfMonth: undefined,
                      recurringCustomDates: undefined,
                    }));
                  }}
                >
                  <Text style={styles.recurringOptionText}>{t.createEvent.everyDay || 'Day'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.recurringOption, formData.recurringType === 'weekly' && styles.recurringOptionActive]}
                  onPress={() => {
                    setShowWeekdayPicker(true);
                  }}
                >
                  <Text style={styles.recurringOptionText}>{t.createEvent.dayOfWeek || 'Day of week'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.recurringOption, formData.recurringType === 'monthly' && styles.recurringOptionActive]}
                  onPress={() => {
                    setShowMonthDayPicker(true);
                  }}
                >
                  <Text style={styles.recurringOptionText}>{t.createEvent.dayOfMonth || 'Day of month'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.recurringOption, formData.recurringType === 'custom' && styles.recurringOptionActive]}
                  onPress={() => {
                    setShowCustomDatePicker(true);
                  }}
                >
                  <Text style={styles.recurringOptionText}>{t.createEvent.selectManually || 'Select manually'}</Text>
                </TouchableOpacity>

                {/* Отображение выбранных опций */}
                {formData.recurringType === 'weekly' && formData.recurringDays && formData.recurringDays.length > 0 && (
                  <Text style={styles.selectedRecurringText}>
                    {t.createEvent.selectedDays || 'Selected:'} {formData.recurringDays.map(d => {
                      return (t.createEvent as any)[`day${d}`] || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d];
                    }).join(', ')}
                  </Text>
                )}
                {formData.recurringType === 'monthly' && formData.recurringDayOfMonth && (
                  <Text style={styles.selectedRecurringText}>
                    {t.createEvent.selectedDay || 'Selected:'} {formData.recurringDayOfMonth}
                  </Text>
                )}
                {formData.recurringType === 'custom' && formData.recurringCustomDates && formData.recurringCustomDates.length > 0 && (
                  <Text style={styles.selectedRecurringText}>
                    {t.createEvent.selectedDates || 'Selected:'} {formData.recurringCustomDates.length} {t.createEvent.dates || 'dates'}
                  </Text>
                )}
              </View>
            )}

            {showDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={formData.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') {
                      if (selectedDate) {
                        setFormData(prev => ({ ...prev, date: selectedDate }));
                        setShowDatePicker(false);
                      }
                    } else {
                      setFormData(prev => ({ ...prev, date: selectedDate || formData.date }));
                    }
                  }}
                  // УБИРАЕМ minimumDate - разрешаем выбирать прошедшие даты для создания событий постфактум
                  textColor="#FFFFFF"
                  accentColor="#8B5CF6"
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.confirmButtonText}>{t.createEvent.select}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.label}>{t.createEvent.time} *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.dateTimeButtonText}>
                {formatTime(formData.time)}
              </Text>
              <Text style={styles.dateTimeButtonIcon}>🕐</Text>
            </TouchableOpacity>

            {showTimePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={formData.time}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedTime) => {
                    if (Platform.OS === 'android') {
                      if (selectedTime) {
                        setFormData(prev => ({ ...prev, time: selectedTime }));
                        setShowTimePicker(false);
                      }
                    } else {
                      setFormData(prev => ({ ...prev, time: selectedTime || formData.time }));
                    }
                  }}
                  textColor="#FFFFFF"
                  accentColor="#8B5CF6"
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.confirmButtonText}>{t.createEvent.select}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.label}>{t.createEvent.location} {formData.location === t.createEvent.online ? `(${t.createEvent.locationOptional})` : '*'}</Text>
            
            {formData.location !== t.createEvent.online ? (
              <View>
                <View style={styles.locationContainer}>
                  <TextInput
                    style={styles.locationInput}
                    value={formData.location}
                    onChangeText={handleLocationChange}
                    placeholder={t.createEvent.exampleLocation}
                    placeholderTextColor="#999"
                  />
                  <View style={styles.locationButtons}>
                    <TouchableOpacity 
                      style={styles.locationButton}
                      onPress={handleLocationSelect}
                    >
                      <Text style={styles.locationButtonText}>🗺️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.locationButton, formData.location === 'Онлайн' && styles.locationButtonActive]}
                      onPress={() => {
                        setFormData(prev => ({ 
                          ...prev, 
                          location: prev.location === t.createEvent.online ? '' : t.createEvent.online,
                          coordinates: prev.location === 'Онлайн' ? prev.coordinates : undefined
                        }));
                      }}
                    >
                      <Text style={styles.locationButtonText}>💻</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Выпадающий список с предложениями */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {addressSuggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectSuggestion(suggestion)}
                      >
                        <Text style={styles.suggestionName}>{suggestion.name}</Text>
                        <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.locationContainer}>
                <TextInput
                  style={styles.locationInput}
                  value={t.createEvent.online}
                  editable={false}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity 
                  style={[styles.locationButton, styles.locationButtonActive]}
                  onPress={() => {
                    setFormData(prev => ({ 
                      ...prev, 
                      location: ''
                    }));
                  }}
                >
                  <Text style={styles.locationButtonText}>💻</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.label}>{t.createEvent.price}</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={(value) => handleInputChange('price', value)}
              placeholder={t.createEvent.examplePrice}
              placeholderTextColor="#999"
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t.createEvent.steps.participants}</Text>
            
            {/* Максимум участников - переносим из основной информации */}
            <Text style={styles.label}>{t.createEvent.maxParticipants}</Text>
            <TextInput
              style={styles.input}
              value={formData.maxParticipants}
              onChangeText={(value) => handleInputChange('maxParticipants', value)}
              placeholder="Например: 10"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            
            {/* Ограничения по возрасту */}
            <Text style={styles.label}>{t.createEvent.ageRestrictionsOptional || 'Age restrictions (optional)'}</Text>
            <View style={styles.ageRestrictionContainer}>
              <View style={styles.ageInputContainer}>
                <Text style={styles.ageLabel}>{t.explore.from}:</Text>
                <TextInput
                  style={[styles.input, styles.ageInput]}
                  value={formData.ageRestriction?.min?.toString() || ''}
                  onChangeText={(value) => {
                    const min = value ? parseInt(value) : undefined;
                    setFormData(prev => ({
                      ...prev,
                      ageRestriction: {
                        min: min || 0,
                        max: prev.ageRestriction?.max || 100
                      }
                    }));
                  }}
                  placeholder="18"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.ageInputContainer}>
                <Text style={styles.ageLabel}>{t.createEvent.to || 'To'}:</Text>
                <TextInput
                  style={[styles.input, styles.ageInput]}
                  value={formData.ageRestriction?.max?.toString() || ''}
                  onChangeText={(value) => {
                    const max = value ? parseInt(value) : undefined;
                    setFormData(prev => ({
                      ...prev,
                      ageRestriction: {
                        min: prev.ageRestriction?.min || 0,
                        max: max || 100
                      }
                    }));
                  }}
                  placeholder="100"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            {/* Ограничения по полу */}
            <Text style={styles.label}>{t.createEvent.genderRestrictionsOptional || 'Gender restrictions (optional)'}</Text>
            <View style={styles.checkboxGroup}>
              <TouchableOpacity
                style={styles.checkboxOption}
                onPress={() => {
                  const current = formData.genderRestriction || [];
                  const newValue = current.includes('male') 
                    ? current.filter(g => g !== 'male')
                    : [...current, 'male'];
                  setFormData(prev => ({ ...prev, genderRestriction: newValue.length > 0 ? newValue : undefined }));
                }}
              >
                <Text style={styles.checkboxText}>
                  {formData.genderRestriction?.includes('male') ? '☑' : '☐'} {t.settings.profileVisibility.male}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkboxOption}
                onPress={() => {
                  const current = formData.genderRestriction || [];
                  const newValue = current.includes('female') 
                    ? current.filter(g => g !== 'female')
                    : [...current, 'female'];
                  setFormData(prev => ({ ...prev, genderRestriction: newValue.length > 0 ? newValue : undefined }));
                }}
              >
                <Text style={styles.checkboxText}>
                  {formData.genderRestriction?.includes('female') ? '☑' : '☐'} {t.settings.profileVisibility.female}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkboxOption}
                onPress={() => {
                  const current = formData.genderRestriction || [];
                  const newValue = current.includes('other') 
                    ? current.filter(g => g !== 'other')
                    : [...current, 'other'];
                  setFormData(prev => ({ ...prev, genderRestriction: newValue.length > 0 ? newValue : undefined }));
                }}
              >
                <Text style={styles.checkboxText}>
                  {formData.genderRestriction?.includes('other') ? '☑' : '☐'} {t.settings.profileVisibility.other}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Подраздел "Пригласить" */}
            <Text style={styles.sectionTitle}>{t.createEvent.inviteSection}</Text>
            <View style={styles.inviteContainer}>
              <Text style={styles.label}>{t.createEvent.invitedParticipants}</Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => {
                  setSelectedInviteUsers(formData.invitedUsers || []);
                  setInviteSearchQuery('');
                  setShowInviteModal(true);
                }}
              >
                <Text style={styles.addButtonText}>[+]</Text>
              </TouchableOpacity>
            </View>
            
            {/* Отображение аватаров приглашенных */}
            {formData.invitedUsers && formData.invitedUsers.length > 0 && (
              <View style={styles.invitedAvatarsContainer}>
                {formData.invitedUsers.map((userId) => {
                  const user = getFriendsList().find((f: any) => f.id === userId);
                  if (!user) return null;
                  return (
                    <View key={userId} style={styles.invitedAvatarContainer}>
                      <Image source={{ uri: user.avatar }} style={styles.invitedAvatar} />
                      <TouchableOpacity
                        style={styles.removeInvitedButton}
                        onPress={() => {
                          setFormData(prev => ({
                            ...prev,
                            invitedUsers: (prev.invitedUsers || []).filter(id => id !== userId)
                          }));
                        }}
                      >
                        <Text style={styles.removeInvitedText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
            
            {/* Подраздел "Видимость" */}
            <Text style={styles.sectionTitle}>{t.createEvent.visibility || 'Visibility'}</Text>
            <Text style={styles.label}>{t.createEvent.eventWillBeVisibleFor || 'Event will be visible for:'}</Text>
            
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[styles.radioOption, formData.visibility?.type === 'all' && styles.radioSelected]}
                onPress={() => setFormData(prev => ({ 
                  ...prev, 
                  visibility: { type: 'all', excludedUsers: [] }
                }))}
              >
                <Text style={styles.radioText}>{t.settings.profileVisibility.all}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.radioOption, formData.visibility?.type === 'friends' && styles.radioSelected]}
                onPress={() => setFormData(prev => ({ 
                  ...prev, 
                  visibility: { type: 'friends', excludedUsers: [] }
                }))}
              >
                <Text style={styles.radioText}>{t.createEvent.onlyFriends || 'Friends only'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.radioOption, formData.visibility?.type === 'all_except_friends' && styles.radioSelected]}
                onPress={() => setFormData(prev => ({ 
                  ...prev, 
                  visibility: { type: 'all_except_friends', excludedUsers: [] }
                }))}
              >
                <Text style={styles.radioText}>{t.createEvent.allExceptFriends || 'All except friends'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.radioOption, formData.visibility?.type === 'all_except_excluded' && styles.radioSelected]}
                onPress={() => {
                  setSelectedExcludeUsers(formData.visibility?.excludedUsers || []);
                  setExcludeSearchQuery('');
                  setShowExcludeModal(true);
                }}
              >
                <Text style={styles.radioText}>
                  {t.createEvent.allExcept || 'All except'} {formData.visibility?.excludedUsers && formData.visibility.excludedUsers.length > 0 
                    ? `(${formData.visibility.excludedUsers.length})` 
                    : t.createEvent.exclusions || 'exclusions'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.radioOption, formData.visibility?.type === 'only_me' && styles.radioSelected]}
                onPress={() => setFormData(prev => ({ 
                  ...prev, 
                  visibility: { type: 'only_me', excludedUsers: [] }
                }))}
              >
                <Text style={styles.radioText}>{t.createEvent.onlyMe || 'Only me'}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.radioOption, formData.visibility?.type === 'me_and_excluded' && styles.radioSelected]}
                onPress={() => {
                  setSelectedExcludeUsers(formData.visibility?.excludedUsers || []);
                  setExcludeSearchQuery('');
                  setShowExcludeModal(true);
                }}
              >
                <Text style={styles.radioText}>
                  {t.createEvent.meAnd || 'Me and'} {formData.visibility?.excludedUsers && formData.visibility.excludedUsers.length > 0 
                    ? `(${formData.visibility.excludedUsers.length})` 
                    : t.createEvent.exclusions || 'exclusions'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Раздел таргета для бизнес-аккаунтов */}
            {authUser?.accountType === 'business' && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Таргетинг (платная услуга)</Text>
                <Text style={styles.label}>
                  Настройте таргетинг для продвижения вашего события
                </Text>
                
                <TouchableOpacity
                  style={styles.checkboxOption}
                  onPress={() => {
                    setFormData(prev => ({
                      ...prev,
                      targeting: {
                        ...prev.targeting,
                        enabled: !(prev.targeting?.enabled ?? false),
                      }
                    }));
                  }}
                >
                  <Text style={styles.checkboxText}>
                    {formData.targeting?.enabled ? '☑' : '☐'} Включить таргетинг
                  </Text>
                </TouchableOpacity>
                
                {formData.targeting?.enabled && (
                  <View style={styles.targetingContainer}>
                    <Text style={styles.label}>Необходимый охват (количество показов)</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.targeting?.reach?.toString() || ''}
                      onChangeText={(value) => {
                        const reach = value ? parseInt(value) : undefined;
                        setFormData(prev => ({
                          ...prev,
                          targeting: {
                            enabled: prev.targeting?.enabled ?? false,
                            ...prev.targeting,
                            reach,
                          }
                        }));
                      }}
                      placeholder="Например: 1000"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                    
                    <Text style={styles.label}>Необходимое количество откликов</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.targeting?.responses?.toString() || ''}
                      onChangeText={(value) => {
                        const responses = value ? parseInt(value) : undefined;
                        setFormData(prev => ({
                          ...prev,
                          targeting: {
                            enabled: prev.targeting?.enabled ?? false,
                            ...prev.targeting,
                            responses,
                          }
                        }));
                      }}
                      placeholder="Например: 50"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                    
                    {/* Расчет стоимости таргета */}
                    {formData.targeting?.reach && formData.targeting?.responses && (
                      <View style={styles.targetingPriceContainer}>
                        <Text style={styles.targetingPriceLabel}>Стоимость таргета:</Text>
                        <Text style={styles.targetingPrice}>
                          {calculateTargetingPrice(formData.targeting.reach, formData.targeting.responses)} ₽
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
            
            {/* Микро-аватары исключенных пользователей */}
            {formData.visibility?.excludedUsers && formData.visibility.excludedUsers.length > 0 && (
              <View style={styles.excludedAvatarsContainer}>
                {formData.visibility.excludedUsers.map((userId) => {
                  const user = getFriendsList().find((f: any) => f.id === userId);
                  if (!user) return null;
                  return (
                    <View key={userId} style={styles.excludedAvatarContainer}>
                      <Image source={{ uri: user.avatar }} style={styles.excludedAvatar} />
                      <TouchableOpacity
                        style={styles.removeExcludedButton}
                        onPress={() => {
                          setFormData(prev => ({
                            ...prev,
                            visibility: {
                              ...prev.visibility!,
                              excludedUsers: (prev.visibility?.excludedUsers || []).filter(id => id !== userId)
                            }
                          }));
                        }}
                      >
                        <Text style={styles.removeExcludedText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );

      case 3:
        // Шаг "Media" - добавление фото/видео
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t.createEvent.steps.media}</Text>
            
            <Text style={styles.label}>{t.createEvent.mediaType || 'Media type:'}</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[styles.radioOption, formData.mediaType === 'image' && styles.radioSelected]}
                onPress={() => setFormData(prev => ({ ...prev, mediaType: 'image' }))}
              >
                <Text style={styles.radioText}>{t.createEvent.photo || '📷 Photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radioOption, formData.mediaType === 'video' && styles.radioSelected]}
                onPress={() => setFormData(prev => ({ ...prev, mediaType: 'video' }))}
              >
                <Text style={styles.radioText}>{t.createEvent.video || '🎥 Video'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t.createEvent.eventPhoto || 'Event photo'}</Text>
            
            {formData.selectedImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: formData.selectedImage }} style={styles.selectedImage} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addPhotoButton} onPress={showMediaOptions}>
                <Text style={styles.addPhotoButtonText}>{t.createEvent.addPhoto || 'Add photo'}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>{t.createEvent.orAddByLink || 'Or add photo by link:'}</Text>
            <TextInput
              style={styles.input}
              value={formData.mediaUrl}
              onChangeText={(value) => handleInputChange('mediaUrl', value)}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor="#999"
            />
          </View>
        );

      case 4:
        // Страница превью - простая страница с карточкой события как в ленте
        // ВОЗВРАЩАЕМ NULL - контент будет рендериться напрямую в ScrollView
        return null;

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>

      {/* Прогресс бар - скрываем на странице превью */}
      {currentStep !== 4 && (
      <View style={styles.progressContainer}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.number}
            style={styles.progressStep}
            onPress={() => setCurrentStep(step.number)}
          >
            <View style={[
              styles.progressCircle,
              currentStep >= step.number && styles.progressCircleActive
            ]}>
              <Text style={[
                styles.progressNumber,
                currentStep >= step.number && styles.progressNumberActive
              ]}>
                {step.number}
              </Text>
            </View>
            <Text style={[
              styles.progressTitle,
              currentStep >= step.number && styles.progressTitleActive
            ]}>
              {step.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      )}

      {/* Контент */}
      {currentStep === 4 ? (
        // На странице превью - простой экран с карточкой события (как в ленте)
        <View style={styles.previewWrapper}>
          <ScrollView 
            style={styles.previewScrollView}
            contentContainerStyle={styles.previewScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {!previewEventData ? (
              <View style={styles.previewEmptyContainer}>
                <Text style={styles.previewEmptyText}>
                  {t.createEvent.fillBasicFieldsForPreview || 'Заполните основные поля на первом шаге, чтобы увидеть превью'}
                </Text>
              </View>
            ) : (
              <View style={styles.previewCardContainer}>
                <EventCard
                  key={`preview-${previewEventData.id}`}
                  id={previewEventData.id}
                  title={previewEventData.title || ''}
                  description={previewEventData.description || ''}
                  date={previewEventData.date || ''}
                  time={previewEventData.time || ''}
                  displayDate={previewEventData.displayDate}
                  location={previewEventData.location || ''}
                  price={previewEventData.price || ''}
                  participants={previewEventData.participants || 0}
                  maxParticipants={previewEventData.maxParticipants || 10}
                  organizerAvatar={previewEventData.organizerAvatar || ''}
                  organizerId={previewEventData.organizerId || ''}
                  variant="default"
                  mediaUrl={previewEventData.mediaUrl}
                  originalMediaUrl={previewEventData.originalMediaUrl}
                  mediaType={previewEventData.mediaType || 'image'}
                  mediaAspectRatio={previewEventData.mediaAspectRatio || 1}
                  participantsList={previewEventData.participantsList || []}
                  participantsData={previewEventData.participantsData || []}
                  context="explore"
                  tags={previewEventData.tags || []}
                  showSwipeAction={true}
                />
              </View>
            )}
          </ScrollView>
          
          {/* Навигация для превью - внизу экрана */}
          <View style={styles.previewNavigation}>
            {currentStep > 1 && (
              <TouchableOpacity style={styles.backNavButton} onPress={handleBack}>
                <Text style={styles.backNavText}>{t.createEvent.back}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting
                  ? (isEditMode ? t.createEvent.saving : t.createEvent.creating)
                  : (isEditMode ? t.createEvent.saveChanges : t.createEvent.createEvent)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {renderStepContent()}
          
          {/* Навигация для обычных шагов */}
          <View style={styles.navigation}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.backNavButton} onPress={handleBack}>
              <Text style={styles.backNavText}>{t.createEvent.back}</Text>
            </TouchableOpacity>
          )}
          
          {currentStep < 4 ? (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Далее</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting
                  ? (isEditMode ? t.createEvent.saving : t.createEvent.creating)
                  : (isEditMode ? t.createEvent.saveChanges : t.createEvent.createEvent)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      )}
      
      {/* Модальное окно для приглашения друзей */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.createEvent.inviteFriends}</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalSearchInput}
              placeholder={t.createEvent.searchFriends || 'Search friends...'}
              placeholderTextColor="#999"
              value={inviteSearchQuery}
              onChangeText={setInviteSearchQuery}
            />
            
            <ScrollView style={styles.modalScrollView}>
              {getFriendsList()
                .filter((friend: any) => 
                  friend.name.toLowerCase().includes(inviteSearchQuery.toLowerCase()) ||
                  friend.username.toLowerCase().includes(inviteSearchQuery.toLowerCase())
                )
                .map((friend: any) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.modalFriendItem}
                    onPress={() => {
                      const isSelected = selectedInviteUsers.includes(friend.id);
                      if (isSelected) {
                        setSelectedInviteUsers(prev => prev.filter(id => id !== friend.id));
                      } else {
                        setSelectedInviteUsers(prev => [...prev, friend.id]);
                      }
                    }}
                  >
                    <Image source={{ uri: friend.avatar }} style={styles.modalFriendAvatar} />
                    <View style={styles.modalFriendInfo}>
                      <Text style={styles.modalFriendName}>{friend.name}</Text>
                      <Text style={styles.modalFriendUsername}>@{friend.username}</Text>
                    </View>
                    <Text style={styles.modalCheckbox}>
                      {selectedInviteUsers.includes(friend.id) ? '☑' : '☐'}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            
            <TouchableOpacity
              style={[
                styles.modalConfirmButton,
                selectedInviteUsers.length === 0 && styles.modalConfirmButtonDisabled
              ]}
              onPress={() => {
                setFormData(prev => ({ ...prev, invitedUsers: selectedInviteUsers }));
                setShowInviteModal(false);
              }}
              disabled={selectedInviteUsers.length === 0}
            >
              <Text style={styles.modalConfirmButtonText}>{(t.createEvent as any).invite || t.events.invite}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Модальное окно для исключения пользователей */}
      <Modal
        visible={showExcludeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowExcludeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.createEvent.excludeUsers || 'Exclude users'}</Text>
              <TouchableOpacity onPress={() => setShowExcludeModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalSearchInput}
              placeholder={t.createEvent.searchUsers || 'Search users...'}
              placeholderTextColor="#999"
              value={excludeSearchQuery}
              onChangeText={setExcludeSearchQuery}
            />
            
            <ScrollView style={styles.modalScrollView}>
              {getFriendsList()
                .filter((friend: any) => 
                  friend.name.toLowerCase().includes(excludeSearchQuery.toLowerCase()) ||
                  friend.username.toLowerCase().includes(excludeSearchQuery.toLowerCase())
                )
                .map((friend: any) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.modalFriendItem}
                    onPress={() => {
                      const isSelected = selectedExcludeUsers.includes(friend.id);
                      if (isSelected) {
                        setSelectedExcludeUsers(prev => prev.filter(id => id !== friend.id));
                      } else {
                        setSelectedExcludeUsers(prev => [...prev, friend.id]);
                      }
                    }}
                  >
                    <Image source={{ uri: friend.avatar }} style={styles.modalFriendAvatar} />
                    <View style={styles.modalFriendInfo}>
                      <Text style={styles.modalFriendName}>{friend.name}</Text>
                      <Text style={styles.modalFriendUsername}>@{friend.username}</Text>
                    </View>
                    <Text style={styles.modalCheckbox}>
                      {selectedExcludeUsers.includes(friend.id) ? '☑' : '☐'}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => {
                const visibilityType = formData.visibility?.type || 'all';
                if (visibilityType === 'all_except_excluded' || visibilityType === 'me_and_excluded') {
                  setFormData(prev => ({
                    ...prev,
                    visibility: {
                      ...prev.visibility!,
                      excludedUsers: selectedExcludeUsers
                    }
                  }));
                }
                setShowExcludeModal(false);
              }}
            >
              <Text style={styles.modalConfirmButtonText}>{t.common.save}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно для выбора дней недели */}
      <Modal
        visible={showWeekdayPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWeekdayPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.createEvent.selectDaysOfWeek || 'Select days of week'}</Text>
              <TouchableOpacity onPress={() => setShowWeekdayPicker(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {[0, 1, 2, 3, 4, 5, 6].map((index) => {
                const isSelected = formData.recurringDays?.includes(index) || false;
                const dayName = (t.createEvent as any)[`day${index}`] || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index];
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.modalFriendItem, isSelected && styles.modalFriendItemSelected]}
                    onPress={() => {
                      const currentDays = formData.recurringDays || [];
                      const newDays = isSelected
                        ? currentDays.filter(d => d !== index)
                        : [...currentDays, index];
                      setFormData(prev => ({
                        ...prev,
                        recurringType: 'weekly',
                        recurringDays: newDays.length > 0 ? newDays : undefined,
                      }));
                    }}
                  >
                    <Text style={styles.modalFriendName}>{dayName}</Text>
                    <Text style={styles.modalCheckbox}>
                      {isSelected ? '☑' : '☐'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => setShowWeekdayPicker(false)}
            >
              <Text style={styles.modalConfirmButtonText}>{t.common.save}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно для выбора дня месяца */}
      <Modal
        visible={showMonthDayPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthDayPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.createEvent.selectDayOfMonth || 'Select day of month'}</Text>
              <TouchableOpacity onPress={() => setShowMonthDayPicker(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const isSelected = formData.recurringDayOfMonth === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.modalFriendItem, isSelected && styles.modalFriendItemSelected]}
                    onPress={() => {
                      setFormData(prev => ({
                        ...prev,
                        recurringType: 'monthly',
                        recurringDayOfMonth: isSelected ? undefined : day,
                      }));
                      setShowMonthDayPicker(false);
                    }}
                  >
                    <Text style={styles.modalFriendName}>{day}</Text>
                    <Text style={styles.modalCheckbox}>
                      {isSelected ? '☑' : '☐'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Модальное окно для выбора дат вручную (календарь) */}
      <Modal
        visible={showCustomDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCustomDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.createEvent.selectDates || 'Select dates'}</Text>
              <TouchableOpacity onPress={() => setShowCustomDatePicker(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalHint}>{t.createEvent.selectDatesHint || 'Tap on dates to select them'}</Text>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {(() => {
                // Генерируем месяцы (год назад и год вперед)
                const months: Array<{ month: number; year: number; days: Array<{ day: number; date: Date }> }> = [];
                const today = new Date();
                const { width: SCREEN_WIDTH } = Dimensions.get('window');
                const cellWidth = (SCREEN_WIDTH - 80) / 7;
                
                for (let i = -12; i <= 12; i++) {
                  const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
                  const year = date.getFullYear();
                  const month = date.getMonth();
                  
                  const lastDay = new Date(year, month + 1, 0).getDate();
                  const firstDayWeekday = new Date(year, month, 1).getDay();
                  
                  const days: Array<{ day: number; date: Date }> = [];
                  
                  // Пустые дни в начале месяца
                  for (let j = 0; j < firstDayWeekday; j++) {
                    days.push({
                      day: 0,
                      date: new Date()
                    });
                  }
                  
                  // Дни месяца
                  for (let day = 1; day <= lastDay; day++) {
                    const currentDate = new Date(year, month, day);
                    days.push({
                      day,
                      date: currentDate
                    });
                  }
                  
                  months.push({
                    month,
                    year,
                    days
                  });
                }
                
                return months.map((monthData, monthIndex) => {
                  const monthName = t.calendar.months[monthData.month];
                  const weeks: Array<Array<{ day: number; date: Date }>> = [];
                  
                  // Разбиваем дни на недели
                  for (let i = 0; i < monthData.days.length; i += 7) {
                    const week = monthData.days.slice(i, i + 7);
                    while (week.length < 7) {
                      week.push({
                        day: 0,
                        date: new Date()
                      });
                    }
                    weeks.push(week);
                  }
                  
                  return (
                    <View key={`${monthData.year}-${monthData.month}`} style={styles.calendarMonthContainer}>
                      <View style={styles.calendarMonthHeader}>
                        <Text style={styles.calendarMonthTitle}>
                          {monthName} {monthData.year}
                        </Text>
                      </View>
                      
                      <View style={styles.calendarWeekDaysHeader}>
                        {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => (
                          <View key={`weekday-${dayIndex}`} style={[styles.calendarWeekDayHeaderCell, { width: cellWidth }]}>
                            <Text style={styles.calendarWeekDayHeaderText}>{t.calendar.weekDays[dayIndex]}</Text>
                          </View>
                        ))}
                      </View>
                      
                      {weeks.map((week, weekIndex) => (
                        <View key={`week-${weekIndex}`} style={styles.calendarWeekRow}>
                          {week.map((dayData, dayIndex) => {
                            if (dayData.day === 0) {
                              return <View key={`day-${dayIndex}`} style={[styles.calendarDayCell, { width: cellWidth }]} />;
                            }
                            
                            const dateStr = `${dayData.date.getFullYear()}-${String(dayData.date.getMonth() + 1).padStart(2, '0')}-${String(dayData.date.getDate()).padStart(2, '0')}`;
                            const isSelected = formData.recurringCustomDates?.some(d => {
                              const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                              return dStr === dateStr;
                            }) || false;
                            
                            return (
                              <TouchableOpacity
                                key={`day-${dayIndex}`}
                                style={[
                                  styles.calendarDayCell,
                                  { width: cellWidth },
                                  isSelected && styles.calendarDayCellSelected
                                ]}
                                onPress={() => {
                                  const currentDates = formData.recurringCustomDates || [];
                                  const newDates = isSelected
                                    ? currentDates.filter(d => {
                                        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                        return dStr !== dateStr;
                                      })
                                    : [...currentDates, dayData.date];
                                  setFormData(prev => ({
                                    ...prev,
                                    recurringType: 'custom',
                                    recurringCustomDates: newDates.length > 0 ? newDates : undefined,
                                  }));
                                }}
                              >
                                <Text style={[
                                  styles.calendarDayCellText,
                                  isSelected && styles.calendarDayCellTextSelected
                                ]}>
                                  {dayData.day}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  );
                });
              })()}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => setShowCustomDatePicker(false)}
            >
              <Text style={styles.modalConfirmButtonText}>{t.common.save}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = createEventStyles;