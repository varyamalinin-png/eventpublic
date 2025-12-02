import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdminComplaintsScreen');

type ComplaintStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'REJECTED';
type ComplaintType = 'EVENT' | 'USER';

interface Complaint {
  id: string;
  type: ComplaintType;
  reason: string;
  description?: string;
  status: ComplaintStatus;
  createdAt: string;
  reporter?: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
  };
  reportedEvent?: {
    id: string;
    title: string;
    organizerId: string;
  };
  reportedUser?: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
  };
  adminResponse?: string;
  reviewedAt?: string;
}

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  PENDING: '#FFA500',
  REVIEWED: '#007AFF',
  RESOLVED: '#34C759',
  REJECTED: '#FF3B30',
};

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  PENDING: 'Ожидает',
  REVIEWED: 'Рассмотрено',
  RESOLVED: 'Решено',
  REJECTED: 'Отклонено',
};

const STATUS_OPTIONS: ComplaintStatus[] = ['PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED'];

export default function AdminComplaintsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus | 'ALL'>('ALL');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');

  useEffect(() => {
    fetchComplaints();
  }, []);

  useEffect(() => {
    if (selectedStatus === 'ALL') {
      setFilteredComplaints(complaints);
    } else {
      setFilteredComplaints(complaints.filter(c => c.status === selectedStatus));
    }
  }, [complaints, selectedStatus]);

  const fetchComplaints = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const data = await apiRequest('/complaints/admin/all', {}, accessToken);
      setComplaints(data);
      setFilteredComplaints(data);
    } catch (error: any) {
      logger.error('Failed to fetch complaints:', error);
      if (error.status === 403) {
        Alert.alert('Доступ запрещен', 'У вас нет прав администратора');
        router.back();
      } else {
        Alert.alert('Ошибка', 'Не удалось загрузить жалобы');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateComplaintStatus = async (complaintId: string, status: ComplaintStatus) => {
    if (!accessToken) return;
    
    try {
      const body: any = { status };
      if (adminResponse.trim()) {
        body.adminResponse = adminResponse.trim();
      }
      
      await apiRequest(
        `/complaints/admin/${complaintId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
        accessToken,
      );
      
      setShowStatusModal(false);
      setAdminResponse('');
      setSelectedComplaint(null);
      await fetchComplaints();
      Alert.alert('Успешно', 'Статус жалобы обновлен');
    } catch (error: any) {
      logger.error('Failed to update complaint status:', error);
      Alert.alert('Ошибка', 'Не удалось обновить статус жалобы');
    }
  };

  const handleStatusChange = async (status: ComplaintStatus) => {
    if (selectedComplaint) {
      await updateComplaintStatus(selectedComplaint.id, status);
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
        <Text style={styles.title}>Админ: Жалобы</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Фильтры по статусу */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity
          style={[styles.filterButton, selectedStatus === 'ALL' && styles.filterButtonActive]}
          onPress={() => setSelectedStatus('ALL')}
        >
          <Text style={[styles.filterText, selectedStatus === 'ALL' && styles.filterTextActive]}>
            Все ({complaints.length})
          </Text>
        </TouchableOpacity>
        {STATUS_OPTIONS.map((status) => {
          const count = complaints.filter(c => c.status === status).length;
          return (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, selectedStatus === status && styles.filterButtonActive]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text style={[styles.filterText, selectedStatus === status && styles.filterTextActive]}>
                {STATUS_LABELS[status]} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchComplaints();
          }} />
        }
      >
        {loading && filteredComplaints.length === 0 ? (
          <Text style={styles.emptyText}>Загрузка...</Text>
        ) : filteredComplaints.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Жалоб не найдено</Text>
          </View>
        ) : (
          filteredComplaints.map((complaint) => (
            <TouchableOpacity
              key={complaint.id}
              style={styles.complaintCard}
              onPress={() => {
                setSelectedComplaint(complaint);
                setShowStatusModal(true);
              }}
            >
              <View style={styles.complaintHeader}>
                <View style={styles.complaintType}>
                  <Text style={styles.complaintTypeText}>
                    {complaint.type === 'EVENT' ? '📅 Событие' : '👤 Пользователь'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[complaint.status] }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[complaint.status]}</Text>
                </View>
              </View>
              
              <Text style={styles.reasonText}>{complaint.reason}</Text>
              
              {complaint.description && (
                <Text style={styles.descriptionText}>{complaint.description}</Text>
              )}

              {complaint.reporter && (
                <View style={styles.reportedItem}>
                  <Text style={styles.reportedLabel}>Жалобу подал:</Text>
                  <Text style={styles.reportedValue}>
                    {complaint.reporter.name || complaint.reporter.username}
                  </Text>
                </View>
              )}

              {complaint.reportedEvent && (
                <View style={styles.reportedItem}>
                  <Text style={styles.reportedLabel}>Событие:</Text>
                  <Text style={styles.reportedValue}>{complaint.reportedEvent.title}</Text>
                </View>
              )}

              {complaint.reportedUser && (
                <View style={styles.reportedItem}>
                  <Text style={styles.reportedLabel}>Пользователь:</Text>
                  <Text style={styles.reportedValue}>
                    {complaint.reportedUser.name || complaint.reportedUser.username}
                  </Text>
                </View>
              )}

              {complaint.adminResponse && (
                <View style={styles.responseSection}>
                  <Text style={styles.responseLabel}>Ответ поддержки:</Text>
                  <Text style={styles.responseText}>{complaint.adminResponse}</Text>
                </View>
              )}

              <View style={styles.complaintFooter}>
                <Text style={styles.dateText}>{formatDate(complaint.createdAt)}</Text>
                {complaint.reviewedAt && (
                  <Text style={styles.dateText}>
                    Рассмотрено: {formatDate(complaint.reviewedAt)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Модальное окно для изменения статуса */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowStatusModal(false);
          setAdminResponse('');
          setSelectedComplaint(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Изменить статус жалобы</Text>
            
            {selectedComplaint && (
              <>
                <Text style={styles.modalSubtitle}>Текущий статус: {STATUS_LABELS[selectedComplaint.status]}</Text>
                
                <Text style={styles.modalLabel}>Новый статус:</Text>
                <View style={styles.statusButtonsContainer}>
                  {STATUS_OPTIONS.filter(status => status !== selectedComplaint.status).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        { backgroundColor: STATUS_COLORS[status] },
                      ]}
                      onPress={() => handleStatusChange(status)}
                    >
                      <Text style={styles.statusButtonText}>{STATUS_LABELS[status]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Ответ администратора (необязательно):</Text>
                <TextInput
                  style={styles.responseInput}
                  multiline
                  numberOfLines={4}
                  placeholder="Введите ответ пользователю..."
                  placeholderTextColor="#666"
                  value={adminResponse}
                  onChangeText={setAdminResponse}
                  textAlignVertical="top"
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowStatusModal(false);
                  setAdminResponse('');
                  setSelectedComplaint(null);
                }}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
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
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 60,
  },
  filtersContainer: {
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filtersContent: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  list: {
    flex: 1,
  },
  complaintCard: {
    backgroundColor: '#1A1A1A',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  complaintType: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  complaintTypeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  reasonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  descriptionText: {
    color: '#999',
    fontSize: 14,
    marginBottom: 10,
  },
  reportedItem: {
    marginBottom: 8,
  },
  reportedLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  reportedValue: {
    color: '#FFF',
    fontSize: 14,
  },
  responseSection: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  responseLabel: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  responseText: {
    color: '#FFF',
    fontSize: 14,
  },
  complaintFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  dateText: {
    color: '#666',
    fontSize: 12,
    marginBottom: 2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalSubtitle: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
  },
  modalLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 15,
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  statusButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
  },
  statusButtonDisabled: {
    opacity: 0.5,
  },
  statusButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  responseInput: {
    backgroundColor: '#2A2A2A',
    color: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: '#2A2A2A',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

