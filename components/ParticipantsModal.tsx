import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import { formatUsername } from '../utils/username';

type ParticipantsModalProps = {
  visible: boolean;
  onClose: () => void;
  eventId: string;
};

export default function ParticipantsModal({ visible, onClose, eventId }: ParticipantsModalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { getEventParticipants, getUserData, events, isUserOrganizer } = useEvents();
  
  // Получаем список участников из контекста (универсальный способ)
  const participantIds = getEventParticipants(eventId);
  
  // Получаем событие для проверки ролей
  const event = events.find(e => e.id === eventId);

  const handleParticipantPress = (userId: string) => {
    onClose();
    router.push(`/profile/${userId}`);
  };
  
  // Определяем роль пользователя в событии
  const getUserRole = (userId: string): string => {
    if (event && isUserOrganizer(event, userId)) {
      return t.profile.organizer;
    }
    return t.profile.participant;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.participantsModal.title}</Text>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.participantsList}>
            {participantIds.length > 0 ? (
              participantIds.map((participantId, index) => {
                const userData = getUserData(participantId);
                const role = getUserRole(participantId);
                return (
                  <TouchableOpacity 
                    key={participantId}
                    style={styles.participantItem}
                    onPress={() => handleParticipantPress(participantId)}
                  >
                    <Image 
                      source={{ uri: userData.avatar }} 
                      style={styles.participantModalAvatar}
                    />
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantModalName}>{userData.name}</Text>
                      <Text style={styles.participantUsername}>{formatUsername(userData.username)}</Text>
                    </View>
                    <Text style={styles.participantRole}>{role}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyText}>{t.participantsModal.noParticipants}</Text>
            )}
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
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    width: '90%',
    maxHeight: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  participantsList: {
    maxHeight: 400,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
  },
  participantModalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantModalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  participantUsername: {
    fontSize: 14,
    color: '#999999',
  },
  participantRole: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
    marginLeft: 8,
  },
  emptyText: {
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },
});

