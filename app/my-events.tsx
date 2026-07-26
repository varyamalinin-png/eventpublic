import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect, useMemo } from 'react';
import EventCard from '../components/EventCard';
import { useEvents, Event } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';

function isMemberOfEvent(event: Event, userId: string, eventProfiles: { eventId: string; participants: string[] }[], isUserOrganizer: (e: Event, u: string) => boolean, isUserEventMember: (e: Event, u: string) => boolean, isEventPast: (e: Event) => boolean): boolean {
  if (!isEventPast(event)) return isUserEventMember(event, userId);
  if (isUserOrganizer(event, userId)) return true;
  const profile = eventProfiles.find(p => p.eventId === event.id);
  return profile ? profile.participants.includes(userId) : false;
}

export default function MyEventsScreen() {
  const { eventId } = useLocalSearchParams();
  const { events, eventProfiles, isUserOrganizer, isUserEventMember, isEventPast } = useEvents();
  const { user: authUser } = useAuth();
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const currentUserId = authUser?.id ?? null;
  
  if (!currentUserId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loginPromptTitle}>Авторизуйтесь</Text>
        <Text style={styles.loginPromptText}>
          Войдите, чтобы увидеть ваши события и участие в мероприятиях.
        </Text>
      </View>
    );
  }
  
  const isMember = useMemo(() => (event: Event) => isMemberOfEvent(event, currentUserId, eventProfiles, isUserOrganizer, isUserEventMember, isEventPast), [currentUserId, eventProfiles, isUserOrganizer, isUserEventMember, isEventPast]);

  // Получаем события, организованные пользователем
  const organizedEvents = events.filter(event => isUserOrganizer(event, currentUserId));
  
  // Получаем события, в которых участвует пользователь (для прошедших — по profile.participants)
  const participatedEvents = events.filter(
    event => isMember(event) && !isUserOrganizer(event, currentUserId),
  );
  
  // Получаем архивные события (прошедшие/архивные; членство по тому же принципу)
  const archivedEvents = events.filter(event => {
    const isArchived = event.title.toLowerCase().includes('архив') || 
                      event.date.includes('прошло') ||
                      event.date.includes('завершено');
    return isArchived && isMember(event);
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Все события пользователя для ленты
  const allEvents = [...organizedEvents, ...participatedEvents, ...archivedEvents];
  const userEvents = allEvents.filter((event, index, self) => {
    const allIndices = self.map((e, i) => e.id === event.id ? i : -1).filter(i => i !== -1);
    return index === allIndices[allIndices.length - 1];
  });

  useEffect(() => {
    if (eventId && userEvents.length > 0) {
      const targetEvent = userEvents.find(e => e.id === eventId);
      if (targetEvent) {
        setSelectedEvent(targetEvent);
        setShowEventFeed(true);
        
        // Прокручиваем к нужному событию
        setTimeout(() => {
          const eventIndex = userEvents.findIndex(e => e.id === eventId);
          if (eventIndex !== -1 && scrollViewRef.current) {
            const cardHeight = 400;
            const marginBottom = 20;
            const totalItemHeight = cardHeight + marginBottom;
            const screenHeight = 800;
            const cardPosition = eventIndex * totalItemHeight;
            const centerOffset = (screenHeight - cardHeight) / 2;
            let scrollToY = cardPosition - centerOffset;
            const totalContentHeight = userEvents.length * totalItemHeight - marginBottom + 20;
            const maxScrollY = Math.max(0, totalContentHeight - screenHeight);
            scrollToY = Math.max(0, Math.min(scrollToY, maxScrollY));
            
            scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
          }
        }, 200);
      }
    }
  }, [eventId, userEvents]);

  if (showEventFeed) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setShowEventFeed(false)}
        >
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <ScrollView 
          ref={scrollViewRef} 
          style={styles.feedContainer}
          contentContainerStyle={styles.feedContentContainer}
        >
          {userEvents.map((event, index) => {
            const isCurrentEvent = !event.title.toLowerCase().includes('архив') && 
                                 !event.date.includes('прошло') && 
                                 !event.date.includes('завершено');
            const isNotParticipating = !isUserEventMember(event, currentUserId);
            const canJoin = isCurrentEvent && isNotParticipating && event.organizerId !== currentUserId;
            
            return (
              <View 
                key={event.id} 
                style={[
                  styles.eventCardWrapper,
                  index === userEvents.length - 1 && styles.lastEventCard
                ]}
              >
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
                  showSwipeAction={canJoin}
                  mediaUrl={event.mediaUrl}
                  mediaType={event.mediaType}
                  mediaAspectRatio={event.mediaAspectRatio}
                  participantsList={event.participantsList}
                  participantsData={event.participantsData}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Мои события</Text>
      <Text style={styles.subtitle}>Выберите событие для просмотра</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loginPromptTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 12,
    textAlign: 'center',
  },
  loginPromptText: {
    fontSize: 16,
    color: '#BBBBCC',
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backText: {
    color: '#0066CC',
    fontSize: 16,
    fontWeight: '500',
  },
  feedContainer: {
    flex: 1,
  },
  feedContentContainer: {
    paddingBottom: 20,
  },
  eventCardWrapper: {
    marginBottom: 20,
  },
  lastEventCard: {
    marginBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4f4f5',
    textAlign: 'center',
    marginTop: 100,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 10,
  },
});
