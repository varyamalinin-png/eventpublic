import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AppIcon } from '../../components/ui/AppIcon';
import { Palette } from '../../constants/DesignSystem';

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  isRead: boolean;
}

export default function AdminMailScreen() {
  const router = useRouter();
  const { accessToken: authToken } = useAuth();
  const accessToken = authToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth.accessToken') : null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    if (!accessToken) return;
    try {
      const url = filter ? `/admin/mail?mailbox=${filter}` : '/admin/mail';
      const data = await apiRequest(url, {}, accessToken);
      setEmails(Array.isArray(data) ? data : []);
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }, [accessToken, filter]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const markAsRead = async (email: Email) => {
    if (!accessToken || email.isRead) return;
    const mailbox = email.to.split('@')[0];
    try {
      await apiRequest(`/admin/mail/${mailbox}/${email.id}/read`, { method: 'POST' }, accessToken);
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
    } catch {}
  };

  const openEmail = (email: Email) => {
    setSelectedEmail(email);
    markAsRead(email);
  };

  const unreadCount = emails.filter(e => !e.isRead).length;
  const filters = [
    { key: null, label: 'Все' },
    { key: 'info', label: 'info@' },
    { key: 'privacy', label: 'privacy@' },
    { key: 'support', label: 'support@' },
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <AppIcon name="chevronLeft" size={24} color={Palette.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Обращения</Text>
        {unreadCount > 0 && (
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filters} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key || 'all'}
            style={[s.filterPill, filter === f.key && s.filterPillActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEmails(); }} tintColor={Palette.accent} />}
      >
        {emails.length === 0 ? (
          <View style={s.empty}>
            <AppIcon name="mail" size={48} color={Palette.textFaint} />
            <Text style={s.emptyText}>Нет обращений</Text>
          </View>
        ) : (
          emails.map(email => (
            <TouchableOpacity key={email.id} style={[s.emailRow, !email.isRead && s.emailUnread]} onPress={() => openEmail(email)} activeOpacity={0.7}>
              <View style={[s.dot, !email.isRead && s.dotUnread]} />
              <View style={s.emailContent}>
                <View style={s.emailTop}>
                  <Text style={[s.emailFrom, !email.isRead && s.emailFromBold]} numberOfLines={1}>{email.from}</Text>
                  <Text style={s.emailDate}>{new Date(email.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={[s.emailSubject, !email.isRead && s.emailSubjectBold]} numberOfLines={1}>{email.subject}</Text>
                <Text style={s.emailTo}>{email.to}</Text>
                <Text style={s.emailPreview} numberOfLines={1}>{email.body}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={!!selectedEmail} transparent animationType="slide" onRequestClose={() => setSelectedEmail(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={2}>{selectedEmail?.subject}</Text>
              <TouchableOpacity onPress={() => setSelectedEmail(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppIcon name="close" size={18} color={Palette.textDim} />
              </TouchableOpacity>
            </View>
            <View style={s.modalMeta}>
              <Text style={s.modalFrom}>От: {selectedEmail?.from}</Text>
              <Text style={s.modalTo}>Кому: {selectedEmail?.to}</Text>
              <Text style={s.modalDate}>{selectedEmail?.date ? new Date(selectedEmail.date).toLocaleString('ru-RU') : ''}</Text>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={s.modalBodyText}>{selectedEmail?.body}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Palette.text, flex: 1 },
  headerBadge: { backgroundColor: Palette.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  filters: { maxHeight: 44, marginBottom: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterPillActive: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  filterText: { fontSize: 13, fontWeight: '500', color: Palette.textDim },
  filterTextActive: { color: '#fff' },
  list: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: Palette.textFaint },
  emailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 10 },
  emailUnread: { backgroundColor: 'rgba(255,141,50,0.04)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'transparent', marginTop: 6 },
  dotUnread: { backgroundColor: Palette.accent },
  emailContent: { flex: 1, gap: 3 },
  emailTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emailFrom: { fontSize: 14, color: Palette.textDim, flex: 1 },
  emailFromBold: { color: Palette.text, fontWeight: '600' },
  emailDate: { fontSize: 11, color: Palette.textFaint },
  emailSubject: { fontSize: 15, color: Palette.text },
  emailSubjectBold: { fontWeight: '700' },
  emailTo: { fontSize: 11, color: Palette.accent, marginTop: 1 },
  emailPreview: { fontSize: 13, color: Palette.textFaint, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#18181e', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 32 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Palette.text, flex: 1 },
  modalMeta: { paddingHorizontal: 20, paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalFrom: { fontSize: 13, color: Palette.text },
  modalTo: { fontSize: 13, color: Palette.accent },
  modalDate: { fontSize: 12, color: Palette.textFaint },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },
  modalBodyText: { fontSize: 15, color: Palette.text, lineHeight: 22 },
});
