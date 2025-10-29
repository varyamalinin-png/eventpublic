import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import TopBar from '../../components/TopBar';
import MemoryPost from '../../components/MemoryPost';
import { useEvents } from '../../context/EventsContext';

export default function MemoriesScreen() {
  const { eventProfiles, getUserData, friends } = useEvents();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Функция поиска для memories
  const handleMemoriesSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Получаем все посты из аккаунтов событий
  const allPosts = useMemo(() => {
    const posts: Array<{ post: any; eventId: string }> = [];
    
    eventProfiles.forEach(profile => {
      profile.posts.forEach(post => {
        posts.push({ post, eventId: profile.eventId });
      });
    });
    
    return posts.sort((a, b) => 
      new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
    );
  }, [eventProfiles]);

  // Фильтруем посты по друзьям и текущему пользователю
  const filteredPosts = useMemo(() => {
    const currentUserId = 'own-profile-1';
    
    return allPosts.filter(({ post, eventId }) => {
      // Показываем посты текущего пользователя и его друзей
      const isCurrentUser = post.authorId === currentUserId;
      const isFriend = friends.includes(post.authorId);
      
      // Также нужно проверить, есть ли среди участников события друзья или это текущий пользователь
      const profile = eventProfiles.find(ep => ep.eventId === eventId);
      const hasFriendParticipants = profile?.participants.some(id => 
        friends.includes(id) || id === currentUserId
      );
      
      // Показываем пост если:
      // 1. Это пост текущего пользователя
      // 2. Это пост друга
      // 3. В событии участвуют друзья или текущий пользователь
      if (!isCurrentUser && !isFriend && !hasFriendParticipants) return false;
      
      // Поиск по тексту
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        const author = getUserData(post.authorId);
        const event = eventProfiles.find(ep => ep.eventId === eventId);
        
        // Поиск по автору
        if (author.name.toLowerCase().includes(lowerQuery) || 
            author.username.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        // Поиск по названию события
        if (event?.name.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        // Поиск по описанию поста
        if (post.caption?.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        // Поиск по типу контента
        if (post.type.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        return false;
      }
      
      return true;
    });
  }, [allPosts, searchQuery, friends, getUserData, eventProfiles]);

  const onRefresh = () => {
    setRefreshing(true);
    // Симуляция обновления данных
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

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
        {filteredPosts.length > 0 ? (
          filteredPosts.map(({ post, eventId }) => {
            const isMyPost = post.authorId === 'own-profile-1';
            return (
              <MemoryPost 
                key={`${eventId}-${post.id}`}
                post={post}
                showOptions={isMyPost}
              />
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Нет воспоминаний</Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'По вашему запросу ничего не найдено'
                : 'Пока нет постов от вас и ваших друзей'
              }
            </Text>
          </View>
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
