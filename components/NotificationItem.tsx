import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { openUserProfile } from '../utils/openUserProfile';
import { useLanguage } from '../context/LanguageContext';
import { Notification } from '../types';
import { formatDate } from '../utils/dateHelpers';
import { formatTimeAgo } from '../utils/timeAgo';
import { ScreenPadding } from '../constants/DesignSystem';
import { sizedImage } from '../utils/imageSize';

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
  onDelete?: () => void;
  /**
   * Действия по уведомлению — заявка на участие в моём событии и предложение
   * стать организатором. Когда переданы, вместо крестика «удалить»
   * показываются «принять» и «отклонить»: удалять непрочитанную заявку
   * бессмысленно, на неё надо ответить.
   */
  onAccept?: () => void;
  onDecline?: () => void;
}

// Иконка и цвет для каждого типа уведомления
function getTypeConfig(type: string) {
  switch (type) {
    case 'EVENT_PARTICIPANT_JOINED': return { emoji: '✓', color: '#34C759' };
    case 'EVENT_PARTICIPANT_LEFT':  return { emoji: '↩', color: '#FF3B30' };
    case 'EVENT_UPDATED':           return { emoji: '✏', color: '#FF8D32' };
    case 'EVENT_CANCELLED':         return { emoji: '✕', color: '#FF3B30' };
    case 'EVENT_POST_ADDED':        return { emoji: '📷', color: '#AF52DE' };
    case 'EVENT_JOIN_REQUEST':      return { emoji: '🙋', color: '#FF8D32' };
    case 'EVENT_REQUEST_ACCEPTED':  return { emoji: '✓', color: '#34C759' };
    case 'FRIEND_REQUEST':          return { emoji: '👤', color: '#0A84FF' };
    case 'EVENT_ORGANIZER_TRANSFERRED': return { emoji: '★', color: '#FF8D32' };
    case 'EVENT_INVITE':            return { emoji: '✉', color: '#0A84FF' };
    case 'FRIEND_REQUEST_ACCEPTED': return { emoji: '✓', color: '#0A84FF' };
    case 'EVENT_INVITE_DECLINED':   return { emoji: '✕', color: '#8E8E93' };
    case 'EVENT_POST_LIKED':        return { emoji: '♥', color: '#FF2D55' };
    case 'EVENT_POST_COMMENTED':    return { emoji: '💬', color: '#5E5CE6' };
    default:                        return { emoji: '🔔', color: '#FF8D32' };
  }
}

type NotificationText = {
  actor: string;
  action: string;
  eventName?: string;
  /** Вторая строка — например, начало комментария. */
  detail?: string;
};

