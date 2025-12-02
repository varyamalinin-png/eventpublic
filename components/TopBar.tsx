import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Link, useRouter } from 'expo-router';

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
  activeFiltersCount = 0
}: TopBarProps) {
  const router = useRouter();
  const { width } = Dimensions.get('window');
  
  const handleCalendarPress = () => {
    if (userId) {
      // Если указан userId, передаем его как параметр в календарь
      router.push(`/calendar?userId=${userId}`);
    } else {
      // Иначе переходим в обычный календарь (текущего пользователя)
      router.push('/calendar');
    }
  };

  return (
    <>
      <View style={styles.topBar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {onFilterPress && (
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={onFilterPress}
            >
              <Text style={styles.filterIcon}>🔽</Text>
              {activeFiltersCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.topButtonsContainer}>
          {showCalendar && (
            <TouchableOpacity 
              style={styles.calendarButton}
              onPress={handleCalendarPress}
            >
              <Text style={styles.calendarIcon}>📅</Text>
            </TouchableOpacity>
          )}
          
          {showMap && (
            <TouchableOpacity 
              style={styles.mapButton}
              onPress={() => {
                let url = '/map';
                const params: string[] = [];
                if (userId) {
                  params.push(`userId=${userId}`);
                }
                if (exploreTab) {
                  params.push(`exploreTab=${exploreTab}`);
                }
                if (params.length > 0) {
                  url += `?${params.join('&')}`;
                }
                router.push(url);
              }}
            >
              <Text style={styles.mapIcon}>🗺️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    flex: 1,
    marginRight: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    marginLeft: 8,
  },
  searchIcon: {
    fontSize: 18,
    color: '#999',
  },
  topButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarButton: {
    padding: 8,
    marginRight: 8,
  },
  calendarIcon: {
    fontSize: 24,
  },
  mapButton: {
    padding: 8,
  },
  mapIcon: {
    fontSize: 24,
  },
  filterButton: {
    padding: 4,
    marginLeft: 8,
    position: 'relative',
  },
  filterIcon: {
    fontSize: 18,
    color: '#999',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
