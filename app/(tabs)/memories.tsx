import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import TopBar from '../../components/TopBar';
import MemoryPost from '../../components/MemoryPost';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFocusEffect } from 'expo-router';
import { createLogger } from '../../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
              logger.debug(`Профиль не загружен для события ${event.id} (вернулся null)`);
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
            logger.debug(`useEffect: профиль не загружен для события ${event.id} (вернулся null)`);
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
    
    console.log('📦 [Memories] allPosts: пересчет', { profilesCount: eventProfiles.length });
    console.log('📦 [Memories] allPosts: список профилей', eventProfiles.map(p => `${p.eventId}(${p.participants.length} участников, ${p.posts?.length || 0} постов)`).join(', '));
    
    eventProfiles.forEach(profile => {
      // Проверяем, что профиль имеет посты
      if (profile.posts && profile.posts.length > 0) {
        console.log(`📦 [Memories] Profile ${profile.eventId} has posts`, { 
          postsCount: profile.posts.length, 
          participantsCount: profile.participants.length,
          postAuthors: profile.posts.map(p => p.authorId).join(', ')
        });
        profile.posts.forEach(post => {
          posts.push({ post, eventId: profile.eventId });
        });
      } else {
        console.log(`📦 [Memories] Profile ${profile.eventId} has no posts`, { participantsCount: profile.participants.length });
      }
    });
    
    const postsInfo = posts.map(({post, eventId}) => ({
      eventId,
      postId: post.id,
      authorId: post.authorId,
      createdAt: post.createdAt
    }));
    
    console.log('📦 [Memories] allPosts: итоговое количество постов', { 
      count: posts.length,
      postsInfo: JSON.stringify(postsInfo, null, 2)
    });
    
    return posts.sort((a, b) => 
      new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
    );
  }, [eventProfiles]);

<<<<<<< HEAD
=======
  // Логируем изменения allPosts
  useEffect(() => {
    console.log('🔄 [Memories] allPosts изменился:', {
      count: allPosts.length,
      posts: allPosts.map(({post, eventId}) => `event:${eventId}, author:${post.authorId}, postId:${post.id}`).join('; ')
    });
  }, [allPosts.length]);

