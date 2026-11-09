import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Platform } from 'react-native';


import { useLocalSearchParams } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import { Link } from 'expo-router';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { cacheKey } from '../utils/queryCache';
import { FriendListSkeleton } from '../components/FriendRowSkeleton';
import { normalizeMediaUrl } from '../context/EventsContext.helpers';
import { sizedImage } from '../utils/imageSize';
import { useGuestGate } from '../hooks/useGuestGate';

export default function UserFriendsListScreen() {
  const { id } = useLocalSearchParams();
  const { getUserData } = useEvents();
  const { user, accessToken } = useAuth();
  // Гость: список друзей закрыт (диплинк /friends-list/<id> идёт в обход таб-бара).
  const isGuest = useGuestGate();

  const userId = Array.isArray(id) ? id[0] : id || '';
  const userData = getUserData(userId);
  const { t } = useLanguage();

  /**
   * Список приходит с сервера, но рисуется сразу из кэша прошлого открытия —
   * см. useCachedQuery. Пустого экрана в ожидании сети не бывает; на первом в
   * жизни открытии вместо него скелетон, а не надпись «друзей нет».
   */
  const { data: serverFriends, loading } = useCachedQuery<any[]>(
    userId && accessToken ? cacheKey(user?.id, 'friends', userId) : null,
    () => apiRequest(`/friends/user/${userId}`, {}, accessToken as string),
  );

  const userFriends = (serverFriends ?? []).map(friend => ({
    id: friend.id,
    name: friend.name || friend.username,
    username: friend.username,
    avatar: normalizeMediaUrl(friend.avatarUrl),
    geoPosition: getUserData(friend.id).geoPosition,
  }));

  const userStats = { friends: serverFriends?.length ?? 0 };

  const renderFriend = ({ item: friend }: { item: any }) => (
    <Link href={`/profile/${friend.id}`} asChild>
      <TouchableOpacity style={styles.friendItem}>
        <Image source={{ uri: sizedImage(friend.avatar, 50) }} style={styles.friendAvatar} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{friend.name}</Text>
          <Text style={styles.friendUsername}>{friend.username}</Text>
          <Text style={styles.friendLocation}>{friend.geoPosition}</Text>
        </View>
      </TouchableOpacity>
    </Link>
  );

  // Гостю список не рендерим — редирект на регистрацию уже пошёл.
  if (isGuest) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{(t.profile.friendsOf || 'Друзья — {name}').replace('{name}', userData.name || userData.username || '')}</Text>
        <Text style={styles.subtitle}>{(t.profile.friendsCount || 'друзей: {count}').replace('{count}', String(userStats.friends))}</Text>
      </View>
      
      <FlatList
        data={userFriends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <FriendListSkeleton />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t.empty.userNoFriends}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: {
    color: '#f4f4f5',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 16,
    marginTop: 5,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  friendAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendUsername: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    marginBottom: 2,
  },
  friendLocation: {
    color: 'rgba(244,244,245,0.35)',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
