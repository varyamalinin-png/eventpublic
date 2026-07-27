import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions, Platform, ActivityIndicator } from 'react-native';
import TopBar from '../../components/TopBar';
import MemoryPost from '../../components/MemoryPost';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '../../utils/safeRouter';
import { createLogger } from '../../utils/logger';
import { AppIcon } from '../../components/ui/AppIcon';

// Для веб-версии используем ограниченную ширину контейнера (500px), для мобильных - полную ширину экрана
const getContainerWidth = () => {
  const screenWidth = Dimensions.get('window').width;
  if (Platform.OS === 'web') {
    return Math.min(screenWidth, 500);
  }
  return screenWidth;
};
const SCREEN_WIDTH = getContainerWidth();

const logger = createLogger('Memories');

export default function MemoriesScreen() {
  // Безопасное получение router
  const router = useSafeRouter();
  
  const { eventProfiles, getUserData, friends, events, isEventPast, isUserEventMember, fetchEventProfile, isFriend } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  
  // Функция навигации для передачи в MemoryPost
  const handleNavigate = (path: string) => {
    router.push(path);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const loadedProfilesRef = useRef<Set<string>>(new Set());
  
  logger.debug('Рендер MemoriesScreen:', { eventsCount: events.length, profilesCount: eventProfiles.length, hasAuthUser: !!authUser?.id });
  logger.debug('Список профилей:', eventProfiles.map(p => `${p.eventId}(${p.participants.length} участников, ${p.posts?.length || 0} постов)`).join(', ') || 'нет');
  
  // Загружаем профили для прошедших событий при открытии Memories
  const [profilesLoading, setProfilesLoading] = React.useState(true);

  const loadProfilesForPastEvents = React.useCallback(async () => {
    if (!authUser?.id || !fetchEventProfile || events.length === 0) return;

    const pastEvents = events.filter(event => isEventPast(event));
    if (pastEvents.length === 0) { setProfilesLoading(false); return; }

    let loaded = 0;
    for (const event of pastEvents) {
      if (eventProfiles.find(p => p.eventId === event.id)) { loaded++; continue; }
      if (loadedProfilesRef.current.has(event.id)) { loaded++; continue; }

      loadedProfilesRef.current.add(event.id);
      try {
        await fetchEventProfile(event.id);
        loaded++;
      } catch {
        loadedProfilesRef.current.delete(event.id);
      }
    }
    setProfilesLoading(false);
  }, [authUser?.id, events, isEventPast, fetchEventProfile, eventProfiles]);

  useEffect(() => {
    setProfilesLoading(true);
    loadProfilesForPastEvents();
  }, [loadProfilesForPastEvents]);

  useFocusEffect(
    React.useCallback(() => {
      loadedProfilesRef.current.clear();
      loadProfilesForPastEvents();
    }, [loadProfilesForPastEvents])
  );

  // Функция поиска для memories
  const handleMemoriesSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Получаем все посты из аккаунтов событий
  // ВАЖНО: Для Memories используем только eventProfiles, не проверяем наличие события в events
  // Это позволяет показывать посты даже после удаления события (для прошедших событий)
  const allPosts = useMemo(() => {
    const posts: Array<{ post: any; eventId: string }> = [];
    
    
    eventProfiles.forEach(profile => {
      // Проверяем, что профиль имеет посты
      if (profile.posts && profile.posts.length > 0) {
        profile.posts.forEach(post => {
          posts.push({ post, eventId: profile.eventId });
        });
      } else {
      }
    });
    
    return posts.sort((a, b) => 
      new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
    );
  }, [eventProfiles]);


  const filteredPosts = useMemo(() => {
    const currentUserId = authUser?.id;
    if (!currentUserId) return [];
    
    const filtered = allPosts.filter(({ post, eventId }) => {
      const isCurrentUser = post.authorId === currentUserId;

      if (isCurrentUser) {
        if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          const author = getUserData(post.authorId);
          const event = events.find(e => e.id === eventId);
          
          // Поиск по автору
          if (author?.name?.toLowerCase().includes(lowerQuery) || 
              author?.username?.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          
          // Поиск по названию события
          if (event?.title?.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          
          // Поиск по описанию поста
          if (post.caption?.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          
          // Поиск по типу контента
          if (post.type?.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          
          return false;
        }
        return true;
      }
      
      // Для чужих постов - проверяем два условия:
      // 1. Автор является другом
      // 2. ИЛИ автор поста и я - участники одного события (АВТОР_ПОСТА_УЧАСТНИК_НАШЕГО_РАЗДЕЛЕННОГО_СОБЫТИЯ)
      const isAuthorFriend = isFriend(post.authorId);
      
      // Проверяем, что автор поста и я - участники одного события
      const postEventProfile = eventProfiles.find(ep => ep.eventId === eventId);
      const areBothParticipants = postEventProfile 
        ? postEventProfile.participants.includes(post.authorId) && 
          postEventProfile.participants.includes(currentUserId)
        : false;
      
      // Также проверяем через events для предстоящих событий
      const postEvent = events.find(e => e.id === eventId);
      const areBothMembersInEvent = postEvent 
        ? (isUserEventMember(postEvent, post.authorId) && isUserEventMember(postEvent, currentUserId))
        : false;
      
      const areSharedEventParticipants = areBothParticipants || areBothMembersInEvent;

      if (!isAuthorFriend && !areSharedEventParticipants) return false;
      
      // Поиск по тексту
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        const author = getUserData(post.authorId);
        const event = events.find(e => e.id === eventId);
        
        // Поиск по автору
        if (author?.name?.toLowerCase().includes(lowerQuery) || 
            author?.username?.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        // Поиск по названию события
        if (event?.title?.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        // Поиск по описанию поста
        if (post.caption?.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        // Поиск по типу контента
        if (post.type?.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        return false;
      }
      
      // Без поиска - показываем посты друзей
      return true;
    });
    
    return filtered;
  }, [allPosts, searchQuery, friends, getUserData, eventProfiles, authUser, isFriend]);


  // Группируем посты по автору и событию
  const groupedPosts = useMemo(() => {
    const groups: Record<string, Array<{ post: any; eventId: string }>> = {};
    
    filteredPosts.forEach(({ post, eventId }) => {
      const groupKey = `${post.authorId}-${eventId}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push({ post, eventId });
    });
    
    // Сортируем группы по дате последнего поста
    return Object.values(groups).sort((a, b) => {
      const dateA = new Date(a[a.length - 1].post.createdAt).getTime();
      const dateB = new Date(b[b.length - 1].post.createdAt).getTime();
      return dateB - dateA;
    });
  }, [filteredPosts]);

  // В Memories (вкладка) показываем только посты, без папок
  // Папки находятся в разделе Memories в профиле

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Перезагружаем профили для всех прошедших событий
      const pastEvents = events.filter(event => isEventPast(event));
      logger.debug('onRefresh: перезагрузка профилей', { pastEventsCount: pastEvents.length });
      
      // Очищаем кэш загруженных профилей, чтобы перезагрузить их
      loadedProfilesRef.current.clear();
      
      // Загружаем профили заново
      for (const event of pastEvents) {
        try {
          await fetchEventProfile(event.id);
        } catch (error) {
          logger.error(`Ошибка при обновлении профиля события ${event.id}:`, error);
        }
      }
      
      logger.info('onRefresh: обновление завершено');
    } catch (error) {
      logger.error('Ошибка при обновлении:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (!authUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loginPromptTitle}>Авторизуйтесь</Text>
        <Text style={styles.loginPromptText}>
          Войдите, чтобы просматривать воспоминания ваших событий и друзей.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        searchPlaceholder={t.empty.searchMemories}
        onSearchChange={handleMemoriesSearch}
        searchQuery={searchQuery}
        showCalendar={true}
        showMap={true}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF8D32"
          />
        }
      >
        {(() => {
          // Логирование рендера, только для постов (без папок)

          logger.debug('Рендер MemoriesScreen (только посты)', {
            filteredPostsCount: filteredPosts.length,
            profilesCount: eventProfiles.length,
          });

          if (filteredPosts.length === 0) {
            if (profilesLoading) {
              return (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="large" color="#FF8D32" />
                </View>
              );
            }
            return (
              <View style={styles.emptyContainer}>
                <AppIcon name="camera" size={60} color="rgba(244,244,245,0.25)" />
                <Text style={styles.emptyTitle}>{t.empty.noMemoriesTitle || t.empty.noMemoriesYet}</Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? (t.empty.searchNotFound || t.empty.nothingFound)
                    : (t.empty.noPostsYouAndFriends || t.empty.appearAfterEvents)}
                </Text>
              </View>
            );
          }

          // Отрисовываем только посты (группированные по автору и событию)
          return (
            <View>
              {groupedPosts.map((group, groupIndex) => {
                const isCarousel = group.length > 1;
                const postWidth = isCarousel ? SCREEN_WIDTH * 0.85 : SCREEN_WIDTH;

                if (isCarousel) {
                  return (
                    <View
                      key={`group-${groupIndex}`}
                      style={styles.postGroupContainer}
                    >
                      <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        decelerationRate="fast"
                        snapToInterval={postWidth}
                        snapToAlignment="start"
                        style={styles.carouselScrollView}
                        contentContainerStyle={styles.carouselContentContainer}
                      >
                        {group.map(({ post, eventId }) => (
                          <View
                            key={`${eventId}-${post.id}`}
                            style={[styles.carouselPostItem, { width: postWidth }]}
                          >
                            <MemoryPost
                              post={post}
                              showOptions={true}
                              onNavigate={handleNavigate}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  );
                }

                // Одиночный пост
                const { post, eventId } = group[0];
                return (
                  <MemoryPost
                    key={`${eventId}-${post.id}`}
                    post={post}
                    showOptions={true}
                    onNavigate={handleNavigate}
                  />
                );
              })}
            </View>
          );
        })()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loginPromptTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 12,
    textAlign: 'center',
  },
  loginPromptText: {
    fontSize: 16,
    color: '#BBBBCC',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 110,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#f4f4f5',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14.5,
    color: 'rgba(244,244,245,0.5)',
    textAlign: 'center',
    lineHeight: 21,
  },
  postGroupContainer: {
    marginBottom: 18,
  },
  carouselScrollView: {
    flexGrow: 0,
  },
  carouselContentContainer: {
    paddingHorizontal: (SCREEN_WIDTH - SCREEN_WIDTH * 0.85) / 2, // Центрируем карусель
  },
  carouselPostItem: {
    paddingRight: 8, // Отступ между постами в карусели
  },
});
