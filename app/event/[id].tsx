import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvents } from '../../context/EventsContext';
import EventCard from '../../components/EventCard';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { events } = useEvents();
  
  const event = events.find(e => e.id === id);
  
  if (!event) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.errorText}>Событие не найдено</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Назад</Text>
      </TouchableOpacity>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
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
          mediaUrl={event.mediaUrl}
          mediaType={event.mediaType}
          mediaAspectRatio={event.mediaAspectRatio}
          participantsList={event.participantsList}
          participantsData={event.participantsData}
          showSwipeAction={false}
          showOrganizerAvatar={true}
          onMiniaturePress={() => {}}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  backButton: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    zIndex: 10,
  },
  backButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 15,
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});
