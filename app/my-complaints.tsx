import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AppIcon } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
import { createLogger } from '../utils/logger';

const logger = createLogger('MyComplaints');

type ComplaintStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'REJECTED';
type ComplaintType = 'EVENT' | 'USER';

interface Complaint {
  id: string;
  type: ComplaintType;
  reason: string;
  description?: string;
  status: ComplaintStatus;
  createdAt: string;
  reportedEvent?: {
    id: string;
    title: string;
  };
  reportedUser?: {
    id: string;
    name: string;
    username: string;
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
  PENDING: 'Ожидает рассмотрения',
  REVIEWED: 'Рассмотрено',
  RESOLVED: 'Решено',
  REJECTED: 'Отклонено',
};

export default function MyComplaintsScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { t } = useLanguage();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const data = await apiRequest('/complaints', {}, accessToken);
      setComplaints(data);
    } catch (error) {
      logger.error('Failed to fetch complaints:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <AppIcon name="chevronLeft" size={24} color={Palette.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Мои жалобы</Text>
        <View style={styles.placeholder} />
      </View>

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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t.empty.noComplaints}</Text>
            <Text style={styles.emptySubtext}>
              Вы можете пожаловаться на событие или пользователя через меню действий
            </Text>
          </View>
        ) : (
          complaints.map((complaint) => (
            <View key={complaint.id} style={styles.complaintCard}>
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
                <Text style={styles.descriptionText}>{complaint.description}</Text>
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
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  reportedItem: {
    marginBottom: 8,
  },
  reportedLabel: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 12,
    marginBottom: 2,
  },
  reportedValue: {
    color: '#f4f4f5',
    fontSize: 14,
  },
  responseSection: {
    backgroundColor: '#1c1c20',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  responseLabel: {
    color: '#FF8D32',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  responseText: {
    color: '#f4f4f5',
    fontSize: 14,
  },
  complaintFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  dateText: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 14,
    textAlign: 'center',
  },
});

