import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, Platform, Modal, Dimensions } from 'react-native';
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
    const ev = events.find(e => e.id === editingEventId);
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

  // Создаем preview-событие через useMemo для синхронного доступа
  const previewEventData = useMemo(() => {
    if (currentStep !== 4) return null;
    
    try {
      const previewMediaUrl = formData.selectedImage || formData.mediaUrl;
      const previewEventId = 'preview-event-temp';
      const finalMediaUrl = previewMediaUrl || defaultImageUrl || undefined;
      
      return {
        id: previewEventId,
        title: formData.title || t.createEvent.defaultEventTitle || 'Новое событие',
        description: formData.description || t.createEvent.defaultEventDescription || 'Описание события',
        date: formatDateForAPI(formData.date) || new Date().toISOString(),
        time: formatTime(formData.time) || '12:00',
        displayDate: formatDisplayDate(formData.date) || new Date().toLocaleDateString('ru-RU'),
        displayTime: formatTime(formData.time) || '12:00',
        location: formData.location || t.createEvent.defaultLocation || 'Место проведения',
        price: formData.price || t.createEvent.defaultPrice || '0',
        participants: 0,
        maxParticipants: parseInt(String(formData.maxParticipants)) || 10,
        organizerAvatar: authUser?.avatarUrl || 'https://randomuser.me/api/portraits/women/68.jpg',
        organizerId: currentUserId || 'preview-organizer',
        mediaUrl: finalMediaUrl,
        originalMediaUrl: formData.originalMediaUrl || finalMediaUrl,
        mediaType: formData.mediaType || 'image',
        mediaAspectRatio: finalMediaUrl ? (SCREEN_WIDTH / 160) : 1,
        participantsList: [],
        participantsData: [],
        createdAt: new Date(),
        isRecurring: formData.isRecurring || false,
        recurringType: formData.recurringType || null,
        recurringDays: formData.recurringDays || [],
        recurringDayOfMonth: formData.recurringDayOfMonth || null,
        recurringCustomDates: formData.recurringCustomDates?.map(d => formatDateForAPI(d)) || [],
        tags: formData.tags || [],
      } as Event;
    } catch (error) {
      console.error('[CreateEvent] Error creating preview event data:', error);
      return null;
    }
  }, [currentStep, formData, defaultImageUrl, authUser?.avatarUrl, currentUserId, t, SCREEN_WIDTH]);

  // Добавляем preview-событие в контекст
  useEffect(() => {
    if (currentStep === 4 && previewEventData) {
      try {
        updateEvent(previewEventData.id, previewEventData);
      } catch (error) {
        console.error('[CreateEvent] Error updating preview event:', error);
      }
    } else if (currentStep !== 4) {
      // Удаляем временное событие при выходе из шага превью
      try {
        deleteEvent('preview-event-temp');
      } catch (error) {
        console.error('[CreateEvent] Error deleting preview event:', error);
      }
    }
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.messages.error, t.messages.noGalleryAccess);
      return false;
    }
    return true;
  };

  // Функция для генерации дефолтного изображения через ИИ (placeholder)
  // В реальном приложении здесь будет вызов API для генерации изображений (например, DALL-E, Stable Diffusion и т.д.)
  const generateDefaultImage = React.useCallback(async (title: string, description: string): Promise<string> => {
    // Используем placeholder API для генерации изображения на основе текста
    const prompt = `${title}. ${description}`.substring(0, 100);
    // Используем placeholder service (можно заменить на реальный API)
    const encodedPrompt = encodeURIComponent(prompt);
    // TODO: Заменить на реальный API для генерации изображений
    // Пример: const response = await fetch('https://api.example.com/generate-image', { method: 'POST', body: JSON.stringify({ prompt }) });
    return `https://via.placeholder.com/800x400/4A5568/FFFFFF?text=${encodedPrompt}`;
  }, []);

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
      Alert.alert(t.messages.error, t.messages.noCameraAccess);
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
    if (false) {
      const croppedAsset = croppedResult.assets[0];
      setFormData(prev => ({ 
        ...prev, 
        selectedImage: croppedAsset.uri,
        mediaUrl: croppedAsset.uri, // Обрезанное фото для карточки
        originalMediaUrl: originalUri, // Оригинальное фото для профиля
        mediaType: 'image'
      }));
    } else {
      // Если пользователь отменил обрезку, используем оригинальное фото для обоих
      setFormData(prev => ({ 
        ...prev, 
        selectedImage: originalUri,
        mediaUrl: originalUri,
        originalMediaUrl: originalUri,
        mediaType: 'image'
      }));
    }
  };

  const takeVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.messages.error, t.messages.noCameraAccess);
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
                    location: formData.location,
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
        location: formData.location || 'Онлайн',
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
          tags: payload.tags,
        } as any);
        Alert.alert('Сохранено', 'Изменения сохранены.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        // Создание нового события
        await createEvent(payload);
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
                      return t.createEvent[`day${d}`] || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d];
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
                  const user = getFriendsList().find(f => f.id === userId);
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
                        enabled: !prev.targeting?.enabled,
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
                  const user = getFriendsList().find(f => f.id === userId);
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
        // Используем previewEventData из useMemo
        if (!previewEventData) {
          return (
            <View style={styles.emptyPreview}>
              <Text style={styles.emptyPreviewText}>
                {t.createEvent.fillBasicFieldsForPreview || 'Fill in the basic fields on the first step to see the preview'}
              </Text>
            </View>
          );
        }

        // Всегда показываем карточку на странице превью (даже с дефолтными значениями)
        // Полностью повторяем структуру ленты (explore.tsx) - карточка отображается как в ленте
        try {
          return (
            <EventCard
              key={previewEventData.id}
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
              showSwipeAction={false}
            />
          );
        } catch (error) {
          console.error('[CreateEvent] Error rendering preview:', error);
          return (
            <View style={styles.emptyPreview}>
              <Text style={styles.emptyPreviewText}>
                Ошибка при отображении превью. Попробуйте заполнить форму заново.
              </Text>
            </View>
          );
        }

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
        // На странице превью - точная копия ленты (explore.tsx)
        <View style={styles.previewContainer}>
          <ScrollView 
            style={styles.previewScrollView}
            contentContainerStyle={styles.previewScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderStepContent()}
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
                .filter(friend => 
                  friend.name.toLowerCase().includes(inviteSearchQuery.toLowerCase()) ||
                  friend.username.toLowerCase().includes(inviteSearchQuery.toLowerCase())
                )
                .map(friend => (
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
              <Text style={styles.modalConfirmButtonText}>{t.createEvent.invite}</Text>
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
                .filter(friend => 
                  friend.name.toLowerCase().includes(excludeSearchQuery.toLowerCase()) ||
                  friend.username.toLowerCase().includes(excludeSearchQuery.toLowerCase())
                )
                .map(friend => (
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
                const dayName = t.createEvent[`day${index}`] || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index];
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    paddingTop: 60,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCircleActive: {
    backgroundColor: '#8B5CF6',
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999999',
  },
  progressNumberActive: {
    color: '#FFFFFF',
  },
  progressTitle: {
    fontSize: 9,
    color: '#999999',
    textAlign: 'center',
  },
  progressTitleActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentPreview: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  previewScrollView: {
    flex: 1,
  },
  previewScrollContent: {
    paddingHorizontal: 20, // Как в ленте (eventsContainer)
    paddingTop: 20, // Отступ сверху как в ленте
    paddingBottom: 100, // Отступ снизу для навигации
    minHeight: '100%', // Минимальная высота для отображения контента
  },
  previewNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 50, // Отступ снизу для таб-бара
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  radioGroup: {
    marginTop: 20,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
  },
  radioSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#2A1A3A',
  },
  radioText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  previewCardContainer: {
    marginTop: 16,
  },
  previewCardWrapper: {
    position: 'relative',
    marginBottom: 0,
  },
  addMediaButton: {
    position: 'absolute',
    top: 80, // Центр места для фото (160px / 2 = 80px) - медиа-контейнер в EventCard имеет высоту 160px
    left: '50%',
    transform: [{ translateX: -22 }], // Центрирование по горизонтали (44px / 2 = 22px)
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  addMediaButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  removeMediaButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  previewHint: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  emptyPreview: {
    marginTop: 32,
    padding: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  emptyPreviewText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  tagsSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  tagsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2A1A3A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  tagText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 6,
  },
  removeTagButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeTagText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  addTagButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555555',
  },
  addTagButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#555555',
    color: '#FFFFFF',
    fontSize: 14,
  },
  tagInputCancel: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagInputCancelText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 20,
    marginTop: 30,
  },
  navigationPreview: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  backNavButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#1A1A1A',
  },
  backNavText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Стили для работы с изображениями
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addPhotoButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  addPhotoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addImageButton: {
    borderWidth: 2,
    borderColor: '#333333',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#1A1A1A',
  },
  addImageIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  addImageText: {
    fontSize: 16,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  imageHint: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  previewImageContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  // Стили для селекторов даты и времени
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  dateTimeButtonIcon: {
    fontSize: 20,
    marginLeft: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#fff',
    backgroundColor: '#1a1a1a',
  },
  locationButtons: {
    flexDirection: 'row',
    marginLeft: 10,
    gap: 10,
  },
  locationButton: {
    width: 50,
    height: 50,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButtonActive: {
    backgroundColor: '#34C759',
  },
  suggestionsContainer: {
    marginTop: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  suggestionName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestionDescription: {
    color: '#999',
    fontSize: 12,
  },
  locationButtonText: {
    fontSize: 20,
  },
  autocompleteContainer: {
    flex: 1,
  },
  autocompleteInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
  },
  autocompleteList: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 200,
    zIndex: 1000,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Стили для нового шага "Участники"
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 32,
    marginBottom: 16,
  },
  ageRestrictionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  ageInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ageLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    minWidth: 40,
  },
  ageInput: {
    flex: 1,
  },
  checkboxGroup: {
    marginTop: 8,
  },
  checkboxRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  checkboxOption: {
    padding: 12,
    marginBottom: 8,
  },
  checkboxText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  recurringContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  recurringOption: {
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  recurringOptionActive: {
    backgroundColor: '#2A1A3A',
    borderColor: '#8B5CF6',
  },
  recurringOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  selectedRecurringText: {
    fontSize: 14,
    color: '#8B5CF6',
    marginTop: 8,
    fontStyle: 'italic',
  },
  calendarContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  calendarDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDaySelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  calendarDayText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Стили для полноценного календаря
  calendarMonthContainer: {
    marginBottom: 32,
  },
  calendarMonthHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  calendarWeekDaysHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  calendarWeekDayHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  calendarWeekDayHeaderText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  calendarDayCell: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  calendarDayCellSelected: {
    backgroundColor: '#8B5CF6',
  },
  calendarDayCellText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  calendarDayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalFriendItemSelected: {
    backgroundColor: '#2A1A3A',
  },
  modalHint: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
    textAlign: 'center',
  },
  inviteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  invitedAvatarsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  invitedAvatarContainer: {
    position: 'relative',
  },
  invitedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  removeInvitedButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeInvitedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  excludedAvatarsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  excludedAvatarContainer: {
    position: 'relative',
  },
  excludedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  removeExcludedButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeExcludedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  targetingContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  targetingPriceContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetingPriceLabel: {
    fontSize: 16,
    color: '#AAA',
    fontWeight: '500',
  },
  targetingPrice: {
    fontSize: 20,
    color: '#8B5CF6',
    fontWeight: '700',
  },
  // Стили для модальных окон
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#2a2a2a',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalFriendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  modalFriendInfo: {
    flex: 1,
  },
  modalFriendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalFriendUsername: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  modalCheckbox: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  modalConfirmButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  modalConfirmButtonDisabled: {
    backgroundColor: '#333333',
    opacity: 0.5,
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});