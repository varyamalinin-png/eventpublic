import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';

interface RequestMiniCardProps {
  id: string;
  type: 'event' | 'friend';
  eventId?: string;
  userId?: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onPress?: () => void;
}

export default function RequestMiniCard({ 
  id, 
  type, 
  eventId, 
  userId, 
  onAccept, 
  onDecline, 
  onPress 
}: RequestMiniCardProps) {
  const router = useRouter();
  const { events, getUserData } = useEvents();
  
  const event = eventId ? events.find(e => e.id === eventId) : null;
  const user = userId ? getUserData(userId) : null;

  const handlePress = () => {
    // Если есть кастомный обработчик, используем его
    if (onPress) {
      onPress();
      return;
    }
    
    // Для событий переходим в профиль с открытым событием
    if (type === 'event' && eventId) {
      router.push(`/(tabs)/profile?eventId=${eventId}`);
    } 
    // Для друзей переходим в профиль пользователя
    else if (type === 'friend' && userId) {
      router.push(`/profile/${userId}`);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.miniatureCard}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Фоновое изображение */}
      {(type === 'event' && event?.mediaUrl) || (type === 'friend' && user?.avatar) ? (
        <View style={styles.miniatureBackgroundContainer}>
          <Image 
            source={{ uri: type === 'event' ? event?.mediaUrl : user?.avatar }} 
            style={styles.miniatureBackgroundImage} 
          />
          <View style={styles.miniatureOverlay} />
        </View>
      ) : null}

      {/* Аватарка организатора/пользователя в правом верхнем углу */}
      {type === 'event' && event ? (
        <Image 
          source={{ uri: event.organizerAvatar }} 
          style={styles.miniatureOrganizerAvatar} 
        />
      ) : type === 'friend' && user ? (
        <Image 
          source={{ uri: user.avatar }} 
          style={styles.miniatureOrganizerAvatar} 
        />
      ) : null}

      {/* Информация о событии/пользователе */}
      <View style={styles.miniatureInfo}>
        {type === 'event' && event ? (
          <>
            <Text style={styles.miniatureTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.miniatureLocation} numberOfLines={1}>
              {event.location}
            </Text>
            <Text style={styles.miniatureDate}>
              {event.displayDate} • {event.displayTime}
            </Text>
          </>
        ) : type === 'friend' && user ? (
          <>
            <Text style={styles.miniatureTitle} numberOfLines={2}>
              {user.name}
            </Text>
            <Text style={styles.miniatureLocation} numberOfLines={1}>
              {user.username}
            </Text>
            <Text style={styles.miniatureDate}>
              {user.age} • {user.geoPosition}
            </Text>
          </>
        ) : null}
      </View>

      {/* Кнопки действий */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.declineButton}
          onPress={(e) => {
            e.stopPropagation();
            onDecline(id);
          }}
        >
          <Text style={styles.declineText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.acceptButton}
          onPress={(e) => {
            e.stopPropagation();
            onAccept(id);
          }}
        >
          <Text style={styles.acceptText}>✓</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  miniatureCard: {
    width: 160,
    height: 160,
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
    backgroundColor: '#F0F0F0',
    marginBottom: 10,
    marginTop: 5,
  },
  miniatureBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  miniatureBackgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  miniatureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  miniatureOrganizerAvatar: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  miniatureInfo: {
    position: 'absolute',
    bottom: 40,
    left: 8,
    right: 8,
  },
  miniatureTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
    lineHeight: 14,
  },
  miniatureLocation: {
    fontSize: 10,
    color: '#CCC',
    marginBottom: 2,
  },
  miniatureDate: {
    fontSize: 9,
    color: '#AAA',
  },
  actionButtons: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  declineButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  acceptButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useEvents } from '../context/EventsContext';

interface RequestMiniCardProps {
  id: string;
  type: 'event' | 'friend';
  eventId?: string;
  userId?: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onPress?: () => void;
}

