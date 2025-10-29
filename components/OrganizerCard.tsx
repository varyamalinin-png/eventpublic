import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';

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
  };
  correspondingEventId?: string;
  eventHeight?: number;
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
  eventHeight
}: OrganizerCardProps) {
  const router = useRouter();
  
  // Отображение текста организатора
  const fullText = `${username}${bio ? ` - ${bio}` : ''}`;
  
  const handleFriendsPress = () => {
    router.push(`/friends-list/${organizerId}`);
  };

  // Динамическая высота карточки на основе события
  const cardHeight = eventHeight || 350;

  return (
    <View style={styles.swipeContainer}>
      <View style={[styles.card, { height: cardHeight }]}>
        <View style={styles.verticalLayout}>
          {/* Заменяем mediaUrl на avatar организатора */}
          <View style={styles.mediaContainerVertical}>
            <Image 
              source={{ uri: avatar }} 
              style={styles.mediaImageVertical} 
            />
          </View>
          
          <Link href={`/profile/${organizerId}`} asChild>
            <TouchableOpacity style={styles.contentContainer}>
            {/* Заменяем title на имя и возраст организатора */}
            <Text style={styles.title} numberOfLines={1}>
              {name}, {age}
            </Text>
            
            {/* Заменяем description на username и bio с функцией show more */}
            <View style={styles.descriptionContainer}>
              <Text style={styles.description} numberOfLines={2}>
                {fullText}
              </Text>
            </View>
            
            {/* Заменяем параметры события на параметры организатора */}
            <View style={styles.parametersContainer}>
              {/* Первая строка */}
              <View style={styles.parameterRow}>
                <TouchableOpacity style={styles.parameterItem}>
                  <Text style={styles.parameterEmoji}>📊</Text>
                  <Text style={styles.parameterText}>Событий: {stats.totalEvents}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.parameterItem} onPress={handleFriendsPress}>
                  <Text style={styles.parameterEmoji}>👥</Text>
                  <Text style={styles.parameterText}>Друзей: {stats.friends}</Text>
                </TouchableOpacity>
              </View>
              
              {/* Вторая строка */}
              <View style={styles.parameterRow}>
                <TouchableOpacity style={styles.parameterItem}>
                  <Text style={styles.parameterEmoji}>⚠️</Text>
                  <Text style={styles.parameterText}>Жалоб: {stats.complaints}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.parameterItem}>
                  <Text style={styles.parameterEmoji}>📍</Text>
                  <Text style={styles.parameterText} numberOfLines={1}>{geoPosition || 'Местоположение'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}

// ТОЧНО ТЕ ЖЕ СТИЛИ что и в EventCard.tsx
const styles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    marginBottom: 24, // Удваиваем отступ для соответствия карточкам событий
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 0,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'visible',
    minHeight: 350, // Минимальная высота для лучшего отображения контента
  },
  verticalLayout: {
    flexDirection: 'column',
    paddingTop: 170,
    paddingBottom: 15,
    position: 'relative',
  },
  mediaContainerVertical: {
    width: '100%',
    height: 160,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  mediaImageVertical: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 8,
  },
  parametersContainer: {
    flexDirection: 'column',
    marginTop: 8,
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  parameterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 1,
    marginHorizontal: 3,
  },
  parameterEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  parameterText: {
    fontSize: 12,
    color: '#333333',
    fontWeight: '500',
  },
  descriptionContainer: {
    marginBottom: 8,
  },
});
