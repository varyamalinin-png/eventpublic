import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import TopBar from '../../components/TopBar';
import MemoryPost from '../../components/MemoryPost';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFocusEffect } from 'expo-router';
import { createLogger } from '../../utils/logger';

const logger = createLogger('Memories');

export default function MemoriesScreen() {
  const { eventProfiles, getUserData, friends, events, isEventPast, isUserEventMember, fetchEventProfile, isFriend } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const loadedProfilesRef = useRef<Set<string>>(new Set());
  
  logger.debug('Рендер MemoriesScreen:', { eventsCount: events.length, profilesCount: eventProfiles.length, hasAuthUser: !!authUser?.id });
  logger.debug('Список профилей:', eventProfiles.map(p => `${p.eventId}(${p.participants.length} участников, ${p.posts?.length || 0} постов)`).join(', ') || 'нет');
  
  // Загружаем профили для прошедших событий при открытии Memories
  useFocusEffect(
    React.useCallback(() => {
      logger.debug('useFocusEffect вызван:', { hasAuthUser: !!authUser?.id, hasFetchEventProfile: !!fetchEventProfile, eventsCount: events.length });
      
      if (!authUser?.id) {
        logger.warn('useFocusEffect: нет authUser, пропуск загрузки');
        return;
      }
      
      if (!fetchEventProfile) {
        logger.warn('useFocusEffect: нет fetchEventProfile, пропуск загрузки');
        return;
      }
      
      const loadProfilesForPastEvents = async () => {
        logger.debug('useFocusEffect: начинаем загрузку профилей', { eventsCount: events.length, profilesCount: eventProfiles.length });
        
        // КРИТИЧЕСКИ ВАЖНО: Находим ВСЕ прошедшие события, независимо от участия
        // Это нужно, чтобы загрузить профили даже для событий, где пользователь уже удалил себя
        const pastEvents = events.filter(event => isEventPast(event));
        
        logger.debug('Найдено прошедших событий:', { pastEventsCount: pastEvents.length, totalEventsCount: events.length, profilesCount: eventProfiles.length });
        
        if (pastEvents.length === 0) {
          logger.warn('Нет прошедших событий для загрузки профилей');
          return;
        }
        
        // Загружаем профили для каждого прошедшего события
        let loadedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (const event of pastEvents) {
          // Проверяем, загружен ли уже профиль
          const existingProfile = eventProfiles.find(p => p.eventId === event.id);
          if (existingProfile) {
            skippedCount++;
            logger.debug(`Профиль для события ${event.id} уже загружен`, { postsCount: existingProfile.posts?.length || 0 });
            continue;
          }
          
          if (loadedProfilesRef.current.has(event.id)) {
            logger.debug(`Профиль для события ${event.id} уже в процессе загрузки`);
            continue;
          }
          
          loadedProfilesRef.current.add(event.id);
          try {
            logger.debug(`Загружаем профиль для события ${event.id}`);
            const profile = await fetchEventProfile(event.id);
            if (profile) {
              loadedCount++;
              logger.info(`Профиль загружен для события ${event.id}`, { postsCount: profile.posts?.length || 0, participantsCount: profile.participants.length });
            } else {
              errorCount++;
              logger.warn(`Профиль не загружен для события ${event.id} (вернулся null)`);
              loadedProfilesRef.current.delete(event.id);
            }
          } catch (error) {
            errorCount++;
            logger.error(`Не удалось загрузить профиль для события ${event.id}:`, error);
            loadedProfilesRef.current.delete(event.id);
          }
        }
        
        logger.info('Загрузка профилей завершена', { loaded: loadedCount, skipped: skippedCount, errors: errorCount, totalProfiles: eventProfiles.length + loadedCount });
      };
      
      // ВСЕГДА загружаем профили при фокусе на экране Memories
      // Это гарантирует загрузку профилей при открытии Memories
      loadProfilesForPastEvents();
    }, [authUser?.id, events.length, isEventPast, fetchEventProfile, friends.length])
  );
  
  // Дополнительная загрузка профилей при изменении events (если useFocusEffect не сработал)
  // КРИТИЧЕСКИ ВАЖНО: Этот useEffect должен загружать профили при монтировании компонента
  useEffect(() => {
    logger.debug('useEffect для загрузки профилей:', { hasAuthUser: !!authUser?.id, hasFetchEventProfile: !!fetchEventProfile, eventsCount: events.length, profilesCount: eventProfiles.length });
    
    if (!authUser?.id || !fetchEventProfile) {
      logger.warn('useEffect: пропуск загрузки', { hasAuthUser: !!authUser?.id, hasFetchEventProfile: !!fetchEventProfile });
      return;
    }
    
    if (events.length === 0) {
      logger.warn('useEffect: нет событий для загрузки профилей');
      return;
    }
    
    const pastEvents = events.filter(event => isEventPast(event));
    logger.debug('useEffect: найдено прошедших событий', { pastEventsCount: pastEvents.length, totalEventsCount: events.length });
    
    if (pastEvents.length === 0) {
      logger.warn('useEffect: нет прошедших событий для загрузки профилей');
      return;
    }
    
    // Загружаем профили для всех прошедших событий
    const loadProfiles = async () => {
      let loadedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      for (const event of pastEvents) {
        // Проверяем, загружен ли уже профиль
        const existingProfile = eventProfiles.find(p => p.eventId === event.id);
        if (existingProfile) {
          skippedCount++;
          continue;
        }
        
        if (loadedProfilesRef.current.has(event.id)) {
          skippedCount++;
          continue;
        }
        
        loadedProfilesRef.current.add(event.id);
        try {
          logger.debug(`useEffect: загружаем профиль для события ${event.id}`);
          const profile = await fetchEventProfile(event.id);
          if (profile) {
            loadedCount++;
            logger.info(`useEffect: профиль загружен для события ${event.id}`, { postsCount: profile.posts?.length || 0, participantsCount: profile.participants.length });
          } else {
            errorCount++;
            logger.warn(`useEffect: профиль не загружен для события ${event.id} (вернулся null)`);
            loadedProfilesRef.current.delete(event.id);
          }
        } catch (error) {
          errorCount++;
          logger.error(`useEffect: не удалось загрузить профиль для события ${event.id}:`, error);
          loadedProfilesRef.current.delete(event.id);
        }
      }
      
      logger.info('useEffect: загрузка профилей завершена', { loaded: loadedCount, skipped: skippedCount, errors: errorCount });
    };
    
    loadProfiles();
  }, [authUser?.id, events.length, isEventPast, fetchEventProfile, friends.length]); // Добавлен friends.length для перезагрузки при изменении списка друзей

  // Функция поиска для memories
  const handleMemoriesSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Получаем все посты из аккаунтов событий
  // ВАЖНО: Для Memories используем только eventProfiles, не проверяем наличие события в events
  // Это позволяет показывать посты даже после удаления события (для прошедших событий)
  const allPosts = useMemo(() => {
    const posts: Array<{ post: any; eventId: string }> = [];
    
    logger.debug('allPosts: пересчет', { profilesCount: eventProfiles.length });
    logger.debug('allPosts: список профилей', eventProfiles.map(p => `${p.eventId}(${p.participants.length} участников, ${p.posts?.length || 0} постов)`).join(', '));
    
    eventProfiles.forEach(profile => {
      // Проверяем, что профиль имеет посты
      if (profile.posts && profile.posts.length > 0) {
        logger.debug(`Profile ${profile.eventId} has posts`, { postsCount: profile.posts.length, participantsCount: profile.participants.length });
        profile.posts.forEach(post => {
          posts.push({ post, eventId: profile.eventId });
        });
      } else {
        logger.debug(`Profile ${profile.eventId} has no posts`, { participantsCount: profile.participants.length });
      }
    });
    
    logger.debug('allPosts: итоговое количество постов', { count: posts.length });
    
    return posts.sort((a, b) => 
      new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
    );
  }, [eventProfiles]);

  // Фильтруем посты - показываем посты только друзьям
  const filteredPosts = useMemo(() => {
    const currentUserId = authUser?.id;
    if (!currentUserId) {
      logger.warn('filteredPosts: нет currentUserId');
      return [];
    }
    
    logger.debug('filteredPosts: пересчет', { allPostsCount: allPosts.length, profilesCount: eventProfiles.length, currentUserId });
    logger.debug('📊 [Memories] Статистика:', {
      allPostsCount: allPosts.length,
      profilesCount: eventProfiles.length,
      currentUserId,
      friendsCount: friends.length,
      friendsList: friends
    });
    
    // Логируем информацию о всех постах перед фильтрацией
    logger.debug('📝 [Memories] ВСЕ ПОСТЫ ПЕРЕД ФИЛЬТРАЦИЕЙ:');
    if (allPosts.length === 0) {
      logger.warn('⚠️ [Memories] НЕТ ПОСТОВ ДЛЯ ФИЛЬТРАЦИИ!');
    } else {
      allPosts.forEach(({ post, eventId }, index) => {
        const isAuthorFriend = isFriend(post.authorId);
        logger.debug(`  [${index}] Пост ID: ${post.id}`, {
          authorId: post.authorId,
          eventId,
          isCurrentUser: post.authorId === currentUserId,
          isAuthorFriend,
          authorInFriendsList: friends.includes(post.authorId),
          willShow: post.authorId === currentUserId || isAuthorFriend
        });
      });
    }
    
    const filtered = allPosts.filter(({ post, eventId }) => {
      const isCurrentUser = post.authorId === currentUserId;
      
      logger.debug(`🔍 [Memories] Фильтрация поста ${post.id}:`, {
        authorId: post.authorId,
        currentUserId,
        isCurrentUser,
        eventId
      });
      
      // Показываем свои посты всегда
      if (isCurrentUser) {
        logger.debug(`✅ [Memories] Пост ${post.id} - свой пост, показываем`);
      
        // Свой пост - показываем, но проверяем поиск
        if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          const author = getUserData(post.authorId);
          const event = eventProfiles.find(ep => ep.eventId === eventId);
          
          // Поиск по автору
          if (author?.name?.toLowerCase().includes(lowerQuery) || 
              author?.username?.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          
          // Поиск по названию события
          if (event?.name?.toLowerCase().includes(lowerQuery)) {
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
      
      // Для чужих постов - проверяем, является ли автор другом
      const isAuthorFriend = isFriend(post.authorId);
      
      logger.debug(`👥 [Memories] Пост ${post.id} - проверка дружбы:`, {
        authorId: post.authorId,
        isAuthorFriend,
        friendsList: friends,
        friendsCount: friends.length,
        authorInFriendsList: friends.includes(post.authorId)
      });
      
      if (!isAuthorFriend) {
        logger.warn(`❌ [Memories] Пост ${post.id} ОТФИЛЬТРОВАН: автор ${post.authorId} НЕ является другом текущего пользователя ${currentUserId}`);
        return false;
      }
      
      logger.debug(`✅ [Memories] Пост ${post.id} - автор является другом, показываем`);
      
      // Поиск по тексту
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        const author = getUserData(post.authorId);
        const event = eventProfiles.find(ep => ep.eventId === eventId);
        
        // Поиск по автору
        if (author?.name?.toLowerCase().includes(lowerQuery) || 
            author?.username?.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        // Поиск по названию события
        if (event?.name?.toLowerCase().includes(lowerQuery)) {
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
    
    logger.debug('═══════════════════════════════════════════════════════════');
    logger.debug('📊 [Memories] РЕЗУЛЬТАТЫ ФИЛЬТРАЦИИ:');
    logger.debug(`   Всего постов: ${allPosts.length}`);
    logger.debug(`   Отфильтровано: ${filtered.length}`);
    logger.debug(`   Друзей: ${friends.length}`);
    if (filtered.length > 0) {
      logger.debug(`   Показанные посты: ${filtered.map(({post, eventId}) => `${eventId}-${post.id}`).join(', ')}`);
    } else if (allPosts.length > 0) {
      logger.warn('⚠️ [Memories] ВСЕ ПОСТЫ ОТФИЛЬТРОВАНЫ!');
      const samplePost = allPosts[0];
      logger.warn('   Пример поста:', {
        postId: samplePost.post.id,
        authorId: samplePost.post.authorId,
        isAuthorFriend: isFriend(samplePost.post.authorId),
        authorInFriendsList: friends.includes(samplePost.post.authorId),
        currentUserId
      });
    }
    logger.debug('═══════════════════════════════════════════════════════════');
    
    logger.debug('filteredPosts: итоговое количество отфильтрованных постов', { count: filtered.length, posts: filtered.map(({post, eventId}) => `${eventId}-${post.id}`).join(', ') || 'нет' });
    return filtered;
  }, [allPosts, searchQuery, friends, getUserData, eventProfiles, authUser?.id, isFriend]);

  const onRefresh = () => {
    setRefreshing(true);
    // Симуляция обновления данных
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
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
        searchPlaceholder="Поиск воспоминаний..."
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
            tintColor="#8B5CF6"
          />
        }
      >
        {(() => {
          logger.debug('Рендер MemoriesScreen', { filteredPostsCount: filteredPosts.length, profilesCount: eventProfiles.length });
          return filteredPosts.length > 0 ? (
            filteredPosts.map(({ post, eventId }) => {
              return (
                <MemoryPost 
                  key={`${eventId}-${post.id}`}
                  post={post}
                  showOptions={true}
                />
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t.empty.noMemoriesTitle}</Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? t.empty.searchNotFound
                  : t.empty.noPostsYouAndFriends
                }
              </Text>
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
    backgroundColor: '#121212',
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
    color: '#FFFFFF',
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
    paddingTop: 8,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
