import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/timeAgo';
import { AppIcon } from './ui/AppIcon';

interface RequestItemProps {
  id: string;
  type: 'event' | 'friend';
  eventId?: string;
  userId?: string;
  isOutgoing?: boolean;
  status?: 'pending' | 'accepted' | 'rejected';
  isInvite?: boolean;
  isBusinessAccount?: boolean;
  createdAt?: Date | string;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onPress?: () => void;
}

function getRequestTypeConfig(type: string, isInvite: boolean, isOutgoing: boolean, status: string) {
  if (isOutgoing) {
    if (status === 'accepted') return { emoji: '✓', color: '#34C759' };
    return { emoji: '↗', color: '#FF9500' };
  }
  if (isInvite) return { emoji: '✉', color: '#AF52DE' };
  if (type === 'friend') return { emoji: '👤', color: '#5AC8FA' };
  return { emoji: '＋', color: '#FF8D32' };
}

function RequestItem({
  id, type, eventId, userId,
  isOutgoing = false, status = 'pending',
  isInvite = false, isBusinessAccount = false,
  createdAt, onAccept, onDecline, onPress,
}: RequestItemProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { events, getUserData, getEventPhotoForUser } = useEvents();
  const { user: authUser } = useAuth();

  const event = eventId ? events.find(e => e.id === eventId) : null;
  const user = userId ? getUserData(userId) : null;
  const currentUserId = authUser?.id ?? null;
  const currentUser = currentUserId ? getUserData(currentUserId) : null;

  const typeConfig = getRequestTypeConfig(type, isInvite, isOutgoing, status);
  const isPending = status === 'pending';

  const displayUser = isOutgoing ? currentUser : user;
  const targetUser = isOutgoing ? user : null;

  const handlePress = () => {
    if (onPress) { onPress(); return; }
    if (eventId) router.push(`/event-profile/${eventId}`);
    else if (userId) router.push(`/profile/${userId}`);
  };

  const handleAvatarPress = () => {
    const targetId = isOutgoing ? currentUserId : userId;
    if (targetId) router.push(`/profile/${targetId}`);
  };

  const getRequestText = () => {
    const name = isOutgoing
      ? (currentUser?.name?.split(' ')[0] || t.requestItem?.you || 'You')
      : (user?.name?.split(' ')[0] || t.requestItem?.user || 'User');

    if (isOutgoing) {
      if (type === 'friend') return { actor: name, action: t.requestItem?.sentFriendRequest || 'sent friend request' };
      if (isInvite) return { actor: name, action: t.requestItem?.sentInvite || 'sent invite' };
      return { actor: name, action: t.requestItem?.sentJoinRequest || 'requested to join' };
    }
    if (type === 'friend') return { actor: name, action: t.requestItem?.wantsToBeFriend || 'wants to be friends' };
    if (isInvite) return { actor: name, action: t.requestItem?.wantsToInviteYou || 'invites you to' };
    if (isBusinessAccount) return { actor: name, action: t.requestItem?.joinedEvent || 'joined' };
    return { actor: name, action: t.requestItem?.wantsToJoin || 'wants to join' };
  };

  const eventMediaUrl = event ? (getEventPhotoForUser(event.id, currentUserId || '') || event.mediaUrl) : undefined;
  const reqText = getRequestText();

  return (
    <TouchableOpacity
      style={[styles.container, isPending && !isOutgoing && styles.containerPending]}
      onPress={handlePress}
      activeOpacity={0.72}
    >
      {isPending && !isOutgoing && <View style={styles.pendingBar} />}

      <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} activeOpacity={0.7}>
        {displayUser?.avatar ? (
          <Image source={{ uri: displayUser.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{displayUser?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <View style={[styles.typeBadge, { backgroundColor: typeConfig.color }]}>
          <Text style={styles.typeBadgeText}>{typeConfig.emoji}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.textContainer}>
        <Text style={styles.textMain} numberOfLines={2}>
          <Text style={styles.actorName}>{reqText.actor} </Text>
          <Text style={styles.actionText}>{reqText.action}</Text>
          {event?.title ? <Text style={styles.eventName}> «{event.title}»</Text> : null}
          {type === 'friend' && isOutgoing && targetUser?.name ? (
            <Text style={styles.eventName}> {targetUser.name.split(' ')[0]}</Text>
          ) : null}
        </Text>
        {createdAt && <Text style={styles.timeAgo}>{formatTimeAgo(createdAt)}</Text>}
      </View>

      {eventMediaUrl && (
        <Image source={{ uri: eventMediaUrl }} style={styles.eventThumb} />
      )}

      {!isOutgoing && isPending && !isBusinessAccount && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.declineBtn} onPress={() => onDecline?.(id)}>
            <AppIcon name="close" size={13} color="rgba(244,244,245,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept?.(id)}>
            <AppIcon name="check" size={13} color="#f4f4f5" />
          </TouchableOpacity>
        </View>
      )}

      {isOutgoing && (
        <View style={[styles.statusDot, { backgroundColor: typeConfig.color }]}>
          <Text style={styles.statusDotText}>{status === 'accepted' ? '✓' : '⏱'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(RequestItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: '#16161a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  containerPending: {
    backgroundColor: 'rgba(255,141,50,0.07)',
    borderColor: 'rgba(255,141,50,0.2)',
  },
  pendingBar: {
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
    borderRadius: 24,
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
  eventThumb: {
    width: 46,
    height: 46,
    borderRadius: 14,
    marginLeft: 4,
    marginRight: 4,
    backgroundColor: '#1c1c20',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 4,
  },
  declineBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(255,59,48,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  statusDotText: {
    fontSize: 11,
    color: '#f4f4f5',
    fontWeight: '700',
  },
});