>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
  // Фильтруем посты - показываем посты только друзьям
  const filteredPosts = useMemo(() => {
    // ПРИНУДИТЕЛЬНОЕ ЛОГИРОВАНИЕ - выводим всегда
    console.log('🚀🚀🚀 [Memories] useMemo filteredPosts ВЫЗВАН! 🚀🚀🚀');
    
    const currentUserId = authUser?.id;
    if (!currentUserId) {
      console.warn('❌ [Memories] filteredPosts: нет currentUserId');
      return [];
    }
    
<<<<<<< HEAD
    logger.debug('filteredPosts: пересчет', { allPostsCount: allPosts.length, profilesCount: eventProfiles.length, currentUserId });
=======
    // КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ - используем logger.debug для гарантии вывода
    logger.debug('═══════════════════════════════════════════════════════════');
    logger.debug('🔍 [Memories] НАЧАЛО ФИЛЬТРАЦИИ ПОСТОВ');
    logger.debug('═══════════════════════════════════════════════════════════');
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
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
<<<<<<< HEAD
=======
    
    allPosts.forEach(({ post, eventId }, index) => {
      const isAuthorFriend = isFriend(post.authorId);
      console.log(`📝 [Memories] allPosts[${index}]:`, {
        postId: post.id,
        authorId: post.authorId,
        eventId,
        isCurrentUser: post.authorId === currentUserId,
        isAuthorFriend,
        willShow: post.authorId === currentUserId || isAuthorFriend
      });
    });
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
    
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
<<<<<<< HEAD
      
=======
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
        // Свой пост - показываем, но проверяем поиск
        if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          const author = getUserData(post.authorId);
<<<<<<< HEAD
          const event = eventProfiles.find(ep => ep.eventId === eventId);
=======
          const event = events.find(e => e.id === eventId);
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
          
          // Поиск по автору
          if (author?.name?.toLowerCase().includes(lowerQuery) || 
              author?.username?.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          
          // Поиск по названию события
<<<<<<< HEAD
          if (event?.name?.toLowerCase().includes(lowerQuery)) {
=======
          if (event?.title?.toLowerCase().includes(lowerQuery)) {
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
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
      
<<<<<<< HEAD
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
=======
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
      
      logger.debug(`👥 [Memories] Пост ${post.id} - проверка дружбы и совместного участия:`, {
        authorId: post.authorId,
        isAuthorFriend,
        areBothParticipants,
        areBothMembersInEvent,
        areSharedEventParticipants,
        friendsList: friends,
        friendsCount: friends.length,
        authorInFriendsList: friends.includes(post.authorId),
        eventId,
        postEventProfileExists: !!postEventProfile,
        postEventExists: !!postEvent
      });
      
      if (!isAuthorFriend && !areSharedEventParticipants) {
        logger.warn(`❌ [Memories] Пост ${post.id} ОТФИЛЬТРОВАН: автор ${post.authorId} НЕ является другом И НЕ является участником общего события с текущим пользователем ${currentUserId}`);
        return false;
      }
      
      logger.debug(`✅ [Memories] Пост ${post.id} - автор является другом ИЛИ участником общего события, показываем`);
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
      
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
<<<<<<< HEAD
        if (event?.name?.toLowerCase().includes(lowerQuery)) {
=======
        if (event?.title?.toLowerCase().includes(lowerQuery)) {
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
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
    
<<<<<<< HEAD
    logger.debug('filteredPosts: итоговое количество отфильтрованных постов', { count: filtered.length, posts: filtered.map(({post, eventId}) => `${eventId}-${post.id}`).join(', ') || 'нет' });
=======
>>>>>>> e1b9553 (Рефакторинг: вынесены стили, удалены неиспользуемые компоненты, исправлена логика transfer organizer role)
    return filtered;
  }, [allPosts, searchQuery, friends, getUserData, eventProfiles, authUser?.id, isFriend]);

  // Дополнительное логирование при изменении filteredPosts
  useEffect(() => {
    console.log('🔄 [Memories] filteredPosts изменился:', {
      count: filteredPosts.length,
      allPostsCount: allPosts.length,
      friendsCount: friends.length
    });
  }, [filteredPosts.length, allPosts.length, friends.length]);

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
          // ПРИНУДИТЕЛЬНОЕ ЛОГИРОВАНИЕ В РЕНДЕРЕ
          console.log('🎨 [Memories] РЕНДЕР:', {
            filteredPostsCount: filteredPosts.length,
            allPostsCount: allPosts.length,
            profilesCount: eventProfiles.length,
            friendsCount: friends.length
          });
          
          logger.debug('Рендер MemoriesScreen', { filteredPostsCount: filteredPosts.length, profilesCount: eventProfiles.length });
          
          if (filteredPosts.length === 0) {
              return (
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
          }
          
          return groupedPosts.map((group, groupIndex) => {
            const isCarousel = group.length > 1;
            // Ширина поста в карусели
            const postWidth = isCarousel ? SCREEN_WIDTH * 0.85 : SCREEN_WIDTH;
            
            if (isCarousel) {
              // Горизонтальная карусель для группы постов одного автора в одном событии
              return (
                <View key={`group-${groupIndex}`} style={styles.postGroupContainer}>
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
                    {group.map(({ post, eventId }, postIndex) => (
                      <View 
                        key={`${eventId}-${post.id}`} 
                        style={[styles.carouselPostItem, { width: postWidth }]}
                      >
                        <MemoryPost 
                          post={post}
                          showOptions={true}
                        />
                      </View>
                    ))}
                  </ScrollView>
                </View>
              );
            } else {
              // Одиночный пост - полная ширина
              const { post, eventId } = group[0];
              return (
                <MemoryPost 
                  key={`${eventId}-${post.id}`}
                  post={post}
                  showOptions={true}
                />
              );
            }
          });
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
  postGroupContainer: {
    marginBottom: 16,
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
