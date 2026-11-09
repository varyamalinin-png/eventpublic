import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Dimensions, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import TopBar from '../../../components/TopBar';
import MemoryPost, { memoryPostCaption } from '../../../components/MemoryPost';
import { useEvents } from '../../../context/EventsContext';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useSafeRouter } from '../../../utils/safeRouter';
import { createLogger } from '../../../utils/logger';
import { AppIcon } from '../../../components/ui/AppIcon';
import { apiRequest } from '../../../services/api';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { cacheKey } from '../../../utils/queryCache';
import { normalizeMediaUrl } from '../../../context/EventsContext.helpers';
import { useGuestGate } from '../../../hooks/useGuestGate';
import { MemoryFeedSkeleton } from '../../../components/MemoryFeedSkeleton';
import { useTabPress } from '../../../hooks/useTabPress';

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
  const navigation = useNavigation();
  const memoriesScrollViewRef = useRef<ScrollView>(null);

  // Повторный тап по уже активному табу «Memories» — назад к началу ленты.
  useTabPress(() => {
    memoriesScrollViewRef.current?.scrollTo({ y: 0, animated: true });
  });

  const { getUserData, cacheServerUsers } = useEvents();
  const { user: authUser, accessToken } = useAuth();
  const { t } = useLanguage();
  // Гость: Memories закрыты — диплинк /memories попадает сюда в обход
  // таб-бара с его guestGuardListeners, поэтому гейт нужен и на экране.
  const isGuest = useGuestGate();

  // Функция навигации для передачи в MemoryPost
  const handleNavigate = (path: string) => {
    router.push(path);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Лента приходит с сервера готовой — /event-profiles/feed.
   *
   * Раньше её собирал сам экран: брал все свои события, отбирал прошедшие,
   * запрашивал профили этих событий пачкой и уже из них выуживал посты,
   * отсеивая чужие по дружбе и участию. Цепочка из четырёх звеньев, и обрыв
   * любого давал пустой экран при том, что посты в базе есть. Вдобавок пост на
   * ПРЕДСТОЯЩЕМ событии в ленту не попадал вовсе: профили запрашивались только
   * для прошедших.
   *
   * Теперь правило видимости живёт на сервере, а экран только рисует. Ответ
   * кэшируется, поэтому при следующем открытии лента появляется сразу, а
   * запрос уходит фоном и подменяет данные, только если они изменились.
   */
  const feedKey = authUser?.id && accessToken
    ? cacheKey(authUser.id, 'memories-feed')
    : null;

  const { data: feed, loading, failed, refresh } = useCachedQuery<{
    posts: any[];
    nextCursor: string | null;
  }>(feedKey, () => apiRequest('/event-profiles/feed?limit=30', {}, accessToken as string), { auto: false });

  /**
   * И повторяем запрос при каждом открытии раздела.
   *
   * С постабными стеками экран остаётся смонтированным, поэтому единственная
   * попытка при первом монтаже — это единственная попытка вообще: не удалась
   * (сеть, ограничитель частоты при старте) — и лента пустая до перезапуска
   * приложения.
   */
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Дозагруженные страницы держим отдельно, чтобы кэш первой страницы оставался
  // компактным: в него незачем складывать всю историю прокрутки.
  const [extraPosts, setExtraPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    setExtraPosts([]);
    setCursor(feed?.nextCursor ?? null);
  }, [feed]);

  // Авторы приходят вместе с постами — раскладываем их по кэшу пользователей,
  // иначе у каждого поста пришлось бы дозапрашивать имя и аватарку.
  useEffect(() => {
    const posts = [...(feed?.posts ?? []), ...extraPosts];
    if (posts.length) cacheServerUsers(posts.map(post => post.author).filter(Boolean));
  }, [feed, extraPosts, cacheServerUsers]);

  const loadMore = React.useCallback(async () => {
    if (!cursor || !accessToken || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      const next = await apiRequest(
        `/event-profiles/feed?limit=30&cursor=${encodeURIComponent(cursor)}`,
        {},
        accessToken,
      );
      if (Array.isArray(next?.posts)) {
        setExtraPosts(prev => [...prev, ...next.posts]);
        setCursor(next.nextCursor ?? null);
      }
    } catch {
      // Не страшно: то, что уже показано, остаётся на экране.
    } finally {
      loadingMoreRef.current = false;
    }
  }, [cursor, accessToken]);

  /** Серверный пост -> то, что ждёт MemoryPost. */
  const allPosts = useMemo(() => {
    const raw = [...(feed?.posts ?? []), ...extraPosts];
    return raw.map(post => ({
      post: {
        id: post.id,
        eventId: post.eventId,
        authorId: post.authorId || post.author?.id || '',
        content: post.content,
        photoUrl: normalizeMediaUrl(post.photoUrl),
        photoUrls: Array.isArray(post.photoUrls)
          ? post.photoUrls.map((url: string) => normalizeMediaUrl(url))
          : undefined,
        captions: Array.isArray(post.captions) ? post.captions : undefined,
        likes: Array.isArray(post.likes) ? post.likes : [],
        comments: Array.isArray(post.comments) ? post.comments : [],
        createdAt: post.createdAt ? new Date(post.createdAt) : new Date(),
      },
      eventId: post.eventId,
      eventTitle: post.profile?.name ?? '',
    }));
  }, [feed, extraPosts]);

  // Функция поиска для memories
  const handleMemoriesSearch = (query: string) => {
    setSearchQuery(query);
  };

  /**
   * Отбор по видимости теперь на сервере, здесь остаётся только поиск.
   */
  const filteredPosts = useMemo(() => {
    if (!searchQuery) return allPosts;
    const query = searchQuery.toLowerCase();
    return allPosts.filter(({ post, eventTitle }) => {
      const author = getUserData(post.authorId);
      return (
        author?.name?.toLowerCase().includes(query) ||
        author?.username?.toLowerCase().includes(query) ||
        eventTitle?.toLowerCase().includes(query) ||
        (post.content || '').toLowerCase().includes(query)
      );
    });
  }, [allPosts, searchQuery, getUserData]);

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
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Гостю Memories не показываем совсем: useGuestGate уже отправил его на
  // регистрацию. Раньше здесь был экран «войдите в аккаунт» — заменён
  // редиректом, как и все остальные закрытые разделы.
  if (isGuest || !authUser) return null;

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
        ref={memoriesScrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 800) {
            loadMore();
          }
        }}
        scrollEventThrottle={200}
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
            hasCursor: Boolean(cursor),
          });

          if (filteredPosts.length === 0) {
            // Данных нет ВООБЩЕ (первое открытие на этом устройстве) — скелетон.
            // Если лента уже лежит в кэше, сюда не попадаем: посты рисуются
            // сразу, а обновление идёт фоном.
            if (loading) {
              return <MemoryFeedSkeleton />;
            }
            // Запрос не прошёл, а показывать нечего. Раньше экран в этом случае
            // просто оставался пустым, и «нет постов» было не отличить от
            // «не загрузилось».
            if (failed) {
              return (
                <View style={styles.emptyContainer}>
                  <AppIcon name="camera" size={60} color="rgba(244,244,245,0.25)" />
                  <Text style={styles.emptyTitle}>{t.common.loadFailedTitle}</Text>
                  <TouchableOpacity onPress={() => refresh()} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>{t.common.tryAgain}</Text>
                  </TouchableOpacity>
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
                              // Карточки стоят рядом — держим одинаковую
                              // высоту, если подпись есть хотя бы у одной.
                              reserveCaptionSpace={group.some(item => !!memoryPostCaption(item.post))}
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
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,141,50,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,141,50,0.5)',
  },
  retryButtonText: {
    color: '#FF8D32',
    fontSize: 15,
    fontWeight: '600',
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
