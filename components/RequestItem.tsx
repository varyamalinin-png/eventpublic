import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { openUserProfile } from '../utils/openUserProfile';
import { useLanguage } from '../context/LanguageContext';
import { formatTimeAgo } from '../utils/timeAgo';
import { AppIcon } from './ui/AppIcon';
import { ScreenPadding } from '../constants/DesignSystem';
import { sizedImage } from '../utils/imageSize';

interface RequestItemProps {
  id: string;
  type: 'event' | 'friend' | 'organizer_transfer';
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
    else if (userId) openUserProfile(userId, currentUserId);
  };

  const handleAvatarPress = () => {
    const targetId = isOutgoing ? currentUserId : userId;
    if (targetId) openUserProfile(targetId, currentUserId);
  };

  /** Переход к тому, кого пригласили: имя в строке кликабельно. */
  const handleTargetPress = () => {
    if (userId) openUserProfile(userId, currentUserId);
  };

  const getRequestText = () => {
    // Для ИСХОДЯЩИХ имя не подставляем: тексты уже начинаются с «You sent…» /
    // «отправили…», и имя давало «Varvara You sent a friend request to».
    const name = isOutgoing
      ? ''
      : (user?.name?.split(' ')[0] || t.requestItem?.user || 'User');

    if (isOutgoing) {
      if (type === 'friend') return { actor: name, action: t.requestItem?.sentFriendRequest || 'sent friend request' };
      if (isInvite) return { actor: name, action: t.requestItem?.sentInvite || 'sent invite' };
      return { actor: name, action: t.requestItem?.sentJoinRequest || 'requested to join' };
    }
    if (type === 'organizer_transfer') {
      return { actor: name, action: t.requestItem?.offersOrganizerRole || 'offers you to become the organizer of' };
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

      {/* У исходящих аватарки нет: она всегда своя собственная и ничего не
          сообщает, а строка и без неё начинается с «Вы…». Освободившееся место
          уходит тексту — иначе имя приглашённого не помещалось. */}
      {!isOutgoing && (
        <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} activeOpacity={0.7}>
          {displayUser?.avatar ? (
            <Image source={{ uri: sizedImage(displayUser.avatar, 44) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{displayUser?.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.color }]}>
            <Text style={styles.typeBadgeText}>{typeConfig.emoji}</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={[styles.textContainer, isOutgoing && styles.textContainerNoAvatar]}>
        {/* «Вы пригласили <имя> на <обложка события>»: событие обозначает
            картинка справа, поэтому название в строку не выводим — иначе
            получалось длинно и без главного, без имени приглашённого. Если
            обложки у события нет, название всё-таки показываем: иначе после
            «на» не осталось бы ничего. */}
        {isOutgoing && isInvite ? (
          <Text style={styles.textMain} numberOfLines={2}>
            <Text style={styles.actionText}>{t.requestItem?.sentInvite || 'You invited'} </Text>
            {/* Вложенный Text со своим onPress перехватывает касание у строки
                целиком — тап по имени ведёт в профиль, тап мимо по-прежнему
                открывает событие. */}
            <Text
              style={[styles.actorName, styles.actorNameLink]}
              onPress={handleTargetPress}
              suppressHighlighting={false}
            >
              {targetUser?.name?.split(' ')[0] || t.requestItem?.user || 'User'}
            </Text>
            <Text style={styles.actionText}> {t.requestItem?.toEvent || 'to'}</Text>
            {!eventMediaUrl && event?.title ? (
              <Text style={styles.eventName}> «{event.title}»</Text>
            ) : null}
          </Text>
        ) : (
          <Text style={styles.textMain} numberOfLines={2}>
            {reqText.actor ? <Text style={styles.actorName}>{reqText.actor} </Text> : null}
            <Text style={styles.actionText}>{reqText.action}</Text>
            {event?.title ? <Text style={styles.eventName}> «{event.title}»</Text> : null}
            {type === 'friend' && isOutgoing && targetUser?.name ? (
              <Text style={styles.eventName}> {targetUser.name.split(' ')[0]}</Text>
            ) : null}
          </Text>
        )}
        {createdAt && <Text style={styles.timeAgo}>{formatTimeAgo(createdAt)}</Text>}
      </View>

      {eventMediaUrl && (
        <Image source={{ uri: sizedImage(eventMediaUrl, 56) }} style={styles.eventThumb} />
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
          {/* Иконки из общего набора вместо текстовых эмодзи «⏱»/«✓»:
              эмодзи рисуется системным шрифтом и выбивался из остального
              интерфейса, где везде используется AppIcon. */}
          <AppIcon name={status === 'accepted' ? 'check' : 'clock'} size={12} color="#f4f4f5" />
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
  // Без аватарки слева тексту нужен собственный отступ от края карточки.
  textContainerNoAvatar: {
    marginLeft: 4,
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
  // Имя-ссылка: подчёркиванием, а не цветом — цвет здесь уже несёт смысл
  // (белым выделены имена, приглушённым — служебный текст).
  actorNameLink: {
    textDecorationLine: 'underline',
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
