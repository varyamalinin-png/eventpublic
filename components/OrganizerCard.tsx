import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useLanguage } from '../context/LanguageContext';
import { useEvents } from '../context/EventsContext';
import { formatUsername } from '../utils/username';

type OrganizerStats = {
  totalEvents: number;
  organizedEvents: number;
  participatedEvents: number;
  complaints: number;
  friends: number;
  sharedEvents?: number;
};

type OrganizerCardProps = {
  organizerId: string;
  name: string;
  age: string;
  username: string;
  avatar: string;
  bio?: string;
  geoPosition?: string;
  /** Начальные значения — обычно плейсхолдеры; реальные данные грузим сами */
  stats: OrganizerStats;
  correspondingEventId?: string;
  eventHeight?: number;
  currentUserId?: string | null;
  /** Показывать зелёный пульсирующий индикатор «онлайн» рядом с аватаркой */
  isOnline?: boolean;
};

function OrganizerCard({
  organizerId,
  name,
  age,
  username,
  avatar,
  bio,
  geoPosition,
  stats: initialStats,
  correspondingEventId,
  eventHeight,
  currentUserId,
  isOnline = false,
}: OrganizerCardProps) {
  const router = useRouter();
  const { t } = useLanguage();

  // Pulse animation for online indicator dot (Task 2b)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isOnline) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isOnline, pulseAnim]);
  // Грузим реальную статистику лениво — один раз при монтировании карточки.
  // Это изолирует N+1 API-вызовы внутри карточки и не вызывает ре-рендеры explore.
  const { getOrganizerStats } = useEvents();
  const [stats, setStats] = useState<OrganizerStats>(initialStats);

  useEffect(() => {
    if (!getOrganizerStats) return;
    // Небольшая задержка — не блокируем первый рендер и избегаем одновременного запуска N запросов
    const timer = setTimeout(() => {
      const loaded = getOrganizerStats(organizerId);
      setStats(prev => ({
        ...loaded,
        sharedEvents: initialStats.sharedEvents ?? prev.sharedEvents,
      }));
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizerId]);
  
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
        {/* Аватарка занимает верхнюю половину карточки: во всю ширину,
            с мягкими верхними углами по радиусу самой карточки */}
        <View style={[styles.avatarContainer, eventHeight ? { height: Math.round(eventHeight / 2) } : null]}>
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.9} style={styles.avatarTouch}>
            <Image
              source={{ uri: avatar }}
              style={styles.profileAvatar}
            />
          </TouchableOpacity>
          {isOnline && (
            <Animated.View style={[styles.onlineDot, { transform: [{ scale: pulseAnim }] }]} />
          )}
        </View>

        {/* Информация о пользователе */}
        <View style={[styles.userProfileContainer, eventHeight ? styles.userProfileContainerWithHeight : null]}>
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

export default React.memo(OrganizerCard);

// Дизайн в точности как шапка профиля
const styles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#141417',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 0,
    overflow: 'hidden',
  },
  // Аватарка забирает верхнюю половину — инфо-блок занимает остаток без растяжки
  userProfileContainerWithHeight: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 12,
  },
  // Информация о пользователе - в точности как в профиле
  userProfileContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  // Верхняя половина карточки целиком под аватарку
  avatarContainer: {
    position: 'relative',
    width: '100%',
    height: 170,
  },
  avatarTouch: {
    width: '100%',
    height: '100%',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    // Мягкие только верхние углы — совпадают с borderRadius карточки
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#26262b',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#34C759',
    borderWidth: 2.5,
    borderColor: '#141417',
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 5,
  },
  nameAndAge: {
    fontSize: 16,
    color: 'rgba(244,244,245,0.55)',
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
    color: '#f4f4f5',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(244,244,245,0.55)',
    marginTop: 2,
    textAlign: 'center',
  },
});
