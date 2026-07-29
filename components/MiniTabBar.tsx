import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

const TABS = [
  { name: 'explore', path: '/(tabs)/explore', icon: 'compass-outline' as const },
  { name: 'memories', path: '/(tabs)/memories', icon: 'book' as const, family: 'fa' as const },
  { name: 'create', path: '/(tabs)/create', icon: 'add-circle-outline' as const },
  { name: 'inbox', path: '/(tabs)/inbox', icon: 'chatbubble-outline' as const },
  { name: 'profile', path: '/(tabs)/profile', icon: 'person-outline' as const },
];

type MiniTabBarProps = {
  /** Раздел, из которого открыт экран. Нужен, чтобы на чужом профиле
   *  подсвечивался исходный таб, а не Profile. */
  activeTab?: string | null;
};

export default function MiniTabBar({ activeTab = null }: MiniTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Точное совпадение по последнему сегменту: раньше проверка была через
  // includes(), и на /profile/<id> подсвечивался таб Profile, будто это
  // собственный аккаунт.
  const currentSegment = pathname?.split('?')[0].split('/').filter(Boolean).pop() ?? '';

  return (
    <View style={styles.bar}>
      {TABS.map(tab => {
        const active = activeTab ? activeTab === tab.name : currentSegment === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
          >
            {/* Размеры, семейство иконок и цвета совпадают с настоящей панелью из
                app/(tabs)/_layout.tsx — иначе на чужом профиле она выглядит как
                другое меню */}
            {(tab as any).family === 'fa' ? (
              <FontAwesome name="book" size={24} color={active ? '#f4f4f5' : '#888'} />
            ) : (
              <Ionicons name={tab.icon as any} size={28} color={active ? '#f4f4f5' : '#888'} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#141417',
    height: 82,
    paddingBottom: 20,
    paddingTop: 10,
    borderTopWidth: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
