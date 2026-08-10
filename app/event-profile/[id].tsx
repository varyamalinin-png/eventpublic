import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, Alert, Dimensions, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '../../utils/safeRouter';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Audio } from 'expo-av';
import MemoryPost from '../../components/MemoryPost';
import ParticipantsModal from '../../components/ParticipantsModal';
import ComplaintForm from '../../components/ComplaintForm';
import { createLogger } from '../../utils/logger';
import { API_BASE_URL } from '../../services/api';
import type { EventProfilePost } from '../../types/EventProfile';
import { eventProfileStyles } from '../../styles/event-profile.styles';
import { AppIcon } from '../../components/ui/AppIcon';
import { Palette } from '../../constants/DesignSystem';

const logger = createLogger('EventProfile');
const styles = eventProfileStyles || StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  content: {
    flex: 1,
  },
  backButtonFixed: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
  },
  backText: {
    color: '#f4f4f5',
    fontSize: 24,
  },
});

export default function EventProfileScreen() {
  const { id, viewerUserId } = useLocalSearchParams();
  const router = useSafeRouter();
  
  // Функция навигации для передачи в MemoryPost
  const handleNavigate = (path: string) => {
    router.push(path);
  };
  const { t } = useLanguage();
  const { 
    events,
    getEventProfile, 
    getUserData, 
    canEditEventProfile, 
    addEventProfilePost,
    deleteEventProfilePost, 
    updateEventProfile,
    getEventParticipants,
    createEventProfile,
    updateEvent,
    getEventPhotoForUser,
    setPersonalEventPhoto,
    isEventPast,
    isUserEventMember,
    getUserRelationship,
    isUserOrganizer,
    saveEvent,
    removeSavedEvent,
    isEventSaved,
    cancelEventParticipation,
    cancelEvent,
    cancelOrganizerParticipation,
    rejectInvitation,
    eventRequests,
    sendEventRequest,
    cancelEventRequest,
    removeParticipantFromEvent,
    respondToEventRequest,
    fetchEventProfile,
    getChatsForUser,
    transferOrganizerRole
  } = useEvents();
  const { user: authUser, accessToken } = useAuth();
  const currentUserId = authUser?.id ?? null;
  
  const eventId = Array.isArray(id) ? id[0] : id || '';
  const eventProfile = getEventProfile(eventId);
  // Получаем данные события из карточки для отображения параметров
  const event = events.find(e => e.id === eventId);
  
  // Получаем скрытые параметры из профиля события (используем useMemo для стабильной ссылки)
  const hiddenParameters = useMemo(() => {
    return (eventProfile as any)?.hiddenParameters || {};
  }, [eventProfile]);
  
  // Определяем отношения пользователя к событию
  const relationship = event ? getUserRelationship(event, currentUserId ?? '') : 'non_member';
  const isPast = event ? isEventPast(event) : false;
  const isMember = event && currentUserId ? isUserEventMember(event, currentUserId) : false;
  const isOrganizer = event && currentUserId ? isUserOrganizer(event, currentUserId) : false;
  
  // Состояния для действий с событием
  const [showEventActionsModal, setShowEventActionsModal] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [isEditingParameterVisibility, setIsEditingParameterVisibility] = useState(false);
  const [localHiddenParameters, setLocalHiddenParameters] = useState<Record<string, boolean>>(hiddenParameters);
  const [showTransferOrganizerModal, setShowTransferOrganizerModal] = useState(false);
  const [selectedNewOrganizerId, setSelectedNewOrganizerId] = useState<string | null>(null);
  
  // Синхронизируем скрытые параметры с профилем (только если действительно изменились значения)
  useEffect(() => {
    // Сравниваем значения, а не ссылки объектов, чтобы избежать бесконечных циклов
    const currentStr = JSON.stringify(localHiddenParameters);
    const newStr = JSON.stringify(hiddenParameters);
    
    if (currentStr !== newStr) {
      setLocalHiddenParameters(hiddenParameters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenParameters]); // hiddenParameters теперь стабильная ссылка благодаря useMemo. localHiddenParameters намеренно не включен, чтобы избежать циклов
  
  // Состояния для добавления контента
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  const [contentType, setContentType] = useState<'photo' | 'text' | null>(null);
  const [contentCaption, setContentCaption] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<Array<{ uri: string; index: number; id: string; caption?: string; file?: File }>>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [combineIntoOnePost, setCombineIntoOnePost] = useState(false); // Чекбокс "объединить в один пост"

  // Состояние для попапа просмотра фото
  const [showImageModal, setShowImageModal] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

  // Состояния для ленты контента
  const [showContentFeed, setShowContentFeed] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const attemptedProfiles = useRef<Set<string>>(new Set());
  const soundRef = useRef<Audio.Sound | null>(null);
  const [photoHeight, setPhotoHeight] = useState<number | null>(null);

  // Загружаем профиль события с сервера (доступен всем для просмотра)
  useEffect(() => {
    // ВАЖНО: пробуем загрузить профиль даже если базовое событие ещё не в состоянии events.
    // Это нужно для прямых переходов по ссылке /event-profile/[id] (в том числе из браузера/на телефоне).
    if (!eventProfile && eventId && !attemptedProfiles.current.has(eventId)) {
      attemptedProfiles.current.add(eventId);
      // Пытаемся загрузить профиль с сервера
      // Профиль доступен всем для просмотра, редактирование доступно только участникам
      const loadProfile = async () => {
        try {
          logger.debug(`Загружаем профиль события ${eventId}`);
          const profile = await fetchEventProfile(eventId);
        if (!profile) {
          logger.debug('Профиль события не найден');
          } else {
            logger.debug(`Профиль события ${eventId} загружен, постов: ${profile.posts?.length || 0}`);
        }
        } catch (error) {
          logger.error('Ошибка при загрузке профиля события:', error);
        } finally {
        attemptedProfiles.current.delete(eventId);
        }
      };
      loadProfile();
    }
    // fetchEventProfile стабилен (useCallback), но для безопасности оставляем его в зависимостях
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, event?.id]); // Используем только eventId и event.id для предотвращения множественных вызовов

  // Обновляем данные события (включая персональные фото) при открытии профиля
  useEffect(() => {
    if (eventId && event) {
      // Синхронизируем события с сервера, чтобы получить актуальные персональные фото
      const syncEvents = async () => {
        try {
          // Используем syncEventsFromServer из контекста через useEvents
          // Но так как это не экспортируется напрямую, мы можем вызвать обновление через другой способ
          // Или просто полагаемся на WebSocket обновления
        } catch (error) {
          logger.error('Failed to sync events on profile open:', error);
        }
      };
      syncEvents();
    }
  }, [eventId, event]);

  // Получаем обновленный профиль события после создания
  const currentEventProfile = getEventProfile(eventId);

  // Используем данные из события как fallback, если профиля еще нет.
  // ВАЖНО: даже если события нет в состоянии events (например, при прямом заходе по ссылке),
  // создаём минимальный "заглушечный" профиль, чтобы не залипать навсегда на экране загрузки.
  const displayProfile = currentEventProfile || (event ? {
    id: `profile-${eventId}`,
    eventId,
    name: event.title,
    description: event.description,
    date: event.date,
    time: event.time,
    location: event.location || '',
    participants: [],
    organizerId: event.organizerId,
    isCompleted: false,
    posts: [],
    createdAt: new Date(),
    avatar: event.mediaUrl,
  } : (eventId ? {
    id: `profile-${eventId}`,
    eventId,
    name: '',
    description: '',
    date: '',
    time: '',
    location: '',
    participants: [],
    organizerId: '',
    isCompleted: false,
    posts: [],
    createdAt: new Date(),
    avatar: undefined,
  } : null));

  // Профиль события доступен всем для просмотра
  // Редактирование доступно только участникам (проверяется через canEditEventProfile)
  // ВАЖНО: показываем экран, как только есть displayProfile, даже если объекта event ещё нет в состоянии.
  // Это позволяет открывать страницу по прямой ссылке, когда событие не подгружено в общий список events.
  if (!displayProfile) {
    // Показываем loading состояние вместо null, чтобы избежать черного экрана
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0c' }}>
          <Text style={{ color: '#FF8D32', fontSize: 16 }}>{t.eventProfile.loadingEvent}</Text>
        </View>
      </View>
    );
  }

  const participants = getEventParticipants(eventId);
  const participantsCount = participants.length;
  
  // Функция для получения действий с событием (аналогично EventCard)
  const getEventActions = () => {
    if (!event) return [];
    
    const actions: Array<{ id: string; label: string; action?: () => void; isClickable?: boolean }> = [];
    const participantsCount = participants.length;
    
    // ПРОШЕДШИЕ СОБЫТИЯ
    if (isPast) {
      if (relationship === 'accepted' || relationship === 'organizer') {
        actions.push({ id: 'hide_parameters', label: t.events.hideParameters, isClickable: true });
        actions.push({ id: 'change_photo', label: t.events.changePhoto, isClickable: true });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
      } else {
        // Для не-участников прошедших событий
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
    }
    // БУДУЩИЕ СОБЫТИЯ
    else {
      // 🎯 ПРИОРИТЕТ 1: Приглашение (invited)
      if (relationship === 'invited') {
        actions.push({ id: 'accept_invite', label: t.events.acceptInvitation, isClickable: true });
        actions.push({ id: 'cancel_invite', label: t.events.cancelInvitation, isClickable: true });
        // Опция "go to chat" - неактивна для приглашенных пользователей
        actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: false });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 2: В ожидании (waiting)
      else if (relationship === 'waiting') {
        actions.push({ id: 'view_requests', label: t.events.viewRequests, isClickable: true });
        actions.push({ id: 'cancel_request', label: t.events.cancelRequest, isClickable: true });
        // Опция "go to chat" - неактивна для пользователей в ожидании
        actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: false });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 3: Участник (accepted)
      else if (relationship === 'accepted') {
        actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation });
        // Опция "go to chat" - активна для принятых участников
        const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === eventId && c.type === 'event');
        actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: !!eventChat });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 4: Организатор (organizer)
      else if (relationship === 'organizer') {
        actions.push({ id: 'change_parameters', label: t.events.changeParameters, isClickable: true });
        // Всегда показываем кнопку "Отменить событие" - при нажатии покажется попап с transfer organizer role
          actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
        // Действие "продлить" для регулярных событий
        if (event.isRecurring) {
          actions.push({ id: 'extend_recurring', label: t.events.extendRecurring || t.events.extendRecurring, isClickable: true });
        }
        actions.push({ id: 'remove_participant', label: t.events.removeParticipant, isClickable: true });
        // Опция "go to chat" - активна для принятых участников
        const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === eventId && c.type === 'event');
        actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: !!eventChat });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
      }
      // ПРИОРИТЕТ 5: Не член (non_member)
      else if (relationship === 'non_member') {
        actions.push({ id: 'schedule', label: t.events.schedule, isClickable: true });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 6: Отклонен (rejected) - не показываем действия
      else if (relationship === 'rejected') {
        return [];
      }
    }
    
    return actions;
  };
  
  const eventActions = getEventActions();
  const shouldShowThreeDots = eventActions.length > 0;
  
  // Функция для переключения видимости параметра
  const toggleParameterVisibility = (parameterName: string) => {
    if (parameterName === 'title') {
      return;
    }
    setLocalHiddenParameters(prev => ({
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
          <AppIcon name={isHidden ? 'eye' : 'eye'} size={18} color={isHidden ? 'rgba(244,244,245,0.3)' : Palette.accent} />
        </TouchableOpacity>
      </View>
    );
  };
  
  // Функция для сохранения скрытых параметров
  const handleSaveHiddenParameters = async () => {
    setIsEditingParameterVisibility(false);
    try {
      await updateEventProfile(eventId, {
        hiddenParameters: localHiddenParameters
      } as any);
    } catch (error) {
      logger.error('Failed to save hidden parameters:', error);
      Alert.alert(t.common.error, t.messages.couldNotSave);
    }
  };
  
  // Функция для изменения фото события
  const handleChangePhoto = async () => {
    if (!currentUserId || !event) return;
    
    const hasPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (hasPermission.status !== 'granted') {
      Alert.alert(t.common.error, 'Нет доступа к галерее');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] && event) {
      setPersonalEventPhoto(event.id, currentUserId, result.assets[0].uri);
      Alert.alert(t.common.success, 'Фото события изменено');
    }
  };

  const handleAddPhoto = async () => {
    if (!currentUserId) {
      Alert.alert(t.eventProfile.authorization, t.eventProfile.signInToAddContent);
      return;
    }

    try {
      if (Platform.OS === 'web') {
        // Для веба используем input type="file" с множественным выбором
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true; // Разрешаем выбор нескольких файлов
        input.onchange = async (event) => {
          const files = (event.target as HTMLInputElement).files;
          if (files && files.length > 0) {
            const fileArray = Array.from(files);
            const currentPhotoCount = selectedPhotos.length;
            
            // Обрабатываем каждый файл
            const photosWithIndex = await Promise.all(
              fileArray.map(async (file, index) => {
                // Создаем data URL для превью
                const uri = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    resolve(e.target?.result as string);
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(file);
                });
                
                return {
                  uri,
                  index: currentPhotoCount + index + 1,
                  id: `${file.name}-${Date.now()}-${index}`,
                  file, // Сохраняем File объект для загрузки на вебе
                };
              })
            );
            
            setSelectedPhotos(prev => {
              const updated = [...prev, ...photosWithIndex];
              // Пересчитываем индексы для всех фото
              return updated.map((p, i) => ({ ...p, index: i + 1 }));
            });
          }
        };
        input.click();
        return;
      }

      // Для нативных платформ используем expo-image-picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 0.7, // Уменьшаем качество для уменьшения размера файлов
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Сохраняем выбранные фото с нумерацией и уникальным ID
        const photosWithIndex = result.assets.map((asset, index) => ({
          uri: asset.uri,
          index: index + 1,
          id: `${asset.uri}-${Date.now()}-${index}`, // Уникальный ID для каждого фото
        }));
        setSelectedPhotos(prev => [...prev, ...photosWithIndex]);
      }
    } catch (error) {
      logger.error('Failed to pick photos:', error);
      Alert.alert(t.common.error, t.eventProfile.photoPickFailed);
    }
  };

  // Функция для сжатия фото перед загрузкой
  const compressPhoto = async (uri: string, file?: File): Promise<string | File> => {
    if (Platform.OS === 'web' && file) {
      // На вебе используем File объект напрямую (браузер сам обработает)
      return file;
    }
    
    try {
      // Сжимаем изображение: максимум 1200px по ширине, качество 0.75
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Максимальная ширина 1200px (сохраняет пропорции)
        { 
          compress: 0.75, // Качество 75% (хороший баланс между качеством и размером)
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      logger.debug('Фото сжато:', { original: uri, compressed: manipResult.uri });
      return manipResult.uri;
    } catch (error) {
      logger.warn('Не удалось сжать фото, используем оригинал:', error);
      // Если сжатие не удалось, возвращаем оригинальный URI
      return uri;
    }
  };

  const handleUploadSelectedPhotos = async () => {
    if (!currentUserId || selectedPhotos.length === 0) {
      return;
    }

    if (isUploadingPhotos) {
      return; // Предотвращаем множественные загрузки
    }

    setIsUploadingPhotos(true);

    try {
      // Загружаем фото в порядке нумерации
      const sortedPhotos = [...selectedPhotos].sort((a, b) => a.index - b.index);
      const successfulUploads: string[] = [];
      const failedUploads: Array<{ photo: typeof sortedPhotos[0]; error: any }> = [];
      
      // Если объединяем в один пост - создаем один пост с каруселью
      if (combineIntoOnePost && sortedPhotos.length > 1) {
        try {
          // Загружаем все фото по очереди и получаем их URL
          const uploadedUrls: string[] = [];
          const temporaryPostIds: string[] = []; // ID временных постов для удаления
          
          for (const photo of sortedPhotos) {
            try {
              // Загружаем фото через FormData и получаем URL
              // ВАЖНО: создаем временный пост только для получения URL
              const formData = new FormData();
              
              if (Platform.OS === 'web' && photo.file) {
                // На вебе используем File объект напрямую
                formData.append('file', photo.file);
              } else {
                // Для мобильных платформ сжимаем фото перед загрузкой
                const compressedUri = await compressPhoto(photo.uri) as string;
              const filename = compressedUri.split('/').pop() || 'photo.jpg';
              const match = /\.(\w+)$/.exec(filename);
              const type = match ? `image/${match[1]}` : 'image/jpeg';
              
              formData.append('file', {
                uri: compressedUri,
                name: filename,
                type: type,
              } as any);
              }
              
              // Используем токен из useAuth (уже определен в компоненте)
              if (!accessToken) {
                throw new Error('No access token');
              }
              
              const uploadResponse = await fetch(`${API_BASE_URL}/events/${eventId}/profile/posts`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
                body: formData,
              });
              
              if (!uploadResponse.ok) {
                throw new Error(`Failed to upload photo ${photo.index}`);
              }
              
              const uploadResult = await uploadResponse.json();
              logger.debug(`Загружено фото ${photo.index}:`, { 
                postId: uploadResult.id, 
                photoUrl: uploadResult.photoUrl,
                hasId: !!uploadResult.id 
              });
              if (uploadResult.photoUrl) {
                uploadedUrls.push(uploadResult.photoUrl);
                // Сохраняем ID временного поста для последующего удаления
                if (uploadResult.id) {
                  temporaryPostIds.push(uploadResult.id);
                  logger.debug(`Добавлен ID временного поста: ${uploadResult.id}`);
                } else {
                  logger.warn(`⚠️ Временный пост не имеет ID:`, uploadResult);
                }
              } else {
                logger.warn(`⚠️ Загруженное фото не имеет photoUrl:`, uploadResult);
              }
              
              // Задержка между загрузками
              if (sortedPhotos.indexOf(photo) < sortedPhotos.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 800));
              }
            } catch (error: any) {
              logger.error(`Failed to upload photo ${photo.index} for carousel:`, error);
              failedUploads.push({ photo, error });
            }
          }
          
          // Если все фото загружены, создаем один пост с массивом URL
          if (uploadedUrls.length > 0) {
            logger.debug(`Создаем финальный пост с каруселью: ${uploadedUrls.length} фото`, {
              photoUrls: uploadedUrls,
              captions: sortedPhotos.slice(0, uploadedUrls.length).map(p => p.caption || ''),
              content: contentCaption || '',
            });
            
            // Создаем финальный пост с каруселью
            logger.debug(`Создаем финальный пост с каруселью:`, {
              eventId,
              authorId: currentUserId,
              content: contentCaption || '',
              photoUrls: uploadedUrls,
              photoUrlsCount: uploadedUrls.length,
              captions: sortedPhotos.slice(0, uploadedUrls.length).map(p => p.caption || ''),
              captionsCount: sortedPhotos.slice(0, uploadedUrls.length).length,
            });
            
            if (!currentUserId) {
              throw new Error('Current user ID is required');
            }
            
            const finalPost = await addEventProfilePost(eventId, {
              authorId: currentUserId,
              content: contentCaption || '',
              photoUrls: uploadedUrls, // Массив фото для карусели
              captions: sortedPhotos.slice(0, uploadedUrls.length).map(p => p.caption || ''), // Массив описаний для каждого фото
            } as Omit<EventProfilePost, 'id' | 'eventId' | 'createdAt'>);
            
            const finalPostTyped = (finalPost as unknown) as EventProfilePost | null;
            
            logger.debug(`✅ Финальный пост с каруселью создан:`, {
              postId: finalPostTyped?.id,
              hasPhotoUrls: !!(finalPostTyped as any)?.photoUrls,
              photoUrlsCount: Array.isArray((finalPostTyped as any)?.photoUrls) ? (finalPostTyped as any).photoUrls.length : 0,
              photoUrls: (finalPostTyped as any)?.photoUrls,
              temporaryPostIdsCount: temporaryPostIds.length,
              temporaryPostIds: temporaryPostIds,
            });
            
            // После успешного создания поста НЕ вызываем fetchEventProfile автоматически
            // чтобы избежать дублирования - пост уже добавлен в локальный state через addEventProfilePost
            
            // Удаляем временные посты, которые были созданы при загрузке файлов
            // ВАЖНО: удаляем только если финальный пост успешно создан И имеет photoUrls
            if (finalPostTyped && Array.isArray((finalPostTyped as any).photoUrls) && (finalPostTyped as any).photoUrls.length > 0) {
              if (temporaryPostIds.length > 0) {
                logger.debug(`Удаляем ${temporaryPostIds.length} временных постов:`, temporaryPostIds);
                // Удаляем все временные посты параллельно для ускорения
                const deletePromises = temporaryPostIds.map(async (tempPostId) => {
                  try {
                    logger.debug(`Удаляем временный пост: ${tempPostId}`);
                    await deleteEventProfilePost(eventId, tempPostId);
                    logger.debug(`✅ Удален временный пост: ${tempPostId}`);
                    return { success: true, postId: tempPostId };
                  } catch (error) {
                    logger.warn(`⚠️ Не удалось удалить временный пост ${tempPostId}:`, error);
                    return { success: false, postId: tempPostId, error };
                  }
                });
                
                const deleteResults = await Promise.all(deletePromises);
                const successCount = deleteResults.filter(r => r.success).length;
                const failCount = deleteResults.filter(r => !r.success).length;
                logger.debug(`Удаление временных постов завершено: ${successCount} успешно, ${failCount} ошибок`);
              } else {
                logger.warn(`⚠️ Нет временных постов для удаления (temporaryPostIds пуст, но финальный пост создан)`);
              }
            } else {
              logger.warn(`⚠️ Финальный пост не создан или не имеет photoUrls:`, {
                hasFinalPost: !!finalPostTyped,
                hasPhotoUrls: !!(finalPostTyped as any)?.photoUrls,
                photoUrlsCount: Array.isArray((finalPostTyped as any)?.photoUrls) ? (finalPostTyped as any).photoUrls.length : 0,
                temporaryPostIdsCount: temporaryPostIds.length,
              });
            }
            
            // Все успешно загруженные фото помечаем как успешные
            successfulUploads.push(...sortedPhotos.slice(0, uploadedUrls.length).map(p => p.id));
          }
        } catch (error: any) {
          logger.error('Failed to upload combined post:', error);
          failedUploads.push(...sortedPhotos.map(photo => ({ photo, error })));
        }
      } else {
        // Если не объединяем - создаем отдельные посты для каждого фото
        for (const photo of sortedPhotos) {
          try {
            let photoUrl: string;
            
            // ВАЖНО: Используем только addEventProfilePost для создания поста
            // НЕ делаем прямой запрос к API, чтобы избежать дублирования
            if (Platform.OS === 'web' && photo.file) {
              // На вебе создаем File объект для передачи в addEventProfilePost
              // addEventProfilePost сам обработает загрузку через FormData
              await addEventProfilePost(eventId, {
                authorId: currentUserId,
                content: photo.caption || `Фото ${photo.index} с события!`,
                photoUrl: photo.file as any, // Передаем File объект напрямую
              });
            } else {
              // Для мобильных платформ сжимаем фото перед загрузкой
              const compressedUri = await compressPhoto(photo.uri) as string;
            
            await addEventProfilePost(eventId, {
              authorId: currentUserId,
              content: photo.caption || `Фото ${photo.index} с события!`,
              photoUrl: compressedUri, // Используем сжатое фото
            });
            }
            successfulUploads.push(photo.id);
            
            // Увеличиваем задержку между загрузками для предотвращения перегрузки сервера
            if (sortedPhotos.indexOf(photo) < sortedPhotos.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 800)); // Увеличено с 300ms до 800ms
            }
          } catch (error: any) {
            logger.error(`Failed to upload photo ${photo.index}:`, error);
            failedUploads.push({ photo, error });
            
            // Если ошибка 413 (Payload Too Large), пропускаем это фото и продолжаем
            const isPayloadTooLarge = error?.status === 413 || 
                                      error?.message?.includes('413') || 
                                      error?.message?.toLowerCase().includes('payload too large') ||
                                      error?.message?.toLowerCase().includes('too large');
            
            if (isPayloadTooLarge) {
              // Не показываем Alert для каждого фото отдельно, чтобы не спамить
              // Покажем общее сообщение в конце
            }
          }
        }
      }

      // Удаляем только успешно загруженные фото из списка
      if (successfulUploads.length > 0) {
        setSelectedPhotos(prev => prev.filter(p => !successfulUploads.includes(p.id)));
      }
      
      // Если все фото загружены успешно, очищаем caption и сбрасываем чекбокс
      if (failedUploads.length === 0 && successfulUploads.length === sortedPhotos.length) {
        setContentCaption('');
        setCombineIntoOnePost(false);
        setSelectedPhotos([]);
        // Сбрасываем contentType, чтобы при следующем открытии показывался выбор типа контента
        setContentType(null);
      }
      
      // Показываем итоговое сообщение
      const payloadTooLargeCount = failedUploads.filter(f => {
        const error = f.error;
        return error?.status === 413 || 
               error?.message?.includes('413') || 
               error?.message?.toLowerCase().includes('payload too large') ||
               error?.message?.toLowerCase().includes('too large');
      }).length;
      
      if (successfulUploads.length > 0 && failedUploads.length === 0) {
        const message = combineIntoOnePost && sortedPhotos.length > 1
          ? `Создан пост с ${successfulUploads.length} фото`
          : `Загружено ${successfulUploads.length} фото`;
        Alert.alert(t.common.success, message);
        // Если все фото загружены успешно, закрываем модальное окно
        setShowAddContentModal(false);
      } else if (successfulUploads.length > 0 && failedUploads.length > 0) {
        const message = payloadTooLargeCount > 0
          ? `Загружено ${successfulUploads.length} из ${sortedPhotos.length} фото. ${payloadTooLargeCount} фото слишком большие и не были загружены. Попробуйте выбрать фото меньшего размера.`
          : `Загружено ${successfulUploads.length} из ${sortedPhotos.length} фото. ${failedUploads.length} фото не удалось загрузить.`;
        Alert.alert(t.eventProfile.partiallySuccessful, message);
        // Если есть успешные загрузки, но не все - оставляем модальное окно открытым для повторной попытки
      } else if (failedUploads.length > 0) {
        const message = payloadTooLargeCount > 0
          ? `Не удалось загрузить ${failedUploads.length} фото. Файлы слишком большие. Попробуйте выбрать фото меньшего размера или уменьшите качество.`
          : `Не удалось загрузить ${failedUploads.length} фото. Попробуйте еще раз.`;
        Alert.alert(t.common.error, message);
        // Если все загрузки провалились - оставляем модальное окно открытым для повторной попытки
      }
    } catch (error) {
      logger.error('Error in handleUploadSelectedPhotos:', error);
      Alert.alert(t.common.error, t.eventProfile.photoTooLarge);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setSelectedPhotos(prev => {
      const filtered = prev.filter(p => p.id !== photoId);
      // Пересчитываем индексы после удаления
      return filtered.map((p, i) => ({ ...p, index: i + 1 }));
    });
  };

  // Функции для воспроизведения музыки
  const playTrack = async (trackUrl: string, trackId: string) => {
    try {
      // Останавливаем текущий трек если он играет
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }

      // Если кликнули на тот же трек - останавливаем
      if (currentPlayingTrack === trackId) {
        setCurrentPlayingTrack(null);
        setIsPlaying(false);
        return;
      }

      // Проверяем, что URL валидный
      if (!trackUrl || !trackUrl.startsWith('http')) {
        logger.warn('Некорректная ссылка на трек:', trackUrl);
        return;
      }

      // Загружаем и воспроизводим новый трек
      const { sound } = await Audio.Sound.createAsync(
        { uri: trackUrl },
        { shouldPlay: true }
      );
      
      soundRef.current = sound;
      setCurrentPlayingTrack(trackId);
      setIsPlaying(true);

      // Обработка окончания трека
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setCurrentPlayingTrack(null);
          setIsPlaying(false);
        }
      });
    } catch (error) {
      logger.error('Ошибка воспроизведения:', error);
      setCurrentPlayingTrack(null);
      setIsPlaying(false);
    }
  };

  // Функции для ленты контента
  const handlePostPress = (post: any) => {
    setSelectedPost(post);
    setShowContentFeed(true);
    
    // Прокручиваем к выбранному посту
    setTimeout(() => {
      const postIndex = displayProfile.posts.findIndex((p: any) => p.id === post.id);
      if (scrollViewRef.current && postIndex !== -1) {
        const screenHeight = Dimensions.get('window').height;
        const cardHeight = screenHeight * 0.8; // Высота карточки MemoryPost
        const scrollToY = postIndex * cardHeight - (screenHeight - cardHeight) / 2;
        scrollViewRef.current.scrollTo({ y: Math.max(0, scrollToY), animated: true });
      }
    }, 100);
  };

  const handleBackToProfile = () => {
    // Останавливаем музыку при возврате
    if (soundRef.current) {
      soundRef.current.stopAsync();
      soundRef.current.unloadAsync();
    }
    setCurrentPlayingTrack(null);
    setIsPlaying(false);
    setShowContentFeed(false);
    setSelectedPost(null);
  };


  const renderPosts = () => {
    if (displayProfile.posts.length === 0) {
      return (
        <View style={styles.emptyPosts}>
          <Text style={styles.emptyPostsText}>{t.empty.noPosts}</Text>
        </View>
      );
    }

    // Для веб-версии используем ограниченную ширину контейнера (500px), для мобильных - полную ширину экрана
    const getContainerWidth = () => {
      const screenWidth = Dimensions.get('window').width;
      if (Platform.OS === 'web') {
        return Math.min(screenWidth, 500);
      }
      return screenWidth;
    };
    const containerWidth = getContainerWidth();
    const containerPadding = 0; // Нет отступов от краев
    const dividerWidth = 1; // Тонкая полоска между карточками (визуальный разделитель)
    const availableWidth = containerWidth - containerPadding;
    // Расчет ширины карточки: точно как в профиле пользователя
    // Делим доступную ширину на 3, вычитая 2 разделителя (между 3 колонками)
    // Важно: разделители занимают место, поэтому вычитаем их из доступной ширины
    // Расчет ширины: точно как в профиле пользователя
    // Делим доступную ширину на 3, вычитая 2 разделителя (между 3 колонками)
    // Используем Math.floor для точного деления без дробей
    const cardWidth = Math.floor((availableWidth - dividerWidth * 2) / 3); // 3 колонки с 2 разделителями
    const cardHeight = cardWidth * (4 / 3); // Высота для формата 3x4 (4/3 соотношение)
    
    // Логирование для отладки (всегда, не только в dev)

    return (
      <View style={[styles.postsGrid, { maxWidth: containerWidth, width: containerWidth }]}>
        {displayProfile.posts.map((post, index) => {
          const isLastInRow = (index + 1) % 3 === 0;
          const showRightDivider = !isLastInRow;
          
          return (
            <TouchableOpacity 
              key={post.id} 
              style={[
                styles.postItem,
                { 
                  width: cardWidth, 
                  maxWidth: cardWidth, 
                  minWidth: cardWidth,
                  flexBasis: cardWidth,
                  flexShrink: 0,
                  flexGrow: 0,
                },
                showRightDivider && styles.postItemWithRightDivider
              ]}
              onPress={() => handlePostPress(post)}
              activeOpacity={0.9}
            >
              {(() => {
                // Получаем превью фото: первое фото из карусели или одиночное фото
                const previewPhotoUrl = (post.photoUrls && post.photoUrls.length > 0)
                  ? post.photoUrls[0]
                  : (post.photoUrl || null);
                
                if (previewPhotoUrl) {
                  return (
                <Image 
                      source={{ uri: previewPhotoUrl }} 
                  style={[styles.postImage, { width: '100%', height: cardHeight }]} 
                  resizeMode="cover"
                />
                  );
                } else if (post.type === 'music') {
                  return (
                <View style={[styles.musicCard, { width: '100%', height: cardHeight }]}>
                  {post.artwork_url ? (
                    <Image 
                      source={{ uri: post.artwork_url || post.photoUrl || post.content }} 
                      style={styles.musicCoverImageFull}
                    />
                  ) : (
                    <View style={styles.musicPlaceholder}>
                      <AppIcon name="heart" size={16} color="rgba(244,244,245,0.5)" />
                    </View>
                  )}
                  {currentPlayingTrack === post.id ? (
                    <View style={styles.playingOverlay}>
                      <Text style={styles.playingIcon}>⏸️</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.playButtonOverlay}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (post.content) {
                          playTrack(post.content, post.id);
                        }
                      }}
                    >
                      <Text style={styles.playIconOverlay}>▶️</Text>
                    </TouchableOpacity>
                  )}
                </View>
                  );
                } else {
                  return (
                <View style={[styles.postTextContainer, { width: '100%', height: cardHeight }]}>
                  <Text style={styles.postText} numberOfLines={10}>{post.content}</Text>
                </View>
                  );
                }
              })()}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Кнопка назад - зафиксирована */}
      <TouchableOpacity style={styles.backButtonFixed} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <ScrollView 
        style={styles.content}
        nestedScrollEnabled={true}
        removeClippedSubviews={false}
      >
        {/* Card-style header — same layout as EventCard */}
        {event && (() => {
          const effectiveViewerUserId = viewerUserId ? (Array.isArray(viewerUserId) ? viewerUserId[0] : viewerUserId) : undefined;
          const displayPhoto = getEventPhotoForUser(event.id, currentUserId ?? '', effectiveViewerUserId, true);
          const organizerData = getUserData(event.organizerId);
          const organizerAvatarUrl = (() => {
            const u = (organizerData.avatar ?? '').trim();
            if (!u || u === 'null' || u === 'undefined') return null;
            if (!/^https?:\/\//i.test(u)) return null;
            if (u.includes('cdn.jsdelivr.net/gh/identicons') || u.includes('ui-avatars.com')) return null;
            return u;
          })();
          const PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="69" height="69" viewBox="0 0 69 69"><circle cx="34.5" cy="34.5" r="33" fill="#5a5a5a"/><circle cx="34.5" cy="26.5" r="9.5" fill="#c4c4c4"/><ellipse cx="34.5" cy="52" rx="15" ry="11" fill="#c4c4c4"/></svg>')}`;
          const IMG_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440"><rect width="1080" height="1440" fill="#141417"/></svg>')}`;
          const photoUri = (displayPhoto && typeof displayPhoto === 'string') ? displayPhoto : IMG_PLACEHOLDER;
          const isoDateTime = `${event.date}T${event.time}:00`;

          return (
            <View style={epHeaderStyles.wrapper}>
              {/* Full-bleed image 3:4 */}
              <View style={epHeaderStyles.imageArea}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => { setFullImageUrl(event.originalMediaUrl || event.mediaUrl || photoUri); setShowImageModal(true); }}
                  style={StyleSheet.absoluteFill}
                >
                  <Image source={{ uri: photoUri }} style={[epHeaderStyles.image, StyleSheet.absoluteFillObject]} resizeMode="cover" />
                </TouchableOpacity>

                {/* Organizer — top-left */}
                <TouchableOpacity
                  style={epHeaderStyles.organizerContainer}
                  onPress={() => {
                    if (currentUserId === event.organizerId) router.push('/(tabs)/profile');
                    else router.push(`/profile/${event.organizerId}`);
                  }}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: organizerAvatarUrl || PLACEHOLDER }} style={epHeaderStyles.organizerAvatar} />
                  <Text style={epHeaderStyles.organizerName} numberOfLines={1}>
                    {organizerData.name || organizerData.username || ''}
                  </Text>
                </TouchableOpacity>

                {/* Participants badge — top-right */}
                {renderParameterWithOverlay('participants', (
                  <TouchableOpacity
                    style={epHeaderStyles.participantsBadgeWrap}
                    onPress={() => setShowParticipantsModal(true)}
                    activeOpacity={0.8}
                  >
                    <View style={epHeaderStyles.participantsBadge}>
                      <View style={epHeaderStyles.participantsMiniAvatars}>
                        {participants.slice(0, 3).map((pId, idx) => {
                          const pData = getUserData(pId);
                          return (
                            <Image
                              key={pId}
                              source={{ uri: pData.avatar || PLACEHOLDER }}
                              style={[epHeaderStyles.participantMiniAvatar, { marginLeft: idx > 0 ? -5 : 0 }]}
                            />
                          );
                        })}
                        {participantsCount > 3 && (
                          <View style={[epHeaderStyles.participantMiniAvatar, epHeaderStyles.participantMoreMini, { marginLeft: -5 }]}>
                            <Text style={epHeaderStyles.participantMoreMiniText}>+{participantsCount - 3}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={epHeaderStyles.participantsCountText}>
                        {participantsCount}{event.maxParticipants > 0 ? `/${event.maxParticipants}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ), localHiddenParameters.participants)}

                {/* Gradient + title + info */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.82)']}
                  style={epHeaderStyles.gradient}
                >
                  {/* Title */}
                  <Text style={epHeaderStyles.title}>{event.title}</Text>

                  {/* Info row: date, time, location, price */}
                  <View style={epHeaderStyles.infoRow}>
                    {renderParameterWithOverlay('date', (
                      <TouchableOpacity
                        style={epHeaderStyles.infoItem}
                        onPress={() => router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${eventId}`)}
                      >
                        <AppIcon name="calendar" size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={epHeaderStyles.infoText}>{event.displayDate || event.date}</Text>
                      </TouchableOpacity>
                    ), localHiddenParameters.date)}

                    {renderParameterWithOverlay('time', (
                      <TouchableOpacity
                        style={epHeaderStyles.infoItem}
                        onPress={() => router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${eventId}`)}
                      >
                        <AppIcon name="clock" size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={epHeaderStyles.infoText}>{event.time}</Text>
                      </TouchableOpacity>
                    ), localHiddenParameters.time)}

                    {renderParameterWithOverlay('location', (
                      !event.coordinates ? (
                        <View style={epHeaderStyles.infoItem}>
                          <AppIcon name="pin" size={12} color="rgba(255,255,255,0.8)" />
                          <Text style={epHeaderStyles.infoText}>{t.eventProfile.online}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={epHeaderStyles.infoItem} onPress={() => router.push(`/map?eventId=${eventId}`)}>
                          <AppIcon name="pin" size={12} color="rgba(255,255,255,0.8)" />
                          <Text style={epHeaderStyles.infoText} numberOfLines={1}>{event.location}</Text>
                        </TouchableOpacity>
                      )
                    ), localHiddenParameters.location)}

                    {event.price ? renderParameterWithOverlay('price', (
                      <View style={epHeaderStyles.infoItem}>
                        <AppIcon name="card" size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={epHeaderStyles.infoText}>{event.price}</Text>
                      </View>
                    ), localHiddenParameters.price) : null}
                  </View>

                  {/* Description — fully expanded, no collapse button */}
                  {event.description ? renderParameterWithOverlay('description', (
                    <Text style={epHeaderStyles.description}>{event.description}</Text>
                  ), localHiddenParameters.description) : null}
                </LinearGradient>

                {/* Three dots — bottom right */}
                {shouldShowThreeDots && !isEditingParameterVisibility && (
                  <TouchableOpacity
                    style={styles.eventActionsButton}
                    onPress={() => setShowEventActionsModal(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <AppIcon name="more" size={18} color={Palette.text} />
                  </TouchableOpacity>
                )}

                {/* Save button in edit mode */}
                {isEditingParameterVisibility && (
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveHiddenParameters}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.saveButtonText}>{t.common.save}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}

        {/* Toolbar: линия + кнопки */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          {isMember && (
            <TouchableOpacity
              style={styles.addContentButton}
              onPress={() => {
                setContentType(null);
                setContentCaption('');
                setSelectedPhotos([]);
                setCombineIntoOnePost(false);
                setShowAddContentModal(true);
              }}
            >
              <Text style={styles.addContentIcon}>+</Text>
            </TouchableOpacity>
          )}
          {(() => {
            const eventChat = currentUserId
              ? getChatsForUser(currentUserId).find(c => c.eventId === eventId && c.type === 'event')
              : null;
            if (!eventChat) return null;
            return (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => router.push(`/(tabs)/inbox/${eventChat.id}`)}
              >
                <AppIcon name="message" size={16} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            );
          })()}
          <View style={styles.dividerLine} />
        </View>

        {/* Posts */}
        <View style={styles.postsSection}>
          {renderPosts()}
        </View>
      </ScrollView>

      {/* Content Feed */}
      {showContentFeed && (
        <View style={styles.contentFeedContainer}>
          <TouchableOpacity 
            style={styles.backToProfileButton}
            onPress={handleBackToProfile}
          >
            <Text style={styles.backToProfileText}>← {t.eventProfile.backToProfile}</Text>
          </TouchableOpacity>
          
          <ScrollView 
            ref={scrollViewRef}
            style={styles.contentFeedScroll}
            contentContainerStyle={styles.contentFeedContent}
            showsVerticalScrollIndicator={false}
          >
            {currentEventProfile?.posts.map((post, index) => (
              <MemoryPost 
                key={post.id}
                post={post}
                showOptions={true}
                onNavigate={handleNavigate}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Модальное окно с участниками */}
      <ParticipantsModal
        visible={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        eventId={eventId}
      />

      {/* Модальное окно действий с событием */}
      <Modal
        visible={showEventActionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEventActionsModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowEventActionsModal(false)}
          />
          <View style={styles.actionsModalContainer}>
            <View style={styles.actionsModalHandle} />
            <View style={styles.actionsModalHeader}>
              <Text style={styles.actionsModalTitle}>{t.common.actions}</Text>
              <TouchableOpacity style={styles.actionsModalCloseBtn} onPress={() => setShowEventActionsModal(false)}>
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
                    if (action.id === 'hide_parameters') {
                      setIsEditingParameterVisibility(true);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'change_photo') {
                      handleChangePhoto();
                      setShowEventActionsModal(false);
                    } else if (action.id === 'save') {
                      if (isEventSaved(eventId)) {
                        removeSavedEvent(eventId);
                        Alert.alert(t.common.success, t.messages.removedFromSaved || 'Event removed from saved');
                      } else {
                        saveEvent(eventId, event);
                        Alert.alert(t.common.success, t.messages.saved || 'Event saved');
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'share') {
                      // TODO: Реализовать функционал "Поделиться"
                      setShowEventActionsModal(false);
                    } else if (action.id === 'accept_invite') {
                      // Принятие приглашения - переход в календарь
                      if (event) {
                        const isoDateTime = `${event.date}T${event.time}:00`;
                        // Находим приглашение для этого события
                        const inviteRequest = eventRequests.find(req => 
                          req.eventId === eventId && 
                          req.type === 'invite' && 
                          req.status === 'pending' &&
                          req.toUserId === currentUserId
                        );
                        const inviteId = inviteRequest?.id;
                        router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${eventId}${inviteId ? `&inviteId=${inviteId}` : ''}`);
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_invite') {
                      // Отклонение приглашения
                      const inviteRequest = eventRequests.find(req => 
                        req.eventId === eventId && 
                        req.type === 'invite' && 
                        req.status === 'pending' &&
                        req.toUserId === currentUserId
                      );
                      if (inviteRequest) {
                        rejectInvitation(inviteRequest.id).catch(error => {
                          logger.error('Ошибка при отклонении приглашения:', error);
                          Alert.alert(t.common.error, t.events.failedToDeclineInvitation || 'Failed to decline invitation');
                        });
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'schedule') {
                      // Переход в календарь для планирования (всегда кликабельно)
                      if (event) {
                        // Для регулярных событий показываем модальное окно со списком дат
                        if (event.isRecurring) {
                          // TODO: Добавить модальное окно для регулярных событий
                          Alert.alert(t.eventProfile.information, 'Для регулярных событий выберите конкретную дату');
                        } else {
                          const isoDateTime = `${event.date}T${event.time}:00`;
                          router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${eventId}`);
                        }
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_request') {
                      // Отмена запроса (всегда кликабельно, как по свайпу)
                      if (currentUserId) {
                        cancelEventRequest(eventId, currentUserId);
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_participation') {
                      // Отмена участия
                      if (event && currentUserId) {
                        cancelEventParticipation(eventId, currentUserId);
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_event') {
                      // Отмена события - если участников больше 1, показываем попап с transfer organizer role
                      const participantsCount = getEventParticipants(eventId).length;
                      if (participantsCount > 1) {
                        setShowTransferOrganizerModal(true);
                        setShowEventActionsModal(false);
                      } else {
                        // Если участник только организатор, просто отменяем событие
                      if (event) {
                        cancelEvent(eventId);
                      }
                      setShowEventActionsModal(false);
                      }
                    } else if (action.id === 'cancel_organizer_participation') {
                      // Отмена участия организатора
                      if (event) {
                        cancelOrganizerParticipation(eventId);
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'change_parameters') {
                      // Изменение параметров события
                      router.push(`/(tabs)/create?eventId=${eventId}`);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'extend_recurring') {
                      // Продление регулярного события
                      router.push(`/(tabs)/create?eventId=${eventId}`);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'remove_participant') {
                      // Удаление участника (для организатора)
                      // TODO: Реализовать выбор участника для удаления
                      Alert.alert(t.common.confirm || 'Info', t.eventProfile.selectParticipantToRemove);
                      setShowEventActionsModal(false);
                    } else if (action.id === 'view_requests') {
                      // Переход в "Мои запросы" (всегда кликабельно)
                      router.push('/(tabs)/inbox');
                      setShowEventActionsModal(false);
                    } else if (action.id === 'go_to_chat' && action.isClickable) {
                      // Переход в чат события
                      const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === eventId && c.type === 'event');
                      if (eventChat) {
                        router.push(`/(tabs)/inbox/${eventChat.id}`);
                        setShowEventActionsModal(false);
                      }
                    } else if (action.id === 'report') {
                      setShowEventActionsModal(false);
                      setShowComplaintForm(true);
                    } else {
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


      {/* Add Content Modal */}
      <Modal
        visible={showAddContentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddContentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.eventProfile.addContent}</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setShowAddContentModal(false);
                  setContentType(null);
                  setContentCaption('');
                  setSelectedPhotos([]);
                }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {!contentType ? (
              <View style={styles.contentTypeButtons}>
                <TouchableOpacity
                  style={styles.contentTypeButton}
                  onPress={() => setContentType('photo')}
                  activeOpacity={0.7}
                >
                  <View style={styles.contentTypeIconWrap}>
                    <AppIcon name="image" size={24} color="#f4f4f5" />
                  </View>
                  <Text style={styles.contentTypeText}>{t.eventProfile.photo}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.contentTypeButton}
                  onPress={() => setContentType('text')}
                  activeOpacity={0.7}
                >
                  <View style={styles.contentTypeIconWrap}>
                    <AppIcon name="edit" size={24} color="#f4f4f5" />
                  </View>
                  <Text style={styles.contentTypeText}>{t.eventProfile.text}</Text>
                </TouchableOpacity>
              </View>
            ) : contentType === 'photo' ? (
              <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={true}>
                {/* Чекбокс "объединить в один пост" - показывается только если выбрано несколько фото */}
                {selectedPhotos.length > 1 && (
                  <View style={styles.checkboxContainer}>
                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() => setCombineIntoOnePost(!combineIntoOnePost)}
                    >
                      <View style={[styles.checkboxBox, combineIntoOnePost && styles.checkboxBoxChecked]}>
                        {combineIntoOnePost && <Text style={styles.checkboxCheckmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxLabel}>{t.eventProfile.mergeIntoOnePost}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Если объединены в один пост - одно поле описания */}
                {combineIntoOnePost && selectedPhotos.length > 1 ? (
                  <TextInput
                    style={[styles.editInput, styles.editTextArea]}
                    placeholder={t.eventProfile.descriptionOptional}
                    placeholderTextColor="#999"
                    value={contentCaption}
                    onChangeText={setContentCaption}
                    multiline
                    numberOfLines={3}
                  />
                ) : (
                  /* Если не объединены - несколько полей описания (номер фото слева, описание справа) */
                  selectedPhotos.length > 0 && (
                    <View style={styles.photoCaptionsContainer}>
                      {selectedPhotos.map((photo) => (
                        <View key={photo.id} style={styles.photoCaptionRow}>
                          <View style={styles.photoNumberBadge}>
                            <Text style={styles.photoNumberText}>{photo.index}</Text>
                          </View>
                          <TextInput
                            style={[styles.editInput, styles.photoCaptionInput]}
                            placeholder={`Описание для фото ${photo.index} (необязательно)`}
                            placeholderTextColor="#999"
                            value={photo.caption || ''}
                            onChangeText={(text) => {
                              setSelectedPhotos(prev => 
                                prev.map(p => p.id === photo.id ? { ...p, caption: text } : p)
                              );
                            }}
                            multiline
                            numberOfLines={2}
                          />
                        </View>
                      ))}
                    </View>
                  )
                )}
                
                {/* Отображение выбранных фото с нумерацией */}
                {selectedPhotos.length > 0 && (
                  <ScrollView 
                    horizontal 
                    style={{ marginVertical: 10, maxHeight: 150 }}
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled={true}
                  >
                    {selectedPhotos.map((photo) => (
                      <View key={photo.id} style={{ marginRight: 10, position: 'relative' }}>
                        <Image 
                          source={{ uri: photo.uri }} 
                          style={{ width: 100, height: 100, borderRadius: 8 }}
                          resizeMode="cover"
                          onError={(error) => {
                            logger.error('Failed to load image:', error);
                          }}
                        />
                        <View style={{
                          position: 'absolute',
                          top: 5,
                          left: 5,
                          backgroundColor: '#FF8D32',
                          borderRadius: 12,
                          width: 24,
                          height: 24,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <Text style={{ color: '#f4f4f5', fontSize: 12, fontWeight: 'bold' }}>
                            {photo.index}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{
                            position: 'absolute',
                            top: 5,
                            right: 5,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            borderRadius: 12,
                            width: 24,
                            height: 24,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => handleRemovePhoto(photo.id)}
                        >
                          <Text style={{ color: '#f4f4f5', fontSize: 16 }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
                
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => {
                    setContentType(null);
                    setContentCaption('');
                    setSelectedPhotos([]);
                    setCombineIntoOnePost(false);
                  }}>
                    <Text style={styles.cancelButtonText}>{t.eventProfile.back}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.saveButton, selectedPhotos.length === 0 && { opacity: 0.5 }]} 
                    onPress={selectedPhotos.length > 0 ? handleUploadSelectedPhotos : handleAddPhoto}
                    disabled={isUploadingPhotos}
                  >
                    <Text style={styles.saveButtonText}>
                      {selectedPhotos.length > 0 
                        ? (isUploadingPhotos ? t.common.loading : `Загрузить ${selectedPhotos.length} фото`)
                        : t.eventProfile.choosePhotoBtn}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <View>
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  placeholder={t.eventProfile.enterPostText || 'Enter post text'}
                  placeholderTextColor="#999"
                  value={contentCaption}
                  onChangeText={setContentCaption}
                  multiline
                  numberOfLines={6}
                />
                
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => {
                    setContentType(null);
                    setContentCaption('');
                  }}>
                    <Text style={styles.cancelButtonText}>{t.eventProfile.back}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.saveButton} onPress={() => {
                    if (contentCaption.trim()) {
                      if (!currentUserId) {
                        Alert.alert(t.eventProfile.authorization, t.eventProfile.signInToAddContent);
                        return;
                      }
                      addEventProfilePost(eventId, {
                        authorId: currentUserId,
                        type: 'text',
                        content: contentCaption.trim(),
                        caption: ''
                      });
                      // НЕ закрываем модальное окно и НЕ сбрасываем состояние, чтобы можно было добавить еще
                      // setShowAddContentModal(false);
                      setContentCaption('');
                      // setContentType(null);
                    }
                  }}>
                    <Text style={styles.saveButtonText}>{t.common.add}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Модальное окно для просмотра полного фото */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowImageModal(false)}
          />
          {fullImageUrl && (
            <Image
              source={{ uri: fullImageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.imageModalCloseButton}
            onPress={() => setShowImageModal(false)}
          >
            <Text style={styles.imageModalCloseText}>✕</Text>
          </TouchableOpacity>
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
            <View style={styles.actionsModalHandle} />
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>{t.events.transferOrganizer}</Text>
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
              Выберите участника, которому хотите передать роль организатора. После передачи вы выйдете из события, а новый организатор будет управлять им.
            </Text>
            
            <ScrollView style={styles.shareModalList}>
              {(() => {
                // Получаем список участников (исключая текущего организатора)
                const participants = getEventParticipants(eventId);
                const organizerId = event?.organizerId;
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
                          {participantData?.name || participantData?.username || t.events.userFallback}
                        </Text>
                        {participantData?.username && participantData.username !== participantData?.name && (
                          <Text style={styles.shareModalItemSubtext}>
                            @{participantData.username}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.shareModalCheckbox, isSelected && { backgroundColor: '#FF8D32', borderColor: '#FF8D32' }]}>
                        {isSelected && <Text style={styles.shareModalCheckboxText}>✓</Text>}
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
                    await transferOrganizerRole(eventId, selectedNewOrganizerId);
                    setShowTransferOrganizerModal(false);
                    setSelectedNewOrganizerId(null);
                    // После успешной передачи роли данные обновятся через syncEventsFromServer
                    // Событие автоматически исчезнет из календаря и списка участников
                  } else {
                    Alert.alert(t.common.error, t.events.transferRoleUnavailable);
                  }
                } catch (error: any) {
                  logger.error('Failed to transfer organizer role', error);
                  const errorMessage = error?.message || error?.body?.message || t.events.failedToTransferRole;
                  Alert.alert(t.common.error, errorMessage);
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

      <ComplaintForm
        visible={showComplaintForm}
        onClose={() => setShowComplaintForm(false)}
        type="EVENT"
        reportedEventId={eventId}
      />
    </View>
  );
}

const epHeaderStyles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  imageArea: {
    aspectRatio: 3 / 4,
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    resizeMode: 'cover',
  },
  organizerContainer: {
    position: 'absolute',
    top: 56,
    left: 68,
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
  organizerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  organizerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
    flexShrink: 1,
  },
  participantsBadgeWrap: {
    position: 'absolute',
    top: 56,
    right: 10,
    zIndex: 10,
  },
  participantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  participantsMiniAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantMiniAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  participantMoreMini: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantMoreMiniText: {
    color: '#f4f4f5',
    fontSize: 8,
    fontWeight: 'bold',
  },
  participantsCountText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginTop: 6,
  },
});

