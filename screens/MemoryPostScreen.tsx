import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeRouter } from '../utils/safeRouter';
import { useEvents } from '../context/EventsContext';
import MemoryPost from '../components/MemoryPost';
import TopBar from '../components/TopBar';
import { useLanguage } from '../context/LanguageContext';
import { useGuestGate } from '../hooks/useGuestGate';

export default function MemoryPostScreen() {
  const { t } = useLanguage();
  const { eventId, postId } = useLocalSearchParams<{ eventId: string; postId: string }>();
  const router = useSafeRouter();
  const { getEventProfile, fetchEventProfile } = useEvents();
  // Гость: меморис-посты закрыты (диплинк в обход таб-бара).
  const isGuest = useGuestGate();

  const eventProfile = eventId ? getEventProfile(eventId) : null;
  const post = eventProfile?.posts.find(p => p.id === postId);
  const hasPost = Boolean(post);

  /**
   * Профиль события может быть ещё не загружен.
   *
   * Сюда теперь ведут пуш и уведомление о лайке или комментарии, а оттуда
   * профиль события заранее никто не подгружал — экран оставался пустым.
   * Грузим один раз на событие, пока публикации нет.
   */
  const [loading, setLoading] = useState(false);
  const requestedForRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => {
    if (!eventId || hasPost || requestedForRef.current === eventId) return;
    requestedForRef.current = eventId;
    setLoading(true);
    fetchEventProfile(eventId)
      .catch(() => undefined)
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [eventId, hasPost, fetchEventProfile]);

  // Функция навигации для передачи в MemoryPost
  const handleNavigate = (path: string) => {
    router.push(path);
  };

  // Гостю пост не показываем — редирект на регистрацию уже пошёл.
  if (isGuest) return null;

  if (!post || !eventId) {
    return (
      <View style={styles.container}>
        <TopBar 
          searchPlaceholder={t.common.searchPh}
          onSearchChange={() => {}}
          searchQuery=""
        />
        <View style={styles.emptyContainer}>
          {loading ? (
            <ActivityIndicator color="#FF8D32" />
          ) : (
            <Text style={styles.emptyText}>{t.empty.nothingFound}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar 
        searchPlaceholder={t.common.searchPh}
        onSearchChange={() => {}}
        searchQuery=""
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <MemoryPost post={post} onNavigate={handleNavigate} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scrollView: {
    flex: 1,
  },
  emptyText: {
    color: 'rgba(244,244,245,0.45)',
    fontSize: 14,
    textAlign: 'center',
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

