import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppIcon } from '../../components/ui/AppIcon';
import { Palette } from '../../constants/DesignSystem';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SupportComplaintsScreen');

type ComplaintStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'REJECTED';
type ComplaintType = 'EVENT' | 'USER';

interface Complaint {
  id: string;
  type: ComplaintType;
  reason: string;
  description?: string;
  status: ComplaintStatus;
  createdAt: string;
  reporter: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
  };
  reportedUser?: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
  };
  reportedEvent?: {
    id: string;
    title: string;
  };
  adminResponse?: string;
}

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  PENDING: '#FFA500',
  REVIEWED: '#FF8D32',
  RESOLVED: '#34C759',
  REJECTED: '#FF3B30',
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  PENDING: 'Ожидает',
  REVIEWED: 'Рассмотрено',
  RESOLVED: 'Решено',
  REJECTED: 'Отклонено',
};

export default function SupportComplaintsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [filterStatus, setFilterStatus] = useState<ComplaintStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, [filterStatus]);

  const fetchComplaints = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const url = filterStatus === 'ALL' 
        ? '/complaints/admin/all'
        : `/complaints/admin/all?status=${filterStatus}`;
      const data = await apiRequest(url, {}, accessToken);
      setComplaints(data);
    } catch (error) {
      logger.error('Failed to fetch complaints:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить жалобы');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleComplaintPress = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setResponseText(complaint.adminResponse || '');
    setShowDetailModal(true);
  };

  const handleSendResponse = async () => {
    if (!selectedComplaint || !accessToken) return;

    if (!responseText.trim()) {
      Alert.alert('Ошибка', 'Введите ответ');
      return;
    }

    try {
      await apiRequest(
        `/complaints/admin/${selectedComplaint.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: selectedComplaint.status === 'PENDING' ? 'REVIEWED' : selectedComplaint.status,
            adminResponse: responseText.trim(),
          }),
        },
        accessToken,
      );

      Alert.alert('Успешно', 'Ответ отправлен');
      setShowResponseModal(false);
      setShowDetailModal(false);
      fetchComplaints();
    } catch (error) {
      logger.error('Failed to send response:', error);
      Alert.alert('Ошибка', 'Не удалось отправить ответ');
    }
  };

  const handleResolve = async (status: ComplaintStatus) => {
    if (!selectedComplaint || !accessToken) return;

    try {
      await apiRequest(
        `/complaints/admin/${selectedComplaint.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            adminResponse: responseText.trim() || selectedComplaint.adminResponse || undefined,
          }),
        },
        accessToken,
      );

      Alert.alert('Успешно', `Жалоба ${status === 'RESOLVED' ? 'решена' : 'отклонена'}`);
      setShowDetailModal(false);
      fetchComplaints();
    } catch (error) {
      logger.error('Failed to update status:', error);
      Alert.alert('Ошибка', 'Не удалось обновить статус');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Кабинет поддержки</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Фильтры */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity
          style={[styles.filterButton, filterStatus === 'ALL' && styles.filterButtonActive]}
          onPress={() => setFilterStatus('ALL')}
        >
          <Text style={[styles.filterText, filterStatus === 'ALL' && styles.filterTextActive]}>
            Все
          </Text>
        </TouchableOpacity>
        {(['PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED'] as ComplaintStatus[]).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
              {STATUS_LABELS[status]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Список жалоб */}
      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchComplaints();
          }} />
        }
      >
        {loading && complaints.length === 0 ? (
          <Text style={styles.emptyText}>Загрузка...</Text>
        ) : complaints.length === 0 ? (
          <Text style={styles.emptyText}>Жалоб не найдено</Text>
        ) : (
          complaints.map((complaint) => (
            <TouchableOpacity
              key={complaint.id}
              style={styles.complaintCard}
              onPress={() => handleComplaintPress(complaint)}
            >
              <View style={styles.complaintHeader}>
                <View style={styles.complaintType}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AppIcon name={complaint.type === 'EVENT' ? 'calendar' : 'user'} size={13} color={Palette.textDim} />
                    <Text style={styles.complaintTypeText}>
                      {complaint.type === 'EVENT' ? 'Событие' : 'Пользователь'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[complaint.status] }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[complaint.status]}</Text>
                </View>
              </View>
              
              <Text style={styles.reasonText}>{complaint.reason}</Text>
              
              {complaint.description && (
                <Text style={styles.descriptionText} numberOfLines={2}>
                  {complaint.description}
                </Text>
              )}

              <View style={styles.complaintFooter}>
                <Text style={styles.reporterText}>
                  От: {complaint.reporter.name || complaint.reporter.username}
                </Text>
                <Text style={styles.dateText}>{formatDate(complaint.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Модальное окно деталей жалобы */}
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Детали жалобы</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {selectedComplaint && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Тип</Text>
                    <Text style={styles.detailValue}>
                      {selectedComplaint.type === 'EVENT' ? 'Событие' : 'Пользователь'}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Причина</Text>
                    <Text style={styles.detailValue}>{selectedComplaint.reason}</Text>
                  </View>

                  {selectedComplaint.description && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Описание</Text>
                      <Text style={styles.detailValue}>{selectedComplaint.description}</Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Жалобу подал</Text>
                    <Text style={styles.detailValue}>
                      {selectedComplaint.reporter.name || selectedComplaint.reporter.username}
                    </Text>
                  </View>

                  {selectedComplaint.reportedEvent && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Событие</Text>
                      <Text style={styles.detailValue}>{selectedComplaint.reportedEvent.title}</Text>
                    </View>
                  )}

                  {selectedComplaint.reportedUser && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Пользователь</Text>
                      <Text style={styles.detailValue}>
                        {selectedComplaint.reportedUser.name || selectedComplaint.reportedUser.username}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Статус</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selectedComplaint.status] }]}>
                      <Text style={styles.statusText}>{STATUS_LABELS[selectedComplaint.status]}</Text>
                    </View>
                  </View>

                  {selectedComplaint.adminResponse && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Ответ</Text>
                      <Text style={styles.detailValue}>{selectedComplaint.adminResponse}</Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Дата создания</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedComplaint.createdAt)}</Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={styles.cancelButtonText}>Закрыть</Text>
              </TouchableOpacity>
              {selectedComplaint?.status === 'PENDING' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.responseButton]}
                    onPress={() => setShowResponseModal(true)}
                  >
                    <Text style={styles.responseButtonText}>Ответить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.resolveButton]}
                    onPress={() => handleResolve('RESOLVED')}
                  >
                    <Text style={styles.resolveButtonText}>Решить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.rejectButton]}
                    onPress={() => handleResolve('REJECTED')}
                  >
                    <Text style={styles.rejectButtonText}>Отклонить</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно ответа */}
      <Modal
        visible={showResponseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowResponseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ответ на жалобу</Text>
              <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Ваш ответ</Text>
                <TextInput
                  style={styles.responseInput}
                  placeholder="Введите ответ пользователю..."
                  placeholderTextColor="#999"
                  value={responseText}
                  onChangeText={setResponseText}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowResponseModal(false)}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.sendButton]}
                onPress={handleSendResponse}
              >
                <Text style={styles.sendButtonText}>Отправить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#141417',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backButton: {
    color: '#FF8D32',
    fontSize: 16,
  },
  title: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 60,
  },
  filtersContainer: {
    maxHeight: 60,
    backgroundColor: '#141417',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  filtersContent: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1c1c20',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#FF8D32',
  },
  filterText: {
    color: '#DDD',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#f4f4f5',
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  complaintCard: {
    backgroundColor: '#141417',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  complaintType: {
    backgroundColor: '#1c1c20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  complaintTypeText: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: '600',
  },
  reasonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  descriptionText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    marginBottom: 10,
  },
  complaintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  reporterText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 12,
  },
  dateText: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 12,
  },
  emptyText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#141417',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#f4f4f5',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalScroll: {
    maxHeight: 400,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    marginBottom: 5,
  },
  detailValue: {
    color: '#f4f4f5',
    fontSize: 16,
  },
  responseInput: {
    backgroundColor: '#1c1c20',
    color: '#f4f4f5',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 100,
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 8,
    flexWrap: 'wrap',
  },
  modalButton: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  cancelButton: {
    backgroundColor: '#1c1c20',
  },
  cancelButtonText: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  responseButton: {
    backgroundColor: '#FF8D32',
  },
  responseButtonText: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  resolveButton: {
    backgroundColor: '#34C759',
  },
  resolveButtonText: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  rejectButtonText: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#FF8D32',
    flex: 1,
  },
  sendButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
});

