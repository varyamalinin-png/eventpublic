import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { createLogger } from '../utils/logger';

const logger = createLogger('ComplaintForm');

type ComplaintType = 'EVENT' | 'USER';

interface ComplaintFormProps {
  visible: boolean;
  onClose: () => void;
  type: ComplaintType;
  reportedEventId?: string;
  reportedUserId?: string;
  onSuccess?: () => void;
}

const COMPLAINT_REASONS = {
  EVENT: [
    'Некорректное содержание',
    'Спам',
    'Мошенничество',
    'Нарушение правил',
    'Другое',
  ],
  USER: [
    'Оскорбления',
    'Спам',
    'Мошенничество',
    'Некорректное поведение',
    'Другое',
  ],
};

export default function ComplaintForm({
  visible,
  onClose,
  type,
  reportedEventId,
  reportedUserId,
  onSuccess,
}: ComplaintFormProps) {
  const { accessToken } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = COMPLAINT_REASONS[type];

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Ошибка', 'Пожалуйста, выберите причину жалобы');
      return;
    }

    if (!accessToken) {
      Alert.alert('Ошибка', 'Необходимо войти в аккаунт для отправки жалобы');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/complaints', {
        method: 'POST',
        body: JSON.stringify({
          type,
          reason: selectedReason,
          description: description.trim() || undefined,
          reportedEventId,
          reportedUserId,
        }),
      }, accessToken);

      Alert.alert('Успешно', 'Жалоба отправлена. Мы рассмотрим её в ближайшее время.');
      setSelectedReason('');
      setDescription('');
      onSuccess?.();
      onClose();
    } catch (error) {
      logger.error('Failed to submit complaint:', error);
      Alert.alert('Ошибка', 'Не удалось отправить жалобу. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Пожаловаться</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.label}>Причина жалобы</Text>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonButton,
                  selectedReason === reason && styles.reasonButtonSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
              >
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Дополнительная информация (необязательно)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Опишите проблему подробнее..."
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelButton, isSubmitting && styles.buttonDisabled]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || isSubmitting) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Отправка...' : 'Отправить'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#999',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    maxHeight: 400,
  },
  label: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  reasonButton: {
    backgroundColor: '#2A2A2A',
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#2A3A4A',
  },
  reasonText: {
    color: '#DDD',
    fontSize: 16,
  },
  reasonTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#2A2A2A',
    color: '#FFF',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 100,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

