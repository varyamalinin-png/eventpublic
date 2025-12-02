import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { EventProfilePost } from '../context/EventsContext';
import { useEvents } from '../context/EventsContext';

interface MemoryMiniCardProps {
  post: EventProfilePost;
  onPress?: () => void;
}

export default function MemoryMiniCard({ post, onPress }: MemoryMiniCardProps) {
  const router = useRouter();
  const { getUserData } = useEvents();
  
  const author = getUserData(post.authorId);

  const handlePostPress = () => {
    if (onPress) {
      onPress();
    } else {
      // Переход на страницу одного меморис поста
      router.push(`/memory-post/${post.eventId}/${post.id}`);
    }
  };

  const renderContent = () => {
    switch (post.type) {
      case 'photo':
        return (
          <Image 
            source={{ uri: post.content }} 
            style={styles.mediaContent}
            resizeMode="cover"
          />
        );
      
      case 'video':
        return (
          <View style={styles.videoContainer}>
            <Image 
              source={{ uri: post.content }} 
              style={styles.mediaContent}
              resizeMode="cover"
            />
            <View style={styles.playButton}>
              <Text style={styles.playIcon}>▶️</Text>
            </View>
          </View>
        );
      
      case 'music':
        return (
          <View style={styles.musicContainer}>
            <Image 
              source={{ uri: post.artwork_url || 'https://via.placeholder.com/150x150/333333/FFFFFF?text=♪' }} 
              style={styles.mediaContent}
              resizeMode="cover"
            />
            <View style={styles.musicIcon}>
              <Text style={styles.musicSymbol}>♪</Text>
            </View>
          </View>
        );
      
      case 'text':
        return (
          <View style={styles.textContainer}>
            <Text style={styles.textContent} numberOfLines={3}>
              {post.content}
            </Text>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={handlePostPress}
      activeOpacity={0.9}
    >
      {renderContent()}
      
      {/* Автор в правом верхнем углу */}
      {author && (
        <View style={styles.authorContainer}>
          <Image 
            source={{ uri: author.avatar }} 
            style={styles.authorAvatar}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '33.333%', // Точная треть для 3 колонок
    aspectRatio: 0.75, // Прямоугольная форма 3:4 (ширина:высота = 3:4)
    borderWidth: 1,
    borderColor: '#555555',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#3D3B3B',
    margin: 0,
    padding: 0,
    minHeight: 120, // Увеличил минимальную высоту для лучшей видимости
    maxHeight: 150, // Максимальная высота для контроля размера
  },
  mediaContent: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  musicContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  musicIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  musicSymbol: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  textContainer: {
    width: '100%',
    height: '100%',
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  textContent: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 16,
  },
  authorContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
