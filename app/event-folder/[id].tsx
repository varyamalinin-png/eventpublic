import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Dimensions, Modal, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import EventCard from '../../components/EventCard';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import type { EventFolder } from '../../types/EventFolder';
import { formatUsername } from '../../utils/username';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventFolderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEventFolderById, eventFolders, isEventPast, updateEventFolder, deleteEventFolder, removeEventFromFolder } = useEvents();
  const { user: authUser } = useAuth();
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
      if (!id) return;
      
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
        }
      } catch (error) {
        console.error('Failed to load folder:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFolder();
  }, [id, getEventFolderById, eventFolders]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  if (!folder) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Папка не найдена</Text>
      </View>
    );
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
      'Удалить папку',
      'Вы уверены, что хотите удалить эту папку? Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEventFolder(folder.id);
              router.back();
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить папку');
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
        Alert.alert('Ошибка', 'Нет доступа к галерее');
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
        Alert.alert('Успешно', 'Фото папки изменено');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось изменить фото');
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
      'Удалить события из папки',
      `Удалить ${selectedEventIds.size} ${selectedEventIds.size === 1 ? 'событие' : 'событий'} из папки?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
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
                Alert.alert('Папка удалена', 'Папка была удалена, так как в ней не осталось событий');
                router.back();
              }
            } catch (error) {
              // Если папка не найдена (404), значит она была удалена
              if (error instanceof Error && error.message.includes('404')) {
                Alert.alert('Папка удалена', 'Папка была удалена, так как в ней не осталось событий');
                router.back();
              } else {
                Alert.alert('Ошибка', 'Не удалось удалить события из папки');
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
        onPress={() => router.back()}
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
                  <Text style={styles.menuButtonText}>⋯</Text>
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
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContent}>
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
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    borderColor: '#FFFFFF',
  },
  participantMoreOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantMoreText: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  menuItemDanger: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  menuItemTextDanger: {
    color: '#FF6B6B',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  actionButton: {
    flex: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#2A2A2A',
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
