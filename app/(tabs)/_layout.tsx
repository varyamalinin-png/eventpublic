import { Tabs } from 'expo-router';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Link } from 'expo-router';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useMemo } from 'react';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TabBadge');

export default function TabLayout() {
  const { chats, unreadNotificationsCount } = useEvents();
  const { user } = useAuth();
  const currentUserId = useMemo(() => user?.id ?? null, [user]);

  // КРИТИЧЕСКИ ВАЖНО: Не считаем непрочитанные сообщения, так как нет правильной логики определения прочитанности
  // Текущая логика просто проверяет, что последнее сообщение не от текущего пользователя,
  // но это не означает, что сообщение непрочитано - пользователь мог уже прочитать его
  // Поэтому временно отключаем подсчет непрочитанных сообщений
  // TODO: Добавить поле readAt или lastReadAt в Chat/ChatMessage для правильного определения прочитанности
  const unreadMessagesCount = useMemo(() => {
    // Временно возвращаем 0, так как нет правильной логики определения прочитанности сообщений
    // if (!currentUserId) return 0;
    // return chats.filter(chat => {
    //   const lastMessage = chat.lastMessage;
    //   // Если есть последнее сообщение и оно не от текущего пользователя, считаем чат непрочитанным
    //   return lastMessage && lastMessage.fromUserId !== currentUserId;
    // }).length;
    return 0;
  }, [chats, currentUserId]);

  // Общее количество непрочитанных (только уведомления, без сообщений)
  const totalUnreadCount = useMemo(() => {
    const total = unreadMessagesCount + unreadNotificationsCount;
    logger.debug('TabBadge counts', { unreadMessagesCount, unreadNotificationsCount, total });
    return total;
  }, [unreadMessagesCount, unreadNotificationsCount]);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFF', // Белый цвет для активных иконок
        tabBarInactiveTintColor: '#888', // Серый цвет для неактивных иконок
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <View style={styles.tabBarBackground} />
        ),
      }}
    >
      {/* Explore */}
      <Tabs.Screen
        name="explore"
        options={{
          title: '',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="compass-outline" size={28} color={color} />
          )
        }}
      />

      {/* Memories */}
      <Tabs.Screen
        name="memories"
        options={{
          title: '',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <FontAwesome name="book" size={24} color={color} />
          )
        }}
      />

      {/* Create */}
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons 
              name="add-circle-outline" 
              size={28} 
              color={color} 
            />
          )
        }}
      />

      {/* Inbox */}
      <Tabs.Screen
        name="inbox"
        options={{
          title: '',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="chatbubble-outline" size={24} color={color} />
              {totalUnreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </Text>
                </View>
              )}
            </View>
          )
        }}
      />

      {/* Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={24} color={color} />
          )
        }}
      />

      {/* Saved - скрыта из табов, доступна только через настройки */}
      <Tabs.Screen
        name="saved"
        options={{
          href: null, // Скрываем из табов
          title: '',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0, // Убираем верхнюю границу
    elevation: 0,
    height: 60,
    backgroundColor: '#121212', // Темный фон как у основного экрана
  },
  tabBarBackground: {
    flex: 1,
    backgroundColor: '#121212', // Темный фон
  },
  headerRight: {
    flexDirection: 'row',
    marginRight: 15,
  },
  headerIcon: {
    marginLeft: 20,
  },
  iconButton: {
    marginLeft: 15,
    padding: 5,
  },
  icon: {
    fontSize: 24,
  },
  iconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121212',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
