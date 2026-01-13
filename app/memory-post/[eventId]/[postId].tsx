import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '../../../utils/safeRouter';
import { useEvents } from '../../../context/EventsContext';
import MemoryPost from '../../client/components/MemoryPost';
import TopBar from '../../../components/TopBar';

export default function MemoryPostScreen() {
  const { eventId, postId } = useLocalSearchParams<{ eventId: string; postId: string }>();
  const router = useSafeRouter();
  const { getEventProfile } = useEvents();

  const eventProfile = eventId ? getEventProfile(eventId) : null;
  const post = eventProfile?.posts.find(p => p.id === postId);

  // Функция навигации для передачи в MemoryPost
  const handleNavigate = (path: string) => {
    router.push(path);
  };

  if (!post || !eventId) {
    return (
      <View style={styles.container}>
        <TopBar />
        <View style={styles.emptyContainer}>
          {/* Post not found */}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <MemoryPost post={post} onNavigate={handleNavigate} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

