import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, Modal, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { EventProfilePost } from '../context/EventsContext';
import type { PostComment } from '../types/EventProfile';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatUsername } from '../utils/username';
import { createLogger } from '../utils/logger';

const logger = createLogger('MemoryPost');

interface MemoryPostProps {
  post: EventProfilePost;
  showOptions?: boolean; // Показывать ли кнопку с тремя точками (deprecated - теперь всегда показывается)
}

const { width: screenWidth } = Dimensions.get('window');

export default function MemoryPost({ post, showOptions = false }: MemoryPostProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { getUserData, events, updateEventProfilePost, deleteEventProfilePost, saveMemoryPost, removeSavedMemoryPost, isMemoryPostSaved, reportMemoryPost, sendMemoryPostToChats, getChatsForUser, getFriendsList, createPersonalChat } = useEvents();
  const { user: authUser } = useAuth();
  
  const author = getUserData(post.authorId);
  const event = events.find(e => e.id === post.eventId);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [selectedShareChats, setSelectedShareChats] = useState<string[]>([]);
  // Соотношение сторон теперь фиксированное 3:4 для всех постов, размеры изображения не нужны
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0);
  const modalScrollViewRef = useRef<ScrollView>(null);
  const isMyPost = authUser?.id === post.authorId;
  const isSaved = isMemoryPostSaved(post.eventId, post.id);
  const currentUserId = authUser?.id ?? null;
  
  // Комментарии поста
  const comments = post.comments || [];
  
  // Фото для карусели
  const photos = post.photoUrls && post.photoUrls.length > 0 ? post.photoUrls : (post.photoUrl ? [post.photoUrl] : []);
  const hasCarousel = photos.length > 1;

  // Определяем тип контента на лету (на старых данных поле type может отсутствовать)
  const effectiveType: 'photo' | 'video' | 'music' | 'text' = (() => {
    // Проверяем наличие фото (одиночное или карусель)
    if (post.photoUrl || (post.photoUrls && post.photoUrls.length > 0)) return 'photo';
    // Простейшее определение видео по расширению
    if (typeof post.content === 'string' && /\.(mp4|mov|m4v)$/i.test(post.content)) return 'video';
    return post.type ?? 'text';
  })();

  // Размеры изображения больше не нужны - используем фиксированное соотношение 3:4 для всех постов

  const handlePostPress = () => {
    // Если есть фото - открываем модальное окно для просмотра
    if (photos.length > 0) {
      setModalPhotoIndex(0);
      setShowPhotoModal(true);
    } else {
      // Если нет фото - переходим на страницу профиля события
      router.push(`/event-profile/${post.eventId}`);
    }
  };
  
  const handlePhotoPress = () => {
    // При клике на фото в посте - открываем модальное окно
    if (photos.length > 0) {
      setModalPhotoIndex(currentPhotoIndex);
      setShowPhotoModal(true);
    }
  };
  
  // Прокручиваем к нужному фото при открытии модального окна
  useEffect(() => {
    if (showPhotoModal && hasCarousel && modalScrollViewRef.current) {
      setTimeout(() => {
        modalScrollViewRef.current?.scrollTo({
          x: modalPhotoIndex * screenWidth,
          y: 0,
          animated: false,
        });
      }, 100);
    }
  }, [showPhotoModal, modalPhotoIndex, hasCarousel]);

  const handleAuthorPress = () => {
    if (currentUserId === post.authorId) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/profile/${post.authorId}`);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t.common.deletePost || 'Delete post?',
      t.common.deletePostConfirm || 'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: t.common.cancel || 'Cancel', style: 'cancel' },
        {
          text: t.common.delete || 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEventProfilePost(post.eventId, post.id);
            setShowOptionsModal(false);
            Alert.alert(t.common.success || 'Success', t.common.postDeleted || 'Post deleted');
          }
        }
      ]
    );
  };

  const handleShare = () => {
    setShowOptionsModal(false);
    setSelectedShareChats([]);
    setShareSearchQuery('');
    setShowShareModal(true);
  };

  const handleSave = () => {
    if (isSaved) {
      removeSavedMemoryPost(post.eventId, post.id);
      Alert.alert(t.common.success || 'Success', t.common.postRemovedFromSaved || 'Post removed from saved');
    } else {
      saveMemoryPost(post.eventId, post.id);
      Alert.alert(t.common.success || 'Success', t.common.postSaved || 'Post saved');
    }
    setShowOptionsModal(false);
  };

  const handleReport = () => {
    Alert.alert(
      t.common.reportPost || 'Report post?',
      t.common.reportPostConfirm || 'Are you sure you want to report this post?',
      [
        { text: t.common.cancel || 'Cancel', style: 'cancel' },
        {
          text: t.common.report || 'Report',
          style: 'destructive',
          onPress: () => {
            reportMemoryPost(post.eventId, post.id);
            setShowOptionsModal(false);
            Alert.alert(t.common.thankYou || 'Thank you', t.common.reportSent || 'Your report has been sent for review');
          }
        }
      ]
    );
  };

  const renderContent = () => {
    switch (effectiveType) {
      case 'photo':
        if (photos.length === 0) {
          logger.warn('MemoryPost: нет URI для фото', { postId: post.id });
          return null;
        }
        
        // Если есть карусель (несколько фото)
        if (hasCarousel) {
          return (
            <View style={styles.carouselContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={screenWidth - 24}
                snapToAlignment="start"
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const width = event.nativeEvent.layoutMeasurement.width;
                  const index = Math.round(offsetX / width);
                  setCurrentPhotoIndex(index);
                  logger.debug('Carousel scroll ended', { index, offsetX, width, photosCount: photos.length });
                }}
                style={styles.carouselScrollView}
                contentContainerStyle={styles.carouselContentContainer}
              >
                {photos.map((photoUri, index) => (
                  <View 
                    key={index} 
                    style={styles.carouselItem}
                  >
                    <TouchableOpacity 
                      onPress={handlePhotoPress} 
                      activeOpacity={0.9}
                      style={styles.carouselItemTouchable}
                    >
                      <Image 
                        source={{ uri: photoUri }} 
                        style={styles.mediaContent}
                        resizeMode="contain"
                        onError={(error) => {
                          logger.warn('MemoryPost: ошибка загрузки фото', { postId: post.id, error, uri: photoUri });
                        }}
                      />
                    </TouchableOpacity>
                    {/* Индикатор номера фото в карусели */}
                    <View style={styles.carouselIndicator}>
                      <Text style={styles.carouselIndicatorText}>{index + 1} / {photos.length}</Text>
                    </View>
                    {/* Описание для текущего фото, если есть */}
                    {post.captions && post.captions[index] && (
                      <View style={styles.carouselCaption}>
                        <Text style={styles.carouselCaptionText}>{post.captions[index]}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          );
        }
        
        // Одно фото (без карусели)
        const photoUri = photos[0];
        return (
          <TouchableOpacity onPress={handlePhotoPress} activeOpacity={0.9}>
            <Image 
              source={{ uri: photoUri }} 
              style={styles.mediaContent}
              resizeMode="contain"
              onError={(error) => {
                logger.warn('MemoryPost: ошибка загрузки фото', { postId: post.id, error, uri: photoUri });
              }}
            />
          </TouchableOpacity>
        );
      
      case 'video':
        return (
          <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9}>
            <View style={styles.videoContainer}>
              <Image 
                source={{ uri: post.photoUrl || post.content }} 
                style={styles.mediaContent}
                resizeMode="contain"
              />
              <View style={styles.playButton}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      
      case 'music':
        return (
          <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9}>
            <View style={styles.musicContainer}>
              <Image 
                source={{ uri: post.artwork_url || post.photoUrl || post.content }} 
                style={styles.musicArtwork}
                resizeMode="cover"
              />
              <View style={styles.musicInfo}>
                <Text style={styles.musicTitle}>{post.title}</Text>
                <Text style={styles.musicArtist}>{post.artist}</Text>
              </View>
              <View style={styles.playButton}>
                <Text style={styles.playIcon}>♪</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      
      case 'text':
        // Контейнер contentWrapper уже имеет фиксированное соотношение 3:4
        return (
          <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9}>
            <View style={styles.textContainer}>
              <Text style={styles.textContent}>{post.content}</Text>
            </View>
          </TouchableOpacity>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Контент поста */}
      <View style={styles.contentWrapper}>
      {renderContent()}
        
        {/* Название события в верхнем левом углу с оверлеем - кликабельное, ведет на профиль события */}
        {event?.title && (
          <TouchableOpacity 
            onPress={() => {
              router.push(`/event-profile/${post.eventId}`);
            }} 
            style={styles.eventTitleOverlay}
            activeOpacity={0.7}
          >
            <Text style={styles.eventTitle}>{event.title}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Точки-индикаторы карусели - вынесены за пределы contentWrapper чтобы не обрезались */}
      {hasCarousel && (
        <View style={styles.carouselDots}>
          {photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.carouselDot,
                index === currentPhotoIndex && styles.carouselDotActive
              ]}
            />
          ))}
        </View>
      )}
      
      {/* Аватарка автора в верхнем правом углу - поверх всего поста */}
      <TouchableOpacity onPress={handleAuthorPress} style={styles.authorAvatarOverlay}>
        <Image 
          source={{ uri: author.avatar }} 
          style={styles.authorAvatar}
        />
      </TouchableOpacity>

      {/* Описание/подпись (для одиночного фото или общее описание) */}
      {post.caption && !hasCarousel && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>{post.caption}</Text>
        </View>
      )}

      {/* Комментарии */}
      {showComments && (
        <View style={styles.commentsContainer}>
          <ScrollView style={styles.commentsList} nestedScrollEnabled={true}>
            {comments.length === 0 ? (
              <Text style={styles.noCommentsText}>Нет комментариев</Text>
            ) : (
              comments.map((comment) => {
                const commentAuthor = getUserData(comment.authorId);
                return (
                  <View key={comment.id} style={styles.commentItem}>
                    <Image 
                      source={{ uri: commentAuthor.avatar || 'https://via.placeholder.com/32' }} 
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <Text style={styles.commentAuthor}>{formatUsername(commentAuthor.username)}</Text>
                      <Text style={styles.commentText}>{comment.content}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          
          {/* Поле ввода комментария */}
          {currentUserId && (
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Добавить комментарий..."
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.commentSendButton, (!commentText.trim() || isPostingComment) && styles.commentSendButtonDisabled]}
                onPress={async () => {
                  if (!commentText.trim() || isPostingComment || !currentUserId) {
                    logger.debug('Cannot add comment:', { 
                      hasText: !!commentText.trim(), 
                      isPosting: isPostingComment, 
                      hasUserId: !!currentUserId 
                    });
                    return;
                  }
                  setIsPostingComment(true);
                  try {
                    // TODO: Реализовать добавление комментариев через API
                    logger.warn('addPostComment is not available');
                    Alert.alert('Информация', 'Функция добавления комментариев временно недоступна');
                    setCommentText('');
                  } catch (error) {
                    logger.error('Failed to add comment:', error);
                    Alert.alert('Ошибка', 'Не удалось добавить комментарий. Попробуйте еще раз.');
                  } finally {
                    setIsPostingComment(false);
                  }
                }}
                disabled={!commentText.trim() || isPostingComment}
              >
                <Text style={styles.commentSendButtonText}>Отправить</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Информация об авторе и дата в нижней рамке */}
      <View style={styles.authorContainer}>
        <TouchableOpacity onPress={handleAuthorPress} style={styles.authorInfo}>
            <Text style={styles.authorUsername}>{formatUsername(author.username)}</Text>
        </TouchableOpacity>
        
        <View style={styles.dateAndOptionsContainer}>
          <Text style={styles.eventDate}>
            {post.createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </Text>
          
          {/* Кнопка комментариев - на одной линии с датой */}
          <TouchableOpacity 
            style={styles.commentsButtonInline}
            onPress={() => setShowComments(!showComments)}
          >
            <Text style={styles.commentsIcon}>💬</Text>
            {comments.length > 0 && (
              <Text style={styles.commentsCount}>{comments.length}</Text>
            )}
          </TouchableOpacity>
        
        {/* Кнопка с тремя точками - показывается всегда */}
        <TouchableOpacity 
          style={styles.optionsButton}
          onPress={() => setShowOptionsModal(true)}
        >
          <Text style={styles.optionsIcon}>⋯</Text>
        </TouchableOpacity>
        </View>
      </View>

      {/* Модальное окно для просмотра фото в полном размере */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.photoModalContainer}>
          <TouchableOpacity 
            style={styles.photoModalCloseButton}
            onPress={() => setShowPhotoModal(false)}
          >
            <Text style={styles.photoModalCloseText}>✕</Text>
          </TouchableOpacity>
          
          {hasCarousel ? (
            // Карусель в модальном окне
            <ScrollView
              ref={modalScrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onMomentumScrollEnd={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const width = event.nativeEvent.layoutMeasurement.width;
                const index = Math.round(offsetX / width);
                setModalPhotoIndex(index);
              }}
            >
              {photos.map((photoUri, index) => (
                <View key={index} style={styles.photoModalItem}>
                  <Image 
                    source={{ uri: photoUri }} 
                    style={styles.photoModalImage}
                    resizeMode="contain"
                  />
                  {/* Индикатор номера фото */}
                  <View style={styles.photoModalIndicator}>
                    <Text style={styles.photoModalIndicatorText}>{index + 1} / {photos.length}</Text>
                  </View>
                  {/* Описание для текущего фото, если есть */}
                  {post.captions && post.captions[index] && (
                    <View style={styles.photoModalCaption}>
                      <Text style={styles.photoModalCaptionText}>{post.captions[index]}</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            // Одиночное фото в модальном окне
            <View style={styles.photoModalItem}>
              <Image 
                source={{ uri: photos[0] }} 
                style={styles.photoModalImage}
                resizeMode="contain"
              />
              {/* Описание, если есть */}
              {post.caption && (
                <View style={styles.photoModalCaption}>
                  <Text style={styles.photoModalCaptionText}>{post.caption}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Модальное окно с опциями */}
      <Modal
        visible={showOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {/* Удалить - только если я создатель */}
            {isMyPost && (
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={handleDelete}
              >
                <Text style={[styles.modalOptionText, styles.modalOptionTextDanger]}>{t.common.delete || 'Delete'}</Text>
              </TouchableOpacity>
            )}
            
            {/* Поделиться */}
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={handleShare}
            >
              <Text style={styles.modalOptionText}>{t.common.share || 'Share'}</Text>
            </TouchableOpacity>
            
            {/* Сохранить */}
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={handleSave}
            >
              <Text style={styles.modalOptionText}>
                {isSaved ? (t.common.removeFromSaved || 'Remove from saved') : (t.common.save || 'Save')}
              </Text>
            </TouchableOpacity>
            
            {/* Пожаловаться - только если я не создатель */}
            {!isMyPost && (
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={handleReport}
              >
                <Text style={[styles.modalOptionText, styles.modalOptionTextDanger]}>{t.common.report || 'Report'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Модальное окно для выбора чатов и друзей для отправки меморис поста */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.shareModalOverlay}>
          <View style={styles.shareModalContent}>
            <View style={styles.shareModalHeader}>
              <Text style={styles.shareModalTitle}>{t.events.shareEvent || 'Share post'}</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Text style={styles.shareModalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Поле поиска */}
            <TextInput
              style={styles.shareModalSearchInput}
              placeholder={t.events.searchChatsAndFriends || 'Search chats and friends...'}
              placeholderTextColor="#999"
              value={shareSearchQuery}
              onChangeText={setShareSearchQuery}
            />
            
            {/* Список чатов и друзей */}
            <ScrollView style={styles.shareModalScrollView}>
              {/* Чаты */}
              <Text style={styles.shareModalSectionTitle}>{t.events.chats || 'Chats'}</Text>
              {currentUserId && getChatsForUser(currentUserId)
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
                        {chat.type === 'event' ? (t.events.eventChat || 'Event chat') : (t.events.personalChat || 'Personal chat')}
                      </Text>
                    </View>
                    <Text style={styles.shareModalCheckbox}>
                      {selectedShareChats.includes(chat.id) ? '☑' : '☐'}
                    </Text>
                  </TouchableOpacity>
                ))}
              
              {/* Друзья (создаем личные чаты) */}
              <Text style={styles.shareModalSectionTitle}>{t.events.friends || 'Friends'}</Text>
              {currentUserId && getFriendsList()
                .filter(friend => 
                  friend.name.toLowerCase().includes(shareSearchQuery.toLowerCase()) ||
                  friend.username.toLowerCase().includes(shareSearchQuery.toLowerCase())
                )
                .map(friend => {
                  const existingChat = getChatsForUser(currentUserId).find(
                    chat => chat.type === 'personal' && chat.participants.includes(friend.id)
                  );
                  const chatId = existingChat ? existingChat.id : null;
                  const friendKey = `friend_${friend.id}`;
                  const isSelected = selectedShareChats.includes(friendKey) || (chatId && selectedShareChats.includes(chatId));
                  
                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={styles.shareModalItem}
                      onPress={async () => {
                        let targetChatId = chatId;
                        if (!targetChatId) {
                          try {
                            targetChatId = await createPersonalChat(friend.id);
                          } catch (error) {
                            logger.error('Failed to create personal chat', error);
                            return;
                          }
                        }
                        
                        const isCurrentlySelected = selectedShareChats.includes(targetChatId) || selectedShareChats.includes(friendKey);
                        
                        if (isCurrentlySelected) {
                          setSelectedShareChats(prev => prev.filter(id => id !== targetChatId && id !== friendKey));
                        } else {
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
                const validChatIds = selectedShareChats.filter(chatId => !chatId.startsWith('friend_'));
                if (validChatIds.length > 0) {
                  sendMemoryPostToChats(post.eventId, post.id, validChatIds);
                  setShowShareModal(false);
                  setSelectedShareChats([]);
                  setShareSearchQuery('');
                }
              }}
              disabled={selectedShareChats.filter(chatId => !chatId.startsWith('friend_')).length === 0}
            >
              <Text style={styles.shareModalSendButtonText}>
                {t.events.send || 'Send'} ({selectedShareChats.filter(chatId => !chatId.startsWith('friend_')).length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'visible', // Разрешаем аватарке выходить за пределы
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    flexShrink: 1, // Позволяет сжиматься при ограничении высоты
  },
  contentWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3 / 4, // Фиксированное соотношение сторон 3:4 для всех постов
    backgroundColor: '#2A2A2A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden', // Обрезаем содержимое по закругленным углам
  },
  eventTitleOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  authorAvatarOverlay: {
    position: 'absolute',
    top: -13, // Еще ниже на 1 пиксель (всего на 2 пикселя ниже от исходного)
    right: -9, // Еще левее на 3 пикселя (всего на 6 пикселей левее от исходного)
    zIndex: 999, // Верхний слой - поверх всего контента поста
  },
  authorAvatar: {
    width: 69, // Увеличено в 1.3 раза: 53 * 1.3 ≈ 69
    height: 69,
    borderRadius: 34.5,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10, // Увеличено для Android
  },
  eventDate: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
  },
  mediaContent: {
    width: '100%',
    height: '100%', // Занимает всю высоту контейнера с фиксированным соотношением 3:4
    // Фото подстраивается под контейнер, по бокам может быть пустое место
    backgroundColor: '#2A2A2A',
  },
  videoContainer: {
    position: 'relative',
  },
  musicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2A2A2A',
  },
  musicArtwork: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  musicInfo: {
    flex: 1,
  },
  musicTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  musicArtist: {
    fontSize: 14,
    color: '#999999',
  },
  textContainer: {
    width: '100%',
    height: '100%', // Занимает всю высоту контейнера с фиксированным соотношением 3:4
    padding: 16,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    color: '#CCCCCC',
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    // Убрали borderTopWidth - рамки сверху нет
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateAndOptionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optionsButton: {
    padding: 8,
  },
  optionsIcon: {
    fontSize: 20,
    color: '#999999',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalOptionTextDanger: {
    color: '#FF4444',
  },
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
    color: '#FFFFFF',
    backgroundColor: '#2a2a2a',
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
  // Стили для карусели
  carouselContainer: {
    position: 'relative',
  },
  carouselScrollView: {
    flexGrow: 0,
  },
  carouselContentContainer: {
    alignItems: 'center',
  },
  carouselItem: {
    width: screenWidth - 24, // Учитываем marginHorizontal: 12 с каждой стороны
    position: 'relative',
  },
  carouselItemTouchable: {
    width: '100%',
  },
  carouselIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  carouselIndicatorText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  carouselCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
  },
  carouselCaptionText: {
    color: '#FFF',
    fontSize: 14,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#666',
    marginHorizontal: 3,
  },
  carouselDotActive: {
    backgroundColor: '#8B5CF6',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Стили для комментариев
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentsButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  commentsIcon: {
    fontSize: 20,
  },
  commentsCount: {
    color: '#999',
    fontSize: 14,
  },
  commentsContainer: {
    backgroundColor: '#1A1A1A',
    maxHeight: 300,
  },
  commentsList: {
    maxHeight: 200,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  noCommentsText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  commentText: {
    color: '#DDD',
    fontSize: 14,
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    maxHeight: 100,
    marginRight: 8,
  },
  commentSendButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  commentSendButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  commentSendButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Стили для модального окна просмотра фото
  photoModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalCloseText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  photoModalItem: {
    width: screenWidth,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalImage: {
    width: screenWidth,
    height: '100%',
  },
  photoModalIndicator: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  photoModalIndicatorText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  photoModalCaption: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
  },
  photoModalCaptionText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
  },
});