function NotificationItem({ notification, onPress, onDelete, onAccept, onDecline }: NotificationItemProps) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const { t } = useLanguage();
  const { getUserData, events } = useEvents();
  const { payload, type } = notification;

  const actor = payload.actorId ? getUserData(payload.actorId) : null;
  const event = payload.eventId ? events.find(e => e.id === payload.eventId) : null;
  // У лайка и комментария превью — сама публикация, а не обложка события.
  const eventMediaUrl = payload.postPhotoUrl || payload.eventMediaUrl || (event?.mediaUrl);
  const isUnread = !notification.readAt;
  const typeConfig = getTypeConfig(type);

  const getNotificationText = (): NotificationText => {
    const actorName = payload.actorName || actor?.name || (t.notifications.user || 'User');
    switch (type) {
      case 'EVENT_UPDATED':
        return { actor: actorName, action: `${t.notifications.changed || 'changed'} ${payload.changedField || (t.notifications.parameters || 'parameters')} ${t.notifications.in || 'in'}`, eventName: event?.title || payload.eventTitle };
      case 'EVENT_CANCELLED': {
        const eventDate = (payload as any).eventDate || event?.date;
        const formattedDate = eventDate ? formatDate(eventDate) : '';
        return { actor: actorName, action: `${t.notifications.cancelled || 'cancelled'} ${t.notifications.event || 'event'}${formattedDate ? ` ${formattedDate}` : ''}` };
      }
      case 'EVENT_PARTICIPANT_JOINED':
        return { actor: actorName, action: `${t.notifications.joined || 'joined'}`, eventName: event?.title || payload.eventTitle };
      case 'EVENT_PARTICIPANT_LEFT':
        return { actor: actorName, action: `${t.notifications.left || 'left'} ${t.notifications.event || 'event'}`, eventName: event?.title || payload.eventTitle };
      case 'EVENT_POST_ADDED':
        return { actor: actorName, action: `${t.notifications.posted || 'posted'} ${t.notifications.post || 'post'} ${t.notifications.in || 'in'}`, eventName: event?.title || payload.eventTitle };
      case 'EVENT_JOIN_REQUEST':
        return { actor: actorName, action: `${t.notifications.requestedToJoin || 'requested to join'}`, eventName: event?.title || payload.eventTitle };
      case 'FRIEND_REQUEST':
        return { actor: actorName, action: t.notifications.wantsToBeFriend || 'wants to be friends' };
      case 'EVENT_ORGANIZER_TRANSFERRED':
        return {
          actor: actorName,
          // Роль переходит сразу, согласия не спрашивают — значит и текст
          // утвердительный, а не «предлагает стать».
          action: t.notifications.madeYouOrganizer || 'made you the organizer of',
          eventName: event?.title || payload.eventTitle,
        };
      case 'EVENT_INVITE':
        return {
          actor: actorName,
          action: t.notifications.invitedYou || 'invited you to',
          eventName: event?.title || payload.eventTitle,
        };
      case 'EVENT_REQUEST_ACCEPTED':
        return { actor: actorName, action: `${t.notifications.acceptedYourRequest || 'accepted your request to join'}`, eventName: event?.title || payload.eventTitle };
      case 'FRIEND_REQUEST_ACCEPTED':
        return { actor: actorName, action: t.notifications.acceptedFriendRequest };
      case 'EVENT_INVITE_DECLINED':
        return { actor: actorName, action: t.notifications.declinedInvitation, eventName: event?.title || payload.eventTitle };
      case 'EVENT_POST_LIKED':
        return { actor: actorName, action: t.notifications.likedYourPost, eventName: event?.title || payload.eventTitle };
      case 'EVENT_POST_COMMENTED':
        return {
          actor: actorName,
          action: t.notifications.commentedYourPost,
          eventName: event?.title || payload.eventTitle,
          detail: payload.commentPreview,
        };
      default:
        return { actor: '', action: t.notifications.newNotification || 'New notification' };
    }
  };

  const handlePress = () => {
    if (type === 'EVENT_CANCELLED') { onPress?.(); return; }
    if (type === 'FRIEND_REQUEST_ACCEPTED' && payload.actorId) {
      // Приняли заявку в друзья — в профиль этого человека.
      openUserProfile(payload.actorId, currentUserId);
    } else if ((type === 'EVENT_POST_LIKED' || type === 'EVENT_POST_COMMENTED') && payload.eventId && payload.postId) {
      // Лайк или комментарий — к самой публикации, а не к событию целиком.
      router.push(`/memory-post/${payload.eventId}/${payload.postId}`);
    } else if (payload.eventId) {
      router.push(`/event-profile/${payload.eventId}`);
    }
    onPress?.();
  };

  const handleAvatarPress = () => {
    if (payload.actorId) openUserProfile(payload.actorId, currentUserId);
  };

  const isCancelled = type === 'EVENT_CANCELLED';
  const notifText = getNotificationText();

  return (
    <TouchableOpacity
      style={[styles.container, isUnread && styles.containerUnread]}
      onPress={isCancelled ? undefined : handlePress}
      activeOpacity={isCancelled ? 1 : 0.72}
    >
      {/* Левый акцент-бар для непрочитанных */}
      {isUnread && <View style={styles.unreadBar} />}

      {/* Аватар с типовым бейджем */}
      <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} activeOpacity={0.7}>
        {actor?.avatar ? (
          <Image source={{ uri: sizedImage(actor.avatar, 44) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {actor?.name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        {/* Тип-бейдж */}
        <View style={[styles.typeBadge, { backgroundColor: typeConfig.color }]}>
          <Text style={styles.typeBadgeText}>{typeConfig.emoji}</Text>
        </View>
      </TouchableOpacity>

      {/* Текст */}
      <View style={styles.textContainer}>
        <Text style={styles.textMain} numberOfLines={2}>
          <Text style={styles.actorName}>{notifText.actor} </Text>
          <Text style={styles.actionText}>{notifText.action}</Text>
          {notifText.eventName ? (
            <Text style={styles.eventName}> «{notifText.eventName}»</Text>
          ) : null}
        </Text>
        {notifText.detail ? (
          <Text style={styles.detailText} numberOfLines={2}>{notifText.detail}</Text>
        ) : null}
        <Text style={styles.timeAgo}>{formatTimeAgo(notification.createdAt)}</Text>
      </View>

      {/* Превью события */}
      {eventMediaUrl && (
        <Image source={{ uri: sizedImage(eventMediaUrl, 56) }} style={styles.eventThumb} />
      )}

      {/* Принять / отклонить — для заявок, требующих ответа */}
      {onAccept && onDecline ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={onDecline}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.declineBtnText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={onAccept}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.acceptBtnText}>✓</Text>
          </TouchableOpacity>
        </View>
      ) : onDelete ? (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

export default React.memo(NotificationItem);

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  declineBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  declineBtnText: {
    color: 'rgba(244,244,245,0.7)',
    fontSize: 14,
    fontWeight: '700',
  },
  acceptBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
  },
  acceptBtnText: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '700',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: ScreenPadding,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: '#16161a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  containerUnread: {
    backgroundColor: 'rgba(255,141,50,0.07)',
    borderColor: 'rgba(255,141,50,0.2)',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 3,
    backgroundColor: '#FF8D32',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: '#3a3a3f',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#f4f4f5',
    fontSize: 17,
    fontWeight: '700',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#16161a',
  },
  typeBadgeText: {
    fontSize: 9,
    color: '#f4f4f5',
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  textMain: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 4,
  },
  actorName: {
    color: '#f4f4f5',
    fontWeight: '700',
  },
  actionText: {
    color: 'rgba(244,244,245,0.6)',
    fontWeight: '400',
  },
  eventName: {
    color: '#FF8D32',
    fontWeight: '600',
  },
  timeAgo: {
    fontSize: 11.5,
    color: 'rgba(244,244,245,0.35)',
    fontWeight: '500',
  },
  detailText: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(244,244,245,0.8)',
    marginBottom: 4,
  },
  eventThumb: {
    width: 46,
    height: 46,
    borderRadius: 14,
    marginLeft: 4,
    marginRight: 4,
    backgroundColor: '#1c1c20',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  deleteBtnText: {
    fontSize: 11,
    color: 'rgba(244,244,245,0.45)',
    fontWeight: '700',
  },
});
