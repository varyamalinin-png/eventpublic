import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, TextInput, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { useEvents } from '../../context/EventsContext';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import MemoryPost from '../../components/MemoryPost';

export default function EventProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { 
    getEventProfile, 
    getUserData, 
    canEditEventProfile, 
    addEventProfilePost, 
    updateEventProfile,
    getEventParticipants,
    createEventProfile 
  } = useEvents();
  
  const eventId = Array.isArray(id) ? id[0] : id || '';
  const eventProfile = getEventProfile(eventId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Состояния для добавления контента
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  const [contentType, setContentType] = useState<'photo' | 'music' | null>(null);
  const [musicUrl, setMusicUrl] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtist, setMusicArtist] = useState('');
  const [contentCaption, setContentCaption] = useState('');
  
  // Состояния для поиска музыки
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  
  // Состояния для ленты контента
  const [showContentFeed, setShowContentFeed] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Автоматически создаем профиль события если его нет
  useEffect(() => {
    if (!eventProfile && eventId) {
      createEventProfile(eventId);
    }
  }, [eventId, eventProfile, createEventProfile]);

  // Получаем обновленный профиль события после создания
  const currentEventProfile = getEventProfile(eventId);

  // Обновляем состояния редактирования при изменении профиля
  useEffect(() => {
    if (currentEventProfile) {
      setEditName(currentEventProfile.name);
      setEditDescription(currentEventProfile.description);
    }
  }, [currentEventProfile]);

  if (!currentEventProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Создание профиля события...</Text>
      </View>
    );
  }

  const canEdit = canEditEventProfile(eventId, 'own-profile-1');
  const participants = getEventParticipants(eventId);

  const handleSaveEdit = () => {
    updateEventProfile(eventId, {
      name: editName,
      description: editDescription
    });
    setIsEditing(false);
    setShowEditModal(false);
  };

  const handleCancelEdit = () => {
    setEditName(currentEventProfile.name);
    setEditDescription(currentEventProfile.description);
    setIsEditing(false);
    setShowEditModal(false);
  };

  const handleEditPress = () => {
    setShowEditModal(true);
    setIsEditing(true);
  };

  const handleAddPost = () => {
    setShowAddContentModal(true);
  };

  const handleAddPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        addEventProfilePost(eventId, {
          authorId: 'own-profile-1',
          type: 'photo',
          content: result.assets[0].uri,
          caption: contentCaption || 'Новое фото с события!'
        });
        setShowAddContentModal(false);
        setContentCaption('');
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

    addEventProfilePost(eventId, {
      authorId: 'own-profile-1',
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
        console.log('Некорректная ссылка на трек:', trackUrl);
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
      console.error('Ошибка воспроизведения:', error);
      // Убираем Alert - просто логируем ошибку
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
      const postIndex = currentEventProfile.posts.findIndex((p: any) => p.id === post.id);
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

  const renderParticipants = () => {
    const maxVisible = 4;
    const visibleParticipants = participants.slice(0, maxVisible);
    const remainingCount = participants.length - maxVisible;

    return (
      <View style={styles.participantsContainer}>
        <Text style={styles.participantsLabel}>Участники ({participants.length})</Text>
        <View style={styles.participantsList}>
          {visibleParticipants.map((participantId, index) => {
            const userData = getUserData(participantId);
            return (
              <TouchableOpacity 
                key={participantId}
                style={styles.participantAvatar}
                onPress={() => router.push(`/profile/${participantId}`)}
              >
                <Image source={{ uri: userData.avatar }} style={styles.avatarImage} />
              </TouchableOpacity>
            );
          })}
          {remainingCount > 0 && (
            <View style={styles.remainingCount}>
              <Text style={styles.remainingText}>+{remainingCount}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderPosts = () => {
    if (currentEventProfile.posts.length === 0) {
      return (
        <View style={styles.emptyPosts}>
          <Text style={styles.emptyPostsText}>Пока нет постов</Text>
        </View>
      );
    }

    return (
      <View style={styles.postsGrid}>
        {currentEventProfile.posts.map((post, index) => {
          const authorData = getUserData(post.authorId);
          return (
            <TouchableOpacity 
              key={post.id} 
              style={styles.postItem}
              onPress={() => handlePostPress(post)}
            >
              {post.type === 'photo' ? (
                <Image source={{ uri: post.content }} style={styles.postImage} />
              ) : post.type === 'music' ? (
                <View style={styles.musicCard}>
                  <View style={styles.musicCover}>
                    {post.artwork_url ? (
                      <Image 
                        source={{ uri: post.artwork_url }} 
                        style={styles.musicCoverImage}
                      />
                    ) : (
                      <Text style={styles.musicIcon}>🎵</Text>
                    )}
                  </View>
                  <View style={styles.musicInfo}>
                    <Text style={styles.musicTitle} numberOfLines={1}>
                      {post.title || 'Неизвестный трек'}
                    </Text>
                    <Text style={styles.musicArtist} numberOfLines={1}>
                      {post.artist || 'Неизвестный исполнитель'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.playButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      playTrack(post.content, post.id);
                    }}
                  >
                    <Text style={styles.playIcon}>
                      {currentPlayingTrack === post.id ? '⏸️' : '▶️'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.postTextContainer}>
                  <Text style={styles.postText}>{post.content}</Text>
                </View>
              )}
              
              {/* Информация об авторе */}
              <View style={styles.postAuthor}>
                <Image source={{ uri: authorData.avatar }} style={styles.authorAvatar} />
                <View style={styles.authorInfo}>
                  <Text style={styles.authorUsername}>@{authorData.username}</Text>
                  <Text style={styles.postDate}>
                    {new Date(post.createdAt).toLocaleDateString('ru-RU')}
                  </Text>
                </View>
              </View>
              
              {post.caption && (
                <Text style={styles.postCaption}>{post.caption}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль события</Text>
        {canEdit && (
          <TouchableOpacity style={styles.editButton} onPress={handleEditPress}>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Event Info */}
        <View style={styles.eventInfo}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventName}>{currentEventProfile.name}</Text>
            {canEdit && (
              <TouchableOpacity style={styles.addPostButton} onPress={handleAddPost}>
                <Text style={styles.addPostIcon}>📷</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.eventMeta}>
            {currentEventProfile.date} • {currentEventProfile.location}
          </Text>
          
          <Text style={styles.eventDescription}>{currentEventProfile.description}</Text>
          
          {renderParticipants()}
        </View>

        {/* Posts */}
        <View style={styles.postsSection}>
          <Text style={styles.postsTitle}>Контент события</Text>
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
            <Text style={styles.backToProfileText}>← Назад к профилю</Text>
          </TouchableOpacity>
          
          <ScrollView 
            ref={scrollViewRef}
            style={styles.contentFeedScroll}
            contentContainerStyle={styles.contentFeedContent}
            showsVerticalScrollIndicator={false}
          >
            {currentEventProfile.posts.map((post, index) => (
              <MemoryPost 
                key={post.id}
                post={post}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Редактировать профиль события</Text>
            
            <TextInput
              style={styles.editInput}
              placeholder="Название события"
              placeholderTextColor="#999"
              value={editName}
              onChangeText={setEditName}
            />
            
            <TextInput
              style={[styles.editInput, styles.editTextArea]}
              placeholder="Описание события"
              placeholderTextColor="#999"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
                <Text style={styles.saveButtonText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
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
            <Text style={styles.modalTitle}>Добавить контент</Text>
            
            {!contentType ? (
              <View style={styles.contentTypeButtons}>
                <TouchableOpacity 
                  style={styles.contentTypeButton} 
                  onPress={() => setContentType('photo')}
                >
                  <Text style={styles.contentTypeIcon}>📷</Text>
                  <Text style={styles.contentTypeText}>Фото</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.contentTypeButton} 
                  onPress={() => setContentType('music')}
                >
                  <Text style={styles.contentTypeIcon}>🎵</Text>
                  <Text style={styles.contentTypeText}>Музыка</Text>
                </TouchableOpacity>
              </View>
            ) : contentType === 'photo' ? (
              <View>
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  placeholder="Описание фото (необязательно)"
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
                    <Text style={styles.cancelButtonText}>Назад</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.saveButton} onPress={handleAddPhoto}>
                    <Text style={styles.saveButtonText}>Выбрать фото</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
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
                      placeholder="Исполнитель"
                      placeholderTextColor="#999"
                      value={musicArtist}
                      onChangeText={setMusicArtist}
                    />
                  </>
                )}
                
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  placeholder="Описание (необязательно)"
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
                    <Text style={styles.cancelButtonText}>Назад</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.saveButton} onPress={handleAddMusic}>
                    <Text style={styles.saveButtonText}>Добавить</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: '#FFF',
    fontSize: 24,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  eventInfo: {
    padding: 20,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  addPostButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPostIcon: {
    fontSize: 20,
  },
  eventMeta: {
    color: '#999',
    fontSize: 16,
    marginBottom: 15,
  },
  eventDescription: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  participantsContainer: {
    marginBottom: 30,
  },
  participantsLabel: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  participantsList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    marginRight: 10,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  remainingCount: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remainingText: {
    color: '#999',
    fontSize: 14,
    fontWeight: 'bold',
  },
  postsSection: {
    paddingHorizontal: 20,
  },
  postsTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  postItem: {
    width: '48%',
    marginBottom: 15,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  postTextContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
  },
  postCaption: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
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
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  // Стили для музыки
  musicCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#333',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  musicCover: {
    width: 60,
    height: 60,
    backgroundColor: '#555',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  musicIcon: {
    fontSize: 24,
  },
  musicCoverImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  musicInfo: {
    flex: 1,
  },
  musicTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  musicArtist: {
    color: '#999',
    fontSize: 14,
  },
  playButton: {
    width: 40,
    height: 40,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 16,
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
  // Стили для информации об авторе
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 5,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorInfo: {
    flex: 1,
  },
  authorUsername: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  postDate: {
    color: '#666',
    fontSize: 10,
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
