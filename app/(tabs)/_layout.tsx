import { Tabs } from 'expo-router';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity, Text, Platform, Animated } from 'react-native';
import { Link } from 'expo-router';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useMemo, useRef, useCallback } from 'react';
import { createLogger } from '../../utils/logger';
import { useLanguage } from '../../context/LanguageContext';

const logger = createLogger('TabBadge');

/** Tab bar button with spring scale animation on press (Task 2c) */
function AnimatedTabBarButton({ children, onPress, accessibilityState, style, ...rest }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.82,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  }, [scaleAnim]);

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={style}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { t } = useLanguage();
  const isWeb = Platform.OS === 'web';

  const { chats, unreadNotificationsCount } = useEvents();
  const { user } = useAuth();
  const currentUserId = useMemo(() => user?.id ?? null, [user]);

  // КРИТИЧЕСКИ ВАЖНО: Не считаем непрочитанные сообщения, так как нет правильной логики определения прочитанности
  // Текущая логика просто проверяет, что последнее сообщение не от текущего пользователя,
  // но это не означает, что сообщение непрочитано - пользователь мог уже прочитать его
  // Поэтому временно отключаем подсчет непрочитанных сообщений
  const unreadMessagesCount = useMemo(() => {
    if (!currentUserId) return 0;
    return chats.filter(chat => {
      const last = chat.lastMessage;
      if (!last || last.fromUserId === currentUserId) return false;
      return !last.readBy?.includes(currentUserId);
    }).length;
  }, [chats, currentUserId]);

  // Общее количество непрочитанных (только уведомления, без сообщений)
  const totalUnreadCount = useMemo(() => {
    const total = unreadMessagesCount + unreadNotificationsCount;
    logger.debug('TabBadge counts', { unreadMessagesCount, unreadNotificationsCount, total });
    return total;
  }, [unreadMessagesCount, unreadNotificationsCount]);

  // На вебе используем только WebTabBar (в каждой странице), нативный таб-бар не показываем
  const tabBarStyle = isWeb ? { ...styles.tabBar, display: 'none' as const } : styles.tabBar;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f4f4f5', // Белый цвет для активных иконок
        tabBarInactiveTintColor: '#888', // Серый цвет для неактивных иконок
        tabBarStyle,
        tabBarBackground: () => (
          <View style={styles.tabBarBackground} />
        ),
        // Spring animation on tab bar button press (Task 2c)
        tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
      }}
    >
      {/* Explore - лента глоб (первый таб) */}
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

      {/* Memories - лента меморис постов (второй таб) */}
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

      {/* Create - скрыт на вебе, показывается только на мобильных */}
      <Tabs.Screen
        name="create"
        options={{
          title: t.tabs.create,
          headerShown: false,
          href: isWeb ? null : undefined, // Скрываем на вебе
          tabBarIcon: ({ focused, color }) => (
            <Ionicons 
              name="add-circle-outline" 
              size={28} 
              color={color} 
            />
          )
        }}
      />

      {/* Inbox - сообщения (четвертый таб) */}
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

      {/* Profile - скрыт на вебе, показывается только на мобильных */}
      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          headerShown: false,
          href: isWeb ? null : undefined, // Скрываем на вебе
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
    borderTopWidth: 0,
    elevation: 0,
    height: 82,
    paddingBottom: 20,
    backgroundColor: '#141417',
    ...(Platform.OS === 'web' && {
      maxWidth: 500,
      width: '100%',
    }),
  },
  tabBarBackground: {
    flex: 1,
    backgroundColor: '#141417',
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
    borderColor: '#141417',
  },
  badgeText: {
    color: '#f4f4f5',
    fontSize: 10,
    fontWeight: '700',
  },
});
