import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../../components/TopBar';
import EventCard from '../../components/EventCard';
import { useEvents, Event } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SavedScreen() {
  const router = useRouter();
  const { getSavedEvents, getSavedMemoryPosts, getUserData, eventProfiles } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'memories'>('events');

  // Функция поиска для сохраненных событий
  const handleSavedSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Получаем сохраненные события
  const savedEvents = useMemo(() => {
    return getSavedEvents();
  }, [getSavedEvents]);

  // Получаем сохраненные меморис посты
  const savedMemoryPosts = useMemo(() => {
    return getSavedMemoryPosts(eventProfiles);
  }, [getSavedMemoryPosts, eventProfiles]);

  // Фильтруем события по поисковому запросу
  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return savedEvents;
    
    const lowerQuery = searchQuery.toLowerCase();
    return savedEvents.filter(event => {
      // Поиск по названию события
      if (event.title.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по описанию
      if (event.description?.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по локации
      if (event.location?.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по дате
      if (event.displayDate?.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по времени
      if (event.time?.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по организатору
      const organizer = getUserData(event.organizerId);
      if (organizer.name.toLowerCase().includes(lowerQuery) || 
          organizer.username.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      return false;
    });
  }, [savedEvents, searchQuery, getUserData]);

  const onRefresh = () => {
    setRefreshing(true);
    // Симуляция обновления данных
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  if (!authUser) {
    return (
      <View style={styles.container}>
        <TopBar onSearch={handleSavedSearch} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Авторизуйтесь, чтобы просматривать сохраненные события</Text>
        </View>
      </View>
    );
  }

  // Фильтруем меморис посты по поисковому запросу
  const filteredMemoryPosts = useMemo(() => {
    if (!searchQuery.trim()) return savedMemoryPosts;
    
    const lowerQuery = searchQuery.toLowerCase();
    return savedMemoryPosts.filter(({ post, eventId }) => {
      // Поиск по описанию поста
      if (post.caption?.toLowerCase().includes(lowerQuery)) return true;
      
      // Поиск по автору
      const author = getUserData(post.authorId);
      if (author.name.toLowerCase().includes(lowerQuery) || 
          author.username.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      return false;
    });
  }, [savedMemoryPosts, searchQuery, getUserData]);

  return (
    <View style={styles.container}>
      <TopBar onSearch={handleSavedSearch} />
      
      {/* Табы для переключения между событиями и меморис */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            {t.settings.saved.savedEvents || 'Сохраненные события'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'memories' && styles.tabActive]}
          onPress={() => setActiveTab('memories')}
        >
          <Text style={[styles.tabText, activeTab === 'memories' && styles.tabTextActive]}>
            {t.settings.saved.savedMemories || 'Сохраненные меморис'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'events' ? (
          filteredEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Ничего не найдено' : 'Нет сохраненных событий'}
              </Text>
            </View>
          ) : (
            <View style={styles.eventsContainer}>
              {filteredEvents.map((event, index) => {
                // Рассчитываем ширину карточки для трех колонок
                const containerPadding = 40; // 20px с каждой стороны
                const gap = 15; // Отступ между карточками
                const availableWidth = SCREEN_WIDTH - containerPadding;
                const cardWidth = (availableWidth - gap * 2) / 3; // 3 колонки с 2 промежутками
                const isLastInRow = (index + 1) % 3 === 0;
                
                return (
                  <View
                    key={event.id}
                    style={[
                      { width: cardWidth },
                      !isLastInRow && { marginRight: gap }
                    ]}
                  >
                    <EventCard
                      id={event.id}
                      title={event.title}
                      description={event.description || ''}
                      date={event.date}
                      time={event.time}
                      displayDate={event.displayDate}
                      location={event.location || ''}
                      price={event.price || 'Бесплатно'}
                      participants={event.participants || 0}
                      maxParticipants={event.maxParticipants || 10}
                      organizerAvatar={getUserData(event.organizerId)?.avatar || ''}
                      organizerId={event.organizerId}
                      variant="miniature_1"
                      showSwipeAction={false}
                      mediaUrl={event.mediaUrl}
                      mediaType={event.mediaType}
                      mediaAspectRatio={event.mediaAspectRatio}
                      participantsList={event.participantsList}
                      participantsData={event.participantsData}
                      onMiniaturePress={() => router.push(`/event-profile/${event.id}`)}
                    />
                  </View>
                );
              })}
            </View>
          )
        ) : (
          filteredMemoryPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Ничего не найдено' : 'Нет сохраненных меморис постов'}
              </Text>
            </View>
          ) : (
            <View style={styles.memoriesGrid}>
              {filteredMemoryPosts.map(({ post, eventId }, index) => {
                // Сетка 3 колонки с тонкими полосками между
                const containerPadding = 20;
                const gap = 1; // Тонкая полоска между постами
                const availableWidth = SCREEN_WIDTH - containerPadding * 2;
                const cardWidth = (availableWidth - gap * 2) / 3;
                const cardHeight = cardWidth; // Квадратные карточки
                const isLastInRow = (index + 1) % 3 === 0;
                
                // Определяем тип контента
                const effectiveType: 'photo' | 'video' | 'music' | 'text' = (() => {
                  if (post.photoUrl) return 'photo';
                  if (typeof post.content === 'string' && /\.(mp4|mov|m4v)$/i.test(post.content)) return 'video';
                  return (post as any).type ?? 'text';
                })();

                return (
                  <TouchableOpacity
                    key={`${eventId}-${post.id}`}
                    style={[
                      styles.memoryPostCard,
                      { 
                        width: cardWidth, 
                        height: cardHeight,
                        marginRight: isLastInRow ? 0 : gap,
                        marginBottom: gap,
                      }
                    ]}
                    onPress={() => router.push(`/event-profile/${eventId}`)}
                  >
                    {effectiveType === 'photo' && (
                      <Image 
                        source={{ uri: post.photoUrl || post.content }} 
                        style={styles.memoryPostImage}
                        resizeMode="cover"
                      />
                    )}
                    {effectiveType === 'video' && (
                      <View style={styles.memoryPostContainer}>
                        <Image 
                          source={{ uri: post.photoUrl || post.content }} 
                          style={styles.memoryPostImage}
                          resizeMode="cover"
                        />
                        <View style={styles.memoryPostPlayButton}>
                          <Text style={styles.memoryPostPlayIcon}>▶</Text>
                        </View>
                      </View>
                    )}
                    {effectiveType === 'music' && (
                      <View style={styles.memoryPostContainer}>
                        <Image 
                          source={{ uri: post.artwork_url || post.photoUrl || post.content }} 
                          style={styles.memoryPostImage}
                          resizeMode="cover"
                        />
                        <View style={styles.memoryPostPlayButton}>
                          <Text style={styles.memoryPostPlayIcon}>♪</Text>
                        </View>
                      </View>
                    )}
                    {effectiveType === 'text' && (
                      <View style={styles.memoryPostTextContainer}>
                        <Text style={styles.memoryPostText} numberOfLines={4}>
                          {post.content}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#8B5CF6',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  eventsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  memoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  memoryPostCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 0,
    overflow: 'hidden',
  },
  memoryPostContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  memoryPostImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A2A2A',
  },
  memoryPostTextContainer: {
    width: '100%',
    height: '100%',
    padding: 8,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryPostText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  memoryPostPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryPostPlayIcon: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

