import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useState } from 'react';
import { useEvents } from '../../../context/EventsContext';

export default function RequestsScreen() {
  const [activeTab, setActiveTab] = useState<'friends' | 'events'>('friends');
  const { friendRequests, respondToFriendRequest, getUserData, events, eventRequests, respondToEventRequest } = useEvents();

  // Фильтруем только входящие заявки в друзья
  const incomingFriendRequests = friendRequests.filter(req => 
    req.toUserId === 'own-profile-1' && req.status === 'pending'
  );

  // Фильтруем заявки на участие в мои события
  const incomingEventRequests = eventRequests.filter(req => {
    const event = events.find(e => e.id === req.eventId);
    return event?.organizerId === 'own-profile-1' && req.status === 'pending';
  });

  const handleFriendRequest = (requestId: string, accepted: boolean) => {
    respondToFriendRequest(requestId, accepted);
  };

  const handleEventRequest = (requestId: string, accepted: boolean) => {
    respondToEventRequest(requestId, accepted);
  };

  return (
    <View style={styles.container}>
      {/* Табы */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Друзья ({incomingFriendRequests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
            События ({incomingEventRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'friends' && (
          <View>
            {incomingFriendRequests.length > 0 ? (
              incomingFriendRequests.map(request => {
                const userData = getUserData(request.fromUserId);
                return (
                  <View key={request.id} style={styles.requestItem}>
                    <Image source={{ uri: userData.avatar }} style={styles.requestAvatar} />
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>{userData.name}</Text>
                      <Text style={styles.requestUsername}>{userData.username}</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity 
                        style={styles.acceptButton}
                        onPress={() => handleFriendRequest(request.id, true)}
                      >
                        <Text style={styles.acceptButtonText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.declineButton}
                        onPress={() => handleFriendRequest(request.id, false)}
                      >
                        <Text style={styles.declineButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Нет новых заявок в друзья</Text>
            )}
          </View>
        )}

        {activeTab === 'events' && (
          <View>
            {incomingEventRequests.length > 0 ? (
              incomingEventRequests.map(request => {
                const event = events.find(e => e.id === request.eventId);
                const userData = getUserData(request.userId);
                
                if (!event) return null;
                
                return (
                  <View key={request.id} style={styles.requestItem}>
                    <View style={styles.requestHeader}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                    </View>
                    <View style={styles.requestContent}>
                      <Image source={{ uri: userData.avatar }} style={styles.requestAvatar} />
                      <View style={styles.requestInfo}>
                        <Text style={styles.requestName}>{userData.name}</Text>
                        <Text style={styles.requestUsername}>{userData.username}</Text>
                        <Text style={styles.eventDescription}>{event.description}</Text>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity 
                          style={styles.acceptButton}
                          onPress={() => handleEventRequest(request.id, true)}
                        >
                          <Text style={styles.acceptButtonText}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.declineButton}
                          onPress={() => handleEventRequest(request.id, false)}
                        >
                          <Text style={styles.declineButtonText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Нет заявок на события</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  requestAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  requestUsername: {
    color: '#999',
    fontSize: 14,
  },
  requestActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  declineButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  eventTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  eventDescription: {
    color: '#999',
    fontSize: 14,
    marginTop: 5,
  },
  requestHeader: {
    marginBottom: 10,
  },
  requestContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    paddingTop: 50,
    fontStyle: 'italic',
  },
});
