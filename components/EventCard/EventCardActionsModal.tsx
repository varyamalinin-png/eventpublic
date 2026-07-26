import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import type { EventAction } from '../../hooks/events/useEventCardActions';
import { AppIcon } from '../ui/AppIcon';

interface EventCardActionsModalProps {
  visible: boolean;
  actions: EventAction[];
  onClose: () => void;
  onActionPress: (actionId: string) => void;
}

// Icon mapping for action types
const ACTION_ICONS: Record<string, string> = {
  share: 'share',
  save: 'bookmark',
  change_parameters: 'edit',
  change_visibility: 'eye',
  cancel_event: 'close',
  cancel_participation: 'close',
  cancel_invite: 'close',
  accept_invite: 'check',
  go_to_chat: 'message',
  schedule: 'calendar',
  report: 'flag',
  delete_event: 'delete',
  hide_parameters: 'eye-off',
  change_photo: 'image',
  toggle_tags: 'tag',
  add_to_folder: 'folder',
  remove_from_folder: 'folder',
  transfer_organizer_role: 'person',
  view_requests: 'people',
  remove_participant: 'person-remove',
  extend_recurring: 'repeat',
};

const DANGER_ACTIONS = new Set(['cancel_event', 'delete_event', 'cancel_participation', 'report', 'remove_participant']);
const PRIMARY_ACTIONS = new Set(['accept_invite', 'go_to_chat', 'share']);

export default function EventCardActionsModal({
  visible,
  actions,
  onClose,
  onActionPress,
}: EventCardActionsModalProps) {
  const { t } = useLanguage();

  const getActionColor = (action: EventAction) => {
    if (!action.isClickable) return 'rgba(244,244,245,0.28)';
    if (DANGER_ACTIONS.has(action.id)) return '#FF453A';
    if (PRIMARY_ACTIONS.has(action.id)) return '#FF8D32';
    return '#f4f4f5';
  };

  const getIconColor = (action: EventAction) => {
    if (!action.isClickable) return 'rgba(244,244,245,0.2)';
    if (DANGER_ACTIONS.has(action.id)) return 'rgba(255,69,58,0.7)';
    if (PRIMARY_ACTIONS.has(action.id)) return 'rgba(255,141,50,0.7)';
    return 'rgba(244,244,245,0.4)';
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
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.common.actions}</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="close" size={16} color="rgba(244,244,245,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <ScrollView
            style={styles.scroll}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {actions.map((action, index) => {
              const iconName = ACTION_ICONS[action.id] || 'more';
              const textColor = getActionColor(action);
              const iconColor = getIconColor(action);
              const isDanger = DANGER_ACTIONS.has(action.id);
              const isLast = index === actions.length - 1;

              return (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionRow,
                    !isLast && styles.actionRowBorder,
                    isDanger && action.isClickable && styles.actionRowDanger,
                  ]}
                  onPress={() => {
                    if (action.isClickable) onActionPress(action.id);
                  }}
                  activeOpacity={action.isClickable ? 0.65 : 1}
                  disabled={!action.isClickable}
                >
                  <View style={[styles.iconWrapper, { backgroundColor: isDanger && action.isClickable ? 'rgba(255,69,58,0.1)' : 'rgba(255,255,255,0.05)' }]}>
                    <AppIcon name={iconName as any} size={17} color={iconColor} />
                  </View>
                  <Text style={[styles.actionText, { color: textColor }]} numberOfLines={1}>
                    {action.label}
                  </Text>
                  {!action.isClickable && (
                    <View style={styles.lockedBadge}>
                      <AppIcon name="lock" size={11} color="rgba(244,244,245,0.25)" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Cancel pill */}
          <TouchableOpacity style={styles.cancelPill} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelPillText}>{t.common.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    maxHeight: '75%',
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
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
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    gap: 14,
  },
  actionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderRadius: 0,
    paddingHorizontal: 8,
  },
  actionRowDanger: {
    backgroundColor: 'rgba(255,69,58,0.04)',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionText: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  lockedBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelPill: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  cancelPillText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: 'rgba(244,244,245,0.7)',
    letterSpacing: -0.1,
  },
});
