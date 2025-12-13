import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import type { EventAction } from '../../hooks/events/useEventCardActions';

interface EventCardActionsModalProps {
  visible: boolean;
  actions: EventAction[];
  onClose: () => void;
  onActionPress: (actionId: string) => void;
}

export default function EventCardActionsModal({
  visible,
  actions,
  onClose,
  onActionPress,
}: EventCardActionsModalProps) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.actionsModalContainer}>
          <View style={styles.actionsModalHeader}>
            <Text style={styles.actionsModalTitle}>{t.common.actions}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.actionsModalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.actionsModalScroll} bounces={false}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionItem,
                  index === actions.length - 1 && styles.actionItemLast
                ]}
                onPress={() => onActionPress(action.id)}
                activeOpacity={action.isClickable ? 0.7 : 1}
                disabled={!action.isClickable}
              >
                <Text style={[
                  styles.actionItemText,
                  !action.isClickable && styles.actionItemTextDisabled
                ]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsModalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '88%',
    maxHeight: '60%',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  actionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionsModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsModalClose: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionsModalScroll: {
    maxHeight: '100%',
  },
  actionItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionItemText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  actionItemTextDisabled: {
    color: '#888',
    opacity: 0.6,
  },
});

