import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, Modal, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { EventProfilePost } from '../context/EventsContext';
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
  const isMyPost = authUser?.id === post.authorId;
  const isSaved = isMemoryPostSaved(post.eventId, post.id);
  const currentUserId = authUser?.id ?? null;

  // Определяем тип контента на лету (на старых данных поле type может отсутствовать)
  const effectiveType: 'photo' | 'video' | 'music' | 'text' = (() => {
    if (post.photoUrl) return 'photo';
    // Простейшее определение видео по расширению
    if (typeof post.content === 'string' && /\.(mp4|mov|m4v)$/i.test(post.content)) return 'video';
    return post.type ?? 'text';
  })();

  const handlePostPress = () => {
    router.push(`/event-profile/${post.eventId}`);
  };

  const handleAuthorPress = () => {
    router.push(`/profile/${post.authorId}`);
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
        return (
          <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9}>
            <Image 
              source={{ uri: post.photoUrl || post.content }} 
              style={styles.mediaContent}
              resizeMode="cover"
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
                resizeMode="cover"
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
      {/* Заголовок с информацией о событии */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePostPress} style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{event?.title}</Text>
          <Text style={styles.eventDate}>
            {post.createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Контент поста */}
      {renderContent()}

      {/* Описание/подпись */}
      {post.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>{post.caption}</Text>
        </View>
      )}

      {/* Информация об авторе */}
      <View style={styles.authorContainer}>
        <TouchableOpacity onPress={handleAuthorPress} style={styles.authorInfo}>
          <Image 
            source={{ uri: author.avatar }} 
            style={styles.authorAvatar}
          />
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{author.name}</Text>
            <Text style={styles.authorUsername}>{formatUsername(author.username)}</Text>
          </View>
        </TouchableOpacity>
        
        {/* Кнопка с тремя точками - показывается всегда */}
        <TouchableOpacity 
          style={styles.optionsButton}
          onPress={() => setShowOptionsModal(true)}
        >
          <Text style={styles.optionsIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

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
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  eventDate: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
  mediaContent: {
    width: '100%',
    height: screenWidth * 0.8, // Соотношение 4:5
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
    padding: 16,
    backgroundColor: '#2A2A2A',
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
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  authorUsername: {
    fontSize: 12,
    color: '#999999',
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
});
