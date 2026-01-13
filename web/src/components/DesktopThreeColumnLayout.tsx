'use client';

import React, { useState, useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { View, Text, StyleSheet } from 'react-native';
import { usePathname } from 'next/navigation';
import { WebTabBar } from './WebTabBar';

// Динамически импортируем экраны из client напрямую (без оберток из page.tsx)
const ExploreScreen = dynamicImport(
  () => import('@/client/app/(tabs)/explore').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const MemoriesScreen = dynamicImport(
  () => import('@/client/app/(tabs)/memories').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const InboxScreen = dynamicImport(
  () => import('@/client/app/(tabs)/inbox').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const ProfileScreen = dynamicImport(
  () => import('@/client/app/(tabs)/profile').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const CreateScreen = dynamicImport(
  () => import('@/client/app/(tabs)/create').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const CalendarScreen = dynamicImport(
  () => import('@/client/app/calendar').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const MapScreen = dynamicImport(
  () => import('@/client/app/map').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const EventProfileScreen = dynamicImport(
  () => import('@/client/app/event-profile/[id]').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const UserProfileScreen = dynamicImport(
  () => import('@/client/app/profile/[id]').then(mod => ({ default: mod.default })),
  { ssr: false }
);

const ChatScreen = dynamicImport(
  () => import('@/client/app/(tabs)/inbox/[chatId]').then(mod => ({ default: mod.default })),
  { ssr: false }
);

type PageType = 'explore' | 'memories' | 'create' | 'inbox' | 'profile' | 'calendar' | 'map' | 'event-profile' | 'user-profile' | 'chat';

interface DesktopSingleColumnLayoutProps {}

// Функция для определения типа страницы из URL
function getPageTypeFromPath(pathname: string | null): { type: PageType; path: string; params?: any } | null {
  if (!pathname) return null;
  
  // Обрабатываем динамические роуты
  const eventProfileMatch = pathname.match(/^\/event-profile\/([^/]+)/);
  if (eventProfileMatch) {
    return { type: 'event-profile', path: pathname, params: { id: eventProfileMatch[1] } };
  }
  
  const userProfileMatch = pathname.match(/^\/profile\/([^/]+)/);
  if (userProfileMatch) {
    return { type: 'user-profile', path: pathname, params: { id: userProfileMatch[1] } };
  }
  
  // Обрабатываем конкретный чат
  const chatMatch = pathname.match(/^\/inbox\/([^/]+)$/);
  if (chatMatch) {
    return { type: 'chat', path: pathname, params: { chatId: chatMatch[1] } };
  }
  
  // Статические роуты
  if (pathname === '/explore' || pathname === '/') {
    return { type: 'explore', path: '/explore' };
  }
  if (pathname === '/memories') {
    return { type: 'memories', path: '/memories' };
  }
  if (pathname === '/create') {
    return { type: 'create', path: '/create' };
  }
  if (pathname === '/inbox' || pathname.startsWith('/inbox/')) {
    return { type: 'inbox', path: pathname };
  }
  if (pathname === '/profile') {
    return { type: 'profile', path: '/profile' };
  }
  if (pathname === '/calendar') {
    return { type: 'calendar', path: '/calendar' };
  }
  if (pathname === '/map') {
    return { type: 'map', path: '/map' };
  }
  
  return null;
}

export default function DesktopThreeColumnLayout({}: DesktopSingleColumnLayoutProps = {}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageType | null>(null);

  // Определяем текущую страницу на основе URL
  useEffect(() => {
    const pageInfo = getPageTypeFromPath(pathname);
    if (pageInfo) {
      setCurrentPage(pageInfo.type);
    }
    setMounted(true);
  }, [pathname]);

  const renderPageContent = () => {
    if (!mounted || !currentPage) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      );
    }

    switch (currentPage) {
      case 'chat':
        return <ChatScreen />;
      case 'inbox':
        return <InboxScreen />;
      case 'explore':
        return <ExploreScreen />;
      case 'memories':
        return <MemoriesScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'create':
        return <CreateScreen />;
      case 'calendar':
        return <CalendarScreen />;
      case 'map':
        return <MapScreen />;
      case 'event-profile':
        return <EventProfileScreen />;
      case 'user-profile':
        return <UserProfileScreen />;
      default:
        return (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Страница не найдена</Text>
          </View>
        );
    }
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#0f0f0f',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 640, // Узкий контейнер (на 20% меньше чем 800px)
        minHeight: '100vh',
        backgroundColor: '#0f0f0f',
        borderLeft: '1px solid #333',
        borderRight: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        margin: '0 auto', // Гарантируем одинаковые отступы слева и справа
      }}>
        <div style={{
          flex: 1,
          overflow: 'auto',
          paddingBottom: '60px', // Отступ для TabBar
        }}>
          {renderPageContent()}
        </div>
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 640,
          margin: '0 auto', // Гарантируем одинаковые отступы слева и справа
          zIndex: 99999,
        }}>
          <WebTabBar />
        </div>
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    minHeight: '100vh',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
});
