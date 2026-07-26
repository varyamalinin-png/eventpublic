import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { name: 'explore', path: '/(tabs)/explore', icon: 'compass-outline' as const },
  { name: 'memories', path: '/(tabs)/memories', icon: 'book-outline' as const },
  { name: 'create', path: '/(tabs)/create', icon: 'add-circle-outline' as const },
  { name: 'inbox', path: '/(tabs)/inbox', icon: 'chatbubble-outline' as const },
  { name: 'profile', path: '/(tabs)/profile', icon: 'person-outline' as const },
];

export default function MiniTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.bar}>
      {TABS.map(tab => {
        const active = pathname?.includes(tab.name);
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
          >
            <Ionicons name={tab.icon} size={24} color={active ? '#f4f4f5' : '#555'} />
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
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    paddingTop: 10,
    borderTopWidth: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
