import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AppIcon } from './ui/AppIcon';
import { sizedImage } from '../utils/imageSize';
import { interpolate } from '../utils/interpolate';
import { matchesSearchQuery } from '../utils/searchMatch';
import type { Event } from '../types/Event';

type Props = {
  visible: boolean;
  event: Event;
  onClose: () => void;
};

/**
 * Пригласить друзей в уже созданное событие — пункт в трёх точках карточки.
 *
 * Раньше звать людей можно было только в форме создания, а после публикации —
 * никак. В списке свои друзья за вычетом тех, кто уже участвует или ждёт
 * ответа, и тех, кого сервер всё равно не пустит: не подходит по полу или от
 * кого событие скрыто (те же правила, что в EventsService.inviteUser).
 */
export default function InviteFriendsModal({ visible, event, onClose }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getFriendsList, getEventParticipants, eventRequests, sendEventInvites, getUserData } = useEvents();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // Каждое открытие — с чистого листа.
  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelected([]);
    }
  }, [visible]);

  const visibility = (event as any)?.visibility as
    | { type?: string; excludedUsers?: string[] }
    | undefined;
  const hiddenFromFriends = visibility?.type === 'all_except_friends';

  const candidates = useMemo(() => {
    if (!visible || hiddenFromFriends) return [];

    const taken = new Set<string>(getEventParticipants(event.id));
    eventRequests.forEach(request => {
      if (request.eventId !== event.id || request.status !== 'pending') return;
      [request.toUserId, request.fromUserId, request.userId].forEach(id => {
        if (id) taken.add(id);
      });
    });
    const excluded =
      visibility?.type === 'all_except_excluded' ? visibility.excludedUsers ?? [] : [];
    const allowedGenders = Array.isArray(event.genderRestriction) ? event.genderRestriction : [];

    return getFriendsList().filter((friend: any) => {
      if (!friend?.id || friend.id === user?.id || friend.id === event.organizerId) return false;
      if (taken.has(friend.id) || excluded.includes(friend.id)) return false;
      // Пол, не указанный в профиле, не отсекаем — как и сервер.
      if (allowedGenders.length > 0 && friend.gender && !allowedGenders.includes(friend.gender)) {
        return false;
      }
      return true;
    });
  }, [visible, hiddenFromFriends, event, visibility, eventRequests, getEventParticipants, getFriendsList, user?.id]);

  const shown = useMemo(
    () => candidates.filter((friend: any) => matchesSearchQuery([friend.name, friend.username], query)),
    [candidates, query],
  );

  const toggle = (friendId: string) => {
    setSelected(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId],
    );
  };

  const handleInvite = async () => {
    if (selected.length === 0 || sending) return;
    setSending(true);
    try {
      const { failed } = await sendEventInvites(event.id, selected);
      onClose();
      if (failed.length > 0) {
        const names = failed
          .map(id => getUserData(id)?.name || getUserData(id)?.username || '')
          .filter(Boolean)
          .join(', ');
        Alert.alert(t.common.error, interpolate(t.events.invitationsFailed, { names }));
      } else {
        Alert.alert(t.common.done, t.events.invitationsSent);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {t.createEvent.inviteFriends}
            </Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="close" size={16} color="rgba(244,244,245,0.5)" />
            </TouchableOpacity>
          </View>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {event.title}
          </Text>

          {candidates.length > 0 && (
            <TextInput
              style={styles.search}
              placeholder={t.createEvent.searchFriends}
              placeholderTextColor="rgba(244,244,245,0.35)"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          )}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {candidates.length === 0 ? (
              <Text style={styles.empty}>
                {hiddenFromFriends ? t.events.inviteHiddenFromFriends : t.events.inviteNobody}
              </Text>
            ) : shown.length === 0 ? (
              <Text style={styles.empty}>{t.empty.nothingFound}</Text>
            ) : (
              shown.map((friend: any) => {
                const isSelected = selected.includes(friend.id);
                const label = friend.name || friend.username || '';
                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.row}
                    onPress={() => toggle(friend.id)}
                    activeOpacity={0.7}
                  >
                    {friend.avatar ? (
                      <Image source={{ uri: sizedImage(friend.avatar, 40) }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitial}>{label.charAt(0).toUpperCase() || '?'}</Text>
                      </View>
                    )}
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1}>
                        {label}
                      </Text>
                      {friend.username ? (
                        <Text style={styles.username} numberOfLines={1}>
                          @{friend.username}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.check, isSelected && styles.checkSelected]}>
                      {isSelected && <AppIcon name="check" size={14} color="#0A0A0A" />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.inviteBtn, (selected.length === 0 || sending) && styles.inviteBtnDisabled]}
            onPress={handleInvite}
            disabled={selected.length === 0 || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <Text style={styles.inviteBtnText}>
                {t.events.invite}
                {selected.length > 0 ? ` (${selected.length})` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#18181e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 32,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 2,
  },
  title: {
    flex: 1,
    marginRight: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#f4f4f5',
    letterSpacing: -0.2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventTitle: {
    paddingHorizontal: 22,
    paddingBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#FF8D32',
  },
  search: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    fontSize: 15,
    color: '#f4f4f5',
  },
  list: {
    flexGrow: 0,
    maxHeight: 360,
    paddingHorizontal: 14,
  },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(244,244,245,0.5)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#3a3a3f',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#f4f4f5',
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    marginTop: 2,
    color: 'rgba(244,244,245,0.45)',
    fontSize: 12.5,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(244,244,245,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkSelected: {
    backgroundColor: '#FF8D32',
    borderColor: '#FF8D32',
  },
  inviteBtn: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#FF8D32',
  },
  inviteBtnDisabled: {
    opacity: 0.4,
  },
  inviteBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0A0A0A',
  },
});
