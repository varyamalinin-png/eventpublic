import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useLanguage } from '../context/LanguageContext';
import { useEvents } from '../context/EventsContext';
import { formatUsername } from '../utils/username';
import { Palette } from '../constants/DesignSystem';

/** Счётчики Organized/Participated временно скрыты — как и в шапке профиля.
 *  Вернуть их можно, переключив флаг в true: разметка сохранена. */
const SHOW_ORG_PART = false;

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

  // Длинное «о себе» ломало карточку — сворачиваем и раскрываем по кнопке
  const BIO_PREVIEW_LIMIT = 80;
  const [bioExpanded, setBioExpanded] = useState(false);
  const isBioLong = !!bio && bio.length > BIO_PREVIEW_LIMIT;

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
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.9} style={styles.avatarTouch}>
            <Image
              source={{ uri: avatar }}
              style={styles.profileAvatar}
            />
          </TouchableOpacity>
          {isOnline && (
            <Animated.View style={[styles.onlineDot, { transform: [{ scale: pulseAnim }] }]} />
          )}
          {/* Плавный переход фото в цвет карточки */}
          <LinearGradient
            colors={['rgba(20,20,23,0)', 'rgba(20,20,23,0.75)', '#141417']}
            locations={[0, 0.55, 1]}
            style={styles.avatarFade}
            pointerEvents="none"
          />
        </View>

        {/* Информация о пользователе */}
        <View style={[styles.userProfileContainer, eventHeight ? styles.userProfileContainerWithHeight : null]}>
          {/* Юзернейм */}
          <Text style={styles.username}>{formatUsername(username)}</Text>

          {/* Имя и возраст */}
          <Text style={styles.nameAndAge}>{name}, {age}</Text>

          {/* О себе — длинный текст в одну строку, «Ещё» сразу справа от него */}
          {bio && (
            isBioLong ? (
              <View style={styles.bioRow}>
                <Text style={[styles.bio, styles.bioInline]} numberOfLines={1}>{bio}</Text>
                <TouchableOpacity onPress={() => setBioExpanded(true)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
                  <Text style={styles.bioMore}>{t.common.showMore}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.bio} numberOfLines={2}>{bio}</Text>
            )
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
              
              {/* Число жалоб, поданных на этого пользователя, — не тапабельно:
                  своей страницы "чужие жалобы против X" не существует и не должно,
                  это модерационные данные, а /my-complaints — это МОИ поданные жалобы. */}
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.complaints}</Text>
                <Text style={styles.statLabel}>{t.profile.statsComplaints}</Text>
              </View>
            </View>
            
            {/* Второй ряд: Organized/Participated скрыты флагом SHOW_ORG_PART,
                разметка сохранена — вернуть можно переключением в true */}
            <View style={styles.statsRow}>
              {SHOW_ORG_PART && (
                <TouchableOpacity style={styles.statItem} onPress={handleOrganizedPress}>
                  <Text style={styles.statNumber}>{stats.organizedEvents}</Text>
                  <Text style={styles.statLabel}>{t.profile.statsOrganized}</Text>
                </TouchableOpacity>
              )}

              {SHOW_ORG_PART && (
                <TouchableOpacity style={styles.statItem} onPress={handleParticipatedPress}>
                  <Text style={styles.statNumber}>{stats.participatedEvents}</Text>
                  <Text style={styles.statLabel}>{t.profile.statsParticipated}</Text>
                </TouchableOpacity>
              )}

              {currentUserId && currentUserId !== organizerId && stats.sharedEvents !== undefined && (
                <TouchableOpacity style={styles.statItem} onPress={handleSharedPress}>
                  <Text style={styles.statNumber}>{stats.sharedEvents}</Text>
                  <Text style={styles.statLabel}>{t.profile.statsShared}</Text>
                </TouchableOpacity>
              )}
              
            </View>
          </View>
        </View>

        {/* Полное «о себе» — раскрывается вверх поверх карточки */}
        {bioExpanded && (
          <TouchableOpacity
            style={styles.bioOverlay}
            activeOpacity={1}
            onPress={() => setBioExpanded(false)}
          >
            <LinearGradient
              colors={['rgba(20,20,23,0)', '#141417']}
              locations={[0, 0.35]}
              style={styles.bioOverlayFill}
            >
              <ScrollView
                style={styles.bioScroll}
                contentContainerStyle={styles.bioScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.bioFull}>{bio}</Text>
              </ScrollView>
              <Text style={styles.bioLess}>{t.common.showLess}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
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
  // Инфо-блок идёт сразу под фото, без растяжки на остаток карточки
  userProfileContainerWithHeight: {
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  // Информация о пользователе — подтянута вверх на растушёвку фото,
  // чтобы параметры помещались в карточку
  userProfileContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 4,
    marginTop: -40,
  },
  // Фото сверху карточки в пропорции 3:4
  avatarContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3 / 4,
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
    fontSize: 17,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 2,
  },
  nameAndAge: {
    fontSize: 14,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 6,
  },
  bio: {
    fontSize: 13,
    color: '#CCC',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 12,
  },
  // Строка «о себе» + кнопка «Ещё» справа от текста
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  bioInline: {
    flexShrink: 1,
    marginBottom: 0,
    paddingHorizontal: 0,
    textAlign: 'left',
  },
  // Растушёвка низа фото в цвет карточки
  avatarFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
  },
  bioMore: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.accent,
    marginLeft: 6,
  },
  bioLess: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.accent,
    textAlign: 'center',
    marginBottom: 14,
  },
  // Панель полного описания: раскрывается вверх, перекрывая фото
  bioOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
  },
  bioOverlayFill: {
    paddingHorizontal: 20,
    paddingTop: 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  bioScroll: {
    maxHeight: 220,
  },
  bioScrollContent: {
    paddingBottom: 8,
  },
  bioFull: {
    fontSize: 14,
    color: '#e7e7ea',
    textAlign: 'center',
    lineHeight: 20,
  },
  statsContainer: {
    alignItems: 'center',
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 2,
    paddingHorizontal: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
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
