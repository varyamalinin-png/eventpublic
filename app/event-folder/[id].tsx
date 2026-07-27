import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Dimensions, Modal, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '../../utils/safeRouter';
import * as ImagePicker from 'expo-image-picker';
import EventCard from '../../components/EventCard';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import type { EventFolder } from '../../types/EventFolder';
import { formatUsername } from '../../utils/username';
import { AppIcon } from '../../components/ui/AppIcon';
import { Palette } from '../../constants/DesignSystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventFolderScreen() {
  const expoRouter = useRouter();
  const router = useSafeRouter();
  const params = useLocalSearchParams<{ id: string }>();
  
  // На вебе параметры могут не передаваться через expo-router, получаем из URL напрямую
  let id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id && typeof window !== 'undefined') {
    const pathMatch = window.location.pathname.match(/\/event-folder\/([^\/]+)/);
    if (pathMatch) {
      id = pathMatch[1];
    }
  }
  const { getEventFolderById, eventFolders, isEventPast, updateEventFolder, deleteEventFolder, removeEventFromFolder } = useEvents();
  const { user: authUser, accessToken, initializing: authInitializing } = useAuth();
  const { t } = useLanguage();
  const [folder, setFolder] = useState<EventFolder | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showMenu, setShowMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showEventsFeed, setShowEventsFeed] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loadFolder = async () => {
      
      if (!id) {
        console.warn('[EventFolderScreen] No id provided');
        setLoading(false);
        return;
      }
      
      // Ждем завершения инициализации авторизации
      if (authInitializing) {
        // Не устанавливаем loading в false - продолжаем показывать загрузку
        return;
      }
      
      // Проверяем наличие токена - без него запрос не пройдет
      // Но даем небольшую задержку после завершения инициализации, чтобы токен успел установиться
      if (!accessToken || !authUser) {
        console.warn('[EventFolderScreen] Not authenticated after initialization - cannot load folder', { 
          hasAccessToken: !!accessToken, 
          hasAuthUser: !!authUser,
          authInitializing,
          // Проверяем localStorage напрямую на вебе
          localStorageToken: typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false
        });
        setLoading(false);
        setFolder(null);
        return;
      }
      
      try {
        // Сначала проверяем в кэше
        const cachedFolder = eventFolders.find(f => f.id === id);
        if (cachedFolder) {
          setFolder(cachedFolder);
          setLoading(false);
          return;
        }
        
        // Если нет в кэше, загружаем с сервера
        const folderData = await getEventFolderById(id);
        if (folderData) {
          setFolder(folderData);
        } else {
          console.error('[EventFolderScreen] Folder not found - API returned null', { folderId: id });
        }
      } catch (error: any) {
        console.error('[EventFolderScreen] Failed to load folder:', { 
          error: error?.message || error,
          status: error?.status,
          statusCode: error?.statusCode,
          folderId: id,
          stack: error?.stack
        });
        // Не устанавливаем folder в null при ошибке - может быть временная проблема
        // setFolder(null);
      } finally {
        setLoading(false);
      }
    };

    loadFolder();
  }, [id, getEventFolderById, eventFolders, accessToken, authUser, authInitializing]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Загрузка...</Text>
        <Text style={styles.loadingText}>ID: {id || t.folder.notSpecified}</Text>
      </View>
    );
  }

  if (!folder && !loading) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backButtonFixed}
          onPress={() => {
            if (router && typeof router.back === 'function') {
              router.back();
            } else if (expoRouter && typeof expoRouter.back === 'function') {
              expoRouter.back();
            } else if (typeof window !== 'undefined') {
              window.history.back();
            }
          }}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={styles.errorText}>Папка не найдена</Text>
          <Text style={[styles.errorText, { fontSize: 12, marginTop: 10, color: 'rgba(244,244,245,0.55)' }]}>ID: {id || t.folder.notSpecified}</Text>
        </View>
      </View>
    );
  }
  
  if (!folder) {
    return null; // Пока загружается
  }

  // Форматируем продолжительность в формате дд.мм.гг - дд.мм.гг
  const formatDuration = () => {
    if (!folder.duration) return '';
    const start = new Date(folder.duration.start);
    const end = new Date(folder.duration.end);
    
    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().substring(2);
      return `${day}.${month}.${year}`;
    };
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const aspectRatio = 16 / 9;
  const imageHeight = SCREEN_WIDTH / aspectRatio;

  // Проверяем, является ли текущий пользователь владельцем папки
  const isOwner = folder && authUser && folder.ownerId === authUser.id;

  // Обработчики для меню
  const handleDeleteFolder = async () => {
    if (!folder || !isOwner) return;
    
    Alert.alert(
      t.folder.deleteFolder,
      t.folder.deleteFolderConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEventFolder(folder.id);
              router.back();
            } catch (error) {
              Alert.alert(t.common.error, 'Не удалось удалить папку');
            }
          },
        },
      ]
    );
    setShowMenu(false);
  };

  const handleChangeCoverPhoto = async () => {
    if (!folder || !isOwner) return;
    
    try {
      const hasPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (hasPermission.status !== 'granted') {
        Alert.alert(t.common.error, t.messages.noGalleryAccess);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result && !result.canceled && result.assets && result.assets[0]) {
        await updateEventFolder(folder.id, undefined, undefined, {
          uri: result.assets[0].uri,
          type: result.assets[0].mimeType || 'image/jpeg',
          name: 'cover.jpg',
        });
        // Обновляем локальное состояние
        const updatedFolder = await getEventFolderById(folder.id);
        if (updatedFolder) {
          setFolder(updatedFolder);
        }
        Alert.alert(t.common.success, 'Фото папки изменено');
      }
    } catch (error) {
      Alert.alert(t.common.error, t.folder.photoChangeFailed);
    }
    setShowMenu(false);
  };

  const handleSelectMode = () => {
    setSelectMode(true);
    setShowMenu(false);
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelectedEventIds(new Set());
  };

  const handleDeleteSelectedEvents = async () => {
    if (!folder || selectedEventIds.size === 0) return;
    
    Alert.alert(
      t.folder.removeEventsFromFolder,
      `Удалить ${selectedEventIds.size} ${selectedEventIds.size === 1 ? t.events.eventWord : 'событий'} из папки?`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              for (const eventId of selectedEventIds) {
                await removeEventFromFolder(folder.id, eventId);
              }
              // Обновляем папку - если папка была удалена (0 событий), вернется null
              const updatedFolder = await getEventFolderById(folder.id);
              if (updatedFolder) {
                setFolder(updatedFolder);
                setSelectMode(false);
                setSelectedEventIds(new Set());
              } else {
                // Папка была автоматически удалена, возвращаемся назад
                Alert.alert(t.events.folderDeleted, t.events.folderDeletedEmpty);
                router.back();
              }
            } catch (error) {
              // Если папка не найдена (404), значит она была удалена
              if (error instanceof Error && error.message.includes('404')) {
                Alert.alert(t.events.folderDeleted, t.events.folderDeletedEmpty);
                router.back();
              } else {
                Alert.alert(t.common.error, t.folder.removeEventsFailed);
              }
            }
          },
        },
      ]
    );
  };

  // Обработчик клика на мини-карточку для перехода в режим ленты
  const handleMiniaturePress = (eventId: string, index: number) => {
    if (selectMode) return; // В режиме селект не переключаем вид
    
    // Переключаемся в режим ленты на всю страницу
    setSelectedEventIndex(index);
    setShowEventsFeed(true);
    
    // Прокручиваем к выбранному событию после рендера
    setTimeout(() => {
      if (scrollViewRef.current && folder.events && index < folder.events.length) {
        const cardHeight = 400;
        const marginBottom = 15;
        const totalItemHeight = cardHeight + marginBottom;
        const scrollPosition = index * totalItemHeight;
        
        scrollViewRef.current.scrollTo({
          y: scrollPosition,
          animated: true
        });
      }
    }, 100);
  };

  const handleBackToGrid = () => {
    setShowEventsFeed(false);
    setSelectedEventIndex(null);
  };

  // Если режим ленты - показываем отдельный экран (как в профиле события)
  if (showEventsFeed) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backButtonFixed}
          onPress={handleBackToGrid}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        
        <ScrollView 
          ref={scrollViewRef}
          style={styles.eventsFeedScroll}
          contentContainerStyle={styles.eventsFeedContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
          alwaysBounceVertical={true}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
        >
          {folder.events && folder.events.length > 0 ? (
            folder.events.map((eventItem, index) => {
              const event = (eventItem as any).event || eventItem;
              if (!event || !event.id) {
                return null;
              }

              return (
                <View 
                  key={event.id || `event-${index}`} 
                  style={[
                    styles.eventCardWrapper,
                    index === folder.events.length - 1 && styles.lastEventCard
                  ]}
                >
                  <EventCard
                    id={event.id}
                    title={event.title}
                    description={event.description}
                    date={event.date}
                    time={event.time}
                    displayDate={event.displayDate}
                    location={event.location}
                    price={event.price}
                    participants={event.participants}
                    maxParticipants={event.maxParticipants}
                    organizerAvatar={event.organizerAvatar}
                    organizerId={event.organizerId}
                    variant="default"
                    showSwipeAction={true}
                    showOrganizerAvatar={true}
                    mediaUrl={event.mediaUrl}
                    mediaType={event.mediaType}
                    mediaAspectRatio={event.mediaAspectRatio}
                    participantsList={event.participantsList}
                    participantsData={event.participantsData}
                    context="folder"
                    folderId={id}
                  />
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>В папке пока нет событий</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Кнопка назад - зафиксирована с полупрозрачным фоном */}
      <TouchableOpacity 
        style={styles.backButtonFixed}
        onPress={() => {
          if (router && typeof router.back === 'function') {
            router.back();
          } else if (expoRouter && typeof expoRouter.back === 'function') {
            expoRouter.back();
          } else {
            window.history.back();
          }
        }}
      >
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Основное фото 16:9 - до самого верхнего края */}
        <View style={styles.coverImageContainer}>
          <Image
            source={{ uri: folder.coverPhotoUrl || folder.events?.[0]?.mediaUrl || 'https://via.placeholder.com/400x225' }}
            style={[styles.coverImage, { height: imageHeight }]}
            resizeMode="cover"
          />
          
          {/* Название папки и меню поверх фото */}
          <View style={styles.folderHeaderOverlay}>
            <View style={styles.folderHeaderContent}>
              <View style={styles.folderTitleContainer}>
                <View style={styles.folderTitleWithCountContainer}>
                  <Text style={styles.folderName}>{folder.name}</Text>
                  <Text style={styles.folderEventCount}>
                    {folder.eventCount || folder.events?.length || 0} {folder.eventCount === 1 || folder.events?.length === 1 ? 'event' : 'events'}
                  </Text>
                </View>
              </View>
              
              {isOwner && (
                <TouchableOpacity 
                  style={styles.menuButtonOverlay}
                  onPress={() => setShowMenu(true)}
                >
                  <AppIcon name="more" size={18} color={Palette.text} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Продолжительность и участники */}
            <View style={styles.folderBottomRow}>
              {folder.duration && (
                <Text style={styles.durationOverlay}>{formatDuration()}</Text>
              )}
              {folder.participants && folder.participants.length > 0 && (
                <View style={styles.participantsOverlay}>
                  {folder.participants.slice(0, 5).map((participant: any, index) => {
                    const avatarUrl = participant.avatarUrl || participant.avatar || 'https://via.placeholder.com/40';
                    return (
                      <Image
                        key={participant.id || index}
                        source={{ uri: avatarUrl }}
                        style={[
                          styles.participantOverlayAvatar,
                          { marginLeft: index > 0 ? -8 : 0, zIndex: 10 - index }
                        ]}
                      />
                    );
                  })}
                  {folder.participants.length > 5 && (
                    <View style={[styles.participantOverlayAvatar, styles.participantMoreOverlay]}>
                      <Text style={styles.participantMoreText}>+{folder.participants.length - 5}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Описание папки */}
        {folder.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionText}>{folder.description}</Text>
          </View>
        )}

        {/* Сетка карточек событий */}
        {viewMode === 'grid' && (
          <View style={styles.eventsContainer}>
            {folder.events && folder.events.length > 0 ? (
              folder.events.map((eventItem, index) => {
                // Поддерживаем обе структуры: { event: Event } и просто Event
                const event = (eventItem as any).event || eventItem;
                if (!event || !event.id) {
                  return null;
                }
                
                const containerPadding = 40;
                const gap = 15;
                const availableWidth = SCREEN_WIDTH - containerPadding;
                const cardWidth = (availableWidth - gap * 2) / 3;
                const isLastInRow = (index + 1) % 3 === 0;
                const isSelected = selectMode && selectedEventIds.has(event.id);

                return (
                  <View
                    key={event.id || `event-${index}`}
                    style={[
                      { width: cardWidth },
                      !isLastInRow && { marginRight: gap }
                    ]}
                  >
                    {selectMode && (
                      <TouchableOpacity
                        style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                        onPress={() => {
                          const newSelected = new Set(selectedEventIds);
                          if (newSelected.has(event.id)) {
                            newSelected.delete(event.id);
                          } else {
                            newSelected.add(event.id);
                          }
                          setSelectedEventIds(newSelected);
                        }}
                      >
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    )}
                    <EventCard
                      id={event.id}
                      title={event.title}
                      description={event.description}
                      date={event.date}
                      time={event.time}
                      displayDate={event.displayDate}
                      location={event.location}
                      price={event.price}
                      participants={event.participants}
                      maxParticipants={event.maxParticipants}
                      organizerAvatar={event.organizerAvatar}
                      organizerId={event.organizerId}
                      variant="miniature_1"
                      showSwipeAction={!selectMode}
                      showOrganizerAvatar={false}
                      mediaUrl={event.mediaUrl}
                      mediaType={event.mediaType}
                      mediaAspectRatio={event.mediaAspectRatio}
                      participantsList={event.participantsList}
                      participantsData={event.participantsData}
                      context="folder"
                      folderId={id}
                      onMiniaturePress={() => {
                        if (!selectMode) {
                          handleMiniaturePress(event.id, index);
                        }
                      }}
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>В папке пока нет событий</Text>
            )}
          </View>
        )}
        
        {/* Лента карточек событий */}
        {viewMode === 'list' && (
          <View style={styles.listContainer}>
            {folder.events && folder.events.length > 0 ? (
              folder.events.map((eventItem, index) => {
                const event = (eventItem as any).event || eventItem;
                if (!event || !event.id) {
                  return null;
                }
                const isSelected = selectMode && selectedEventIds.has(event.id);

                return (
                  <View key={event.id || `event-${index}`} style={styles.listItem}>
                    {selectMode && (
                      <TouchableOpacity
                        style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                        onPress={() => {
                          const newSelected = new Set(selectedEventIds);
                          if (newSelected.has(event.id)) {
                            newSelected.delete(event.id);
                          } else {
                            newSelected.add(event.id);
                          }
                          setSelectedEventIds(newSelected);
                        }}
                      >
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    )}
                    <EventCard
                      id={event.id}
                      title={event.title}
                      description={event.description}
                      date={event.date}
                      time={event.time}
                      displayDate={event.displayDate}
                      location={event.location}
                      price={event.price}
                      participants={event.participants}
                      maxParticipants={event.maxParticipants}
                      organizerAvatar={event.organizerAvatar}
                      organizerId={event.organizerId}
                      variant="default"
                      showSwipeAction={!selectMode}
                      showOrganizerAvatar={true}
                      mediaUrl={event.mediaUrl}
                      mediaType={event.mediaType}
                      mediaAspectRatio={event.mediaAspectRatio}
                      participantsList={event.participantsList}
                      participantsData={event.participantsData}
                      context="folder"
                      folderId={id}
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>В папке пока нет событий</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Меню с опциями */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContent}>
            <View style={styles.menuHandle} />
            <TouchableOpacity style={styles.menuItem} onPress={handleChangeCoverPhoto}>
              <Text style={styles.menuItemText}>Изменить фото</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSelectMode}>
              <Text style={styles.menuItemText}>Выбрать</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={handleDeleteFolder}>
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Удалить папку</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Text style={styles.menuItemText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Панель действий в режиме селект */}
      {selectMode && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSelect}>
            <Text style={styles.cancelButtonText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, selectedEventIds.size === 0 && styles.actionButtonDisabled]}
            onPress={handleDeleteSelectedEvents}
            disabled={selectedEventIds.size === 0}
          >
            <Text style={styles.actionButtonText}>
              Удалить из папки ({selectedEventIds.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    color: '#f4f4f5',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  coverImageContainer: {
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
  },
  folderHeaderOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  folderHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  folderTitleContainer: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  folderTitleWithCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f4f5',
  },
  folderEventCount: {
    fontSize: 11,
    color: '#AAAAAA',
    fontStyle: 'italic',
  },
  menuButtonOverlay: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 18,
  },
  menuButtonText: {
    color: '#f4f4f5',
    fontSize: 20,
    fontWeight: 'bold',
  },
  folderBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  durationOverlay: {
    fontSize: 14,
    color: '#f4f4f5',
    flex: 1,
  },
  participantsOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantOverlayAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  participantMoreOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantMoreText: {
    color: '#f4f4f5',
    fontSize: 10,
    fontWeight: 'bold',
  },
  descriptionContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: '#f4f4f5',
    lineHeight: 24,
  },
  eventsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  emptyText: {
    color: '#999999',
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
    marginTop: 40,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  listItem: {
    marginBottom: 16,
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF8D32',
    borderColor: '#FF8D32',
  },
  checkmark: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: '#18181e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 36,
    paddingTop: 4,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuItemDanger: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: '#f4f4f5',
    fontSize: 15.5,
    fontWeight: '500',
  },
  menuItemTextDanger: {
    color: '#FF453A',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(18,18,18,0.95)',
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'rgba(244,244,245,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  actionButton: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: '#FF453A',
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '700',
  },
  eventsFeedScroll: {
    flex: 1,
  },
  eventsFeedContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
    flexGrow: 1,
  },
  eventCardWrapper: {
    marginBottom: 15,
  },
  lastEventCard: {
    marginBottom: 200,
  },
});
