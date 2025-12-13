import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventsContext';
import { eventCardStyles } from './EventCard.styles';

interface EventCardMiniatureProps {
  id: string;
  title: string;
  organizerId: string;
  organizerAvatar: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  variant: 'miniature_1' | 'miniature_2' | 'chat_preview';
  showOrganizerAvatar?: boolean;
  onMiniaturePress?: () => void;
  onLongPress?: () => void;
  participantsData?: Array<{ avatar: string; userId: string; name?: string }>;
  viewerUserId?: string;
}

export default function EventCardMiniature({
  id,
  title,
  organizerId,
  organizerAvatar,
  mediaUrl,
  mediaType = 'image',
  variant,
  showOrganizerAvatar = true,
  onMiniaturePress,
  onLongPress,
  participantsData = [],
  viewerUserId,
}: EventCardMiniatureProps) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const { getEventPhotoForUser, getUserData } = useEvents();

  const miniPhoto = getEventPhotoForUser(id, currentUserId || '', viewerUserId) || mediaUrl || organizerAvatar;

  const handlePress = () => {
    if (onMiniaturePress) {
      onMiniaturePress();
    }
  };

  const handleOrganizerPress = () => {
    if (currentUserId === organizerId) {
      router.push('/(tabs)/profile');
    } else {
      router.push(`/profile/${organizerId}`);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress}
    >
      <View style={[
        eventCardStyles.miniatureCard1,
        variant === 'miniature_2' && eventCardStyles.miniatureCard2,
        variant === 'chat_preview' && eventCardStyles.chatPreview
      ]}>
        {/* Фоновое изображение события */}
        {miniPhoto ? (
          <View style={eventCardStyles.miniatureBackgroundContainer}>
            <Image
              source={{ uri: miniPhoto }}
              style={eventCardStyles.miniatureBackgroundImage}
              onError={() => {
                // Silently handle image loading errors
              }}
            />
            {mediaType === 'video' && (
              <View style={eventCardStyles.miniaturePlayButton}>
                <Text style={eventCardStyles.miniaturePlayIcon}>▶️</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[eventCardStyles.miniatureBackgroundContainer, { backgroundColor: '#2a2a2a' }]} />
        )}

        {/* Аватарка организатора в правом верхнем углу */}
        {showOrganizerAvatar && (() => {
          const organizerData = getUserData(organizerId);
          return (
            <View style={eventCardStyles.miniatureOrganizerAvatarContainer}>
              <TouchableOpacity onPress={handleOrganizerPress}>
                <Image
                  source={{ uri: organizerData.avatar }}
                  style={eventCardStyles.miniatureOrganizerAvatar}
                />
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Участники в правом нижнем углу */}
        {participantsData && participantsData.length > 0 && (
          <View style={eventCardStyles.miniatureParticipantsContainer}>
            {participantsData.slice(0, 3).map((participant, index) => (
              <Image
                key={participant.userId || index}
                source={{ uri: participant.avatar }}
                style={[
                  eventCardStyles.miniatureParticipantAvatar,
                  { marginLeft: index > 0 ? -8 : 0 }
                ]}
              />
            ))}
            {participantsData.length > 3 && (
              <View style={[eventCardStyles.miniatureParticipantAvatar, eventCardStyles.miniatureMoreParticipants]}>
                <Text style={eventCardStyles.miniatureMoreText}>+{participantsData.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Заголовок для chat_preview */}
        {variant === 'chat_preview' && (
          <View style={eventCardStyles.chatPreviewTitleContainer}>
            <Text style={eventCardStyles.chatPreviewTitle}>{title}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

