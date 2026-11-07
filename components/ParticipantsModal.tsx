import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatUsername } from '../utils/username';
import { AppIcon } from './ui/AppIcon';
import { Palette, Radius } from '../constants/DesignSystem';
import { openUserProfile } from '../utils/openUserProfile';
import { sizedImage } from '../utils/imageSize';

type ParticipantsModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Событие, из которого берутся участники. Не нужен, если передан
   *  participantIds или sections. */
  eventId?: string;
  /**
   * Явный список участников — для случаев, где события нет: например папка,
   * у которой участники это объединение по всем её событиям. Раньше модалка
   * умела только eventId, поэтому в папке аватарки были некликабельны.
   */
  participantIds?: string[];
  /**
   * Несколько подписанных разделов вместо одного списка. Нужно в чате
   * события: в шапке показано число участников ЧАТА, а модалка показывала
   * участников СОБЫТИЯ — числа не сходились и было непонятно, что к чему.
   */
  sections?: Array<{ title: string; ids: string[] }>;
};

export default function ParticipantsModal({
  visible,
  onClose,
  eventId,
  participantIds: explicitIds,
  sections,
}: ParticipantsModalProps) {
  const { t } = useLanguage();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const { getEventParticipants, getUserData, events, isUserOrganizer, eventProfiles } = useEvents();

  const participantIds = explicitIds ?? (eventId ? getEventParticipants(eventId) : []);
  /**
   * Те, кто вышел из события.
   *
   * Сервер кладёт их в профиль ТОЛЬКО для своих — участников события и
   * организатора (EventProfilesService.getProfile). Поэтому здесь ничего
   * дополнительно не проверяем: пустой список означает «этому зрителю не
   * положено», и раздел просто не рисуется.
   */
  const formerIds = (() => {
    if (explicitIds || sections || !eventId) return [];
    const profile = eventProfiles.find(p => p.eventId === eventId);
    const left = profile?.formerParticipants ?? [];
    // На всякий случай: тот, кто вернулся, не должен оказаться в обоих списках.
    return left.filter(id => !participantIds.includes(id));
  })();
  const event = eventId ? events.find(e => e.id === eventId) : undefined;
  const totalCount = sections
    ? sections.reduce((sum, section) => sum + section.ids.length, 0)
    : participantIds.length;

  const handleParticipantPress = (userId: string) => {
    onClose();
    openUserProfile(userId, currentUserId);
  };

  const getUserRole = (userId: string): string => {
    if (event && isUserOrganizer(event, userId)) {
      return t.profile.organizer;
    }
    return t.profile.participant;
  };

  const isOrganizer = (userId: string): boolean => {
    return !!(event && isUserOrganizer(event, userId));
  };

  const renderEmpty = (key?: string) => (
    <View key={key} style={styles.empty}>
      <Text style={styles.emptyText}>{t.participantsModal.noParticipants}</Text>
    </View>
  );

  const renderRow = (participantId: string, index: number, total: number, hasLeft = false) => {
    const userData = getUserData(participantId);
    const role = hasLeft ? t.participantsModal.leftEvent : getUserRole(participantId);
    const organizer = !hasLeft && isOrganizer(participantId);
    const isLast = index === total - 1;

    return (
      <TouchableOpacity
        key={participantId}
        style={[styles.row, !isLast && styles.rowBorder, hasLeft && styles.rowLeft]}
        onPress={() => handleParticipantPress(participantId)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: sizedImage(userData.avatar, 44) }} style={styles.avatar} />
          {organizer && <View style={styles.organizerDot} />}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{userData.name}</Text>
          <Text style={styles.username} numberOfLines={1}>{formatUsername(userData.username)}</Text>
        </View>
        <View style={[styles.roleBadge, organizer && styles.roleBadgeOrganizer]}>
          <Text style={[styles.roleText, organizer && styles.roleTextOrganizer]}>{role}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.participantsModal.title}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{totalCount}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="close" size={16} color={Palette.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} bounces={false}>
            {sections
              ? sections.map(section => (
                  <View key={section.title}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    {section.ids.length > 0
                      ? section.ids.map((id, i) => renderRow(id, i, section.ids.length))
                      : renderEmpty(`${section.title}-empty`)}
                  </View>
                ))
              : participantIds.length > 0
                ? participantIds.map((id, i) => renderRow(id, i, participantIds.length))
                : renderEmpty()}

            {formerIds.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>{t.participantsModal.leftSection}</Text>
                {formerIds.map((id, i) => renderRow(id, i, formerIds.length, true))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Вышедшие из события — тем же списком, но приглушённо.
  rowLeft: {
    opacity: 0.55,
  },
  sectionTitle: {
    color: 'rgba(244,244,245,0.45)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
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
    maxHeight: '75%',
    paddingBottom: 32,
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
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.text,
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,141,50,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,141,50,0.25)',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.accent,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 13,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Palette.surfaceElevated,
  },
  organizerDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: Palette.accent,
    borderWidth: 2,
    borderColor: '#18181e',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Palette.text,
    letterSpacing: -0.1,
  },
  username: {
    fontSize: 13,
    color: Palette.textDim,
  },
  roleBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  roleBadgeOrganizer: {
    backgroundColor: 'rgba(255,141,50,0.12)',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.textDim,
  },
  roleTextOrganizer: {
    color: Palette.accent,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Palette.textFaint,
    textAlign: 'center',
  },
});
