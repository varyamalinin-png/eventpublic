import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from './ui/AppIcon';
import { Palette, Radius } from '../constants/DesignSystem';

interface TopBarProps {
  searchPlaceholder: string;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  showCalendar?: boolean;
  showMap?: boolean;
  userId?: string; // ID пользователя для календаря (если не указан - текущий пользователь)
  exploreTab?: 'GLOB' | 'FRIENDS'; // Тип ленты explore для передачи в карту
  onFilterPress?: () => void; // Функция для открытия/закрытия фильтров
  activeFiltersCount?: number; // Количество активных фильтров
}

export default function TopBar({
  searchPlaceholder,
  onSearchChange,
  searchQuery,
  showCalendar = true,
  showMap = true,
  userId,
  exploreTab,
  onFilterPress,
  activeFiltersCount = 0,
}: TopBarProps) {
  const router = useRouter();

  const handleCalendarPress = () => {
    router.push(userId ? `/calendar?userId=${userId}` : '/calendar');
  };

  const handleMapPress = () => {
    let url = '/map';
    const params: string[] = [];
    if (userId) params.push(`userId=${userId}`);
    if (exploreTab) params.push(`exploreTab=${exploreTab}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    router.push(url);
  };

  return (
    <View style={styles.topBar}>
      <View style={styles.searchContainer}>
        <AppIcon name="search" size={17} color={Palette.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor={Palette.textFaint}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {onFilterPress && (
          <TouchableOpacity style={styles.iconPill} onPress={onFilterPress} hitSlop={8}>
            <AppIcon name="filter" size={16} color={Palette.textDim} />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {showCalendar && (
        <TouchableOpacity style={styles.iconPill} onPress={handleCalendarPress} hitSlop={6}>
          <AppIcon name="calendar" size={18} color={Palette.text} />
        </TouchableOpacity>
      )}

      {showMap && (
        <TouchableOpacity style={styles.iconPill} onPress={handleMapPress} hitSlop={6}>
          <AppIcon name="map" size={18} color={Palette.text} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: Palette.line,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Palette.text,
    letterSpacing: 0.1,
  },
  iconPill: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: Palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#1a0d00',
    fontSize: 10,
    fontWeight: '700',
  },
});
