import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';

export interface EventAction {
  id: string;
  label: string;
  isClickable?: boolean;
}

interface EventCardActionsProps {
  visible: boolean;
  actions: EventAction[];
  onClose: () => void;
  onActionPress: (actionId: string) => void;
}

export default function EventCardActions({ 
  visible, 
  actions, 
  onClose, 
  onActionPress 
}: EventCardActionsProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <ScrollView style={styles.actionsList}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionItem,
                  !action.isClickable && styles.actionItemDisabled
                ]}
                onPress={() => {
                  if (action.isClickable) {
                    onActionPress(action.id);
                  }
                }}
                disabled={!action.isClickable}
              >
                <Text style={[
                  styles.actionText,
                  !action.isClickable && styles.actionTextDisabled
                ]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    width: '80%',
    maxHeight: '70%',
    padding: 20,
  },
  actionsList: {
    maxHeight: 400,
  },
  actionItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  actionItemDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: '#FFF',
    fontSize: 16,
  },
  actionTextDisabled: {
    color: '#666',
  },
});

