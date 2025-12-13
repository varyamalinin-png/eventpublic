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

export default function FolderCard({ folder, onPress, onSwipeDelete, variant = 'profile' }: FolderCardProps) {
  // Для профиля: размер = две карточки + отступ между ними
  const containerPadding = 40; // 20px с каждой стороны
  const gap = 15; // Отступ между карточками
  const availableWidth = SCREEN_WIDTH - containerPadding;
  const singleCardWidth = (availableWidth - gap * 2) / 3; // Ширина одной мини-карточки
  const folderWidth = singleCardWidth * 2 + gap; // Две карточки + отступ

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
          <View style={styles.feedTitleContainer}>
            <View style={styles.feedTitleWithCountContainer}>
              <Text style={styles.feedFolderName} numberOfLines={1}>{folder.name}</Text>
              <Text style={styles.feedEventCount}>
                {folder.eventCount || folder.events?.length || 0} {folder.eventCount === 1 || folder.events?.length === 1 ? 'event' : 'events'}
              </Text>
            </View>
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

  // Для профиля: две объединенные мини-карточки
  // Высота должна быть такой же, как у EventCard в варианте miniature_1 (110px)
  const cardHeight = 110; // Фиксированная высота, как у miniature_1

  return (
    <TouchableOpacity
      style={[styles.profileContainer, { width: folderWidth, height: cardHeight }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: folder.coverPhotoUrl || folder.events?.[0]?.mediaUrl || 'https://via.placeholder.com/200x150' }}
        style={styles.profileImage}
        resizeMode="cover"
      />
      <View style={styles.profileOverlay}>
        <View style={styles.profileTitleContainer}>
          <View style={styles.profileTitleWithCountContainer}>
            <Text style={styles.profileFolderName} numberOfLines={2}>{folder.name}</Text>
            <Text style={styles.profileEventCount}>
              {folder.eventCount || folder.events?.length || 0} {folder.eventCount === 1 || folder.events?.length === 1 ? 'event' : 'events'}
            </Text>
          </View>
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

const styles = StyleSheet.create({
  // Стили для варианта feed (лента)
  feedContainer: {
    width: '100%',
    marginBottom: 15,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
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
  feedTitleContainer: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginRight: 12,
  },
  feedTitleWithCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedFolderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  feedEventCount: {
    fontSize: 11,
    color: '#AAAAAA',
    fontStyle: 'italic',
  },
  feedDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 20,
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
    borderColor: '#FFFFFF',
  },
  feedParticipantMore: {
    backgroundColor: '#4A4A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedParticipantMoreText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Стили для варианта profile (профиль)
  profileContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    marginRight: 15,
    marginBottom: 10,
    marginTop: 5,
    alignSelf: 'flex-start',
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
  profileTitleContainer: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginRight: 8,
  },
  profileTitleWithCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileFolderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileEventCount: {
    fontSize: 10,
    color: '#AAAAAA',
    fontStyle: 'italic',
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
    borderColor: '#FFFFFF',
  },
  profileParticipantMore: {
    backgroundColor: '#4A4A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileParticipantMoreText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
});
