import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import OutgoingRequestMiniCard from './OutgoingRequestMiniCard';

interface OutgoingRequestsGridProps {
  requests: Array<{
    id: string;
    type: 'event' | 'friend';
    eventId?: string;
    userId?: string;
    status?: 'pending' | 'accepted' | 'rejected';
  }>;
  onRequestPress?: (request: { id: string; type: 'event' | 'friend'; eventId?: string; userId?: string; status?: 'pending' | 'accepted' | 'rejected' }) => void;
}

export default function OutgoingRequestsGrid({ requests, onRequestPress }: OutgoingRequestsGridProps) {
  if (requests.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Нет исходящих запросов</Text>
        <Text style={styles.emptySubtext}>Здесь будут отображаться ваши запросы</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        {requests.map((request, index) => (
          <View key={request.id} style={styles.gridItem}>
            <OutgoingRequestMiniCard
              id={request.id}
              type={request.type}
              eventId={request.eventId}
              userId={request.userId}
              status={request.status}
              onPress={() => onRequestPress?.(request)}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

