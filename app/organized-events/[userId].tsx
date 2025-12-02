import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useRef } from 'react';
import EventCard from '../../components/EventCard';
import { useEvents, Event } from '../../context/EventsContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OrganizedEventsScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const { events, getUserData, isUserOrganizer } = useEvents();
  const { user: authUser } = useAuth();
  const { t } = useLanguage();
  const [showEventFeed, setShowEventFeed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const targetUserIdParam = Array.isArray(userId) ? userId[0] : userId;
  const targetUserId = targetUserIdParam ?? authUser?.id ?? null;

  if (!targetUserId) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← {t.common.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t.profile.userNotFound}</Text>
      </View>
    );
  }

  const userData = getUserData(targetUserId);
  
  // Все события где я_организатор_события (текущие и прошлые)
  const organizedEvents = events.filter(event => 
    isUserOrganizer(event, targetUserId)
  );

  const handleEventPress = (event: Event) => {
    setSelectedEvent(event);
    setShowEventFeed(true);
    
    // Прокручиваем к нужному событию после рендера
    setTimeout(() => {
      const eventIndex = organizedEvents.findIndex(e => e.id === event.id);
      if (eventIndex !== -1 && scrollViewRef.current) {
        const cardHeight = 400;
        const marginBottom = 20;
        const totalItemHeight = cardHeight + marginBottom;
        const screenHeight = 800;
        const cardPosition = eventIndex * totalItemHeight;
        const centerOffset = (screenHeight - cardHeight) / 2;
        let scrollToY = cardPosition - centerOffset;
        const totalContentHeight = organizedEvents.length * totalItemHeight - marginBottom + 20;
        const maxScrollY = Math.max(0, totalContentHeight - screenHeight);
        scrollToY = Math.max(0, Math.min(scrollToY, maxScrollY));
        scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
      }
    }, 200);
  };

  // Если показываем ленту событий
  if (showEventFeed) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backToGrid}
          onPress={() => {
            setShowEventFeed(false);
            setSelectedEvent(null);
          }}
        >
          <Text style={styles.backText}>← {t.profile.backToGrid}</Text>
        </TouchableOpacity>
        <ScrollView 
          ref={scrollViewRef} 
          style={styles.feedContainer}
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={true}
          bounces={true}
          alwaysBounceVertical={true}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
        >
          {organizedEvents.map((event, index) => (
            <View 
              key={event.id} 
              style={[
                styles.eventCardWrapper,
                index === organizedEvents.length - 1 && styles.lastEventCard
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
                showSwipeAction={true}
                mediaUrl={event.mediaUrl}
                mediaType={event.mediaType}
                mediaAspectRatio={event.mediaAspectRatio}
                participantsList={event.participantsList}
                participantsData={event.participantsData}
                viewerUserId={targetUserId}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← {t.common.back}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t.profile.organizedEventsTitle} {userData.name}</Text>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.eventsContainer}>
          {organizedEvents.length > 0 ? (
            organizedEvents.map((event, index) => {
              const containerPadding = 40;
              const gap = 15;
              const availableWidth = SCREEN_WIDTH - containerPadding;
              const cardWidth = (availableWidth - gap * 2) / 3;
              const isLastInRow = (index + 1) % 3 === 0;
              
              return (
                <View
                  key={event.id}
                  style={[
                    { width: cardWidth },
                    !isLastInRow && { marginRight: gap }
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
                    variant="miniature_1"
                    showSwipeAction={false}
                    showOrganizerAvatar={false}
                    mediaUrl={event.mediaUrl}
                    mediaType={event.mediaType}
                    mediaAspectRatio={event.mediaAspectRatio}
                    participantsList={event.participantsList}
                    participantsData={event.participantsData}
                    onMiniaturePress={() => handleEventPress(event)}
                    viewerUserId={targetUserId}
                  />
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>{t.profile.eventsNotFound}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#121212',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  eventsContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    width: '100%',
  },
  backToGrid: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  feedContainer: {
    flex: 1,
  },
  feedContentContainer: {
    paddingHorizontal: 20,
    flexGrow: 1,
    paddingBottom: 100,
  },
  eventCardWrapper: {
    marginBottom: 15,
  },
  lastEventCard: {
    marginBottom: 200,
  },
});

