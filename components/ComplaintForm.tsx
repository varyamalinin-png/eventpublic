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
import { AppIcon } from './ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
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
  const title = type === 'EVENT' ? 'Жалоба на событие' : 'Жалоба на пользователя';

  const handleClose = () => {
    setSelectedReason('');
    setDescription('');
    onClose();
  };

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

      Alert.alert('Жалоба отправлена', 'Мы рассмотрим её в ближайшее время.');
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
      onRequestClose={handleClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={s.closeBtn}>
                <AppIcon name="close" size={16} color="rgba(244,244,245,0.5)" />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.scroll} bounces={false} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>Причина жалобы</Text>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[s.reasonRow, selectedReason === reason && s.reasonRowSelected]}
                onPress={() => setSelectedReason(reason)}
                activeOpacity={0.7}
              >
                <View style={[s.radio, selectedReason === reason && s.radioSelected]}>
                  {selectedReason === reason && <View style={s.radioDot} />}
                </View>
                <Text style={[s.reasonText, selectedReason === reason && s.reasonTextSelected]}>
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={s.sectionLabel}>Дополнительно (необязательно)</Text>
            <TextInput
              style={s.textInput}
              placeholder="Опишите проблему подробнее..."
              placeholderTextColor="rgba(244,244,245,0.28)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={handleClose} disabled={isSubmitting} activeOpacity={0.7}>
              <Text style={s.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, (!selectedReason || isSubmitting) && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={s.submitBtnText}>{isSubmitting ? 'Отправка...' : 'Отправить'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    maxHeight: '85%',
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.text,
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
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonRowSelected: {
    backgroundColor: 'rgba(255,141,50,0.08)',
    borderColor: 'rgba(255,141,50,0.3)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: Palette.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.accent,
  },
  reasonText: {
    fontSize: 15,
    color: Palette.textDim,
    flex: 1,
  },
  reasonTextSelected: {
    color: Palette.text,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: Palette.text,
    padding: 14,
    borderRadius: 14,
    fontSize: 15,
    minHeight: 90,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  cancelBtnText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: 'rgba(244,244,245,0.7)',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FF453A',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#fff',
  },
});
