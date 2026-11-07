import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import MessagesTab from './messages';
import RequestsTab from './requests';
import { useEvents } from '../../../../context/EventsContext';
import { useLanguage } from '../../../../context/LanguageContext';

export default function InboxScreen() {
  /**
   * Вкладку можно задать при переходе: /inbox?tab=requests&requestsTab=outgoing.
   *
   * Раньше «мои запросы» вели на отдельный маршрут /inbox/requests. Он рисует
   * тот же список, но БЕЗ шапки раздела: вкладок «Сообщения / Уведомления»
   * там нет вовсе, а «Входящие / Исходящие» оказываются под самым статус-баром.
   * Теперь переход идёт на сам инбокс, а нужная вкладка выбирается параметром.
   */
  const { tab: tabParam, requestsTab } = useLocalSearchParams<{ tab?: string; requestsTab?: string }>();
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>(
    tabParam === 'requests' ? 'requests' : 'messages',
  );
  const activeTabRef = useRef<'messages' | 'requests'>(activeTab);

  // Параметр может прийти и на уже открытый экран — например, если инбокс
  // остался в стеке раздела (постабные стеки его не размонтируют).
  useEffect(() => {
    if (tabParam === 'requests') {
      setActiveTab('requests');
      activeTabRef.current = 'requests';
      wasOnRequestsTabRef.current = true;
    } else if (tabParam === 'messages') {
      setActiveTab('messages');
      activeTabRef.current = 'messages';
    }
  }, [tabParam, requestsTab]);
  const wasOnRequestsTabRef = useRef(false);

  /**
   * Повторный тап по разделу возвращает к его «домашнему» состоянию — вкладке
   * «Сообщения», как повторный тап по эксплору возвращает к ленте ГЛОБ. Сам
   * скролл к началу делают вложенные списки (useScrollToTop в них).
   */
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener?.('tabPress', () => {
      if ((navigation as any).isFocused?.()) {
        setActiveTab('messages');
        activeTabRef.current = 'messages';
      }
    });
    return unsubscribe;
  }, [navigation]);
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
            ['EVENT_CANCELLED', 'EVENT_UPDATED', 'EVENT_PARTICIPANT_JOINED', 'EVENT_PARTICIPANT_LEFT', 'EVENT_POST_ADDED', 'EVENT_JOIN_REQUEST', 'EVENT_REQUEST_ACCEPTED'].includes(n.type)
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
      {activeTab === 'messages'
        ? <MessagesTab embedded />
        : <RequestsTab initialTab={requestsTab === 'outgoing' ? 'outgoing' : undefined} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  activeTab: {
    backgroundColor: '#FF8D32',
    borderColor: '#FF8D32',
    shadowColor: '#FF8D32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  tabText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14.5,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#1a0d00',
    fontWeight: '700',
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
    color: '#f4f4f5',
    fontSize: 11,
    fontWeight: '600',
  },
});
