import { Tabs } from 'expo-router';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Link } from 'expo-router';

export default function TabLayout() {
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
          title: '',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <View style={styles.createButton}>
              <Ionicons 
                name="add" 
                size={32} 
                color={focused ? '#FFF' : '#888'} 
              />
            </View>
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
            <Ionicons name="chatbubble-outline" size={24} color={color} />
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1, // Тонкая белая полоса сверху
    borderTopColor: '#FFF',
    elevation: 0,
    height: 60,
    backgroundColor: '#121212', // Темный фон как у основного экрана
  },
  tabBarBackground: {
    flex: 1,
    backgroundColor: '#121212', // Темный фон
  },
  createButton: {
    width: 50,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
  }
});
