import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, PanResponder } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';

interface RequestItemProps {
  id: string;
  type: 'event' | 'friend';
  eventId?: string;
  userId?: string;
  isOutgoing?: boolean;
  status?: 'pending' | 'accepted' | 'rejected';
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onPress?: () => void;
}

export default function RequestItem({ 
  id, 
  type, 
  eventId, 
  userId, 
  isOutgoing = false,
  status = 'pending',
  onAccept, 
  onDecline,
  onPress
}: RequestItemProps) {
  const router = useRouter();
  const { events, getUserData } = useEvents();
  const translateX = useRef(new Animated.Value(0)).current;
  
  const event = eventId ? events.find(e => e.id === eventId) : null;
  const user = userId ? getUserData(userId) : null;
  const currentUser = getUserData('own-profile-1');

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 50;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dx < 0) {
        translateX.setValue(Math.max(gestureState.dx, -120));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -60) {
        Animated.spring(translateX, {
          toValue: -120,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const handleUserPress = () => {
    if (userId) {
      router.push(`/profile/${userId}`);
    }
  };

  const handleEventPress = () => {
    if (onPress) {
      onPress();
    } else if (eventId) {
      // Переходим на страницу с полной карточкой события
      router.push(`/event/${eventId}`);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'accepted':
        return 'Принято';
      case 'rejected':
        return 'Отклонено';
      case 'pending':
      default:
        return 'В ожидании';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'accepted':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      case 'pending':
      default:
        return '#FF9500';
    }
  };

  return (
    <View style={styles.container}>
      {/* Кнопки действий (скрыты за свайпом) */}
      {!isOutgoing && (
        <View style={styles.swipeActions}>
          <TouchableOpacity 
            style={styles.declineButton}
            onPress={() => onDecline?.(id)}
          >
            <Text style={styles.declineText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={() => onAccept?.(id)}
          >
            <Text style={styles.acceptText}>✓</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Основной контент */}
      <Animated.View 
        style={[styles.requestItem, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {/* Аватарка пользователя */}
        <TouchableOpacity 
          style={styles.userAvatarContainer}
          onPress={isOutgoing ? () => router.push('/(tabs)/profile') : handleUserPress}
          activeOpacity={0.7}
        >
          <Image 
            source={{ uri: isOutgoing ? currentUser.avatar : (user?.avatar || 'https://randomuser.me/api/portraits/men/1.jpg') }} 
            style={styles.userAvatar} 
          />
        </TouchableOpacity>

        {/* Основной контент */}
        <View style={styles.contentContainer}>
          {/* Текст запроса */}
          <View style={styles.textContainer}>
            <Text style={[styles.requestText, { fontSize: isOutgoing ? 12 : 14 }]}>
              {isOutgoing ? (
                // Исходящие запросы - новая логика
                <>
                  {type === 'friend' 
                    ? `Вы отправили заявку в друзья к ` 
                    : `Вы хотите присоединиться к `
                  }
                  {type === 'friend' ? (
                    <Text style={styles.userName}>{user?.name}</Text>
                  ) : null}
                </>
              ) : (
                // Входящие запросы
                <>
                  {type === 'friend' ? (
                    // Запрос в друзья: "Имя Ф. хочет добавить в друзья"
                    <>
                      <Text style={styles.userName}>
                        {user?.name ? `${user.name.split(' ')[0]} ${user.name.split(' ')[1]?.[0] || ''}.` : 'Пользователь'}
                      </Text>
                      {' хочет добавить в друзья'}
                    </>
                  ) : (
                    // Запрос на событие: "Имя Ф. хочет присоединиться к"
                    <>
                      <Text style={styles.userName}>
                        {user?.name ? `${user.name.split(' ')[0]} ${user.name.split(' ')[1]?.[0] || ''}.` : 'Пользователь'}
                      </Text>
                      {' хочет присоединиться к'}
                    </>
                  )}
                </>
              )}
            </Text>
            
            {/* Микро-карточка события или аватарка пользователя */}
            {isOutgoing ? (
              // Исходящие запросы - новая логика
              <>
                {type === 'event' && event ? (
                  <TouchableOpacity 
                    style={styles.miniEventCard}
                    onPress={handleEventPress}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: event.mediaUrl || event.organizerAvatar }} 
                      style={styles.miniEventImage} 
                    />
                  </TouchableOpacity>
                ) : type === 'friend' && user ? (
                  <TouchableOpacity 
                    style={styles.targetUserAvatar}
                    onPress={handleUserPress}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: user.avatar }} 
                      style={styles.targetUserAvatarImage} 
                    />
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              // Входящие запросы - старая логика
              <>
                {type === 'event' && event && (
                  <TouchableOpacity 
                    style={styles.miniEventCard}
                    onPress={handleEventPress}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: event.mediaUrl || event.organizerAvatar }} 
                      style={styles.miniEventImage} 
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Статус для исходящих запросов */}
          {isOutgoing && (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: 12,
    marginBottom: 1,
  },
  swipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingRight: 8,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  userAvatarContainer: {
    marginRight: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  requestText: {
    fontSize: 14,
    color: '#FFF',
    flex: 1,
  },
  userName: {
    fontWeight: '600',
    color: '#FFF',
  },
  eventTitle: {
    fontWeight: '600',
    color: '#FFF',
  },
  miniEventCard: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: 8,
    overflow: 'hidden',
  },
  miniEventImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  declineButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  declineText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  acceptButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '500',
  },
  targetUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: 8,
    overflow: 'hidden',
  },
  targetUserAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
