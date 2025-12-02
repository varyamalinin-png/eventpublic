import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import MessagesTab from './messages';
import RequestsTab from './requests';
import { useEvents } from '../../../context/EventsContext';
import { useLanguage } from '../../../context/LanguageContext';

export default function InboxScreen() {
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages');
  const activeTabRef = useRef<'messages' | 'requests'>('messages');
  const wasOnRequestsTabRef = useRef(false);
  const { unreadNotificationsCount, notifications, markAllNotificationsAsRead } = useEvents();
  const { t } = useLanguage();
  
  // Обновляем ref при изменении activeTab
  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'requests') {
      wasOnRequestsTabRef.current = true;
    }
  }, [activeTab]);
  
  // Отмечаем уведомления как прочитанные при выходе со страницы inbox
  useFocusEffect(
    useCallback(() => {
      // При входе на страницу ничего не делаем
      
      return () => {
        // При выходе со страницы inbox отмечаем все непрочитанные уведомления как прочитанные
        // если пользователь был на вкладке "Notifications"
        const currentTab = activeTabRef.current;
        if (currentTab === 'requests' || wasOnRequestsTabRef.current) {
          const unreadNotifications = notifications.filter(n => 
            !n.readAt && 
            ['EVENT_CANCELLED', 'EVENT_UPDATED', 'EVENT_PARTICIPANT_JOINED', 'EVENT_PARTICIPANT_LEFT', 'EVENT_POST_ADDED'].includes(n.type)
          );
          if (unreadNotifications.length > 0) {
            // Используем logger если нужно (пока оставляем простой лог для отладки)
            markAllNotificationsAsRead();
          }
        }
      };
    }, [notifications, markAllNotificationsAsRead])
  );
  
  const handleTabChange = (tab: 'messages' | 'requests') => {
    setActiveTab(tab);
    activeTabRef.current = tab;
    if (tab === 'requests') {
      wasOnRequestsTabRef.current = true;
    }
  };

  return (
    <View style={styles.container}>
      {/* Табы */}
      <View style={[styles.tabsContainer, { paddingTop: 60 }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => handleTabChange('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
            {t.inbox.messages}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => handleTabChange('requests')}
        >
          <View style={styles.tabContent}>
            <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
              {t.inbox.notifications}
            </Text>
            {unreadNotificationsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Контент табов */}
      {activeTab === 'messages' ? <MessagesTab /> : <RequestsTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
  },
  activeTab: {
    backgroundColor: '#8B5CF6',
  },
  tabText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '600',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
