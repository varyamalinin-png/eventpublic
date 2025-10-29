import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { EventProfilePost } from '../context/EventsContext';
import { useEvents } from '../context/EventsContext';

interface MemoryPostProps {
  post: EventProfilePost;
  showOptions?: boolean; // Показывать ли кнопку с тремя точками
}

const { width: screenWidth } = Dimensions.get('window');

export default function MemoryPost({ post, showOptions = false }: MemoryPostProps) {
  const router = useRouter();
  const { getUserData, events, updateEventProfilePost } = useEvents();
  
  const author = getUserData(post.authorId);
  const event = events.find(e => e.id === post.eventId);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const handlePostPress = () => {
    router.push(`/event-profile/${post.eventId}`);
  };

  const handleAuthorPress = () => {
    router.push(`/profile/${post.authorId}`);
  };

  const handleShowInProfile = () => {
    updateEventProfilePost(post.eventId, post.id, { showInProfile: true });
    setShowOptionsModal(false);
  };

  const handleHideFromProfile = () => {
    updateEventProfilePost(post.eventId, post.id, { showInProfile: false });
    setShowOptionsModal(false);
  };

  const renderContent = () => {
    switch (post.type) {
      case 'photo':
        return (
          <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9}>
            <Image 
              source={{ uri: post.content }} 
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
                source={{ uri: post.content }} 
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
                source={{ uri: post.artwork_url || post.content }} 
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
            <Text style={styles.authorUsername}>@{author.username}</Text>
          </View>
        </TouchableOpacity>
        
        {/* Кнопка с тремя точками - показывается только для своих постов */}
        {showOptions && (
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => setShowOptionsModal(true)}
          >
            <Text style={styles.optionsIcon}>⋯</Text>
          </TouchableOpacity>
        )}
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
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={post.showInProfile ? handleHideFromProfile : handleShowInProfile}
            >
              <Text style={styles.modalOptionText}>
                {post.showInProfile ? 'Не показывать в профиле' : 'Показать в профиле'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
});
