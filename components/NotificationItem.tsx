import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import { Notification } from '../types';
import { formatDate } from '../utils/dateHelpers';
import { formatTimeAgo } from '../utils/timeAgo';

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
  onDelete?: () => void;
}

export default function NotificationItem({ notification, onPress, onDelete }: NotificationItemProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { getUserData, events } = useEvents();
  const { payload, type } = notification;
  
  const actor = payload.actorId ? getUserData(payload.actorId) : null;
  const event = payload.eventId ? events.find(e => e.id === payload.eventId) : null;
  const eventMediaUrl = payload.eventMediaUrl || (event?.mediaUrl);

  // Определяем текст уведомления
  const getNotificationText = () => {
    const actorName = payload.actorName || actor?.name || (t.notifications.user || 'User');
    
    switch (type) {
      case 'EVENT_UPDATED':
        return `${actorName} ${t.notifications.changed || 'changed'} ${payload.changedField || (t.notifications.parameters || 'parameters')} ${t.notifications.in || 'in'}`;
      case 'EVENT_CANCELLED': {
        // Для отмененных событий добавляем дату
        const eventDate = payload.eventDate || event?.date;
        const formattedDate = eventDate ? formatDate(eventDate) : '';
        return `${actorName} ${t.notifications.cancelled || 'cancelled'} ${t.notifications.event || 'event'}${formattedDate ? ` ${formattedDate}` : ''}`;
      }
      case 'EVENT_PARTICIPANT_JOINED':
        return `${actorName} ${t.notifications.joined || 'joined'}`;
      case 'EVENT_PARTICIPANT_LEFT':
        return `${actorName} ${t.notifications.left || 'left'} ${t.notifications.event || 'event'}`;
      case 'EVENT_POST_ADDED':
        return `${actorName} ${t.notifications.posted || 'posted'} ${t.notifications.post || 'post'} ${t.notifications.in || 'in'}`;
      default:
        return t.notifications.newNotification || 'New notification';
    }
  };

  const handlePress = () => {
    // Для отмененных событий не переходим на профиль события
    if (type === 'EVENT_CANCELLED') {
      onPress?.();
      return;
    }
    
    if (payload.eventId) {
      router.push(`/event-profile/${payload.eventId}`);
    }
    onPress?.();
  };

  const handleAvatarPress = () => {
    if (payload.actorId) {
      router.push(`/profile/${payload.actorId}`);
    }
  };

  // Для отмененных событий весь контейнер некликабелен
  const isCancelled = type === 'EVENT_CANCELLED';
  
  const ContainerComponent = isCancelled ? View : TouchableOpacity;
  const containerProps = isCancelled ? {} : { onPress: handlePress, activeOpacity: 0.7 };
  
  return (
    <ContainerComponent
      style={[styles.container, !notification.readAt && styles.unread]}
      {...containerProps}
    >
      {/* Мини-аватарка (кликабельная) */}
      <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.7}>
        {actor?.avatar ? (
          <Image source={{ uri: actor.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {actor?.name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Текст уведомления */}
      <View style={styles.textContainer}>
        <Text style={styles.text}>
          {getNotificationText()}
        </Text>
      </View>
      
      {/* Иконка события */}
      {/* Для отмененных событий иконка некликабельна */}
      {eventMediaUrl && (
        type === 'EVENT_CANCELLED' ? (
          <Image source={{ uri: eventMediaUrl }} style={styles.eventIcon} />
        ) : (
          <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
            <Image source={{ uri: eventMediaUrl }} style={styles.eventIcon} />
          </TouchableOpacity>
        )
      )}

      {/* Время получения уведомления - самый правый элемент */}
      <Text style={styles.timeAgo}>
        {formatTimeAgo(notification.createdAt)}
      </Text>
    </ContainerComponent>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    backgroundColor: '#121212',
  },
  unread: {
    backgroundColor: '#1A1A1A',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    color: '#FFF',
    lineHeight: 18,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: 8,
    marginRight: 8,
  },
  timeAgo: {
    fontSize: 12,
    color: '#999',
    minWidth: 50,
    textAlign: 'right',
  },
});

