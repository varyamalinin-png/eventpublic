import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import type { EventFolder } from '../types/EventFolder';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FolderCardProps {
  folder: EventFolder;
  onPress: () => void;
  onSwipeDelete?: () => void;
  variant?: 'profile' | 'feed'; // 'profile' - для профиля (две объединенные карточки), 'feed' - для ленты (16:9)
}

function FolderCard({ folder, onPress, onSwipeDelete, variant = 'profile' }: FolderCardProps) {
  // Для профиля: ширина должна задаваться родительским компонентом
  // Не рассчитываем ширину здесь, чтобы родитель мог контролировать размер

  // Форматируем продолжительность в формате дд.мм.гг - дд.мм.гг
  const formatDuration = () => {
    if (!folder.duration) return '';
    const start = new Date(folder.duration.start);
    const end = new Date(folder.duration.end);
    
    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().substring(2);
      return `${day}.${month}.${year}`;
    };
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (variant === 'feed') {
    // Для ленты: 16:9 фото, название, количество событий, продолжительность, участники
    const aspectRatio = 16 / 9;
    const imageHeight = SCREEN_WIDTH / aspectRatio;

    return (
      <TouchableOpacity 
        style={styles.feedContainer}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: folder.coverPhotoUrl || 'https://via.placeholder.com/400x225' }}
          style={[styles.feedImage, { height: imageHeight }]}
          resizeMode="cover"
        />
        <View style={styles.feedOverlay}>
          <View style={styles.feedTitleWithCountContainer}>
            <Text style={styles.feedFolderName} numberOfLines={1}>{folder.name}</Text>
            <Text style={styles.feedEventCount}>
              {folder.eventCount || folder.events?.length || 0} {folder.eventCount === 1 || folder.events?.length === 1 ? 'event' : 'events'}
            </Text>
          </View>
          {folder.description && (
            <Text style={styles.feedDescription} numberOfLines={2}>
              {folder.description}
            </Text>
          )}
          {folder.participants && folder.participants.length > 0 && (
            <View style={styles.feedParticipantsOverlay}>
              {folder.participants.slice(0, 5).map((participant: any, index) => {
                const avatarUrl = participant.avatarUrl || participant.avatar || 'https://via.placeholder.com/40';
                return (
                  <Image
                    key={participant.id || index}
                    source={{ uri: avatarUrl }}
                    style={[
                      styles.feedParticipantAvatar,
                      { marginLeft: index > 0 ? -8 : 0, zIndex: 10 - index }
                    ]}
                  />
                );
              })}
              {folder.participants.length > 5 && (
                <View style={[styles.feedParticipantAvatar, styles.feedParticipantMore]}>
                  <Text style={styles.feedParticipantMoreText}>+{folder.participants.length - 5}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.profileContainer, { height: '100%' }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: folder.coverPhotoUrl || folder.events?.[0]?.mediaUrl || 'https://via.placeholder.com/200x150' }}
        style={styles.profileImage}
        resizeMode="cover"
      />
      <View style={styles.profileOverlay}>
        <View style={styles.profileTitleWithCountContainer}>
          <Text style={styles.profileFolderName} numberOfLines={2}>{folder.name}</Text>
          <Text style={styles.profileEventCount}>
            {folder.eventCount || folder.events?.length || 0} {folder.eventCount === 1 || folder.events?.length === 1 ? 'event' : 'events'}
          </Text>
        </View>
        {folder.participants && folder.participants.length > 0 && (
          <View style={styles.profileParticipantsOverlay}>
            {folder.participants.slice(0, 3).map((participant: any, index) => {
              const avatarUrl = participant.avatarUrl || participant.avatar || 'https://via.placeholder.com/40';
              return (
                <Image
                  key={participant.id || index}
                  source={{ uri: avatarUrl }}
                  style={[
                    styles.profileParticipantAvatar,
                    { marginLeft: index > 0 ? -6 : 0, zIndex: 10 - index }
                  ]}
                />
              );
            })}
            {folder.participants.length > 3 && (
              <View style={[styles.profileParticipantAvatar, styles.profileParticipantMore]}>
                <Text style={styles.profileParticipantMoreText}>+{folder.participants.length - 3}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(FolderCard);

const styles = StyleSheet.create({
  // Стили для варианта feed (лента)
  feedContainer: {
    width: '100%',
    marginBottom: 15,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#141417',
  },
  feedImage: {
    width: '100%',
  },
  feedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  feedTitleWithCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  feedFolderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f4f4f5',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  feedEventCount: {
    fontSize: 11,
    color: '#f4f4f5',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  feedDescription: {
    fontSize: 14,
    color: '#f4f4f5',
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  feedParticipantsOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  feedParticipantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  feedParticipantMore: {
    backgroundColor: '#4A4A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedParticipantMoreText: {
    color: '#f4f4f5',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Стили для варианта profile (профиль)
  profileContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    marginRight: 0, // Убираем marginRight, он задается родителем
    marginBottom: 0, // Убираем marginBottom, он задается родителем
    marginTop: 0, // Убираем marginTop, он задается родителем
    alignSelf: 'flex-start',
    width: '100%', // Занимает всю доступную ширину от родителя
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  profileTitleWithCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginRight: 8,
  },
  profileFolderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f4f4f5',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  profileEventCount: {
    fontSize: 10,
    color: '#f4f4f5',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  profileParticipantsOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileParticipantAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  profileParticipantMore: {
    backgroundColor: '#4A4A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileParticipantMoreText: {
    color: '#f4f4f5',
    fontSize: 8,
    fontWeight: 'bold',
  },
});
