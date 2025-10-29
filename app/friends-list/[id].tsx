import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEvents } from '../../context/EventsContext';
import { Link } from 'expo-router';

export default function UserFriendsListScreen() {
  const { id } = useLocalSearchParams();
  const { getUserData, getOrganizerStats } = useEvents();
  
  const userId = Array.isArray(id) ? id[0] : id || '';
  const userData = getUserData(userId);
  const userStats = getOrganizerStats(userId);
  
  // Для демонстрации создадим список друзей пользователя
  // В реальном приложении это был бы отдельный API метод
  const generateUserFriends = (targetUserId: string) => {
    const allUserIds = [
      'organizer-1', 'organizer-2', 'organizer-3', 'organizer-4', 'organizer-5',
      'organizer-6', 'organizer-7', 'organizer-8', 'organizer-9', 'organizer-10',
      'organizer-11', 'organizer-12', 'own-profile-1'
    ];
    
    // Исключаем текущего пользователя из списка друзей
    const possibleFriends = allUserIds.filter(userId => userId !== targetUserId);
    
    // Возвращаем случайную выборку друзей
    const friendsCount = Math.min(userStats.friends, possibleFriends.length);
    return possibleFriends.slice(0, friendsCount).map(friendId => {
      const friendData = getUserData(friendId);
      return {
        id: friendId,
        ...friendData
      };
    });
  };
  
  const userFriends = generateUserFriends(userId);

  const renderFriend = ({ item: friend }: { item: any }) => (
    <Link href={`/profile/${friend.id}`} asChild>
      <TouchableOpacity style={styles.friendItem}>
        <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{friend.name}</Text>
          <Text style={styles.friendUsername}>{friend.username}</Text>
          <Text style={styles.friendLocation}>{friend.geoPosition}</Text>
        </View>
      </TouchableOpacity>
    </Link>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Друзья {userData.name}</Text>
        <Text style={styles.subtitle}>{userStats.friends} друзей</Text>
      </View>
      
      <FlatList
        data={userFriends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>У этого пользователя пока нет друзей</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#999',
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
    borderBottomColor: '#333',
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
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendUsername: {
    color: '#999',
    fontSize: 14,
    marginBottom: 2,
  },
  friendLocation: {
    color: '#666',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
