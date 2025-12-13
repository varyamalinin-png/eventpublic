import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Audio } from 'expo-av';
import MemoryPost from '../../components/MemoryPost';
import ParticipantsModal from '../../components/ParticipantsModal';
import { createLogger } from '../../utils/logger';
import { API_BASE_URL } from '../../services/api';
import type { EventProfilePost } from '../../types/EventProfile';
import { eventProfileStyles } from './[id].styles';

const logger = createLogger('EventProfile');
const styles = eventProfileStyles;

export default function EventProfileScreen() {
  const { id, viewerUserId } = useLocalSearchParams();
  const router = useRouter();
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
    getChatsForUser
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
  const [isEditingParameterVisibility, setIsEditingParameterVisibility] = useState(false);
  const [localHiddenParameters, setLocalHiddenParameters] = useState<Record<string, boolean>>(hiddenParameters);
  
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
  const [contentType, setContentType] = useState<'photo' | 'music' | 'text' | null>(null);
  const [musicUrl, setMusicUrl] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtist, setMusicArtist] = useState('');
  const [contentCaption, setContentCaption] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<Array<{ uri: string; index: number; id: string; caption?: string }>>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [combineIntoOnePost, setCombineIntoOnePost] = useState(false); // Чекбокс "объединить в один пост"
  
  // Состояния для поиска музыки
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  
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
    if (!eventProfile && eventId && event && !attemptedProfiles.current.has(eventId)) {
      attemptedProfiles.current.add(eventId);
      // Пытаемся загрузить профиль с сервера
      // Профиль доступен всем для просмотра, редактирование доступно только участникам
      fetchEventProfile(eventId).then((profile) => {
        if (!profile) {
          logger.debug('Профиль события не найден');
        }
        attemptedProfiles.current.delete(eventId);
      }).catch(() => {
        attemptedProfiles.current.delete(eventId);
      });
    }
  }, [eventId, eventProfile, event, fetchEventProfile]);

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

  // Используем данные из события как fallback, если профиля еще нет
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
  } : null);

  // Профиль события доступен всем для просмотра
  // Редактирование доступно только участникам (проверяется через canEditEventProfile)
  if (!displayProfile || !event) {
    return null;
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
        // Опция "go to chat" - активна только если пользователь является участником (accepted или organizer)
          const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === eventId && c.type === 'event');
        if (eventChat && (relationship === 'accepted' || relationship === 'organizer')) {
            actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: true });
        } else {
          actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: false });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 2: В ожидании (waiting)
      else if (relationship === 'waiting') {
        actions.push({ id: 'view_requests', label: t.events.viewRequests, isClickable: true });
        actions.push({ id: 'cancel_request', label: t.events.cancelRequest, isClickable: true });
        // Опция "go to chat" - активна только если пользователь является участником (accepted или organizer)
          const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === eventId && c.type === 'event');
        if (eventChat && (relationship === 'accepted' || relationship === 'organizer')) {
            actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: true });
        } else {
          actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: false });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 3: Участник (accepted)
      else if (relationship === 'accepted') {
        actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation });
        // Опция "go to chat" - активна только если пользователь является участником (accepted или organizer)
          const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === eventId && c.type === 'event');
        if (eventChat && (relationship === 'accepted' || relationship === 'organizer')) {
            actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: true });
        } else {
          actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: false });
        }
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 4: Организатор (organizer)
      else if (relationship === 'organizer') {
        actions.push({ id: 'change_parameters', label: t.events.changeParameters, isClickable: true });
        if (participantsCount === 1) {
          actions.push({ id: 'cancel_event', label: t.events.cancelEvent, isClickable: true });
        } else {
          actions.push({ id: 'transfer_organizer_role', label: t.events.transferOrganizerRole || 'Передать роль организатора', isClickable: true });
        }
        // Действие "продлить" для регулярных событий
        if (event.isRecurring) {
          actions.push({ id: 'extend_recurring', label: t.events.extendRecurring || 'Продлить', isClickable: true });
        }
        actions.push({ id: 'remove_participant', label: t.events.removeParticipant, isClickable: true });
        // Опция "go to chat" - активна только если пользователь является участником (accepted или organizer)
          const eventChat = getChatsForUser(currentUserId || '').find(c => c.eventId === eventId && c.type === 'event');
        if (eventChat && (relationship === 'accepted' || relationship === 'organizer')) {
            actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: true });
        } else {
          actions.push({ id: 'go_to_chat', label: 'Go to chat', isClickable: false });
        }
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
          <Text style={styles.eyeIcon}>{isHidden ? '👁️‍🗨️' : '👁️'}</Text>
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
      Alert.alert('Ошибка', 'Нет доступа к галерее');
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
      Alert.alert('Успешно', 'Фото события изменено');
    }
  };

  const handleAddPhoto = async () => {
    if (!currentUserId) {
      Alert.alert('Авторизация', 'Войдите, чтобы добавлять контент события.');
      return;
    }

    try {
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
      Alert.alert('Ошибка', 'Не удалось выбрать фото');
    }
  };

  // Функция для сжатия фото перед загрузкой
  const compressPhoto = async (uri: string): Promise<string> => {
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
              // Сжимаем фото перед загрузкой
              const compressedUri = await compressPhoto(photo.uri);
              
              // Загружаем фото через FormData и получаем URL
              // ВАЖНО: создаем временный пост только для получения URL
              const formData = new FormData();
              const filename = compressedUri.split('/').pop() || 'photo.jpg';
              const match = /\.(\w+)$/.exec(filename);
              const type = match ? `image/${match[1]}` : 'image/jpeg';
              
              formData.append('file', {
                uri: compressedUri,
                name: filename,
                type: type,
              } as any);
              
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
            // Сжимаем фото перед загрузкой для предотвращения ошибки 413
            const compressedUri = await compressPhoto(photo.uri);
            
            await addEventProfilePost(eventId, {
              authorId: currentUserId,
              content: photo.caption || `Фото ${photo.index} с события!`,
              photoUrl: compressedUri, // Используем сжатое фото
            });
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
        Alert.alert('Успешно', message);
        // Если все фото загружены успешно, закрываем модальное окно
        setShowAddContentModal(false);
      } else if (successfulUploads.length > 0 && failedUploads.length > 0) {
        const message = payloadTooLargeCount > 0
          ? `Загружено ${successfulUploads.length} из ${sortedPhotos.length} фото. ${payloadTooLargeCount} фото слишком большие и не были загружены. Попробуйте выбрать фото меньшего размера.`
          : `Загружено ${successfulUploads.length} из ${sortedPhotos.length} фото. ${failedUploads.length} фото не удалось загрузить.`;
        Alert.alert('Частично успешно', message);
        // Если есть успешные загрузки, но не все - оставляем модальное окно открытым для повторной попытки
      } else if (failedUploads.length > 0) {
        const message = payloadTooLargeCount > 0
          ? `Не удалось загрузить ${failedUploads.length} фото. Файлы слишком большие. Попробуйте выбрать фото меньшего размера или уменьшите качество.`
          : `Не удалось загрузить ${failedUploads.length} фото. Попробуйте еще раз.`;
        Alert.alert('Ошибка', message);
        // Если все загрузки провалились - оставляем модальное окно открытым для повторной попытки
      }
    } catch (error) {
      logger.error('Error in handleUploadSelectedPhotos:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить фото. Попробуйте выбрать фото меньшего размера.');
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

  // Функция поиска треков через SoundCloud API
  const searchTracks = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    
    // Пока используем только моковые данные, так как нужен реальный SoundCloud API ключ
    // В будущем можно заменить на реальный API вызов
    setTimeout(() => {
      const mockTracks = [
        {
          id: 1,
          title: `${query} - Remix`,
          user: { username: 'DJ Artist' },
          artwork_url: 'https://via.placeholder.com/300x300/FF6B6B/fff?text=🎵',
          stream_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
        },
        {
          id: 2,
          title: `${query} - Original Mix`,
          user: { username: 'Producer Name' },
          artwork_url: 'https://via.placeholder.com/300x300/4ECDC4/fff?text=🎶',
          stream_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
        },
        {
          id: 3,
          title: `${query} - Acoustic Version`,
          user: { username: 'Singer Name' },
          artwork_url: 'https://via.placeholder.com/300x300/45B7D1/fff?text=🎤',
          stream_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
        },
        {
          id: 4,
          title: `${query} - Instrumental`,
          user: { username: 'Band Name' },
          artwork_url: 'https://via.placeholder.com/300x300/96CEB4/fff?text=🎸',
          stream_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
        },
        {
          id: 5,
          title: `${query} - Live Performance`,
          user: { username: 'Live Artist' },
          artwork_url: 'https://via.placeholder.com/300x300/FFEAA7/fff?text=🎭',
          stream_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
        }
      ];
      
      setSearchResults(mockTracks);
      setIsSearching(false);
    }, 1000); // Имитируем задержку API
  };

  const handleTrackSelect = (track: any) => {
    setSelectedTrack(track);
    setMusicTitle(track.title);
    setMusicArtist(track.user.username);
    setMusicUrl(track.stream_url);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleAddMusic = () => {
    if (!musicUrl || !musicTitle || !musicArtist) {
      Alert.alert('Ошибка', 'Заполните все поля для добавления музыки');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Авторизация', 'Войдите, чтобы добавлять контент события.');
      return;
    }

    addEventProfilePost(eventId, {
      authorId: currentUserId,
      type: 'music',
      content: musicUrl,
      title: musicTitle,
      artist: musicArtist,
      artwork_url: selectedTrack?.artwork_url,
      caption: contentCaption || 'Трек ассоциируется с нашей встречей'
    });
    
    // НЕ закрываем модальное окно и НЕ сбрасываем состояние, чтобы можно было добавить еще
    // setShowAddContentModal(false);
    setMusicUrl('');
    setMusicTitle('');
    setMusicArtist('');
    setContentCaption('');
    setSelectedTrack(null);
    setSearchResults([]);
    setSearchQuery('');
    // setContentType(null);
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

    const SCREEN_WIDTH = Dimensions.get('window').width;
    const containerPadding = 0; // Нет отступов от краев
    const gap = 0; // Нет отступов между карточками
    const dividerWidth = 1; // Тонкая полоска между карточками
    const availableWidth = SCREEN_WIDTH - containerPadding;
    const cardWidth = (availableWidth - dividerWidth * 2) / 3; // 3 колонки с 2 разделителями
    const cardHeight = cardWidth * (4 / 3); // Высота для формата 3x4 (4/3 соотношение)

    return (
      <View style={styles.postsGrid}>
        {displayProfile.posts.map((post, index) => {
          const isLastInRow = (index + 1) % 3 === 0;
          const showRightDivider = !isLastInRow;
          
          return (
            <TouchableOpacity 
              key={post.id} 
              style={[
                styles.postItem,
                { width: cardWidth },
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
                      <Text style={styles.musicIcon}>🎵</Text>
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
        {/* Event Info */}
        {/* Аватар события - от края до края */}
        {(() => {
          const effectiveViewerUserId = viewerUserId ? (Array.isArray(viewerUserId) ? viewerUserId[0] : viewerUserId) : undefined;
          const canChangePhoto = event && currentUserId && isEventPast(event) && isUserEventMember(event, currentUserId);
          const displayPhoto = event
            ? getEventPhotoForUser(event.id, currentUserId ?? '', effectiveViewerUserId, true) // true = использовать оригинальное фото
            : undefined;
          
          // Вычисляем высоту фото на основе aspectRatio
          const screenWidth = Dimensions.get('window').width;
          let calculatedHeight = screenWidth; // По умолчанию квадрат
          
          if (event?.mediaAspectRatio) {
            // mediaAspectRatio = ширина / высота
            // height = width / aspectRatio
            calculatedHeight = screenWidth / event.mediaAspectRatio;
          } else if (displayPhoto) {
            // Если aspectRatio не указан, пытаемся определить из оригинального фото
            // Используем дефолтное значение (квадрат) если не можем определить
            calculatedHeight = screenWidth;
          }
          
          // Используем вычисленную высоту без ограничений - шапка подстраивается под размер фото
          const finalHeight = calculatedHeight;
          
          return displayPhoto && (
            <TouchableOpacity 
              style={[styles.eventAvatarContainer, { height: finalHeight }]}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                setPhotoHeight(height);
              }}
              onPress={() => {
                setFullImageUrl(event.originalMediaUrl || event.mediaUrl || displayPhoto);
                setShowImageModal(true);
              }}
              activeOpacity={0.9}
            >
              <Image 
                source={{ uri: displayPhoto }} 
                style={styles.eventAvatar}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        })()}
        
        <View style={styles.eventInfo}>
          {/* Название события - всегда видимо */}
          {event && (
            <>
              <Text style={styles.eventName}>{event.title}</Text>
              
              {/* Описание - скрывается если скрыто */}
              {renderParameterWithOverlay('description', (
                <Text style={styles.eventDescription}>{event.description}</Text>
              ), localHiddenParameters.description)}
              
              {/* Параметры события - скрываются если скрыто */}
              <View style={styles.parametersContainer}>
                {renderParameterWithOverlay('date', (
                  <TouchableOpacity 
                    onPress={() => {
                      // Переход в календарь на недельную раскладку с кнопкой schedule
                      const isoDateTime = `${event.date}T${event.time}:00`;
                      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${eventId}`);
                    }} 
                    style={styles.parameterItem}
                  >
                    <Text style={styles.parameterEmoji}>📅</Text>
                    <Text style={styles.parameterText}>{event.displayDate || event.date}</Text>
                  </TouchableOpacity>
                ), localHiddenParameters.date)}
                
                {renderParameterWithOverlay('time', (
                  <TouchableOpacity 
                    onPress={() => {
                      // Переход в календарь на недельную раскладку с кнопкой schedule
                      const isoDateTime = `${event.date}T${event.time}:00`;
                      router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${eventId}`);
                    }} 
                    style={styles.parameterItem}
                  >
                    <Text style={styles.parameterEmoji}>🕐</Text>
                    <Text style={styles.parameterText}>{event.time}</Text>
                  </TouchableOpacity>
                ), localHiddenParameters.time)}
                
                {renderParameterWithOverlay('location', (
                  !event.coordinates ? (
                    <View style={styles.parameterItem}>
                      <Text style={styles.parameterEmoji}>📍</Text>
                      <Text style={styles.parameterText} numberOfLines={1}>Онлайн</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      onPress={() => router.push(`/map?eventId=${eventId}`)} 
                      style={styles.parameterItem}
                    >
                      <Text style={styles.parameterEmoji}>📍</Text>
                      <Text style={styles.parameterText} numberOfLines={1}>{event.location}</Text>
                    </TouchableOpacity>
                  )
                ), localHiddenParameters.location)}
                
                {renderParameterWithOverlay('participants', (
                  <TouchableOpacity 
                    onPress={() => setShowParticipantsModal(true)} 
                    style={styles.participantsParameterItem}
                  >
                    <View style={styles.participantsMiniAvatars}>
                      {participants.slice(0, 3).map((participantId, index) => {
                        const userData = getUserData(participantId);
                        return (
                          <Image 
                            key={participantId}
                            source={{ uri: userData.avatar }} 
                            style={[
                              styles.participantMiniAvatar,
                              { marginLeft: index > 0 ? -6 : 0 }
                            ]} 
                          />
                        );
                      })}
                      {participants.length > 3 && (
                        <View style={[styles.participantMiniAvatar, styles.participantMoreMini]}>
                          <Text style={styles.participantMoreMiniText}>+{participants.length - 3}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.participantsCountText}>{participants.length}/{event.maxParticipants}</Text>
                  </TouchableOpacity>
                ), localHiddenParameters.participants)}
                
                {renderParameterWithOverlay('price', (
                  event.price ? (
                    <View style={styles.parameterItem}>
                      <Text style={styles.parameterEmoji}>💰</Text>
                      <Text style={styles.parameterText}>{event.price}</Text>
                    </View>
                  ) : null
                ), localHiddenParameters.price)}
              </View>
              
              {/* Три точки для действий с событием - в правом нижнем углу под параметрами */}
              {shouldShowThreeDots && !isEditingParameterVisibility && (
                <TouchableOpacity 
                  style={styles.eventActionsButton}
                  onPress={() => setShowEventActionsModal(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.eventActionsButtonText}>⋯</Text>
                </TouchableOpacity>
              )}
              
              {/* Кнопка "Сохранить" в режиме редактирования видимости параметров */}
              {isEditingParameterVisibility && (
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={handleSaveHiddenParameters}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.saveButtonText}>{t.common.save}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Разделительная линия с кнопкой "+" по центру */}
        <View style={styles.divider}>
          {isMember && (
            <TouchableOpacity 
              style={styles.addContentButton}
              onPress={() => {
                // Сбрасываем состояние при открытии модального окна
                setContentType(null);
                setContentCaption('');
                setSelectedPhotos([]);
                setCombineIntoOnePost(false);
                setMusicUrl('');
                setMusicTitle('');
                setMusicArtist('');
                setSelectedTrack(null);
                setSearchQuery('');
                setSearchResults([]);
                setShowAddContentModal(true);
              }}
            >
              <Text style={styles.addContentIcon}>+</Text>
            </TouchableOpacity>
          )}
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
        animationType="fade"
        onRequestClose={() => setShowEventActionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.absoluteFill}
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
                        saveEvent(eventId);
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
                          Alert.alert('Информация', 'Для регулярных событий выберите конкретную дату');
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
                      // Отмена события
                      if (event) {
                        cancelEvent(eventId);
                      }
                      setShowEventActionsModal(false);
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
                      Alert.alert(t.common.confirm || 'Info', 'Выберите участника для удаления');
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
                      // TODO: Реализовать функционал "Пожаловаться"
                      Alert.alert(t.common.confirm || 'Info', 'Функция "Пожаловаться" будет реализована');
                      setShowEventActionsModal(false);
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
                  setMusicUrl('');
                  setMusicTitle('');
                  setMusicArtist('');
                  setSelectedTrack(null);
                  setSearchResults([]);
                  setSearchQuery('');
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
                >
                  <Text style={styles.contentTypeIcon}>📷</Text>
                  <Text style={styles.contentTypeText}>{t.eventProfile.photo}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.contentTypeButton} 
                  onPress={() => setContentType('music')}
                >
                  <Text style={styles.contentTypeIcon}>🎵</Text>
                  <Text style={styles.contentTypeText}>{t.eventProfile.music}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.contentTypeButton} 
                  onPress={() => setContentType('text')}
                >
                  <Text style={styles.contentTypeIcon}>📝</Text>
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
                      <Text style={styles.checkboxLabel}>Объединить в один пост</Text>
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
                          backgroundColor: '#8B5CF6',
                          borderRadius: 12,
                          width: 24,
                          height: 24,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
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
                          <Text style={{ color: 'white', fontSize: 16 }}>×</Text>
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
                        ? (isUploadingPhotos ? 'Загрузка...' : `Загрузить ${selectedPhotos.length} фото`)
                        : 'Выбрать фото'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : contentType === 'music' ? (
              <View>
                {/* Поиск треков */}
                <Text style={styles.demoLabel}>Демо-версия поиска треков</Text>
                <TextInput
                  style={styles.editInput}
                  placeholder="Введите название трека для демо-поиска..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    if (text.length > 2) {
                      searchTracks(text);
                    } else {
                      setSearchResults([]);
                    }
                  }}
                />
                
                {/* Результаты поиска */}
                {searchResults.length > 0 && (
                  <ScrollView style={styles.searchResults} showsVerticalScrollIndicator={false}>
                    {searchResults.map((track) => (
                      <TouchableOpacity
                        key={track.id}
                        style={styles.searchResultItem}
                        onPress={() => handleTrackSelect(track)}
                      >
                        <Image 
                          source={{ uri: track.artwork_url || 'https://via.placeholder.com/50x50/333/fff?text=🎵' }} 
                          style={styles.searchResultImage}
                        />
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultTitle} numberOfLines={1}>
                            {track.title}
                          </Text>
                          <Text style={styles.searchResultArtist} numberOfLines={1}>
                            {track.user.username}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                
                {/* Индикатор загрузки */}
                {isSearching && (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Поиск треков...</Text>
                  </View>
                )}
                
                {/* Выбранный трек */}
                {selectedTrack && (
                  <View style={styles.selectedTrackContainer}>
                    <Image 
                      source={{ uri: selectedTrack.artwork_url || 'https://via.placeholder.com/60x60/333/fff?text=🎵' }} 
                      style={styles.selectedTrackImage}
                    />
                    <View style={styles.selectedTrackInfo}>
                      <Text style={styles.selectedTrackTitle}>{selectedTrack.title}</Text>
                      <Text style={styles.selectedTrackArtist}>{selectedTrack.user.username}</Text>
                    </View>
                  </View>
                )}
                
                {/* Ручной ввод (если не выбран трек из поиска) */}
                {!selectedTrack && (
                  <>
                    <TextInput
                      style={styles.editInput}
                      placeholder="Ссылка на трек (SoundCloud)"
                      placeholderTextColor="#999"
                      value={musicUrl}
                      onChangeText={setMusicUrl}
                    />
                    
                    <TextInput
                      style={styles.editInput}
                      placeholder="Название трека"
                      placeholderTextColor="#999"
                      value={musicTitle}
                      onChangeText={setMusicTitle}
                    />
                    
                    <TextInput
                      style={styles.editInput}
                      placeholder={t.eventProfile.artist}
                      placeholderTextColor="#999"
                      value={musicArtist}
                      onChangeText={setMusicArtist}
                    />
                  </>
                )}
                
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  placeholder={t.eventProfile.descriptionOptional || 'Description (optional)'}
                  placeholderTextColor="#999"
                  value={contentCaption}
                  onChangeText={setContentCaption}
                  multiline
                  numberOfLines={3}
                />
                
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => {
                    setContentType(null);
                    setMusicUrl('');
                    setMusicTitle('');
                    setMusicArtist('');
                    setContentCaption('');
                    setSelectedTrack(null);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}>
                    <Text style={styles.cancelButtonText}>{t.eventProfile.back}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.saveButton} onPress={handleAddMusic}>
                    <Text style={styles.saveButtonText}>{t.common.add || 'Add'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
                        Alert.alert('Авторизация', 'Войдите, чтобы добавлять контент события.');
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
                    <Text style={styles.saveButtonText}>Добавить</Text>
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
    </View>
  );
}

