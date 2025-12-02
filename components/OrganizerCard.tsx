import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useLanguage } from '../context/LanguageContext';
import { formatUsername } from '../utils/username';

type OrganizerCardProps = {
  organizerId: string;
  name: string;
  age: string;
  username: string;
  avatar: string;
  bio?: string;
  geoPosition?: string;
  stats: {
    totalEvents: number;
    organizedEvents: number;
    participatedEvents: number;
    complaints: number;
    friends: number;
    sharedEvents?: number;
  };
  correspondingEventId?: string;
  eventHeight?: number;
  currentUserId?: string | null;
};

export default function OrganizerCard({
  organizerId,
  name,
  age,
  username,
  avatar,
  bio,
  geoPosition,
  stats,
  correspondingEventId,
  eventHeight,
  currentUserId
}: OrganizerCardProps) {
  const router = useRouter();
  const { t } = useLanguage();
  
  // Проверяем, является ли это профиль текущего пользователя
  const isOwnProfile = currentUserId === organizerId;
  
  const handleProfilePress = () => {
    if (isOwnProfile) {
      // Переходим на таб профиля, а не на /profile/[id]
      router.push('/(tabs)/profile');
    } else {
      router.push(`/profile/${organizerId}`);
    }
  };
  
  const handleAllEventsPress = () => {
    router.push(`/all-events/${organizerId}`);
  };
  
  const handleFriendsPress = () => {
    router.push(`/friends-list/${organizerId}`);
  };
  
  const handleComplaintsPress = () => {
    router.push(`/my-complaints/${organizerId}`);
  };
  
  const handleOrganizedPress = () => {
    router.push(`/organized-events/${organizerId}`);
  };
  
  const handleParticipatedPress = () => {
    router.push(`/participated-events/${organizerId}`);
  };
  
  const handleSharedPress = () => {
    router.push(`/shared-events/${organizerId}`);
  };

  return (
    <View style={styles.swipeContainer}>
      <View style={[styles.card, eventHeight ? { height: eventHeight } : null]}>
        {/* Информация о пользователе - в точности как в профиле */}
        <View style={[styles.userProfileContainer, eventHeight ? styles.userProfileContainerWithHeight : null]}>
          {/* Аватарка - круг того же размера */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={handleProfilePress}>
              <Image 
                source={{ uri: avatar }} 
                style={styles.profileAvatar}
              />
            </TouchableOpacity>
          </View>
          
          {/* Юзернейм */}
          <Text style={styles.username}>{formatUsername(username)}</Text>
          
          {/* Имя и возраст */}
          <Text style={styles.nameAndAge}>{name}, {age}</Text>
          
          {/* О себе */}
          {bio && (
            <Text style={styles.bio}>{bio}</Text>
          )}
          
          {/* Статистика - все сразу без раскрытия, как в профиле */}
          <View style={styles.statsContainer}>
            {/* Первый ряд */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={handleAllEventsPress}>
                <Text style={styles.statNumber}>{stats.totalEvents}</Text>
                <Text style={styles.statLabel}>{t.profile.statsEvents}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statItem} onPress={handleFriendsPress}>
                <Text style={styles.statNumber}>{stats.friends}</Text>
                <Text style={styles.statLabel}>{t.profile.statsFriends}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statItem} onPress={handleComplaintsPress}>
                <Text style={styles.statNumber}>{stats.complaints}</Text>
                <Text style={styles.statLabel}>{t.profile.statsComplaints}</Text>
              </TouchableOpacity>
            </View>
            
            {/* Второй ряд - всегда видимый */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem} onPress={handleOrganizedPress}>
                <Text style={styles.statNumber}>{stats.organizedEvents}</Text>
                <Text style={styles.statLabel}>{t.profile.statsOrganized}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statItem} onPress={handleParticipatedPress}>
                <Text style={styles.statNumber}>{stats.participatedEvents}</Text>
                <Text style={styles.statLabel}>{t.profile.statsParticipated}</Text>
              </TouchableOpacity>
              
              {currentUserId && currentUserId !== organizerId && stats.sharedEvents !== undefined && (
                <TouchableOpacity style={styles.statItem} onPress={handleSharedPress}>
                  <Text style={styles.statNumber}>{stats.sharedEvents}</Text>
                  <Text style={styles.statLabel}>{t.profile.statsShared}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// Дизайн в точности как шапка профиля
const styles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 0,
    overflow: 'hidden',
  },
  userProfileContainerWithHeight: {
    justifyContent: 'center',
    minHeight: '100%',
    paddingTop: 20,
  },
  // Информация о пользователе - в точности как в профиле
  userProfileContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 5,
  },
  nameAndAge: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statsContainer: {
    alignItems: 'center',
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    textAlign: 'center',
  },
});
