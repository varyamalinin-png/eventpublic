import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import EventCard from '../../components/EventCard';
import FolderCard from '../../components/FolderCard';
import { useEvents } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import type { EventFolder } from '../../types/EventFolder';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function EventFolderViewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEventFolderById, eventFolders, isEventPast } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [folder, setFolder] = useState<EventFolder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFolder = async () => {
      if (!id) return;
      
      try {
        // Сначала проверяем в кэше
        const cachedFolder = eventFolders.find(f => f.id === id);
        if (cachedFolder) {
          setFolder(cachedFolder);
          setLoading(false);
          return;
        }
        
        // Если нет в кэше, загружаем с сервера
        const folderData = await getEventFolderById(id);
        if (folderData) {
          setFolder(folderData);
        }
      } catch (error) {
        console.error('Failed to load folder:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFolder();
  }, [id, getEventFolderById, eventFolders]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  if (!folder) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Папка не найдена</Text>
      </View>
    );
  }

  // Получаем события из папки
  const folderEvents = folder.events || [];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Кнопка назад */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>

        {/* Карточка папки в формате ленты */}
        <View style={styles.folderCardContainer}>
          <FolderCard
            folder={folder}
            onPress={() => router.push(`/event-folder/${folder.id}`)}
            variant="feed"
          />
        </View>

        {/* События в папке */}
        {folderEvents.length > 0 ? (
          <View style={styles.eventsContainer}>
            <Text style={styles.sectionTitle}>События в папке</Text>
            {folderEvents.map((eventItem, index) => {
              // Поддерживаем обе структуры: { event: Event } и просто Event
              const event = (eventItem as any).event || eventItem;
              if (!event || !event.id) {
                return null;
              }

              return (
                <View key={event.id || `event-${index}`} style={styles.eventCardContainer}>
                  <EventCard
                    id={event.id}
                    title={event.title}
                    description={event.description}
                    date={event.date}
                    time={event.time}
                    displayDate={event.displayDate}
                    location={event.location}
                    price={event.price}
                    participants={event.participants}
                    maxParticipants={event.maxParticipants}
                    organizerAvatar={event.organizerAvatar}
                    organizerId={event.organizerId}
                    variant="default"
                    showSwipeAction={false}
                    showOrganizerAvatar={true}
                    mediaUrl={event.mediaUrl}
                    mediaType={event.mediaType}
                    mediaAspectRatio={event.mediaAspectRatio}
                    participantsList={event.participantsList}
                    participantsData={event.participantsData}
                    context="folder-view"
                    folderId={id}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>В папке пока нет событий</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    color: '#f4f4f5',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  backButton: {
    padding: 16,
    paddingTop: 50,
  },
  backText: {
    color: '#f4f4f5',
    fontSize: 16,
  },
  folderCardContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  eventsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginBottom: 16,
  },
  eventCardContainer: {
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999999',
    fontSize: 14,
    textAlign: 'center',
  },
});
