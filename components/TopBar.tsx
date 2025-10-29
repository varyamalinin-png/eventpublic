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
}

export default function TopBar({ 
  searchPlaceholder, 
  onSearchChange, 
  searchQuery,
  showCalendar = true,
  showMap = true,
  userId 
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
                if (userId) {
                  router.push(`/map?userId=${userId}`);
                } else {
                  router.push('/map');
                }
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
});
