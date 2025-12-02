import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, PanResponder } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/timeAgo';

interface RequestItemProps {
  id: string;
  type: 'event' | 'friend';
  eventId?: string;
  userId?: string;
  isOutgoing?: boolean;
  status?: 'pending' | 'accepted' | 'rejected';
  isInvite?: boolean; // Флаг для приглашений
  isBusinessAccount?: boolean; // Флаг для бизнес-аккаунта
  createdAt?: Date | string; // Дата создания запроса
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
  isInvite = false,
  isBusinessAccount = false,
  createdAt,
  onAccept, 
  onDecline,
  onPress
}: RequestItemProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { events, getUserData, getEventPhotoForUser } = useEvents();
  const { user: authUser } = useAuth();
  const translateX = useRef(new Animated.Value(0)).current;
  
  const event = eventId ? events.find(e => e.id === eventId) : null;
  const user = userId ? getUserData(userId) : null;
  const currentUserId = authUser?.id ?? null;
  const currentUser = currentUserId ? getUserData(currentUserId) : null;

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
      // Переходим в аккаунт события
      router.push(`/event-profile/${eventId}`);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'accepted':
        return '✓';
      case 'pending':
      default:
        return '⏱';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'accepted':
        return '#34C759';
      case 'pending':
      default:
        return '#FF9500';
    }
  };

  return (
    <View style={styles.container}>
      {/* Кнопки действий (скрыты за свайпом) - не показываем для бизнес-аккаунтов */}
      {!isOutgoing && !isBusinessAccount && (
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
        {...(!isBusinessAccount ? panResponder.panHandlers : {})}
      >
        {/* Аватарка пользователя */}
        <TouchableOpacity 
          style={styles.userAvatarContainer}
          onPress={
            isOutgoing
              ? () => {
                  if (currentUserId) {
                    router.push(`/profile/${currentUserId}`);
                  } else {
                    router.push('/(auth)');
                  }
                }
              : handleUserPress
          }
          activeOpacity={0.7}
        >
          <Image 
            source={{
              uri: isOutgoing
                ? currentUser?.avatar || 'https://randomuser.me/api/portraits/men/1.jpg'
                : user?.avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
            }} 
            style={styles.userAvatar} 
          />
        </TouchableOpacity>

        {/* Основной контент */}
        <View style={styles.contentContainer}>
          {/* Текст запроса */}
          <View style={styles.textContainer}>
            {isOutgoing ? (
              // Исходящие запросы - новая структура
              <View style={styles.outgoingRequestContent}>
                <Text style={styles.requestText}>
                  {type === 'friend' 
                    ? t.requestItem.sentFriendRequest
                    : isInvite
                    ? t.requestItem.sentInvite
                    : t.requestItem.sentJoinRequest
                  }
                </Text>
                
                {/* Аватар пользователя, которому отправлен запрос */}
                {type === 'friend' && user ? (
                  <TouchableOpacity 
                    style={styles.inlineAvatar}
                    onPress={handleUserPress}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: user.avatar }} 
                      style={styles.inlineAvatarImage} 
                    />
                  </TouchableOpacity>
                ) : isInvite && user ? (
                  <>
                    <TouchableOpacity 
                      style={styles.inlineAvatar}
                      onPress={handleUserPress}
                      activeOpacity={0.7}
                    >
                      <Image 
                        source={{ uri: user.avatar }} 
                        style={styles.inlineAvatarImage} 
                      />
                    </TouchableOpacity>
                    <Text style={styles.requestText}> {t.requestItem.toEvent} </Text>
                    {event && (
                      <TouchableOpacity 
                        style={styles.inlineEventIcon}
                        onPress={handleEventPress}
                        activeOpacity={0.7}
                      >
                        <Image 
                          source={{ uri: (() => {
                            const viewerId = currentUserId ?? '';
                            return getEventPhotoForUser(event.id, viewerId) || event.organizerAvatar;
                          })()}} 
                          style={styles.inlineEventIconImage} 
                        />
                      </TouchableOpacity>
                    )}
                  </>
                ) : type === 'event' && event ? (
                  // Для исходящих запросов на участие в событии показываем иконку события
                  <TouchableOpacity 
                    style={styles.inlineEventIcon}
                    onPress={handleEventPress}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: (() => {
                        const viewerId = currentUserId ?? '';
                        return getEventPhotoForUser(event.id, viewerId) || event.organizerAvatar;
                      })()}} 
                      style={styles.inlineEventIconImage} 
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              // Входящие запросы
              <Text style={styles.requestText}>
                {type === 'friend' ? (
                  // Запрос в друзья: "Имя Ф. хочет добавить в друзья"
                  <>
                    <Text style={styles.userName}>
                      {user?.name ? `${user.name.split(' ')[0]} ${user.name.split(' ')[1]?.[0] || ''}.` : t.requestItem.user}
                    </Text>
                    {' '}{t.requestItem.wantsToBeFriend}
                  </>
                ) : isInvite ? (
                  // Входящее приглашение: "Имя Ф. хочет пригласить вас на"
                  <>
                    <Text style={styles.userName}>
                      {user?.name ? `${user.name.split(' ')[0]} ${user.name.split(' ')[1]?.[0] || ''}.` : t.requestItem.user}
                    </Text>
                    {' '}{t.requestItem.wantsToInviteYou}{' '}
                  </>
                ) : isBusinessAccount ? (
                  // Для бизнес-аккаунтов: "(аватар) присоединился к (иконка события)"
                  <Text style={styles.requestText}>присоединился к</Text>
                ) : (
                  // Запрос на событие: "Имя Ф. хочет присоединиться к"
                  <>
                    <Text style={styles.userName}>
                      {user?.name ? `${user.name.split(' ')[0]} ${user.name.split(' ')[1]?.[0] || ''}.` : t.requestItem.user}
                    </Text>
                    {' '}{t.requestItem.wantsToJoin}
                  </>
                )}
              </Text>
            )}
          </View>

          {/* Микро-карточка события для входящих запросов (не показываем для бизнес-аккаунтов) */}
          {!isOutgoing && type === 'event' && event && !isBusinessAccount && (
            <TouchableOpacity 
              style={styles.miniEventCard}
              onPress={handleEventPress}
              activeOpacity={0.7}
            >
              <Image 
                source={{ uri: (() => {
                  const viewerId = currentUserId ?? '';
                  return getEventPhotoForUser(event.id, viewerId) || event.organizerAvatar;
                })()}} 
                style={styles.miniEventImage} 
              />
            </TouchableOpacity>
          )}
          
          {/* Для бизнес-аккаунтов показываем иконку события после текста "присоединился к" */}
          {!isOutgoing && type === 'event' && isBusinessAccount && event && (
            <TouchableOpacity 
              style={styles.inlineEventIcon}
              onPress={handleEventPress}
              activeOpacity={0.7}
            >
              <Image 
                source={{ uri: (() => {
                  const viewerId = currentUserId ?? '';
                  return getEventPhotoForUser(event.id, viewerId) || event.organizerAvatar;
                })()}} 
                style={styles.inlineEventIconImage} 
              />
            </TouchableOpacity>
          )}

          {/* Статус для исходящих запросов */}
          {isOutgoing && (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
            </View>
          )}

          {/* Время создания запроса - самый правый элемент */}
          {createdAt && (
            <Text style={styles.timeAgo}>
              {formatTimeAgo(createdAt)}
            </Text>
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
    marginRight: 10,
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
    marginRight: 6,
  },
  requestText: {
    fontSize: 13,
    color: '#FFF',
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
    marginRight: 8,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statusIcon: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeAgo: {
    fontSize: 12,
    color: '#999',
    minWidth: 50,
    textAlign: 'right',
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
  outgoingRequestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    flex: 1,
  },
  inlineAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  inlineAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  inlineEventIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: 2,
    marginRight: 8,
    overflow: 'hidden',
  },
  inlineEventIconImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
