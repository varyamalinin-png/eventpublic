import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import MemoryPost from '../../components/MemoryPost';
import ParticipantsModal from '../../components/ParticipantsModal';
import { createLogger } from '../../utils/logger';

const logger = createLogger('EventProfile');

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
    fetchEventProfile
  } = useEvents();
  const { user: authUser } = useAuth();
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
          logger.debug('Профиль не найден - событие еще не завершилось или профиль не создан');
        }
        attemptedProfiles.current.delete(eventId);
      }).catch(() => {
        attemptedProfiles.current.delete(eventId);
      });
    }
  }, [eventId, eventProfile, event, fetchEventProfile]);

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
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 2: В ожидании (waiting)
      else if (relationship === 'waiting') {
        actions.push({ id: 'view_requests', label: t.events.viewRequests });
        actions.push({ id: 'cancel_request', label: t.events.cancelRequest });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
        actions.push({ id: 'report', label: t.events.report, isClickable: true });
      }
      // ПРИОРИТЕТ 3: Участник (accepted)
      else if (relationship === 'accepted') {
        actions.push({ id: 'cancel_participation', label: t.events.cancelParticipation });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
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
        // Действие "продлить" для регулярных событий
        if (event.isRecurring) {
          actions.push({ id: 'extend_recurring', label: t.events.extendRecurring || 'Продлить', isClickable: true });
        }
        actions.push({ id: 'remove_participant', label: t.events.removeParticipant, isClickable: true });
        actions.push({ id: 'share', label: t.events.share, isClickable: true });
        actions.push({ id: 'save', label: isEventSaved(eventId) ? t.eventProfile.removeFromSaved : t.eventProfile.save, isClickable: true });
      }
      // ПРИОРИТЕТ 5: Не член (non_member)
      else if (relationship === 'non_member') {
        actions.push({ id: 'schedule', label: t.events.schedule });
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
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        addEventProfilePost(eventId, {
          authorId: currentUserId,
          content: contentCaption || 'Новое фото с события!',
          photoUrl: result.assets[0].uri,
        });
        setShowAddContentModal(false);
        setContentCaption('');
        setContentType(null);
        // Остаемся в режиме редактирования
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать фото');
    }
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
    
    setShowAddContentModal(false);
    setMusicUrl('');
    setMusicTitle('');
    setMusicArtist('');
    setContentCaption('');
    setSelectedTrack(null);
    setSearchResults([]);
    setSearchQuery('');
    setContentType(null);
    // Остаемся в режиме редактирования
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
              {(post.photoUrl) ? (
                <Image 
                  source={{ uri: post.photoUrl || post.content }} 
                  style={[styles.postImage, { width: '100%', height: cardHeight }]} 
                  resizeMode="cover"
                />
              ) : post.type === 'music' ? (
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
              ) : (
                <View style={[styles.postTextContainer, { width: '100%', height: cardHeight }]}>
                  <Text style={styles.postText} numberOfLines={10}>{post.content}</Text>
                </View>
              )}
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

      <ScrollView style={styles.content}>
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
                  <TouchableOpacity onPress={() => router.push('/calendar')} style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>📅</Text>
                    <Text style={styles.parameterText}>{event.displayDate || event.date}</Text>
                  </TouchableOpacity>
                ), localHiddenParameters.date)}
                
                {renderParameterWithOverlay('time', (
                  <View style={styles.parameterItem}>
                    <Text style={styles.parameterEmoji}>🕐</Text>
                    <Text style={styles.parameterText}>{event.time}</Text>
                  </View>
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
          {isPast && isMember && (
            <TouchableOpacity 
              style={styles.addContentButton}
              onPress={() => setShowAddContentModal(true)}
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
                      // Переход в календарь для планирования
                      if (event && currentUserId) {
                        const isoDateTime = `${event.date}T${event.time}:00`;
                        router.push(`/calendar?date=${encodeURIComponent(isoDateTime)}&mode=preview&eventId=${eventId}`);
                      }
                      setShowEventActionsModal(false);
                    } else if (action.id === 'cancel_request') {
                      // Отмена запроса
                      if (event && currentUserId) {
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
                      // Переход в "Мои запросы"
                      router.push('/(tabs)/inbox');
                      setShowEventActionsModal(false);
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
            <Text style={styles.modalTitle}>{t.eventProfile.addContent}</Text>
            
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
              <View>
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  placeholder={t.eventProfile.descriptionOptional}
                  placeholderTextColor="#999"
                  value={contentCaption}
                  onChangeText={setContentCaption}
                  multiline
                  numberOfLines={3}
                />
                
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => {
                    setContentType(null);
                    setContentCaption('');
                  }}>
                    <Text style={styles.cancelButtonText}>{t.eventProfile.back}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.saveButton} onPress={handleAddPhoto}>
                    <Text style={styles.saveButtonText}>Выбрать фото</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
                      setShowAddContentModal(false);
                      setContentCaption('');
                      setContentType(null);
                      // Остаемся в режиме редактирования
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
            style={StyleSheet.absoluteFill}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
    color: '#FFF',
    fontSize: 24,
  },
  editButtonFixed: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  editIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  eventInfo: {
    paddingHorizontal: 20,
    paddingTop: 8, // Такое же расстояние как в карточке события (contentContainer paddingTop: 8)
    paddingBottom: 20,
    position: 'relative',
  },
  eventAvatarContainer: {
    width: '100%',
    marginBottom: 0, // Убрали marginBottom, чтобы расстояние было как в карточке (только paddingTop: 8)
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  eventAvatar: {
    width: '100%',
    height: '100%', // Занимает всю высоту контейнера, как в карточке (mediaImageVertical)
    borderRadius: 0,
    resizeMode: 'cover', // Как в карточке события (mediaImageVertical)
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  changePhotoButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  eventDescription: {
    color: '#CCC',
    fontSize: 14,
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
    color: '#DDD',
    fontWeight: '500',
  },
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
    borderWidth: 1,
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
    color: '#DDD',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
    marginHorizontal: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addContentButton: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  addContentIcon: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '300',
  },
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
  actionsModalContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
    alignSelf: 'center',
  },
  actionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionsModalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionsModalClose: {
    color: '#999',
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionsModalScroll: {
    maxHeight: 400,
  },
  actionItem: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionItemText: {
    color: '#FFF',
    fontSize: 16,
  },
  actionItemTextDisabled: {
    color: '#666',
  },
  saveButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 10,
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
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  parameterOverlayHidden: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  eyeIcon: {
    fontSize: 24,
  },
  editField: {
    backgroundColor: '#333',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#444',
  },
  editFieldDescription: {
    fontWeight: 'normal',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  parameterTextInput: {
    fontSize: 12,
    color: '#DDD',
    fontWeight: '500',
    flex: 1,
    padding: 0,
    margin: 0,
  },
  postsSection: {
    paddingHorizontal: 0, // Нет отступов от краев
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  postItem: {
    marginBottom: 0,
    overflow: 'hidden',
  },
  postItemWithRightDivider: {
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  postImage: {
    width: '100%',
    borderRadius: 0,
  },
  postTextContainer: {
    backgroundColor: '#333',
    borderRadius: 0,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postText: {
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
  },
  musicCard: {
    backgroundColor: '#333',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  musicCoverImageFull: {
    width: '100%',
    height: '100%',
  },
  musicPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  playingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingIcon: {
    fontSize: 24,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playIconOverlay: {
    fontSize: 24,
  },
  emptyPosts: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyPostsText: {
    color: '#999',
    fontSize: 16,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  editInput: {
    backgroundColor: '#333',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
  },
  editTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  // Стили для музыки (старые - удалены, используются новые выше)
  musicIcon: {
    fontSize: 32,
  },
  // Стили для модального окна добавления контента
  contentTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  contentTypeButton: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#333',
    borderRadius: 12,
    minWidth: 100,
  },
  contentTypeIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  contentTypeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  demoLabel: {
    color: '#FFA500',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    backgroundColor: '#2A2A2A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  // Стили для поиска треков
  searchResults: {
    maxHeight: 200,
    marginVertical: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#444',
    borderRadius: 8,
    marginBottom: 5,
  },
  searchResultImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  searchResultArtist: {
    color: '#999',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
  },
  selectedTrackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 12,
    marginVertical: 10,
  },
  selectedTrackImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  selectedTrackInfo: {
    flex: 1,
  },
  selectedTrackTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  selectedTrackArtist: {
    color: '#999',
    fontSize: 16,
  },
  // Стили для ленты контента
  contentFeedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#121212',
    zIndex: 1000,
  },
  backToProfileButton: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  backToProfileText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  contentFeedScroll: {
    flex: 1,
  },
  contentFeedContent: {
    paddingBottom: 100,
    paddingTop: 8,
  },
  fullPostCard: {
    marginBottom: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullPostImage: {
    width: '100%',
    height: 400,
  },
  fullMusicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#333',
  },
  fullMusicCover: {
    width: 80,
    height: 80,
    backgroundColor: '#555',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  fullMusicIcon: {
    fontSize: 32,
  },
  fullMusicInfo: {
    flex: 1,
  },
  fullMusicTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  fullMusicArtist: {
    color: '#999',
    fontSize: 16,
  },
  fullPlayButton: {
    width: 60,
    height: 60,
    backgroundColor: '#007AFF',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPlayIcon: {
    fontSize: 24,
  },
  fullPostTextContainer: {
    padding: 20,
    backgroundColor: '#333',
  },
  fullPostText: {
    color: '#FFF',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  imageModalCloseText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
  },
  fullPostAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2A2A2A',
  },
  fullAuthorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  fullAuthorInfo: {
    flex: 1,
  },
  fullAuthorUsername: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fullPostDate: {
    color: '#999',
    fontSize: 14,
    marginTop: 2,
  },
  fullPostCaption: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
    padding: 15,
    backgroundColor: '#2A2A2A',
  },
});
